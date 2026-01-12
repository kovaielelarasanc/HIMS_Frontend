import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useLocation } from "react-router-dom"
import { getPublicBranding } from "../api/settings"

const BrandingContext = createContext({
  get: () => null,
  set: () => { },
  ensure: async () => { },
  refresh: async () => { },
  loading: true,
})

/**
 * NO ENV solution:
 * 1) Prefer same-origin backend: <current-origin>/api
 * 2) If frontend is Vite dev (:5173), assume backend is :8000
 * 3) If frontend already served by backend, same-origin will work.
 */
function resolveApiBase() {
  const { origin, hostname, protocol, port } = window.location

  // If you are running vite dev server, backend is typically 8000
  if (port === "5173" || port === "5174" || port === "3000") {
    return `${protocol}//${hostname}:8000/api`
  }

  // Otherwise assume backend served from same origin
  return `${origin}/api`
}




const API_BASE = resolveApiBase()
console.log(API_BASE);
const BACKEND_ROOT = API_BASE.replace(/\/api\/?$/, "")

function makeAbs(urlOrPath) {
  if (!urlOrPath) return undefined
  const v = String(urlOrPath).trim()
  if (!v) return undefined
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith("//")) return `${window.location.protocol}${v}`
  const rel = v.startsWith("/") ? v : `/${v}`
  return `${BACKEND_ROOT}${rel}`
}

function withBust(url, version) {
  if (!url) return url
  const v = version ? encodeURIComponent(String(version)) : ""
  if (!v) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}v=${v}`
}

function ensureMediaAbs(b, keyUrl, keyPath, ver) {
  // If backend returned *_url use it, else derive from *_path
  let u = b[keyUrl]
  if (!u && b[keyPath]) {
    u = `/media/${String(b[keyPath]).replace(/^\/+/, "")}`
  }
  b[keyUrl] = u ? withBust(makeAbs(u), ver) : null
}

function normalizeBranding(raw) {
  if (!raw) return null
  const b = { ...raw }

  // ---- colors (safe defaults) ----
  b.primary_color = b.primary_color || "#2563eb"
  b.primary_color_dark = b.primary_color_dark || null

  b.sidebar_bg_color = b.sidebar_bg_color || "#ffffff"
  b.content_bg_color = b.content_bg_color || "#f9fafb"
  b.card_bg_color = b.card_bg_color || "#ffffff"
  b.border_color = b.border_color || "#e5e7eb"

  b.text_color = b.text_color || "#111827"
  b.text_muted_color = b.text_muted_color || "#6b7280"

  b.icon_color = b.icon_color || b.text_color
  b.icon_bg_color = b.icon_bg_color || "rgba(37,99,235,0.08)"

  // ---- cache bust ----
  const ver = b.asset_version || b.updated_at || ""

  // ---- media urls -> absolute + cache bust ----
  ensureMediaAbs(b, "logo_url", "logo_path", ver)
  ensureMediaAbs(b, "login_logo_url", "login_logo_path", ver)
  ensureMediaAbs(b, "favicon_url", "favicon_path", ver)
  ensureMediaAbs(b, "pdf_header_url", "pdf_header_path", ver)
  ensureMediaAbs(b, "pdf_footer_url", "pdf_footer_path", ver)
  ensureMediaAbs(b, "letterhead_url", "letterhead_path", ver)

  return b
}

export function BrandingProvider({ children }) {
  const [cache, setCache] = useState({}) // { default: branding, pharmacy: branding, ... }
  const [loading, setLoading] = useState(true)
  const inflight = useRef({}) // context -> promise

  const set = (context, valueOrUpdater) => {
    const code = context || "default"
    setCache((prev) => {
      const current = prev[code] || null
      const next = typeof valueOrUpdater === "function" ? valueOrUpdater(current) : valueOrUpdater
      return { ...prev, [code]: normalizeBranding(next) }
    })
  }

  const get = (context) => cache[context || "default"] || null

  const ensure = async (context) => {
    const code = context || "default"
    if (get(code)) return

    if (inflight.current[code]) return inflight.current[code]

    inflight.current[code] = (async () => {
      // getPublicBranding should call /settings/ui-branding/public?context=...
      const res = await getPublicBranding(code === "default" ? undefined : code)
      set(code, res.data)
    })().finally(() => {
      inflight.current[code] = null
    })

    return inflight.current[code]
  }

  const refresh = async (context) => {
    const code = context || "default"
    const res = await getPublicBranding(code === "default" ? undefined : code)
    set(code, res.data)
  }

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          await ensure("default")
        } catch (err) {
          console.error("Failed to load branding", err)
          toast.error("Failed to load branding")
        } finally {
          if (alive) setLoading(false)
        }
      })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(() => ({ get, set, ensure, refresh, loading }), [cache, loading])

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding(contextCode) {
  const ctx = useContext(BrandingContext)
  const code = contextCode || "default"
  const branding = ctx.get(code)

  useEffect(() => {
    if (!branding) ctx.ensure(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return {
    branding,
    setBranding: (valueOrUpdater) => ctx.set(code, valueOrUpdater),
    refreshBranding: () => ctx.refresh(code),
    loading: ctx.loading && !branding,
  }
}

export function useRouteBranding() {
  const { pathname } = useLocation()
  const context = pathname.startsWith("/pharmacy") ? "pharmacy" : "default"
  return useBranding(context)
}
