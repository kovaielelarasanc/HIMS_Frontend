// FILE: src/api/inventoryIndent.js
import API from "./client"

const unwrap = (res) => {
  console.log(res.data, "check res");

  const payload = res?.data
  if (!payload?.status) {
    const msg = payload?.error?.msg || "Something went wrong"
    throw new Error(msg)
  }
  return payload.data
}

// ---------------------
// Catalog
// ---------------------


export function invListLocations(params) {
    return API.get(`/inventory/locations`, { params })
}
export const invListItems = (params) =>
  API.get(`/inventory/items`, { params }).then(unwrap)

export const invGetItem = (itemId) =>
  API.get(`/inventory/items/${itemId}`).then(unwrap)

export const invListStock = (params) =>
  API.get(`/inventory/stock`, { params }).then(unwrap)

export const invListBatches = (params) =>
  API.get(`/inventory/batches`, { params }).then(unwrap)

// ---------------------
// Indents
// ---------------------
export const invListIndents = (params) =>
  API.get(`/inventory/indents`, { params }).then(unwrap)

export const invGetIndent = (indentId) =>
  API.get(`/inventory/indents/${indentId}`).then(unwrap)

export const invCreateIndent = (payload) =>
  API.post(`/inventory/indents`, payload).then(unwrap)

export const invUpdateIndent = (indentId, payload) =>
  API.put(`/inventory/indents/${indentId}`, payload).then(unwrap)

export const invSubmitIndent = (indentId) =>
  API.post(`/inventory/indents/${indentId}/submit`).then(unwrap)

export const invApproveIndent = (indentId, payload) =>
  API.post(`/inventory/indents/${indentId}/approve`, payload).then(unwrap)

export const invCancelIndent = (indentId, payload) =>
  API.post(`/inventory/indents/${indentId}/cancel`, payload).then(unwrap)

// ---------------------
// Issues
// ---------------------
export const invListIssues = (params) =>
  API.get(`/inventory/issues`, { params }).then(unwrap)

export const invGetIssue = (issueId) =>
  API.get(`/inventory/issues/${issueId}`).then(unwrap)

export const invCreateIssueFromIndent = (indentId, payload) =>
  API.post(`/inventory/indents/${indentId}/issues`, payload).then(unwrap)

export const invUpdateIssueItem = (issueItemId, payload) =>
  API.put(`/inventory/issue-items/${issueItemId}`, payload).then(unwrap)

export const invPostIssue = (issueId) =>
  API.post(`/inventory/issues/${issueId}/post`).then(unwrap)

export const invCancelIssue = (issueId, payload) =>
  API.post(`/inventory/issues/${issueId}/cancel`, payload).then(unwrap)
