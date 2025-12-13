// FILE: src/api/inventory.js
import API from './client'

// ---------- Locations ----------
export function listInventoryLocations() {
    return API.get('/inventory/locations')
}

export function createInventoryLocation(payload) {
    return API.post('/inventory/locations', payload)
}

export function updateInventoryLocation(id, payload) {
    return API.put(`/inventory/locations/${id}`, payload)
}

// ---------- Suppliers ----------
export function listSuppliers(q = '') {
    const params = q ? { q } : {}
    return API.get('/inventory/suppliers', { params })
}

export function createSupplier(payload) {
    return API.post('/inventory/suppliers', payload)
}

export function updateSupplier(id, payload) {
    return API.put(`/inventory/suppliers/${id}`, payload)
}

// ---------- Items ----------
export function listInventoryItems(params = {}) {
    return API.get('/inventory/items', { params })
}

export function createInventoryItem(payload) {
    return API.post('/inventory/items', payload)
}

export function updateInventoryItem(id, payload) {
    return API.put(`/inventory/items/${id}`, payload)
}

export function downloadItemsSampleCsv() {
    return API.get('/inventory/items/sample-csv', {
        responseType: 'blob',
    })
}

export function bulkUploadItemsCsv(file) {
    const formData = new FormData()
    formData.append('file', file)
    return API.post('/inventory/items/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
}

// ---------- Stock & Alerts ----------
export function getStockSummary(params = {}) {
    return API.get('/inventory/stock', { params })
}

export function getExpiryAlerts(params = {}) {
    return API.get('/inventory/alerts/expiry', { params })
}

// NEW: already expired but still saleable (on shelf)
export function getExpiredAlerts(params = {}) {
    return API.get('/inventory/alerts/expired', { params })
}

// NEW: quarantine / written-off / returned batches
export function getQuarantineStock(params = {}) {
    return API.get('/inventory/stock/quarantine', { params })
}

export function getLowStockAlerts(params = {}) {
    return API.get('/inventory/alerts/low-stock', { params })
}

export function getMaxStockAlerts(params = {}) {
    return API.get('/inventory/alerts/max-stock', { params })
}

// ---------- Purchase Orders ----------
export function createPurchaseOrder(payload) {
    return API.post('/inventory/purchase-orders', payload)
}

export function listPurchaseOrders(params = {}) {
    return API.get('/inventory/purchase-orders', { params })
}

export function getPurchaseOrder(id) {
    return API.get(`/inventory/purchase-orders/${id}`)
}

export function updatePurchaseOrder(id, payload) {
    return API.put(`/inventory/purchase-orders/${id}`, payload)
}

export function changePurchaseOrderStatus(id, status) {
    return API.post(`/inventory/purchase-orders/${id}/status`, null, {
        params: { status },
    })
}

export function downloadPoPdf(id) {
    return API.get(`/inventory/purchase-orders/${id}/pdf`, {
        responseType: 'blob',
    })
}

export function markPoSent(id, emailTo) {
    return API.post(`/inventory/purchase-orders/${id}/mark-sent`, null, {
        params: { email_to: emailTo },
    })
}

// ---------- GRN ----------
export function createGrn(payload) {
    return API.post('/inventory/grn', payload)
}

export function listGrns(params = {}) {
    return API.get('/inventory/grn', { params })
}

export function getGrn(id) {
    return API.get(`/inventory/grn/${id}`)
}

export function postGrn(id, body = {}) {
    return API.post(`/inventory/grn/${id}/post`, body) // ✅ send {} at least
}
// ---------- Returns ----------
export function createReturnNote(payload) {
    return API.post('/inventory/returns', payload)
}

export function listReturnNotes(params = {}) {
    return API.get('/inventory/returns', { params })
}

export function getReturnNote(id) {
    return API.get(`/inventory/returns/${id}`)
}

export function postReturnNote(id) {
    return API.post(`/inventory/returns/${id}/post`)
}



// ---------- Dispense ----------
export function dispenseStock(payload) {
    return API.post('/inventory/dispense', payload)
}

// ---------- Transactions ----------
export function listStockTransactions(params = {}) {
    return API.get('/inventory/transactions', { params })
}
export function getItemByQr(qrNumber) {
    return API.get(`/inventory/items/by-qr/${encodeURIComponent(qrNumber)}`)
}
export function findItemByBarcode(barcodeNumber) {
    return API.get('/inventory/items/by-qr-number', {
        params: { qr_number: barcodeNumber },
    })
}

// Get BARCODE PNG (path kept as /qr but returns 1D barcode now)
export function getItemBarcodePng(itemId) {
    return API.get(`/inventory/items/${itemId}/qr`, {
        responseType: 'blob',
    })
}