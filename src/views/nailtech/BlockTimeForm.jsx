import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const FIXED_SLOTS = [
  { label: '10:00 AM', start: '10:00', end: '13:00' },
  { label: '1:00 PM', start: '13:00', end: '16:00' },
  { label: '4:00 PM', start: '16:00', end: '19:00' },
]

export default function BlockTimeForm({ profileId, onDone }) {
  const [startDate, setStartDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(FIXED_SLOTS[0].label)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!profileId) return

    const slot = FIXED_SLOTS.find((s) => s.label === selectedSlot)
    if (!slot) return

    const start = new Date(`${startDate}T${slot.start}`)
    const end = new Date(`${startDate}T${slot.end}`)

    setLoading(true)
    const { error } = await supabase.from('blocked_times').insert({
      profile_id: profileId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      reason: reason || null,
    })

    if (error) {
      alert('Failed to block time: ' + error.message)
    } else {
      setStartDate('')
      setSelectedSlot(FIXED_SLOTS[0].label)
      setReason('')
      onDone()
    }
    setLoading(false)
  }

  const minDate = new Date().toISOString().slice(0, 10)

  return (
    <div className="block-form card">
      <h3>Block Off Unavailable Time</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          min={minDate}
          required
        />

        <div style={{ marginTop: '0.75rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Select time slot to block:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {FIXED_SLOTS.map((slot) => (
              <button
                key={slot.label}
                type="button"
                onClick={() => setSelectedSlot(slot.label)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: selectedSlot === slot.label ? '#a855f7' : '#e5e7eb',
                  backgroundColor: selectedSlot === slot.label ? '#a855f7' : 'transparent',
                  color: selectedSlot === slot.label ? '#fff' : '#333',
                  fontWeight: selectedSlot === slot.label ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ marginTop: '0.75rem' }}
        />
        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.75rem' }}>
          {loading ? 'Blocking...' : 'Block Time'}
        </button>
      </form>
    </div>
  )
}