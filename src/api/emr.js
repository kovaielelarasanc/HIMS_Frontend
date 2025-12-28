// frontend/src/api/emr.js
// frontend/src/api/emr.js
import API from "./client"
import { listPatients } from "./patients"

// Optional: keep if you already have backend lookup endpoint
export function lookupPatients(q) {
    return API.get("/emr/patients/lookup", { params: { q } })
}

// ✅ FIX: accept string OR object
export const emrSearchPatients = (qOrParams = {}) => {
    // If someone calls emrSearchPatients("vasanthi")
    if (typeof qOrParams === "string") {
        const term = qOrParams
        return listPatients({ q: term, limit: 20, offset: 0 })
    }

    const { q = "", limit = 20, offset = 0 } = qOrParams || {}
    return listPatients({ q, limit, offset })
}

// OPD

export const emrGetVisitSummary = (visit_id) =>
    API.get(`/emr/opd/visits/${visit_id}/summary`)

export const emrGetPatientOpdVisits = (patient_id, { limit = 50 } = {}) =>
    API.get(`/emr/patients/${patient_id}/opd/visits`, { params: { limit } })

export const emrDownloadVisitSummaryPdf = (visit_id) =>
    API.get(`/emr/opd/visits/${visit_id}/summary/pdf`, { responseType: "blob" })

export const emrDownloadPatientOpdHistoryPdf = (patient_id, params = {}) =>
    API.get(`/emr/patients/${patient_id}/opd/history/pdf`, {
        params,
        responseType: "blob",
    })


// laboratory

export const emrGetPatientLabOrders = (patient_id, { limit = 100 } = {}) =>
    API.get(`/emr/patients/${patient_id}/lab/orders`, { params: { limit } })

export const emrGetLabOrderReport = (order_id) =>
    API.get(`/emr/lab/orders/${order_id}/report`)

export const emrDownloadLabReportPdf = (order_id) =>
    API.get(`/emr/lab/orders/${order_id}/report/pdf`, { responseType: "blob" })

export const emrDownloadPatientLabHistoryPdf = (patient_id, params = {}) =>
    API.get(`/emr/patients/${patient_id}/lab/history/pdf`, {
        params,
        responseType: "blob",
    })

// pharmacy


// List prescriptions (your backend supports filters)
export const emrGetPatientPharmacyPrescriptions = (
    patientId,
    { type = null, status = null, date_from = null, date_to = null } = {}
) =>
    API.get("/pharmacy/prescriptions", {
        params: {
            patient_id: patientId,
            type,
            status,
            date_from,
            date_to,
        },
    })

// Details (includes lines + patient + doctor)
export const emrGetPharmacyPrescription = (rxId) =>
    API.get(`/pharmacy/prescriptions/${rxId}`)

// PDF (StreamingResponse)
export const emrDownloadPharmacyPrescriptionPdf = (rxId) =>
    API.get(`/pharmacy/prescriptions/${rxId}/pdf`, { responseType: "blob" })