-- Make customer_email optional (we're removing it from UI)
-- Run in Supabase SQL Editor on your existing project.

alter table if exists public.bookings
  add column if not exists customer_phone text;

alter table if exists public.bookings
  alter column customer_email drop not null;

