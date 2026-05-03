-- Add customer_id column to bookings table
-- This allows tracking which customer made each booking

ALTER TABLE public.bookings 
ADD COLUMN customer_id uuid;

-- Add foreign key reference to auth.users
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups by customer
CREATE INDEX idx_bookings_customer ON public.bookings(customer_id);
