import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import BlockTimeForm from './BlockTimeForm'
import { fetchAndPredictAllComebacks } from '../../lib/predictions/advancedPredictor/integration'

export default function NailTechDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState('dashboard')
  const [dashboardView, setDashboardView] = useState('pending')
  const [allClientsView, setAllClientsView] = useState('approved')
  const [predictions, setPredictions] = useState([])
  const [predictionsLoading, setPredictionsLoading] = useState(false)
  const subscriptionRef = useRef(null)

  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setError('No user ID found')
      setLoading(false)
      return
    }

    try {
      setError(null)

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error loading bookings:', error)
        if (error.code === '42501' || error.message.includes('permission')) {
          setError('⚠️ Permission denied. Check your RLS policies and browser console.')
        } else {
          setError(`Failed to load bookings: ${error.message}`)
        }
        setBookings([])
      } else {
        setBookings(data || [])
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setBookings([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  const loadPredictions = useCallback(async () => {
    if (!user?.id) return

    try {
      setPredictionsLoading(true)
      const result = await fetchAndPredictAllComebacks(user.id)
      if (result.success && result.data) {
        setPredictions(result.data.sort((a, b) => b.comebackPercentage - a.comebackPercentage))
      } else {
        setPredictions([])
      }
    } catch (err) {
      console.error('Error loading predictions:', err)
      setPredictions([])
    } finally {
      setPredictionsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return

    loadBookings()
    loadPredictions()

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
          () => {
            setTimeout(() => {
              loadBookings()
              loadPredictions()
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
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [user, loadBookings, loadPredictions])

  async function handleRefresh() {
    setRefreshing(true)
    await loadBookings()
    await loadPredictions()
  }

  async function handleStatusChange(id, status, updates = {}) {
    try {
      const payload = {
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      }

      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', id)

      if (error) {
        alert('Update failed: ' + error.message)
      } else {
        await loadBookings()
        await loadPredictions()
      }
    } catch (err) {
      console.error('Error updating status:', err)
      alert('An unexpected error occurred')
    }
  }

  async function onBlockAdded() {
    setShowBlockForm(false)
    await loadBookings()
    await loadPredictions()
  }

  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDate = (iso) => {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const formatDateTime = (iso) => `${formatDate(iso)} at ${formatTime(iso)}`

  const allPending = bookings.filter((b) => b.status === 'pending')
  const allApproved = bookings.filter((b) => b.status === 'approved')
  const allDeclined = bookings.filter((b) => b.status === 'declined')
  const upcomingApproved = allApproved.filter((b) => new Date(b.start_time) >= new Date())
  const upcomingPending = allPending.filter((b) => new Date(b.start_time) >= new Date())
  const pastApproved = allApproved.filter((b) => new Date(b.start_time) < new Date())

  function BookingCard({ booking, type, onStatusChange }) {
    const [paymentProofExpanded, setPaymentProofExpanded] = useState(false)
    const [refundProofExpanded, setRefundProofExpanded] = useState(false)
    const [showDeclinePanel, setShowDeclinePanel] = useState(false)
    const [declineProof, setDeclineProof] = useState(null)
    const [declineError, setDeclineError] = useState('')
    const [declineUploading, setDeclineUploading] = useState(false)

    const statusLabels = {
      pending: 'Pending',
      approved: new Date(booking.start_time) < new Date() ? 'Past' : 'Upcoming',
      declined: 'Declined',
    }

    const handleRefundFileChange = (event) => {
      const file = event.target.files?.[0]
      if (!file) return

      const validTypes = ['image/jpeg', 'image/png']
      const validExts = ['jpg', 'jpeg', 'png']
      const extension = file.name.split('.').pop()?.toLowerCase()

      if (!validTypes.includes(file.type) || !validExts.includes(extension)) {
        setDeclineError('Please upload a JPG or PNG image for refund proof.')
        setDeclineProof(null)
        return
      }

      setDeclineError('')
      setDeclineProof(file)
    }

    const handleDeclineWithoutProof = async () => {
      setDeclineError('')
      setShowDeclinePanel(false)
      await onStatusChange(booking.id, 'declined')
    }

    const handleDeclineWithProof = async () => {
      if (!declineProof) {
        setDeclineError('Please select a refund proof image before declining.')
        return
      }

      setDeclineUploading(true)
      setDeclineError('')

      try {
        const extension = declineProof.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}_${booking.id}.${extension}`
        const filePath = `${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, declineProof, {
            contentType: declineProof.type,
            upsert: false,
          })

        if (uploadError) {
          setDeclineError('Failed to upload refund proof: ' + uploadError.message)
          return
        }

        const { data: urlData } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(filePath)

        const refundProofUrl = urlData?.publicUrl
        if (!refundProofUrl) {
          setDeclineError('Failed to generate refund proof URL.')
          return
        }

        const { error: dbError } = await supabase
          .from('bookings')
          .update({
            status: 'declined',
            refund_proof_url: refundProofUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id)

        if (dbError) {
          await supabase.storage.from('payment-proofs').remove([filePath])
          setDeclineError('Failed to save refund proof: ' + dbError.message)
          return
        }

        await loadBookings()
        await loadPredictions()
        setShowDeclinePanel(false)
        setDeclineProof(null)
      } catch (err) {
        console.error('Error declining booking with proof:', err)
        setDeclineError('An unexpected error occurred while uploading refund proof.')
      } finally {
        setDeclineUploading(false)
      }
    }

    return (
      <div className={`booking-card ${type}`}>
        <div className="booking-info">
          <div className="booking-header">
            <strong className="customer-name">{booking.customer_name}</strong>
            <span className={`booking-status-badge ${type}`}>
              {statusLabels[type]}
            </span>
          </div>
          <div className="booking-details">
            <div className="detail-item">
              <span className="detail-label">Date & Time:</span>
              <span>{formatDateTime(booking.start_time)}</span>
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
              <div className="detail-item notes-item">
                <span className="detail-label">Notes:</span>
                <p className="notes">{booking.notes}</p>
              </div>
            )}
            {/* ✅ Payment Proof */}
            {booking.payment_proof_url ? (
              <div className="detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="detail-label">Payment Proof:</span>
                <button
                  className="btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', marginTop: '0.25rem' }}
                  onClick={() => setPaymentProofExpanded(!paymentProofExpanded)}
                >
                  {paymentProofExpanded ? 'Hide Screenshot' : 'View Screenshot'}
                </button>
                {paymentProofExpanded && (
                  <img
                    src={booking.payment_proof_url}
                    alt={`Payment proof for ${booking.customer_name}`}
                    style={{
                      maxWidth: '250px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      marginTop: '0.5rem',
                    }}
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="100"%3E%3Crect width="200" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="12"%3EImage failed to load%3C/text%3E%3C/svg%3E'
                    }}
                    loading="lazy"
                  />
                )}
              </div>
            ) : (
              <div className="detail-item">
                <span className="detail-label">Payment:</span>
                <span style={{ color: '#f59e0b' }}>No payment submitted yet</span>
              </div>
            )}

            {/* ✅ Refund Proof */}
            {booking.refund_proof_url ? (
              <div className="detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="detail-label">Refund Proof:</span>
                <button
                  className="btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', marginTop: '0.25rem' }}
                  onClick={() => setRefundProofExpanded(!refundProofExpanded)}
                >
                  {refundProofExpanded ? 'Hide Refund Proof' : 'View Refund Proof'}
                </button>
                {refundProofExpanded && (
                  <img
                    src={booking.refund_proof_url}
                    alt={`Refund proof for ${booking.customer_name}`}
                    style={{
                      maxWidth: '250px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      marginTop: '0.5rem',
                    }}
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="100"%3E%3Crect width="200" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="12"%3EImage failed to load%3C/text%3E%3C/svg%3E'
                    }}
                    loading="lazy"
                  />
                )}
              </div>
            ) : booking.status === 'declined' ? (
              <div className="detail-item">
                <span className="detail-label"> Refund Proof:</span>
                <span style={{ color: '#9ca3af' }}>Not provided</span>
              </div>
            ) : null}
          </div>
        </div>
        {type === 'pending' && (
          <>
            <div className="booking-actions">
              <button
                onClick={() => onStatusChange(booking.id, 'approved')}
                className="btn-approve"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => setShowDeclinePanel((prev) => !prev)}
                className="btn-decline"
              >
                ✗ Decline
              </button>
            </div>
            {showDeclinePanel && (
              <div
                className="decline-panel"
                style={{
                  backgroundColor: '#fafafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '1rem',
                  marginTop: '1rem',
                }}
              >
                <p style={{ marginBottom: '0.75rem', color: '#374151' }}>
                  Upload refund proof when declining the booking.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleRefundFileChange}
                  disabled={declineUploading}
                />
                {declineError && (
                  <p style={{ color: '#dc2626', marginTop: '0.5rem' }}>{declineError}</p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-decline"
                    onClick={handleDeclineWithoutProof}
                    disabled={declineUploading}
                  >
                    Decline without proof
                  </button>
                  <button
                    className="btn-approve"
                    onClick={handleDeclineWithProof}
                    disabled={!declineProof || declineUploading}
                  >
                    {declineUploading ? 'Submitting...' : 'Decline with refund proof'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  function renderDashboard() {
    return (
      <>
        <div className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            {error && <p className="dashboard-error"> {error}</p>}
          </div>
          <div className="dashboard-header-actions">
            <button
              onClick={handleRefresh}
              className="btn-outline"
              disabled={refreshing || loading}
              title="Refresh bookings"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowBlockForm(!showBlockForm)}
              className="btn-outline"
            >
              {showBlockForm ? 'Cancel' : 'Block Off Time'}
            </button>
            <button
              onClick={() => setView('predictions')}
              className="btn-outline"
              title="View comeback predictions"
            >
              Predictions
            </button>
          </div>
        </div>

        {showBlockForm && (
          <BlockTimeForm profileId={user?.id} onDone={onBlockAdded} />
        )}

        {/*  Stats always visible */}
        {!loading && (
          <div className="dashboard-stats">
            <div className="stat-card stat-pending">
              <div className="stat-value">{upcomingPending.length}</div>
              <div className="stat-label">Pending Requests</div>
            </div>
            <div className="stat-card stat-approved">
              <div className="stat-value">{upcomingApproved.length}</div>
              <div className="stat-label">Upcoming Appointments</div>
            </div>
            <div className="stat-card stat-total">
              <div className="stat-value">{pastApproved.length}</div>
              <div className="stat-label">Past Appointments</div>
            </div>
            <div className="stat-card stat-declined">
              <div className="stat-value">{allDeclined.length}</div>
              <div className="stat-label">Declined</div>
            </div>
          </div>
        )}

        {/* ✅ Only 4 filter buttons */}
        {!loading && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setDashboardView('pending')}
              className={`btn-outline ${dashboardView === 'pending' ? 'active' : ''}`}
              style={{
                backgroundColor: dashboardView === 'pending' ? '#745e4c' : 'transparent',
                color: dashboardView === 'pending' ? '#ffffff' : '#333',
                fontWeight: dashboardView === 'pending' ? 'bold' : 'normal',
              }}
            >
              Pending
            </button>
            <button
              onClick={() => setDashboardView('upcoming')}
              className={`btn-outline ${dashboardView === 'upcoming' ? 'active' : ''}`}
              style={{
                backgroundColor: dashboardView === 'upcoming' ? '#745e4c' : 'transparent',
                color: dashboardView === 'upcoming' ? '#ffffff' : '#333',
                fontWeight: dashboardView === 'upcoming' ? 'bold' : 'normal',
              }}
            >
              Upcoming
            </button>
            <button
              onClick={() => setDashboardView('past')}
              className={`btn-outline ${dashboardView === 'past' ? 'active' : ''}`}
              style={{
                backgroundColor: dashboardView === 'past' ? '#745e4c' : 'transparent',
                color: dashboardView === 'past' ? '#fff' : '#333',
                fontWeight: dashboardView === 'past' ? 'bold' : 'normal',
              }}
            >
              Past
            </button>
            <button
              onClick={() => setDashboardView('declined')}
              className={`btn-outline ${dashboardView === 'declined' ? 'active' : ''}`}
              style={{
                backgroundColor: dashboardView === 'declined' ? '#745e4c' : 'transparent',
                color: dashboardView === 'declined' ? '#fff' : '#333',
                fontWeight: dashboardView === 'declined' ? 'bold' : 'normal',
              }}
            >
              Declined
            </button>
          </div>
        )}

        {/* ✅ Show only selected view */}
        {dashboardView === 'pending' && (
          <section className="dashboard-section">
            <div className="section-header">
              <h2>Pending Requests {upcomingPending.length > 0 && <span className="badge">{upcomingPending.length}</span>}</h2>
            </div>
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading bookings...</p>
              </div>
            ) : upcomingPending.length === 0 ? (
              <div className="empty-state"><p>✨ No pending requests at the moment.</p></div>
            ) : (
              <div className="booking-list">
                {upcomingPending.map((b) => (
                  <BookingCard key={b.id} booking={b} type="pending" onStatusChange={handleStatusChange} />
                ))}
              </div>
            )}
          </section>
        )}

        {dashboardView === 'upcoming' && (
          <section className="dashboard-section">
            <div className="section-header">
              <h2>Upcoming Appointments {upcomingApproved.length > 0 && <span className="badge">{upcomingApproved.length}</span>}</h2>
            </div>
            {upcomingApproved.length === 0 ? (
              <div className="empty-state"><p>No upcoming approved appointments yet.</p></div>
            ) : (
              <div className="booking-list">
                {upcomingApproved.map((b) => (
                  <BookingCard key={b.id} booking={b} type="approved" />
                ))}
              </div>
            )}
          </section>
        )}

        {dashboardView === 'past' && (
          <section className="dashboard-section">
            <div className="section-header">
              <h2>Past Appointments {pastApproved.length > 0 && <span className="badge">{pastApproved.length}</span>}</h2>
            </div>
            {pastApproved.length === 0 ? (
              <div className="empty-state"><p>No past appointments.</p></div>
            ) : (
              <div className="booking-list">
                {pastApproved.map((b) => (
                  <BookingCard key={b.id} booking={b} type="approved" />
                ))}
              </div>
            )}
          </section>
        )}

        {dashboardView === 'declined' && (
          <section className="dashboard-section">
            <div className="section-header">
              <h2>Declined Requests {allDeclined.length > 0 && <span className="badge">{allDeclined.length}</span>}</h2>
            </div>
            {allDeclined.length === 0 ? (
              <div className="empty-state"><p>No declined bookings.</p></div>
            ) : (
              <div className="booking-list">
                {allDeclined.map((b) => (
                  <BookingCard key={b.id} booking={b} type="declined" />
                ))}
              </div>
            )}
          </section>
        )}
      </>
    )
  }

  function renderAllPending() {
    return allPending.length === 0 ? (
      <div className="empty-state"><p>No pending bookings.</p></div>
    ) : (
      <div className="booking-list">
        {allPending.map((b) => (
          <BookingCard key={b.id} booking={b} type="pending" onStatusChange={handleStatusChange} />
        ))}
      </div>
    )
  }

  function renderAllApproved() {
    return allApproved.length === 0 ? (
      <div className="empty-state"><p>No approved bookings.</p></div>
    ) : (
      <div className="booking-list">
        {allApproved.map((b) => (
          <BookingCard key={b.id} booking={b} type="approved" />
        ))}
      </div>
    )
  }

  function renderAllDeclined() {
    return allDeclined.length === 0 ? (
      <div className="empty-state"><p>No declined bookings.</p></div>
    ) : (
      <div className="booking-list">
        {allDeclined.map((b) => (
          <BookingCard key={b.id} booking={b} type="declined" />
        ))}
      </div>
    )
  }

  function renderAllClients() {
    return (
      <>
        <div className="dashboard-header">
          <h1>All Clients</h1>
          <button onClick={() => setView('dashboard')} className="btn-outline">
            ← Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading all clients...</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                onClick={() => setAllClientsView('pending')}
                className={`btn-outline ${allClientsView === 'pending' ? 'active' : ''}`}
                style={{
                  backgroundColor: allClientsView === 'pending' ? '#fbbf24' : 'transparent',
                  color: allClientsView === 'pending' ? '#000' : '#333',
                  fontWeight: allClientsView === 'pending' ? 'bold' : 'normal',
                }}
              >
                All Pending
              </button>
              <button
                onClick={() => setAllClientsView('approved')}
                className={`btn-outline ${allClientsView === 'approved' ? 'active' : ''}`}
                style={{
                  backgroundColor: allClientsView === 'approved' ? '#10b981' : 'transparent',
                  color: allClientsView === 'approved' ? '#fff' : '#333',
                  fontWeight: allClientsView === 'approved' ? 'bold' : 'normal',
                }}
              >
                All Approved
              </button>
              <button
                onClick={() => setAllClientsView('declined')}
                className={`btn-outline ${allClientsView === 'declined' ? 'active' : ''}`}
                style={{
                  backgroundColor: allClientsView === 'declined' ? '#ef4444' : 'transparent',
                  color: allClientsView === 'declined' ? '#fff' : '#333',
                  fontWeight: allClientsView === 'declined' ? 'bold' : 'normal',
                }}
              >
                All Declined
              </button>
            </div>

            <section className="dashboard-section">
              {allClientsView === 'pending' && (
                <>
                  <div className="section-header"><h2>All Pending Clients</h2></div>
                  {renderAllPending()}
                </>
              )}
              {allClientsView === 'approved' && (
                <>
                  <div className="section-header"><h2>All Approved Clients</h2></div>
                  {renderAllApproved()}
                </>
              )}
              {allClientsView === 'declined' && (
                <>
                  <div className="section-header"><h2>All Declined Clients</h2></div>
                  {renderAllDeclined()}
                </>
              )}
            </section>
          </>
        )}
      </>
    )
  }

  function renderPredictions() {
    return (
      <>
        <div className="dashboard-header">
          <h1>Customer Comeback Predictions</h1>
          <button onClick={() => setView('dashboard')} className="btn-outline">
            ← Back to Dashboard
          </button>
        </div>

        {predictionsLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading predictions...</p>
          </div>
        ) : predictions.length === 0 ? (
          <div className="empty-state">
            <p>No prediction data available yet. You need bookings to generate predictions.</p>
          </div>
        ) : (
          <section className="dashboard-section">
            <div className="section-header">
              <h2>Comeback Likelihood <span className="badge">{predictions.length}</span></h2>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Based on number of bookings, days since last booking, and booking pattern
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {predictions.map((pred) => {
                const percentage = pred.comebackPercentage || 0
                let barColor = '#ef4444'
                if (percentage >= 60) barColor = '#10b981'
                else if (percentage >= 40) barColor = '#f59e0b'

                return (
                  <div
                    key={pred.customerName}
                    style={{
                      padding: '1rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong>{pred.customerName}</strong>
                        <span style={{ fontWeight: 'bold', color: barColor }}>
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${percentage}%`,
                            backgroundColor: barColor,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </>
    )
  }

  return (
    <div className="dashboard">
      {view === 'dashboard'
        ? renderDashboard()
        : view === 'allClients'
        ? renderAllClients()
        : renderPredictions()}
    </div>
  )
}