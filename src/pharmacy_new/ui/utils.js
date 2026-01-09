// FILE: src/pharmacy/ui/utils.js
export const cx = (...a) => a.filter(Boolean).join(" ")

export const money = (v) => {
    if (v === null || v === undefined || v === "") return "—"
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

export const fmtDate = (d) => {
    if (!d) return "—"
    try {
        const x = new Date(d)
        if (Number.isNaN(x.getTime())) return String(d)
        return x.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" })
    } catch {
        return String(d)
    }
}

export const fmtDT = (d) => {
    if (!d) return "—"
    try {
        const x = new Date(d)
        if (Number.isNaN(x.getTime())) return String(d)
        return x.toLocaleString("en-IN", {
            year: "numeric", month: "short", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
            timeZone: "Asia/Kolkata",
        })
    } catch {
        return String(d)
    }
}

export const statusTone = (s) => {
    const v = (s || "").toLowerCase()
    if (["posted", "received", "completed", "closed"].includes(v)) return "green"
    if (["approved", "verified"].includes(v)) return "emerald"
    if (["submitted", "pending"].includes(v)) return "amber"
    if (["cancelled", "rejected", "void"].includes(v)) return "rose"
    return "slate"
}
