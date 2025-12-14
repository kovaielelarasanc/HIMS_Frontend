// FILE: src/api/advances.js
import API from './client'

// Create advance/deposit (patient wallet top-up)
export function createAdvance(payload) {
    return API.post('/billing/advances', payload)
}

// // List advances for a patient
// export function listPatientAdvances(patientId) {
//     return API.get(`/billing/advances/patient/${patientId}`)
// }

// // Summary for a patient (total/used/available)
// export function getPatientAdvanceSummary(patientId) {
//     return API.get(`/billing/advances/patient/${patientId}/summary`)
// }

// Apply advance to an invoice (amount is required)
export function applyAdvanceToInvoice(invoiceId, payload) {
    return API.post(`/billing/advances/apply/${invoiceId}`, payload)
}

// -------- Patient Advance Wallet (NEW) --------

// List advances for a patient (wallet entries)
export function listPatientAdvances(patientId) {
  return API.get(`/billing/advances/patient/${patientId}`)
}

// Summary for a patient (total/used/available)
export function getPatientAdvanceSummary(patientId) {
  return API.get(`/billing/advances/patient/${patientId}/summary`)
}

// Apply wallet advance to a specific invoice (amount required)
export function applyAdvanceWalletToInvoice(invoiceId, payload) {
  // payload: { amount }
  return API.post(`/billing/advances/apply/${invoiceId}`, payload)
}
