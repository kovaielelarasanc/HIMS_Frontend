// FILE: src/api/pharmacy.js
import API from './client'
import { listInventoryItems } from './inventory'

/**
 * ============================================
 *  Inventory-integrated Pharmacy Rx + Sales
 *  Backend: app/api/routes_pharmacy.py
 * ============================================
 */

/**
 * --------- Doctor-side prescriptions ----------
 * type: "OPD" | "IPD" | "GENERAL"
 * payload shape matches PrescriptionCreate Pydantic model.
 */
export function createPharmacyPrescription(payload) {
    // {
    //   type: "OPD" | "IPD" | "GENERAL",
    //   patient_id,
    //   visit_id?,
    //   ipd_admission_id?,
    //   location_id,
    //   doctor_user_id?,
    //   notes?,
    //   lines: [
    //     {
    //       item_id,
    //       requested_qty,
    //       dose_text?,
    //       frequency_code?,
    //       timing?,
    //       duration_days?,
    //       instructions?
    //     }
    //   ]
    // }
    return API.post('/pharmacy/prescriptions', payload)
}

export function listPharmacyPrescriptions(params = {}) {
    // Supported filters server-side:
    // { type, patient_id, visit_id, ipd_admission_id, doctor_user_id, status, from_date, to_date }
    return API.get('/pharmacy/prescriptions', { params })
}

export function getPharmacyPrescription(id) {
    return API.get(`/pharmacy/prescriptions/${id}`)
}

export function updatePharmacyPrescription(id, payload) {
    // payload: { notes?, status? }
    return API.put(`/pharmacy/prescriptions/${id}`, payload)
}

// Dispense from prescription (FEFO / batch-wise)
export function dispensePharmacyPrescription(id, payload) {
    // payload: { lines: [{ line_id, quantity, batch_id? }], remark? }
    return API.post(`/pharmacy/prescriptions/${id}/dispense`, payload)
}

// Create Pharmacy bill from dispensed prescription lines
export function billPharmacyPrescription(id) {
    return API.post(`/pharmacy/prescriptions/${id}/bill`)
}

/**
 * --------- Inventory-linked Pharmacy Sales ----------
 * These are the invoices generated after dispensing.
 */

export function listInventoryPharmacySales(params = {}) {
    // Filters: { patient_id, rx_id, from_date, to_date, status }
    return API.get('/pharmacy/sales', { params })
}

export function getInventoryPharmacySale(id) {
    return API.get(`/pharmacy/sales/${id}`)
}

export function downloadInventoryPharmacySalePdf(id) {
    return API.get(`/pharmacy/sales/${id}/pdf`, {
        responseType: 'blob',
    })
}

export function emailInventoryPharmacySale(id, emailTo) {
    return API.post(`/pharmacy/sales/${id}/email`, null, {
        params: { email_to: emailTo },
    })
}

/**
 * ============================================
 *  Doctor medicine search (uses Inventory)
 * ============================================
 */

/**
 * Unified search for medicines/consumables.
 *
 * type:
 *  - "all"        → no is_consumable filter
 *  - "drug"       → is_consumable = false
 *  - "consumable" → is_consumable = true
 *
 * Returns simplified shape for doctor UI:
 * [
 *   {
 *     id,
 *     code,
 *     name,
 *     generic_name,
 *     strength,
 *     form,
 *     unit,
 *     pack_size,
 *     is_consumable,
 *     type: "drug" | "consumable"
 *   }
 * ]
 */
export async function searchPharmacyItems({ q = '', type = 'all', limit = 50 } = {}) {
    const params = { is_active: true }
    if (q) params.q = q
    if (type === 'drug') params.type = 'drug'
    if (type === 'consumable') params.type = 'consumable'
    if (limit) params.limit = limit

    const res = await listInventoryItems(params)
    const raw = Array.isArray(res?.data) ? res.data : []

    const mapped = raw.slice(0, limit).map((it) => ({
        id: it.id,
        code: it.code,
        name: it.name,
        generic_name: it.generic_name,
        strength: it.strength,
        form: it.form,
        unit: it.unit,
        pack_size: it.pack_size,
        is_consumable: !!it.is_consumable,
        type: it.is_consumable ? 'consumable' : 'drug',
        // You can later enrich from a separate stock endpoint:
        // available_qty, near_expiry, earliest_expiry_date, etc.
    }))

    return { data: mapped }
}

/**
 * ============================================
 *  LEGACY helpers used by OPD/IPD Visit screens
 *  (stop calling non-existent /pharmacy/opd/... endpoints)
 * ============================================
 *
 * For now, we just return empty structures so the
 * Visit/IPD tabs won’t throw 405 errors. Your new
 * doctor prescribing screen should use
 * createPharmacyPrescription(...) directly.
 */

/** OPD visit prescriptions */
export function getVisitRx(visitId) {
    // No backend route /pharmacy/opd/visits/{id}/rx → avoid 405
    return Promise.resolve({
        data: {
            visit_id: visitId,
            lines: [],
        },
    })
}

export function saveVisitRx(visitId, payload) {
    // Keep as a no-op wrapper for now to avoid 405.
    // Use createPharmacyPrescription in new flows.
    console.warn('saveVisitRx is deprecated. Use createPharmacyPrescription instead.')
    return Promise.resolve({ data: { ok: true } })
}

export function signVisitRx(visitId, payload = {}) {
    console.warn('signVisitRx is deprecated. Use createPharmacyPrescription + status=ISSUED instead.')
    return Promise.resolve({ data: { ok: true } })
}

/** IPD admission prescriptions */
export function getAdmissionRx(admissionId) {
    return Promise.resolve({
        data: {
            admission_id: admissionId,
            lines: [],
        },
    })
}

export function saveAdmissionRx(admissionId, payload) {
    console.warn('saveAdmissionRx is deprecated. Use createPharmacyPrescription(type="IPD") instead.')
    return Promise.resolve({ data: { ok: true } })
}

export function signAdmissionRx(admissionId, payload = {}) {
    console.warn('signAdmissionRx is deprecated. Use createPharmacyPrescription + status=ISSUED instead.')
    return Promise.resolve({ data: { ok: true } })
}

/**
 * -----------------------------
 * Pharmacy Rx Queue (Pharmacy side)
 * -----------------------------
 */

export function listRxQueue(params = {}) {
    // Backend: app/api/routes_pharmacy_rx.py → /pharmacy/rx/queue
    return API.get('/pharmacy/rx/queue', { params })
}

export function getRxDetail(rxId) {
    return API.get(`/pharmacy/rx/${rxId}`)
}

export function saveRxDraft(rxId, payload) {
    // payload: { lines: [{ id, dispense_qty, status }] }
    return API.put(`/pharmacy/rx/${rxId}`, payload)
}

// Manual dispense with per-line qty/status -> generate bill
export function dispenseRx(rxId, payload) {
    // payload: { lines: [{ id, dispense_qty, status }], context_type?: "opd" | "ipd" | "counter" }
    return API.post(`/pharmacy/rx/${rxId}/dispense-manual`, payload)
}

// Auto-dispense (full quantity) kept for one-click usage
export function autoDispenseRx(rxId) {
    return API.post(`/pharmacy/rx/${rxId}/dispense`)
}

export function cancelRx(rxId) {
    return API.post(`/pharmacy/rx/${rxId}/cancel`)
}

/**
 * -----------------------------
 * Pharmacy Billing Console
 * -----------------------------
 */

export function listPharmacyBills(params = {}) {
    // Suggested params: { q, date_from, date_to, status, patient_id }
    // Status uses PharmacySale.status: "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED"
    return API.get('/pharmacy/billing', { params })
}

export function getPharmacyBill(id) {
    return API.get(`/pharmacy/billing/${id}`)
}

// Update billing status: "paid" | "unpaid" | "partial"
export function updateBillStatus(id, payload) {
    // payload: { payment_status, paid_amount?, note? }
    return API.post(`/pharmacy/billing/${id}/status`, payload)
}

export function downloadBillPdf(id) {
    return API.get(`/pharmacy/billing/${id}/pdf`, { responseType: 'blob' })
}

export function emailBillPdf(id, email) {
    return API.post(`/pharmacy/billing/${id}/email`, null, {
        params: { email },
    })
}

// Consolidated IPD invoice (all UNPAID/PARTIAL IPD bills for patient/admission)
export function createConsolidatedIpdInvoice(payload) {
    // payload: { patient_id, admission_id? }
    return API.post('/pharmacy/billing/ipd/consolidated', payload)
}

/**
 * -----------------------------
 * Pharmacy Returns
 * -----------------------------
 */

export function listPharmacyReturns(params = {}) {
    // Backend still uses: net_amount < 0 to identify returns
    return API.get('/pharmacy/billing/returns/list', { params })
}

// Start a return against an earlier invoice
export function createReturnInvoice(payload) {
    // payload: { source_invoice_id, lines: [{ bill_line_id, qty_to_return }], reason }
    return API.post('/pharmacy/billing/returns', payload)
}

export function getReturnInvoice(id) {
    return API.get(`/pharmacy/billing/returns/${id}`)
}


export function downloadPharmacyBillPdf(saleId) {
    return API.get(`/pharmacy/billing/${saleId}/pdf`, {
        responseType: 'blob', // important for binary PDF
    })
}