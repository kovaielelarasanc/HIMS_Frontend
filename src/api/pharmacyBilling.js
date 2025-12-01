// FILE: src/api/pharmacyBilling.js
import API from './client'

// ------------------------------------------------------
// 1) PHARMACY BILLS LIST / DETAIL
// ------------------------------------------------------

// List pharmacy bills (OPD / IPD / COUNTER etc.)
export function listPharmacyBills(params = {}) {
    // params: { q, date_from, date_to, status, limit }
    // Backend: GET /api/pharmacy/billing
    return API.get('/pharmacy/billing', { params })
}

// Get single pharmacy bill with items
// Backend: GET /api/pharmacy/billing/{sale_id}
export function getPharmacyBill(id) {
    return API.get(`/pharmacy/billing/${id}`)
}

// Update bill payment status (UNPAID / PARTIAL / PAID / CANCELLED)
// Backend: POST /api/pharmacy/billing/{sale_id}/status
// payload: { payment_status: 'paid' | 'unpaid' | 'partial' | 'cancelled', paid_amount?: number, note?: string }
export function updatePharmacyBillStatus(id, payload) {
    return API.post(`/pharmacy/billing/${id}/status`, payload)
}

// ------------------------------------------------------
// 2) PAYMENTS (CORE BILLING)
// ------------------------------------------------------

// Add payment against the underlying Billing.Invoice for this pharmacy bill.
// Assumes you know the invoiceId from the billing module.
export function addPharmacyBillPayment(invoiceId, { amount, mode }) {
    // Backend: routes_billing -> POST /api/billing/invoices/{invoice_id}/payments
    return API.post(`/billing/invoices/${invoiceId}/payments`, {
        amount,
        mode,
    })
}

// ------------------------------------------------------
// 3) RETURNS
// ------------------------------------------------------

// List pharmacy returns (net_amount < 0)
// Backend: GET /api/pharmacy/billing/returns/list
export function listPharmacyReturns(params = {}) {
    return API.get('/pharmacy/billing/returns/list', { params })
}

// Get single return invoice detail
// Backend: GET /api/pharmacy/billing/returns/{sale_id}
export function getPharmacyReturn(id) {
    return API.get(`/pharmacy/billing/returns/${id}`)
}

// Create a new pharmacy return (negative sale)
// Backend: POST /api/pharmacy/billing/returns
// payload: {
//   source_invoice_id: number,
//   reason?: string,
//   lines: [{ bill_line_id: number, qty_to_return: number }]
// }
export function createPharmacyReturn(payload) {
    return API.post('/pharmacy/billing/returns', payload)
}

// ------------------------------------------------------
// 4) IPD CONSOLIDATED PHARMACY INVOICE (DISCHARGE TIME)
// ------------------------------------------------------

// Summarize all UNPAID/PARTIAL IPD pharmacy bills for a patient/admission
// Backend: POST /api/pharmacy/billing/ipd/consolidated
// payload: { patient_id: number, admission_id?: number }
export function createPharmacyIpdConsolidatedInvoice(payload) {
    return API.post('/pharmacy/billing/ipd/consolidated', payload)
}

// ------------------------------------------------------
// 5) PDF & EMAIL
// ------------------------------------------------------

// Trigger email of bill from backend
// Backend: POST /api/pharmacy/billing/{sale_id}/email?email=...
export function emailPharmacyBill(id, email) {
    return API.post(`/pharmacy/billing/${id}/email`, null, {
        params: { email },
    })
}

// ✅ Open bill PDF in a new tab, using Axios so Authorization header is sent
export async function openPharmacyBillPdfInNewTab(id) {
    try {
        const res = await API.get(`/pharmacy/billing/${id}/pdf`, {
            responseType: 'blob',
        })
        const blob = new Blob([res.data], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
        // Error toast will be shown by API interceptor
        // (no need to duplicate here)
        console.error('Failed to open pharmacy bill PDF', err)
    }
}