import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function CustomerAuth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const { signUp, signIn, user } = useAuth()
  const navigate = useNavigate()

  // ✅ Redirect to /book when user is logged in
  useEffect(() => {
    if (user) {
      navigate('/book')
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!email || !password || !confirmPassword) {
          setError('All fields are required')
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setLoading(false)
          return
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
        await signUp(email, password)
        setSuccess('Account created! You can now log in.')
        setMode('login')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      } else {
        if (!email || !password) {
          setError('Email and password are required')
          setLoading(false)
          return
        }
        await signIn(email, password)
        // useEffect above will handle the redirect
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '80vh',
    }}>
      <div className="auth-card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        background: '#fff',
      }}>
        <div className="auth-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2>{mode === 'login' ? 'Welcome Back!' : 'Create Account'}</h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Log in to book your appointment'
              : 'Sign up to get started with booking'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 characters'}
              disabled={loading}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={loading}
                required
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button
            type="submit"
            className="btn-primary auth-submit"
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading
              ? mode === 'login' ? 'Logging in...' : 'Creating account...'
              : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <p>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError('')
                setSuccess('')
              }}
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>

        <div className="auth-notice" style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: '#9ca3af' }}>
          <p>🔒 Your information is secure and encrypted</p>
        </div>
      </div>
    </div>
  )
}