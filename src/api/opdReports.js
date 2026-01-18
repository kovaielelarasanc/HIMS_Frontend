// src/api/opdReports.js
import API from "@/api/client"

export function opdExportExcel(params) {
  return API.get("/opd/reports/opd.xlsx", {
    params,
    responseType: "blob",
  })
}
