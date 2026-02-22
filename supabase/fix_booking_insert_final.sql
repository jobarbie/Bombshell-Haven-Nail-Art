-- FINAL FIX: Allow anonymous users to insert bookings
-- Run this in Supabase SQL Editor
-- This fixes the 401 Unauthorized error

-- Drop ALL existing policies on bookings
drop policy if exists "anon_insert_bookings" on public.bookings;
drop policy if exists "authenticated_insert_bookings" on public.bookings;
drop policy if exists "Anyone can create booking" on public.bookings;
drop policy if exists "Authenticated users can create booking" on public.bookings;
drop policy if exists "Public can create booking" on public.bookings;
drop policy if exists "allow_insert_bookings" on public.bookings;
drop policy if exists "view_bookings" on public.bookings;
drop policy if exists "update_bookings" on public.bookings;
drop policy if exists "Nail tech can view own bookings" on public.bookings;
drop policy if exists "Nail tech can update own bookings" on public.bookings;

-- Ensure RLS is enabled
alter table public.bookings enable row level security;

-- CRITICAL: Grant explicit permissions
grant usage on schema public to anon, authenticated;
grant all on public.bookings to anon, authenticated;

-- Create insert policy for anon (anonymous users/customers)
-- This is what fixes the 401 error
create policy "anon_can_insert_bookings" on public.bookings
for insert
to anon
with check (true);

-- Create insert policy for authenticated users
create policy "authenticated_can_insert_bookings" on public.bookings
for insert
to authenticated
with check (true);

-- Create select policy (for viewing bookings in dashboard)
create policy "view_bookings" on public.bookings
for select
to authenticated
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- Create update policy (for approving/declining)
create policy "update_bookings" on public.bookings
for update
to authenticated
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);
