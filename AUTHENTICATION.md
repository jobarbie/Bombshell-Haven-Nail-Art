# Authentication Implementation Guide

## Overview

Your application implements **secure user authentication** with the following features:

✅ **Password Hashing**: Passwords are automatically hashed using bcrypt (industry standard)
✅ **Secure Database Storage**: Credentials stored in Supabase's encrypted database
✅ **Login Validation**: Input credentials validated against stored hashes
✅ **Session Management**: Automatic session handling and persistence
✅ **Error Handling**: User-friendly error messages
✅ **Input Validation**: Client-side validation for user inputs

---

## How It Works

### 1. Password Hashing (Bcrypt)

Supabase uses **bcrypt** to hash passwords before storing them. Here's the flow:

```
User Input: "MyPassword123"
          ↓
   Bcrypt Hashing
          ↓
Database Storage: $2a$10$abcdef... (hashed, salted, not reversible)
```

**Key Points:**
- Passwords are **never stored in plain text**
- Bcrypt uses salting to prevent rainbow table attacks
- Each password is hashed with a unique salt (10 rounds by default)
- Hashing is **one-way** - cannot be reversed

### 2. Login Process

```
1. User enters email + password
2. Client-side validation (format, length)
3. Send to Supabase
4. Supabase hashes input password
5. Compare hash with stored hash
6. If match → Grant session token
7. If no match → Return "Invalid credentials" error
```

### 3. Session Management

After successful login:
- User receives a **JWT session token**
- Token stored securely in browser (via Supabase)
- Token sent with every authenticated request
- Token expires after inactivity
- Can be revoked on logout

---

## File Structure

```
src/
├── lib/
│   ├── supabase.js           # Supabase client setup
│   └── authUtils.js          # Validation & utility functions (NEW)
├── contexts/
│   └── AuthContext.jsx       # Enhanced auth context (UPDATED)
├── views/
│   ├── customer/
│   │   └── CustomerAuth.jsx  # Enhanced signup/login form (UPDATED)
│   └── nailtech/
│       └── NailTechLogin.jsx # Enhanced login form (UPDATED)
```

---

## Component Reference

### AuthContext

Provides authentication functions and state:

```javascript
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const {
    user,              // Current logged-in user (or null)
    loading,           // Loading state during auth operations
    error,             // Error message (if any)
    lastAuthTime,      // Timestamp of last successful auth
    signUp,            // Sign up function
    signIn,            // Login function
    signOut,           // Logout function
    resetPassword,     // Send password reset email
    updatePassword,    // Update user password
    clearError         // Clear error message
  } = useAuth()
}
```

### Validation Utilities

Located in `src/lib/authUtils.js`:

```javascript
// Validate email format
validateEmail(email)
// Returns: { valid: boolean, error: string | null }

// Validate password strength
validatePassword(password)
// Returns: { valid, error, strength: 'weak'|'fair'|'good'|'strong' }

// Validate signup form
validateSignupForm({ email, password, confirmPassword, username })
// Returns: { valid, errors: { email?, password?, ... } }

// Validate login form
validateLoginForm({ email, password })
// Returns: { valid, errors: { email?, password? } }

// Parse Supabase errors to user-friendly messages
getAuthErrorMessage(error)
// Returns: user-friendly error string

// Get password strength display
getPasswordStrengthDisplay(strength)
// Returns: { text, color, percentage }
```

---

## Usage Examples

### Sign Up with Validation

```javascript
import { useAuth } from '../contexts/AuthContext'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signUp, error } = useAuth()

  const handleSignup = async (e) => {
    e.preventDefault()
    try {
      // Validation is done inside signUp
      const { user } = await signUp(email, password)
      console.log('User created:', user.id)
    } catch (err) {
      console.error('Signup failed:', err.message)
    }
  }

  return (
    <form onSubmit={handleSignup}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Sign Up</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  )
}
```

### Login with Error Handling

```javascript
async function handleLogin() {
  try {
    await signIn(email, password)
    // Session automatically created and stored
    navigate('/dashboard')
  } catch (err) {
    // Error message is user-friendly:
    // "Invalid email or password"
    // "Email not confirmed"
    // "Password does not meet security requirements"
    console.error(err.message)
  }
}
```

### Check Authentication Status

```javascript
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Please log in</div>
  }

  return <div>Welcome, {user.email}</div>
}
```

### Protected Routes

```javascript
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" />

  return children
}

// Usage:
<Routes>
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } />
</Routes>
```

---

## Security Features

### ✅ Password Requirements

- **Minimum 8 characters** (more secure than 6)
- **Mixed case recommended** (uppercase + lowercase)
- **Numbers & symbols recommended**
- Strength indicator shows in real-time during signup

### ✅ Input Validation

- Email format validation
- Password length validation
- Whitespace trimming
- Maximum length enforcement
- SQL injection prevention (automatic with Supabase)

### ✅ Error Handling

- **Generic error messages** for failed logins (don't reveal if email exists)
- **Specific errors** for validation failures
- No password hints in error messages
- Rate limiting on Supabase (prevents brute force)

### ✅ Session Security

- **JWT tokens** used for sessions
- Tokens include **expiration time**
- Tokens stored in **secure, HTTP-only cookies** (Supabase handles)
- **CSRF protection** (Supabase handles)
- Tokens invalidated on **logout**

### ✅ Database Security

- Passwords **never logged or exposed**
- Row-level security (RLS) policies enforce access control
- Encrypted connection to database
- Regular security updates from Supabase

---

## Password Reset Flow

```javascript
// 1. User requests password reset
await resetPassword(email)
// → Email sent with reset link

// 2. User clicks link in email
// → Taken to reset page with token

// 3. User enters new password
await updatePassword(newPassword)
// → Password updated, session refreshed
```

---

## Supabase Authentication

Your app uses **Supabase Auth**, which provides:

1. **Built-in password hashing** with bcrypt
2. **Session management** with JWT tokens
3. **Email verification** (optional)
4. **Password reset** functionality
5. **Rate limiting** (prevents brute force attacks)
6. **Multi-user support** with RLS (Row-Level Security)

**Supabase handles all the cryptography - you don't need to implement bcrypt directly.**

---

## Best Practices Implemented

✅ **Never store plain text passwords**
✅ **Use bcrypt for hashing** (automatic with Supabase)
✅ **Validate input on client & server**
✅ **Use HTTPS for all auth requests** (Supabase enforces)
✅ **Use secure session tokens** (JWT with expiration)
✅ **Clear error messages without security info**
✅ **Implement password strength checking**
✅ **Support password reset** (via email)
✅ **Logout clears all sessions**
✅ **Protect sensitive routes** (authentication check)

---

## Optional Enhancements

### 1. Multi-Factor Authentication (MFA)

```javascript
// Supabase supports TOTP (Google Authenticator)
await supabase.auth.signUp({
  email,
  password,
  options: {
    // Enable MFA enrollment after signup
    shouldCreateUser: true
  }
})
```

### 2. Social Authentication

```javascript
// Sign in with Google, GitHub, etc.
await supabase.auth.signInWithOAuth({
  provider: 'google'
})
```

### 3. Email Verification

```javascript
// Add email verification requirement
const { data } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${location.origin}/auth/confirm`
  }
})
```

### 4. Rate Limiting

```javascript
// Implement custom rate limiting on sensitive endpoints
// Track failed login attempts per IP
// Temporarily lock account after N failed attempts
```

---

## Troubleshooting

### "Invalid login credentials"
- Email doesn't exist
- Password is incorrect
- Account not verified (if email verification enabled)

### "Password does not meet security requirements"
- Password is less than 8 characters
- Supabase password policy not met

### "Email already registered"
- Account already exists
- User should reset password or use "Forgot Password"

### "Network error"
- No internet connection
- Supabase service unavailable
- Check `isSupabaseConfigured()` in supabase.js

---

## How Bcrypt Works (Behind the Scenes)

While Supabase handles the implementation, here's how bcrypt secures passwords:

```
Password: "MyPassword123"

Step 1: Generate random salt
Salt: $2a$10$abcdefghijklmnopqrst

Step 2: Hash password with salt (multiple iterations)
Hash: $2a$10$abcdefghijklmnopqrstuvwxyz123456

Step 3: Compare on login
Input hash: $2a$10$... (computed from input)
Stored hash: $2a$10$... (from database)
Match? → Login successful

Key: The same password hashed twice produces different bcrypt
hashes due to the random salt, but both still match!
```

This makes bcrypt resistant to:
- Rainbow table attacks (salting)
- Brute force attacks (slow hashing, ~100ms per attempt)
- Precomputation attacks (memory requirements)

---

## Environment Setup

Ensure these environment variables are configured:

```env
# .env.local (create if not exists)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Get these from your Supabase project settings:
1. Go to Project Settings → API
2. Copy "Project URL" → VITE_SUPABASE_URL
3. Copy "anon public" key → VITE_SUPABASE_ANON_KEY

---

## Testing Authentication

### Test Sign Up
```javascript
// Use test email: test+1@example.com
// Password: SecurePass123!
```

### Test Login
```javascript
// Email: test+1@example.com
// Password: SecurePass123!
```

### Test Password Validation
```javascript
// Too short: "pass"
// No special chars: "password123"
// Strong: "MyP@ssw0rd!"
```

### Test Error Cases
```javascript
// Invalid email: "notanemail"
// Wrong password: correct email, wrong password
// Non-existent account: unregistered email
```

---

## API Reference

### signUp(email, password, metadata?)

```javascript
const { data, error } = await signUp('user@example.com', 'SecurePass123!')
// Returns: { user: { id, email, ... }, session: { ... } }
```

### signIn(email, password)

```javascript
const { data, error } = await signIn('user@example.com', 'SecurePass123!')
// Returns: { user: { id, email, ... }, session: { ... } }
```

### signOut()

```javascript
await signOut()
// Logs out user, clears session
```

### resetPassword(email)

```javascript
await resetPassword('user@example.com')
// Sends reset email, no session created
```

### updatePassword(newPassword)

```javascript
await updatePassword('NewSecurePass123!')
// Updates password for current user
// Must be authenticated
```

---

## Further Reading

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Bcrypt Security](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Last Updated**: April 26, 2026
**Status**: Production Ready ✅
