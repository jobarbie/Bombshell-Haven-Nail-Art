-- RLS Policies for customer bookings

-- Drop existing policies for bookings if they exist
DROP POLICY IF EXISTS "Anyone can create booking" ON public.bookings;
DROP POLICY IF EXISTS "Nail tech can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Nail tech can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can insert own bookings" ON public.bookings;

-- Policy: Anyone can create a booking (insert without customer_id constraint for now)
-- This allows unauthenticated OR authenticated users to create bookings
-- The customer_id will be set by the app
CREATE POLICY "Anyone can create booking" ON public.bookings
  FOR INSERT
  WITH CHECK (true);

-- Policy: Nail tech can view bookings for their profile
CREATE POLICY "Nail tech can view own bookings" ON public.bookings
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Policy: Nail tech can update bookings for their profile
CREATE POLICY "Nail tech can update own bookings" ON public.bookings
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Policy: Customers can view their own bookings
CREATE POLICY "Customers can view own bookings" ON public.bookings
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Policy: Customers can only insert bookings with their own ID
CREATE POLICY "Customers can insert own bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (auth.uid() = customer_id OR customer_id IS NULL);
