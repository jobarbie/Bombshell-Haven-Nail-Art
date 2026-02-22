import { Outlet } from 'react-router-dom'
import CustomerHeader from './CustomerHeader'

export default function CustomerLayout() {
  return (
    <div className="customer-layout">
      <CustomerHeader />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
