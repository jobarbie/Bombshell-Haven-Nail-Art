import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Reliable placeholder image service URLs (picsum.photos)
const PLACEHOLDER_IMAGES = [
  'https://xznpfshxoxewmrzjrsot.supabase.co/storage/v1/object/public/images/35b3807b-fcfa-451e-88e5-965544a73638.jpg',
  'https://xznpfshxoxewmrzjrsot.supabase.co/storage/v1/object/public/images/444475f4-673a-42ce-afa2-7bde20af75a2.jpg',
  'https://xznpfshxoxewmrzjrsot.supabase.co/storage/v1/object/public/images/49344845-fb71-4f6c-9ec4-f7332154a031.jpg',
  'https://xznpfshxoxewmrzjrsot.supabase.co/storage/v1/object/public/images/5a3d2d88-ae46-40d7-a177-f04bb4579092.jpg',
  'https://xznpfshxoxewmrzjrsot.supabase.co/storage/v1/object/public/images/632fec03-8ad3-4e78-811c-98446280ecad.jpg',
  'https://xznpfshxoxewmrzjrsot.supabase.co/storage/v1/object/public/images/dde7834d-e2e9-4ea9-bdcd-3103fc21bbbb.jpg',
]

export default function NailGallery() {
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(new Set())

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('nail_samples').select('*').order('created_at', { ascending: false })
        setSamples(data || [])
      } catch {
        setSamples([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Pre-built list from Supabase with absolute fallbacks
  const baseImages = samples.length > 0
    ? samples.map((s, i) => ({
        id: s.id || i,
        url: s.image_url,
        fallback: PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length],
        title: s.title,
      }))
    : PLACEHOLDER_IMAGES.map((url, i) => ({
        id: i,
        url: url,
        fallback: PLACEHOLDER_IMAGES[(i + 1) % PLACEHOLDER_IMAGES.length],
        title: `Nail Art ${i + 1}`,
      }))

  function handleError(id) {
    setFailed((prev) => new Set(prev).add(id))
  }

  return (
    <div className="nail-gallery">
      {loading ? (
        <p>Loading gallery...</p>
      ) : (
        baseImages.map((item) => (
          <div
            key={item.id}
            className="gallery-item"
            style={{
              backgroundImage: `url(${failed.has(item.id) ? item.fallback : item.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <img
              src={failed.has(item.id) ? item.fallback : item.url}
              alt={item.title || 'Nail sample'}
              loading="lazy"
              onError={() => handleError(item.id)}
              style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }}
            />
            <span className="gallery-overlay">{item.title || 'Nail Art'}</span>
          </div>
        ))
      )}
    </div>
  )
}
