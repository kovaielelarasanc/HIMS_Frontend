// FILE: src/api/inventoryMoves.js
import API from "./client"

const unwrap = (res) => {
  const payload = res?.data
  if (!payload?.status) {
    const msg = payload?.error?.msg || payload?.detail || "Something went wrong"
    throw new Error(msg)
  }
  return payload.data
}

/**
 * NOTE:
 * Your backend routes in routes_inventory_indent.py are mounted with:
 * router = APIRouter(prefix="/inventory", ...)
 *
 * And your client likely already prefixes /api internally.
 * So we use: /inventory/...
 */

// =========================
// BATCHES / CATALOG (re-use existing)
// =========================
export async function invListBatches(params) {
  return unwrap(await API.get(`/inventory/batches`, { params }))
}

export async function invListLocations(params) {
  return unwrap(await API.get(`/inventory/locations`, { params }))
}

export async function invListItems(params) {
  return unwrap(await API.get(`/inventory/items`, { params }))
}

export async function invListStock(params) {
  return unwrap(await API.get(`/inventory/stock`, { params }))
}

// =========================
// CONSUMPTIONS (keep same function names)
// (Use these endpoints only if you created them in backend)
// =========================
export async function invListConsumptions(params) {
  return unwrap(await API.get(`/inventory/consumptions`, { params }))
}

export async function invGetConsumption(id) {
  return unwrap(await API.get(`/inventory/consumptions/${Number(id)}`))
}

export async function invUpdateConsumptionItem(lineId, payload) {
  return unwrap(
    await API.put(`/inventory/consumption-items/${Number(lineId)}`, payload)
  )
}

export async function invPostConsumption(id) {
  return unwrap(await API.post(`/inventory/consumptions/${Number(id)}/post`))
}

export async function invCancelConsumption(id, payload) {
  return unwrap(
    await API.post(`/inventory/consumptions/${Number(id)}/cancel`, payload)
  )
}

// =========================
// RETURNS / WASTAGE
// (Use these endpoints only if you created them in backend)
// =========================
export async function invListReturnsWastage(params) {
  return unwrap(await API.get(`/inventory/stock-returns`, { params }))
}

export async function invGetReturnWastage(id) {
  return unwrap(await API.get(`/inventory/stock-returns/${Number(id)}`))
}

export async function invUpdateReturnWastageItem(lineId, payload) {
  return unwrap(
    await API.put(`/inventory/stock-return-items/${Number(lineId)}`, payload)
  )
}

export async function invPostReturnWastage(id) {
  return unwrap(await API.post(`/inventory/stock-returns/${Number(id)}/post`))
}

export async function invCancelReturnWastage(id, payload) {
  return unwrap(
    await API.post(`/inventory/stock-returns/${Number(id)}/cancel`, payload)
  )
}

// =========================
// ISSUE endpoints (your existing backend already has these)
// =========================
export async function invListIssues(params) {
  return unwrap(await API.get(`/inventory/issues`, { params }))
}

export async function invGetIssue(id) {
  return unwrap(await API.get(`/inventory/issues/${Number(id)}`))
}

export async function invUpdateIssueItem(issueItemId, payload) {
  return unwrap(await API.put(`/inventory/issue-items/${Number(issueItemId)}`, payload))
}

export async function invPostIssue(issueId) {
  return unwrap(await API.post(`/inventory/issues/${Number(issueId)}/post`))
}

export async function invCancelIssue(issueId, payload) {
  return unwrap(await API.post(`/inventory/issues/${Number(issueId)}/cancel`, payload))
}
