// FILE: src/api/quickOrders.js
import {
    listLabTests,
    createLisOrder,
    listLisOrders,
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

export async function createOtScheduleFromContext({
    patientId,
    contextType,
    admissionId,
    surgeonUserId,
    anaesthetistUserId,
    date,
    plannedStartTime,
    plannedEndTime,
    priority,
    procedure,   // { id?, name? }
    notes,
}) {
    const ctx = normalizeCtx(contextType)
    if (ctx !== 'ipd') {
        throw new Error('OT scheduling from Quick Orders is only for IPD')
    }
    if (!patientId || !admissionId || !date || !plannedStartTime) {
        throw new Error('Missing patient / admission / date / start time for OT schedule')
    }

    let procedureId = procedure?.id ?? null
    let procedureName = procedure?.name?.trim() || null

    // Try to resolve procedure name to master
    if (!procedureId && procedureName) {
        try {
            const res = await listOtProcedures({
                search: procedureName,
                isActive: true,
                limit: 1,
            })
            const data = res?.data
            const row = Array.isArray(data) ? data[0] : data?.items?.[0]
            if (row) {
                procedureId = row.id
                procedureName = row.name
            }
        } catch (err) {
            console.error('OT procedure master lookup failed for', procedureName, err)
        }
    }

    const payload = {
        patient_id: patientId,
        admission_id: admissionId,
        date,
        planned_start_time: plannedStartTime,
        planned_end_time: plannedEndTime || null,
        priority: priority || 'Elective',
        surgeon_user_id: surgeonUserId || null,
        anaesthetist_user_id: anaesthetistUserId || null,
        notes: notes || null,
        procedure_id: procedureId,
        procedure_name: procedureName,
    }

    const res = await createOtSchedule(payload)
    return res.data
}

export async function listOtSchedulesForContext({
    patientId,
    admissionId,
    limit = 10,
}) {
    if (!patientId) return []

    const res = await listOtSchedules({
        patientId,
        // admissionId also goes as query param via toParams -> admission_id
        admissionId,
    })

    const data = res?.data
    const rows = Array.isArray(data) ? data : data?.items || []

    const filtered = rows.filter((o) => {
        if (admissionId && o.admission_id && o.admission_id !== admissionId) {
            return false
        }
        return true
    })

    return filtered.slice(0, limit)
}
