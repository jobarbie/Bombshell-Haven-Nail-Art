import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400',
  'https://images.unsplash.com/photo-1633057170013-7792a2d8e0a3?w=400',
  'https://images.unsplash.com/photo-1522338243402-31f77bbddad5?w=400',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400',
  'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=400',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=80',
]

export default function NailGallery() {
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('nail_samples').select('*').order('created_at', { ascending: false })
        setSamples(data || [])
      } catch {
        setSamples([])
      }
      setLoading(false)
    }
    load()
  }, [])

  const displayImages = samples.length > 0
    ? samples.map((s) => ({ url: s.image_url, title: s.title }))
    : PLACEHOLDER_IMAGES.map((url, i) => ({ url, title: `Nail Art ${i + 1}` }))

  return (
    <div className="nail-gallery">
      {loading ? (
        <p>Loading gallery...</p>
      ) : (
        displayImages.map((item, i) => (
          <div key={i} className="gallery-item">
            <img src={item.url} alt={item.title || 'Nail sample'} />
          </div>
        ))
      )}
    </div>
  )
}
