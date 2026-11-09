-- =====================================================================
-- 014 — Footer details: Facebook, year established, and the owner's real contact details
-- Run in the Supabase SQL Editor after 013_delete_article.sql. Safe to run more than once.
--
-- Adds two Settings fields the public footer shows:
--   facebook          : the page's address name or number (what comes after facebook.com/)
--   established_year  : the year the business started, shown as "Since 2016" (never goes out of date)
-- Both are added to the public_settings view, which stays the only business detail the public website can read
-- (no GSTIN, no alert email).
--
-- Also fills in the details the owner gave us, ONLY where Settings is still empty or still the placeholder,
-- so anything already typed into Settings is never overwritten.
-- =====================================================================

alter table business_settings
  add column if not exists facebook text,
  add column if not exists established_year integer check (established_year between 1900 and 2100);

create or replace view public_settings as
select business_name, tagline, phone, whatsapp, email, address, city, instagram, facebook, established_year
  from business_settings;

-- keep the exact access rules from 011_security.sql (a replaced view keeps its grants; this makes it explicit)
revoke all on public_settings from authenticated;
grant select on public_settings to anon, authenticated;

update business_settings set
  business_name    = case when business_name = 'Leaf Star' then 'Leaf Star Clothing Factory' else business_name end,
  address          = coalesce(nullif(trim(address), ''), '29, 5th Cross Rd, Duggalamma Layout, UBMEC Layout, Phase 3, Peenya'),
  city             = coalesce(nullif(trim(city), ''), 'Bengaluru, Karnataka 560058'),
  email            = coalesce(nullif(trim(email), ''), 'leafstar1986@outlook.com'),
  instagram        = coalesce(nullif(trim(instagram), ''), 'leafstarclothingfactory'),
  facebook         = coalesce(nullif(trim(facebook), ''), '100091435143951'),
  established_year = coalesce(established_year, 2016)
where id = true;
