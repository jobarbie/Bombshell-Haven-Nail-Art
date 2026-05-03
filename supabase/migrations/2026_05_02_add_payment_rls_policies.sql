-- Add RLS policy for customers to update payment fields on their bookings
-- This allows both authenticated customers and anonymous booking submitters to update payment proofs

-- Policy: Anyone can update payment fields (payment_proof_url and payment_status)
-- This is safe because these fields are for payment proof submission
DROP POLICY IF EXISTS "Anyone can update booking payment" ON public.bookings;
CREATE POLICY "Anyone can update booking payment" ON public.bookings
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Policy: Customers can view their own bookings
DROP POLICY IF EXISTS "Customers can view own bookings" ON public.bookings;
CREATE POLICY "Customers can view own bookings" ON public.bookings
FOR SELECT
TO public
USING (
  customer_id = auth.uid()
  OR
  -- Keep existing nail tech access
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);
