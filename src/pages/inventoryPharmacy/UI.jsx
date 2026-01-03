// FILE: src/pages/inventoryPharmacy/ui.js
import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

// ---------------- helpers ----------------
export const cx = (...classes) => classes.filter(Boolean).join(" ")

export function formatDate(iso) {
    if (!iso) return ""
    try {
        return new Date(iso).toLocaleDateString()
    } catch {
        return iso
    }
}

export const formatNumber = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return "0"
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

export function useDebouncedValue(value, delay = 350) {
    const [v, setV] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return v
}

// ---------------- premium UI primitives ----------------
export const GLASS_CARD =
    "rounded-3xl border border-slate-500/70 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm"
export const GLASS_BAR =
    "bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-slate-500/60"

export function KpiCard({ title, value, subtitle, icon: Icon, iconClass = "text-slate-400" }) {
    return (
        <Card className={cx(GLASS_CARD, "hover:shadow-md transition-shadow")}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
                {Icon ? <Icon className={cx("w-4 h-4", iconClass)} /> : null}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
                {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
            </CardContent>
        </Card>
    )
}

export function Donut({ label, value, total, accent = "#0ea5e9" }) {
    const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
    return (
        <div className="flex items-center gap-3">
            <div
                className="h-12 w-12 rounded-full border border-slate-500 shadow-inner"
                style={{
                    background: `conic-gradient(${accent} ${pct}%, #e2e8f0 0)`,
                }}
                aria-label={`${label}: ${pct.toFixed(0)}%`}
                title={`${label}: ${pct.toFixed(0)}%`}
            />
            <div className="min-w-0">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-sm font-semibold text-slate-900">
                    {formatNumber(value)}{" "}
                    <span className="text-xs font-normal text-slate-500">/ {formatNumber(total)}</span>
                </div>
            </div>
        </div>
    )
}

export function MiniBar({ label, value, max, accent = "bg-sky-500" }) {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{label}</span>
                <span className="text-slate-900 font-medium">{formatNumber(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-500/60">
                <div className={cx("h-full rounded-full", accent)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}
