-- =====================================================================
-- 005 — Image system (Step 3)
-- Run in the Supabase SQL Editor after 004_step2.sql. Safe to run once.
-- Adds: a private staging bucket for raw uploads, a record of every processed photo
-- (so photos that never get attached to an article can be cleaned up), and the
-- trigger that marks a photo as attached when an article uses it.
-- =====================================================================

-- Raw uploads land here first (private; only the server's service key touches it) and are deleted
-- as soon as the processed versions exist.
insert into storage.buckets (id, name, public) values ('image-staging', 'image-staging', false) on conflict (id) do nothing;

create table image_uploads (
  id            uuid primary key default gen_random_uuid(),
  folder        text not null unique check (folder ~ '^[a-f0-9]{32}$'),  -- random; thumb/medium/large live inside it
  width         integer not null check (width > 0),
  height        integer not null check (height > 0),
  blur_data_url text not null,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  attached_at   timestamptz
);
create index image_uploads_unattached on image_uploads (created_at) where attached_at is null;

alter table image_uploads enable row level security;
create policy admin_all on image_uploads for all to authenticated using (is_admin()) with check (is_admin());

-- When an article starts using a processed photo, remember that it is in use.
create or replace function mark_image_attached() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update image_uploads set attached_at = now()
   where attached_at is null and position(folder in new.url) > 0;
  return new;
end $$;

create trigger article_images_mark_attached
  after insert on article_images
  for each row execute function mark_image_attached();

-- Photos uploaded more than `older_than` ago that no article ever used. The server deletes their
-- files from Storage, then calls forget_image_folders().
create or replace function orphan_image_folders(older_than interval default interval '1 day')
returns setof text
language sql stable security definer set search_path = public as $$
  select folder from image_uploads
   where attached_at is null and created_at < now() - older_than
   order by created_at
   limit 200
$$;

create or replace function forget_image_folders(folders text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from image_uploads where folder = any (folders) and attached_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Only the server (service role) runs the cleanup helpers.
revoke all on function orphan_image_folders(interval), forget_image_folders(text[]) from public, anon, authenticated;
grant execute on function orphan_image_folders(interval), forget_image_folders(text[]) to service_role;
revoke all on function mark_image_attached() from public, anon, authenticated;
