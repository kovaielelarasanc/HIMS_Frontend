// FILE: src/api/patients.js
import API from './client';

// Single patient (alias)
export const getPatientById = (id) => API.get(`/patients/${id}`);

// -------- core patients --------

export function listPatients(q = '') {
    const params = q ? { q } : {};
    return API.get('/patients', { params });
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
