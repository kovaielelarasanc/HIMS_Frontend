// FILE: frontend/src/billing/BillingRevenueDashboard.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
    RefreshCcw,
    TrendingUp,
    IndianRupee,
    Receipt,
    LayoutGrid,
    FilterX,
    Calendar,
    BarChart3,
    LineChart as LineChartIcon,
    Activity,
    Users,
} from "lucide-react"

import { getBillingRevenueDashboard } from "@/api/billingRevenue"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
} from "recharts"

/* ---------------- helpers ---------------- */
function money(v) {
    const n = Number(v || 0)
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function inrShort(v) {
    const n = Number(v || 0)
    const abs = Math.abs(n)
    if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`
    if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} K`
    return `${n.toFixed(0)}`
}
function todayISO() {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
}
function firstDayOfMonthISO() {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    return `${yyyy}-${mm}-01`
}
function pct(n) {
    if (!Number.isFinite(n)) return "0.0%"
    return `${n.toFixed(1)}%`
}
function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n))
}

/* ---------------- UI bits ---------------- */
function chipClass(active) {
    return [
        "rounded-full px-3 py-1.5 text-xs font-medium border transition",
        active
            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
            : "bg-white/70 text-slate-700 border-slate-200 hover:bg-white hover:shadow-sm",
    ].join(" ")
}
function SegButton({ active, children, onClick }) {
    return (
        <button className={chipClass(active)} onClick={onClick} type="button">
            {children}
        </button>
    )
}
function SoftPill({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white/70 px-3 py-2">
            <div className="h-8 w-8 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-center">
                <Icon className="h-4 w-4" />
            </div>
            <div className="leading-tight">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="text-sm font-semibold text-slate-900">{value}</div>
            </div>
        </div>
    )
}
function StatCard({ title, subtitle, value, footerLeft, footerRight, Icon, accent = "slate" }) {
    const accentMap = {
        slate: "from-slate-900/10 via-white to-white",
        emerald: "from-emerald-600/10 via-white to-white",
        sky: "from-sky-600/10 via-white to-white",
        rose: "from-rose-600/10 via-white to-white",
        amber: "from-amber-500/10 via-white to-white",
        violet: "from-violet-600/10 via-white to-white",
    }
    const grad = accentMap[accent] || accentMap.slate

    return (
        <Card className="rounded-3xl border-slate-100 overflow-hidden">
            <div className={`p-4 bg-gradient-to-br ${grad}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-600">{title}</div>
                        {subtitle ? <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div> : null}
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-white/90 border border-slate-100 shadow-sm flex items-center justify-center">
                        <Icon className="h-5 w-5 text-slate-800" />
                    </div>
                </div>

                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>

                {(footerLeft || footerRight) ? (
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                        <div className="truncate">{footerLeft}</div>
                        <div className="truncate font-medium">{footerRight}</div>
                    </div>
                ) : null}
            </div>
        </Card>
    )
}
function GradientPanel({ icon: Icon, title, subtitle, right, children }) {
    return (
        <Card className="rounded-3xl border-slate-100 overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-900/10 via-white to-white border border-slate-100 shadow-sm flex items-center justify-center">
                            <Icon className="h-5 w-5 text-slate-800" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-base">{title}</CardTitle>
                            {subtitle ? <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div> : null}
                        </div>
                    </div>
                    {right ? <div className="shrink-0">{right}</div> : null}
                </div>
            </CardHeader>
            <CardContent className="pt-0">{children}</CardContent>
        </Card>
    )
}

/* ---------------- chart tooltip (premium) ---------------- */
function TrendTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const get = (key) => Number(payload.find((p) => p.dataKey === key)?.value || 0)

    const billed = get("billed")
    const collections = get("collections")
    const refunds = get("refunds")
    const net = get("net")

    return (
        <div className="rounded-2xl border border-slate-100 bg-white/95 shadow-lg p-3 backdrop-blur">
            <div className="text-xs text-slate-500">Date</div>
            <div className="text-sm font-semibold text-slate-900">{label}</div>

            <div className="mt-2 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-6">
                    <span className="text-slate-600">Billed</span>
                    <span className="font-semibold text-slate-900">₹ {money(billed)}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                    <span className="text-slate-600">Collections</span>
                    <span className="font-semibold text-slate-900">₹ {money(collections)}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                    <span className="text-slate-600">Refunds</span>
                    <span className="font-semibold text-slate-900">₹ {money(refunds)}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-6">
                    <span className="text-slate-600">Net</span>
                    <span className="font-semibold text-slate-900">₹ {money(net)}</span>
                </div>
            </div>
        </div>
    )
}

/* ---------------- referral cards ---------------- */
function ReferralCards({ rows = [], topN = 10 }) {
    const list = [...rows].slice(0, topN)
    const total = list.reduce((s, r) => s + Number(r.billed || 0), 0)

    if (!list.length) {
        return (
            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-600">
                No referral revenue for this range.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {list.map((r, idx) => {
                const billed = Number(r.billed || 0)
                const share = total > 0 ? (billed / total) * 100 : 0
                const initials = String(r.user_name || "U").trim().slice(0, 2).toUpperCase()
                return (
                    <Card key={idx} className="rounded-3xl border-slate-100 overflow-hidden">
                        <div className="p-4 bg-gradient-to-br from-white via-slate-50 to-white">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="h-11 w-11 rounded-3xl border border-slate-100 bg-white shadow-sm flex items-center justify-center">
                                        <div className="text-xs font-semibold text-slate-700">{initials}</div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="rounded-full">
                                                #{idx + 1}
                                            </Badge>
                                            <div className="text-xs text-slate-500">ID: {r.user_id ?? "—"}</div>
                                        </div>
                                        <div className="mt-1 font-semibold text-slate-900 truncate">
                                            {r.user_name || "—"}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-600">
                                            Cases: <span className="font-medium">{r.cases || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-[11px] text-slate-500">Share</div>
                                    <div className="text-sm font-semibold text-slate-900">{share.toFixed(1)}%</div>
                                </div>
                            </div>

                            <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                                ₹ {money(billed)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Billed</div>

                            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-2 rounded-full bg-slate-900"
                                    style={{ width: `${clamp(share, 0, 100)}%` }}
                                />
                            </div>
                        </div>
                    </Card>
                )
            })}
        </div>
    )
}

/* ---------------- main ---------------- */
export default function BillingRevenueDashboard() {
    const [from, setFrom] = useState(firstDayOfMonthISO())
    const [to, setTo] = useState(todayISO())
    const [statusMode, setStatusMode] = useState("POSTED") // POSTED | APPROVED+POSTED
    const [topN, setTopN] = useState(10)
    const [selectedModule, setSelectedModule] = useState(null)
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState(null)

    const statuses = useMemo(() => {
        if (statusMode === "APPROVED+POSTED") return ["APPROVED", "POSTED"]
        return ["POSTED"]
    }, [statusMode])

    async function load() {
        try {
            setLoading(true)
            const payload = await getBillingRevenueDashboard({
                date_from: from,
                date_to: to,
                top_n: topN,
                statuses,
                module: selectedModule || undefined,
            })
            setData(payload)
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || "Failed to load revenue dashboard")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to, statusMode, topN, selectedModule])

    const k = data?.kpis || {}

    // ✅ improved trend dataset + net series
    const trend = (data?.trend || []).map((x) => {
        const billed = Number(x.billed || 0)
        const collections = Number(x.collections || 0)
        const refunds = Number(x.refunds || 0)
        return {
            ...x,
            billed,
            collections,
            refunds,
            net: Math.max(0, collections - refunds),
        }
    })

    const encounter = (data?.encounter_revenue || []).map((x) => ({
        ...x,
        billed: Number(x.billed || 0),
    }))

    const svc = (data?.service_group_revenue || []).map((x) => ({
        ...x,
        net: Number(x.net || 0),
    }))

    const moduleCards = (data?.module_revenue || []).map((m) => ({
        ...m,
        billedNum: Number(m.billed || 0),
    }))
    const moduleTotals = data?.module_totals || {}
    const moduleTotalBilled = Number(moduleTotals?.billed || 0)

    const billed = Number(k.billed || 0)
    const collections = Number(k.collections || 0)
    const refunds = Number(k.refunds || 0)
    const netCollections = Math.max(0, collections - refunds)
    const collectionRate = billed > 0 ? (collections / billed) * 100 : 0
    const refundRate = collections > 0 ? (refunds / collections) * 100 : 0

    function setTopNSafe(v) {
        const n = Math.max(5, Math.min(50, Number(v || 10)))
        setTopN(n)
    }

    return (
        <div className="p-4 lg:p-6 space-y-4">
            {/* Header */}
            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-white p-4 lg:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-slate-800" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-slate-900">
                                        Revenue Dashboard
                                    </h1>
                                    <Badge variant="secondary" className="rounded-full">
                                        Billing
                                    </Badge>
                                    {selectedModule ? (
                                        <Badge className="rounded-full">Module: {selectedModule}</Badge>
                                    ) : (
                                        <Badge variant="outline" className="rounded-full">
                                            All Modules
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-1 text-sm text-slate-600">
                                    KPIs + Trend + Encounter & Service mix + Referral insights
                                </div>

                                {data?.range ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <SoftPill icon={Calendar} label="Range" value={`${data.range.from} → ${data.range.to}`} />
                                        <SoftPill icon={Activity} label="Statuses" value={(data.range.statuses?.join(", ") || "POSTED")} />
                                        <SoftPill icon={LayoutGrid} label="Modules" value={selectedModule ? selectedModule : "All"} />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:items-end">
                        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:justify-end">
                            <div className="space-y-1">
                                <div className="text-xs text-slate-600">From</div>
                                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-2xl bg-white" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-slate-600">To</div>
                                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-2xl bg-white" />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white/70 p-1">
                                <SegButton active={statusMode === "POSTED"} onClick={() => setStatusMode("POSTED")}>
                                    APPROVED + POSTED
                                </SegButton>
                                {/* <SegButton active={statusMode === "APPROVED+POSTED"} onClick={() => setStatusMode("APPROVED+POSTED")}>
                                    APPROVED + POSTED
                                </SegButton> */}
                            </div>

                            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white/70 px-3 py-2">
                                <div className="text-xs text-slate-500">Top</div>
                                <Input className="h-8 w-20 rounded-xl bg-white" value={topN} onChange={(e) => setTopNSafe(e.target.value)} inputMode="numeric" />
                            </div>

                            {selectedModule ? (
                                <Button variant="outline" className="rounded-2xl" onClick={() => setSelectedModule(null)}>
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Clear Module
                                </Button>
                            ) : null}

                            <Button onClick={load} disabled={loading} className="rounded-2xl">
                                <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard
                    title="Total Billed"
                    subtitle="Invoices total for range"
                    value={`₹ ${money(billed)}`}
                    footerLeft={`Cases: ${k.cases || 0}`}
                    footerRight={`Invoices: ${k.invoices || 0}`}
                    Icon={IndianRupee}
                    accent="violet"
                />
                <StatCard
                    title="Collections"
                    subtitle="Receipts collected"
                    value={`₹ ${money(collections)}`}
                    footerLeft={`Receipts: ${k.receipts || 0}`}
                    footerRight={`Rate: ${pct(collectionRate)}`}
                    Icon={Receipt}
                    accent="emerald"
                />
                <StatCard
                    title="Refunds"
                    subtitle="Refund total"
                    value={`₹ ${money(refunds)}`}
                    footerLeft={`Refund rate: ${pct(refundRate)}`}
                    footerRight={`Net: ₹ ${money(netCollections)}`}
                    Icon={Activity}
                    accent="rose"
                />
                <StatCard
                    title="Average / Case"
                    subtitle="Simple KPI"
                    value={`₹ ${money(k.avg_per_case || 0)}`}
                    footerLeft={`Outstanding: ₹ ${money(k.outstanding || 0)}`}
                    footerRight={`Tax: ₹ ${money(k.tax_total || 0)}`}
                    Icon={BarChart3}
                    accent="amber"
                />
            </div>

            {/* Module cards */}
            <GradientPanel
                icon={LayoutGrid}
                title="Module Revenue"
                subtitle="Click a module to filter the whole dashboard"
                right={
                    <div className="text-xs text-slate-500 text-right">
                        <div>
                            Total: <span className="font-semibold text-slate-900">₹ {money(moduleTotalBilled)}</span>
                        </div>
                        <div>
                            Invoices: <span className="font-medium">{moduleTotals?.invoices || 0}</span> · Cases:{" "}
                            <span className="font-medium">{moduleTotals?.cases || 0}</span>
                        </div>
                    </div>
                }
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {moduleCards.map((m) => {
                        const active = selectedModule === m.module
                        const share = moduleTotalBilled ? (m.billedNum / moduleTotalBilled) * 100 : 0

                        return (
                            <button
                                key={m.module}
                                onClick={() => setSelectedModule(active ? null : m.module)}
                                className={[
                                    "group text-left rounded-3xl border bg-white p-4 shadow-sm transition",
                                    "hover:shadow-md hover:-translate-y-[1px]",
                                    active ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-100",
                                ].join(" ")}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <Badge variant={active ? "default" : "outline"} className="rounded-full">
                                            {m.module}
                                        </Badge>
                                        <div className="mt-2 text-sm font-semibold text-slate-900 truncate">
                                            {m.module_name || m.module}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500">{share.toFixed(1)}%</div>
                                </div>

                                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                                    ₹ {money(m.billed)}
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                    Invoices: <span className="font-medium text-slate-700">{m.invoices}</span> · Cases:{" "}
                                    <span className="font-medium text-slate-700">{m.cases}</span>
                                </div>

                                <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-2 rounded-full bg-slate-900 transition-all" style={{ width: `${clamp(share, 0, 100)}%` }} />
                                </div>
                            </button>
                        )
                    })}

                    {!moduleCards.length ? (
                        <div className="col-span-full rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-600">
                            No module revenue for selected range/status.
                        </div>
                    ) : null}
                </div>
            </GradientPanel>

            {/* ✅ Improved Trend Chart */}
            <GradientPanel
                icon={LineChartIcon}
                title="Revenue Trend"
                subtitle="Billed, Collections, Refunds and Net over time"
                right={
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full">Hover for details</Badge>
                    </div>
                }
            >
                {!trend.length ? (
                    <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-600">
                        No trend data for this range.
                    </div>
                ) : (
                    <>
                        {/* mini KPIs for chart */}
                        <div className="mb-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                                <div className="text-[11px] text-slate-500">Billed</div>
                                <div className="text-sm font-semibold text-slate-900">₹ {money(billed)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                                <div className="text-[11px] text-slate-500">Collections</div>
                                <div className="text-sm font-semibold text-slate-900">₹ {money(collections)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                                <div className="text-[11px] text-slate-500">Refunds</div>
                                <div className="text-sm font-semibold text-slate-900">₹ {money(refunds)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                                <div className="text-[11px] text-slate-500">Net</div>
                                <div className="text-sm font-semibold text-slate-900">₹ {money(netCollections)}</div>
                            </div>
                        </div>

                        <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={trend} margin={{ left: 6, right: 10, top: 10, bottom: 0 }}>
                                    {/* brand gradients */}
                                    <defs>
                                        <linearGradient id="fillBilled" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.18} />
                                            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.03} />
                                        </linearGradient>
                                        <linearGradient id="fillCollections" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                                        </linearGradient>
                                        <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.18} />
                                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.03} />
                                        </linearGradient>
                                    </defs>

                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹ ${inrShort(v)}`} />
                                    <Tooltip content={<TrendTooltip />} />

                                    {/* Areas */}
                                    <Area type="monotone" dataKey="billed" stroke="#7c3aed" strokeWidth={2} fill="url(#fillBilled)" />
                                    <Area type="monotone" dataKey="collections" stroke="#10b981" strokeWidth={2} fill="url(#fillCollections)" />
                                    <Area type="monotone" dataKey="net" stroke="#0ea5e9" strokeWidth={2} fill="url(#fillNet)" />

                                    {/* Refunds as line */}
                                    <Line type="monotone" dataKey="refunds" stroke="#ef4444" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                            Tip: Net = Collections − Refunds (clamped at 0).
                        </div>
                    </>
                )}
            </GradientPanel>

            {/* Encounter + Service group */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <GradientPanel icon={BarChart3} title="Encounter Revenue" subtitle="Billed by encounter type">
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={encounter} margin={{ left: 6, right: 10, top: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="encounter_type" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹ ${inrShort(v)}`} />
                                <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                                <Bar dataKey="billed" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GradientPanel>

                <GradientPanel icon={BarChart3} title="Service Group Revenue" subtitle="Net by service group">
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={svc} margin={{ left: 6, right: 10, top: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="service_group" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹ ${inrShort(v)}`} />
                                <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                                <Bar dataKey="net" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GradientPanel>
            </div>

            {/* ✅ Referral card style */}
            <GradientPanel
                icon={Users}
                title={`Referral User Revenue (Top ${topN})`}
                subtitle="Card view (premium) — best for quick insights"
            >
                <ReferralCards rows={data?.referral_user_revenue || []} topN={topN} />

                <div className="mt-3 text-xs text-slate-500">
                    Module cards are based on total range/status; KPIs & charts reflect the selected module filter (if any).
                </div>
            </GradientPanel>
        </div>
    )
}
