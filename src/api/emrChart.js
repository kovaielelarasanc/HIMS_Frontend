// FILE: frontend/src/api/emrChart.js
// Centralized EMR Chart + Export APIs

import { unwrapApi } from "./_unwrap"
import API from "./client" // axios instance

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "")
}

function toAbsolute(url) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  if (url.startsWith("/")) return `${origin}${url}`
  return `${origin}/${url}`
}

function getApiBaseAbsolute() {
  const base = stripTrailingSlash(API?.defaults?.baseURL || "/api")
  return toAbsolute(base)
}

function parseFilenameFromContentDisposition(cd) {
  if (!cd) return ""
  const m = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(String(cd))
  if (!m) return ""
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
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

// Optional helper (if backend exists)
export async function getEmrPatientSummary(patientId, signal) {
  const res = await API.get(`/emr/patients/${patientId}/summary`, { signal })
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

export async function exportShareBundle(bundleId, payload, signal) {
  const res = await API.post(`/emr/exports/bundles/${bundleId}/share`, payload || {}, { signal })
  return unwrapApi(res.data)
}

export async function exportRevokeShare(shareId, signal) {
  const res = await API.post(`/emr/exports/shares/${shareId}/revoke`, {}, { signal })
  return unwrapApi(res.data)
}

// Optional backend endpoint
export async function exportGetBundleAudit(bundleId, params = {}, signal) {
  const res = await API.get(`/emr/exports/bundles/${bundleId}/audit`, { params, signal })
  return unwrapApi(res.data)
}

// -----------------------
// PUBLIC PDF DOWNLOAD (Share Token)
// -----------------------
export async function downloadSharePdfBlob(token, signal) {
  const res = await API.get(`/emr/exports/share/${token}`, {
    responseType: "blob",
    signal,
  })

  const cd = res?.headers?.["content-disposition"] || res?.headers?.["Content-Disposition"]
  const filename = parseFilenameFromContentDisposition(cd) || "export.pdf"
  const blob = res.data
  const url = typeof window !== "undefined" ? URL.createObjectURL(blob) : ""

  return { blob, filename, url }
}

export function getShareDownloadUrl(token, { absolute = true } = {}) {
  const rel = `/emr/exports/share/${encodeURIComponent(String(token || ""))}`
  if (!absolute) return rel
  return `${getApiBaseAbsolute()}${rel}`
}
