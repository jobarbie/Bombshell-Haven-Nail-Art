-- Fix payment-proofs bucket and RLS policies
-- This migration ensures the bucket exists and allows both authenticated and anonymous uploads

-- ============================================================
-- Create the payment-proofs storage bucket (idempotent)
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
-- Drop old restrictive policies
-- ============================================================
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own payment proofs" ON storage.objects;

-- ============================================================
-- New policies: Allow both authenticated AND anonymous uploads
-- ============================================================

-- Policy: Anyone (authenticated or anonymous) can upload to payment-proofs
CREATE POLICY "Anyone can upload payment proofs" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'payment-proofs');

-- Policy: Anyone can read payment proofs (bucket is public)
CREATE POLICY "Anyone can view payment proofs" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'payment-proofs');

-- Policy: Owners can update their own files
CREATE POLICY "Owners can update payment proofs" ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'payment-proofs' AND owner = auth.uid());

-- Policy: Owners can delete their own files
CREATE POLICY "Owners can delete payment proofs" ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'payment-proofs' AND owner = auth.uid());
