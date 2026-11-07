-- =====================================================================
-- 009 — Bulk bill scanning (Step 7)
-- Run in the Supabase SQL Editor after 008_public_leads.sql. Safe to run once.
--   norm_alias       : the key a corrected match is remembered under
--   match_bill_line  : article code / SKU → learned alias → fuzzy name match (server only)
--   finish_scan_job  : turns a read bill into a draft bill with matched lines, all or nothing (server only)
--   save_bill_draft  : saves the owner's edits, optionally applies the bill, learns corrections, links the buyer
-- =====================================================================

create or replace function norm_alias(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', ' ', 'g'))
$$;

-- Finds the variant a bill line most likely means. Returns no row when nothing is close enough.
create or replace function match_bill_line(p_raw text, p_name text, p_colour text, p_size text)
returns table (variant_id uuid, method text, confidence numeric)
language plpgsql stable as $$
declare
  v_text  text := upper(coalesce(p_raw, '') || ' ' || coalesce(p_name, ''));
  v_sku   text := substring(v_text from 'LS-[A-Z]{2}-[0-9]{4}-[A-Z]{3}-[A-Z]{1,3}');
  v_code  text := substring(v_text from 'LS-[A-Z]{2}-[0-9]{4}');
  v_size  text := upper(trim(coalesce(p_size, '')));
  v_key   text := norm_alias(coalesce(p_name, '') || ' ' || coalesce(p_colour, '') || ' ' || coalesce(p_size, ''));
  v_id    uuid;
  v_score numeric;
begin
  -- 1. the exact variant code printed on the bill
  if v_sku is not null then
    select v.id into v_id from variants v where v.sku = v_sku and v.is_active;
    if v_id is not null then return query select v_id, 'sku'::text, 1.000::numeric; return; end if;
  end if;

  -- 2. the article code, with colour and size read from the line
  if v_code is not null and v_size <> '' then
    select v.id into v_id
      from variants v join articles a on a.id = v.article_id join article_colors c on c.id = v.color_id
     where a.code = v_code and upper(v.size) = v_size and v.is_active
       and (coalesce(trim(p_colour), '') = '' or lower(c.name) = lower(trim(p_colour)) or similarity(lower(c.name), lower(p_colour)) > 0.6)
     order by similarity(lower(c.name), lower(coalesce(p_colour, ''))) desc limit 1;
    if v_id is not null then return query select v_id, 'sku'::text, 0.980::numeric; return; end if;
  end if;

  -- 3. a match the owner corrected before
  if v_key <> '' then
    select v.id into v_id
      from item_aliases al
      join variants v on v.article_id = al.article_id and v.is_active
       and (al.color_id is null or v.color_id = al.color_id)
       and upper(v.size) = upper(coalesce(al.size, v_size))
     where al.alias_norm = v_key limit 1;
    if v_id is not null then return query select v_id, 'alias'::text, 0.950::numeric; return; end if;
  end if;

  -- 4. the closest article + colour name, for the size on the line
  if v_size <> '' then
    select v.id, least(0.9, similarity(lower(a.name || ' ' || c.name), lower(coalesce(p_name, '') || ' ' || coalesce(p_colour, ''))))
      into v_id, v_score
      from variants v join articles a on a.id = v.article_id join article_colors c on c.id = v.color_id
     where v.is_active and a.is_active and upper(v.size) = v_size
     order by 2 desc limit 1;
    if v_id is not null and v_score >= 0.45 then
      return query select v_id, 'fuzzy'::text, round(v_score, 3);
      return;
    end if;
  end if;
end $$;

-- p = { bill_number, bill_date, buyer_name, total, lines:[{raw_text,name,colour,size,qty,unit,rate,amount}] }
create or replace function finish_scan_job(p_job uuid, p jsonb) returns uuid
language plpgsql as $$
declare
  j bill_scan_jobs; b uuid; l jsonb; m record; q integer; lot integer;
begin
  select * into j from bill_scan_jobs where id = p_job for update;
  if not found then raise exception 'Scan job not found'; end if;

  insert into bills (bill_number, bill_date, buyer_name_raw, file_path, file_hash, extracted_json, total_amount, status)
  values (nullif(trim(p ->> 'bill_number'), ''), nullif(p ->> 'bill_date', '')::date, nullif(trim(p ->> 'buyer_name'), ''),
          j.file_path, j.file_hash, p, nullif(p ->> 'total', '')::numeric, 'draft')
  returning id into b;

  for l in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]'::jsonb)) loop
    q := round(coalesce(nullif(l ->> 'qty', '')::numeric, 0));
    if q <= 0 then continue; end if;
    select * into m from match_bill_line(l ->> 'raw_text', l ->> 'name', l ->> 'colour', l ->> 'size');
    if lower(coalesce(l ->> 'unit', 'pieces')) = 'lots' then
      select coalesce(a.lot_size, 1) into lot from variants v join articles a on a.id = v.article_id where v.id = m.variant_id;
      q := q * coalesce(lot, 1);
    end if;
    insert into bill_items (bill_id, variant_id, raw_text, extracted_name, extracted_color, extracted_size, qty, rate, amount, match_method, match_confidence)
    values (b, m.variant_id, left(l ->> 'raw_text', 500), left(l ->> 'name', 200), left(l ->> 'colour', 100), left(l ->> 'size', 20), q,
            nullif(l ->> 'rate', '')::numeric, nullif(l ->> 'amount', '')::numeric, m.method, m.confidence);
  end loop;

  update bill_scan_jobs set status = 'extracted', bill_id = b, error = null, finished_at = now() where id = p_job;
  return b;
end $$;

-- p = { bill_number, bill_date, buyer_name, items:[{variant_id,raw_text,name,colour,size,qty,rate,amount,method,confidence,learn}] }
create or replace function save_bill_draft(p_bill uuid, p jsonb, p_apply boolean default false) returns jsonb
language plpgsql as $$
declare
  b bills%rowtype; it jsonb; v variants%rowtype; vid uuid; q integer; buyer text; cid uuid; key text;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select * into b from bills where id = p_bill for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.status <> 'draft' then raise exception 'This bill is already %', b.status; end if;

  buyer := nullif(trim(p ->> 'buyer_name'), '');
  update bills set bill_number = nullif(trim(p ->> 'bill_number'), ''), bill_date = nullif(p ->> 'bill_date', '')::date, buyer_name_raw = buyer
   where id = p_bill;

  delete from bill_items where bill_id = p_bill;
  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    q := nullif(it ->> 'qty', '')::integer;
    if q is null or q <= 0 then raise exception 'Every line needs a quantity of at least 1'; end if;
    vid := nullif(it ->> 'variant_id', '')::uuid;
    insert into bill_items (bill_id, variant_id, raw_text, extracted_name, extracted_color, extracted_size, qty, rate, amount, match_method, match_confidence)
    values (p_bill, vid, left(it ->> 'raw_text', 500), left(it ->> 'name', 200), left(it ->> 'colour', 100), left(it ->> 'size', 20), q,
            nullif(it ->> 'rate', '')::numeric, nullif(it ->> 'amount', '')::numeric,
            case when vid is null then null else coalesce(nullif(it ->> 'method', ''), 'manual') end,
            case when vid is null then null else nullif(it ->> 'confidence', '')::numeric end);

    -- A corrected match is remembered, so the same wording matches next time.
    if vid is not null and coalesce((it ->> 'learn')::boolean, false) then
      key := norm_alias(coalesce(it ->> 'name', '') || ' ' || coalesce(it ->> 'colour', '') || ' ' || coalesce(it ->> 'size', ''));
      if key <> '' then
        select * into v from variants where id = vid;
        insert into item_aliases (alias_norm, article_id, color_id, size) values (key, v.article_id, v.color_id, v.size)
        on conflict (alias_norm) do update set article_id = excluded.article_id, color_id = excluded.color_id, size = excluded.size;
      end if;
    end if;
  end loop;

  if p_apply then
    perform apply_bill(p_bill);
    -- The buyer on the bill becomes (or is linked to) a contact.
    if buyer is not null then
      select id into cid from contacts where lower(name) = lower(buyer) order by created_at limit 1;
      if cid is null then insert into contacts (name, roles) values (buyer, '{buyer}') returning id into cid; end if;
      update bills set contact_id = cid where id = p_bill;
    end if;
  end if;
  return jsonb_build_object('bill_id', p_bill, 'applied', p_apply);
end $$;

revoke all on function match_bill_line(text, text, text, text) from public, anon, authenticated;
revoke all on function finish_scan_job(uuid, jsonb) from public, anon, authenticated;
grant execute on function match_bill_line(text, text, text, text), finish_scan_job(uuid, jsonb) to service_role;
revoke all on function save_bill_draft(uuid, jsonb, boolean) from public, anon;
