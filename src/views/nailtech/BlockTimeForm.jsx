import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function BlockTimeForm({ profileId, onDone }) {
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('12:00')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!profileId) return

    const start = new Date(`${startDate}T${startTime}`)
    const end = new Date(`${startDate}T${endTime}`)
    if (end <= start) {
      alert('End time must be after start time.')
      return
    }

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
        <div className="time-row">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <span>to</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Blocking...' : 'Block Time'}
        </button>
      </form>
    </div>
  )
}
