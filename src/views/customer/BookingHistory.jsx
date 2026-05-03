import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="250" height="150" viewBox="0 0 250 150"%3E%3Crect width="250" height="150" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="14"%3ENo image available%3C/text%3E%3C/svg%3E'

export default function BookingHistory() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [imgErrors, setImgErrors] = useState({})
  const [ratingValues, setRatingValues] = useState({})
  const [ratingComments, setRatingComments] = useState({})
  const [ratingSubmitting, setRatingSubmitting] = useState({})
  const [ratingErrors, setRatingErrors] = useState({})
  const [filterView, setFilterView] = useState('approved')
  const { user } = useAuth()

  const fetchBookings = async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      // Use '*' so the query never crashes if payment columns haven't
      // been migrated yet. Missing props are handled safely below.
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', user.id)
        .order('start_time', { ascending: false })

      if (error) {
        console.error('Error fetching bookings:', error)
        setBookings([])
      } else {
        setBookings(data || [])
      }
    } catch (err) {
      console.error('Unexpected error fetching bookings:', err)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    fetchBookings()
  }, [user?.id])

  const handleRatingChange = (bookingId, value) => {
    setRatingValues((prev) => ({
      ...prev,
      [bookingId]: value,
    }))
    setRatingErrors((prev) => ({
      ...prev,
      [bookingId]: '',
    }))
  }

  const handleRatingCommentChange = (bookingId, comment) => {
    setRatingComments((prev) => ({
      ...prev,
      [bookingId]: comment,
    }))
  }

  const handleSubmitRating = async (booking) => {
    const rating = ratingValues[booking.id] || booking.rating
    if (!rating) {
      setRatingErrors((prev) => ({
        ...prev,
        [booking.id]: 'Please choose a rating before submitting.',
      }))
      return
    }

    setRatingSubmitting((prev) => ({
      ...prev,
      [booking.id]: true,
    }))
    setRatingErrors((prev) => ({
      ...prev,
      [booking.id]: '',
    }))

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          rating,
          rating_comment: ratingComments[booking.id] || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      if (error) {
        console.error('Error saving rating:', error)
        setRatingErrors((prev) => ({
          ...prev,
          [booking.id]: error.message,
        }))
        return
      }

      await fetchBookings()
    } catch (err) {
      console.error('Unexpected error saving rating:', err)
      setRatingErrors((prev) => ({
        ...prev,
        [booking.id]: 'Failed to save rating. Please try again.',
      }))
    } finally {
      setRatingSubmitting((prev) => ({
        ...prev,
        [booking.id]: false,
      }))
    }
  }

  const toggleProof = (booking) => {
    if (expandedId === booking.id) {
      setExpandedId(null)
      return
    }

    setExpandedId(booking.id)

    const proofUrl = booking.payment_proof_url
    if (!proofUrl) return

    // Bucket is PUBLIC — store the public URL directly for display
    if (proofUrl.startsWith('http')) {
      setSignedUrls((prev) => ({ ...prev, [booking.id]: proofUrl }))
    }
  }

  const handleImgError = (bookingId) => {
    setImgErrors((prev) => ({ ...prev, [bookingId]: true }))
  }

  if (loading) return <p>Loading bookings...</p>
  if (!bookings.length) return <p>No bookings yet.</p>

  const approvedBookings = bookings.filter((b) => b.status === 'approved')
  const pendingBookings = bookings.filter((b) => b.status === 'pending')
  const declinedBookings = bookings.filter((b) => b.status === 'declined')

  const getFilteredBookings = () => {
    if (filterView === 'approved') return approvedBookings
    if (filterView === 'pending') return pendingBookings
    if (filterView === 'declined') return declinedBookings
    return []
  }

  const filteredBookings = getFilteredBookings()

  const BookingCard = ({ booking }) => (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '1.5rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '1.1rem' }}>
            {new Date(booking.start_time).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </strong>
          <span
            style={{
              textTransform: 'capitalize',
              fontWeight: 'bold',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.9rem',
              backgroundColor:
                booking.status === 'approved'
                  ? '#d1fae5'
                  : booking.status === 'pending'
                  ? '#fef3c7'
                  : '#fee2e2',
              color:
                booking.status === 'approved'
                  ? '#065f46'
                  : booking.status === 'pending'
                  ? '#92400e'
                  : '#991b1b',
            }}
          >
            {booking.status}
          </span>
        </div>
        <p style={{ margin: '0.5rem 0', color: '#6b7280', fontSize: '0.95rem' }}>
          {new Date(booking.start_time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: '0.95rem' }}>
        {booking.service_type && (
          <div>
            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Service</span>
            <span style={{ fontWeight: '500' }}>{booking.service_type}</span>
          </div>
        )}
      </div>

      {booking.notes && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Notes</span>
          <p style={{ margin: '0', fontSize: '0.95rem' }}>{booking.notes}</p>
        </div>
      )}

      {/* Payment Proof */}
      {booking.payment_proof_url && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => toggleProof(booking)}
            style={{
              fontSize: '0.85rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            {expandedId === booking.id ? '🙈 Hide Proof' : '🖼️ View Proof'}
          </button>
          {expandedId === booking.id && signedUrls[booking.id] && (
            <div style={{ marginTop: '0.75rem' }}>
              {imgErrors[booking.id] ? (
                <img
                  src={PLACEHOLDER_IMAGE}
                  alt="Payment proof unavailable"
                  style={{ maxWidth: '250px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
              ) : (
                <img
                  src={signedUrls[booking.id]}
                  alt="Payment proof"
                  style={{ maxWidth: '250px', borderRadius: '8px', border: '1px solid #ccc' }}
                  onError={() => handleImgError(booking.id)}
                  loading="lazy"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Rating Section */}
      {booking.rating ? (
        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Rating</span>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {'⭐'.repeat(booking.rating)}
            <span style={{ color: '#374151', fontSize: '0.85rem', marginLeft: '0.5rem' }}>({booking.rating}/5)</span>
          </div>
          {booking.rating_comment && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#374151', fontStyle: 'italic' }}>
              "{booking.rating_comment}"
            </p>
          )}
        </div>
      ) : new Date(booking.start_time) < new Date() && ['approved', 'declined'].includes(booking.status) ? (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#374151' }}>Leave a rating:</p>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleRatingChange(booking.id, value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  color: (ratingValues[booking.id] || 0) >= value ? '#f59e0b' : '#d1d5db',
                }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            placeholder="Leave a comment (optional)"
            value={ratingComments[booking.id] || ''}
            onChange={(e) => handleRatingCommentChange(booking.id, e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.85rem',
              width: '100%',
              marginBottom: '0.5rem',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            onClick={() => handleSubmitRating(booking)}
            disabled={ratingSubmitting[booking.id] || !ratingValues[booking.id]}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              background: '#3b82f6',
              color: '#fff',
              cursor: ratingSubmitting[booking.id] || !ratingValues[booking.id] ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              opacity: ratingSubmitting[booking.id] || !ratingValues[booking.id] ? 0.6 : 1,
            }}
          >
            {ratingSubmitting[booking.id] ? 'Submitting...' : 'Submit Rating'}
          </button>
          {ratingErrors[booking.id] && (
            <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {ratingErrors[booking.id]}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>My Bookings</h2>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterView('approved')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            background: filterView === 'approved' ? '#10b981' : '#fff',
            color: filterView === 'approved' ? '#fff' : '#374151',
            cursor: 'pointer',
            fontWeight: filterView === 'approved' ? 'bold' : 'normal',
            fontSize: '0.95rem',
          }}
        >
          Approved ({approvedBookings.length})
        </button>
        <button
          onClick={() => setFilterView('pending')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            background: filterView === 'pending' ? '#f59e0b' : '#fff',
            color: filterView === 'pending' ? '#fff' : '#374151',
            cursor: 'pointer',
            fontWeight: filterView === 'pending' ? 'bold' : 'normal',
            fontSize: '0.95rem',
          }}
        >
          Pending ({pendingBookings.length})
        </button>
        <button
          onClick={() => setFilterView('declined')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            background: filterView === 'declined' ? '#ef4444' : '#fff',
            color: filterView === 'declined' ? '#fff' : '#374151',
            cursor: 'pointer',
            fontWeight: filterView === 'declined' ? 'bold' : 'normal',
            fontSize: '0.95rem',
          }}
        >
          Declined ({declinedBookings.length})
        </button>
      </div>

      {/* Bookings List */}
      <div>
        {filteredBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            <p>No {filterView} bookings yet.</p>
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))
        )}
      </div>
    </div>
  )
}

