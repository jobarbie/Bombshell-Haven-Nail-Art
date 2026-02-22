-- Fix booking visibility for nail tech dashboard
--
-- IMPORTANT: Run supabase/schema.sql FIRST to create the tables
-- (profiles, bookings, etc.). This file only updates RLS policies.
--
-- If you get "relation public.profiles does not exist":
-- 1. Open supabase/schema.sql in Supabase SQL Editor
-- 2. Run it to create all tables
-- 3. Then run this file

-- Drop the existing restrictive policies
drop policy if exists "Nail tech can view own bookings" on public.bookings;
drop policy if exists "Nail tech can update own bookings" on public.bookings;

-- Allow viewing: own profile OR first profile (inline subquery, no function)
create policy "Nail tech can view own bookings" on public.bookings
for select
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- Allow updating: own profile OR first profile
create policy "Nail tech can update own bookings" on public.bookings
for update
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);
