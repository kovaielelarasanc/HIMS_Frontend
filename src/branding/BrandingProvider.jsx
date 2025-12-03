// FILE: frontend/src/branding/BrandingProvider.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getPublicBranding, getBranding } from '../api/settings'

const BrandingContext = createContext({
  branding: null,
  setBranding: () => { },
  loading: true,
})

// API base from env (e.g. http://localhost:8000/api or https://api.nutryah.com/api)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
// -> strip trailing "/api" to get backend root (where /media is served)
const BACKEND_ROOT = API_BASE.replace(/\/api\/?$/, '')

/**
 * Make an absolute URL for media.
 * - If already http(s), return as-is.
 * - If starts with "//", prefix current protocol.
 * - Otherwise treat as path on BACKEND_ROOT (e.g. /media/...).
 */
function makeAbs(urlOrPath) {
  if (!urlOrPath) return undefined
  const v = String(urlOrPath).trim()
  if (!v) return undefined
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('//')) return `${window.location.protocol}${v}`

  // Ensure leading slash
  const rel = v.startsWith('/') ? v : `/${v}`
  return `${BACKEND_ROOT}${rel}`
}

/**
 * Normalise raw branding payload from backend into a shape
 * that:
 *  - NEVER has null for color fields
 *  - Always has absolute *_url fields for images.
 */
function normalizeBranding(raw) {
  if (!raw) return null
  const b = { ...raw }

  // -------- COLORS: FRONTEND DEFAULTS --------
  // Primary theme
  b.primary_color = b.primary_color || '#2563eb'
  b.primary_color_dark = b.primary_color_dark || null

  // Layout backgrounds
  b.sidebar_bg_color = b.sidebar_bg_color || '#ffffff'
  b.content_bg_color = b.content_bg_color || '#f9fafb'
  b.card_bg_color = b.card_bg_color || '#ffffff'
  b.border_color = b.border_color || '#e5e7eb'

  // Text colors
  b.text_color = b.text_color || '#111827'           // main text (sidebar)
  b.text_muted_color = b.text_muted_color || '#e5e7eb' // topbar text (muted)

  // Icon colors
  b.icon_color = b.icon_color || b.text_color || '#2563eb'
  b.icon_bg_color = b.icon_bg_color || 'rgba(37,99,235,0.08)'

  // -------- LOGOS / ICONS (URLs) --------

  // logo
  if (b.logo_path && !b.logo_url) {
    b.logo_url = makeAbs(`/media/${String(b.logo_path).replace(/^\/+/, '')}`)
  } else if (b.logo_url) {
    b.logo_url = makeAbs(b.logo_url)
  }

  // login logo
  if (b.login_logo_path && !b.login_logo_url) {
    b.login_logo_url = makeAbs(
      `/media/${String(b.login_logo_path).replace(/^\/+/, '')}`,
    )
  } else if (b.login_logo_url) {
    b.login_logo_url = makeAbs(b.login_logo_url)
  }

  // favicon
  if (b.favicon_path && !b.favicon_url) {
    b.favicon_url = makeAbs(
      `/media/${String(b.favicon_path).replace(/^\/+/, '')}`,
    )
  } else if (b.favicon_url) {
    b.favicon_url = makeAbs(b.favicon_url)
  }

  // pdf header/footer
  if (b.pdf_header_path && !b.pdf_header_url) {
    b.pdf_header_url = makeAbs(
      `/media/${String(b.pdf_header_path).replace(/^\/+/, '')}`,
    )
  } else if (b.pdf_header_url) {
    b.pdf_header_url = makeAbs(b.pdf_header_url)
  }

  if (b.pdf_footer_path && !b.pdf_footer_url) {
    b.pdf_footer_url = makeAbs(
      `/media/${String(b.pdf_footer_path).replace(/^\/+/, '')}`,
    )
  } else if (b.pdf_footer_url) {
    b.pdf_footer_url = makeAbs(b.pdf_footer_url)
  }

  return b
}

export function BrandingProvider({ children }) {
  const [branding, _setBranding] = useState(null)
  const [loading, setLoading] = useState(true)

  // Public setter for other components (always normalized)
  const setBranding = (valueOrUpdater) => {
    if (typeof valueOrUpdater === 'function') {
      _setBranding((prev) => normalizeBranding(valueOrUpdater(prev)))
    } else {
      _setBranding(normalizeBranding(valueOrUpdater))
    }
  }

  useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        // 1) Try public branding (works for ALL users)
        let data
        try {
          const res = await getPublicBranding()
          data = res.data
        } catch (err) {
          // Fallback: old backend or route missing
          console.warn(
            'Public branding failed, falling back to /settings/ui-branding',
            err,
          )
          const res = await getBranding()
          data = res.data
        }

        if (!alive) return

        console.log('[BrandingProvider] raw branding from API:', data)

        const norm = normalizeBranding(data)
        console.log('[BrandingProvider] normalized branding:', norm)

        _setBranding(norm)
      } catch (err) {
        console.error('Failed to load branding', err)
        toast.error('Failed to load customization settings')
      } finally {
        if (alive) setLoading(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [])

  return (
    <BrandingContext.Provider value={{ branding, setBranding, loading }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
