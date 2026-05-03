-- Fix: allow inserting bookings under RLS (anon + authenticated)
-- Run in Supabase SQL Editor (same project as your .env URL)

-- 1) Ensure RLS is enabled
alter table if exists public.bookings enable row level security;

-- 2) Ensure table privileges are granted
grant usage on schema public to anon, authenticated;
grant insert on table public.bookings to anon, authenticated;
grant select on table public.bookings to authenticated;
grant update on table public.bookings to authenticated;

-- 3) Remove any conflicting/old insert policies
drop policy if exists "anon_can_insert_bookings" on public.bookings;
drop policy if exists "authenticated_can_insert_bookings" on public.bookings;
drop policy if exists "Anyone can create booking" on public.bookings;
drop policy if exists "Public can create booking" on public.bookings;
drop policy if exists "Authenticated users can create booking" on public.bookings;
drop policy if exists "anon_insert_bookings" on public.bookings;
drop policy if exists "authenticated_insert_bookings" on public.bookings;
drop policy if exists "allow_insert_bookings" on public.bookings;

-- 4) Recreate insert policies (permissive)
create policy "anon_can_insert_bookings"
on public.bookings
for insert
to anon
with check (true);

create policy "authenticated_can_insert_bookings"
on public.bookings
for insert
to authenticated
with check (true);

