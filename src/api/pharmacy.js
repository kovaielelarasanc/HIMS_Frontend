import API from './client'

/* ============ MASTERS ============ */
// Medicines
export const listMedicines = (params = {}) =>
    API.get('/pharmacy/medicines', { params })
export const getMedicine = (id) =>
    API.get(`/pharmacy/medicines/${id}`)
export const createMedicine = (payload) =>
    API.post('/pharmacy/medicines', payload)
export const updateMedicine = (id, payload) =>
    API.patch(`/pharmacy/medicines/${id}`, payload)
export const deleteMedicine = (id) =>
    API.delete(`/pharmacy/medicines/${id}`)

// Sample download (prefer extension route to avoid 422 anywhere)
// src/api/pharmacy.js
// src/api/pharmacy.js
export const downloadMedicineSample = async (format = 'xlsx') => {
    const path = format === 'csv'
        ? '/pharmacy/medicines/samples/template.csv'
        : '/pharmacy/medicines/samples/template.xlsx'
    const res = await API.get(path, { responseType: 'blob' })
    return res?.data
}


// Import (.xlsx or .csv). Backend auto-detects by file extension.
// Pass only upsert flag here (NOT the format).
export const importMedicines = (file, { upsert = true, format } = {}) => {
    const fd = new FormData()
    fd.append('file', file)
    const params = { upsert }
    if (format) params.format = format
    return API.post('/pharmacy/medicines/import', fd, {
        params,
        headers: { 'Content-Type': 'multipart/form-data' },
    })
}

// Suppliers
export const listSuppliers = (params = {}) =>
    API.get('/pharmacy/suppliers', { params })
export const createSupplier = (payload) =>
    API.post('/pharmacy/suppliers', payload)
export const updateSupplier = (id, payload) =>
    API.patch(`/pharmacy/suppliers/${id}`, payload)
export const deleteSupplier = (id) =>
    API.delete(`/pharmacy/suppliers/${id}`)

// Locations
export const listLocations = (params = {}) =>
    API.get('/pharmacy/locations', { params })
export const createLocation = (payload) =>
    API.post('/pharmacy/locations', payload)
export const updateLocation = (id, payload) =>
    API.patch(`/pharmacy/locations/${id}`, payload)
export const deleteLocation = (id) =>
    API.delete(`/pharmacy/locations/${id}`)

/* ============ INVENTORY ============ */
export const listLots = (params = {}) => API.get('/pharmacy/inventory/lots', { params })
export const listTxns = (params = {}) => API.get('/pharmacy/inventory/txns', { params })
export const adjustStock = (payload) => API.post('/pharmacy/inventory/adjust', payload)
export const transferStock = (payload) => API.post('/pharmacy/inventory/transfer', payload)
export const listLowStock = (params = {}) => API.get('/pharmacy/alerts/low-stock', { params })
export const listExpiryAlerts = (params = {}) => API.get('/pharmacy/alerts/expiry', { params })
export const listAlerts = ({ type = 'low', ...params } = {}) =>
    type === 'expiry'
        ? API.get('/pharmacy/alerts/expiry', { params })
        : API.get('/pharmacy/alerts/low-stock', { params })

/* ============ PROCUREMENT ============ */
export const listPO = (params = {}) => API.get('/pharmacy/po', { params })
export const createPO = (payload) => API.post('/pharmacy/po', payload)
export const approvePO = (id) => API.post(`/pharmacy/po/${id}/approve`)
export const cancelPO = (id) => API.post(`/pharmacy/po/${id}/cancel`)
export const listGRN = (params = {}) => API.get('/pharmacy/grn', { params })
export const createGRN = (payload) => API.post('/pharmacy/grn', payload)

/* ============ DISPENSE / RETURNS ============ */
export const dispense = (payload) => API.post('/pharmacy/dispense', payload)
export const saleReturn = (payload) => API.post('/pharmacy/dispense/return', null, { params: payload })

/* ============ PRESCRIPTIONS ============ */
export const listPrescriptions = (params = {}) =>
    API.get('/pharmacy/prescriptions', { params })
export const updatePrescriptionItemStatus = (item_id, payload) =>
    API.post(`/pharmacy/prescriptions/items/${item_id}/status`, payload)
export const updatePrescriptionStatus = (prescription_id, payload) =>
    API.post(`/pharmacy/prescriptions/${prescription_id}/status`, payload)
export const createPrescription = (payload) =>
    API.post('/pharmacy/prescriptions', payload)

export const getPharmacyActiveContext = (patient_id) =>
    API.get('/pharmacy/active-context', { params: { patient_id } })
export const dispensePrescription = (rxId, { location_id }) =>
    API.post(`/pharmacy/prescriptions/${rxId}/dispense`, null, { params: { location_id } })

export const getActiveContext = async (patient_id) => {
    try {
        const { data } = await API.get('/pharmacy/active-context', { params: { patient_id } })
        return (data && Object.keys(data).length ? data : null)
    } catch {
        return null
    }
}
