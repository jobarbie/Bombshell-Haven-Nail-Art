# Apply Database Schema in Supabase

## 1. Open Supabase SQL Editor

1. Go to [supabase.com](https://supabase.com) and sign in
2. Open your project (the one whose URL is in your `.env`)
3. In the left sidebar, click **SQL Editor**

## 2. Run the Schema

1. Click **New query**
2. Open the file `supabase/schema.sql` in your project folder
3. Copy **all** of its contents (Ctrl+A, Ctrl+C)
4. Paste into the Supabase SQL Editor
5. Click **Run** (or press Ctrl+Enter)

> If you see `Could not find the 'payment_proof_url' column of 'bookings' in the schema cache`, open `supabase/migrations/2026_05_03_fix_payment_proof_schema.sql`, paste it into the SQL Editor, and run it.

> If you see `Could not find the 'refund_proof_url' column of 'bookings' in the schema cache`, open `supabase/migrations/2026_05_04_add_refund_proof_to_bookings.sql`, paste it into the SQL Editor, and run it.

> If you see `Could not find the 'rating' column of 'bookings' in the schema cache`, open `supabase/migrations/2026_05_05_add_rating_to_bookings.sql`, paste it into the SQL Editor, and run it.

## 3. Confirm Success

You should see "Success. No rows returned" or similar. No errors.

To verify tables exist:
- Go to **Table Editor** in the left sidebar
- You should see: `profiles`, `nail_samples`, `blocked_times`, `bookings`

## 4. Create the Nail Tech Profile

Before customers can book, a nail tech must sign up:

1. Open your site (e.g. `http://localhost:5173`)
2. Go to `http://localhost:5173/nailtech/signup` (type in the address bar)
3. Create an account with email + password
4. This auto-creates a profile in the `profiles` table
5. Now the booking page will work
