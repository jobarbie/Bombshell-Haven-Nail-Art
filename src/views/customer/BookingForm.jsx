import { useState } from 'react'

export default function BookingForm({ slots, onSubmit, error, submitting }) {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [service, setService] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedSlot) return
    onSubmit({
      name,
      phone,
      service: service || null,
      notes: notes || null,
      start_time: selectedSlot.start,
      end_time: selectedSlot.end,
    })
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <div className="time-slots">
        {slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            className={`slot-btn ${selectedSlot?.start === slot.start ? 'selected' : ''}`}
            onClick={() => setSelectedSlot(slot)}
          >
            {slot.label}
          </button>
        ))}
      </div>

      {selectedSlot && (
        <div className="form-fields">
          <h3>Your details</h3>
          {error && <div className="form-error">{error}</div>}
          <input
            type="text"
            placeholder="Full name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            type="text"
            placeholder="Service (e.g. Manicure, Pedicure)"
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
          <textarea
            placeholder="Notes or special requests"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Booking Request'}
          </button>
        </div>
      )}
    </form>
  )
}
