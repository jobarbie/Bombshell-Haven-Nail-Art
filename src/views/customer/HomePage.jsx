import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NailGallery from './NailGallery'

export default function HomePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await supabase.from('profiles').select('*').limit(1).maybeSingle()
        setProfile(data)
      } catch {
        setProfile(null)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  const defaultProfile = {
    business_name: 'Bombshell Haven',
    display_name: 'Your Nail Tech',
    bio: 'Passionate about creating beautiful nails that make you feel confident. From classic manicures to bold nail art, I bring creativity and precision to every appointment.',
  }

  const info = profile || defaultProfile

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Bombshell Haven</h1>
          <p className="hero-tagline">Where nails become art. Book your perfect look.</p>
          <Link to="/book" className="btn-primary">Book an Appointment</Link>
        </div>
      </section>

      <section id="gallery" className="section gallery-section">
        <h2>Our Work</h2>
        <p className="section-sub">Browse our nail art gallery</p>
        <NailGallery />
      </section>

      <section id="about" className="section about-section">
        <h2>About</h2>
        <div className="about-content">
          <div className="about-text">
            <h3>{info.business_name}</h3>
            <p>{loading ? 'Loading...' : info.bio}</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to book?</h2>
        <p>Choose a date and time that works for you.</p>
        <Link to="/book" className="btn-primary">Book Now</Link>
      </section>

      <footer className="customer-footer">
        <p>© {new Date().getFullYear()} Bombshell Haven. All rights reserved.</p>
      </footer>
    </>
  )
}
