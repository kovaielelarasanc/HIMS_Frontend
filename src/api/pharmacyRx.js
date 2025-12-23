// FILE: src/api/pharmacyRx.js
import API from './client'

// ------------------------------------------------------
// 1) PHARMACY RX CONSOLE LIST (Pharmacy Rx screen)
// ------------------------------------------------------
// Backend: routes_pharmacy_rx_list.py -> GET /api/pharmacy/rx
// Used for: Pharmacy Rx console (pending, history, etc.)
export function listPharmacyPrescriptions(params = {}) {
    // params: { q, type, status, date_from, date_to, limit }
    return API.get('/pharmacy/rx', { params })
}

// ------------------------------------------------------
// 2) CORE RX CRUD (create / view / update / cancel / sign)
// ------------------------------------------------------
// Backend: routes_pharmacy.py -> /api/pharmacy/prescriptions...

// Get single prescription with lines
export function getPharmacyPrescription(id) {
    return API.get(`/pharmacy/prescriptions/${id}`)
}

// Create a new prescription (header + lines in one payload)
export function createPharmacyPrescription(payload) {
    // payload example:
    // {
    //   type: 'OPD' | 'IPD' | 'OT' | 'COUNTER',
    //   patient_id,
    //   doctor_user_id,
    //   visit_id,
    //   ipd_admission_id,
    //   notes,
    //   lines: [
    //     {
    //       item_id,
    //       item_name,
    //       strength,
    //       route,
    //       dose,
    //       frequency,
    //       duration_days,
    //       total_qty,
    //       instructions,
    //       is_prn,
    //       is_stat,
    //     }
    //   ]
    // }
    return API.post('/pharmacy/prescriptions', payload)
}

// Update prescription header/lines (for draft prescriptions)
export function updatePharmacyPrescription(id, payload) {
    return API.put(`/pharmacy/prescriptions/${id}`, payload)
}

// Sign / finalize Rx (doctor e-sign)
export function signPharmacyPrescription(id) {
    return API.post(`/pharmacy/prescriptions/${id}/sign`)
}

// Cancel Rx with a reason
export function cancelPharmacyPrescription(id, reason) {
    return API.post(`/pharmacy/prescriptions/${id}/cancel`, { reason })
}


export const getPharmacyRxDetails = (rxId) =>
  API.get(`/pharmacy/prescriptions/${rxId}`)

export const dispenseFromRx = (rxId, payload) =>
  API.post(`/pharmacy/prescriptions/${rxId}/dispense`, payload)

// ✅ Batch picker API
export const listBatchPicks = ({ location_id, item_id, limit = 100 }) =>
  API.get(`/pharmacy/batches/pick`, { params: { location_id, item_id, limit } })


// NOTE: Backend does not expose DELETE /pharmacy/prescriptions/{id}
// If you implement it later, you can use this helper:
// export function deletePharmacyPrescription(id) {
//   return API.delete(`/pharmacy/prescriptions/${id}`)
// }

// ------------------------------------------------------
// 3) DISPENSE / SALE CREATION FROM Rx
// ------------------------------------------------------
// Backend: routes_pharmacy.py -> POST /api/pharmacy/prescriptions/{rx_id}/dispense

// Create PharmacySale from Rx (dispense)
// payload: { lines: [{ rx_line_id, qty_to_dispense }] }
export function dispensePharmacyPrescription(id, payload) {
    return API.post(`/pharmacy/prescriptions/${id}/dispense`, payload)
}

// ------------------------------------------------------
// 4) DISPENSE QUEUE
// ------------------------------------------------------
// Backend: routes_pharmacy.py -> GET /api/pharmacy/rx-queue

export function listDispenseQueue(params = {}) {
    // e.g. params = { type: 'OPD' | 'IPD' | 'COUNTER', location_id }
    return API.get('/pharmacy/rx-queue', { params })
}


export async function openPharmacyPrescriptionPdfInNewTab(rxId) {
    const res = await API.get(`/pharmacy/prescriptions/${rxId}/pdf`, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
}
