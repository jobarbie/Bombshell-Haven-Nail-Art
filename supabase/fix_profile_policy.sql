-- Run this in Supabase SQL Editor if you get:
-- "bookings violates foreign key constraint bookings_profile_id_fkey"
--
-- This adds the missing policy so nail tech can create their profile if it doesn't exist.

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles 
  for insert with check (auth.uid() = id);
