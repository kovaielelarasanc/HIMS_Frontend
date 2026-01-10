// FILE: src/api/pharmacyRx.js
import API from "./client"

// ---------------------------
// Small helper (safe unwrap)
// ---------------------------
export function unwrapData(res) {
  const d = res?.data
  // supports shapes: {status:true,data:{...}} or {data:{...}} or plain array/object
  return d?.data ?? d
}

// ------------------------------------------------------
// 1) PHARMACY RX CONSOLE LIST (Pharmacy Rx screen)
// ------------------------------------------------------
// GET /api/pharmacy/rx
export function listPharmacyPrescriptions(params = {}) {
  return API.get("/pharmacy/rx", { params })
}

// ------------------------------------------------------
// 2) CORE RX CRUD
// ------------------------------------------------------
// GET /api/pharmacy/prescriptions/{id}
export function getPharmacyPrescription(id) {
  return API.get(`/pharmacy/prescriptions/${id}`)
}

// POST /api/pharmacy/prescriptions
export function createPharmacyPrescription(payload) {
  return API.post("/pharmacy/prescriptions", payload)
}

// PUT /api/pharmacy/prescriptions/{id}
export function updatePharmacyPrescription(id, payload) {
  return API.put(`/pharmacy/prescriptions/${id}`, payload)
}

// POST /api/pharmacy/prescriptions/{id}/sign
export function signPharmacyPrescription(id) {
  return API.post(`/pharmacy/prescriptions/${id}/sign`)
}

// POST /api/pharmacy/prescriptions/{id}/cancel
export function cancelPharmacyPrescription(id, reason) {
  return API.post(`/pharmacy/prescriptions/${id}/cancel`, { reason })
}

// ------------------------------------------------------
// 3) DISPENSE / SALE CREATION FROM Rx
// ------------------------------------------------------
// POST /api/pharmacy/prescriptions/{rx_id}/dispense
export function dispensePharmacyPrescription(id, payload) {
  return API.post(`/pharmacy/prescriptions/${id}/dispense`, payload)
}

// ------------------------------------------------------
// 4) DISPENSE QUEUE
// ------------------------------------------------------
// GET /api/pharmacy/rx-queue
export function listDispenseQueue(params = {}) {
  return API.get("/pharmacy/rx-queue", { params })
}

// ------------------------------------------------------
// 5) BATCH PICKER (for dispensing)
// ------------------------------------------------------
// ✅ Your project has used multiple possible endpoints.
// We'll try the primary and fallback automatically.
export async function listBatchPicks({ location_id, item_id, limit = 100 }) {
  const params = { location_id, item_id, limit }
  try {
    // preferred
    return await API.get("/pharmacy/batches/pick", { params })
  } catch (e) {
    // fallback used in some screens
    return API.get("/pharmacy/batch-picks", { params })
  }
}

// ------------------------------------------------------
// 6) PDF OPEN
// ------------------------------------------------------
export async function openPharmacyPrescriptionPdfInNewTab(rxId) {
  const res = await API.get(`/pharmacy/prescriptions/${rxId}/pdf`, {
    responseType: "blob",
  })
  const blob = new Blob([res.data], { type: "application/pdf" })
  const url = window.URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
}
