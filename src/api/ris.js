// FILE: src/api/ris.js
import API from './client'

/* ========= RIS MASTERS ========= */
export const listRisTests = ({ q = '', active, page = 1, page_size = 50 } = {}) =>
  API.get('/ris/masters/tests', { params: { q, active, page, page_size } })

export const createRisTest = (payload) => API.post('/ris/masters/tests', payload)
export const updateRisTest = (id, payload) => API.put(`/ris/masters/tests/${id}`, payload)
export const deleteRisTest = (id) => API.delete(`/ris/masters/tests/${id}`)

/* ====================== RIS ORDERS ====================== */
export const createRisOrder = ({
  patient_id,
  test_id,
  context_type = null,
  context_id = null,
  ordering_user_id = null,
  priority = 'routine',
}) =>
  API.post('/ris/orders', { patient_id, test_id, context_type, context_id, ordering_user_id, priority })

export const listRisOrders = (params = {}) => API.get('/ris/orders', { params })
export const getRisOrder = (orderId) => API.get(`/ris/orders/${orderId}`)




export const listRisAttachments = (orderId) =>
  API.get(`/ris/orders/${orderId}/attachments`)

export const deleteRisAttachment = (attachmentId) =>
  API.delete(`/ris/attachments/${attachmentId}`)

export const saveRisOrderNotes = (orderId, payload) =>
  API.put(`/ris/orders/${orderId}/notes`, payload)

export const uploadRisAttachment = (orderId, file, note) => {
  const fd = new FormData()
  fd.append('file', file)
  if (note) fd.append('note', note)
  return API.post(`/ris/orders/${orderId}/upload`, fd) // ✅ no headers
}


export const addRisAttachmentLink = (orderId, file_url, note) =>
  API.post(`/ris/attachments/${orderId}`, { file_url, note })


export const finalizeRisOrder = (orderId) =>
  API.post(`/ris/orders/${orderId}/finalize`)