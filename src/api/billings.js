// FILE: src/api/billings.js
import API from "@/api/client"

// -----------------------------
// Helpers
// -----------------------------
function unwrap(res) {
    const payload = res?.data
    if (payload?.status === false) {
        throw new Error(payload?.error?.msg || payload?.error?.message || "Request failed")
    }
    return payload?.data ?? payload
}

export function isCanceledError(e) {
    return (
        e?.code === "ERR_CANCELED" ||
        e?.name === "CanceledError" ||
        String(e?.message || "").toLowerCase().includes("canceled")
    )
}

// FastAPI primitive params => send as query params
function postQ(url, params = {}, config = {}) {
    return API.post(url, null, { params, ...config })
}

function mergeGetConfig(params = {}, config = {}) {
    return { params, ...config }
}

function patchJSON(url, data = {}, config = {}) {
    return API.patch(url, data, {
        headers: { "Content-Type": "application/json" },
        ...config,
    })
}

function deleteReq(url, config = {}) {
    return API.delete(url, { ...config })
}

async function getBlob(url, config = {}) {
    const res = await API.get(url, { responseType: "blob", ...config })
    return res?.data
}


export async function billingSearchPatients(params = {}, config = {}) {
    const res = await API.get("/billing/patients/search", { params, ...config })
    return unwrap(res)
}

export async function billingListPatientEncounters(patientId, params = {}, config = {}) {
    const res = await API.get(`/billing/patients/${patientId}/encounters`, { params, ...config })
    return unwrap(res)
}

export async function billingCreateCaseManual(payload, config = {}) {
    const res = await API.post("/billing/cases/manual", payload, config)
    return unwrap(res)
}
// -----------------------------
// Cases
// -----------------------------
export async function billingListCases(params = {}, config = {}) {
    const res = await API.get("/billing/cases", { params, ...config })
    return unwrap(res)
}
export async function billingGetCase(caseId, config = {}) {
    const id =
        typeof caseId === "object" && caseId !== null
            ? (caseId.id ?? caseId.case_id)
            : caseId

    const n = Number(id)
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error("billingGetCase: invalid caseId")
    }

    const res = await API.get(`/billing/cases/${n}`, config)
    return unwrap(res)
}

export async function billingListInvoices(caseId, params = {}, config = {}) {
    const n = Number(typeof caseId === "object" && caseId ? (caseId.id ?? caseId.case_id) : caseId)
    if (!Number.isFinite(n) || n <= 0) throw new Error("billingListInvoices: invalid caseId")
    const res = await API.get(`/billing/cases/${n}/invoices`, { params, ...config })
    return unwrap(res)
}

export async function billingListPayments(caseId, params = {}, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}/payments`, { params, ...config })
    return unwrap(res)
}

export async function billingListAdvances(caseId, params = {}, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}/advances`, { params, ...config })
    return unwrap(res)
}

export async function billingGetInsurance(caseId, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}/insurance`, config)
    const data = unwrap(res)
    // backend returns { insurance: ... }
    return data?.insurance ?? null
}


// -----------------------------
// Invoice create
// -----------------------------
export async function billingCreateInvoice(caseId, payload) {
    const n = Number(typeof caseId === "object" && caseId ? (caseId.id ?? caseId.case_id) : caseId)
    if (!Number.isFinite(n) || n <= 0) throw new Error("billingCreateInvoice: invalid caseId")
    const res = await API.post(`/billing/cases/${n}/invoices`, null, { params: payload })
    return unwrap(res)
}

// -----------------------------
// Invoice detail / lines
// -----------------------------
export async function billingGetInvoice(invoiceId, config = {}) {
    const res = await API.get(`/billing/invoices/${invoiceId}`, { ...config })
    return unwrap(res)
}

export async function billingListInvoiceLines(invoiceId, params = {}, config = {}) {
    const res = await API.get(`/billing/invoices/${invoiceId}/lines`, mergeGetConfig(params, config))
    return unwrap(res)
}

// -----------------------------
// Invoice lifecycle
// -----------------------------
export async function billingApproveInvoice(invoiceId, config = {}) {
    const res = await postQ(`/billing/invoices/${invoiceId}/approve`, {}, config)
    return unwrap(res)
}

export async function billingPostInvoice(invoiceId, config = {}) {
    const res = await postQ(`/billing/invoices/${invoiceId}/post`, {}, config)
    return unwrap(res)
}

export async function billingVoidInvoice(invoiceId, { reason } = {}, config = {}) {
    const res = await postQ(`/billing/invoices/${invoiceId}/void`, { reason: reason || "Voided" }, config)
    return unwrap(res)
}

// -----------------------------
// Lines: manual add
// -----------------------------
export async function billingAddManualLine(invoiceId, params = {}, config = {}) {
    const res = await postQ(`/billing/invoices/${invoiceId}/lines/manual`, params, config)
    return unwrap(res)
}

// -----------------------------
// Lines: update / delete (optional routes)
// These may not exist in your backend snippet.
// We try common patterns for compatibility.
// -----------------------------
export async function billingUpdateLine(invoiceId, lineId, patch = {}, config = {}) {
    // Try: PATCH /billing/invoices/{invoiceId}/lines/{lineId}
    try {
        const res = await patchJSON(`/billing/invoices/${invoiceId}/lines/${lineId}`, patch, config)
        return unwrap(res)
    } catch (e1) {
        // Fallback: PATCH /billing/lines/{lineId}
        const status = e1?.response?.status
        if (status === 404 || status === 405) {
            const res = await patchJSON(`/billing/lines/${lineId}`, patch, config)
            return unwrap(res)
        }
        throw e1
    }
}

export async function billingDeleteLine(invoiceId, lineId, config = {}) {
    // Try: DELETE /billing/invoices/{invoiceId}/lines/{lineId}
    try {
        const res = await deleteReq(`/billing/invoices/${invoiceId}/lines/${lineId}`, config)
        return unwrap(res)
    } catch (e1) {
        // Fallback: DELETE /billing/lines/{lineId}
        const status = e1?.response?.status
        if (status === 404 || status === 405) {
            const res = await deleteReq(`/billing/lines/${lineId}`, config)
            return unwrap(res)
        }
        throw e1
    }
}

// -----------------------------
// Invoice meta update (optional route)
// Expecting: PATCH /billing/invoices/{id}
// -----------------------------
export async function billingUpdateInvoice(invoiceId, payload = {}, config = {}) {
    const res = await patchJSON(`/billing/invoices/${invoiceId}`, payload, config)
    return unwrap(res)
}

// -----------------------------
// Invoice PDF (optional route)
// Expecting: GET /billing/invoices/{id}/pdf
// -----------------------------
export async function billingGetInvoicePdf(invoiceId, config = {}) {
    return getBlob(`/billing/invoices/${invoiceId}/pdf`, config)
}

// -----------------------------
// Payments / Advances (FastAPI params => query params)
// -----------------------------
export async function billingRecordPayment(caseId, payload) {
    const res = await API.post(`/billing/cases/${caseId}/payments`, null, { params: payload })
    return unwrap(res)
}

export async function billingRecordAdvance(caseId, payload) {
    const res = await API.post(`/billing/cases/${caseId}/advances`, null, { params: payload })
    return unwrap(res)
}


export async function billingMetaParticulars(config = {}) {
    const res = await API.get(`/billing/meta/particulars`, config)
    return unwrap(res)
}

export async function billingParticularOptions(caseId, code, params = {}, config = {}) {
    const res = await API.get(`/billing/cases/${caseId}/particulars/${code}/options`, {
        ...config,
        params,
    })
    return unwrap(res)
}

export async function billingParticularAdd(caseId, code, payload, config = {}) {
    const res = await API.post(`/billing/cases/${caseId}/particulars/${code}/add`, payload, config)
    return unwrap(res)
}




export async function billingCaseDashboard(caseId, params = {}, opts = {}) {
  const res = await API.get(`/billing/cases/${caseId}/dashboard`, { params, ...opts })
  return unwrap(res)
}

export async function billingCaseInvoiceSummary(caseId, params = {}, opts = {}) {
  const res = await API.get(`/billing/cases/${caseId}/invoice-summary`, { params, ...opts })
  return unwrap(res)
}

export async function billingMetaPayers(params = {}, opts = {}) {
  const res = await API.get(`/billing/meta/payers`, { params, ...opts })
  return unwrap(res)
}

export async function billingMetaReferrers(params = {}, opts = {}) {
  const res = await API.get(`/billing/meta/referrers`, { params, ...opts })
  return unwrap(res)
}

export async function billingGetCaseSettings(caseId, opts = {}) {
  const res = await API.get(`/billing/cases/${caseId}/settings`, { ...opts })
  return unwrap(res)
}

export async function billingUpdateCaseSettings(caseId, payload, opts = {}) {
  const res = await API.put(`/billing/cases/${caseId}/settings`, payload, { ...opts })
  return unwrap(res)
}
export async function billingModulesMeta(config) {
  const res = await API.get("/billing/meta/modules", config)
  return unwrap(res)
}

export async function billingListInvoicePayments(invoiceId, params = {}, config = {}) {
  const res = await API.get(`/billing/invoices/${invoiceId}/payments`, { params, ...config })
  return unwrap(res)
}

// ✅ Your backend pay() receives query params (NOT JSON body)
export async function billingPayOnCase(caseId, payload, config = {}) {
  const res = await API.post(`/billing/cases/${caseId}/payments`, null, { params: payload, ...config })
  return unwrap(res)
}

// These 2 endpoints must be added in backend (below)
export async function billingRequestInvoiceEdit(invoiceId, payload, config = {}) {
  const res = await API.post(`/billing/invoices/${invoiceId}/edit-request`, payload, config)
  return unwrap(res)
}

export async function billingReopenInvoice(invoiceId, payload, config = {}) {
  const res = await API.post(`/billing/invoices/${invoiceId}/reopen`, payload, config)
  return unwrap(res)
}