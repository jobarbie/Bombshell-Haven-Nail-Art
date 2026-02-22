-- Fix RLS policy for bookings visibility
-- This ensures nail techs can see bookings for the first profile
-- Run this AFTER schema.sql

-- Drop existing policies
drop policy if exists "Nail tech can view own bookings" on public.bookings;
drop policy if exists "Nail tech can update own bookings" on public.bookings;

-- Create a stable function to get the first profile ID
-- This is more reliable than a subquery in the policy
create or replace function public.get_first_profile_id()
returns uuid
language sql
stable
as $$
  SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
$$;

-- Grant execute to authenticated users
grant execute on function public.get_first_profile_id() to authenticated;

-- Create policies using the function
create policy "Nail tech can view own bookings" on public.bookings
for select
using (
  profile_id = auth.uid()
  OR
  profile_id = public.get_first_profile_id()
);

create policy "Nail tech can update own bookings" on public.bookings
for update
using (
  profile_id = auth.uid()
  OR
  profile_id = public.get_first_profile_id()
);
