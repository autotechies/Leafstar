-- =====================================================================
-- 008 — Public website enquiries (Step 6)
-- Run in the Supabase SQL Editor after 007_inventory.sql. Safe to run once.
-- One database call turns a website enquiry into: a lead (or an addition to the buyer's
-- open lead), the articles asked about, a timeline entry, and an Owner Inbox item.
-- Only the server (service role) can call it; the website's own routes check the form first.
-- =====================================================================

create or replace function create_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone   text := p->>'phone';
  v_name    text := trim(coalesce(p->>'name', ''));
  v_source  lead_source := (p->>'source')::lead_source;
  v_message text := nullif(trim(coalesce(p->>'message', '')), '');
  v_lead    uuid;
  v_new     boolean := false;
  v_kind    inbox_kind;
  v_first   uuid;
  v_count   integer := 0;
begin
  if v_phone is null or v_phone !~ '^[0-9]{11,13}$' then raise exception 'Invalid phone number'; end if;
  if v_name = '' then raise exception 'Name is required'; end if;

  -- The one open lead for this phone number (a repeat enquiry adds to it).
  select id into v_lead from leads where phone = v_phone and stage not in ('won', 'lost');

  if v_lead is null then
    begin
      insert into leads (contact_id, name, phone, business_name, city, instagram, source, message)
      values ((select id from contacts where phone = v_phone limit 1), v_name, v_phone,
              nullif(trim(coalesce(p->>'business_name', '')), ''), nullif(trim(coalesce(p->>'city', '')), ''),
              nullif(trim(coalesce(p->>'instagram', '')), ''), v_source, v_message)
      returning id into v_lead;
      v_new := true;
    exception when unique_violation then
      -- Two enquiries from the same phone at the same moment: the other one won; join it.
      select id into v_lead from leads where phone = v_phone and stage not in ('won', 'lost');
    end;
  end if;

  if not v_new then
    update leads set
      business_name = coalesce(business_name, nullif(trim(coalesce(p->>'business_name', '')), '')),
      city          = coalesce(city,          nullif(trim(coalesce(p->>'city', '')), '')),
      instagram     = coalesce(instagram,     nullif(trim(coalesce(p->>'instagram', '')), ''))
     where id = v_lead;
  end if;

  -- Articles asked about (only ones that exist; a colour only if it belongs to that article).
  insert into lead_items (lead_id, article_id, color_id, quantity)
  select v_lead, a.id,
         (select c.id from article_colors c where c.id = nullif(i->>'color_id', '')::uuid and c.article_id = a.id),
         case when (i->>'quantity') ~ '^[0-9]+$' and (i->>'quantity')::int > 0 then (i->>'quantity')::int end
    from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) i
    join articles a on a.id = nullif(i->>'article_id', '')::uuid;
  get diagnostics v_count = row_count;

  select article_id into v_first from lead_items where lead_id = v_lead order by created_at desc limit 1;

  insert into lead_activities (lead_id, kind, body, meta)
  values (v_lead, 'enquiry', coalesce(v_message, 'Enquiry from the website'),
          jsonb_build_object('source', v_source, 'articles', v_count, 'quantity', nullif(p->>'quantity', '')));

  v_kind := case v_source
              when 'contact_form' then 'contact_form'::inbox_kind
              when 'call_click'   then 'callback_request'::inbox_kind
              when 'chatbot'      then 'chat'::inbox_kind
              else 'request_price'::inbox_kind
            end;
  insert into inbox_items (kind, name, phone, lead_id, article_id, preview, meta)
  values (v_kind, v_name, v_phone, v_lead, v_first, left(coalesce(v_message, ''), 200),
          jsonb_build_object('source', v_source, 'articles', v_count));

  return jsonb_build_object('lead_id', v_lead, 'is_new', v_new);
end $$;

revoke all on function create_lead(jsonb) from public, anon, authenticated;
grant execute on function create_lead(jsonb) to service_role;
