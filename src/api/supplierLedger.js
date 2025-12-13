import API from "./client"


export function cleanParams(obj = {}) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === null || v === undefined) continue
    out[k] = v
  }
  return out
}
export async function downloadBlob(getter) {
  const res = await getter()
  const blob = res?.data
  const cd = res?.headers?.['content-disposition'] || ''
  const m = /filename="([^"]+)"/.exec(cd)
  const filename = m?.[1] || 'download.xlsx'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
// -------- Invoices (Ledger) --------
export const listSupplierInvoices = (params) =>
  API.get('/pharmacy/accounts/supplier-invoices', { params: cleanParams(params) })


export const getSupplierInvoice = (id) =>
  API.get(`/pharmacy/accounts/supplier-invoices/${id}`)

// -------- Payments --------
export const createSupplierPayment = (data) =>
  API.post('/pharmacy/accounts/supplier-payments', data)

export const listSupplierPayments = (params) =>
  API.get('/pharmacy/accounts/supplier-payments', { params })

// -------- Reports --------
export const getMonthlySummary = (month) =>
  API.get('/pharmacy/accounts/supplier-ledger/monthly-summary', {
    params: { month },
  })

// -------- Excel --------
export const exportLedgerExcel = (params) =>
  API.get('/pharmacy/accounts/supplier-ledger/export.xlsx', {
    params,
    responseType: 'blob',
  })

export const exportMonthlyExcel = (month) =>
  API.get('/pharmacy/accounts/supplier-ledger/monthly-summary/export.xlsx', {
    params: { month },
    responseType: 'blob',
  })
