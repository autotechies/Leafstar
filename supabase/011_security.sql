-- =====================================================================
-- 011 — Security hardening (Step 12)
-- Run in the Supabase SQL Editor after 010_crm.sql. Safe to run more than once.
-- Supabase gives every NEW table and view in the public schema full rights for the website's anonymous role
-- (and for any signed-in user) by default. The two public views were created after the earlier "remove all rights" step,
-- so they carried INSERT/UPDATE/DELETE rights too. A simple view such as public_settings can be written through,
-- using the owner's rights, which skips Row Level Security. This closes that, and stops it happening again.
-- =====================================================================

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on public_catalog, public_settings from authenticated;

-- The only things the website may read, and only read.
grant select on public_catalog, public_settings to anon, authenticated;

-- Anything created from now on starts closed for the anonymous role.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
