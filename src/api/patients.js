// FILE: src/api/patients.js
import API from './client';

// Single patient (alias)
export const getPatientById = (id) => API.get(`/patients/${id}`);

// -------- core patients --------

export const listPatients = (queryOrParams) => {
    let params = {}
    if (typeof queryOrParams === 'string') {
        if (queryOrParams) params.q = queryOrParams
    } else if (queryOrParams && typeof queryOrParams === 'object') {
        params = queryOrParams
    }
    return API.get('/patients', { params })
}
export function getPatient(id) {
    return API.get(`/patients/${id}`);
}

export function createPatient(payload) {
    return API.post('/patients', payload);
}

export function updatePatient(id, payload) {
    return API.put(`/patients/${id}`, payload);
}

export function deactivatePatient(id) {
    return API.patch(`/patients/${id}/deactivate`);
}

// -------- addresses --------

export function addPatientAddress(patientId, payload) {
    return API.post(`/patients/${patientId}/addresses`, payload);
}

export function listPatientAddresses(patientId) {
    return API.get(`/patients/${patientId}/addresses`);
}

export function updatePatientAddress(addrId, payload) {
    return API.put(`/patients/addresses/${addrId}`, payload);
}

export function deletePatientAddress(addrId) {
    return API.delete(`/patients/addresses/${addrId}`);
}

// -------- documents --------

export function uploadPatientDocument(patientId, { type, file }) {
    const form = new FormData();
    form.append('type', type || 'other');
    form.append('file', file);
    return API.post(`/patients/${patientId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
}

export function listPatientDocuments(patientId) {
    return API.get(`/patients/${patientId}/documents`);
}

// -------- consents --------

export function listPatientConsents(patientId) {
    return API.get(`/patients/${patientId}/consents`);
}

export function createPatientConsent(patientId, payload) {
    return API.post(`/patients/${patientId}/consents`, payload);
}

// -------- print info --------

export async function openPatientPrintWindow(patientId) {
    const res = await API.get(`/patients/${patientId}/print-info`, {
        responseType: 'blob',
    });

    const contentType = res.headers['content-type'] || 'application/octet-stream';
    const blob = new Blob([res.data], { type: contentType });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Optional: revoke later
    // setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// -------- patient masters / lookups --------
// New backend: /patient-masters/*

export function listReferenceSources() {
    return API.get('/patient-masters/reference-sources');
}

export function listDoctorRefs() {
    return API.get('/patient-masters/doctors');
}

export function listPayers() {
    return API.get('/patient-masters/payers');
}

export function listTpas() {
    return API.get('/patient-masters/tpas');
}

export function listCreditPlans() {
    return API.get('/patient-masters/credit-plans');
}

// Aggregated all-in-one for patient registration screen
export function getPatientMastersAll() {
    return API.get('/patient-masters/all');
}

// -------- ABHA demo --------

export function abhaGenerate({ name, dob, mobile }) {
    // Backend expects simple query params
    return API.post(
        '/abha/generate',
        {},
        {
            params: { name, dob, mobile },
        }
    );
}

export function abhaVerifyOtp({ txnId, otp, patientId }) {
    return API.post(
        '/abha/verify-otp',
        {},
        {
            params: { txnId, otp, patient_id: patientId },
        }
    );
}



export function exportPatientsExcel(params) {
    // params: { from_date, to_date, patient_type? }
    return API.get('/patients/export', {
        params,
        responseType: 'blob',
    })
}

// -------- Masters used in PatientForm --------


// Optional: if you want a separate Patient Type master screen
export const listPatientTypes = (params = {}) =>
    API.get('/patient-types', { params })

export const createPatientType = (payload) =>
    API.post('/patient-types', payload)

export const updatePatientType = (id, payload) =>
    API.put(`/patient-types/${id}`, payload)

export const deactivatePatientType = (id) =>
    API.delete(`/patient-types/${id}`)




// src/api/patients.js
export function listPatientAuditLogs(patientId, params = {}) {
    const query = {
        table_name: 'patients',
        record_id: patientId,
        ...params,
    };
    return API.get('/audit-logs', { params: query });  // 👈 GET
}








// -------- audit logs (per-patient) --------
// Uses generic /audit-logs endpoint filtered by table_name + record_id.
// Backend: GET /audit-logs?table_name=patients&record_id=<patientId>&limit=30
// export function listPatientAuditLogs(patientId, params = {}) {
//     const query = {
//         table_name: 'patients',
//         record_id: patientId,
//         ...params,
//     };
//     return API.get('/audit-logs', { params: query });
// }
