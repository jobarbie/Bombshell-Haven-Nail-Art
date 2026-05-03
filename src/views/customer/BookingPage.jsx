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
  const [bookingFilter, setBookingFilter] = useState('pending')
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

  const getRefundProof = (booking) => booking['refund_proof_url'] || null

  const statusColor = (status) => {
    if (status === 'approved') return '#10b981'
    if (status === 'declined') return '#ef4444'
    return '#f59e0b'
  }

  const pendingBookings = myBookings.filter((b) => b.status === 'pending')
  const approvedMyBookings = myBookings.filter((b) => b.status === 'approved')
  const declinedBookings = myBookings.filter((b) => b.status === 'declined')

  const filteredBookings = bookingFilter === 'pending'
    ? pendingBookings
    : bookingFilter === 'approved'
    ? approvedMyBookings
    : declinedBookings

  const refundUrl = (booking) => {
    const url = getRefundProof(booking)
    return url
  }

  if (!profileId && !loading) {
    return (
      <section className="booking-page">
        <div className="booking-unavailable">
          <h2>Booking coming soon</h2>
          <p>We are getting things ready. Please check back soon.</p>
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

      {user && (
        <div style={{ marginTop: '3rem' }}>
          <hr style={{ opacity: 0.2, marginBottom: '2rem' }} />
          <h2>My Bookings</h2>

          {bookingsLoading ? (
            <p>Loading your bookings...</p>
          ) : myBookings.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>You have no bookings yet.</p>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0 1.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setBookingFilter('pending')}
                  style={{
                    backgroundColor: bookingFilter === 'pending' ? '#f59e0b' : 'transparent',
                    color: bookingFilter === 'pending' ? '#000' : '#333',
                    fontWeight: bookingFilter === 'pending' ? 'bold' : 'normal',
                    border: '1px solid #e5e7eb',
                    padding: '0.4rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Pending ({pendingBookings.length})
                </button>
                <button
                  onClick={() => setBookingFilter('approved')}
                  style={{
                    backgroundColor: bookingFilter === 'approved' ? '#10b981' : 'transparent',
                    color: bookingFilter === 'approved' ? '#fff' : '#333',
                    fontWeight: bookingFilter === 'approved' ? 'bold' : 'normal',
                    border: '1px solid #e5e7eb',
                    padding: '0.4rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Approved ({approvedMyBookings.length})
                </button>
                <button
                  onClick={() => setBookingFilter('declined')}
                  style={{
                    backgroundColor: bookingFilter === 'declined' ? '#ef4444' : 'transparent',
                    color: bookingFilter === 'declined' ? '#fff' : '#333',
                    fontWeight: bookingFilter === 'declined' ? 'bold' : 'normal',
                    border: '1px solid #e5e7eb',
                    padding: '0.4rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Declined ({declinedBookings.length})
                </button>
              </div>

              {filteredBookings.length === 0 ? (
                <p style={{ color: '#9ca3af' }}>No {bookingFilter} bookings.</p>
              ) : (
                <div className="booking-list">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className={'booking-card ' + booking.status}>
                      <div className="booking-info">
                        <div className="booking-header">
                          <strong className="customer-name">{booking.customer_name}</strong>
                          <span style={{ color: statusColor(booking.status), fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem' }}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="booking-details">
                          <div className="detail-item">
                            <span className="detail-label">Date and Time:</span>
                            <span>
                              {new Date(booking.start_time).toLocaleString([], {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {booking.customer_phone && (
                            <div className="detail-item">
                              <span className="detail-label">Phone:</span>
                              <span>{booking.customer_phone}</span>
                            </div>
                          )}
                          {booking.service_type && (
                            <div className="detail-item">
                              <span className="detail-label">Service:</span>
                              <span>{booking.service_type}</span>
                            </div>
                          )}
                          {booking.notes && (
                            <div className="detail-item">
                              <span className="detail-label">Notes:</span>
                              <span>{booking.notes}</span>
                            </div>
                          )}
                          {booking.status === 'approved' && (
                            <div className="detail-item">
                              <span className="detail-label">Rating:</span>
                              <span>
                                {booking.rating ? (
                                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                    {'★'.repeat(booking.rating)}{'☆'.repeat(5 - booking.rating)}
                                  </span>
                                ) : new Date(booking.start_time) < new Date() ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
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
                                          color: '#d1d5db',
                                          cursor: 'pointer',
                                          fontSize: '1rem',
                                        }}
                                      >
                                        ★
                                      </button>
                                    ))}
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Rate this service</span>
                                  </span>
                                ) : (
                                  <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Rate after service</span>
                                )}
                              </span>
                              {ratingErrors[booking.id] && (
                                <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>
                                  {ratingErrors[booking.id]}
                                </span>
                              )}
                            </div>
                          )}
                          {booking.status === 'declined' && (
                            <div className="detail-item">
                              <span className="detail-label">Refund Proof:</span>
                              <span>
                                {refundUrl(booking) ? (
                                  <a href={refundUrl(booking)} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.85rem', fontWeight: 500 }}>
                                    View Refund Screenshot
                                  </a>
                                ) : (
                                  <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No refund proof yet</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
