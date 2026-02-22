# Bombshell Haven — Booking System Setup

Follow these steps to get the booking system working.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Enter a name (e.g. `bombshell-haven`), set a database password
4. Choose a region close to you
5. Wait for the project to finish provisioning

## 2. Run the Database Schema

1. In your Supabase project, open **SQL Editor**
2. Copy the entire contents of `supabase/schema.sql`
3. Paste into the SQL Editor and click **Run**
4. You should see success messages (or no errors)

## 3. Get Your API Keys

1. Go to **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## 4. Create `.env` File

In your project folder (`Bomb`), create a file named `.env`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with your actual Project URL and anon key.

## 5. Enable Email Auth (for nail tech sign-in)

1. In Supabase: **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. (Optional) Under **Email**, turn off "Confirm email" if you want immediate sign-in without email verification during development

## 6. Create the Nail Tech Account

1. Restart your dev server (`npm run dev`) so it picks up the `.env`
2. Open the site and click **Nail Tech Login** (footer link)
3. Click **Sign up** and create an account with email + password
4. If email confirmation is on: check your email and confirm
5. Sign in to the dashboard

Once the nail tech has signed up, their profile is created automatically. Customers can then use the booking page.

## 7. Test the Flow

1. Open the main site (customer view)
2. Go to **Book Now**
3. Pick a date and time slot
4. Fill in your details and submit
5. Sign in as the nail tech and go to the dashboard
6. You should see the pending request under **Pending Requests**
7. Click **Approve** — the appointment moves to **Approved Appointments**

## Troubleshooting

- **"Booking not available yet"** → Supabase not configured or nail tech hasn’t signed up
- **"Supabase needs to be configured"** → Add a `.env` file with the correct keys
- **"The nail tech needs to sign up first"** → Create an account via Nail Tech Login
- **Booking insert fails** → Check the schema was run and RLS policies allow inserts
- **No available slots** → Try another date; past times and blocked/approved slots are hidden
