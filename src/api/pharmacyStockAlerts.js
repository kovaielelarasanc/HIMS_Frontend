// FILE: src/api/pharmacyStockAlerts.js
import API from "@/api/client" // ✅ your axios instance

function unwrap(res) {
    const payload = res?.data

    // If backend wraps as { status:false, error:{msg} }
    if (payload?.status === false) {
        throw new Error(payload?.error?.msg || "Request failed")
    }

    // If backend wraps as { data: ... }
    return payload?.data ?? payload
}

// // ✅ normalize axios cancel errors (AbortController)
// function isCanceledError(e) {
//     return (
//         e?.code === "ERR_CANCELED" ||
//         e?.name === "CanceledError" ||
//         e?.message?.toLowerCase?.().includes("canceled")
//     )
// }

// export { isCanceledError }

export async function getStockAlertsSummary(params = {}, config = {}) {
    const res = await API.get("/pharmacy/stock/alerts/summary", { params, ...config })
    return unwrap(res)
}

export async function listStockAlerts(params = {}, config = {}) {
    const res = await API.get("/pharmacy/stock/alerts/list", { params, ...config })
    return unwrap(res)
}

export async function getItemBatches(itemId, params = {}, config = {}) {
    const res = await API.get(`/pharmacy/stock/items/${itemId}/batches`, { params, ...config })
    return unwrap(res)
}

/**
 * ✅ These two endpoints are required for the "Stock" + "Quarantine" tabs
 * If you already have them, just map the URL here.
 */
export async function getStockSummary(params = {}, config = {}) {
    const res = await API.get("/pharmacy/stock/summary", { params, ...config })
    return unwrap(res)
}

export async function getQuarantineBatches(params = {}, config = {}) {
    const res = await API.get("/pharmacy/stock/quarantine", { params, ...config })
    return unwrap(res)
}

export async function exportStockAlerts(params = {}, config = {}) {
    // backend returns file directly (blob)
    const res = await API.get("/pharmacy/stock/alerts/export", {
        params,
        responseType: "blob",
        ...config,
    })
    return res.data
}

export function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename || "download"
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
}
