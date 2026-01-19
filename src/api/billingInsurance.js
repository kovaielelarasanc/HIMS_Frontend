import API from "@/api/client"

// helper: treat 404/409 as "not configured" for insurance-related reads
async function safeGet(promise) {
    try {
        return await promise
    } catch (e) {
        const code = e?.response?.status
        if (code === 404 || code === 409) return null
        throw e
    }
}
async function safeList(promise) {
    try {
        const res = await promise
        return Array.isArray(res) ? res : (res?.items ?? res?.data?.items ?? res?.data ?? [])
    } catch (e) {
        const code = e?.response?.status
        if (code === 404 || code === 409) return []
        throw e
    }
}

// -----------------
// Insurance Case
// -----------------
export const insGet = (caseId) =>
    safeGet(API.get(`/billing/cases/${caseId}/insurance`).then((r) => r.data))

export const insUpsert = (caseId, payload) =>
    API.put(`/billing/cases/${caseId}/insurance`, payload).then((r) => r.data)

// -----------------
// Coverage Lines
// -----------------
export const insLines = (caseId) =>
    safeList(API.get(`/billing/cases/${caseId}/insurance/lines`).then((r) => r.data))

// ✅ backend expects LIST body directly: Body(List[InsuranceLinePatch])
export const insPatchLines = (caseId, patches) =>
    API.patch(`/billing/cases/${caseId}/insurance/lines`, patches).then((r) => r.data)

// -----------------
// Split Invoices
// -----------------
export async function insSplit(caseId, invoice_ids, opts = {}) {
    const qs = opts.allow_paid_split ? "?allow_paid_split=true" : ""
    const { data } = await API.post(`/billing/cases/${caseId}/insurance/split${qs}`, { invoice_ids })
    return data
}


// -----------------
// Preauth (✅ NOT under /insurance in your backend)
// -----------------
export const preauthList = (caseId) =>
    safeList(API.get(`/billing/cases/${caseId}/preauths`).then((r) => r.data))

export const preauthCreate = (caseId, payload) =>
    API.post(`/billing/cases/${caseId}/preauths`, payload).then((r) => r.data)

export const preauthSubmit = (caseId, preauthId) =>
    API.post(`/billing/cases/${caseId}/preauths/${preauthId}/submit`).then((r) => r.data)

// ✅ backend routes: /preauths/{id}/approve|partial|reject (no caseId in path)
export const preauthApprove = (_caseId, preauthId, payload) =>
    API.post(`/billing/preauths/${preauthId}/approve`, payload).then((r) => r.data)

export const preauthPartial = (_caseId, preauthId, payload) =>
    API.post(`/billing/preauths/${preauthId}/partial`, payload).then((r) => r.data)

export const preauthReject = (_caseId, preauthId, payload) =>
    API.post(`/billing/preauths/${preauthId}/reject`, payload).then((r) => r.data)

// -----------------
// Claims (✅ list/create are case-based; actions are /claims/{id}/...)
// -----------------
export const claimList = (caseId) =>
    safeList(API.get(`/billing/cases/${caseId}/claims`).then((r) => r.data))

export const claimCreate = (caseId, payload) =>
    API.post(`/billing/cases/${caseId}/claims`, payload).then((r) => r.data)

export const claimSubmit = (_caseId, claimId) =>
    API.post(`/billing/claims/${claimId}/submit`).then((r) => r.data)

export const claimSettle = (_caseId, claimId, payload) =>
    API.post(`/billing/claims/${claimId}/settle`, payload).then((r) => r.data)

export const claimDeny = (_caseId, claimId, payload) =>
    API.post(`/billing/claims/${claimId}/deny`, payload).then((r) => r.data)

export const claimQuery = (_caseId, claimId, payload) =>
    API.post(`/billing/claims/${claimId}/query`, payload).then((r) => r.data)

export const claimApprove = (_caseId, claimId, payload) =>
    API.post(`/billing/claims/${claimId}/approve`, payload).then((r) => r.data)