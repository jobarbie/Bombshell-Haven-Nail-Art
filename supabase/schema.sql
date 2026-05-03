-- Bombshell Haven Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Drop existing tables if they exist (to avoid conflicts)
-- WARNING: This will delete all data! Only run this on a fresh database or if you want to reset.
-- If you have existing data, comment out the DROP statements below.

drop table if exists public.bookings cascade;
drop table if exists public.blocked_times cascade;
drop table if exists public.nail_samples cascade;
drop table if exists public.profiles cascade;

-- Drop existing functions and triggers
drop function if exists public.handle_new_user() cascade;
drop function if exists public.get_booked_times(uuid) cascade;

-- Nail tech profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  business_name text default 'Bombshell Haven',
  bio text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Nail gallery samples
create table public.nail_samples (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  image_url text not null,
  title text,
  description text,
  created_at timestamptz default now()
);

-- Blocked times (nail tech marks herself unavailable)
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  created_at timestamptz default now(),
  constraint valid_block check (end_time > start_time)
);

-- Bookings (customer requests)
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  customer_name text not null,
  customer_phone text,
  service_type text,
  notes text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'pending' check (status in ('pending', 'approved', 'declined')),
  customer_id uuid references auth.users(id) on delete set null,
  payment_proof_url text,
  refund_proof_url text,
  rating integer check (rating >= 1 and rating <= 5),
  rating_comment text,
  payment_status text default 'pending' check (payment_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint valid_booking_time check (end_time > start_time)
);

-- Indexes for faster queries
create index idx_blocked_times_profile on public.blocked_times(profile_id);
create index idx_blocked_times_range on public.blocked_times(start_time, end_time);
create index idx_bookings_profile on public.bookings(profile_id);
create index idx_bookings_status on public.bookings(status);
create index idx_bookings_start on public.bookings(start_time);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.nail_samples enable row level security;
alter table public.blocked_times enable row level security;
alter table public.bookings enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Nail samples viewable by everyone" on public.nail_samples;
drop policy if exists "Nail tech can manage own samples" on public.nail_samples;
drop policy if exists "Blocked times viewable by everyone" on public.blocked_times;
drop policy if exists "Nail tech can manage own blocked times" on public.blocked_times;
drop policy if exists "Nail tech can update own blocked times" on public.blocked_times;
drop policy if exists "Nail tech can delete own blocked times" on public.blocked_times;
drop policy if exists "Anyone can create booking" on public.bookings;
drop policy if exists "Nail tech can view own bookings" on public.bookings;
drop policy if exists "Nail tech can update own bookings" on public.bookings;

-- Profiles: nail tech can update own profile; anyone can read
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
-- Allow insert so nail tech can create their profile if trigger missed (e.g. signed up before schema)
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Nail samples: viewable by all; only owner can insert/update/delete
create policy "Nail samples viewable by everyone" on public.nail_samples for select using (true);
create policy "Nail tech can manage own samples" on public.nail_samples for all using (auth.uid() = profile_id);

-- Blocked times: anyone can read (for availability), nail tech can manage
create policy "Blocked times viewable by everyone" on public.blocked_times for select using (true);
create policy "Nail tech can manage own blocked times" on public.blocked_times for insert with check (auth.uid() = profile_id);
create policy "Nail tech can update own blocked times" on public.blocked_times for update using (auth.uid() = profile_id);
create policy "Nail tech can delete own blocked times" on public.blocked_times for delete using (auth.uid() = profile_id);

-- Bookings: customers can insert; nail tech can select/update
-- Note: The booking visibility fix allows viewing bookings for first profile too
-- Allow anonymous users (anon role) to create bookings
drop policy if exists "Anyone can create booking" on public.bookings;
drop policy if exists "Authenticated users can create booking" on public.bookings;
drop policy if exists "Public can create booking" on public.bookings;

-- Policy for anonymous users (customers booking without login)
create policy "Anyone can create booking" on public.bookings
for insert
to anon
with check (true);

-- Policy for authenticated users
create policy "Authenticated users can create booking" on public.bookings
for insert
to authenticated
with check (true);

-- Fallback policy for all roles
create policy "Public can create booking" on public.bookings
for insert
to public
with check (true);
create policy "Nail tech can view own bookings" on public.bookings for select using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);
create policy "Nail tech can update own bookings" on public.bookings for update using (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- RPC: returns booked times (pending + approved) for availability check - no customer data
create or replace function public.get_booked_times(p_profile_id uuid)
returns table (start_time timestamptz, end_time timestamptz) as $$
  select start_time, end_time from public.bookings
  where profile_id = p_profile_id and status in ('pending', 'approved');
$$ language sql security definer;

grant execute on function public.get_booked_times(uuid) to anon;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
