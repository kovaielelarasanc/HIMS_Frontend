// FILE: frontend/src/API/emrAPI.js
// Unified EMR API helpers for:
// - Meta
// - Quick Access (Recent/Pinned/Drafts)
// - Inbox (Daily Work Queue)
// - Encounters
// - Records (get/list/createDraft/updateDraft/sign)
// - Patients (best-effort fetch for name/UHID if your backend provides /patients/:id)
//
// Assumes you already have: import API from "@/API/client"
// (axios instance with baseURL + auth)

import API from "./client"

/* ----------------------------- core helpers ----------------------------- */

function unwrap(resp) {
  const d = resp?.data
  // If your backend uses ok()/err() wrappers:
  // ok => {status:true, data:...}
  // err => {status:false, msg, error:{details}}
  if (d && typeof d === "object" && "status" in d) {
    if (d.status === false) {
      const e = new Error(d?.msg || "Request failed")
      e.payload = d
      throw e
    }
    return d?.data
  }
  return d
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x)
}

function pickFirstString(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function cleanParams(obj) {
  const out = {}
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return
    out[k] = v
  })
  return out
}

/** Normalize IDs so we never send "[object Object]" in URLs */
export function toId(v) {
  if (v === null || v === undefined) return null

  if (typeof v === "number") return v
  if (typeof v === "string") {
    const s = v.trim()
    if (!s) return null
    return s
  }

  if (typeof v === "object") {
    const cand =
      v.id ??
      v.patient_id ??
      v.patientId ??
      v.record_id ??
      v.recordId ??
      v.value ??
      v.key ??
      (Array.isArray(v) ? v[0] : null)
    return toId(cand)
  }

  const s = String(v).trim()
  return s ? s : null
}

/**
 * Turns FastAPI/Pydantic validation errors into a clean message.
 * Works with:
 * - wrapper: {status:false, msg:"Validation error", error:{details:[...]}}
 * - raw FastAPI: {detail:[...]} or {detail:"..."}
 */
export function formatValidationError(err) {
  const data = err?.response?.data || err?.payload || null

  // wrapper style
  const details =
    data?.error?.details ||
    data?.details ||
    (Array.isArray(data?.error) ? data?.error : null) ||
    null

  // raw FastAPI style
  const rawDetail = data?.detail

  const list = Array.isArray(details)
    ? details
    : Array.isArray(rawDetail)
      ? rawDetail
      : null

  if (Array.isArray(list) && list.length) {
    const first = list[0]
    const locArr = Array.isArray(first?.loc) ? first.loc : []
    const field = locArr.slice(1).join(".") || "field"
    const msg = first?.msg || "Invalid input"
    return `${field}: ${msg}`
  }

  if (typeof rawDetail === "string" && rawDetail.trim()) return rawDetail.trim()
  return pickFirstString(data, ["msg", "message"]) || err?.message || "Request failed"
}

export function errMsg(err, fallback = "Something went wrong") {
  return formatValidationError(err) || fallback
}

/* --------------------------------- META -------------------------------- */

export async function emrMetaGet() {
  const resp = await API.get("/emr/meta")
  return unwrap(resp)
}

/* -------------------------- QUICK ACCESS (RECENT) ------------------------ */

export async function emrQuickGet(params = {}) {
  // backend currently supports GET /emr/quick
  // (Some versions may accept params; safe to include)
  const resp = await API.get("/emr/quick", { params: cleanParams(params) })
  return unwrap(resp)
}

export async function emrSetPatientPinned(patientId, pinned) {
  const pid = toId(patientId)
  if (!pid) throw new Error("patient_id missing")
  const resp = await API.post(`/emr/quick/pin/patient/${encodeURIComponent(String(pid))}`, {
    pinned: !!pinned,
  })
  return unwrap(resp)
}

export async function emrSetRecordPinned(recordId, pinned) {
  const rid = toId(recordId)
  if (!rid) throw new Error("record_id missing")
  const resp = await API.post(`/emr/quick/pin/record/${encodeURIComponent(String(rid))}`, {
    pinned: !!pinned,
  })
  return unwrap(resp)
}

/* ------------------------------ INBOX (QUEUE) ---------------------------- */

export async function emrInboxList({
  bucket = "pending_signature", // pending_signature | drafts | results | all
  q = "",
  page = 1,
  page_size = 50,
} = {}) {
  const resp = await API.get("/emr/inbox", {
    params: cleanParams({
      bucket,
      q: (q || "").trim() || null,
      page,
      page_size,
    }),
  })
  return unwrap(resp) // {items, page, page_size, total}
}

export async function emrInboxAck({ inbox_id, source } = {}) {
  const iid = toId(inbox_id)
  if (!iid) throw new Error("inbox_id missing")
  if (!source) throw new Error("source missing (LAB/RIS)")

  const resp = await API.post("/emr/inbox/ack", {
    inbox_id: Number(iid),
    source: String(source),
  })
  return unwrap(resp)
}

/* ------------------------------ ENCOUNTERS ------------------------------ */

export async function emrPatientEncounters(patientId, { limit = 50 } = {}) {
  const pid = toId(patientId)

  if (!pid || String(pid).toLowerCase() === "[object object]") {
    const e = new Error("Invalid patient_id (object passed)")
    e.code = "BAD_PATIENT_ID"
    throw e
  }

  const resp = await API.get(`/emr/patients/${encodeURIComponent(String(pid))}/encounters`, {
    params: cleanParams({ limit }),
  })
  const data = unwrap(resp)
  return data?.items ?? data?.encounters ?? data ?? []
}

/* -------------------------------- RECORDS ------------------------------ */

export async function emrRecordGet(recordId) {
  const rid = toId(recordId)

  if (!rid) {
    const e = new Error("record_id missing")
    e.code = "BAD_RECORD_ID"
    throw e
  }

  if (String(rid).toLowerCase() === "[object object]") {
    const e = new Error("Invalid record_id (object passed)")
    e.code = "BAD_RECORD_ID"
    throw e
  }

  const resp = await API.get(`/emr/records/${encodeURIComponent(String(rid))}`)
  const data = unwrap(resp)
  if (data?.record && isPlainObject(data.record)) return data.record
  return data
}

export async function emrRecordList({
  patient_id,
  q = "",
  status = "ALL",
  stage = "ALL",
  dept_code = "ALL",
  record_type_code = "ALL",
  page = 1,
  page_size = 20,
} = {}) {
  const resp = await API.get("/emr/records", {
    params: cleanParams({
      patient_id,
      q,
      status,
      stage,
      dept_code,
      record_type_code,
      page,
      page_size,
    }),
  })
  return unwrap(resp)
}

/* -------------------------- DRAFT CREATE / SIGN -------------------------- */

export async function emrCreateDraft(payload) {
  const resp = await API.post("/emr/records/draft", payload)
  const data = unwrap(resp)
  const id = data?.id ?? data?.record_id ?? data?.recordId
  return { ...data, id }
}

export async function emrUpdateDraft(recordId, payload) {
  const rid = toId(recordId)
  if (!rid) throw new Error("record_id missing")
  const resp = await API.put(`/emr/records/${encodeURIComponent(String(rid))}/draft`, payload)
  return unwrap(resp)
}

export async function emrSignRecord(recordId, sign_note = "") {
  const rid = toId(recordId)
  if (!rid) throw new Error("record_id missing")
  const resp = await API.post(`/emr/records/${encodeURIComponent(String(rid))}/sign`, {
    sign_note: (sign_note || "").trim() || null,
  })
  return unwrap(resp)
}

/* ------------------------------- PATIENTS ------------------------------- */
/**
 * Optional: if your backend provides GET /patients/{id}, this will hydrate name/UHID.
 * If not available, caller should fall back gracefully.
 */
export async function patientGet(patientId) {
  const pid = toId(patientId)
  if (!pid) throw new Error("patient_id missing")
  const resp = await API.get(`/patients/${encodeURIComponent(String(pid))}`)
  return unwrap(resp)
}


export async function emrInboxListMany({
  buckets = ["pending_signature"],
  q = "",
  page = 1,
  page_size = 80,
} = {}) {
  const list = Array.isArray(buckets) ? buckets.filter(Boolean) : []
  if (!list.length) return { items: [], page, page_size, total: 0, bucket: "many" }

  const perBucket = Math.max(1, Math.floor(page_size / list.length))

  const results = await Promise.all(
    list.map((b) =>
      emrInboxList({
        bucket: b,
        q,
        page,
        page_size: perBucket,
      }).catch(() => ({ items: [], total: 0, bucket: b }))
    )
  )

  const items = results.flatMap((r) => (Array.isArray(r?.items) ? r.items : []))
  const total = results.reduce((sum, r) => sum + (Number(r?.total) || 0), 0)

  return {
    items,
    page,
    page_size,
    total,
    bucket: "many",
    buckets: list,
  }
}