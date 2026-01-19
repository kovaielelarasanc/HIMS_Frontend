// FILE: frontend/src/api/billingRevenue.js
import API from "@/api/client"

export async function getBillingRevenueDashboard(params) {
    const res = await API.get("/billing/revenue/dashboard", { params })
    return res.data
}
