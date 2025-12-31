// src/api/ipdAdmissions.js
import API from "./client"

const unwrapAny = (res) => {
  const payload = res?.data

  // Case A: wrapped response {status:true, data:{...}}
  if (payload && typeof payload === "object" && "status" in payload) {
    if (!payload.status) {
      const msg = payload?.error?.msg || "Something went wrong"
      throw new Error(msg)
    }
    return payload.data
  }

  // Case B: direct response {items,total,limit,offset}
  return payload
}

export const listIpdAdmissions = (params) =>
  API.get(`/ipds/admissions`, { params }).then(unwrapAny)

export const exportIpdAdmissionsExcel = (params) =>
  API.get(`/ipds/admissions/export`, { params, responseType: "blob" })
