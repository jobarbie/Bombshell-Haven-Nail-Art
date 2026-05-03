import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function CustomerHeader() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="customer-header">
      <div className="header-center">
        <Link to="/" className="logo">
          <span className="logo-text">Bombshell Haven</span>
        </Link>
      </div>
      
      <nav className="header-nav">
        <Link to="/">Home</Link>
        <Link to="/#gallery">Gallery</Link>
        <Link to="/book" className="btn-book">Book Now</Link>
        {user ? (
          <>
            <span className="user-email">{user.email}</span>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </>
        ) : (
          <Link to="/login" className="btn-login">Login</Link>
        )}
      </nav>
    </header>
  )
}