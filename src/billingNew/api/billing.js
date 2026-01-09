// FILE: src/billing/api/billing.js
import API from "@/api/client"

// --- helpers ---
function unwrap(res) {
    const payload = res?.data
    if (payload?.status === false) {
        throw new Error(payload?.error?.msg || "Request failed")
    }
    return payload?.data ?? payload
}
function pickMsg(e) {
    return (
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Something went wrong"
    )
}

// --- Dashboard ---
export async function getDashboard(params = {}) {
    // expected: GET /api/dashboard?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    // (change path here if your backend uses /dashboard/data etc)
    const res = await API.get("/dashboard", { params })
    return unwrap(res)
}

// --- Billing Cases (list/get) ---
// NOTE: If you don’t have these endpoints yet, UI will show empty list but create-case will work.
export async function listBillingCases(params = {}, config = {}) {
    const res = await API.get("/billing/cases", { params, ...config })
    return unwrap(res)
}
export async function getBillingCase(caseId, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}`, { ...config })
    return unwrap(res)
}
export async function listCaseInvoices(caseId, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}/invoices`, { ...config })
    return unwrap(res)
}
export async function listCasePayments(caseId, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}/payments`, { ...config })
    return unwrap(res)
}
export async function listCaseAdvances(caseId, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}/advances`, { ...config })
    return unwrap(res)
}

// --- Create case from OP/IP ---
export async function createCaseFromOpVisit(visitId, params = {}) {
    const res = await API.post(`/billing/cases/opd/visit/${visitId}`, null, { params })
    return unwrap(res)
}
export async function createCaseFromIpAdmission(admissionId, params = {}) {
    const res = await API.post(`/billing/cases/ipd/admission/${admissionId}`, null, { params })
    return unwrap(res)
}

// --- Invoice / Payment / Advance ---
export async function createInvoiceForCase(caseId, params = {}) {
    const res = await API.post(`/billing/cases/${caseId}/invoices`, null, { params })
    return unwrap(res)
}
export async function recordPayment(caseId, params = {}) {
    const res = await API.post(`/billing/cases/${caseId}/payments`, null, { params })
    return unwrap(res)
}
export async function recordAdvance(caseId, params = {}) {
    const res = await API.post(`/billing/cases/${caseId}/advances`, null, { params })
    return unwrap(res)
}

export { pickMsg }
