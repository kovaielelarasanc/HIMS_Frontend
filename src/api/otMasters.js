// FILE: frontend/src/api/otMasters.js
import API from './client'

/* =========================================================
   Helpers
   ========================================================= */
const toParams = (obj = {}) => {
    const out = {}
    Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') out[k] = v
    })
    return out
}

/* =========================================================
   SURGERIES (Legacy) - paginated
   GET /ot/surgeries -> { items, total, page, page_size }
   ========================================================= */
export const listOtSurgeries = (params = {}) =>
    API.get('/ot/surgeries', { params: toParams(params) })
export const createOtSurgery = (payload) => API.post('/ot/surgeries', payload)
export const updateOtSurgery = (id, payload) =>
    API.put(`/ot/surgeries/${id}`, payload)
export const deleteOtSurgery = (id) => API.delete(`/ot/surgeries/${id}`)

/* =========================================================
   THEATERS (Hourly)
   ========================================================= */
export const listOtTheaters = (params = {}) =>
    API.get('/ot/theaters', { params: toParams(params) })
export const createOtTheater = (payload) => API.post('/ot/theaters', payload)
export const updateOtTheater = (id, payload) =>
    API.put(`/ot/theaters/${id}`, payload)
export const deleteOtTheater = (id) => API.delete(`/ot/theaters/${id}`)

/* =========================================================
   INSTRUMENTS
   ========================================================= */
export const listOtInstruments = (params = {}) =>
    API.get('/ot/instruments', { params: toParams(params) })
export const createOtInstrument = (payload) =>
    API.post('/ot/instruments', payload)
export const updateOtInstrument = (id, payload) =>
    API.put(`/ot/instruments/${id}`, payload)
export const deleteOtInstrument = (id) => API.delete(`/ot/instruments/${id}`)

/* =========================================================
   DEVICES (AIRWAY / MONITOR)
   ========================================================= */
export const listOtDevices = (params = {}) =>
    API.get('/ot/devices', { params: toParams(params) })
export const createOtDevice = (payload) => API.post('/ot/devices', payload)
export const updateOtDevice = (id, payload) =>
    API.put(`/ot/devices/${id}`, payload)
export const deleteOtDevice = (id) => API.delete(`/ot/devices/${id}`)

/* =========================================================
   PROCEDURES (with split costs)
   ========================================================= */
export const listOtProcedures = (params = {}) =>
    API.get('/ot/procedures', { params: toParams(params) })
export const createOtProcedure = (payload) => API.post('/ot/procedures', payload)
export const updateOtProcedure = (id, payload) =>
    API.put(`/ot/procedures/${id}`, payload)
export const deleteOtProcedure = (id) => API.delete(`/ot/procedures/${id}`)

/* =========================================================
   SPECIALITIES
   ========================================================= */
export const listOtSpecialities = (params = {}) =>
    API.get('/ot/specialities', { params: toParams(params) })
export const createOtSpeciality = (payload) =>
    API.post('/ot/specialities', payload)
export const updateOtSpeciality = (id, payload) =>
    API.put(`/ot/specialities/${id}`, payload)
export const deleteOtSpeciality = (id) => API.delete(`/ot/specialities/${id}`)

/* =========================================================
   EQUIPMENT
   ========================================================= */
export const listOtEquipment = (params = {}) =>
    API.get('/ot/equipment', { params: toParams(params) })
export const createOtEquipment = (payload) => API.post('/ot/equipment', payload)
export const updateOtEquipment = (id, payload) =>
    API.put(`/ot/equipment/${id}`, payload)
export const deleteOtEquipment = (id) => API.delete(`/ot/equipment/${id}`)
