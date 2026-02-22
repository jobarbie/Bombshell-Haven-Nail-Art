import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#faf6f1',
        }}>
          <h1 style={{ marginBottom: '1rem', color: '#2d2420' }}>Something went wrong</h1>
          <p style={{ color: '#6b5b54', marginBottom: '1rem' }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.5rem 1rem',
              background: '#8b6b5c',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Go to Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
