// frontend/src/api/client.js
import axios from 'axios'
import { toast } from 'sonner'

// const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.nutryah.com/api'

const API = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 60_000,
})

const MUTATING = new Set(['post', 'put', 'patch', 'delete'])

// Provider-only routes should NOT receive X-Tenant-Code
const NO_TENANT_PREFIXES = ['/master/', '/system/']
// If you want also block auth endpoints:
// const NO_TENANT_PREFIXES = ['/master/', '/system/', '/auth/']

function normalizePath(u) {
  try {
    let s = String(u || '')
    // if full URL comes (rare), strip to pathname
    if (s.startsWith('http://') || s.startsWith('https://')) {
      return new URL(s).pathname
    }
    // remove querystring for safe prefix checks
    s = s.split('?')[0]
    // force leading slash
    s = '/' + s.replace(/^\/+/, '')
    return s
  } catch {
    return '/'
  }
}

const shouldSkipTenantHeader = (config) => {
  const path = normalizePath(config?.url)
  if (config?.meta?.skipTenantHeader) return true
  return NO_TENANT_PREFIXES.some((p) => path.startsWith(p))
}

const shouldSkipAuthHeader = (config) => {
  return !!config?.meta?.skipAuthHeader
}

// ---------------- Attach token + tenant ----------------
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  const tenantCode = localStorage.getItem('tenant_code')

  config.headers = config.headers || {}

  // Attach auth unless explicitly skipped
  if (!shouldSkipAuthHeader(config) && token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Attach tenant unless provider/system route
  if (!shouldSkipTenantHeader(config) && tenantCode) {
    config.headers['X-Tenant-Code'] = tenantCode
  } else {
    if (config.headers['X-Tenant-Code']) delete config.headers['X-Tenant-Code']
  }

  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  return config
})

// ---------------- Client-side error reporting ----------------
async function reportClientError(error, msg) {
  try {
    const tenantCode = localStorage.getItem('tenant_code') || null

    let requestPayload = null
    try {
      if (error?.config?.data) {
        requestPayload =
          typeof error.config.data === 'string'
            ? JSON.parse(error.config.data)
            : error.config.data
      }
    } catch {
      requestPayload = { raw: error?.config?.data }
    }

    const payload = {
      message: msg,
      page_url: window.location.href,
      request_url: error?.config?.url || null,
      request_method: error?.config?.method || null,
      http_status: error?.response?.status || null,
      request_payload: requestPayload,
      response_payload: error?.response?.data || null,
      stack_trace: error?.stack || null,
      tenant_code: tenantCode,
      user_agent: navigator.userAgent,
      extra: { network: navigator.onLine ? 'online' : 'offline' },
    }

    await fetch(`${API_BASE}/system/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'include',
    })
  } catch (err) {
    console.error('Failed to report client error', err)
  }
}

// ---------------- REFRESH TOKEN HELPER ----------------
let currentRefreshPromise = null

export async function refreshAccessToken() {
  if (currentRefreshPromise) return currentRefreshPromise

  const tenantCode = localStorage.getItem('tenant_code') || null

  currentRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantCode ? { 'X-Tenant-Code': tenantCode } : {}),
        },
      })

      if (!res.ok) throw new Error(`Refresh failed with status ${res.status}`)
      const data = await res.json()

      if (data?.access_token) localStorage.setItem('access_token', data.access_token)
      return data?.access_token || null
    } finally {
      currentRefreshPromise = null
    }
  })()

  return currentRefreshPromise
}

// ---------------- Unified success + error handler + auto-refresh ----------------
API.interceptors.response.use(
  (res) => {
    const cfg = res?.config || {}
    const meta = cfg?.meta || {}
    const method = String(cfg.method || 'get').toLowerCase()

    if (!meta.silent && MUTATING.has(method) && meta.successToast) {
      if (typeof meta.successToast === 'string' && meta.successToast.trim()) {
        toast.success(meta.successToast)
      } else if (meta.successToast === true) {
        const serverMsg = res?.data?.message || res?.data?.detail
        toast.success(
          typeof serverMsg === 'string' && serverMsg.trim()
            ? serverMsg
            : 'Saved successfully',
        )
      }
    }
    return res
  },
  async (error) => {
    const status = error?.response?.status
    const data = error?.response?.data
    const originalRequest = error.config || {}
    const meta = originalRequest?.meta || {}

    if (!error?.response) {
      const msg = navigator.onLine ? 'Network error / Server unreachable' : 'You are offline'
      if (!meta.silentError) toast.error(msg)
      reportClientError(error, msg)
      return Promise.reject(error)
    }

    const path = normalizePath(originalRequest?.url)
    const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/refresh')

    if (status === 401 && !isAuthRoute && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const newToken = await refreshAccessToken()
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return API(originalRequest)
        }
      } catch (refreshErr) {
        console.error('Refresh token flow failed', refreshErr)
      }
      localStorage.removeItem('access_token')
    }

    const detail = data?.detail
    let msg = 'Unexpected error'

    if (status === 403) msg = typeof detail === 'string' ? detail : 'Forbidden'
    if (status === 404) msg = typeof detail === 'string' ? detail : 'Not found'
    if (status === 429) msg = typeof detail === 'string' ? detail : 'Too many requests, try again'
    if (status >= 500) msg = typeof detail === 'string' ? detail : 'Server error'

    if (Array.isArray(detail)) {
      msg = detail
        .map((e) => {
          const loc = Array.isArray(e.loc) ? e.loc.join('.') : e.loc
          return `${loc}: ${e.msg}`
        })
        .join('\n')
    } else if (typeof detail === 'string') {
      msg = detail
    } else if (typeof data?.message === 'string') {
      msg = data.message
    } else if (error?.message) {
      msg = error.message
    }

    if (!meta.silentError) toast.error(msg)
    reportClientError(error, msg)

    return Promise.reject(error)
  },
)

export default API
