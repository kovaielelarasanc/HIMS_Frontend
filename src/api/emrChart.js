// FILE: frontend/src/api/emrChart.js
// Centralized EMR Chart + Export APIs (production-safe, fixes max_downloads ge=1 validation)

import { unwrapApi } from "./_unwrap"
import API from "./client" // axios instance

// -----------------------
// Small utils
// -----------------------
function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "")
}

function toAbsolute(url) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  if (!origin) return url
  if (url.startsWith("/")) return `${origin}${url}`
  return `${origin}/${url}`
}

function getApiBaseAbsolute() {
  // API.defaults.baseURL typically: "/api" or "http://localhost:8000/api"
  const base = stripTrailingSlash(API?.defaults?.baseURL || "/api")
  return toAbsolute(base)
}

function parseFilenameFromContentDisposition(cd) {
  if (!cd) return ""
  const s = String(cd)

  // filename*=UTF-8''something.pdf
  let m = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(s)
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1].replace(/["']/g, "").trim())
    } catch {
      return m[1].replace(/["']/g, "").trim()
    }
  }

  // filename="something.pdf"
  m = /filename\s*=\s*"([^"]+)"/i.exec(s)
  if (m?.[1]) return m[1].trim()

  // filename=something.pdf
  m = /filename\s*=\s*([^;]+)/i.exec(s)
  if (m?.[1]) return m[1].replace(/["']/g, "").trim()

  return ""
}

function safeInt(v, fallback = 0) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
}

function clampInt(v, min, max) {
  const n = safeInt(v, min)
  return Math.max(min, Math.min(max, n))
}


/**
 * ✅ IMPORTANT FIX:
 * Your backend currently validates:
 *   max_downloads >= 1   (ge=1)
 *
 * Your UI uses:
 *   max_downloads: 0  => unlimited
 *
 * So we normalize here:
 *   0 or negative -> 2147483647 (practically unlimited for INT)
 *   >=1          -> keep (clamped)
 */
function normalizeSharePayload(payload, opts = {}) {
  const mode = opts.mode || "defaults" // "defaults" | "max"
  const p = payload && typeof payload === "object" ? { ...payload } : {}

  // expires_in_days
  if ("expires_in_days" in p) {
    const raw = safeInt(p.expires_in_days, 0)
    if (raw <= 0) {
      if (mode === "max") p.expires_in_days = 365
      else delete p.expires_in_days // use backend default (7)
    } else {
      p.expires_in_days = clampInt(raw, 1, 365)
    }
  }

  // max_downloads
  if ("max_downloads" in p) {
    const raw = safeInt(p.max_downloads, 0)
    if (raw <= 0) {
      if (mode === "max") p.max_downloads = 1000
      else delete p.max_downloads // use backend default (5)
    } else {
      p.max_downloads = clampInt(raw, 1, 1000)
    }
  }

  return p
}

/**
 * Trigger browser download for a Blob
 */
export function triggerDownloadBlob(blob, filename = "download.pdf") {
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function openBlobInNewTab(blob, { filename = "document.pdf", print = false } = {}) {
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const w = window.open(url, "_blank", "noopener,noreferrer")
  if (!w) {
    // popup blocked -> download
    triggerDownloadBlob(blob, filename)
    URL.revokeObjectURL(url)
    return false
  }

  // best-effort print (not guaranteed in all browsers)
  if (print) {
    setTimeout(() => {
      try {
        w.focus()
        w.print()
      } catch {
        // ignore
      }
    }, 500)
  }

  // revoke later
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}

// -----------------------
// EMR CHART
// -----------------------
export async function getPatientChart(patientId, params = {}, signal) {
  const res = await API.get(`/emr/patients/${patientId}/chart`, { params, signal })
  return unwrapApi(res.data)
}

export async function getEmrRecord(recordId, signal) {
  const res = await API.get(`/emr/records/${recordId}`, { signal })
  return unwrapApi(res.data)
}

/**
 * Patient Summary API (you said you will create it)
 * Recommended backend route: GET /api/patients/{patient_id}/summary
 */
export async function getEmrPatientSummary(patientId, signal) {
  const res = await API.get(`/patients/${patientId}/summary`, { signal })
  return unwrapApi(res.data)
}

/**
 * Dynamic filter options
 */
export async function listEmrDepartments(params = {}, signal) {
  const res = await API.get(`/emr/departments`, { params, signal })
  return unwrapApi(res.data)
}

export async function listEmrRecordTypes(params = {}, signal) {
  const res = await API.get(`/emr/record-types`, { params, signal })
  return unwrapApi(res.data)
}



export async function listEmrPatientEncounters(patientId, params = {}, signal) {
  const res = await API.get(`/emr/patients/${patientId}/encounters`, { params, signal })
  return unwrapApi(res.data)
}

export async function listEmrRecords(params = {}, signal) {
  const res = await API.get(`/emr/records`, { params, signal })
  return unwrapApi(res.data)
}

// -----------------------
// EXPORTS / BUNDLES
// -----------------------
export async function exportCreateBundle(payload, signal) {
  const res = await API.post(`/emr/exports/bundles`, payload || {}, { signal })
  return unwrapApi(res.data)
}

export async function exportUpdateBundle(bundleId, payload, signal) {
  const res = await API.put(`/emr/exports/bundles/${bundleId}`, payload || {}, { signal })
  return unwrapApi(res.data)
}

export async function exportGenerateBundle(bundleId, payload = {}, signal) {
  const res = await API.post(`/emr/exports/bundles/${bundleId}/generate`, payload || {}, { signal })
  return unwrapApi(res.data)
}

/**
 * ✅ FIXED: normalizes max_downloads so backend ge=1 won't fail
 * UI can send max_downloads: 0 for unlimited
 */
export async function exportShareBundle(bundleId, payload, signal) {
  // If you want "unlimited-like", change mode to "max"
  const normalized = normalizeSharePayload(payload || {}, { mode: "max" })
  const res = await API.post(`/emr/exports/bundles/${bundleId}/share`, normalized, { signal })
  return unwrapApi(res.data)
}

export async function exportRevokeShare(shareId, signal) {
  const res = await API.post(`/emr/exports/shares/${shareId}/revoke`, {}, { signal })
  return unwrapApi(res.data)
}

export async function exportGetBundleAudit(bundleId, params = {}, signal) {
  const res = await API.get(`/emr/exports/bundles/${bundleId}/audit`, { params, signal })
  return unwrapApi(res.data)
}

// -----------------------
// PUBLIC PDF DOWNLOAD (Share Token)
// -----------------------
export async function downloadSharePdfBlob(token, signal) {
  const res = await API.get(`/emr/exports/share/${encodeURIComponent(String(token || ""))}`, {
    responseType: "blob",
    signal,
  })

  const cd =
    res?.headers?.["content-disposition"] ||
    res?.headers?.["Content-Disposition"] ||
    res?.headers?.["Content-disposition"]

  const filename = parseFilenameFromContentDisposition(cd) || "export.pdf"
  const blob = res.data

  return { blob, filename }
}

/**
 * For showing/copying share URL in UI
 */
export function getShareDownloadUrl(token, { absolute = true } = {}) {
  const rel = `/emr/exports/share/${encodeURIComponent(String(token || ""))}`
  if (!absolute) return rel
  return `${getApiBaseAbsolute()}${rel}`
}
