// FILE: src/api/quickOrders.js
import {
    listLabTests,
    createLisOrder,
    listLisOrders,
    fetchLisReportPdf,
} from './lab'

import {
    listRisTests,
    createRisOrder,
    listRisOrders,
} from './ris'

import {
    searchPharmacyItems,
    createPharmacyPrescription,
    listPharmacyPrescriptions,
    getPharmacyPrescriptionDetails,
    fetchPharmacyPrescriptionPdf
} from './pharmacy'

import {
    listOtProcedures,
    listOtSchedules,
    createOtSchedule,
} from './ot'

/**
 * Normalise context type to "opd" | "ipd"
 */
function normalizeCtx(ctx) {
    if (!ctx) return null
    const v = String(ctx).toLowerCase()
    if (v === 'op' || v === 'opd') return 'opd'
    if (v === 'ip' || v === 'ipd') return 'ipd'
    return v
}

/* ============================================================
 * LAB: create order FROM CONTEXT (OPD / IPD)
 * Uses LAB TEST MASTER first, then /lab/orders
 * ========================================================== */

export async function createLabOrderFromContext({
    patientId,
    contextType,
    contextId,
    orderingUserId,
    priority = 'routine',
    items = [],     // [{ id?, name, code }]
    note,           // currently not used in backend
}) {
    const ctx = normalizeCtx(contextType)

    if (!patientId || !ctx || !contextId) {
        throw new Error('Missing patient / context for lab order')
    }

    // 1) Resolve each item to LabTest master → get test_ids[]
    const testIds = []

    for (const it of items) {
        const q = (it.code || it.name || '').trim()
        if (!q) continue

        try {
            const res = await listLabTests({ q, page: 1, page_size: 1 })
            const row = res?.data?.items?.[0]
            if (row) {
                testIds.push(row.id)
            }
        } catch (err) {
            console.error('Lab master lookup failed for', q, err)
        }
    }

    if (!testIds.length) {
        throw new Error('No matching lab tests found in master')
    }

    // 2) Create LIS order using /lab/orders (NOT /lis/orders)
    const res = await createLisOrder({
        patient_id: patientId,
        context_type: ctx,      // "opd" | "ipd"
        context_id: contextId,
        priority,
        test_ids: testIds,
        ordering_user_id: orderingUserId || null,
    })

    return res.data
}

export async function listLabOrdersForContext({
    patientId,
    contextType,
    contextId,
    limit = 10,
}) {
    if (!patientId) return []

    const ctx = normalizeCtx(contextType)

    const res = await listLisOrders({ patient_id: patientId })
    const rows = Array.isArray(res?.data) ? res.data : []

    const filtered = rows.filter((o) => {
        if (ctx && o.context_type && o.context_type !== ctx) return false
        if (contextId && o.context_id && o.context_id !== contextId) return false
        return true
    })

    return filtered.slice(0, limit)
}

/* ============================================================
 * RADIOLOGY: create orders FROM CONTEXT (uses RIS master)
 * ========================================================== */

export async function createRadiologyOrdersFromContext({
    patientId,
    contextType,
    contextId,
    orderingUserId,
    items = [],   // [{ name, code }]
    note,         // not used yet
}) {
    const ctx = normalizeCtx(contextType)
    if (!patientId || !ctx || !contextId) {
        throw new Error('Missing patient / context for radiology order')
    }

    const created = []

    for (const it of items) {
        const q = (it.code || it.name || '').trim()
        if (!q) continue

        try {
            const res = await listRisTests({ q, page: 1, page_size: 1 })
            const test = res?.data?.items?.[0]
            if (!test) continue

            const out = await createRisOrder({
                patient_id: patientId,
                test_id: test.id,
                context_type: ctx,
                context_id: contextId,
                ordering_user_id: orderingUserId || null,
                priority: 'routine',
            })

            created.push(out.data)
        } catch (err) {
            console.error('Failed to create radiology order from master', q, err)
        }
    }

    if (!created.length) {
        throw new Error('No matching radiology tests found in master')
    }

    return created
}

export async function listRadiologyOrdersForContext({
    patientId,
    contextType,
    contextId,
    limit = 10,
}) {
    if (!patientId) return []

    const ctx = normalizeCtx(contextType)
    const res = await listRisOrders({ patient_id: patientId })
    const rows = Array.isArray(res?.data) ? res.data : []

    const filtered = rows.filter((o) => {
        if (ctx && o.context_type && o.context_type !== ctx) return false
        if (contextId && o.context_id && o.context_id !== contextId) return false
        return true
    })

    return filtered.slice(0, limit)
}

/* ============================================================
 * PHARMACY: prescription FROM CONTEXT (uses inventory master)
 * ========================================================== */

export async function createPharmacyPrescriptionFromContext({
    patientId,
    contextType,
    contextId,
    doctorUserId,
    locationId,
    notes,
    lines = [],   // [{ item_name, requested_qty, dose_text, frequency_code, duration_days, route, timing, instructions }]
}) {
    const ctx = normalizeCtx(contextType)
    if (!patientId || !ctx || !contextId) {
        throw new Error('Missing patient / context for prescription')
    }

    const rxType = ctx === 'ipd' ? 'IPD' : 'OPD'

    const mappedLines = []

    for (const line of lines) {
        const name = (line.item_name || '').trim()
        if (!name) continue

        try {
            const res = await searchPharmacyItems({ q: name, type: 'drug', limit: 1 })
            const item = res?.data?.[0]
            if (!item) continue

            mappedLines.push({
                item_id: item.id,
                requested_qty: line.requested_qty || 1,
                dose_text: line.dose_text || null,
                frequency_code: line.frequency_code || null,
                timing: line.timing || null,
                duration_days: line.duration_days || null,
                instructions: line.instructions || null,
            })
        } catch (err) {
            console.error('Pharmacy master lookup failed for', name, err)
        }
    }

    if (!mappedLines.length) {
        throw new Error('No medicines found in inventory master')
    }

    const payload = {
        type: rxType,
        patient_id: patientId,
        visit_id: ctx === 'opd' ? contextId : null,
        ipd_admission_id: ctx === 'ipd' ? contextId : null,
        location_id: locationId ?? null,
        doctor_user_id: doctorUserId ?? null,
        notes: notes || null,
        lines: mappedLines,
    }

    const res = await createPharmacyPrescription(payload)
    return res.data
}

export async function listPharmacyPrescriptionsForContext({
    patientId,
    contextType,
    contextId,
    limit = 10,
}) {
    if (!patientId) return []

    const ctx = normalizeCtx(contextType)
    const type = ctx === 'ipd' ? 'IPD' : 'OPD'

    const res = await listPharmacyPrescriptions({
        patient_id: patientId,
        type,
        visit_id: ctx === 'opd' ? contextId : undefined,
        ipd_admission_id: ctx === 'ipd' ? contextId : undefined,
    })

    const rows = Array.isArray(res?.data) ? res.data : []
    return rows.slice(0, limit)
}

/* ============================================================
 * OT: schedule FROM CONTEXT (IPD only, uses OT procedures master)
 * ========================================================== */

export function createOtScheduleFromContext({
    patientId,
    contextType,        // 'opd' | 'ipd'
    admissionId,        // only for IPD
    bedId,              // optional
    surgeonUserId,      // required by backend
    anaesthetistUserId, // optional
    date,               // 'YYYY-MM-DD'
    plannedStartTime,   // 'HH:MM'
    plannedEndTime,     // 'HH:MM' or null
    priority,           // 'Elective' | 'Emergency'
    side,               // 'Right' | 'Left' | ...
    procedureName,      // free-text
    primaryProcedureId, // optional
    additionalProcedureIds = [],
    notes,
}) {
    const ctx = normalizeCtx(contextType)

    // 🔒 Frontend validation to avoid 422 from Pydantic
    if (!date || !plannedStartTime) {
        throw new Error('OT date and start time are required')
    }

    if (!surgeonUserId) {
        // because in your schema: surgeon_user_id: int (required)
        throw new Error('Surgeon is required for OT schedule')
    }

    const procName = (procedureName || '').trim()
    if (!procName) {
        // because procedure_name: str (required)
        throw new Error('Procedure name is required for OT schedule')
    }

    // 🔒 Normalize types for Pydantic (no empty strings!)
    const payload = {
        date, // 'YYYY-MM-DD'

        planned_start_time: plannedStartTime,        // 'HH:MM'
        planned_end_time: plannedEndTime || null,   // null if empty

        patient_id: patientId ? Number(patientId) : null,
        admission_id:
            ctx === 'ipd' && admissionId
                ? Number(admissionId)
                : null,

        bed_id: bedId ? Number(bedId) : null,

        surgeon_user_id: Number(surgeonUserId),
        anaesthetist_user_id: anaesthetistUserId
            ? Number(anaesthetistUserId)
            : null,

        procedure_name: procName,
        side: side || null,

        priority: priority || 'Elective',
        notes: notes || null,

        primary_procedure_id: primaryProcedureId
            ? Number(primaryProcedureId)
            : null,

        additional_procedure_ids: Array.isArray(additionalProcedureIds)
            ? additionalProcedureIds.map((id) => Number(id))
            : [],
    }

    // ✅ reuse your existing OT client
    return createOtSchedule(payload)
}

/**
 * List OT schedules for a patient/context, used in QuickOrders summary
 */
export async function listOtSchedulesForContext({
    patientId,
    contextType,
    contextId,
    limit = 10,
}) {
    if (!patientId) return []

    const ctx = normalizeCtx(contextType)

    // Backend supports patient_id filter
    const res = await listOtSchedules({ patient_id: patientId })
    const rows = Array.isArray(res?.data) ? res.data : []

    const filtered = rows.filter((s) => {
        // For IPD, keep only schedules for same admission
        if (ctx === 'ipd' && contextId && s.admission_id && s.admission_id !== contextId) {
            return false
        }
        return true
    })

    return filtered.slice(0, limit)
}


// ✅ NEW
export async function getRxDetails(rxId) {
    const res = await getPharmacyPrescriptionDetails(rxId)
    return res.data
}

export async function downloadRxPdf(rxId) {
    return fetchPharmacyPrescriptionPdf(rxId) // returns axios blob
}

// -----------------------------
// Lab PDF (AUTH SAFE): fetch blob via Axios
// -----------------------------
const labPdfActions = async (orderId, mode) => {
    if (!orderId) return toast.error('Invalid Lab Order ID')
    try {
        const res = await fetchLisReportPdf(orderId)
        const blob = new Blob([res.data], { type: 'application/pdf' })

        if (mode === 'view') openBlobInNewTab(blob)
        if (mode === 'download') downloadBlob(blob, `lab_report_${orderId}.pdf`)
        if (mode === 'print') printBlob(blob)
    } catch (e) {
        console.error(e)
        toast.error(extractApiError(e, 'Lab PDF failed'))
    }
}