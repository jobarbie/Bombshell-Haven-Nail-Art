import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import BookingForm from './BookingForm'

const SLOT_DURATION_MINUTES = 60
const FIXED_SLOTS = [10, 13, 16]

export default function BookingPage() {
  const [availableSlots, setAvailableSlots] = useState([])
  const [blockedTimes, setBlockedTimes] = useState([])
  const [approvedBookings, setApprovedBookings] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileId, setProfileId] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [myBookings, setMyBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [ratingSubmitting, setRatingSubmitting] = useState({})
  const [ratingErrors, setRatingErrors] = useState({})

  const { user } = useAuth()
  const navigate = useNavigate()

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

  async function loadMyBookings() {
    if (!user?.id) return
    setBookingsLoading(true)
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('start_time', { ascending: false })
    if (!error) setMyBookings(data || [])
    setBookingsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadMyBookings()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || profileId) return

    async function ensureProfile() {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (existing) {
        setProfileId(user.id)
        return
      }
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

    const [y, m, d] = selectedDate.split('-').map(Number)
    const baseDate = new Date(y, m - 1, d)
    const slots = []

    for (const hour of FIXED_SLOTS) {
      const start = new Date(baseDate)
      start.setHours(hour, 0, 0, 0)
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
      const bookingPayload = {
        profile_id: profileId,
        customer_name: formData.name,
        customer_phone: formData.phone || null,
        service_type: formData.service || null,
        notes: formData.notes || null,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: 'pending',
        customer_id: user?.id || null,
        payment_status: 'pending',
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingPayload)
        .select()

      if (error) {
        let errorMsg = error.message || 'Booking failed. Please try again.'
        if (error.code === '42501' || error.message?.includes('policy')) {
          errorMsg = 'Permission denied. Please run the SQL fix in Supabase SQL Editor.'
        } else if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          errorMsg = 'Authentication error. Please check your Supabase configuration.'
        }
        setSubmitError(errorMsg)
        return
      }

      const bookingId = data?.[0]?.id
      if (bookingId) {
        navigate('/payment', { state: { bookingId } })
      } else {
        setSubmitError('Booking created but could not redirect to payment.')
      }
    } catch (err) {
      setSubmitError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const statusColor = (status) => {
    if (status === 'approved') return '#10b981'
    if (status === 'declined') return '#ef4444'
    return '#f59e0b'
  }

  const statusIcon = (status) => {
    if (status === 'approved') return ''
    if (status === 'declined') return ''
    return ''
  }

  const handleRating = async (bookingId, ratingValue) => {
    setRatingSubmitting((prev) => ({ ...prev, [bookingId]: true }))
    setRatingErrors((prev) => ({ ...prev, [bookingId]: '' }))

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ rating: ratingValue, updated_at: new Date().toISOString() })
        .eq('id', bookingId)

      if (error) {
        setRatingErrors((prev) => ({ ...prev, [bookingId]: error.message || 'Failed to save rating.' }))
      } else {
        await loadMyBookings()
      }
    } catch (err) {
      setRatingErrors((prev) => ({ ...prev, [bookingId]: 'Failed to save rating.' }))
    } finally {
      setRatingSubmitting((prev) => ({ ...prev, [bookingId]: false }))
    }
  }

  const getRefundProof = (booking) => {
    return booking['refund_proof_url'] || null
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

      {/* ✅ Booking History */}
      {user && (
        <div style={{ marginTop: '3rem' }}>
          <hr style={{ opacity: 0.2, marginBottom: '2rem' }} />
          <h2>My Bookings</h2>

          {bookingsLoading ? (
            <p>Loading your bookings...</p>
          ) : myBookings.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>You have no bookings yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>Date & Time</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>Service</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>Rating</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>Refund Proof</th>
                </tr>
              </thead>
              <tbody>
                {myBookings.map((booking) => (
                  <tr key={booking.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>
                      {new Date(booking.start_time).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>
                      {booking.customer_name}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>
                      {booking.service_type || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>
                      <span style={{
                        color: statusColor(booking.status),
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}>
                        {statusIcon(booking.status)} {booking.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>
                      {booking.rating ? (
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                          {'★'.repeat(booking.rating)}
                        </span>
                      ) : booking.status === 'approved' && new Date(booking.start_time) < new Date() ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleRating(booking.id, value)}
                              disabled={ratingSubmitting[booking.id]}
                              style={{
                                padding: '0.1rem 0.35rem',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                background: ratingSubmitting[booking.id] ? '#f3f4f6' : '#fff',
                                color: value <= (booking.rating || 0) ? '#f59e0b' : '#d1d5db',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                lineHeight: 1,
                              }}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                          {booking.status === 'approved' ? 'Rate after service' : 'Rating only available for approved bookings'}
                        </span>
                      )}
                      {ratingErrors[booking.id] && (
                        <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {ratingErrors[booking.id]}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.9rem' }}>
                      {booking.status === 'declined' && getRefundProof(booking) ? (
                        <a
                          href={getRefundProof(booking)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#6366f1', fontSize: '0.85rem', fontWeight: 500 }}
                        >
                          View Refund
                        </a>
                      ) : booking.status === 'declined' ? (
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                          No refund proof yet
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}