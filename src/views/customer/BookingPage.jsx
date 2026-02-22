import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import BookingForm from './BookingForm'

const SLOT_DURATION_MINUTES = 60
const OPEN_HOUR = 9
const CLOSE_HOUR = 18

export default function BookingPage() {
  const [availableSlots, setAvailableSlots] = useState([])
  const [blockedTimes, setBlockedTimes] = useState([])
  const [approvedBookings, setApprovedBookings] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [profileId, setProfileId] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { user } = useAuth()

  async function loadData() {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .maybeSingle()

        if (profileError) {
          setProfileId(null)
          setLoading(false)
          return
        }

        const pid = profile?.id
        setProfileId(pid)
        if (!pid) {
          setLoading(false)
          return
        }

        const [blockedRes, bookedRes] = await Promise.all([
          supabase.from('blocked_times').select('start_time, end_time').eq('profile_id', pid),
          supabase.rpc('get_booked_times', { p_profile_id: pid }),
        ])

        setBlockedTimes(blockedRes.error ? [] : (blockedRes.data || []))
        setApprovedBookings(bookedRes.error ? [] : (bookedRes.data || []))
      } catch {
        setProfileId(null)
      }
      setLoading(false)
    }

  useEffect(() => {
    loadData()
  }, [])

  // When nail tech is logged in but no profile from DB: ensure profile exists, then use their id
  useEffect(() => {
    if (!user?.id || profileId) return

    async function ensureProfile() {
      const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
      if (existing) {
        setProfileId(user.id)
        return
      }
      // Create profile if missing (trigger may have failed or user signed up before schema)
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.user_metadata?.name,
      })
      if (!error) setProfileId(user.id)
    }
    ensureProfile()
  }, [user?.id, profileId])

  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([])
      return
    }

    // Parse as local date to avoid timezone issues
    const [y, m, d] = selectedDate.split('-').map(Number)
    const baseDate = new Date(y, m - 1, d)
    const slots = []

    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_DURATION_MINUTES) {
        const start = new Date(baseDate)
        start.setHours(h, m, 0, 0)
        const end = new Date(start)
        end.setMinutes(end.getMinutes() + SLOT_DURATION_MINUTES)

        if (start < new Date()) continue

        const isBlocked = blockedTimes.some((b) => {
          const bs = new Date(b.start_time)
          const be = new Date(b.end_time)
          return start < be && end > bs
        })

        const isBooked = approvedBookings.some((b) => {
          const bs = new Date(b.start_time)
          const be = new Date(b.end_time)
          return start < be && end > bs
        })

        if (!isBlocked && !isBooked) {
          slots.push({
            start: start.toISOString(),
            end: end.toISOString(),
            label: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })
        }
      }
    }

    setAvailableSlots(slots)
  }, [selectedDate, blockedTimes, approvedBookings])

  const minDate = new Date().toISOString().slice(0, 10)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 60)
  const maxDateStr = maxDate.toISOString().slice(0, 10)

  const handleSubmit = async (formData) => {
    setSubmitError('')
    if (!profileId) {
      setSubmitError('No nail tech profile found. Please try again later.')
      return
    }

    setSubmitting(true)
    try {
      console.log('=== CREATING BOOKING ===')
      console.log('Profile ID being used:', profileId)
      console.log('Booking data:', {
        profile_id: profileId,
        customer_name: formData.name,
        customer_email: formData.email,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: 'pending',
      })
      
      // Check if Supabase is configured
      const { data: configCheck } = await supabase.from('profiles').select('id').limit(1)
      console.log('Supabase connection check:', configCheck ? 'OK' : 'FAILED')
      
      const { data, error } = await supabase.from('bookings').insert({
        profile_id: profileId,
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone || null,
        service_type: formData.service || null,
        notes: formData.notes || null,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: 'pending',
      }).select()

      console.log('Insert result:', data)
      console.log('Insert error:', error)
      if (error) {
        console.error('Full error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
      }
      console.log('=== END CREATING BOOKING ===')

      if (error) {
        // More detailed error message
        let errorMsg = error.message || 'Booking failed. Please try again.'
        if (error.code === '42501' || error.message?.includes('policy')) {
          errorMsg = 'Permission denied. Please run the SQL fix: supabase/fix_booking_insert_final.sql in Supabase SQL Editor.'
        } else if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          errorMsg = 'Authentication error. Please check your Supabase configuration (.env file).'
        }
        setSubmitError(errorMsg)
        return
      }
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="booking-page">
        <div className="booking-success">
          <h2>Request Received</h2>
          <p>Your booking request has been submitted. The nail tech will review and confirm shortly.</p>
          <p>You'll receive an email once it's approved or declined.</p>
        </div>
      </section>
    )
  }

  if (!profileId && !loading) {
    return (
      <section className="booking-page">
        <div className="booking-unavailable">
          <h2>Booking coming soon</h2>
          <p>We're getting things ready. Please check back soon.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="booking-page">
      <h1>Book an Appointment</h1>
      <p className="booking-intro">Select an available date and time below.</p>

      <div className="booking-steps">
        <div className="step">
          <label>Choose a date</label>
          <input
            type="date"
            min={minDate}
            max={maxDateStr}
            value={selectedDate || ''}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {selectedDate && (
          <div className="step">
            <label>Available times</label>
            {loading ? (
              <p>Loading...</p>
            ) : availableSlots.length === 0 ? (
              <p>No available slots on this date. Try another.</p>
            ) : (
              <BookingForm
                slots={availableSlots}
                onSubmit={handleSubmit}
                error={submitError}
                submitting={submitting}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
