// src/api/labIntegration.js
import API from "@/api/client"

function unwrap(res) {
  const payload = res?.data
  if (payload?.status === false) throw new Error(payload?.error?.msg || payload?.error?.message || "Request failed")
  return payload?.data ?? payload
}

export function isCanceledError(e) {
  return (
    e?.code === "ERR_CANCELED" ||
    e?.name === "CanceledError" ||
    String(e?.message || "").toLowerCase().includes("canceled")
  )
}

// Optional admin token (DEV) stored locally
function adminHeaders() {
  const t = (localStorage.getItem("lab_admin_token") || "").trim()
  return t ? { "X-Admin-Token": t } : {}
}

export async function getIntegrationStats(params = {}, signal) {
  const res = await API.get("/lab/integration/stats", { params, signal, headers: adminHeaders() })
  return unwrap(res)
}

export async function listIntegrationDevices(params = {}, signal) {
  const res = await API.get("/lab/integration/devices", { params, signal, headers: adminHeaders() })
  return unwrap(res)
}
export async function createIntegrationDevice(body) {
  const res = await API.post("/lab/integration/devices", body, { headers: adminHeaders() })
  return unwrap(res)
}
export async function updateIntegrationDevice(id, body) {
  const res = await API.patch(`/lab/integration/devices/${id}`, body, { headers: adminHeaders() })
  return unwrap(res)
}

export async function listIntegrationMappings(params = {}, signal) {
  const res = await API.get("/lab/integration/mappings", { params, signal, headers: adminHeaders() })
  return unwrap(res)
}
export async function createIntegrationMapping(body) {
  const res = await API.post("/lab/integration/mappings", body, { headers: adminHeaders() })
  return unwrap(res)
}
export async function deleteIntegrationMapping(id) {
  const res = await API.delete(`/lab/integration/mappings/${id}`, { headers: adminHeaders() })
  return unwrap(res)
}

export async function listIntegrationMessages(params = {}, signal) {
  const res = await API.get("/lab/integration/messages", { params, signal, headers: adminHeaders() })
  return unwrap(res)
}
export async function readIntegrationMessage(id, signal) {
  const res = await API.get(`/lab/integration/messages/${id}`, { signal, headers: adminHeaders() })
  return unwrap(res)
}
export async function reprocessIntegrationMessage(id) {
  const res = await API.post(`/lab/integration/messages/${id}/reprocess`, null, { headers: adminHeaders() })
  return unwrap(res)
}

export async function listIntegrationErrorQueue(params = {}, signal) {
  const res = await API.get("/lab/integration/error-queue", { params, signal, headers: adminHeaders() })
  return unwrap(res)
}
