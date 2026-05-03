-- Supabase Storage setup for payment-proofs bucket
-- Run this in your Supabase SQL Editor

-- ============================================================
-- Create the payment-proofs storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,                               -- PUBLIC bucket: images accessible via public URL
  false,
  5242880,                            -- 5MB file size limit
  array['image/jpeg', 'image/png']    -- Only allow image files
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png'];

-- ============================================================
-- Storage RLS Policies for payment-proofs bucket
-- ============================================================

-- Policy: Authenticated users can upload files to their own folder
-- Path format: payment-proofs/{user_id}/filename
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON storage.objects;
CREATE POLICY "Users can upload own payment proofs" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Authenticated users can read their own uploaded files
DROP POLICY IF EXISTS "Users can view own payment proofs" ON storage.objects;
CREATE POLICY "Users can view own payment proofs" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can update their own files
DROP POLICY IF EXISTS "Users can update own payment proofs" ON storage.objects;
CREATE POLICY "Users can update own payment proofs" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own files
DROP POLICY IF EXISTS "Users can delete own payment proofs" ON storage.objects;
CREATE POLICY "Users can delete own payment proofs" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Nail tech / admin can view ALL payment proofs
-- Uses the same logic as bookings: user is the profile owner or first profile
DROP POLICY IF EXISTS "Admins can view all payment proofs" ON storage.objects;
CREATE POLICY "Admins can view all payment proofs" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
      )
    )
  );

-- Note: To allow the admin dashboard to generate signed URLs for all files,
-- the admin user must have SELECT access. The above policy grants all authenticated
-- users with a profile (i.e., nail techs/admins) access to view all payment proofs.
-- For stricter security, replace the EXISTS clause with a specific role check.

