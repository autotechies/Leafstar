-- =====================================================================
-- 010 — CRM (Step 10)
-- Run in the Supabase SQL Editor after 009_bill_scanning.sql. Safe to run once.
-- move_lead: change a lead's stage in one step (Lost needs a reason; Won creates or links the buyer; timeline entry written).
-- create_manual_lead: a lead the owner adds by hand (a phone call, a visit, Instagram).
-- Both are for signed-in staff only.
-- =====================================================================

create or replace function move_lead(p_lead uuid, p_stage lead_stage, p_reason text default null, p_expected timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l         leads%rowtype;
  v_old     lead_stage;
  v_contact uuid;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select * into l from leads where id = p_lead for update;
  if not found then raise exception 'That lead no longer exists'; end if;
  if p_expected is not null and l.updated_at <> p_expected then
    raise exception 'This lead was changed by someone else. Reload and try again.';
  end if;
  if l.stage = p_stage then
    return jsonb_build_object('stage', l.stage, 'contact_id', l.contact_id, 'updated_at', l.updated_at);
  end if;
  if p_stage = 'lost' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Tell us why this lead was lost';
  end if;
  -- Re-opening a closed lead must not create a second open lead for the same phone number.
  if l.stage in ('won', 'lost') and p_stage not in ('won', 'lost')
     and exists (select 1 from leads where phone = l.phone and stage not in ('won', 'lost') and id <> l.id) then
    raise exception 'This buyer already has another open lead';
  end if;

  v_old := l.stage;
  if p_stage = 'won' then
    select id into v_contact from contacts where phone = l.phone;
    if v_contact is null then
      insert into contacts (name, business_name, phone, instagram, city, roles)
      values (l.name, l.business_name, l.phone, l.instagram, l.city, '{buyer}')
      returning id into v_contact;
    else
      update contacts set
        roles         = case when 'buyer' = any(roles) then roles else roles || 'buyer'::contact_role end,
        business_name = coalesce(business_name, l.business_name),
        instagram     = coalesce(instagram, l.instagram),
        city          = coalesce(city, l.city),
        is_active     = true
       where id = v_contact;
    end if;
  end if;

  update leads set
    stage       = p_stage,
    lost_reason = case when p_stage = 'lost' then trim(p_reason) else null end,
    contact_id  = coalesce(v_contact, contact_id)
   where id = p_lead
  returning * into l;

  insert into lead_activities (lead_id, kind, body, meta, created_by)
  values (p_lead, 'stage_change', v_old::text || ' to ' || p_stage::text,
          jsonb_build_object('from', v_old, 'to', p_stage, 'reason', nullif(trim(coalesce(p_reason, '')), '')), auth.uid());

  return jsonb_build_object('stage', l.stage, 'contact_id', l.contact_id, 'updated_at', l.updated_at);
end $$;

create or replace function create_manual_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := p->>'phone';
  v_name  text := trim(coalesce(p->>'name', ''));
  v_lead  uuid;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if v_phone is null or v_phone !~ '^[0-9]{11,13}$' then raise exception 'Invalid phone number'; end if;
  if v_name = '' then raise exception 'Name is required'; end if;

  select id into v_lead from leads where phone = v_phone and stage not in ('won', 'lost');
  if v_lead is not null then
    return jsonb_build_object('lead_id', v_lead, 'existing', true);
  end if;

  insert into leads (contact_id, name, phone, business_name, city, instagram, source, message, next_follow_up)
  values ((select id from contacts where phone = v_phone limit 1), v_name, v_phone,
          nullif(trim(coalesce(p->>'business_name', '')), ''), nullif(trim(coalesce(p->>'city', '')), ''),
          nullif(trim(coalesce(p->>'instagram', '')), ''), 'manual', nullif(trim(coalesce(p->>'message', '')), ''),
          nullif(p->>'next_follow_up', '')::date)
  returning id into v_lead;

  insert into lead_activities (lead_id, kind, body, created_by) values (v_lead, 'note', 'Added by hand', auth.uid());
  return jsonb_build_object('lead_id', v_lead, 'existing', false);
end $$;

revoke execute on function move_lead(uuid, lead_stage, text, timestamptz) from public, anon;
revoke execute on function create_manual_lead(jsonb) from public, anon;
grant execute on function move_lead(uuid, lead_stage, text, timestamptz) to authenticated;
grant execute on function create_manual_lead(jsonb) to authenticated;
