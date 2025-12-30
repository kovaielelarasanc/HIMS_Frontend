// FILE: src/api/pdfReports.js
import API from "./client";

// If you already have unwrap in your project, keep using it.
// Here we keep it safe and flexible.
const unwrap = (res) => {
  const payload = res?.data;
  // support both {status:true,data} and raw arrays/objects
  if (payload && typeof payload === "object" && "status" in payload) {
    if (!payload.status) {
      const msg = payload?.error?.msg || payload?.message || "Something went wrong";
      throw new Error(msg);
    }
    return payload.data;
  }
  return payload;
};

// -------- Templates --------
export const listPdfTemplates = (module) =>
  API.get(`/pdf/templates`, { params: { module } }).then(unwrap);

export const getPdfTemplate = (templateId) =>
  API.get(`/pdf/templates/${templateId}`).then(unwrap);

// -------- IPD PDFs --------
// Case Sheet (GET: /api/pdf/ipd/admissions/:id/case-sheet)
export const fetchIpdCaseSheetPdf = (admissionId, params = {}) =>
  API.get(`/pdf/ipd/admissions/${admissionId}/case-sheet`, {
    params,
    responseType: "arraybuffer",
    headers: { Accept: "application/pdf" },
  });

// Drug Chart (GET: /api/ipd/admissions/:id/drug-chart/pdf)
export const fetchIpdDrugChartPdf = (admissionId, params = {}) =>
  API.get(`/ipd/admissions/${admissionId}/drug-chart/pdf`, {
    // params are optional; FastAPI will ignore unknown query params if unused
    params,
    responseType: "arraybuffer",
    headers: { Accept: "application/pdf" },
  });
