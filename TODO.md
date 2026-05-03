# Fix Booking System - Progress Tracker

## Tasks
- [ ] 1. Fix BookingPage.jsx - hardcode time slots, remove email, add customer_id, navigate to payment
- [ ] 2. Fix BookingForm.jsx - remove email field completely
- [ ] 3. Fix PaymentPage.jsx - fix update query, remove customer_id check, handle anonymous bookings
- [ ] 4. Fix NailTechDashboard.jsx - remove email display, add payment_proof_url image
- [ ] 5. Fix schema.sql - sync with migrations (remove customer_email not null, add customer_id, payment_proof_url, payment_status)
- [ ] 6. Fix migration 2026_05_01_add_payment_proof_to_bookings.sql - add drop customer_email, ensure customer_id column, fix RLS policies
- [ ] 7. Fix migration 2026_05_01_setup_payment_proofs_storage.sql - ensure correct bucket & policies
- [ ] 8. Test all flows end-to-end

## Payment Page Layout Fix
- [x] Add centered payment page styles to `src/App.css`

