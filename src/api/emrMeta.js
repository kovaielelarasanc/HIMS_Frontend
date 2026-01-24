// FILE: frontend/src/api/emrMeta.js
import API from "./client"

const extractErrMsg = (payload) => {
  if (!payload) return "Something went wrong"
  if (typeof payload === "string") return payload
  return (
    payload?.message ||
    payload?.error?.message ||
    payload?.error?.msg ||
    payload?.detail ||
    "Something went wrong"
  )
}

const unwrap = (res) => {
  const payload = res?.data

  // Backend style: { ok: true, data: ... }
  if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "ok")) {
    if (!payload.ok) throw new Error(extractErrMsg(payload))
    return payload.data
  }

  // Some endpoints may return raw arrays/objects directly
  return payload
}

// Optional helper: normalize axios thrown errors into message
const unwrapAxiosError = (e) => {
  const payload = e?.response?.data
  const msg = extractErrMsg(payload) || e?.message || "Request failed"
  throw new Error(msg)
}

/**
 * EMR Meta API
 * Used by Template Editor:
 *  - Departments
 *  - Record Types
 *  - Section Library (Template Library)
 *
 * NOTE:
 * - Departments endpoints in your current code are /emr/departments and /emr/record-types
 * - Section Library endpoints (recommended) are /emr/library/sections (from your backend module)
 */
export const emrMeta = {
  // -------- Departments --------
  listDepartments: (active = true, signal) =>
    API.get("/emr/departments", { params: { active }, signal })
      .then(unwrap)
      .catch(unwrapAxiosError),

  createDepartment: (payload) =>
    API.post("/emr/departments", payload || {})
      .then(unwrap)
      .catch(unwrapAxiosError),

  updateDepartment: (id, payload) =>
    API.put(`/emr/departments/${id}`, payload || {})
      .then(unwrap)
      .catch(unwrapAxiosError),

  deleteDepartment: (id) =>
    API.delete(`/emr/departments/${id}`)
      .then(unwrap)
      .catch(unwrapAxiosError),

  // -------- Record Types --------
  listRecordTypes: (active = true, signal) =>
    API.get("/emr/record-types", { params: { active }, signal })
      .then(unwrap)
      .catch(unwrapAxiosError),

  createRecordType: (payload) =>
    API.post("/emr/record-types", payload || {})
      .then(unwrap)
      .catch(unwrapAxiosError),

  updateRecordType: (id, payload) =>
    API.put(`/emr/record-types/${id}`, payload || {})
      .then(unwrap)
      .catch(unwrapAxiosError),

  deleteRecordType: (id) =>
    API.delete(`/emr/record-types/${id}`)
      .then(unwrap)
      .catch(unwrapAxiosError),

  // -------- Section Library (Template Library) --------
  // Backend route suggested: GET /emr/library/sections
  listSections: (params = {}, signal) =>
    API.get("/emr/library/sections", { params: params || {}, signal })
      .then(unwrap)
      .catch(unwrapAxiosError),

  // Backend route suggested: POST /emr/library/sections
  createSection: (payload) =>
    API.post("/emr/library/sections", payload || {})
      .then(unwrap)
      .catch(unwrapAxiosError),

  bootstrap: (active = true, signal) =>
    API.get("/emr/meta/bootstrap", { params: { active }, signal })
      .then(unwrap)
      .catch(unwrapAxiosError),

  listPresets: (params = {}, signal) =>
    API.get("/emr/presets", { params: params || {}, signal })
      .then(unwrap)
      .catch(unwrapAxiosError),

  previewTemplate: (payload, signal) =>
    API.post("/emr/templates/preview", payload || {}, { signal })
      .then(unwrap)
      .catch(unwrapAxiosError),
}
