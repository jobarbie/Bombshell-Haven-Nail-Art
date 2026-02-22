import { Link } from 'react-router-dom'

export default function NailTechAuthLayout({ children }) {
  return (
    <div className="nailtech-auth-page">
      <header className="nailtech-auth-header">
        <Link to="/" className="nailtech-auth-logo">Bombshell Haven</Link>
      </header>
      <main className="nailtech-auth-main">
        {children}
      </main>
    </div>
  )
}
