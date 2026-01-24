// FILE: frontend/src/api/emrTemplates.js
import API from "./client"

/**
 * Normalize FastAPI / custom error responses into a useful message.
 * Handles:
 *  - FastAPI 422: { detail: [{loc, msg, type}, ...] }
 *  - Your wrapper: { ok:false, error:{msg, details} }
 *  - Generic Axios errors
 */
function formatValidationDetails(details) {
  if (!details) return ""
  if (!Array.isArray(details)) return ""

  // FastAPI style: [{ loc: ["body","field"], msg: "...", type: "..." }]
  return details
    .slice(0, 8)
    .map((d) => {
      const loc = Array.isArray(d.loc) ? d.loc.join(".") : d.loc ? String(d.loc) : ""
      const msg = d.msg || d.message || "Invalid"
      return loc ? `${loc}: ${msg}` : String(msg)
    })
    .join(" | ")
}

function normalizeAxiosError(err) {
  // Axios typically provides: err.response.data
  const data = err?.response?.data

  // FastAPI validation
  if (err?.response?.status === 422 && data?.detail) {
    const pretty = formatValidationDetails(data.detail)
    return new Error(pretty ? `Validation error — ${pretty}` : "Validation error")
  }

  // Your backend wrapper formats (examples):
  // { ok:false, error:{msg:"Validation error", details:[...]}, data:null }
  if (data?.error) {
    const msg = data.error.msg || data.error.message || "Request failed"
    const details =
      data.error.details || data.error.errors || data.details || data.errors || data.detail
    const pretty = formatValidationDetails(details)
    return new Error(pretty ? `${msg} — ${pretty}` : msg)
  }

  // Sometimes backend returns { message } or { detail } as string
  if (typeof data?.detail === "string") return new Error(data.detail)
  if (typeof data?.message === "string") return new Error(data.message)

  // Fallback to axios message
  return new Error(err?.message || "Request failed")
}

/**
 * Unwrap your API format.
 * Supports:
 *  - { ok:true, data:... }
 *  - { status:true, data:... }
 *  - { success:true, data:... }
 */
function unwrap(res) {
  const payload = res?.data

  if (payload == null) {
    throw new Error("Empty response from server")
  }

  const ok =
    payload?.ok === true ||
    payload?.status === true ||
    payload?.success === true ||
    payload?.is_ok === true

  if (!ok) {
    const err = payload?.error
    const msg =
      err?.msg ||
      err?.message ||
      payload?.detail ||
      payload?.message ||
      "Something went wrong"

    const details =
      err?.details ||
      err?.errors ||
      payload?.errors ||
      payload?.detail

    const pretty = formatValidationDetails(details)
    throw new Error(pretty ? `${msg} — ${pretty}` : String(msg))
  }

  // Some backends put actual result in payload.data
  // Some put it as payload.result
  // Some just return the whole payload
  return payload?.data ?? payload?.result ?? payload
}

/** One wrapper so every call gets the same error quality */
function request(promise) {
  return promise.then(unwrap).catch((err) => {
    throw normalizeAxiosError(err)
  })
}

/**
 * EMR Templates API
 * Backend routes expected:
 *  GET  /emr/templates
 *  GET  /emr/templates/{id}
 *  POST /emr/templates
 *  POST /emr/templates/{id}/versions
 *  POST /emr/templates/{id}/publish
 */
export const emrTemplates = {
  list: (params, signal) =>
    request(API.get("/emr/templates", { params: params || {}, signal })),

  get: (id, signal) =>
    request(API.get(`/emr/templates/${id}`, { signal })),

  create: (payload) =>
    request(API.post("/emr/templates", payload || {})),

  createVersion: (id, payload) =>
    request(API.post(`/emr/templates/${id}/versions`, payload || {})),

  publish: (id, payload) =>
    request(API.post(`/emr/templates/${id}/publish`, payload || {})),
}

/** Optional: function-style exports */
export async function apiListTemplates(params, signal) {
  return emrTemplates.list(params, signal)
}

export async function apiGetTemplate(id, signal) {
  return emrTemplates.get(id, signal)
}

export async function apiCreateTemplate(payload) {
  return emrTemplates.create(payload)
}

export async function apiCreateTemplateVersion(id, payload) {
  return emrTemplates.createVersion(id, payload)
}

export async function apiPublishTemplate(id, payload) {
  // payload example: { publish: true/false, version?: number, status?: "PUBLISHED"/"DRAFT" }
  return emrTemplates.publish(id, payload)
}
