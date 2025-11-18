// src/api/ris.js
import API from './client'

/* ========= RIS MASTERS (backend: /ris/masters/tests) ========= */
export const listRisTests = ({ q = '', active, page = 1, page_size = 50 } = {}) =>
    API.get('/ris/masters/tests', { params: { q, active, page, page_size } })

export const createRisTest = (payload) =>
    API.post('/ris/masters/tests', payload)

export const updateRisTest = (id, payload) =>
    API.put(`/ris/masters/tests/${id}`, payload)

export const deleteRisTest = (id) =>
    API.delete(`/ris/masters/tests/${id}`)

/* ====================== RIS ORDERS ====================== */
/** Backend expects a SINGLE test_id (not an array) */
export const createRisOrder = ({ patient_id, test_id, context_type = null, context_id = null, ordering_user_id = null, priority = 'routine' }) =>
    API.post('/ris/orders', { patient_id, test_id, context_type, context_id, ordering_user_id, priority })

/** List returns an ARRAY (not {items,total}) */
export const listRisOrders = (params = {}) =>
    API.get('/ris/orders', { params })

export const getRisOrder = (orderId) =>
    API.get(`/ris/orders/${orderId}`)

/* ===== Scheduling & Scan ===== */
export const scheduleRisOrder = (orderId, { scheduled_at }) =>
    API.post(`/ris/orders/${orderId}/schedule`, { scheduled_at })

/** Backend has a single /scan endpoint (no start/complete split) */
export const markScanned = (orderId) =>
    API.post(`/ris/orders/${orderId}/scan`)

/* ===== Reporting ===== */
export const saveRisReport = (orderId, { report_text }) =>
    API.post(`/ris/orders/${orderId}/report`, { report_text })

export const updateRisReport = (orderId, { report_text }) =>
    API.put(`/ris/orders/${orderId}/report`, { report_text })

export const approveRisReport = (orderId) =>
    API.post(`/ris/orders/${orderId}/approve`)

/* ===== Attachments ===== */
export const addRisAttachmentLink = (orderId, file_url, note = '') =>
    API.post(`/ris/attachments/${orderId}`, { file_url, note })

export const uploadRisAttachment = (orderId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return API.post(`/ris/orders/${orderId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
}
