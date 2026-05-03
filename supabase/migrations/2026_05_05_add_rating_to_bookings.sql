-- Add customer rating fields to bookings
-- Run this in Supabase SQL Editor to support experience ratings from customers.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rating integer;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rating_comment text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'bookings'
      AND constraint_name = 'bookings_rating_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_rating_check
      CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
  END IF;
END
$$;
