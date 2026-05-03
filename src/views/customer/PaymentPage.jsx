import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const DOWNPAYMENT_AMOUNT = 300
const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png']
const MAX_FILE_SIZE_MB = 5
const MAX_WIDTH = 1200
const MAX_HEIGHT = 1200
const JPEG_QUALITY = 0.85

/**
 * Compress and resize an image using HTML5 Canvas.
 * Returns a Blob (JPEG) that can be uploaded directly.
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Image compression failed'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = url
  })
}

function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase()
}

function isValidImageFile(file) {
  if (!file) return false
  const ext = getFileExtension(file.name)
  return ALLOWED_TYPES.includes(file.type) && ALLOWED_EXTENSIONS.includes(ext)
}

export default function PaymentPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [screenshot, setScreenshot] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // If no booking info passed, redirect home
  if (!state?.bookingId) {
    navigate('/')
    return null
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Strict validation
    if (!isValidImageFile(file)) {
      setError('Please upload a valid image file (JPG, JPEG, or PNG only).')
      setScreenshot(null)
      setPreviewUrl(null)
      return
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size must be less than ${MAX_FILE_SIZE_MB}MB.`)
      setScreenshot(null)
      setPreviewUrl(null)
      return
    }

    setError('')
    setScreenshot(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!screenshot) {
      setError('Please upload your GCash payment screenshot.')
      return
    }

    if (!user?.id) {
      setError('You must be logged in to submit payment proof.')
      return
    }

    setUploading(true)
    setError('')

    try {
      // 1. Compress image before upload
      let fileToUpload
      try {
        fileToUpload = await compressImage(screenshot)
      } catch (compressErr) {
        console.warn('Compression failed, uploading original:', compressErr)
        fileToUpload = screenshot
      }

      // 2. Generate optimized filename: {user_id}/{timestamp}_{bookingId}.jpg
      const timestamp = Date.now()
      const fileName = `${timestamp}_${state.bookingId}.jpg`
      const filePath = `${user.id}/${fileName}`

      // 3. Upload to Supabase Storage (payment-proofs bucket)
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, fileToUpload, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        setError('Failed to upload screenshot: ' + uploadError.message)
        setUploading(false)
        return
      }

      // 4. Get the public URL for the uploaded file (bucket is now PUBLIC)
      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath)

      const imageUrl = urlData?.publicUrl

      if (!imageUrl) {
        setError('Failed to retrieve public URL for uploaded image.')
        setUploading(false)
        return
      }

      // 5. Update the bookings row with payment proof URL and status
      // RLS policy will handle security; we don't restrict by customer_id here
      // so anonymous bookings (customer_id IS NULL) can also upload
      const { error: dbError } = await supabase
        .from('bookings')
        .update({
          payment_proof_url: imageUrl,
          payment_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', state.bookingId)

      if (dbError) {
        console.error('Database update error:', dbError)
        // Attempt to clean up the uploaded file
        await supabase.storage.from('payment-proofs').remove([filePath])
        setError('Failed to save payment proof: ' + dbError.message)
        setUploading(false)
        return
      }

      setSubmitted(true)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  if (submitted) {
    return (
      <section className="payment-page">
        <div className="payment-success">
          <h2>✅ Payment Submitted!</h2>
          <p>Your downpayment proof has been received. The nail tech will verify it shortly.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Go to Home</button>
        </div>
      </section>
    )
  }

  return (
    <section className="payment-page">
      <h1>Downpayment</h1>
      <p className="payment-intro">
        Please pay the required downpayment of <strong>₱{DOWNPAYMENT_AMOUNT}</strong> via GCash to confirm your booking.
      </p>

      <div className="payment-card">
        <h2>Scan QR Code</h2>
        <p className="payment-name">Bombshell Haven</p>

        <div className="qr-wrapper">
          <img
            src="/gcash-qr.png"
            alt="GCash QR Code"
            className="qr-code"
          />
        </div>

        <p className="payment-amount">Amount: <strong>₱{DOWNPAYMENT_AMOUNT}</strong></p>

        <div className="payment-steps">
          <p>How to pay:</p>
          <ol>
            <li>Open your GCash app</li>
            <li>Tap <strong>Scan QR</strong></li>
            <li>Scan the QR code above</li>
            <li>Enter <strong>₱{DOWNPAYMENT_AMOUNT}</strong> as the amount</li>
            <li>Take a screenshot of your payment confirmation</li>
            <li>Upload the screenshot below</li>
          </ol>
        </div>
      </div>

      <div className="payment-upload">
        <h3>Upload Payment Screenshot</h3>
        <p className="file-hint">
          Accepted formats: <strong>JPG, JPEG, PNG</strong> (max {MAX_FILE_SIZE_MB}MB)
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={uploading}
        />

        {previewUrl && (
          <div className="preview-wrapper">
            <p>Preview:</p>
            <img
              src={previewUrl}
              alt="Payment proof preview"
              className="screenshot-preview"
            />
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={uploading || !screenshot}
        >
          {uploading ? 'Submitting...' : 'Submit Payment Proof'}
        </button>
      </div>
    </section>
  )
}

