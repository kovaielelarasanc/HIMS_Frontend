// FILE: src/api/dashboard.js
import api from "./client";

export function fetchDashboardData(params = {}) {
    return api.get("/dashboard/data", { params });
}
