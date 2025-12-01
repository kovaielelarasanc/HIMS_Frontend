// FILE: src/api/mis.js
import api from "./client"; // your axios instance

export function listMISDefinitions() {
    // ✅ matches backend: GET /api/mis/definitions
    return api.get("/mis/definitions");
}

export function runMISReport(code, body) {
    // ✅ matches backend: POST /api/mis/reports/{code}
    return api.post(`/mis/reports/${code}`, body);
}
