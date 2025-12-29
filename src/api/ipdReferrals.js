// FILE: src/api/ipdReferrals.js
import API from './client'

const unwrap = (res) => {
  const payload = res?.data
  if (!payload?.status) {
    const msg = payload?.error?.msg || payload?.detail || 'Something went wrong'
    throw new Error(msg)
  }
  return payload.data
}

// List referrals (supports filters: status/ref_type/category/priority/limit)
export const getIpdReferrals = (admissionId, params = {}) =>
  API.get(`/ipd/admissions/${admissionId}/referrals`, { params }).then(unwrap)

// Create referral
export const createIpdReferral = (admissionId, payload) =>
  API.post(`/ipd/admissions/${admissionId}/referrals`, payload).then(unwrap)

// Get single referral (with events)
export const getIpdReferral = (admissionId, refId) =>
  API.get(`/ipd/admissions/${admissionId}/referrals/${refId}`).then(unwrap)

// Workflow actions
export const acceptIpdReferral = (admissionId, refId, payload = {}) =>
  API.post(`/ipd/admissions/${admissionId}/referrals/${refId}/accept`, payload).then(unwrap)

export const declineIpdReferral = (admissionId, refId, payload) =>
  API.post(`/ipd/admissions/${admissionId}/referrals/${refId}/decline`, payload).then(unwrap)

export const respondIpdReferral = (admissionId, refId, payload) =>
  API.post(`/ipd/admissions/${admissionId}/referrals/${refId}/respond`, payload).then(unwrap)

export const closeIpdReferral = (admissionId, refId, payload = {}) =>
  API.post(`/ipd/admissions/${admissionId}/referrals/${refId}/close`, payload).then(unwrap)

export const cancelIpdReferral = (admissionId, refId, payload) =>
  API.post(`/ipd/admissions/${admissionId}/referrals/${refId}/cancel`, payload).then(unwrap)
