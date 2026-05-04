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
  
  // ✅ Print configuration state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printStartDate, setPrintStartDate] = useState('')
  const [printEndDate, setPrintEndDate] = useState('')
  
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

  // Filters by selected date range before printing
  const getActiveBookingsForPrint = () => {
    let baseList = []
    switch (dashboardView) {
      case 'pending': baseList = upcomingPending; break;
      case 'upcoming': baseList = upcomingApproved; break;
      case 'past': baseList = pastApproved; break;
      case 'declined': baseList = allDeclined; break;
      default: baseList = [];
    }

    if (printStartDate || printEndDate) {
      return baseList.filter(b => {
        const bookingDate = new Date(b.start_time);
        
        let isAfterStart = true;
        let isBeforeEnd = true;

        if (printStartDate) {
          const start = new Date(printStartDate + 'T00:00:00');
          isAfterStart = bookingDate >= start;
        }
        if (printEndDate) {
          const end = new Date(printEndDate + 'T23:59:59');
          isBeforeEnd = bookingDate <= end;
        }

        return isAfterStart && isBeforeEnd;
      });
    }

    return baseList;
  }

  const handlePrintSubmit = () => {
    window.print()
    setShowPrintModal(false) // Optionally close the modal automatically after printing
  }

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

        {!loading && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
            
            {/* ✅ Single Print Button on the right that triggers the modal */}
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={() => setShowPrintModal(true)}
                className="btn-outline"
                title="Print current bookings"
              >
                🖨️ Print Bookings
              </button>
            </div>
          </div>
        )}

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
                  {allPending.length === 0 ? <div className="empty-state"><p>No pending bookings.</p></div> : <div className="booking-list">{allPending.map((b) => <BookingCard key={b.id} booking={b} type="pending" onStatusChange={handleStatusChange} />)}</div>}
                </>
              )}
              {allClientsView === 'approved' && (
                <>
                  <div className="section-header"><h2>All Approved Clients</h2></div>
                  {allApproved.length === 0 ? <div className="empty-state"><p>No approved bookings.</p></div> : <div className="booking-list">{allApproved.map((b) => <BookingCard key={b.id} booking={b} type="approved" />)}</div>}
                </>
              )}
              {allClientsView === 'declined' && (
                <>
                  <div className="section-header"><h2>All Declined Clients</h2></div>
                  {allDeclined.length === 0 ? <div className="empty-state"><p>No declined bookings.</p></div> : <div className="booking-list">{allDeclined.map((b) => <BookingCard key={b.id} booking={b} type="declined" />)}</div>}
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
      {/* Dynamic styles injected specifically for formatting the print view */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { 
            background: white !important; 
            margin: 0; 
            padding: 20px; 
            color: black;
          }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
            font-family: sans-serif;
          }
          .print-date-range {
            font-size: 14px;
            font-weight: normal;
            color: #555;
            margin-top: 5px;
          }
          .print-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-family: sans-serif; 
            font-size: 12px;
          }
          .print-table th, .print-table td { 
            border: 1px solid #000; 
            padding: 8px; 
            text-align: left; 
          }
          .print-table th { 
            background-color: #f2f2f2 !important; 
            -webkit-print-color-adjust: exact;
            font-weight: bold;
          }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* Wrapping the actual interactive dashboard layout in a no-print div */}
      <div className="no-print">
        {view === 'dashboard'
          ? renderDashboard()
          : view === 'allClients'
          ? renderAllClients()
          : renderPredictions()}
      </div>

      {/* ✅ The Print Options Modal */}
      {showPrintModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#111827' }}>Print Options</h3>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Select a date range to filter the bookings before printing. Leave blank to print all records.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: '500', color: '#374151' }}>Start Date</label>
                <input 
                  type="date" 
                  value={printStartDate} 
                  onChange={(e) => setPrintStartDate(e.target.value)} 
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: '500', color: '#374151' }}>End Date</label>
                <input 
                  type="date" 
                  value={printEndDate} 
                  onChange={(e) => setPrintEndDate(e.target.value)} 
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                className="btn-outline" 
                onClick={() => {
                  setShowPrintModal(false)
                  // Optionally clear dates when canceling: setPrintStartDate(''); setPrintEndDate('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-approve" 
                onClick={handlePrintSubmit}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#745e4c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Print Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Excel-like table structure that only shows up when printing */}
      <div className="print-only">
        <h2 className="print-header">
          {dashboardView.charAt(0).toUpperCase() + dashboardView.slice(1)} Bookings Report
          {/* Shows the filtered date range on the printed paper if selected */}
          {(printStartDate || printEndDate) && (
            <div className="print-date-range">
              ({printStartDate ? new Date(printStartDate).toLocaleDateString() : 'Start'} 
              {' - '} 
              {printEndDate ? new Date(printEndDate).toLocaleDateString() : 'End'})
            </div>
          )}
        </h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Date & Time</th>
              <th>Phone Number</th>
              <th>Service</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {getActiveBookingsForPrint().length > 0 ? (
              getActiveBookingsForPrint().map((b) => (
                <tr key={b.id}>
                  <td>{b.customer_name}</td>
                  <td>{formatDateTime(b.start_time)}</td>
                  <td>{b.customer_phone || 'N/A'}</td>
                  <td>{b.service_type || 'N/A'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{b.status}</td>
                  <td>{b.notes || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                  No bookings found for this view and date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}