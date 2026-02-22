-- SIMPLE FIX: Allow anonymous users to insert bookings
-- Copy and paste this ENTIRE file into Supabase SQL Editor and run it

-- Step 1: Drop all existing policies
drop policy if exists "anon_can_insert_bookings" on public.bookings;
drop policy if exists "authenticated_can_insert_bookings" on public.bookings;
drop policy if exists "view_bookings" on public.bookings;
drop policy if exists "update_bookings" on public.bookings;
drop policy if exists "Anyone can create booking" on public.bookings;
drop policy if exists "Authenticated users can create booking" on public.bookings;
drop policy if exists "Public can create booking" on public.bookings;
drop policy if exists "allow_insert_bookings" on public.bookings;
drop policy if exists "anon_insert_bookings" on public.bookings;
drop policy if exists "authenticated_insert_bookings" on public.bookings;
drop policy if exists "Nail tech can view own bookings" on public.bookings;
drop policy if exists "Nail tech can update own bookings" on public.bookings;

-- Step 2: Ensure RLS is enabled
alter table public.bookings enable row level security;

-- Step 3: Grant permissions (this is critical!)
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant insert, select, update on public.bookings to anon;
grant insert, select, update on public.bookings to authenticated;

-- Step 4: Create insert policy for anonymous users (customers)
create policy "anon_insert" on public.bookings
for insert
to anon
with check (true);

-- Step 5: Create insert policy for authenticated users
create policy "authenticated_insert" on public.bookings
for insert
to authenticated
with check (true);

-- Step 6: Create select policy (for dashboard - viewing bookings)
create policy "view_bookings" on public.bookings
for select
to authenticated
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- Step 7: Create update policy (for approving/declining)
create policy "update_bookings" on public.bookings
for update
to authenticated
using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- Verify: Check if policies were created
select schemaname, tablename, policyname, roles, cmd, qual 
from pg_policies 
where tablename = 'bookings';
