// FILE: src/api/billings.js
import API from "@/api/client"

// -----------------------------
// Core helpers
// -----------------------------
function unwrap(res) {
    const payload = res?.data

    // Our standard API wrapper: { status, data, error }
    if (payload && typeof payload === "object" && "status" in payload) {
        if (payload?.status === false) {
            throw new Error(
                payload?.error?.msg ||
                payload?.error?.message ||
                payload?.message ||
                "Request failed"
            )
        }
        return payload?.data ?? payload
    }

    // Fallback (non-wrapped responses)
    return payload
}

export function isCanceledError(e) {
    return (
        e?.code === "ERR_CANCELED" ||
        e?.name === "CanceledError" ||
        e?.name === "AbortError" ||
        String(e?.message || "").toLowerCase().includes("canceled")
    )
}

function toIntId(value, label = "id") {
    const v =
        typeof value === "object" && value !== null ? (value.id ?? value[`${label}_id`]) : value
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${label}: invalid id`)
    return n
}

function cleanParams(obj = {}) {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === undefined || v === null) continue
        out[k] = v
    }
    return out
}

// FastAPI primitive params => send as query params via POST with null body
function postQ(url, params = {}, config = {}) {
    return API.post(url, null, { params: cleanParams(params), ...config })
}

function patchJSON(url, data = {}, config = {}) {
    return API.patch(url, data, {
        headers: { "Content-Type": "application/json" },
        ...config,
    })
}

async function getBlob(url, config = {}) {
    const res = await API.get(url, { responseType: "blob", ...config })
    return res?.data
}

// -----------------------------
// Patient + encounters
// -----------------------------
export async function billingSearchPatients(params = {}, config = {}) {
    const res = await API.get("/billing/patients/search", { params: cleanParams(params), ...config })
    return unwrap(res)
}

export async function billingListPatientEncounters(patientId, params = {}, config = {}) {
    const pid = toIntId(patientId, "patientId")
    const res = await API.get(`/billing/patients/${pid}/encounters`, {
        params: cleanParams(params),
        ...config,
    })
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
    const res = await API.get("/billing/cases", { params: cleanParams(params), ...config })
    return unwrap(res)
}

export async function billingGetCase(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}`, config)
    return unwrap(res)
}

export async function billingListInvoices(caseId, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/invoices`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingListPayments(caseId, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/payments`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingListAdvances(caseId, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/advances`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingGetInsurance(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/insurance`, config)
    const data = unwrap(res)
    // backend returns { insurance: ... }
    return data?.insurance ?? null
}

// -----------------------------
// Invoice create (module is query param in backend)
// -----------------------------
export async function billingCreateInvoice(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const params = cleanParams({
        module: payload?.module,
        invoice_type: payload?.invoice_type,
        payer_type: payload?.payer_type,
        payer_id: payload?.payer_id,
        reset_period: payload?.reset_period,
        allow_duplicate_draft: payload?.allow_duplicate_draft,
    })

    if (!params.module) throw new Error("billingCreateInvoice: module is required")

    const res = await API.post(`/billing/cases/${id}/invoices`, null, { params, ...config })
    return unwrap(res)
}

// -----------------------------
// Invoice detail / lines
// -----------------------------
export async function billingGetInvoice(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}`, config)
    return unwrap(res)
}

export async function billingListInvoiceLines(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}/lines`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

// -----------------------------
// Invoice lifecycle
// -----------------------------
export async function billingApproveInvoice(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await postQ(`/billing/invoices/${id}/approve`, {}, config)
    return unwrap(res)
}

export async function billingPostInvoice(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await postQ(`/billing/invoices/${id}/post`, {}, config)
    return unwrap(res)
}

export async function billingVoidInvoice(invoiceId, { reason } = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await postQ(
        `/billing/invoices/${id}/void`,
        { reason: reason || "Voided" },
        config
    )
    return unwrap(res)
}

// -----------------------------
// Lines: manual add (query params)
// -----------------------------
export async function billingAddManualLine(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await postQ(`/billing/invoices/${id}/lines/manual`, params, config)
    return unwrap(res)
}

// -----------------------------
// Lines: update / delete (if your backend supports it)
// -----------------------------
export async function billingUpdateLine(invoiceId, lineId, payload = {}, config = {}) {
    const invId = toIntId(invoiceId, "invoiceId")
    const lnId = toIntId(lineId, "lineId")
    const res = await API.put(`/billing/invoices/${invId}/lines/${lnId}`, payload, config)
    return unwrap(res)
}

export async function billingDeleteLine(invoiceId, lineId, reason, config = {}) {
    const invId = toIntId(invoiceId, "invoiceId")
    const lnId = toIntId(lineId, "lineId")
    const rsn = String(reason || "Line removed")
    const res = await API.delete(`/billing/invoices/${invId}/lines/${lnId}`, {
        params: { reason: rsn },
        ...config,
    })
    return unwrap(res)
}

// -----------------------------
// Invoice meta update (optional)
// PATCH /billing/invoices/{id}
// -----------------------------
export async function billingUpdateInvoice(invoiceId, payload = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await patchJSON(`/billing/invoices/${id}`, payload, config)
    return unwrap(res)
}

// -----------------------------
// Invoice PDF (optional)
// GET /billing/invoices/{id}/pdf
// -----------------------------
export async function billingGetInvoicePdf(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    return getBlob(`/billing/invoices/${id}/pdf`, config)
}

// -----------------------------
// Payments / Advances (query params)
// -----------------------------
export async function billingRecordPayment(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/payments`, null, {
        params: cleanParams(payload),
        ...config,
    })
    return unwrap(res)
}

export async function billingRecordAdvance(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/advances`, null, {
        params: cleanParams(payload),
        ...config,
    })
    return unwrap(res)
}

export async function billingListInvoicePayments(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}/payments`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

// ✅ pay() receives query params (NOT JSON body)
export async function billingPayOnCase(caseId, payload = {}, config = {}) {
    return billingRecordPayment(caseId, payload, config)
}

// -----------------------------
// Meta / Particulars
// -----------------------------
export async function billingModulesMeta(config = {}) {
    const res = await API.get("/billing/meta/modules", config)
    return unwrap(res)
}

export async function billingMetaParticulars(config = {}) {
    const res = await API.get(`/billing/meta/particulars`, config)
    return unwrap(res)
}

export async function billingParticularOptions(caseId, code, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const c = encodeURIComponent(String(code || ""))
    if (!c) throw new Error("billingParticularOptions: code required")
    const res = await API.get(`/billing/cases/${id}/particulars/${c}/options`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingParticularAdd(caseId, code, payload, config = {}) {
    const id = toIntId(caseId, "caseId")
    const c = encodeURIComponent(String(code || ""))
    if (!c) throw new Error("billingParticularAdd: code required")
    const res = await API.post(`/billing/cases/${id}/particulars/${c}/add`, payload, config)
    return unwrap(res)
}

// -----------------------------
// Dashboard helpers
// -----------------------------
export async function billingCaseDashboard(caseId, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/dashboard`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingCaseInvoiceSummary(caseId, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/invoice-summary`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingMetaPayers(params = {}, config = {}) {
    const res = await API.get(`/billing/meta/payers`, { params: cleanParams(params), ...config })
    return unwrap(res)
}

export async function billingMetaReferrers(params = {}, config = {}) {
    const res = await API.get(`/billing/meta/referrers`, { params: cleanParams(params), ...config })
    return unwrap(res)
}

export async function billingGetCaseSettings(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/settings`, config)
    return unwrap(res)
}

export async function billingUpdateCaseSettings(caseId, payload, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.put(`/billing/cases/${id}/settings`, payload, config)
    return unwrap(res)
}

// -----------------------------
// Edit request workflow
// -----------------------------
export async function billingRequestInvoiceEdit(invoiceId, payload, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.post(`/billing/invoices/${id}/edit-requests`, payload, config)
    return unwrap(res)
}

export async function billingListEditRequests(params = {}, config = {}) {
    const res = await API.get(`/billing/edit-requests`, { params: cleanParams(params), ...config })
    return unwrap(res)
}

export async function billingApproveEditRequest(requestId, payload, config = {}) {
    const id = toIntId(requestId, "requestId")
    const res = await API.post(`/billing/edit-requests/${id}/approve`, payload, config)
    return unwrap(res)
}

export async function billingRejectEditRequest(requestId, payload, config = {}) {
    const id = toIntId(requestId, "requestId")
    const res = await API.post(`/billing/edit-requests/${id}/reject`, payload, config)
    return unwrap(res)
}

export async function billingListInvoiceAuditLogs(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}/audit-logs`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingReopenInvoice(invoiceId, payload, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.post(`/billing/invoices/${id}/reopen`, payload, config)
    return unwrap(res)
}

// -----------------------------
// Charge-item line add (your backend route is under /masters)
// POST /masters/charge-items/invoices/{invoice_id}/lines/charge-item
// -----------------------------
export async function billingAddChargeItemLine(invoiceId, payload = {}, config = {}) {
    const res = await API.post(
        `/masters/charge-items/invoices/${invoiceId}/lines/charge-item`,
        payload,
        config
    )
    return unwrap(res)
}

