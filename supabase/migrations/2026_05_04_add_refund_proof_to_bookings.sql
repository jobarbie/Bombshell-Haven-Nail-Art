-- Add refund proof URL to bookings
-- Run this in Supabase SQL Editor to support refund proof uploads when declining appointments.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_proof_url text;
