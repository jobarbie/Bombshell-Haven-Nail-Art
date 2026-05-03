import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function ToastNotification() {
  const [toasts, setToasts] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('booking-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          const { status, start_time } = payload.new
          const oldStatus = payload.old?.status
          if ((status === 'approved' || status === 'declined') && oldStatus !== status) {
            const date = new Date(start_time).toLocaleDateString()
            const message =
              status === 'approved'
                ? `Your booking on ${date} has been approved!`
                : `Your booking on ${date} was declined.`
            const id = Date.now()
            setToasts((prev) => [...prev, { id, message }])
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== id))
            }, 5000)
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id])

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: '#1a1a2e',
            color: '#fff',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontSize: '0.95rem',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}