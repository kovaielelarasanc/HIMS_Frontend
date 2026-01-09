// FILE: frontend/src/api/ot.js
// FILE: frontend/src/api/ot.js
import API from './client'
import { toast } from 'sonner'

// ✅ Install once (also safe in Vite HMR)
const OT_TOAST_FLAG = '__NUTRYAH_OT_TOAST_INTERCEPTOR__'

function _otToastTitle(method, url = '') {
    const u = String(url)
    const m = String(method || '').toLowerCase()

    if (m === 'post' && u.includes('/open-case')) return 'OT case opened'
    if (m === 'post' && u.includes('/close')) return 'OT case closed'
    if (m === 'delete' && u.includes('/schedules/')) return 'OT schedule cancelled'

    if (m === 'post') return 'Saved successfully'
    if (m === 'put' || m === 'patch') return 'Updated successfully'
    if (m === 'delete') return 'Deleted successfully'
    return 'Success'
}

function _shouldToast(config) {
    if (!config) return false
    const url = String(config.url || '')
    const method = String(config.method || '').toLowerCase()

    // only OT routes
    const isOt = url.startsWith('/ot') || url.includes('/ot/')
    if (!isOt) return false

    // only mutations
    if (!['post', 'put', 'patch', 'delete'].includes(method)) return false

    // allow per-request disable
    if (config.silentToast) return false
    if (config.headers?.['x-no-toast']) return false

    return true
}

if (!globalThis[OT_TOAST_FLAG]) {
    globalThis[OT_TOAST_FLAG] = true

    API.interceptors.response.use(
        (res) => {
            const cfg = res?.config
            if (_shouldToast(cfg)) {
                const msg = cfg.toastSuccess || _otToastTitle(cfg.method, cfg.url)
                toast.success(msg)
            }
            return res
        },
        (err) => {
            const cfg = err?.config
            if (_shouldToast(cfg)) {
                const msg =
                    err?.response?.data?.detail ||
                    cfg?.toastError ||
                    'Request failed. Please try again.'
                toast.error(msg)
            }
            return Promise.reject(err)
        }
    )
}


// ---------- helpers ----------
const toParams = (obj = {}) => {
    const out = {}
    Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') out[k] = v
    })
    return out
}

/* =========================================================
   OT MASTERS
   ========================================================= */

// ---------- OT SPECIALITIES ----------
export function listOtSpecialities({ active, search } = {}) {
    const params = toParams({ active, search })
    return API.get('/ot/specialities', { params })
}
export function getOtSpeciality(id) {
    return API.get(`/ot/specialities/${id}`)
}
export function createOtSpeciality(data) {
    return API.post('/ot/specialities', data)
}
export function updateOtSpeciality(id, data) {
    return API.put(`/ot/specialities/${id}`, data)
}
export function deleteOtSpeciality(id) {
    return API.delete(`/ot/specialities/${id}`)
}

// ---------- OT PROCEDURES ----------
export function listOtProcedures({ search, specialityId, isActive, limit } = {}) {
    const params = toParams({
        search,
        speciality_id: specialityId,
        is_active: typeof isActive === 'boolean' ? isActive : undefined,
        limit,
    })
    return API.get('/ot/procedures', { params })
}
export function getOtProcedure(id) {
    return API.get(`/ot/procedures/${id}`)
}
export function createOtProcedure(data) {
    return API.post('/ot/procedures', data)
}
export function updateOtProcedure(id, data) {
    return API.put(`/ot/procedures/${id}`, data)
}
export function deleteOtProcedure(id) {
    return API.delete(`/ot/procedures/${id}`)
}

// ---------- OT THEATRES (✅ backend is /ot/theatres) ----------
export function listOtTheatres({ active, search, specialityId, q, limit } = {}) {
    const params = toParams({
        active,
        search: search ?? q,
        speciality_id: specialityId,
        q,
        limit,
    })
    return API.get('/ot/theatres', { params })
}
export function getOtTheatre(id) {
    return API.get(`/ot/theatres/${id}`)
}
export function createOtTheatre(data) {
    return API.post('/ot/theatres', data)
}
export function updateOtTheatre(id, data) {
    return API.put(`/ot/theatres/${id}`, data)
}
export function deleteOtTheatre(id) {
    return API.delete(`/ot/theatres/${id}`)
}

// ---------- OT EQUIPMENT ----------
export function listOtEquipment({ active, search, critical } = {}) {
    const params = toParams({ active, search, critical })
    return API.get('/ot/equipment', { params })
}
export function getOtEquipment(id) {
    return API.get(`/ot/equipment/${id}`)
}
export function createOtEquipment(data) {
    return API.post('/ot/equipment', data)
}
export function updateOtEquipment(id, data) {
    return API.put(`/ot/equipment/${id}`, data)
}
export function deleteOtEquipment(id) {
    return API.delete(`/ot/equipment/${id}`)
}

// ---------- OT ENVIRONMENT SETTINGS ----------
export function listOtEnvironmentSettings({ theatreId, theatre_id } = {}) {
    const params = toParams({
        theatre_id: theatre_id ?? theatreId,
    })
    return API.get('/ot/environment-settings', { params })
}
export function getOtEnvironmentSetting(id) {
    return API.get(`/ot/environment-settings/${id}`)
}
export function createOtEnvironmentSetting(data) {
    return API.post('/ot/environment-settings', data)
}
export function updateOtEnvironmentSetting(id, data) {
    return API.put(`/ot/environment-settings/${id}`, data)
}
export function deleteOtEnvironmentSetting(id) {
    return API.delete(`/ot/environment-settings/${id}`)
}

/* =========================================================
   OT SCHEDULES (✅ matches app/api/routes_ot_schedule_cases.py)
   ========================================================= */

const normalizeScheduleQuery = (opts = {}) => {
    const {
        // date filters
        date,
        date_from,
        date_to,
        fromDate,
        toDate,

        // theatre filter (backend expects ot_theater_id)
        ot_theater_id,
        otTheaterId,
        theatreId,
        theaterId,

        // other
        status,
        q,
        search,
        limit,

        ...rest
    } = opts || {}

    const df = date_from ?? fromDate ?? date ?? undefined
    const dt = date_to ?? toDate ?? date ?? undefined

    const theater =
        ot_theater_id ?? otTheaterId ?? theatreId ?? theaterId ?? undefined

    return toParams({
        date_from: df,
        date_to: dt,
        ot_theater_id: theater,
        status,
        q: q ?? search,
        limit,
        ...rest,
    })
}

// ✅ GET /ot/schedules
export function listOtSchedules(opts = {}) {
    const params = normalizeScheduleQuery(opts)
    return API.get('/ot/schedules', { params })
}

// ✅ GET /ot/schedules/{id}
export function getOtSchedule(id) {
    return API.get(`/ot/schedules/${id}`)
}

// ✅ POST /ot/schedules
export function createOtSchedule(data) {
    return API.post('/ot/schedules', data)
}

// ✅ PUT /ot/schedules/{id}
export function updateOtSchedule(id, data) {
    return API.put(`/ot/schedules/${id}`, data)
}

// ✅ DELETE /ot/schedules/{id}  (backend cancels by setting status=cancelled)
export function cancelOtSchedule(id) {
    return API.delete(`/ot/schedules/${id}`)
}

// (optional alias)
export function deleteOtSchedule(id) {
    return cancelOtSchedule(id)
}

/* =========================================================
   OPEN / CLOSE CASE (✅ matches backend)
   ========================================================= */

// ✅ POST /ot/schedule/{schedule_id}/open-case  (NOTE: singular "schedule")
export function openOtCaseFromSchedule(scheduleId, payload = {}) {
    return API.post(`/ot/schedule/${scheduleId}/open-case`, payload)
}

// keep old exported name if any page uses it
export function openOtCaseForSchedule(scheduleId, payload = {}) {
    return API.post(`/ot/schedule/${scheduleId}/open-case`, payload)
}

// ✅ POST /ot/cases/{case_id}/close
export function closeOtCase(caseId, payload) {
    return API.post(`/ot/cases/${caseId}/close`, payload)
}

/* =========================================================
   OT CASES (✅ matches backend list filters)
   ========================================================= */

export function listOtCases({
    date,
    otBedId,
    ot_bed_id,
    surgeonUserId,
    surgeon_user_id,
    patientId,
    patient_id,
} = {}) {
    const params = toParams({
        date,
        ot_bed_id: ot_bed_id ?? otBedId,
        surgeon_user_id: surgeon_user_id ?? surgeonUserId,
        patient_id: patient_id ?? patientId,
    })
    return API.get('/ot/cases', { params })
}

export function getOtCase(caseId) {
    return API.get(`/ot/cases/${caseId}`)
}

export function createOtCase(data) {
    return API.post('/ot/cases', data)
}

export function updateOtCase(id, data) {
    return API.put(`/ot/cases/${id}`, data)
}

export function deleteOtCase(id) {
    return API.delete(`/ot/cases/${id}`)
}

/* =========================================================
   CLINICAL: PRE-ANAESTHESIA (keep if backend exists)
   ========================================================= */

export function getPreAnaesthesia(caseId) {
    return API.get(`/ot/cases/${caseId}/pre-anaesthesia`)
}
export function createPreAnaesthesia(caseId, data) {
    return API.post(`/ot/cases/${caseId}/pre-anaesthesia`, {
        ...data,
        case_id: caseId,
    })
}
export function updatePreAnaesthesia(caseId, data) {
    return API.put(`/ot/cases/${caseId}/pre-anaesthesia`, data)
}

/* =========================================================
   CLINICAL: PRE-OP CHECKLIST (✅ exists in your backend)
   ========================================================= */

export function getPreOpChecklist(caseId) {
    return API.get(`/ot/cases/${caseId}/preop-checklist`).then((res) => res.data)
}
export function createPreOpChecklist(caseId, payload) {
    return API.post(`/ot/cases/${caseId}/preop-checklist`, payload).then(
        (res) => res.data
    )
}
export function updatePreOpChecklist(caseId, payload) {
    return API.put(`/ot/cases/${caseId}/preop-checklist`, payload).then(
        (res) => res.data
    )
}

export const getPreopChecklistPdf = (caseId, { download = false } = {}) => {
    const qs = download ? "?download=1" : ""
    return API.get(`/ot/cases/${caseId}/preop-checklist/pdf${qs}`, {
        responseType: "blob",
    }).then((res) => res.data)
}

/* =========================================================
   CLINICAL: SURGICAL SAFETY CHECKLIST
   ========================================================= */
const unwrap = (res) => {
    const payload = res?.data
    if (payload && typeof payload === 'object' && payload.status === false) {
        throw new Error(payload?.error?.msg || 'Something went wrong')
    }
    return payload?.data ?? payload
}
export const fetchSafetyChecklistPdfBlob = (caseId, { download = false } = {}) =>
    API.get(`/ot/cases/${caseId}/safety-checklist/pdf`, {
        params: download ? { download: true } : {},
        responseType: 'blob',
    }).then((res) => res.data)

export const getSafetyChecklistPdf = (caseId, { download = false } = {}) =>
    API.get(`/ot/cases/${caseId}/safety-checklist/pdf`, {
        responseType: "blob",
        params: download ? { download: true } : {},
    })
export async function getSafetyChecklist(caseId) {
    try {
        const res = await API.get(`/ot/cases/${caseId}/safety-checklist`)
        return res.data
    } catch (e) {
        if (e?.response?.status === 404) return null // ✅ not created yet
        throw e
    }
}

export async function createSafetyChecklist(caseId, data) {
    const res = await API.post(`/ot/cases/${caseId}/safety-checklist`, {
        ...data,
        case_id: caseId,
    })
    return res.data
}

// ✅ backend PUT already behaves like create() if missing
export async function updateSafetyChecklist(caseId, data) {
    const res = await API.put(`/ot/cases/${caseId}/safety-checklist`, data)
    return res.data
}
/* =========================================================
   CLINICAL: ANAESTHESIA RECORD (keep if backend exists)
   ========================================================= */
export const listOtDeviceMasters = (params = {}) =>
    API.get('/ot/device-masters', { params })
export const getAnaesthesiaRecord = (caseId) =>
    API.get(`/ot/cases/${caseId}/anaesthesia-record`)
export const createAnaesthesiaRecord = (caseId, data) =>
    API.post(`/ot/cases/${caseId}/anaesthesia-record`, data)
export const updateAnaesthesiaRecord = (caseId, data) =>
    API.put(`/ot/cases/${caseId}/anaesthesia-record`, data)

export const listAnaesthesiaVitals = (recordId) =>
    API.get(`/ot/anaesthesia-records/${recordId}/vitals`)
export const createAnaesthesiaVital = (recordId, data) =>
    API.post(`/ot/anaesthesia-records/${recordId}/vitals`, data)
export const deleteAnaesthesiaVital = (vitalId) =>
    API.delete(`/ot/anaesthesia-vitals/${vitalId}`)

export const listAnaesthesiaDrugs = (recordId) =>
    API.get(`/ot/anaesthesia-records/${recordId}/drugs`)
export const createAnaesthesiaDrug = (recordId, data) =>
    API.post(`/ot/anaesthesia-records/${recordId}/drugs`, data)
export const deleteAnaesthesiaDrug = (drugId) =>
    API.delete(`/ot/anaesthesia-drugs/${drugId}`)

export const getAnaesthesiaRecordPdf = (caseId, { download = false } = {}) =>
    API.get(`/ot/cases/${caseId}/anaesthesia-record/pdf`, {
        params: { download: download ? 1 : 0 },
        responseType: "blob",
    })
export function getAnaesthesiaRecordDefaults(caseId) {
    return API.get(`/ot/cases/${caseId}/anaesthesia-record/defaults`)
}
/* =========================================================
   NURSING (keep if backend exists)
   ========================================================= */

export function getNursingRecord(caseId) {
    return API.get(`/ot/cases/${caseId}/nursing-record`)
}
export function createNursingRecord(caseId, data) {
    return API.post(`/ot/cases/${caseId}/nursing-record`, {
        ...data,
        case_id: caseId,
        primary_nurse_id: data.primary_nurse_id ?? null,
    })
}
export function updateNursingRecord(caseId, data) {
    return API.put(`/ot/cases/${caseId}/nursing-record`, {
        ...data,
        case_id: caseId,
        primary_nurse_id: data.primary_nurse_id ?? null,
    })
}

/* =========================================================
   COUNTS (keep if backend exists)
   ========================================================= */

export function getCountsRecord(caseId) {
    return API.get(`/ot/cases/${caseId}/counts`)
}
export function createCountsRecord(caseId, data) {
    return API.post(`/ot/cases/${caseId}/counts`, data)
}
export function updateCountsRecord(caseId, data) {
    return API.put(`/ot/cases/${caseId}/counts`, data)
}
// ---- Counts: Instrument Lines (EXTREME) ----
export function listOtInstrumentMasters(params = {}) {
    return API.get("/ot/instrument-masters", { params })
}

export function listCountsItems(caseId) {
    return API.get(`/ot/cases/${caseId}/counts/items`)
}

export function upsertCountsItems(caseId, payload) {
    // payload: { lines: [...] }
    return API.put(`/ot/cases/${caseId}/counts/items`, payload)
}

export function deleteCountsItem(caseId, lineId) {
    return API.delete(`/ot/cases/${caseId}/counts/items/${lineId}`)
}
/* =========================================================
   IMPLANTS (keep if backend exists)
   ========================================================= */

export function listImplants(caseId) {
    return API.get(`/ot/cases/${caseId}/implants`)
}
export function createImplant(caseId, data) {
    return API.post(`/ot/cases/${caseId}/implants`, { ...data, case_id: caseId })
}
export function updateImplant(implantId, data) {
    return API.put(`/ot/implants/${implantId}`, data)
}
export function deleteImplant(implantId) {
    return API.delete(`/ot/implants/${implantId}`)
}

/* =========================================================
   OPERATION NOTE (keep if backend exists)
   ========================================================= */

export function getOperationNote(caseId) {
    return API.get(`/ot/cases/${caseId}/operation-note`)
}
export function createOperationNote(caseId, data) {
    return API.post(`/ot/cases/${caseId}/operation-note`, {
        ...data,
        case_id: caseId,
    })
}
export function updateOperationNote(caseId, data) {
    return API.put(`/ot/cases/${caseId}/operation-note`, data)
}

/* =========================================================
   BLOOD TRANSFUSION
   - you had TWO sets in your file, so keeping both styles:
   ========================================================= */

// Style A: /blood-transfusions
export function listOtBloodTransfusions(caseId) {
    return API.get(`/ot/cases/${caseId}/blood-transfusions`)
}
export function createOtBloodTransfusion(caseId, data) {
    return API.post(`/ot/cases/${caseId}/blood-transfusions`, {
        ...data,
        case_id: caseId,
    })
}
export function updateOtBloodTransfusion(recordId, data) {
    return API.put(`/ot/blood-transfusions/${recordId}`, data)
}
export function deleteOtBloodTransfusion(recordId) {
    return API.delete(`/ot/blood-transfusions/${recordId}`)
}

// Style B: /transfusions  ✅ FIXED (your build error was here)
export function listBloodTransfusions(caseId) {
    return API.get(`/ot/cases/${caseId}/transfusions`)
}
export function createBloodTransfusion(caseId, payload) {
    return API.post(`/ot/cases/${caseId}/transfusions`, payload)
}
export function updateBloodTransfusion(transfusionId, payload) {
    return API.put(`/ot/transfusions/${transfusionId}`, payload)
}
export function deleteBloodTransfusion(transfusionId) {
    return API.delete(`/ot/transfusions/${transfusionId}`)
}

/* =========================================================
   PACU / RECOVERY (keep if backend exists)
   ========================================================= */

export function getPacuRecord(caseId) {
    return API.get(`/ot/cases/${caseId}/pacu`)
}
export function createPacuRecord(caseId, payload) {
    return API.post(`/ot/cases/${caseId}/pacu`, payload)
}
export function updatePacuRecord(caseId, payload) {
    return API.put(`/ot/cases/${caseId}/pacu`, payload)
}
// ✅ PDF
export function getPacuRecordPdf(caseId) {
    return API.get(`/ot/cases/${caseId}/pacu/pdf`, { responseType: "blob" })
}
/* =========================================================
   PDF HELPERS (✅ matches backend)
   ========================================================= */

// ✅ GET /ot/cases/{case_id}/pdf
export async function openOtCasePdfInNewTab(caseId) {
    const res = await API.get(`/ot/cases/${caseId}/pdf`, {
        params: { disposition: 'inline' },
        responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadOtCasePdf(caseId, filename = 'ot-case.pdf') {
    const res = await API.get(`/ot/cases/${caseId}/pdf`, {
        params: { disposition: 'attachment' },
        responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ✅ GET /ot/patients/{patient_id}/history.pdf
export async function openPatientOtHistoryPdfInNewTab(patientId) {
    const res = await API.get(`/ot/patients/${patientId}/history.pdf`, {
        params: { disposition: 'inline' },
        responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadPatientOtHistoryPdf(
    patientId,
    filename = 'patient-ot-history.pdf'
) {
    const res = await API.get(`/ot/patients/${patientId}/history.pdf`, {
        params: { disposition: 'attachment' },
        responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function getOtCasePdfBlob(caseId, disposition = 'attachment') {
    return API.get(`/ot/cases/${caseId}/pdf`, {
        params: { disposition },
        responseType: 'blob',
        headers: { Accept: 'application/pdf' },
    })
}
