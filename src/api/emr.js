// frontend/src/api/emr.js
import API from './client'

export function lookupPatients(q) {
    return API.get('/emr/patients/lookup', { params: { q } })
}

export function fetchEmrTimeline({ patient_id, uhid, date_from, date_to, types } = {}) {
    let typesParam

    if (Array.isArray(types)) {
        // If we get an array, join it
        typesParam = types.length ? types.join(',') : undefined
    } else if (typeof types === 'string') {
        // If we already got a comma-separated string, just pass it through
        typesParam = types || undefined
    } else {
        // Nothing passed
        typesParam = undefined
    }

    return API.get('/emr/timeline', {
        params: {
            patient_id,
            uhid,
            date_from: date_from || undefined,
            date_to: date_to || undefined,
            types: typesParam,
        },
    })
}

export function exportEmrPdfJson(payload) {
    // payload = { patient_id, date_from?, date_to?, sections, consent_required? }
    return API.post('/emr/export/pdf-json', payload, { responseType: 'blob' })
}

export function exportEmrPdfMultipart(formData) {
    // formData has: patient_id, date_from?, date_to?, sections?, consent_required?, letterhead?
    return API.post('/emr/export/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
    })
}

export function fetchFhirBundle(patient_id, date_from, date_to) {
    return API.get(`/emr/fhir/${patient_id}`, { params: { date_from, date_to } })
}
