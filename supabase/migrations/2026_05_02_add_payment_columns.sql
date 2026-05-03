-- Add payment_proof_url and payment_status columns to bookings table
-- This migration ensures the columns exist for storing payment proofs

-- Add payment_proof_url column if it doesn't exist
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_proof_url text;

-- Add payment_status column if it doesn't exist (without constraint yet)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Ensure all existing payment_status values are valid
UPDATE public.bookings
SET payment_status = 'pending'
WHERE payment_status IS NULL OR payment_status NOT IN ('pending', 'verified', 'rejected');

-- Add constraint for payment_status if not already present
DO $$
BEGIN
  -- Check if constraint exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bookings'
    AND constraint_name = 'payment_status_check'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT payment_status_check
    CHECK (payment_status IN ('pending', 'verified', 'rejected'));
  END IF;
END
$$;
