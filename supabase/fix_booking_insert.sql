-- ============================================
-- FINAL FIX FOR BOOKING INSERT PERMISSIONS
-- ============================================
-- Copy and paste ALL of this into Supabase SQL Editor
-- Then click RUN (or press Ctrl+Enter)
-- ============================================

-- Step 1: Drop ALL existing policies on bookings table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'bookings') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.bookings';
    END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Step 3: Grant permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.bookings TO anon;
GRANT INSERT, SELECT, UPDATE ON public.bookings TO authenticated;

-- Step 4: Create insert policy for anonymous users (customers booking)
CREATE POLICY "anon_insert_bookings" ON public.bookings
FOR INSERT
TO anon
WITH CHECK (true);

-- Step 5: Create insert policy for authenticated users
CREATE POLICY "authenticated_insert_bookings" ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 6: Create select policy (for dashboard - viewing bookings)
CREATE POLICY "view_bookings" ON public.bookings
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- Step 7: Create update policy (for approving/declining bookings)
CREATE POLICY "update_bookings" ON public.bookings
FOR UPDATE
TO authenticated
USING (
  profile_id = auth.uid()
  OR
  profile_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
);

-- Step 8: Verify policies were created
SELECT 
  policyname as "Policy Name",
  roles as "Roles",
  cmd as "Command"
FROM pg_policies 
WHERE tablename = 'bookings'
ORDER BY cmd, policyname;

-- ============================================
-- If you see 4 policies above, you're done!
-- ============================================
