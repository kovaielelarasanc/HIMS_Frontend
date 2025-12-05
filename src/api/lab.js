// FILE: src/api/lab.js
import API from './client'

/* ========= LAB MASTERS ========= */
export const listLabTests = ({ q = '', active, page = 1, page_size = 50 } = {}) =>
    API.get('/masters/lab-tests', { params: { q, active, page, page_size } })
// or if you want to use LIS route instead:
// export const listLabTests = ({ q = '', active, page = 1, page_size = 50 } = {}) =>
//   API.get('/lab/masters/tests', { params: { q, active, page, page_size } })

export const createLabTest = (payload) => API.post('/masters/lab-tests', payload)
export const updateLabTest = (id, payload) => API.put(`/masters/lab-tests/${id}`, payload)
export const deleteLabTest = (id) => API.delete(`/masters/lab-tests/${id}`)

/* ====================== LIS ORDERS ====================== */
export const createLisOrder = ({
    patient_id,
    context_type = null,
    context_id = null,
    priority = 'routine',
    test_ids = [],
}) => {
    const items = (test_ids || []).map((id) => ({ test_id: id }))
    return API.post('/lab/orders', { patient_id, context_type, context_id, priority, items })
}

export const listLisOrders = (params = {}) => API.get('/lab/orders', { params })
export const getLisOrder = (orderId) => API.get(`/lab/orders/${orderId}`)

export const collectLisSamples = (orderId, barcode) =>
    API.post(`/lab/orders/${orderId}/collect`, { barcode })

export const enterLisResults = (orderId, results) =>
    API.post(`/lab/orders/${orderId}/results`, results)

export const validateLisItem = (itemId) => API.post(`/lab/items/${itemId}/validate`)
export const finalizeLisReport = (orderId) => API.post(`/lab/orders/${orderId}/finalize`)

export const addLisAttachment = (itemId, file_url, note = '') =>
    API.post('/lab/attachments', { item_id: itemId, file_url, note })

/* ====================== LAB DEPARTMENTS ====================== */
export function listLabDepartments(params = {}) {
    // backend route should be /lis/masters/departments
    return API.get('/lis/masters/departments', { params })
}

/* ====================== PANEL-WISE ENTRY ====================== */
export function getLisPanelServices(orderId, { department_id, sub_department_id } = {}) {
    const params = { department_id }
    if (sub_department_id) params.sub_department_id = sub_department_id
    return API.get(`/lab/orders/${orderId}/panel`, { params })
}

export function saveLisPanelResults(orderId, payload) {
    return API.post(`/lab/orders/${orderId}/panel/results`, payload)
}

/* ====================== REPORT DATA ====================== */
export function getLisReportData(orderId) {
    return API.get(`/lab/orders/${orderId}/report-data`)
}

