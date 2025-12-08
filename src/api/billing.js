// FILE: src/api/billing.js
import API from "./client";

// -------- Invoices --------

export function createInvoice(payload) {
    // payload: { patient_id, context_type?, context_id?, billing_type?, provider_id?, consultant_id?, visit_no?, remarks? }
    return API.post("/billing/invoices", payload);
}

export function getInvoice(id) {
    return API.get(`/billing/invoices/${id}`);
}

export function listInvoices(params = {}) {
    // params: patient_id?, billing_type?, status?, from_date?, to_date?
    return API.get("/billing/invoices", { params });
}

export function updateInvoice(id, payload) {
    // loosely typed; backend accepts dict body
    return API.put(`/billing/invoices/${id}`, payload);
}

export function finalizeInvoice(id) {
    return API.post(`/billing/invoices/${id}/finalize`);
}

export function cancelInvoice(id) {
    return API.post(`/billing/invoices/${id}/cancel`);
}

// -------- Items --------

export function addManualItem(invoiceId, payload) {
    // payload: { description, quantity, unit_price, tax_rate?, discount_percent?, discount_amount? }
    return API.post(`/billing/invoices/${invoiceId}/items/manual`, payload);
}

export function addServiceItem(invoiceId, payload) {
    // payload: { service_type, service_ref_id, description?, quantity?, unit_price?, tax_rate?, discount_percent?, discount_amount? }
    return API.post(`/billing/invoices/${invoiceId}/items/service`, payload);
}

export function updateInvoiceItem(invoiceId, itemId, payload) {
    // payload: { quantity?, unit_price?, tax_rate?, discount_percent?, discount_amount?, description? }
    return API.put(`/billing/invoices/${invoiceId}/items/${itemId}`, payload);
}

export function voidInvoiceItem(invoiceId, itemId, payload) {
    // payload: { reason? }
    return API.post(`/billing/invoices/${invoiceId}/items/${itemId}/void`, payload);
}

export function fetchUnbilledServices(invoiceId) {
    return API.get(`/billing/invoices/${invoiceId}/unbilled`);
}

export function bulkAddFromUnbilled(invoiceId, payload) {
    // payload: { uids?: string[] }
    return API.post(`/billing/invoices/${invoiceId}/unbilled/bulk-add`, payload);
}
// ⭐ NEW: Auto IPD Bed Charges
export function autoAddIpdBedCharges(invoiceId, payload) {
    // payload: { admission_id, mode: "daily" | "hourly" | "mixed", skip_if_already_billed?: boolean, upto_ts?: string | null }
    return API.post(
        `/billing/invoices/${invoiceId}/items/ipd-bed-auto`,
        payload
    );
}

// ⭐ NEW: Auto OT Charges
export function autoAddOtCharges(invoiceId, payload) {
    // payload: { case_id: number }
    return API.post(
        `/billing/invoices/${invoiceId}/items/ot-auto`,
        payload
    );
}
// Aliases used by InvoiceDetail.jsx
export { updateInvoiceItem as updateItem };
export { voidInvoiceItem as voidItem };

// -------- Payments --------

export function addPayment(invoiceId, payload) {
    // payload: { amount, mode, reference_no?, notes? }
    return API.post(`/billing/invoices/${invoiceId}/payments`, payload);
}

export function addPaymentsBulk(invoiceId, payments) {
    // payments: { payments: [ { amount, mode, reference_no?, notes? }, ... ] }
    return API.post(`/billing/invoices/${invoiceId}/payments/bulk`, payments);
}

export function deletePayment(invoiceId, paymentId) {
    return API.delete(`/billing/invoices/${invoiceId}/payments/${paymentId}`);
}

// Helper for refund management (front-end only)
// NOTE: by default we send NEGATIVE amount for refunds.
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

// -------- Advances --------

export function createAdvance(payload) {
    // payload: { patient_id, amount, mode, reference_no?, remarks? }
    return API.post("/billing/advances", payload);
}

export function listAdvances(params = {}) {
    // params: patient_id?, only_with_balance?
    return API.get("/billing/advances", { params });
}

export function applyAdvancesToInvoice(invoiceId, payload = {}) {
    // payload: { advance_ids?: number[] } (optional)
    return API.post(`/billing/invoices/${invoiceId}/apply-advances`, payload);
}

// -------- Masters --------

export function getBillingMasters() {
    /**
     * Backend is expected to return something like:
     * {
     *   doctors: [...],
     *   credit_providers: [...],   // from CreditProvider model
     *   packages: [...],           // optional: from IpdPackage
     *   payers: [...],             // optional
     *   tpas: [...],               // optional
     *   credit_plans: [...]        // optional
     * }
     */
    return API.get("/billing/masters");
}

// -------- Patient billing summary --------

export function getPatientBillingSummary(patientId) {
    return API.get(`/billing/patients/${patientId}/summary`);
}

// -------- Print helpers (PDF / HTML fallback) --------

export function fetchInvoicePdf(invoiceId) {
    return API.get(`/billing/invoices/${invoiceId}/print`, {
        responseType: "blob",
    });
}

export function fetchPatientSummaryPdf(patientId) {
    return API.get(`/billing/patients/${patientId}/print-summary`, {
        responseType: "blob",
    });
}
