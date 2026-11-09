-- =====================================================================
-- 015 — Owner assistant: "what changed since I was last here"
-- Run in the Supabase SQL Editor after 014_footer_details.sql. Safe to run more than once.
--
--   profiles.last_briefed_at : when this person last pressed "Mark as seen" in the assistant.
--   briefing_counts(since)   : ONE read-only call that counts what is new since then, for every admin section.
--
-- Nothing here is readable by the public website: the function runs with the caller's own rights (security invoker),
-- so only signed-in staff get numbers, and row security still applies.
-- =====================================================================

alter table profiles add column if not exists last_briefed_at timestamptz;

create or replace function briefing_counts(p_since timestamptz)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'inbox_new',        (select count(*) from inbox_items where created_at > p_since),
    'inbox_waiting',    (select count(*) from inbox_items where status = 'unanswered'),
    'leads_new',        (select count(*) from leads where created_at > p_since),
    'leads_won',        (select count(*) from leads where stage = 'won' and updated_at > p_since),
    'leads_lost',       (select count(*) from leads where stage = 'lost' and updated_at > p_since),
    'follow_ups_due',   (select count(*) from leads where next_follow_up is not null and next_follow_up <= current_date and stage not in ('won', 'lost')),
    'buyers_new',       (select count(*) from contacts where created_at > p_since),
    'chat_visitors',    (select count(distinct visitor_id) from chat_sessions where started_at > p_since),
    'chat_messages',    (select count(*) from chat_messages where role = 'user' and created_at > p_since),
    'questions_new',    (select count(*) from unanswered_questions where created_at > p_since and status = 'open'),
    'questions_open',   (select count(*) from unanswered_questions where status = 'open'),
    'stock_in',         (select coalesce(sum(qty_change), 0) from stock_movements where created_at > p_since and qty_change > 0 and reason in ('production', 'opening', 'return')),
    'stock_out',        (select coalesce(-sum(qty_change), 0) from stock_movements where created_at > p_since and qty_change < 0 and reason = 'sale'),
    'stock_corrections',(select count(*) from stock_movements where created_at > p_since and reason in ('adjustment', 'undo')),
    'articles_new',     (select count(*) from articles where created_at > p_since),
    'variants_low',     (select count(*) from variants where is_active and stock > 0 and stock <= low_stock_threshold),
    'variants_out',     (select count(*) from variants where is_active and stock <= 0),
    'bills_drafts',     (select count(*) from bills where status = 'draft'),
    'bills_applied',    (select count(*) from bills where status = 'applied' and applied_at > p_since),
    'scans_failed',     (select count(*) from bill_scan_jobs where status = 'failed' and created_at > p_since),
    'scans_queued',     (select count(*) from bill_scan_jobs where status in ('queued', 'processing'))
  );
$$;
revoke execute on function briefing_counts(timestamptz) from public, anon;
grant execute on function briefing_counts(timestamptz) to authenticated;
