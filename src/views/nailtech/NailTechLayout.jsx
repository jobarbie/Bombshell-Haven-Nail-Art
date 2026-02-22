import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function NailTechLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="nailtech-layout">
      <header className="nailtech-header">
        <div className="header-inner">
          <Link to="/nailtech/dashboard" className="logo">Bombshell Haven</Link>
          <nav>
            <span className="user-email">{user?.email}</span>
            <button onClick={signOut} className="btn-outline">Sign Out</button>
          </nav>
        </div>
      </header>
      <main className="nailtech-main">
        <Outlet />
      </main>
    </div>
  )
}
