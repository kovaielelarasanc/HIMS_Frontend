import API from './client'

// Invoices
export const createInvoice = (payload) =>
    API.post('/billing/invoices', payload)

export const getInvoice = (invoiceId) =>
    API.get(`/billing/invoices/${invoiceId}`)

export const listInvoices = (params = {}) =>
    API.get('/billing/invoices', { params })

export const cancelInvoice = (invoiceId) =>
    API.post(`/billing/invoices/${invoiceId}/cancel`)

export const finalizeInvoice = (invoiceId) =>
    API.post(`/billing/invoices/${invoiceId}/finalize`)

// Items
export const addServiceItem = (invoiceId, payload) =>
    API.post(`/billing/invoices/${invoiceId}/items/add-service`, payload)

export const addManualItem = (invoiceId, payload) =>
    API.post(`/billing/invoices/${invoiceId}/items/manual`, payload)

export const updateInvoiceItem = (invoiceId, itemId, payload) =>
    API.patch(`/billing/invoices/${invoiceId}/items/${itemId}`, payload)

export const voidInvoiceItem = (invoiceId, itemId, payload = { reason: 'Voided' }) =>
    API.post(`/billing/invoices/${invoiceId}/items/${itemId}/void`, payload)

// Unbilled services
export const fetchUnbilledServices = (patient_id) =>
    API.get('/billing/unbilled-services', { params: { patient_id } })

export const bulkAddFromUnbilled = (invoiceId, uids = [], patient_id) =>
    API.post(
        `/billing/invoices/${invoiceId}/items/bulk-from-unbilled`,
        { uids },
        { params: { patient_id } }
    )

// Payments
export const addPayment = (invoiceId, payload) =>
    API.post(`/billing/invoices/${invoiceId}/payments`, payload)
