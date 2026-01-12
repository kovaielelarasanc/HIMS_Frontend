// FILE: frontend/src/api/billings.js
import API, { isCanceledError as _isCanceledError } from "@/api/client"

// ---------------------------------------------------------
// Core helpers
// ---------------------------------------------------------
export const isCanceledError = _isCanceledError

function unwrap(res) {
    const payload = res?.data

    // Standard wrapper: { status, data, error, message }
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

    // Non-wrapped FastAPI responses
    return payload
}

function toIntId(value, label = "id") {
    const v =
        typeof value === "object" && value !== null
            ? value.id ?? value[`${label}_id`] ?? value[`${label}Id`]
            : value
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${label}: invalid id`)
    return n
}

function cleanParams(obj = {}) {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === undefined || v === null) continue
        if (typeof v === "string" && v.trim() === "") continue
        out[k] = v
    }
    return out
}

// POST with query params (FastAPI primitive params)
function postQ(url, params = {}, config = {}) {
    return API.post(url, null, { params: cleanParams(params), ...config })
}
function putQ(url, params = {}, config = {}) {
    return API.put(url, null, { params: cleanParams(params), ...config })
}
function deleteQ(url, params = {}, config = {}) {
    return API.delete(url, { params: cleanParams(params), ...config })
}

async function getBlob(url, config = {}) {
    const res = await API.get(url, { responseType: "blob", ...config })
    return res?.data
}

// =========================================================
// META
// =========================================================
export async function billingModulesMeta(config = {}) {
    const res = await API.get("/billing/meta/modules", config)
    return unwrap(res)
}

export async function billingMetaEnums(config = {}) {
    const res = await API.get("/billing/meta/enums", config)
    return unwrap(res)
}

export async function billingMetaPayers(params = {}, config = {}) {
    const res = await API.get("/billing/meta/payers", {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingMetaReferrers(params = {}, config = {}) {
    const res = await API.get("/billing/meta/referrers", {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingMetaTariffPlans(params = {}, config = {}) {
    const res = await API.get("/billing/meta/tariff-plans", {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingMetaParticulars(config = {}) {
    const res = await API.get("/billing/meta/particulars", config)
    return unwrap(res)
}

// =========================================================
// PATIENT + ENCOUNTERS (manual case create helpers)
// =========================================================
export async function billingSearchPatients(params = {}, config = {}) {
    const res = await API.get("/billing/patients/search", {
        params: cleanParams(params),
        ...config,
    })
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

// =========================================================
// CASES
// =========================================================
export async function billingListCases(params = {}, config = {}) {
    const res = await API.get("/billing/cases", { params: cleanParams(params), ...config })
    return unwrap(res)
}

export async function billingGetCase(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}`, config)
    return unwrap(res)
}

export async function billingCaseDashboard(caseId, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/dashboard`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

export async function billingCaseSummary(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/summary`, config)
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

export async function billingCaseFinance(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/finance`, config)
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

// Case lifecycle (optional if your backend has it)
export async function billingCancelCase(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/cancel`, payload, config)
    return unwrap(res)
}
export async function billingCloseCase(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/close`, payload, config)
    return unwrap(res)
}
export async function billingReopenCase(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/reopen`, payload, config)
    return unwrap(res)
}

// Case statement print (PDF)
export async function billingGetCaseStatementPdf(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    return getBlob(`/billing/cases/${id}/statement/print`, config)
}

// =========================================================
// CASE SUB-RESOURCES: invoices / payments / advances / refunds
// =========================================================
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

export async function billingListRefunds(caseId, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/refunds`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

// Payments (KEEP query-param style for compatibility with your current code)
export async function billingRecordPayment(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await postQ(`/billing/cases/${id}/payments`, payload, config)
    return unwrap(res)
}
export async function billingPayOnCase(caseId, payload = {}, config = {}) {
    return billingRecordPayment(caseId, payload, config)
}

// Advances (query params)
export async function billingRecordAdvance(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await postQ(`/billing/cases/${id}/advances`, payload, config)
    return unwrap(res)
}

// Apply advances (optional)
export async function billingApplyAdvancesToCase(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await postQ(`/billing/cases/${id}/advances/apply`, payload, config)
    return unwrap(res)
}

// Refund deposit (optional)
export async function billingRefundDeposit(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/refunds`, payload, config)
    return unwrap(res)
}

// =========================================================
// INSURANCE (case-level)
// =========================================================
export async function billingGetInsurance(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/insurance`, config)
    const data = unwrap(res)
    // many backends return { insurance: ... }
    return data?.insurance ?? data ?? null
}

export async function billingUpsertInsurance(caseId, payload, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.put(`/billing/cases/${id}/insurance`, payload, config)
    return unwrap(res)
}

// =========================================================
// INVOICE CREATE / DETAIL / HEADER
// =========================================================
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

export async function billingGetInvoice(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}`, config)
    return unwrap(res)
}

// Header edit (PUT) — if your backend supports it
export async function billingUpdateInvoiceHeader(invoiceId, payload = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.put(`/billing/invoices/${id}`, payload, config)
    return unwrap(res)
}

// Recalculate totals — if your backend supports it
export async function billingRecalculateInvoice(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await postQ(`/billing/invoices/${id}/recalculate`, {}, config)
    return unwrap(res)
}

// =========================================================
// INVOICE LINES
// =========================================================
export async function billingListInvoiceLines(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}/lines`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

/**
 * Manual line add
 * - Legacy: POST /billing/invoices/{id}/lines/manual (query params)
 * - New:    POST /billing/invoices/{id}/lines (JSON body)
 *
 * To keep your current UI working, billingAddManualLine uses the LEGACY route.
 * Use billingAddManualLineV2 for the new body route.
 */
export async function billingAddManualLine(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await postQ(`/billing/invoices/${id}/lines/manual`, params, config)
    return unwrap(res)
}
export async function billingAddManualLineV2(invoiceId, payload = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.post(`/billing/invoices/${id}/lines`, payload, config)
    return unwrap(res)
}

// Add lines from LIS/RIS (optional)
export async function billingAddFromLisOrder(invoiceId, orderId, config = {}) {
    const invId = toIntId(invoiceId, "invoiceId")
    const oid = toIntId(orderId, "orderId")
    const res = await postQ(`/billing/invoices/${invId}/lines/from-lis/${oid}`, {}, config)
    return unwrap(res)
}
export async function billingAddFromRisOrder(invoiceId, orderId, config = {}) {
    const invId = toIntId(invoiceId, "invoiceId")
    const oid = toIntId(orderId, "orderId")
    const res = await postQ(`/billing/invoices/${invId}/lines/from-ris/${oid}`, {}, config)
    return unwrap(res)
}

// Update/Delete lines (two common patterns supported)
export async function billingUpdateLine(lineId, payload = {}, config = {}) {
    const lnId = toIntId(lineId, "lineId")
    const res = await API.put(`/billing/lines/${lnId}`, payload, config)
    return unwrap(res)
}
export async function billingDeleteLine(lineId, reason, config = {}) {
    const lnId = toIntId(lineId, "lineId")
    const res = await deleteQ(`/billing/lines/${lnId}`, { reason: reason || "Line removed" }, config)
    return unwrap(res)
}

// Legacy pattern (invoice scoped) — keep if your backend uses it
export async function billingUpdateLineLegacy(invoiceId, lineId, payload = {}, config = {}) {
    const invId = toIntId(invoiceId, "invoiceId")
    const lnId = toIntId(lineId, "lineId")
    const res = await API.put(`/billing/invoices/${invId}/lines/${lnId}`, payload, config)
    return unwrap(res)
}
export async function billingDeleteLineLegacy(invoiceId, lineId, reason, config = {}) {
    const invId = toIntId(invoiceId, "invoiceId")
    const lnId = toIntId(lineId, "lineId")
    const res = await API.delete(`/billing/invoices/${invId}/lines/${lnId}`, {
        params: cleanParams({ reason: reason || "Line removed" }),
        ...config,
    })
    return unwrap(res)
}

// =========================================================
// INVOICE LIFECYCLE
// =========================================================
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

export async function billingReopenInvoice(invoiceId, payload = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.post(`/billing/invoices/${id}/reopen`, payload, config)
    return unwrap(res)
}

// Edit request workflow (support both endpoint styles)
export async function billingRequestInvoiceEdit(invoiceId, payload = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    // newer endpoint (recommended)
    const res = await API.post(`/billing/invoices/${id}/edit-request`, payload, config)
    return unwrap(res)
}
export async function billingRequestInvoiceEditLegacy(invoiceId, payload = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    // older endpoint (if your backend has centralized edit-requests)
    const res = await API.post(`/billing/invoices/${id}/edit-requests`, payload, config)
    return unwrap(res)
}
export async function billingListEditRequests(params = {}, config = {}) {
    const res = await API.get(`/billing/edit-requests`, { params: cleanParams(params), ...config })
    return unwrap(res)
}
export async function billingApproveEditRequest(requestId, payload = {}, config = {}) {
    const id = toIntId(requestId, "requestId")
    const res = await API.post(`/billing/edit-requests/${id}/approve`, payload, config)
    return unwrap(res)
}
export async function billingRejectEditRequest(requestId, payload = {}, config = {}) {
    const id = toIntId(requestId, "requestId")
    const res = await API.post(`/billing/edit-requests/${id}/reject`, payload, config)
    return unwrap(res)
}

// Audit logs (optional)
export async function billingListInvoiceAuditLogs(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}/audit-logs`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

// =========================================================
// CHARGE ITEMS (two common backend patterns)
// =========================================================

/**
 * ✅ Recommended (case routed): POST /billing/cases/{case_id}/charge-items/add
 * Backend decides which module invoice to attach or creates draft if needed.
 */
export async function billingAddChargeItemLineToCase(caseId, payload = {}, params = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/charge-items/add`, payload, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

/**
 * Legacy (invoice scoped): POST /masters/charge-items/invoices/{invoice_id}/lines/charge-item
 * Keep this export name because your existing UI calls billingAddChargeItemLine(invoiceId,...)
 */
export async function billingAddChargeItemLine(invoiceId, payload = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.post(`/masters/charge-items/invoices/${id}/lines/charge-item`, payload, config)
    return unwrap(res)
}

// =========================================================
// PARTICULARS (dynamic “add item” UI)
// =========================================================
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

// =========================================================
// PAYMENTS: invoice payments + receipts
// =========================================================
export async function billingListInvoicePayments(invoiceId, params = {}, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    const res = await API.get(`/billing/invoices/${id}/payments`, {
        params: cleanParams(params),
        ...config,
    })
    return unwrap(res)
}

// Receipt print/void (optional)
export async function billingGetReceiptPdf(paymentId, config = {}) {
    const id = toIntId(paymentId, "paymentId")
    return getBlob(`/billing/payments/${id}/print`, config)
}
export async function billingVoidReceipt(paymentId, payload = {}, config = {}) {
    const id = toIntId(paymentId, "paymentId")
    const res = await API.post(`/billing/payments/${id}/void`, payload, config)
    return unwrap(res)
}

// =========================================================
// INVOICE PRINT/EXPORT
// =========================================================
export async function billingGetInvoicePdf(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    // Your backend might be /print or /pdf; keep both helpers if needed.
    return getBlob(`/billing/invoices/${id}/print`, config)
}
export async function billingExportInvoiceCsv(invoiceId, config = {}) {
    const id = toIntId(invoiceId, "invoiceId")
    return getBlob(`/billing/invoices/${id}/export.csv`, config)
}

// =========================================================
// INSURANCE: PREAUTH (optional)
// =========================================================
export async function billingListPreauths(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/insurance/preauths`, config)
    return unwrap(res)
}
export async function billingCreatePreauth(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/insurance/preauths`, payload, config)
    return unwrap(res)
}
export async function billingGetPreauth(preauthId, config = {}) {
    const id = toIntId(preauthId, "preauthId")
    const res = await API.get(`/billing/preauths/${id}`, config)
    return unwrap(res)
}
export async function billingSubmitPreauth(preauthId, payload = {}, config = {}) {
    const id = toIntId(preauthId, "preauthId")
    const res = await API.post(`/billing/preauths/${id}/submit`, payload, config)
    return unwrap(res)
}
export async function billingApprovePreauth(preauthId, payload = {}, config = {}) {
    const id = toIntId(preauthId, "preauthId")
    const res = await API.post(`/billing/preauths/${id}/approve`, payload, config)
    return unwrap(res)
}
export async function billingRejectPreauth(preauthId, payload = {}, config = {}) {
    const id = toIntId(preauthId, "preauthId")
    const res = await API.post(`/billing/preauths/${id}/reject`, payload, config)
    return unwrap(res)
}
export async function billingCancelPreauth(preauthId, payload = {}, config = {}) {
    const id = toIntId(preauthId, "preauthId")
    const res = await API.post(`/billing/preauths/${id}/cancel`, payload, config)
    return unwrap(res)
}

// =========================================================
// INSURANCE: CLAIMS (optional)
// =========================================================
export async function billingCreateOrRefreshClaimFromInvoice(caseId, payload = {}, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.post(`/billing/cases/${id}/insurance/claims/from-invoice`, payload, config)
    return unwrap(res)
}
export async function billingListClaims(caseId, config = {}) {
    const id = toIntId(caseId, "caseId")
    const res = await API.get(`/billing/cases/${id}/insurance/claims`, config)
    return unwrap(res)
}
export async function billingGetClaim(claimId, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.get(`/billing/claims/${id}`, config)
    return unwrap(res)
}
export async function billingSubmitClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/submit`, payload, config)
    return unwrap(res)
}
export async function billingAcknowledgeClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/acknowledge`, payload, config)
    return unwrap(res)
}
export async function billingApproveClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/approve`, payload, config)
    return unwrap(res)
}
export async function billingSettleClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/settle`, payload, config)
    return unwrap(res)
}
export async function billingRejectClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/reject`, payload, config)
    return unwrap(res)
}
export async function billingCancelClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/cancel`, payload, config)
    return unwrap(res)
}
export async function billingReopenClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/reopen`, payload, config)
    return unwrap(res)
}
export async function billingSetClaimUnderQuery(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/set-query`, payload, config)
    return unwrap(res)
}
export async function billingCloseClaim(claimId, payload = {}, config = {}) {
    const id = toIntId(claimId, "claimId")
    const res = await API.post(`/billing/claims/${id}/close`, payload, config)
    return unwrap(res)
}
