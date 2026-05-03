# Authentication Quick Reference

## Quick Start

### Basic Login
```javascript
import { useAuth } from '../contexts/AuthContext'

function LoginForm() {
  const { signIn, error } = useAuth()

  const handleLogin = async () => {
    try {
      await signIn('user@example.com', 'password')
      // User is logged in
    } catch (err) {
      console.error(err.message)
    }
  }

  return (
    <>
      <button onClick={handleLogin}>Log In</button>
      {error && <p>{error}</p>}
    </>
  )
}
```

### Basic Sign Up
```javascript
import { useAuth } from '../contexts/AuthContext'

function SignupForm() {
  const { signUp, error } = useAuth()

  const handleSignup = async () => {
    try {
      await signUp('user@example.com', 'SecurePassword123!')
      // Account created, user can now log in
    } catch (err) {
      console.error(err.message)
    }
  }

  return (
    <>
      <button onClick={handleSignup}>Sign Up</button>
      {error && <p>{error}</p>}
    </>
  )
}
```

### Check if User is Logged In
```javascript
import { useAuth } from '../contexts/AuthContext'

function App() {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (user) return <Dashboard />
  return <LoginPage />
}
```

### Logout
```javascript
import { useAuth } from '../contexts/AuthContext'

function LogoutButton() {
  const { signOut } = useAuth()

  return <button onClick={() => signOut()}>Log Out</button>
}
```

---

## Validation Utilities

### Validate Email
```javascript
import { validateEmail } from '../lib/authUtils'

const result = validateEmail('user@example.com')
// { valid: true, error: null }

const result = validateEmail('invalid')
// { valid: false, error: 'Invalid email format' }
```

### Validate Password
```javascript
import { validatePassword } from '../lib/authUtils'

const result = validatePassword('SecurePass123!')
// { 
//   valid: true, 
//   error: null, 
//   strength: 'strong' 
// }

// Strength: 'weak' | 'fair' | 'good' | 'strong'
```

### Validate Forms
```javascript
import { validateSignupForm, validateLoginForm } from '../lib/authUtils'

// Signup validation
const result = validateSignupForm({
  email: 'user@example.com',
  password: 'SecurePass123!',
  confirmPassword: 'SecurePass123!'
})
// { valid: true, errors: {} }

// Login validation
const result = validateLoginForm({
  email: 'user@example.com',
  password: 'SecurePass123!'
})
// { valid: true, errors: {} }
```

### Password Strength Display
```javascript
import { getPasswordStrengthDisplay } from '../lib/authUtils'

const display = getPasswordStrengthDisplay('strong')
// { text: 'Strong', color: '#00aa44', percentage: 100 }
```

---

## Error Messages

Supabase automatically returns these user-friendly error messages:

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid email or password" | Email doesn't exist or password wrong | Check credentials |
| "Email not confirmed" | Email verification required | Check email for verification link |
| "User already registered" | Email already has account | Use login or reset password |
| "Password does not meet security requirements" | Password too weak | Use stronger password (8+ chars, mixed) |
| "Invalid email format" | Email format invalid | Check email format |
| "Network error" | No internet or service down | Check connection |

---

## Authentication Flow

### Complete Login Flow
```
User enters email + password
        ↓
Client validates inputs
        ↓
Send to Supabase
        ↓
Supabase hashes password
        ↓
Compare with stored hash
        ↓
If match: Return JWT session token
If fail: Return "Invalid credentials"
        ↓
Session stored in browser (secure cookie)
        ↓
Redirect to dashboard
```

### Complete Signup Flow
```
User enters email + password + confirm
        ↓
Client validates inputs
        ↓
Send to Supabase
        ↓
Supabase hashes password with bcrypt
        ↓
Store in auth.users table
        ↓
Optional: Send verification email
        ↓
Return user record
        ↓
Direct to login page
        ↓
User can now log in with credentials
```

---

## Password Requirements

| Requirement | Details |
|---|---|
| **Minimum Length** | 8 characters |
| **Maximum Length** | 128 characters |
| **Special Characters** | Optional but recommended |
| **Numbers** | Optional but recommended |
| **Mixed Case** | Optional but recommended |

### Strength Levels

| Level | Requirements | Example |
|-------|---|---|
| **Weak** | < 8 chars, no variety | `password` |
| **Fair** | 8+ chars, some variety | `password12` |
| **Good** | 10+ chars, 2+ types | `MyPassword12` |
| **Strong** | 12+ chars, 3+ types | `MyP@ssw0rd!` |

---

## Context API

### useAuth Hook

```javascript
const {
  // State
  user,              // { id, email, ... } or null
  loading,           // boolean
  error,             // string or null
  lastAuthTime,      // Date or null

  // Functions
  signUp,            // async (email, password, metadata?) => Promise
  signIn,            // async (email, password) => Promise
  signOut,           // async () => Promise
  resetPassword,     // async (email) => Promise
  updatePassword,    // async (newPassword) => Promise
  clearError         // () => void
} = useAuth()
```

---

## Common Patterns

### Protected Route Component
```javascript
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" />
  return children
}
```

### Login Form with Validation
```javascript
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { validateLoginForm } from '../lib/authUtils'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const { signIn, error } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const validation = validateLoginForm({ email, password })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    try {
      await signIn(email, password)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {errors.email && <small>{errors.email}</small>}
      
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {errors.password && <small>{errors.password}</small>}
      
      <button type="submit">Log In</button>
    </form>
  )
}
```

### Sign Up with Password Strength
```javascript
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  validatePassword,
  getPasswordStrengthDisplay
} from '../lib/authUtils'

export function SignupForm() {
  const [password, setPassword] = useState('')
  const [strength, setStrength] = useState(null)
  const { signUp } = useAuth()

  useEffect(() => {
    if (password) {
      const validation = validatePassword(password)
      setStrength(validation.strength)
    }
  }, [password])

  const display = strength ? getPasswordStrengthDisplay(strength) : null

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      
      {display && (
        <div>
          <div style={{
            width: `${display.percentage}%`,
            backgroundColor: display.color,
            height: '4px'
          }} />
          <p style={{ color: display.color }}>
            Strength: {display.text}
          </p>
        </div>
      )}
    </div>
  )
}
```

---

## Environment Variables

Create `.env.local` in your project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Find these in Supabase dashboard:
1. Go to Project Settings
2. Click API tab
3. Copy values from there

---

## Debugging

### Check if Supabase is configured
```javascript
import { isSupabaseConfigured } from '../lib/supabase'

if (!isSupabaseConfigured()) {
  console.error('Supabase not configured!')
}
```

### Check current user
```javascript
import { supabase } from '../lib/supabase'

const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)
```

### Get current session
```javascript
import { supabase } from '../lib/supabase'

const { data: { session } } = await supabase.auth.getSession()
console.log('Current session:', session)
```

### Clear local data (for testing)
```javascript
// Clear browser storage
localStorage.clear()
sessionStorage.clear()

// Then refresh page to clear Supabase session
```

---

## Testing Credentials

Use these test credentials for development:

```
Email: test@example.com
Password: TestPass123!
```

Create new test accounts as needed. Each test needs a unique email.

---

## Security Checklist

- [ ] Password minimum 8 characters enforced
- [ ] Passwords hashed with bcrypt (automatic via Supabase)
- [ ] HTTPS used for all requests (Supabase enforces)
- [ ] Session tokens stored securely (automatic via Supabase)
- [ ] Error messages don't reveal sensitive info
- [ ] Protected routes check authentication
- [ ] Logout clears session properly
- [ ] Input validation on client and server
- [ ] RLS policies configured for database access
- [ ] Environment variables not committed to git

---

## Useful Links

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Bcrypt.js Package](https://github.com/dcodeIO/bcrypt.js) (reference)
- [OWASP Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Version**: 1.0
**Last Updated**: April 26, 2026
