import API from "./client"

const unwrap = (res) => {
  const payload = res?.data
  if (!payload?.status) {
    const msg = payload?.error?.msg || "Something went wrong"
    throw new Error(msg)
  }
  return payload.data
}

// ✅ Items for dropdown: only issued/available in location
export function invListConsumptionItems(params) {
  return API.get(`/inventory/consumption-items`, { params })
}

// ✅ Patient used items (billable consumption)
export function invCreatePatientConsumption(body) {
  return API.post(`/inventory/consumptions/patient`, body)
}

// ✅ List nurse entries (patient usage list)
export function invListPatientConsumptions(params) {
  return API.get(`/inventory/consumptions/patient`, { params })
}

// ✅ Bulk reconcile (closing balance)
export function invPostBulkReconcile(body) {
  return API.post(`/inventory/consumptions/reconcile`, body)
}
