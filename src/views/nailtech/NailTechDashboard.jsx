import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import BlockTimeForm from './BlockTimeForm'

export default function NailTechDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const subscriptionRef = useRef(null)

  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setError('No user ID found')
      setLoading(false)
      return
    }

    try {
      setError(null)
      
      // First, verify the user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error checking profile:', profileError)
        setError(`Profile check failed: ${profileError.message}`)
        setBookings([])
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (!profile) {
        console.warn('No profile found for user:', user.id)
        setError('Profile not found. Please ensure you have signed up as a nail tech.')
        setBookings([])
        setLoading(false)
        setRefreshing(false)
        return
      }

      // Debug: Check what profiles exist and which is first
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, email, display_name, created_at')
        .order('created_at', { ascending: true })
      
      console.log('=== DEBUGGING BOOKING VISIBILITY ===')
      console.log('Logged-in user ID:', user.id)
      console.log('Logged-in user email:', user.email)
      console.log('All profiles in database:', allProfiles)
      
      if (allProfiles && allProfiles.length > 0) {
        const firstProfileId = allProfiles[0].id
        console.log('First profile ID (used for bookings):', firstProfileId)
        console.log('Is user the first profile?', user.id === firstProfileId)
        
        // Check if there are any bookings at all
        const { data: allBookingsCheck, error: checkError } = await supabase
          .from('bookings')
          .select('id, profile_id, customer_name, status, created_at')
          .limit(10)
        
        console.log('All bookings in database (raw check):', allBookingsCheck)
        console.log('Check error:', checkError)
        
        // Check bookings for first profile specifically
        const { data: firstProfileBookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('profile_id', firstProfileId)
          .order('start_time', { ascending: true })
        
        console.log(`Bookings for first profile (${firstProfileId}):`, firstProfileBookings)
      }

      // Query all bookings - RLS policy will filter to show:
      // 1. Bookings for user's own profile_id, OR
      // 2. Bookings for the first profile (after running fix_booking_policy.sql)
      const { data, error: queryError } = await supabase
        .from('bookings')
        .select('*')
        .order('start_time', { ascending: true })

      console.log('Query result:', data)
      console.log('Query error:', queryError)

      if (queryError) {
        console.error('Error loading bookings:', queryError)
        // Check if it's an RLS policy issue
        if (queryError.message.includes('policy') || queryError.message.includes('permission') || queryError.code === '42501') {
          setError(`⚠️ Permission denied. The RLS policy may not be working correctly. Check the browser console for details.`)
        } else {
          setError(`Failed to load bookings: ${queryError.message}`)
        }
        setBookings([])
      } else {
        setBookings(data || [])
        console.log(`✅ Loaded ${data?.length || 0} bookings (RLS filtered)`)
        
        // Debug info
        if (data && data.length > 0) {
          const profileIds = [...new Set(data.map(b => b.profile_id))]
          console.log(`Bookings found for profile IDs:`, profileIds)
        } else {
          console.warn('⚠️ No bookings returned by query. Check if bookings exist in database.')
        }
      }
      console.log('=== END DEBUGGING ===')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setBookings([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, user?.email])

  useEffect(() => {
    if (!user) return
    
    loadBookings()

    // Setup real-time subscription
    if (user.id && !subscriptionRef.current) {
      const channel = supabase
        .channel(`bookings-changes-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `profile_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Booking change detected:', payload.eventType, payload.new || payload.old)
            // Debounce rapid changes
            setTimeout(() => {
              loadBookings()
            }, 300)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Real-time subscription active for profile_id:', user.id)
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Real-time subscription error - bookings will still load on refresh')
          }
        })

      subscriptionRef.current = channel
    }

    return () => {
      // Cleanup subscription on unmount
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [user, loadBookings])

  async function handleRefresh() {
    setRefreshing(true)
    await loadBookings()
  }

  async function handleStatusChange(id, status) {
    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (updateError) {
        alert('Update failed: ' + updateError.message)
        console.error('Update error:', updateError)
      } else {
        // Real-time subscription will trigger loadBookings automatically
        // But we can also reload immediately for better UX
        await loadBookings()
      }
    } catch (err) {
      console.error('Unexpected error updating status:', err)
      alert('An unexpected error occurred')
    }
  }

  async function onBlockAdded() {
    setShowBlockForm(false)
    await loadBookings()
  }

  const pending = bookings.filter((b) => b.status === 'pending')
  const approved = bookings.filter((b) => b.status === 'approved')
  const declined = bookings.filter((b) => b.status === 'declined')
  const upcomingApproved = approved.filter((b) => new Date(b.start_time) >= new Date())

  const formatDate = (iso) => {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDateTime = (iso) => `${formatDate(iso)} at ${formatTime(iso)}`

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          {error && <p className="dashboard-error">⚠️ {error}</p>}
        </div>
        <div className="dashboard-header-actions">
          <button 
            onClick={handleRefresh} 
            className="btn-outline" 
            disabled={refreshing || loading}
            title="Refresh bookings"
          >
            {refreshing ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <button onClick={() => setShowBlockForm(!showBlockForm)} className="btn-outline">
            {showBlockForm ? 'Cancel' : 'Block Off Time'}
          </button>
        </div>
      </div>

      {showBlockForm && <BlockTimeForm profileId={user?.id} onDone={onBlockAdded} />}

      {/* Statistics Cards */}
      {!loading && (
        <div className="dashboard-stats">
          <div className="stat-card stat-pending">
            <div className="stat-value">{pending.length}</div>
            <div className="stat-label">Pending Requests</div>
          </div>
          <div className="stat-card stat-approved">
            <div className="stat-value">{upcomingApproved.length}</div>
            <div className="stat-label">Upcoming Appointments</div>
          </div>
          <div className="stat-card stat-total">
            <div className="stat-value">{approved.length}</div>
            <div className="stat-label">Total Approved</div>
          </div>
          <div className="stat-card stat-declined">
            <div className="stat-value">{declined.length}</div>
            <div className="stat-label">Declined</div>
          </div>
        </div>
      )}

      {/* Pending Requests Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Pending Requests {pending.length > 0 && <span className="badge">{pending.length}</span>}</h2>
        </div>
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading bookings...</p>
          </div>
        ) : pending.length === 0 ? (
          <div className="empty-state">
            <p>✨ No pending requests at the moment.</p>
          </div>
        ) : (
          <div className="booking-list">
            {pending.map((b) => (
              <div key={b.id} className="booking-card pending">
                <div className="booking-info">
                  <div className="booking-header">
                    <strong className="customer-name">{b.customer_name}</strong>
                    <span className="booking-date">{formatDate(b.start_time)}</span>
                  </div>
                  <div className="booking-details">
                    <div className="detail-item">
                      <span className="detail-label">📧 Email:</span>
                      <span>{b.customer_email}</span>
                    </div>
                    {b.customer_phone && (
                      <div className="detail-item">
                        <span className="detail-label">📞 Phone:</span>
                        <span>{b.customer_phone}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <span className="detail-label">🕐 Time:</span>
                      <span>{formatTime(b.start_time)}</span>
                    </div>
                    {b.service_type && (
                      <div className="detail-item">
                        <span className="detail-label">💅 Service:</span>
                        <span>{b.service_type}</span>
                      </div>
                    )}
                    {b.notes && (
                      <div className="detail-item notes-item">
                        <span className="detail-label">📝 Notes:</span>
                        <p className="notes">{b.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="booking-actions">
                  <button 
                    onClick={() => handleStatusChange(b.id, 'approved')} 
                    className="btn-approve"
                  >
                    ✓ Approve
                  </button>
                  <button 
                    onClick={() => handleStatusChange(b.id, 'declined')} 
                    className="btn-decline"
                  >
                    ✗ Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Approved Appointments Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Approved Appointments {approved.length > 0 && <span className="badge">{approved.length}</span>}</h2>
        </div>
        {approved.length === 0 ? (
          <div className="empty-state">
            <p>No approved appointments yet.</p>
          </div>
        ) : (
          <div className="booking-list">
            {approved.map((b) => {
              const isPast = new Date(b.start_time) < new Date()
              return (
                <div key={b.id} className={`booking-card approved ${isPast ? 'past' : ''}`}>
                  <div className="booking-info">
                    <div className="booking-header">
                      <strong className="customer-name">{b.customer_name}</strong>
                      <span className={`booking-status-badge ${isPast ? 'past-badge' : 'upcoming-badge'}`}>
                        {isPast ? 'Past' : 'Upcoming'}
                      </span>
                    </div>
                    <div className="booking-details">
                      <div className="detail-item">
                        <span className="detail-label">📅 Date & Time:</span>
                        <span>{formatDateTime(b.start_time)}</span>
                      </div>
                      {b.customer_email && (
                        <div className="detail-item">
                          <span className="detail-label">📧 Email:</span>
                          <span>{b.customer_email}</span>
                        </div>
                      )}
                      {b.customer_phone && (
                        <div className="detail-item">
                          <span className="detail-label">📞 Phone:</span>
                          <span>{b.customer_phone}</span>
                        </div>
                      )}
                      {b.service_type && (
                        <div className="detail-item">
                          <span className="detail-label">💅 Service:</span>
                          <span>{b.service_type}</span>
                        </div>
                      )}
                      {b.notes && (
                        <div className="detail-item notes-item">
                          <span className="detail-label">📝 Notes:</span>
                          <p className="notes">{b.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Declined Section */}
      {declined.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Declined Requests {declined.length > 0 && <span className="badge">{declined.length}</span>}</h2>
          </div>
          <div className="booking-list">
            {declined.map((b) => (
              <div key={b.id} className="booking-card declined">
                <div className="booking-info">
                  <div className="booking-header">
                    <strong className="customer-name">{b.customer_name}</strong>
                    <span className="booking-date">{formatDate(b.start_time)}</span>
                  </div>
                  <div className="booking-details">
                    {b.customer_email && (
                      <div className="detail-item">
                        <span className="detail-label">📧 Email:</span>
                        <span>{b.customer_email}</span>
                      </div>
                    )}
                    {b.service_type && (
                      <div className="detail-item">
                        <span className="detail-label">💅 Service:</span>
                        <span>{b.service_type}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
