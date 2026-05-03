-- Add payment proof columns to bookings table
-- Run this in your Supabase SQL Editor

-- Add payment_proof_url column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_proof_url text;

-- Add payment_status column with check constraint
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_status text default 'pending';

-- Add check constraint for payment_status values
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_payment_status_check
CHECK (payment_status IN ('pending', 'verified', 'rejected'));

-- Update existing bookings to have payment_status = 'pending' if null
UPDATE public.bookings
SET payment_status = 'pending'
WHERE payment_status IS NULL;

-- ============================================================
-- RLS Policies for bookings (payment-related)
-- ============================================================

-- Drop existing payment-related policies if they exist
DROP POLICY IF EXISTS "Customers can update own payment proof" ON public.bookings;
DROP POLICY IF EXISTS "Customers can view own bookings" ON public.bookings;

-- Policy: Customers can view their own bookings
CREATE POLICY "Customers can view own bookings" ON public.bookings
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Policy: Customers can update payment_proof_url and payment_status on their own bookings
-- This allows them to upload payment proof after booking
CREATE POLICY "Customers can update own payment proof" ON public.bookings
  FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Policy: Nail tech can update payment_status on their profile's bookings
-- (for approving/declining payments)
DROP POLICY IF EXISTS "Nail tech can update payment status" ON public.bookings;
CREATE POLICY "Nail tech can update payment status" ON public.bookings
  FOR UPDATE
  USING (auth.uid() = profile_id OR profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1))
  WITH CHECK (auth.uid() = profile_id OR profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1));

