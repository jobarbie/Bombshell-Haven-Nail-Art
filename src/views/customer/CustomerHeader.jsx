import { Link } from 'react-router-dom'

export default function CustomerHeader() {
  return (
    <header className="customer-header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <span className="logo-text">Bombshell Haven</span>
        </Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/#gallery">Gallery</Link>
          <Link to="/#about">About</Link>
          <Link to="/book" className="btn-book">Book Now</Link>
        </nav>
      </div>
    </header>
  )
}
