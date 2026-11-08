-- =====================================================================
-- 013 — Delete an article that has no real history
-- Run in the Supabase SQL Editor after 012_chat_images.sql. Safe to run more than once.
--
-- Why: while testing, the owner adds dummy articles with stock and needs to remove them. Archiving keeps them forever.
-- Rule: an article can be DELETED only if nothing real depends on it. These keep an article alive (Archive only):
--   * a scanned bill has a line for it (draft or applied)
--   * a buyer lead (CRM) asked about it
--   * its stock history holds a sale or a return, or any entry that belongs to a bill
-- What is allowed to go: the owner's own stock entries (production, opening stock, corrections and their undos).
--
-- The stock ledger stays append-only for everyone and everything else. The only exception is this one function:
-- it switches a transaction-local flag on, the ledger guard checks that flag AND is_admin(), and every row it removes
-- is written to the audit log first. Nothing else can delete or edit a ledger row.
--
--   article_delete_report(article) : what would be removed, and what (if anything) blocks the delete
--   delete_article(article, updated_at) : the delete itself, all or nothing
-- =====================================================================

-- ---------- ledger guard with one narrow exception ----------
create or replace function ledger_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('leafstar.ledger_purge', true) = 'on' and is_admin() then
    return old;
  end if;
  raise exception '% is append-only. Add a correcting row instead.', tg_table_name;
end $$;
revoke all on function ledger_guard() from public, anon, authenticated;

drop trigger if exists trg_ledger_no_change on stock_movements;
create trigger trg_ledger_no_change before update or delete on stock_movements
  for each row execute function ledger_guard();

-- ---------- what would happen if this article were deleted ----------
create or replace function article_delete_report(p_article_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a articles%rowtype;
  bills_n integer; leads_n integer; kept_n integer;
  blockers text[] := '{}';
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select * into a from articles where id = p_article_id;
  if not found then raise exception 'Article not found'; end if;

  select count(distinct bi.bill_id) into bills_n
    from bill_items bi join variants v on v.id = bi.variant_id
   where v.article_id = a.id;
  select count(distinct li.lead_id) into leads_n
    from lead_items li where li.article_id = a.id;
  select count(*) into kept_n
    from stock_movements sm join variants v on v.id = sm.variant_id
   where v.article_id = a.id and (sm.reason in ('sale', 'return') or sm.bill_id is not null);

  if bills_n > 0 then
    blockers := blockers || ('It is on ' || bills_n || ' scanned bill' || case when bills_n = 1 then '' else 's' end);
  end if;
  if leads_n > 0 then
    blockers := blockers || ('It is part of ' || leads_n || ' buyer lead' || case when leads_n = 1 then '' else 's' end);
  end if;
  if kept_n > 0 and bills_n = 0 then
    blockers := blockers || ('Its stock history has ' || kept_n || ' sale or return entr' || case when kept_n = 1 then 'y' else 'ies' end);
  end if;

  return jsonb_build_object(
    'code', a.code,
    'name', a.name,
    'can_delete', cardinality(blockers) = 0,
    'blockers', to_jsonb(blockers),
    'colours', (select count(*) from article_colors where article_id = a.id),
    'photos', (select count(*) from article_images where article_id = a.id),
    'entries', (select count(*) from stock_movements sm join variants v on v.id = sm.variant_id where v.article_id = a.id),
    'pieces', (select coalesce(sum(stock), 0) from variants where article_id = a.id)
  );
end $$;
revoke execute on function article_delete_report(uuid) from public, anon;

-- ---------- delete the article, all or nothing ----------
create or replace function delete_article(p_article_id uuid, p_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a articles%rowtype;
  rep jsonb;
  removed jsonb;
  n_entries integer := 0;
  n_batches integer := 0;
  batch_ids uuid[];
begin
  if not is_admin() then raise exception 'Not allowed'; end if;

  select * into a from articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;
  if a.updated_at <> p_updated_at then
    raise exception 'This article changed since you opened it. Reload and try again.';
  end if;

  rep := article_delete_report(a.id);
  if not (rep ->> 'can_delete')::boolean then
    raise exception 'This article has history that must be kept (%). Archive it instead.',
      (select string_agg(x, '; ') from jsonb_array_elements_text(rep -> 'blockers') x);
  end if;

  -- Photo files are released, not deleted here: the daily cleanup removes them after a day.
  update image_uploads u set attached_at = null, created_at = now()
   where exists (select 1 from article_images i where i.article_id = a.id and position(u.folder in i.url) > 0);

  -- The owner's own stock entries go with the article (this is the only place the ledger allows a delete).
  perform set_config('leafstar.ledger_purge', 'on', true);
  with gone as (
    delete from stock_movements sm using variants v
     where v.id = sm.variant_id and v.article_id = a.id
    returning sm.*
  )
  select coalesce(jsonb_agg(to_jsonb(gone) order by gone.created_at, gone.id), '[]'::jsonb), count(*)::integer
    into removed, n_entries from gone;
  perform set_config('leafstar.ledger_purge', 'off', true);

  if n_entries > 0 then
    insert into audit_log (table_name, row_id, action, old_data, new_data, changed_by)
    values ('stock_movements', a.id::text, 'DELETE',
            jsonb_build_object('article_code', a.code, 'article_name', a.name, 'entries', removed),
            jsonb_build_object('reason', 'article deleted'), auth.uid());
  end if;

  -- Stock-entry groups (batches) that are now empty go too, so no orphans are left behind.
  batch_ids := array(select distinct (e ->> 'batch_id')::uuid from jsonb_array_elements(removed) e where e ->> 'batch_id' is not null);
  delete from batches b
   where b.id = any (batch_ids) and not exists (select 1 from stock_movements m where m.batch_id = b.id);
  get diagnostics n_batches = row_count;

  -- Colours, sizes (variants), photo records and learned names go with the article (cascade).
  delete from articles where id = a.id;

  return jsonb_build_object('code', a.code, 'name', a.name, 'entries', n_entries, 'batches', n_batches);
end $$;
revoke execute on function delete_article(uuid, timestamptz) from public, anon;
