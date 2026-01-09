// FILE: src/api/chargeMaster.js
import API from "@/api/client"

function unwrap(res) {
    const payload = res?.data
    if (payload?.status === false) {
        throw new Error(payload?.error?.msg || payload?.error?.message || "Request failed")
    }
    return payload?.data ?? payload
}

export function isCanceledError(e) {
    return (
        e?.code === "ERR_CANCELED" ||
        e?.name === "CanceledError" ||
        String(e?.message || "").toLowerCase().includes("canceled")
    )
}

export async function listChargeItems(params = {}) {
    const res = await API.get("/masters/charge-items", { params })
    return unwrap(res)
}

export async function getChargeItem(id) {
    const res = await API.get(`/masters/charge-items/${id}`)
    return unwrap(res)
}

export async function createChargeItem(data) {
    const res = await API.post("/masters/charge-items", data)
    return unwrap(res)
}

export async function updateChargeItem(id, data) {
    const res = await API.patch(`/masters/charge-items/${id}`, data)
    return unwrap(res)
}

export async function deleteChargeItem(id, { hard = false } = {}) {
    const res = await API.delete(`/masters/charge-items/${id}`, { params: { hard } })
    return unwrap(res)
}
