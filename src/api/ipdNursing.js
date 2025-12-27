// FILE: src/api/ipdNursing.js
import API from './client'

const unwrap = (res) => {
    const payload = res?.data
    if (!payload?.status) {
        const msg = payload?.error?.msg || 'Something went wrong'
        throw new Error(msg)
    }
    return payload.data
}

export const getNursingAlerts = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/nursing/alerts`).then(unwrap)

/* ---------------- Dressing ---------------- */
export const listDressing = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/dressing-records`).then(unwrap)

export const createDressing = (admissionId, body) =>
    API.post(`/ipd/admissions/${admissionId}/dressing-records`, body).then(unwrap)

export const updateDressing = (recordId, body) =>
    API.patch(`/ipd/dressing-records/${recordId}`, body).then(unwrap)

/* ---------------- ICU Flow ---------------- */
export const listIcuFlow = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/icu-flow`).then(unwrap)

export const latestIcuFlow = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/icu-flow/latest`).then(unwrap)

export const createIcuFlow = (admissionId, body) =>
    API.post(`/ipd/admissions/${admissionId}/icu-flow`, body).then(unwrap)

export const updateIcuFlow = (flowId, body) =>
    API.patch(`/ipd/icu-flow/${flowId}`, body).then(unwrap)

/* ---------------- Isolation ---------------- */
export const listIsolation = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/isolation`).then(unwrap)

export const createIsolation = (admissionId, body) =>
    API.post(`/ipd/admissions/${admissionId}/isolation`, body).then(unwrap)

export const updateIsolation = (isoId, body) =>
    API.patch(`/ipd/isolation/${isoId}`, body).then(unwrap)

export const stopIsolation = (isoId, body) =>
    API.post(`/ipd/isolation/${isoId}/stop`, body).then(unwrap)

/* ---------------- Restraints ---------------- */
export const listRestraints = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/restraints`).then(unwrap)

export const createRestraint = (admissionId, body) =>
    API.post(`/ipd/admissions/${admissionId}/restraints`, body).then(unwrap)

export const updateRestraint = (restraintId, body) =>
    API.patch(`/ipd/restraints/${restraintId}`, body).then(unwrap)

export const stopRestraint = (restraintId, body) =>
    API.post(`/ipd/restraints/${restraintId}/stop`, body).then(unwrap)

export const addRestraintMonitor = (restraintId, body) =>
    API.post(`/ipd/restraints/${restraintId}/monitor`, body).then(unwrap)

/* ---------------- Transfusion ---------------- */
export const listTransfusions = (admissionId) =>
    API.get(`/ipd/admissions/${admissionId}/transfusions`).then(unwrap)

export const createTransfusion = (admissionId, body) =>
    API.post(`/ipd/admissions/${admissionId}/transfusions`, body).then(unwrap)

export const updateTransfusion = (transfusionId, body) =>
    API.patch(`/ipd/transfusions/${transfusionId}`, body).then(unwrap)

export const addTransfusionVital = (transfusionId, body) =>
    API.post(`/ipd/transfusions/${transfusionId}/vitals`, body).then(unwrap)

export const markTransfusionReaction = (transfusionId, body) =>
    API.post(`/ipd/transfusions/${transfusionId}/reaction`, body).then(unwrap)
