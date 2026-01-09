// FILE: src/api/pharmacy.js
import API from "./client"

const unwrap = (res) => {
    const p = res?.data
    if (!p?.status) {
        const msg = p?.error?.msg || "Something went wrong"
        const err = new Error(msg)
        err.fields = p?.error?.fields || null
        err.code = p?.error?.code || "ERROR"
        throw err
    }
    return p.data
}

const q = (params) => ({ params })

// ---------- Masters ----------
export const phListUoms = () => API.get(`/pharmacy/uoms`).then(unwrap)
export const phCreateUom = (payload) => API.post(`/pharmacy/uoms`, payload).then(unwrap)
export const phUpdateUom = (id, payload) => API.put(`/pharmacy/uoms/${id}`, payload).then(unwrap)
export const phDeleteUom = (id) => API.delete(`/pharmacy/uoms/${id}`).then(unwrap)

export const phListCategories = () => API.get(`/pharmacy/categories`).then(unwrap)
export const phCreateCategory = (payload) => API.post(`/pharmacy/categories`, payload).then(unwrap)
export const phUpdateCategory = (id, payload) => API.put(`/pharmacy/categories/${id}`, payload).then(unwrap)
export const phDeleteCategory = (id) => API.delete(`/pharmacy/categories/${id}`).then(unwrap)

export const phListManufacturers = () => API.get(`/pharmacy/manufacturers`).then(unwrap)
export const phCreateManufacturer = (payload) => API.post(`/pharmacy/manufacturers`, payload).then(unwrap)
export const phUpdateManufacturer = (id, payload) => API.put(`/pharmacy/manufacturers/${id}`, payload).then(unwrap)
export const phDeleteManufacturer = (id) => API.delete(`/pharmacy/manufacturers/${id}`).then(unwrap)

export const phListTaxCodes = () => API.get(`/pharmacy/tax-codes`).then(unwrap)
export const phCreateTaxCode = (payload) => API.post(`/pharmacy/tax-codes`, payload).then(unwrap)
export const phUpdateTaxCode = (id, payload) => API.put(`/pharmacy/tax-codes/${id}`, payload).then(unwrap)
export const phDeleteTaxCode = (id) => API.delete(`/pharmacy/tax-codes/${id}`).then(unwrap)

export const phListSuppliers = () => API.get(`/pharmacy/suppliers`).then(unwrap)
export const phCreateSupplier = (payload) => API.post(`/pharmacy/suppliers`, payload).then(unwrap)
export const phUpdateSupplier = (id, payload) => API.put(`/pharmacy/suppliers/${id}`, payload).then(unwrap)
export const phDeleteSupplier = (id) => API.delete(`/pharmacy/suppliers/${id}`).then(unwrap)

export const phListStores = () => API.get(`/pharmacy/stores`).then(unwrap)
export const phCreateStore = (payload) => API.post(`/pharmacy/stores`, payload).then(unwrap)
export const phUpdateStore = (id, payload) => API.put(`/pharmacy/stores/${id}`, payload).then(unwrap)
export const phDeleteStore = (id) => API.delete(`/pharmacy/stores/${id}`).then(unwrap)

export const phListItems = (params = {}) =>
    API.get(`/pharmacy/items`, q(params)).then(unwrap)

export const phCreateItem = (payload) => API.post(`/pharmacy/items`, payload).then(unwrap)
export const phGetItem = (id) => API.get(`/pharmacy/items/${id}`).then(unwrap)
export const phUpdateItem = (id, payload) => API.put(`/pharmacy/items/${id}`, payload).then(unwrap)
export const phDeleteItem = (id) => API.delete(`/pharmacy/items/${id}`).then(unwrap)

export const phListItemUomConversions = (itemId) =>
    API.get(`/pharmacy/items/${itemId}/uom-conversions`).then(unwrap)
export const phCreateItemUomConversion = (itemId, payload) =>
    API.post(`/pharmacy/items/${itemId}/uom-conversions`, payload).then(unwrap)
export const phUpdateItemUomConversion = (convId, payload) =>
    API.put(`/pharmacy/uom-conversions/${convId}`, payload).then(unwrap)
export const phDeleteItemUomConversion = (convId) =>
    API.delete(`/pharmacy/uom-conversions/${convId}`).then(unwrap)

export const phListStoreItemSettings = (storeId, params = {}) =>
    API.get(`/pharmacy/stores/${storeId}/item-settings`, q(params)).then(unwrap)
export const phCreateStoreItemSetting = (storeId, payload) =>
    API.post(`/pharmacy/stores/${storeId}/item-settings`, payload).then(unwrap)
export const phUpdateStoreItemSetting = (settingId, payload) =>
    API.put(`/pharmacy/item-settings/${settingId}`, payload).then(unwrap)
export const phDeleteStoreItemSetting = (settingId) =>
    API.delete(`/pharmacy/item-settings/${settingId}`).then(unwrap)

// ---------- Insurance ----------
export const phListPayers = () => API.get(`/pharmacy/insurance/payers`).then(unwrap)
export const phCreatePayer = (payload) => API.post(`/pharmacy/insurance/payers`, payload).then(unwrap)
export const phUpdatePayer = (id, payload) => API.put(`/pharmacy/insurance/payers/${id}`, payload).then(unwrap)
export const phDeletePayer = (id) => API.delete(`/pharmacy/insurance/payers/${id}`).then(unwrap)

export const phListPlans = (params = {}) => API.get(`/pharmacy/insurance/plans`, q(params)).then(unwrap)
export const phCreatePlan = (payload) => API.post(`/pharmacy/insurance/plans`, payload).then(unwrap)
export const phUpdatePlan = (id, payload) => API.put(`/pharmacy/insurance/plans/${id}`, payload).then(unwrap)
export const phDeletePlan = (id) => API.delete(`/pharmacy/insurance/plans/${id}`).then(unwrap)

export const phListCoverageRules = (params = {}) =>
    API.get(`/pharmacy/insurance/coverage-rules`, q(params)).then(unwrap)
export const phCreateCoverageRule = (payload) =>
    API.post(`/pharmacy/insurance/coverage-rules`, payload).then(unwrap)
export const phUpdateCoverageRule = (id, payload) =>
    API.put(`/pharmacy/insurance/coverage-rules/${id}`, payload).then(unwrap)
export const phDeleteCoverageRule = (id) =>
    API.delete(`/pharmacy/insurance/coverage-rules/${id}`).then(unwrap)

export const phListContractPrices = (params = {}) =>
    API.get(`/pharmacy/insurance/contract-prices`, q(params)).then(unwrap)
export const phCreateContractPrice = (payload) =>
    API.post(`/pharmacy/insurance/contract-prices`, payload).then(unwrap)
export const phUpdateContractPrice = (id, payload) =>
    API.put(`/pharmacy/insurance/contract-prices/${id}`, payload).then(unwrap)
export const phDeleteContractPrice = (id) =>
    API.delete(`/pharmacy/insurance/contract-prices/${id}`).then(unwrap)

export const phEvaluateInsurance = (payload) =>
    API.post(`/pharmacy/insurance/evaluate`, payload).then(unwrap)

// ---------- Procurement ----------
export const phListPOs = (params = {}) => API.get(`/pharmacy/purchase-orders`, q(params)).then(unwrap)
export const phCreatePO = (payload) => API.post(`/pharmacy/purchase-orders`, payload).then(unwrap)
export const phGetPO = (id) => API.get(`/pharmacy/purchase-orders/${id}`).then(unwrap)
export const phUpdatePO = (id, payload) => API.put(`/pharmacy/purchase-orders/${id}`, payload).then(unwrap)
export const phDeletePO = (id) => API.delete(`/pharmacy/purchase-orders/${id}`).then(unwrap)
export const phSubmitPO = (id, payload = {}) => API.post(`/pharmacy/purchase-orders/${id}/submit`, payload).then(unwrap)
export const phApprovePO = (id, payload = {}) => API.post(`/pharmacy/purchase-orders/${id}/approve`, payload).then(unwrap)
export const phCancelPO = (id, payload) => API.post(`/pharmacy/purchase-orders/${id}/cancel`, payload).then(unwrap)
export const phReopenPO = (id, payload = {}) => API.post(`/pharmacy/purchase-orders/${id}/reopen`, payload).then(unwrap)
export const phRevisePO = (id, payload = {}) => API.post(`/pharmacy/purchase-orders/${id}/revise`, payload).then(unwrap)

export const phListGRNs = (params = {}) => API.get(`/pharmacy/grns`, q(params)).then(unwrap)
export const phCreateGRN = (payload) => API.post(`/pharmacy/grns`, payload).then(unwrap)
export const phGetGRN = (id) => API.get(`/pharmacy/grns/${id}`).then(unwrap)
export const phUpdateGRN = (id, payload) => API.put(`/pharmacy/grns/${id}`, payload).then(unwrap)
export const phDeleteGRN = (id) => API.delete(`/pharmacy/grns/${id}`).then(unwrap)
export const phSubmitGRN = (id, payload = {}) => API.post(`/pharmacy/grns/${id}/submit`, payload).then(unwrap)
export const phApproveGRN = (id, payload = {}) => API.post(`/pharmacy/grns/${id}/approve`, payload).then(unwrap)
export const phCancelGRN = (id, payload) => API.post(`/pharmacy/grns/${id}/cancel`, payload).then(unwrap)
export const phRecalcGRN = (id) => API.post(`/pharmacy/grns/${id}/recalculate`).then(unwrap)
export const phPostGRN = (id, payload = {}) => API.post(`/pharmacy/grns/${id}/post`, payload).then(unwrap)
export const phPoVariance = (id) => API.get(`/pharmacy/grns/${id}/po-variance`).then(unwrap)

export const phListPurchaseInvoices = (params = {}) =>
    API.get(`/pharmacy/purchase-invoices`, q(params)).then(unwrap)
export const phCreatePurchaseInvoice = (payload) =>
    API.post(`/pharmacy/purchase-invoices`, payload).then(unwrap)
export const phGetPurchaseInvoice = (id) =>
    API.get(`/pharmacy/purchase-invoices/${id}`).then(unwrap)
export const phUpdatePurchaseInvoice = (id, payload) =>
    API.put(`/pharmacy/purchase-invoices/${id}`, payload).then(unwrap)
export const phDeletePurchaseInvoice = (id) =>
    API.delete(`/pharmacy/purchase-invoices/${id}`).then(unwrap)
export const phSubmitPurchaseInvoice = (id, payload = {}) =>
    API.post(`/pharmacy/purchase-invoices/${id}/submit`, payload).then(unwrap)
export const phApprovePurchaseInvoice = (id, payload = {}) =>
    API.post(`/pharmacy/purchase-invoices/${id}/approve`, payload).then(unwrap)
export const phCancelPurchaseInvoice = (id, payload) =>
    API.post(`/pharmacy/purchase-invoices/${id}/cancel`, payload).then(unwrap)
export const phPostPurchaseInvoice = (id, payload = {}) =>
    API.post(`/pharmacy/purchase-invoices/${id}/post`, payload).then(unwrap)

// ---------- Inventory Read ----------
export const phListBatches = (params = {}) => API.get(`/pharmacy/batches`, q(params)).then(unwrap)
export const phGetBatch = (id) => API.get(`/pharmacy/batches/${id}`).then(unwrap)
export const phQuarantineBatch = (id, payload) => API.post(`/pharmacy/batches/${id}/quarantine`, payload).then(unwrap)
export const phRecallBatch = (id, payload) => API.post(`/pharmacy/batches/${id}/recall`, payload).then(unwrap)
export const phReleaseBatch = (id, payload = {}) => API.post(`/pharmacy/batches/${id}/release`, payload).then(unwrap)

export const phListStockBalances = (params = {}) =>
    API.get(`/pharmacy/stock/balances`, q(params)).then(unwrap)

export const phStockSummary = (params = {}) =>
    API.get(`/pharmacy/stock/summary`, q(params)).then(unwrap)

export const phListStockLedger = (params = {}) =>
    API.get(`/pharmacy/stock/ledger`, q(params)).then(unwrap)

export const phFefoSuggest = (params) =>
    API.get(`/pharmacy/stock/fefo`, q(params)).then(unwrap)

// ---------- Stock Ops ----------
export const phListAdjustments = (params = {}) =>
    API.get(`/pharmacy/stock-adjustments`, q(params)).then(unwrap)
export const phCreateAdjustment = (payload) =>
    API.post(`/pharmacy/stock-adjustments`, payload).then(unwrap)
export const phUpdateAdjustment = (id, payload) =>
    API.put(`/pharmacy/stock-adjustments/${id}`, payload).then(unwrap)
export const phSubmitAdjustment = (id, payload = {}) =>
    API.post(`/pharmacy/stock-adjustments/${id}/submit`, payload).then(unwrap)
export const phApproveAdjustment = (id, payload = {}) =>
    API.post(`/pharmacy/stock-adjustments/${id}/approve`, payload).then(unwrap)
export const phCancelAdjustment = (id, payload) =>
    API.post(`/pharmacy/stock-adjustments/${id}/cancel`, payload).then(unwrap)
export const phPostAdjustment = (id, payload = {}) =>
    API.post(`/pharmacy/stock-adjustments/${id}/post`, payload).then(unwrap)

export const phListTransfers = (params = {}) =>
    API.get(`/pharmacy/stock-transfers`, q(params)).then(unwrap)
export const phCreateTransfer = (payload) =>
    API.post(`/pharmacy/stock-transfers`, payload).then(unwrap)
export const phUpdateTransfer = (id, payload) =>
    API.put(`/pharmacy/stock-transfers/${id}`, payload).then(unwrap)
export const phSubmitTransfer = (id, payload = {}) =>
    API.post(`/pharmacy/stock-transfers/${id}/submit`, payload).then(unwrap)
export const phApproveTransfer = (id, payload = {}) =>
    API.post(`/pharmacy/stock-transfers/${id}/approve`, payload).then(unwrap)
export const phCancelTransfer = (id, payload) =>
    API.post(`/pharmacy/stock-transfers/${id}/cancel`, payload).then(unwrap)
export const phIssueTransfer = (id, payload = {}) =>
    API.post(`/pharmacy/stock-transfers/${id}/issue`, payload).then(unwrap)
export const phReceiveTransfer = (id, payload = {}) =>
    API.post(`/pharmacy/stock-transfers/${id}/receive`, payload).then(unwrap)

export const phListCounts = (params = {}) =>
    API.get(`/pharmacy/stock-counts`, q(params)).then(unwrap)
export const phCreateCount = (payload) =>
    API.post(`/pharmacy/stock-counts`, payload).then(unwrap)
export const phUpdateCount = (id, payload) =>
    API.put(`/pharmacy/stock-counts/${id}`, payload).then(unwrap)
export const phFreezeCount = (id, payload = {}) =>
    API.post(`/pharmacy/stock-counts/${id}/freeze`, payload).then(unwrap)
export const phUnfreezeCount = (id, payload = {}) =>
    API.post(`/pharmacy/stock-counts/${id}/unfreeze`, payload).then(unwrap)
export const phSubmitCount = (id, payload = {}) =>
    API.post(`/pharmacy/stock-counts/${id}/submit`, payload).then(unwrap)
export const phApproveCount = (id, payload = {}) =>
    API.post(`/pharmacy/stock-counts/${id}/approve`, payload).then(unwrap)
export const phCancelCount = (id, payload) =>
    API.post(`/pharmacy/stock-counts/${id}/cancel`, payload).then(unwrap)
export const phPostCount = (id, payload = {}) =>
    API.post(`/pharmacy/stock-counts/${id}/post`, payload).then(unwrap)

// ---------- Dispense ----------
export const phListDispenses = (params = {}) =>
    API.get(`/pharmacy/dispenses`, q(params)).then(unwrap)
export const phCreateDispense = (payload) =>
    API.post(`/pharmacy/dispenses`, payload).then(unwrap)
export const phGetDispense = (id) =>
    API.get(`/pharmacy/dispenses/${id}`).then(unwrap)
export const phUpdateDispense = (id, payload) =>
    API.put(`/pharmacy/dispenses/${id}`, payload).then(unwrap)
export const phSubmitDispense = (id, payload = {}) =>
    API.post(`/pharmacy/dispenses/${id}/submit`, payload).then(unwrap)
export const phApproveDispense = (id, payload = {}) =>
    API.post(`/pharmacy/dispenses/${id}/approve`, payload).then(unwrap)
export const phCancelDispense = (id, payload) =>
    API.post(`/pharmacy/dispenses/${id}/cancel`, payload).then(unwrap)
export const phPostDispense = (id, payload = {}) =>
    API.post(`/pharmacy/dispenses/${id}/post`, payload).then(unwrap)
export const phVerifyDispense = (id, payload) =>
    API.post(`/pharmacy/dispenses/${id}/verify`, payload).then(unwrap)
export const phReturnDispense = (id, payload) =>
    API.post(`/pharmacy/dispenses/${id}/return`, payload).then(unwrap)
export const phDispenseFefoSuggest = (dispenseId, params) =>
    API.get(`/pharmacy/dispenses/${dispenseId}/fefo-suggest`, q(params)).then(unwrap)

// ---------- Alerts / Reports / Audit ----------
export const phListAlerts = (params = {}) => API.get(`/pharmacy/alerts`, q(params)).then(unwrap)
export const phAckAlert = (id, payload = {}) => API.post(`/pharmacy/alerts/${id}/ack`, payload).then(unwrap)
export const phResolveAlert = (id, payload = {}) => API.post(`/pharmacy/alerts/${id}/resolve`, payload).then(unwrap)

export const phReportStockLedger = (params = {}) => API.get(`/pharmacy/reports/stock-ledger`, q(params)).then(unwrap)
export const phReportStockValuation = (params = {}) => API.get(`/pharmacy/reports/stock-valuation`, q(params)).then(unwrap)
export const phReportExpiry = (params = {}) => API.get(`/pharmacy/reports/expiry`, q(params)).then(unwrap)
export const phReportGrnInvoiceMismatch = (params = {}) => API.get(`/pharmacy/reports/grn-vs-invoice-mismatch`, q(params)).then(unwrap)
export const phReportConsumption = (params = {}) => API.get(`/pharmacy/reports/consumption`, q(params)).then(unwrap)
export const phReportInsuranceClaimRegister = (params = {}) => API.get(`/pharmacy/reports/insurance-claim-register`, q(params)).then(unwrap)
export const phReportControlledDrugs = (params = {}) => API.get(`/pharmacy/reports/controlled-drugs`, q(params)).then(unwrap)
export const phReportSlowMoving = (params = {}) => API.get(`/pharmacy/reports/slow-moving`, q(params)).then(unwrap)
export const phReportDeadStock = (params = {}) => API.get(`/pharmacy/reports/dead-stock`, q(params)).then(unwrap)

export const phListAudit = (params = {}) => API.get(`/pharmacy/audit`, q(params)).then(unwrap)
export const phGetAudit = (id) => API.get(`/pharmacy/audit/${id}`).then(unwrap)
export const phTimeline = (params = {}) => API.get(`/pharmacy/timeline`, q(params)).then(unwrap)
