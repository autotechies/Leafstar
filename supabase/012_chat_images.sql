-- =====================================================================
-- 012 — Chatbot photo input (Step 14)
-- Run in the Supabase SQL Editor after 011_security.sql. Safe to run more than once.
-- A visitor may attach one photo to a chat message. The photo is kept in a private bucket for 30 days (a daily job removes it),
-- and "Forget me" removes it at once. Only the server can read or write it.
-- =====================================================================

alter table chat_messages add column if not exists image_path text;

insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', false) on conflict (id) do nothing;
-- No policies on purpose: nobody signs in to read these; the server uses the service key, and staff see them through short-lived signed links.
