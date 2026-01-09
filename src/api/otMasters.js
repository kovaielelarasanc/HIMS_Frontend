// FILE: frontend/src/api/otMasters.js
import API from "./client"

/* =========================================================
   Helpers
   ========================================================= */
const toParams = (obj = {}) => {
    const out = {}
    Object.entries(obj).forEach(([k, v]) => {
        // keep 0 / false, remove only undefined/null/""
        if (v !== undefined && v !== null && v !== "") out[k] = v
    })
    return out
}

/**
 * ✅ Normalize common list filters across endpoints:
 * - search can be passed as `search` or `q`
 * - active can be passed as `active` or `is_active`
 * We send BOTH variants to avoid backend differences.
 */
const normalizeListParams = (params = {}) => {
    const {
        search,
        q,
        active,
        is_active,
        limit,
        page,
        page_size,
        ...rest
    } = params || {}

    const s = (search ?? q ?? "").toString().trim()
    const a = active ?? is_active

    return toParams({
        ...rest,
        // search keys (send both)
        q: s || undefined,
        search: s || undefined,

        // active keys (send both)
        active: a === undefined ? undefined : a,
        is_active: a === undefined ? undefined : a,

        // common paging keys
        limit: limit ?? undefined,
        page: page ?? undefined,
        page_size: page_size ?? undefined,
    })
}

/* =========================================================
   SURGERIES (Legacy) - paginated
   GET /ot/surgeries -> { items, total, page, page_size }
   ========================================================= */
export const listOtSurgeries = (params = {}) =>
    API.get("/ot/surgeries", { params: normalizeListParams(params) })
export const createOtSurgery = (payload) => API.post("/ot/surgeries", payload)
export const updateOtSurgery = (id, payload) =>
    API.put(`/ot/surgeries/${id}`, payload)
export const deleteOtSurgery = (id) => API.delete(`/ot/surgeries/${id}`)

/* =========================================================
   THEATERS (Hourly)
   ========================================================= */
export const listOtTheaters = (params = {}) =>
    API.get("/ot/theaters", { params: normalizeListParams(params) })
export const createOtTheater = (payload) => API.post("/ot/theaters", payload)
export const updateOtTheater = (id, payload) =>
    API.put(`/ot/theaters/${id}`, payload)
export const deleteOtTheater = (id) => API.delete(`/ot/theaters/${id}`)

/* =========================================================
   INSTRUMENTS
   ✅ LIST uses alias master endpoint: /ot/instrument-masters
   ✅ CRUD uses real endpoint: /ot/instruments
   ========================================================= */
export const listOtInstruments = (params = {}) =>
    API.get("/ot/instrument-masters", { params: normalizeListParams(params) })

export const createOtInstrument = (payload) => API.post("/ot/instruments", payload)
export const updateOtInstrument = (id, payload) =>
    API.put(`/ot/instruments/${id}`, payload)
export const deleteOtInstrument = (id) => API.delete(`/ot/instruments/${id}`)

/* =========================================================
   DEVICES (AIRWAY / MONITOR)
   ========================================================= */
export const listOtDevices = (params = {}) =>
    API.get("/ot/devices", { params: normalizeListParams(params) })
export const createOtDevice = (payload) => API.post("/ot/devices", payload)
export const updateOtDevice = (id, payload) =>
    API.put(`/ot/devices/${id}`, payload)
export const deleteOtDevice = (id) => API.delete(`/ot/devices/${id}`)

/* =========================================================
   PROCEDURES (with split costs)
   ========================================================= */
export const listOtProcedures = (params = {}) =>
    API.get("/ot/procedures", { params: normalizeListParams(params) })
export const createOtProcedure = (payload) => API.post("/ot/procedures", payload)
export const updateOtProcedure = (id, payload) =>
    API.put(`/ot/procedures/${id}`, payload)
export const deleteOtProcedure = (id) => API.delete(`/ot/procedures/${id}`)

/* =========================================================
   SPECIALITIES
   ========================================================= */
export const listOtSpecialities = (params = {}) =>
    API.get("/ot/specialities", { params: normalizeListParams(params) })
export const createOtSpeciality = (payload) =>
    API.post("/ot/specialities", payload)
export const updateOtSpeciality = (id, payload) =>
    API.put(`/ot/specialities/${id}`, payload)
export const deleteOtSpeciality = (id) => API.delete(`/ot/specialities/${id}`)

/* =========================================================
   EQUIPMENT
   ========================================================= */
export const listOtEquipment = (params = {}) =>
    API.get("/ot/equipment", { params: normalizeListParams(params) })
export const createOtEquipment = (payload) => API.post("/ot/equipment", payload)
export const updateOtEquipment = (id, payload) =>
    API.put(`/ot/equipment/${id}`, payload)
export const deleteOtEquipment = (id) => API.delete(`/ot/equipment/${id}`)

/* =========================================================
   ✅ Backward-compatible aliases (optional)
   If any file already started using InstrumentMasters functions,
   keep them working without duplicating logic.
   ========================================================= */
export const listOtInstrumentMasters = listOtInstruments
export const createOtInstrumentMaster = createOtInstrument
export const updateOtInstrumentMaster = updateOtInstrument
export const deleteOtInstrumentMaster = deleteOtInstrument
