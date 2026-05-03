-- Ensure payment proof columns exist on bookings
-- Run this in Supabase SQL Editor if payment proof uploads fail with a schema cache error.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_proof_url text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

UPDATE public.bookings
SET payment_status = 'pending'
WHERE payment_status IS NULL
   OR payment_status NOT IN ('pending', 'verified', 'rejected');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'bookings'
      AND constraint_name = 'payment_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT payment_status_check
      CHECK (payment_status IN ('pending', 'verified', 'rejected'));
  END IF;
END
$$;
