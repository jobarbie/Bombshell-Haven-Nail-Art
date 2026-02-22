# Bombshell Haven

A nail-booking system for nail techs to showcase their work and manage appointments.

## Tech Stack

- **Vite** + **React (JSX)**
- **Supabase** (Auth + Database)

## Features

### Customer view (public)
- Landing page with logo, nail gallery, and nail tech info
- Book an appointment: see only available dates & times
- Submit booking request (pending until nail tech approves)

### Nail tech view (dashboard)
- Sign up / Sign in
- Dashboard with pending, approved, and declined appointments
- Approve or decline booking requests
- Block off unavailable times (prevents double bookings)

## Setup

### Quick start

```bash
npm install
npm run dev
```

For the **booking system** to work, you must set up Supabase. See **[SETUP.md](SETUP.md)** for step-by-step instructions.

### Summary

1. Create a [Supabase](https://supabase.com) project
2. Run `supabase/schema.sql` in the SQL Editor
3. Copy Project URL and anon key from Project Settings → API
4. Create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Sign up as the nail tech (footer → Nail Tech Login)
6. Customers can then book appointments

## Routes

| Route | View |
|-------|------|
| `/` | Customer home (gallery, about, book CTA) |
| `/book` | Customer booking form |
| `/nailtech/login` | Nail tech login |
| `/nailtech/signup` | Nail tech sign up |
| `/nailtech/dashboard` | Nail tech dashboard (appointments, block times) |

## Flow

1. **Customer** opens site → sees available dates/times → submits booking
2. **Nail tech** logs in → sees pending requests → approves or declines
3. **If approved** → appointment is added to the nail tech’s list
4. **Nail tech** can block times → those slots are not shown to customers

## Notes

- The nail tech must sign up first so their profile exists
- Bookings use the first profile in the database (single nail tech setup)
- You can add nail samples via Supabase dashboard or extend the dashboard to manage them
