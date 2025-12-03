// frontend/src/api/client.js
import axios from 'axios'
import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
// const API_BASE =  import.meta.env.VITE_API_URL || 'https://api.nutryah.com/api'


const API = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

// ---------------- Attach token + tenant ----------------
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  const tenantCode = localStorage.getItem('tenant_code')

  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  if (tenantCode) {
    config.headers = config.headers || {}
    config.headers['X-Tenant-Code'] = tenantCode
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
      extra: {
        network: navigator.onLine ? 'online' : 'offline',
      },
    }

    // Use fetch directly to avoid interceptor recursion
    await fetch(`${API_BASE}/system/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch (err) {
    console.error('Failed to report client error', err)
  }
}

// ---------------- REFRESH TOKEN HELPER ----------------

let currentRefreshPromise = null

/**
 * Hit /auth/refresh to get a new access token.
 * Assumes refresh token is in HTTP-only cookie (withCredentials).
 */
export async function refreshAccessToken() {
  if (currentRefreshPromise) {
    // If a refresh is already in progress, reuse it
    return currentRefreshPromise
  }

  const tenantCode = localStorage.getItem('tenant_code') || null

  currentRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // send refresh cookie
        headers: {
          'Content-Type': 'application/json',
          ...(tenantCode ? { 'X-Tenant-Code': tenantCode } : {}),
        },
      })

      if (!res.ok) {
        throw new Error(`Refresh failed with status ${res.status}`)
      }

      const data = await res.json()

      if (data?.access_token) {
        localStorage.setItem('access_token', data.access_token)
      }

      return data?.access_token || null
    } finally {
      // clear promise so next refresh can start fresh
      currentRefreshPromise = null
    }
  })()

  return currentRefreshPromise
}

// ---------------- Unified error handler + auto-refresh ----------------

API.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status
    const data = error?.response?.data
    const originalRequest = error.config || {}

    // 1) Handle 401 with refresh-then-retry (only once per request)
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const newToken = await refreshAccessToken()
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newToken}`

          // Retry original API call with new token
          return API(originalRequest)
        }
      } catch (refreshErr) {
        console.error('Refresh token flow failed', refreshErr)
        // fall through to logout + error handling
      }

      // If we reach here, refresh failed => clear auth
      localStorage.clear()
      delete API.defaults.headers?.common?.Authorization
    }

    // 2) Build human message for toast
    const detail = data?.detail
    let msg = 'Unexpected error'

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

    console.error('API error:', status, data)
    toast.error(msg)

    // 3) send details to backend error logger
    reportClientError(error, msg)

    return Promise.reject(error)
  },
)

export default API
