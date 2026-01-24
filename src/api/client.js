// frontend/src/api/client.js
import axios from "axios"
import { toast } from "sonner"

const API_BASE = "http://localhost:8000/api"
// const API_BASE ="https://api.nutryah.com/api"

const API = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 60_000,
})

const MUTATING = new Set(["post", "put", "patch", "delete"])

// Provider-only routes should NOT receive X-Tenant-Code
const NO_TENANT_PREFIXES = ["/master/", "/system/"]

function normalizePath(u) {
  try {
    let s = String(u || "")
    if (s.startsWith("http://") || s.startsWith("https://")) {
      return new URL(s).pathname
    }
    s = s.split("?")[0]
    s = "/" + s.replace(/^\/+/, "")
    return s
  } catch {
    return "/"
  }
}

const shouldSkipTenantHeader = (config) => {
  const path = normalizePath(config?.url)
  if (config?.meta?.skipTenantHeader) return true
  return NO_TENANT_PREFIXES.some((p) => path.startsWith(p))
}

const shouldSkipAuthHeader = (config) => !!config?.meta?.skipAuthHeader

// ---------------------
// Cancel detection (FIX)
// ---------------------
export function isCanceledError(e) {
  // axios v1 cancel / AbortController
  return (
    axios.isCancel?.(e) ||
    e?.code === "ERR_CANCELED" ||
    e?.name === "CanceledError" ||
    e?.name === "AbortError" ||
    (typeof e?.message === "string" && e.message.toLowerCase().includes("canceled"))
  )
}

// ---------------------
// Pretty + searchable logs
// ---------------------
function logApiError(error, userMsg) {
  const cfg = error?.config || {}
  const meta = cfg?.meta || {}
  const rid =
    cfg?.headers?.["X-Request-Id"] ||
    cfg?.headers?.["x-request-id"] ||
    error?.response?.headers?.["x-request-id"] ||
    null

  const method = String(cfg?.method || "get").toUpperCase()
  const fullUrl = (cfg?.baseURL || "") + (cfg?.url || "")
  const params = cfg?.params

  // searchable keyword: api_error
  console.groupCollapsed(
    `api_error: ${meta?.label || meta?.trace || "request"} | ${method} ${fullUrl}${rid ? ` | rid=${rid}` : ""
    }`
  )
  console.log("message:", userMsg)
  console.log("status:", error?.response?.status || null)
  console.log("params:", params || null)
  console.log("meta:", meta || null)
  console.log("raw_error:", error)
  console.groupEnd()
}

// ---------------------
// Client-side error reporting
// ---------------------
async function reportClientError(error, msg) {
  try {
    // ✅ DO NOT report canceled requests
    if (isCanceledError(error)) return

    const tenantCode = localStorage.getItem("tenant_code") || null

    let requestPayload = null
    try {
      if (error?.config?.data) {
        requestPayload =
          typeof error.config.data === "string"
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
      request_params: error?.config?.params || null,
      request_payload: requestPayload,
      response_payload: error?.response?.data || null,
      stack_trace: error?.stack || null,
      tenant_code: tenantCode,
      user_agent: navigator.userAgent,
      extra: { network: navigator.onLine ? "online" : "offline" },
    }

    await fetch(`${API_BASE}/system/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "include",
    })
  } catch (err) {
    // avoid infinite noise
    console.error("Failed to report client error", err)
  }
}

// ---------------------
// Attach token + tenant + request-id
// ---------------------
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  const tenantCode = localStorage.getItem("tenant_code")

  config.headers = config.headers || {}

  if (!shouldSkipAuthHeader(config) && token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (!shouldSkipTenantHeader(config) && tenantCode) {
    config.headers["X-Tenant-Code"] = tenantCode
  } else {
    if (config.headers["X-Tenant-Code"]) delete config.headers["X-Tenant-Code"]
  }

  // allow skipping request-id if you want
  if (!config?.meta?.skipRequestId) {
    if (!config.headers["X-Request-Id"]) {
      config.headers["X-Request-Id"] = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
  }

  return config
})

// ---------------------
// REFRESH TOKEN HELPER
// ---------------------
let currentRefreshPromise = null

export async function refreshAccessToken() {
  if (currentRefreshPromise) return currentRefreshPromise

  const tenantCode = localStorage.getItem("tenant_code") || null

  currentRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(tenantCode ? { "X-Tenant-Code": tenantCode } : {}),
        },
      })

      if (!res.ok) throw new Error(`Refresh failed with status ${res.status}`)
      const data = await res.json()

      if (data?.access_token) localStorage.setItem("access_token", data.access_token)
      return data?.access_token || null
    } finally {
      currentRefreshPromise = null
    }
  })()

  return currentRefreshPromise
}

// ---------------------
// Unified success + error handler + auto-refresh
// ---------------------
API.interceptors.response.use(
  (res) => {
    const cfg = res?.config || {}
    const meta = cfg?.meta || {}
    const method = String(cfg.method || "get").toLowerCase()

    // success toast only when explicitly requested
    if (!meta.silent && MUTATING.has(method) && meta.successToast) {
      if (typeof meta.successToast === "string" && meta.successToast.trim()) {
        toast.success(meta.successToast)
      } else if (meta.successToast === true) {
        const serverMsg = res?.data?.message || res?.data?.detail
        toast.success(
          typeof serverMsg === "string" && serverMsg.trim() ? serverMsg : "Saved successfully"
        )
      }
    }
    return res
  },
  async (error) => {
    const originalRequest = error?.config || {}
    const meta = originalRequest?.meta || {}

    // ✅ FIX 1: ignore AbortController/Cancel errors (no toast, no report)
    if (isCanceledError(error)) {
      // keep it reject so calling code can silently stop if it wants
      return Promise.reject(error)
    }

    // ✅ FIX 2: timeout detection (axios)
    const isTimeout =
      error?.code === "ECONNABORTED" ||
      (typeof error?.message === "string" && error.message.toLowerCase().includes("timeout"))

    // ✅ FIX 3: network/server unreachable (no response)
    if (!error?.response) {
      const msg = isTimeout
        ? "Request timeout. Server is slow or unreachable."
        : navigator.onLine
          ? "Network error / Server unreachable"
          : "You are offline"

      if (!meta.silentError) toast.error(msg)
      logApiError(error, msg)
      reportClientError(error, msg)
      return Promise.reject(error)
    }

    const status = error.response.status
    const data = error.response.data
    const path = normalizePath(originalRequest?.url)
    const isAuthRoute = path.startsWith("/auth/login") || path.startsWith("/auth/refresh")

    // ---------------- 401 => try refresh ----------------
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
        console.error("Refresh token flow failed", refreshErr)
      }
      localStorage.removeItem("access_token")
    }

    // ---------------- build message ----------------
    const detail = data?.detail
    const wrappedMsg = data?.error?.msg || data?.message // supports your ok/err wrapper
    let msg = "Unexpected error"

    if (Array.isArray(detail)) {
      msg = detail
        .map((e) => {
          const loc = Array.isArray(e.loc) ? e.loc.join(".") : e.loc
          return `${loc}: ${e.msg}`
        })
        .join("\n")
    } else if (typeof wrappedMsg === "string" && wrappedMsg.trim()) {
      msg = wrappedMsg
    } else if (typeof detail === "string" && detail.trim()) {
      msg = detail
    } else if (status === 403) msg = "Forbidden"
    else if (status === 404) msg = "Not found"
    else if (status === 429) msg = "Too many requests, try again"
    else if (status >= 500) msg = "Server error"
    else if (error?.message) msg = error.message

    if (!meta.silentError) toast.error(msg)
    logApiError(error, msg)
    reportClientError(error, msg)

    return Promise.reject(error)
  }
)

export default API
