// FILE: src/api/chargeMaster.js
import API from "@/api/client"

function unwrap(res) {
    const payload = res?.data
    if (payload && typeof payload === "object" && "status" in payload) {
        if (payload?.status === false) {
            throw new Error(payload?.error?.msg || payload?.error?.message || "Request failed")
        }
        return payload?.data ?? payload
    }
    return payload
}

export function isCanceledError(e) {
    return (
        e?.code === "ERR_CANCELED" ||
        e?.name === "CanceledError" ||
        e?.name === "AbortError" ||
        String(e?.message || "").toLowerCase().includes("canceled")
    )
}

function cleanParams(obj = {}) {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === undefined || v === null) continue
        out[k] = v
    }
    return out
}

// ✅ Safe: if backend still has page_size <= 100, retry once with 100 when 422 happens.
export async function listChargeItems(params = {}, config = {}) {
    const p = cleanParams(params)

    // If caller passes page_size as string, normalize
    if (p.page_size !== undefined) {
        const n = Number(p.page_size)
        if (Number.isFinite(n) && n > 0) p.page_size = n
    }

    try {
        const res = await API.get("/masters/charge-items", { params: p, ...config })
        return unwrap(res)
    } catch (e) {
        const status = e?.response?.status
        const ps = Number(p.page_size || 0)

        // Fallback only when likely caused by `le=100` validation on backend
        if (status === 422 && ps > 100) {
            const res2 = await API.get("/masters/charge-items", {
                params: { ...p, page_size: 100 },
                ...config,
            })
            return unwrap(res2)
        }
        throw e
    }
}

export async function getChargeItem(id, config = {}) {
    const res = await API.get(`/masters/charge-items/${id}`, config)
    return unwrap(res)
}

export async function createChargeItem(data, config = {}) {
    const res = await API.post("/masters/charge-items", data, config)
    return unwrap(res)
}

export async function updateChargeItem(id, data, config = {}) {
    const res = await API.patch(`/masters/charge-items/${id}`, data, config)
    return unwrap(res)
}

export async function deleteChargeItem(id, { hard = false } = {}, config = {}) {
    const res = await API.delete(`/masters/charge-items/${id}`, {
        params: { hard: !!hard },
        ...config,
    })
    return unwrap(res)
}
