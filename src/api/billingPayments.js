// FILE: frontend/src/api/billingPayments.js
import API, { isCanceledError as _isCanceledError } from "@/api/client"

// Helper: supports both axios-style (res.data) and fetch-style (Response)
async function unwrap(res) {
    if (!res) return null
    if (typeof res.json === "function") return await res.json()          // fetch Response
    if (res.data !== undefined) return res.data                          // axios response
    return res                                                           // already-data
}

function getErrorMessage(e, fallback) {
    // axios error format
    const d = e?.response?.data
    if (typeof d === "string") return d
    if (d?.detail) return d.detail
    if (d?.message) return d.message
    return e?.message || fallback
}

export async function getCaseFinancials(caseId) {
    try {
        const res = await API.get(`/billing/multi/cases/${caseId}/financials`)
        return await unwrap(res)
    } catch (e) {
        if (_isCanceledError?.(e)) throw e
        throw new Error(getErrorMessage(e, "Failed to load financials"))
    }
}

export async function postCasePayment(caseId, payload) {
    try {
        // ✅ MUST be POST (not get)
        const res = await API.post(`/billing/multi/cases/${caseId}/payments`, payload)
        return await unwrap(res)
    } catch (e) {
        if (_isCanceledError?.(e)) throw e
        throw new Error(getErrorMessage(e, "Payment failed"))
    }
}
