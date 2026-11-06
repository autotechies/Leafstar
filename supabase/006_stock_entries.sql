-- =====================================================================
-- 006 — Stock entry helpers (Step 4)
-- Run in the Supabase SQL Editor after 005_image_system.sql.
--   undo_batch    : the 15-second Undo after Add Stock / New article / Excel import (all or nothing)
--   import_stock  : Excel import — creates missing articles/colours/sizes and adds stock, one batch, all or nothing
--   next_article_code : "Auto-generate next" for article codes
-- =====================================================================

-- Reverse every entry of a batch at once. Refuses (and changes nothing) if any entry was already undone,
-- belongs to a bill, or the reversal would take stock below zero. Optionally archives the article that the
-- batch created (only if nothing else ever happened to it).
create or replace function undo_batch(p_batch_id uuid, p_archive_article uuid default null) returns integer
language plpgsql as $$
declare m stock_movements%rowtype; n integer := 0;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from batches where id = p_batch_id) then raise exception 'Stock entry not found'; end if;
  for m in
    select * from stock_movements
     where batch_id = p_batch_id and reverses_movement_id is null and reason in ('production', 'opening')
     order by created_at, id
     for update
  loop
    if m.bill_id is not null then raise exception 'This entry belongs to a bill. Undo the bill instead'; end if;
    if exists (select 1 from stock_movements where reverses_movement_id = m.id) then
      raise exception 'This entry was already undone';
    end if;
    perform undo_movement(m.id, 'Undo of stock entry');
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Nothing to undo'; end if;

  if p_archive_article is not null then
    -- Only when every movement of this article belongs to the batch being undone (so nothing else is lost).
    if not exists (
      select 1 from stock_movements sm join variants v on v.id = sm.variant_id
       where v.article_id = p_archive_article and coalesce(sm.batch_id, '00000000-0000-0000-0000-000000000000') <> p_batch_id
    ) then
      update articles set is_active = false, is_public = false where id = p_archive_article;
    end if;
  end if;
  return n;
end $$;
revoke execute on function undo_batch(uuid, uuid) from public, anon;

-- Next free article code for a type ('SH' or 'PN'): LS-SH-0101 -> LS-SH-0102.
create or replace function next_article_code(p_type text) returns text
language plpgsql stable as $$
declare t text := upper(trim(p_type)); last_n integer;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if t not in ('SH', 'PN') then raise exception 'Unknown article type'; end if;
  select coalesce(max((substring(code from '^LS-' || t || '-(\d{4})$'))::integer), 0)
    into last_n from articles where code ~ ('^LS-' || t || '-\d{4}$');
  return 'LS-' || t || '-' || lpad((last_n + 1)::text, 4, '0');
end $$;
revoke execute on function next_article_code(text) from public, anon;

-- Excel import. p = { batch:{code,produced_on,notes},
--   articles:[{code,name,category,garment,style,brand_id,fabric,pattern,moq,
--              colors:[{name,code,hex,stock:{"S":10,"M":20}}]}] }
-- Existing articles/colours/sizes are reused (matched by code); missing ones are created as hidden drafts
-- (an article cannot go public without photos). Returns the batch id.
create or replace function import_stock(p jsonb) returns uuid
language plpgsql as $$
declare
  bid uuid; art jsonb; col jsonb; sz text; q integer;
  aid uuid; cid uuid; vid uuid; acode text; ccode text; ci integer; si integer;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if coalesce(trim(p -> 'batch' ->> 'code'), '') = '' then raise exception 'A batch code is required'; end if;
  if jsonb_typeof(p -> 'articles') is distinct from 'array' or jsonb_array_length(p -> 'articles') = 0 then
    raise exception 'Nothing to import';
  end if;
  insert into batches (code, produced_on, notes)
  values (trim(p -> 'batch' ->> 'code'), coalesce((p -> 'batch' ->> 'produced_on')::date, current_date), p -> 'batch' ->> 'notes')
  returning id into bid;

  for art in select * from jsonb_array_elements(p -> 'articles') loop
    acode := upper(trim(art ->> 'code'));
    select id into aid from articles where code = acode;
    if aid is null then
      insert into articles (code, name, category, garment, style, brand_id, fabric, pattern, moq, is_public)
      values (acode, art ->> 'name', (art ->> 'category')::article_category, art ->> 'garment', art ->> 'style',
              (art ->> 'brand_id')::uuid, art ->> 'fabric', art ->> 'pattern', coalesce((art ->> 'moq')::integer, 50), false)
      returning id into aid;
    end if;

    for col in select * from jsonb_array_elements(art -> 'colors') loop
      ccode := upper(trim(col ->> 'code'));
      select id into cid from article_colors where article_id = aid and (code = ccode or lower(name) = lower(trim(col ->> 'name')));
      if cid is null then
        select coalesce(max(sort_order) + 1, 0) into ci from article_colors where article_id = aid;
        insert into article_colors (article_id, name, code, hex, sort_order)
        values (aid, trim(col ->> 'name'), ccode, col ->> 'hex', ci) returning id into cid;
      end if;
      select code into ccode from article_colors where id = cid;

      si := 0;
      for sz in select jsonb_object_keys(col -> 'stock') loop
        q := (col -> 'stock' ->> sz)::integer;
        if q is null or q < 0 then raise exception 'Stock cannot be negative'; end if;
        select id into vid from variants where color_id = cid and size = upper(trim(sz));
        if vid is null then
          insert into variants (article_id, color_id, size, size_order, sku)
          values (aid, cid, upper(trim(sz)), size_rank(sz, si), upper(acode || '-' || ccode || '-' || trim(sz)))
          returning id into vid;
        end if;
        si := si + 1;
        if q > 0 then
          insert into stock_movements (variant_id, qty_change, reason, batch_id, created_by, note)
          values (vid, q, 'production', bid, auth.uid(), 'Excel import');
        end if;
      end loop;
    end loop;
  end loop;
  return bid;
end $$;
revoke execute on function import_stock(jsonb) from public, anon;
