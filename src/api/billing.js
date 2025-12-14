// FILE: src/api/billing.js
import API from "./client";

// ---------------- Invoices ----------------

export function createInvoice(payload) {
    return API.post("/billing/invoices", payload);
}

export function getInvoice(id) {
    return API.get(`/billing/invoices/${id}`);
}

export function listInvoices(params = {}) {
    return API.get("/billing/invoices", { params });
}

export function updateInvoice(id, payload) {
    return API.put(`/billing/invoices/${id}`, payload);
}

export function finalizeInvoice(id) {
    return API.post(`/billing/invoices/${id}/finalize`);
}

export function cancelInvoice(id) {
    return API.post(`/billing/invoices/${id}/cancel`);
}

// ---------------- Items ----------------

export function addManualItem(invoiceId, payload) {
    return API.post(`/billing/invoices/${invoiceId}/items/manual`, payload);
}

export function addServiceItem(invoiceId, payload) {
    return API.post(`/billing/invoices/${invoiceId}/items/service`, payload);
}

export function updateInvoiceItem(invoiceId, itemId, payload) {
    return API.put(`/billing/invoices/${invoiceId}/items/${itemId}`, payload);
}

export function voidInvoiceItem(invoiceId, itemId, payload) {
    return API.post(`/billing/invoices/${invoiceId}/items/${itemId}/void`, payload);
}

// Aliases used by InvoiceDetail.jsx
export { updateInvoiceItem as updateItem };
export { voidInvoiceItem as voidItem };

// ---------------- Unbilled ----------------

async function getOrPost(url, body = {}) {
    try {
        return await API.get(url);
    } catch (err) {
        const status = err?.response?.status;
        if (status === 405) {
            return API.post(url, body);
        }
        throw err;
    }
}

export function fetchUnbilledServices(invoiceId) {
    return getOrPost(`/billing/invoices/${invoiceId}/unbilled`);
}

export async function bulkAddFromUnbilled(invoiceId, payload) {
    try {
        return await API.post(`/billing/invoices/${invoiceId}/unbilled/bulk-add`, payload);
    } catch (err) {
        if (err?.response?.status === 404 || err?.response?.status === 405) {
            return API.post(`/billing/invoices/${invoiceId}/unbilled/bulk_add`, payload);
        }
        throw err;
    }
}

// ---------------- Auto Charges ----------------

export function autoAddIpdBedCharges(invoiceId, payload) {
    return API.post(`/billing/invoices/${invoiceId}/items/ipd-bed-auto`, payload);
}

export function autoAddOtCharges(invoiceId, payload) {
    return API.post(`/billing/invoices/${invoiceId}/items/ot-auto`, payload);
}

// ---------------- Payments ----------------

export function addPayment(invoiceId, payload) {
    return API.post(`/billing/invoices/${invoiceId}/payments`, payload);
}

export function addPaymentsBulk(invoiceId, payments) {
    return API.post(`/billing/invoices/${invoiceId}/payments/bulk`, payments);
}

export function deletePayment(invoiceId, paymentId) {
    return API.delete(`/billing/invoices/${invoiceId}/payments/${paymentId}`);
}

// Refund helper (frontend-only): sends NEGATIVE amount
export function addRefund(invoiceId, payload) {
    const baseAmount = Number(payload.amount || 0);
    const negativeAmount = -Math.abs(baseAmount);
    return addPayment(invoiceId, {
        amount: negativeAmount,
        mode: payload.mode || "refund",
        reference_no: payload.reference_no || null,
        notes: payload.notes || null,
    });
}

// ---------------- Masters ----------------

export function getBillingMasters() {
    return API.get("/billing/masters");
}

// ---------------- Patient billing summary ----------------

export function getPatientBillingSummary(patientId) {
    return getOrPost(`/billing/patients/${patientId}/summary`);
}

// ---------------- Print ----------------

export function fetchInvoicePdf(invoiceId) {
    return API.get(`/billing/invoices/${invoiceId}/print`, { responseType: "blob" });
}

export function fetchPatientSummaryPdf(patientId) {
    return API.get(`/billing/patients/${patientId}/print-summary`, { responseType: "blob" });
}

// ---------------- Advances / Deposits (Wallet) ----------------

// Create wallet top-up
export function createAdvance(payload) {
    // payload: { patient_id, amount, mode, reference_no?, remarks?, context_type?, context_id? }
    return API.post("/billing/advances", payload);
}

// (Optional) admin pages
export function listAdvances(params = {}) {
    // params: patient_id?, only_with_balance?
    return API.get("/billing/advances", { params });
}

export function getAdvance(id) {
    return API.get(`/billing/advances/${id}`);
}

export function updateAdvance(id, payload) {
    return API.put(`/billing/advances/${id}`, payload);
}

export function voidAdvance(id, payload) {
    return API.post(`/billing/advances/${id}/void`, payload);
}

// Patient wallet entries + summary
export function listPatientAdvances(patientId) {
    return API.get(`/billing/advances/patient/${patientId}`);
}

export function getPatientAdvanceSummary(patientId) {
    return API.get(`/billing/advances/patient/${patientId}/summary`);
}

// Apply wallet amount to invoice
export function applyAdvanceWalletToInvoice(invoiceId, payload) {
    // payload: { amount }
    return API.post(`/billing/advances/apply/${invoiceId}`, payload);
}

// Existing invoice->advance adjustment APIs (keep if your backend has them)
export function listInvoiceAdvanceAdjustments(invoiceId) {
    return API.get(`/billing/invoices/${invoiceId}/advance-adjustments`);
}

export function removeInvoiceAdvanceAdjustment(invoiceId, adjustmentId) {
    return API.delete(`/billing/invoices/${invoiceId}/advance-adjustments/${adjustmentId}`);
}

// If your backend still supports these old endpoints, keep them (optional)
export function applyAdvancesToInvoice(invoiceId, payload = {}) {
    return API.post(`/billing/invoices/${invoiceId}/apply-advances`, payload);
}

export function applyAdvanceToInvoice(invoiceId, payload = {}) {
    return API.post(`/billing/invoices/${invoiceId}/apply-advance`, payload);
}
