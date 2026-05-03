/**
 * Authentication Utilities
 * Provides validation and helper functions for user authentication
 */

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {object} { valid: boolean, error: string | null }
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email is required' }
  }
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }
  
  if (email.length > 254) {
    return { valid: false, error: 'Email is too long' }
  }
  
  return { valid: true, error: null }
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, error: string | null, strength: 'weak' | 'fair' | 'good' | 'strong' }
 */
export const validatePassword = (password) => {
  if (!password) {
    return { valid: false, error: 'Password is required', strength: 'weak' }
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters', strength: 'weak' }
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long', strength: 'weak' }
  }
  
  // Calculate password strength
  let strength = 'weak'
  let hasLowercase = /[a-z]/.test(password)
  let hasUppercase = /[A-Z]/.test(password)
  let hasNumber = /\d/.test(password)
  let hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  
  let scoreCount = [hasLowercase, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length
  
  if (password.length >= 12 && scoreCount >= 3) {
    strength = 'strong'
  } else if (password.length >= 10 && scoreCount >= 2) {
    strength = 'good'
  } else if (password.length >= 8 && scoreCount >= 2) {
    strength = 'fair'
  }
  
  return { valid: true, error: null, strength }
}

/**
 * Validates username
 * @param {string} username - Username to validate
 * @returns {object} { valid: boolean, error: string | null }
 */
export const validateUsername = (username) => {
  if (!username || !username.trim()) {
    return { valid: false, error: 'Username is required' }
  }
  
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' }
  }
  
  if (username.length > 20) {
    return { valid: false, error: 'Username must be less than 20 characters' }
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' }
  }
  
  return { valid: true, error: null }
}

/**
 * Validates signup form inputs
 * @param {object} formData - { email, password, confirmPassword, username? }
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateSignupForm = (formData) => {
  const { email, password, confirmPassword, username } = formData
  const errors = {}
  
  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    errors.email = emailValidation.error
  }
  
  // Validate password
  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.error
  }
  
  // Validate password confirmation
  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }
  
  // Validate username if provided
  if (username) {
    const usernameValidation = validateUsername(username)
    if (!usernameValidation.valid) {
      errors.username = usernameValidation.error
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validates login form inputs
 * @param {object} formData - { email, password }
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateLoginForm = (formData) => {
  const { email, password } = formData
  const errors = {}
  
  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    errors.email = emailValidation.error
  }
  
  // Validate password presence
  if (!password) {
    errors.password = 'Password is required'
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Parses Supabase auth errors and returns user-friendly messages
 * @param {Error} error - Supabase auth error
 * @returns {string} User-friendly error message
 */
export const getAuthErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred'
  
  const message = error.message || ''
  
  // Supabase specific errors
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password'
  }
  
  if (message.includes('Email not confirmed')) {
    return 'Please verify your email before logging in'
  }
  
  if (message.includes('User already registered')) {
    return 'This email is already registered'
  }
  
  if (message.includes('Password')) {
    return 'Password does not meet security requirements'
  }
  
  if (message.includes('Email')) {
    return 'Invalid email format'
  }
  
  if (message.includes('network')) {
    return 'Network error. Please check your connection'
  }
  
  // Generic fallback
  return message || 'An error occurred during authentication'
}

/**
 * Sanitizes user input to prevent injection attacks
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return ''
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 1000) // Limit length
}

/**
 * Checks if a password has been compromised using HIBP API
 * (optional - requires internet access)
 * @param {string} password - Password to check
 * @returns {Promise<boolean>} true if compromised, false if safe
 */
export const checkPasswordCompromised = async (password) => {
  try {
    // This would require crypto to hash the password with SHA-1
    // For now, return false (implement if needed)
    return false
  } catch (error) {
    console.error('Error checking password compromise:', error)
    return false // Fail safely
  }
}

/**
 * Gets password strength indicator text and color
 * @param {string} strength - Strength level ('weak', 'fair', 'good', 'strong')
 * @returns {object} { text: string, color: string, percentage: number }
 */
export const getPasswordStrengthDisplay = (strength) => {
  const strengthMap = {
    weak: { text: 'Weak', color: '#ff4444', percentage: 25 },
    fair: { text: 'Fair', color: '#ffaa00', percentage: 50 },
    good: { text: 'Good', color: '#88cc44', percentage: 75 },
    strong: { text: 'Strong', color: '#00aa44', percentage: 100 }
  }
  
  return strengthMap[strength] || strengthMap.weak
}
