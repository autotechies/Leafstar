-- =====================================================================
-- 016 — Customer & Product Intelligence Engine (Real CRM 360)
-- Safe to run in Supabase SQL editor after 015_owner_assistant.sql.
-- Adds garment wholesale tiering, AI profiling, tags, and product/customer 360 helpers.
-- =====================================================================

-- 1. Extend contacts with wholesale CRM intelligence fields
alter table contacts
  add column if not exists customer_tier text default 'new_prospect',
  add column if not exists ai_profile jsonb,
  add column if not exists last_evaluated_at timestamptz,
  add column if not exists tags text[] default '{}';

-- Validate customer_tier values
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_customer_tier_check'
  ) then
    alter table contacts add constraint contacts_customer_tier_check
      check (customer_tier in ('vip_wholesaler', 'active_retailer', 'sample_buyer', 'at_risk', 'payment_risk', 'new_prospect'));
  end if;
end $$;

-- 2. Function for updating customer AI profile and tier (Staff / Admin only)
create or replace function save_customer_ai_profile(
  p_contact_id uuid,
  p_tier text,
  p_profile jsonb,
  p_tags text[] default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Not allowed';
  end if;

  update contacts set
    customer_tier = coalesce(p_tier, customer_tier),
    ai_profile = p_profile,
    tags = case when p_tags is not null then p_tags else tags end,
    last_evaluated_at = now(),
    updated_at = now()
  where id = p_contact_id;
end $$;

revoke execute on function save_customer_ai_profile(uuid, text, jsonb, text[]) from public, anon;
grant execute on function save_customer_ai_profile(uuid, text, jsonb, text[]) to authenticated;

-- 3. Batch bulk save contacts for raw file import (atomic, safe, staff-only)
create or replace function bulk_upsert_buyers(p_buyers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  v_phone text;
  v_name text;
  v_contact_id uuid;
  v_inserted int := 0;
  v_updated int := 0;
begin
  if not is_admin() then
    raise exception 'Not allowed';
  end if;

  for item in select * from jsonb_array_elements(p_buyers)
  loop
    v_phone := nullif(trim(item->>'phone'), '');
    v_name  := trim(coalesce(item->>'name', ''));

    if v_name = '' then
      continue;
    end if;

    if v_phone is not null then
      select id into v_contact_id from contacts where phone = v_phone;
    else
      v_contact_id := null;
    end if;

    if v_contact_id is null then
      insert into contacts (
        name, business_name, phone, email, city, gstin, credit_limit, payment_terms_days, notes, roles, customer_tier, tags
      ) values (
        v_name,
        nullif(trim(coalesce(item->>'business_name', '')), ''),
        v_phone,
        nullif(trim(coalesce(item->>'email', '')), ''),
        nullif(trim(coalesce(item->>'city', '')), ''),
        nullif(trim(coalesce(item->>'gstin', '')), ''),
        nullif(item->>'credit_limit', '')::numeric(12,2),
        nullif(item->>'payment_terms_days', '')::integer,
        nullif(trim(coalesce(item->>'notes', '')), ''),
        '{buyer}',
        coalesce(item->>'customer_tier', 'new_prospect'),
        coalesce(array(select jsonb_array_elements_text(item->'tags')), '{}'::text[])
      )
      returning id into v_contact_id;
      v_inserted := v_inserted + 1;
    else
      update contacts set
        name               = v_name,
        business_name      = coalesce(nullif(trim(coalesce(item->>'business_name', '')), ''), business_name),
        email              = coalesce(nullif(trim(coalesce(item->>'email', '')), ''), email),
        city               = coalesce(nullif(trim(coalesce(item->>'city', '')), ''), city),
        gstin              = coalesce(nullif(trim(coalesce(item->>'gstin', '')), ''), gstin),
        credit_limit       = coalesce(nullif(item->>'credit_limit', '')::numeric(12,2), credit_limit),
        payment_terms_days = coalesce(nullif(item->>'payment_terms_days', '')::integer, payment_terms_days),
        notes              = case
                               when nullif(trim(coalesce(item->>'notes', '')), '') is not null
                               then concat_ws(E'\n---\n', notes, trim(item->>'notes'))
                               else notes
                             end,
        roles              = case when 'buyer' = any(roles) then roles else roles || 'buyer'::contact_role end,
        customer_tier      = coalesce(nullif(item->>'customer_tier', ''), customer_tier),
        updated_at         = now()
      where id = v_contact_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end $$;

revoke execute on function bulk_upsert_buyers(jsonb) from public, anon;
grant execute on function bulk_upsert_buyers(jsonb) to authenticated;
