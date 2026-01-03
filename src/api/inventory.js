// FILE: src/api/inventory.js
import API from './client'


const unwrap = (res) => {
    const payload = res?.data
    if (!payload?.status) {
        const msg = payload?.error?.msg || "Something went wrong"
        throw new Error(msg)
    }
    return payload.data
}


// ---------- Locations ----------
export function listInventoryLocations() {
    return API.get('/inventory/locations')
}

export const searchItemBatches = ({
    location_id,
    q = '',
    limit = 15,
    only_in_stock = true,
    exclude_expired = true,
    active_only = true,
    type = 'drug', // 'drug' | 'consumable' | 'all'
} = {}) =>
    API.get('/inventory/item-batches', {
        params: {
            location_id,
            q,
            limit,
            only_in_stock,
            exclude_expired,
            active_only,
            type,
        },
    })

export function createInventoryLocation(payload) {
    return API.post('/inventory/locations', payload)
}

export function updateInventoryLocation(id, payload) {
    return API.put(`/inventory/locations/${id}`, payload)
}
// ---------- Suppliers ----------

function unwraps(res) {
    const payload = res?.data ?? res
    if (payload && typeof payload === "object" && "status" in payload && "data" in payload) {
        return payload.data
    }
    return payload
}

export function listSuppliers(q = "", opts = {}) {
    const params = {}
    if (q && q.trim()) params.q = q.trim()
    if (opts?.is_active !== undefined) params.is_active = opts.is_active
    if (opts?.limit) params.limit = opts.limit
    return API.get("/inventory/suppliers", { params }).then(unwraps)
}

export function createSupplier(payload) {
    return API.post("/inventory/suppliers", payload).then(unwraps)
}

export function updateSupplier(id, payload) {
    return API.put(`/inventory/suppliers/${id}`, payload).then(unwraps)
}
/// ---------- Items ----------
export function listInventoryItems(params = {}) {
    return API.get("/inventory/items", { params }).then(unwrap)
}

export function createInventoryItem(payload) {
    return API.post("/inventory/items", payload).then(unwrap)
}

export function updateInventoryItem(id, payload) {
    return API.put(`/inventory/items/${id}`, payload).then(unwrap)
}

// ✅ Drug schedules catalog (dropdown data)
export function getDrugSchedulesCatalog() {
    return API.get("/inventory/items/drug-schedules")
}




// ✅ NEW: preview (CSV/XLSX/TSV)
export function previewItemsUpload(file) {
    const formData = new FormData()
    formData.append('file', file)
    return API.post('/inventory/items/bulk-upload/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
}

// ---------------- Templates / Samples (Downloads) ----------------
export function downloadSampleItemsCsv() {
    return API.get("/inventory/items/sample-csv", { responseType: "blob" })
}

export function downloadItemsTemplate(format = "csv") {
    return API.get("/inventory/items/bulk-upload/template", {
        params: { format }, // "csv" | "xlsx"
        responseType: "blob",
    })
}

// ---------------- Bulk Upload (Preview + Commit) ----------------
function buildFormData(file) {
    const fd = new FormData()
    fd.append("file", file)
    return fd
}

// POST /inventory/items/bulk-upload/preview
export function previewItemsBulkUpload(file) {
    return API.post("/inventory/items/bulk-upload/preview", buildFormData(file), {
        headers: { "Content-Type": "multipart/form-data" },
    })
}

// POST /inventory/items/bulk-upload/commit?strict=..&update_blanks=..
export function commitItemsBulkUpload(file, { strict = true, update_blanks = false } = {}) {
    return API.post("/inventory/items/bulk-upload/commit", buildFormData(file), {
        params: { strict, update_blanks },
        headers: { "Content-Type": "multipart/form-data" },
    })
}

/**
 * ✅ Convenience helper (optional): preview + commit in one call
 * Returns: { preview, commit }
 */
export async function bulkUploadItems(file, { strict = true, update_blanks = false } = {}) {
    const preview = await previewItemsBulkUpload(file)
    if (strict && Number(preview?.error_rows || 0) > 0) {
        const first = Array.isArray(preview?.errors) ? preview.errors[0] : null
        const msg = first?.message ? `Row ${first.row}: ${first.message}` : "File has errors"
        const err = new Error(msg)
        err.preview = preview
        throw err
    }
    const commit = await commitItemsBulkUpload(file, { strict, update_blanks })
    return { preview, commit }
}

// ✅ NEW: commit (strict by default)
export function commitItemsUpload(file, { updateBlanks = false, strict = true } = {}) {
    const formData = new FormData()
    formData.append('file', file)
    return API.post('/inventory/items/bulk-upload/commit', formData, {
        params: { update_blanks: updateBlanks, strict },
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

// your backend supports /status with params: {status}
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

// Helpers used in PO sheet
// export function listSuppliers(params = {}) {
//     return API.get('/inventory/suppliers', { params })
// }
export function listLocations(params = {}) {
    return API.get('/inventory/locations', { params })
}
// export function listInventoryItems(params = {}) {
//     return API.get('/inventory/items', { params })
// }

/// ---------- GRN ----------
export function createGrn(payload) {
    return API.post("/inventory/grn", payload)
}
export function listGrns(params = {}) {
    return API.get("/inventory/grn", { params })
}
export function getGrn(id) {
    return API.get(`/inventory/grn/${id}`)
}
export function updateGrn(id, payload) {
    return API.put(`/inventory/grn/${id}`, payload)
}
export function postGrn(id, body = {}) {
    return API.post(`/inventory/grn/${id}/post`, body)
}

// ---------- PO (for GRN autofill) ----------
export function listPendingPos(params = {}) {
    return API.get("/inventory/purchase-orders/pending", { params })
}
//   export function getPurchaseOrder(poId) {
//     return API.get(`/inventory/purchase-orders/${poId}`)
//   }

// ✅ NEW: use backend pending-items (ordered - received)
export function getPoPendingItems(poId) {
    return API.get(`/inventory/purchase-orders/${poId}/pending-items`)
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
    return API.get("/inventory/transactions", { params })
}

export const downloadStockTransactionsPdf = async (params = {}) => {
    const res = await API.get(`/inventory/transactions/pdf`, {
        params,
        responseType: "blob",
    })
    return res.data // Blob
}

// ---------- Schedule Medicine Report ----------
export const downloadScheduleMedicineReportPdf = async (params = {}) => {
    const res = await API.get("/inventory/schedule-medicine-report.pdf", {
        params, // { date_from, date_to, location_id?, only_outgoing? }
        responseType: "blob",
    })
    return res.data // Blob
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