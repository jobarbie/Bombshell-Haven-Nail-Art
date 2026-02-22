-- Complete fix for booking insert policy
-- Run this in Supabase SQL Editor

-- First, drop ALL existing policies on bookings table
drop policy if exists "Anyone can create booking" on public.bookings;
drop policy if exists "Authenticated users can create booking" on public.bookings;
drop policy if exists "Public can create booking" on public.bookings;
drop policy if exists "Nail tech can view own bookings" on public.bookings;
drop policy if exists "Nail tech can update own bookings" on public.bookings;

-- Ensure RLS is enabled
alter table public.bookings enable row level security;

-- Grant necessary permissions (if needed)
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant all on public.bookings to anon;
grant all on public.bookings to authenticated;

-- Create insert policy for anonymous users (customers)
create policy "anon_insert_bookings" on public.bookings
for insert
to anon
with check (true);

-- Create insert policy for authenticated users
create policy "authenticated_insert_bookings" on public.bookings
for insert
to authenticated
with check (true);

-- Recreate select policy (with booking visibility fix)
create policy "Nail tech can view own bookings" on public.bookings
for select
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- Recreate update policy
create policy "Nail tech can update own bookings" on public.bookings
for update
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);
