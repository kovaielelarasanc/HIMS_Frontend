import API from './client'

// --- Masters
export const listOtSurgeries = (params = {}) =>
    API.get('/ot/masters/surgeries', { params })
export const createOtSurgery = (payload) =>
    API.post('/ot/masters/surgeries', payload)
export const updateOtSurgery = (id, payload) =>
    API.put(`/ot/masters/surgeries/${id}`, payload)
export const deleteOtSurgery = (id) =>
    API.delete(`/ot/masters/surgeries/${id}`)

// --- Orders (you likely already have these)
export const listOtOrders = (params = {}) => API.get('/ot/orders', { params })
export const getOtOrder = (id) => API.get(`/ot/orders/${id}`)
export const createOtOrder = (payload) => API.post('/ot/orders', payload)
export const scheduleOtOrder = (id, payload) => API.post(`/ot/orders/${id}/schedule`, payload)
export const updateOtStatus = (id, status) => API.post(`/ot/orders/${id}/status`, { status })
export const uploadOtAttachment = (id, file, note = '') => {
    const fd = new FormData()
    fd.append('file', file)
    if (note) fd.append('note', note)
    return API.post(`/ot/orders/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const addOtAttachmentLink = (id, payload) => API.post(`/ot/orders/${id}/attachments`, payload)
