// FILE: src/api/dashboard.js
import api from "./client";

// Fetch all widgets + data for *logged-in* user.
// Role is inferred in backend, so no need to pass role from FE.
export function fetchDashboardData(params = {}) {
    // params can include date_from, date_to, unit_id, department_id
    return api.get("/dashboard/data", { params });
}
