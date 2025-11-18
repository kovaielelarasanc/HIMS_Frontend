// src/api/lab.js
import API from './client'

/* ========= LAB MASTERS ========= */
export const listLabTests = ({ q = '', active, page = 1, page_size = 50 } = {}) =>
    API.get('/masters/lab-tests', { params: { q, active, page, page_size } })

export const createLabTest = (payload) => API.post('/masters/lab-tests', payload)
export const updateLabTest = (id, payload) => API.put(`/masters/lab-tests/${id}`, payload)
export const deleteLabTest = (id) => API.delete(`/masters/lab-tests/${id}`)

/* ====================== LIS ORDERS ====================== */
// Create order with items: [{ test_id }]
export const createLisOrder = ({ patient_id, context_type = null, context_id = null, priority = 'routine', test_ids = [] }) => {
    const items = (test_ids || []).map(id => ({ test_id: id }))
    return API.post('/lab/orders', { patient_id, context_type, context_id, priority, items })
}

export const listLisOrders = (params = {}) => API.get('/lab/orders', { params })
export const getLisOrder = (orderId) => API.get(`/lab/orders/${orderId}`)

export const collectLisSamples = (orderId, barcode) =>
    API.post(`/lab/orders/${orderId}/collect`, { barcode })

// results: [{ item_id, result_value, is_critical }]
export const enterLisResults = (orderId, results) =>
    API.post(`/lab/orders/${orderId}/results`, results)

export const validateLisItem = (itemId) => API.post(`/lab/items/${itemId}/validate`)
export const finalizeLisReport = (orderId) => API.post(`/lab/orders/${orderId}/finalize`)

// Attachments: backend expects item_id + file_url (+ note)
export const addLisAttachment = (itemId, file_url, note = '') =>
    API.post('/lab/attachments', { item_id: itemId, file_url, note })
