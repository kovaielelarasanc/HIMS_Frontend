// FILE: frontend/src/billing/BillingRevenueDashboard.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
    RefreshCcw,
    TrendingUp,
    IndianRupee,
    Layers,
    Users,
    Receipt,
    LayoutGrid,
    FilterX,
} from "lucide-react"

import { getBillingRevenueDashboard } from "@/api/billingRevenue"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
} from "recharts"

function money(v) {
    const n = Number(v || 0)
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

export default function BillingRevenueDashboard() {
    const [from, setFrom] = useState(firstDayOfMonthISO())
    const [to, setTo] = useState(todayISO())
    const [statusMode, setStatusMode] = useState("POSTED") // POSTED | APPROVED+POSTED
    const [topN, setTopN] = useState(10)

    // ✅ module filter (click cards)
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

    // auto reload on filter changes
    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to, statusMode, topN, selectedModule])

    const k = data?.kpis || {}
    const trend = (data?.trend || []).map((x) => ({
        ...x,
        billed: Number(x.billed || 0),
        collections: Number(x.collections || 0),
        refunds: Number(x.refunds || 0),
    }))

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

    return (
        <div className="space-y-4 p-4">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border bg-white shadow-sm">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">Billing Revenue Dashboard</h1>
                            <p className="text-sm text-slate-600">
                                Extreme view: Encounter + Service Groups + Referral + Module cards
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {data?.range ? (
                            <>
                                <span>
                                    Range: <span className="font-medium">{data.range.from}</span> →{" "}
                                    <span className="font-medium">{data.range.to}</span>
                                </span>
                                <Badge variant="outline" className="rounded-xl">
                                    {data.range.statuses?.join(", ") || "POSTED"}
                                </Badge>
                                {selectedModule ? (
                                    <Badge className="rounded-xl">
                                        Module: {selectedModule}
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="rounded-xl">
                                        All Modules
                                    </Badge>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <div className="text-xs text-slate-600">From</div>
                            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-2xl" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs text-slate-600">To</div>
                            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-2xl" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={statusMode === "POSTED" ? "default" : "outline"}
                            className="rounded-2xl"
                            onClick={() => setStatusMode("POSTED")}
                        >
                            POSTED only
                        </Button>
                        <Button
                            variant={statusMode === "APPROVED+POSTED" ? "default" : "outline"}
                            className="rounded-2xl"
                            onClick={() => setStatusMode("APPROVED+POSTED")}
                        >
                            APPROVED + POSTED
                        </Button>

                        {selectedModule ? (
                            <Button
                                variant="outline"
                                className="rounded-2xl"
                                onClick={() => setSelectedModule(null)}
                            >
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

            {/* ✅ Module Revenue Cards */}
            <Card className="rounded-3xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" /> Module Revenue (click a card to filter)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-500">
                            Total (all modules): <span className="font-medium">₹ {money(moduleTotalBilled)}</span> ·
                            Invoices: <span className="font-medium">{moduleTotals?.invoices || 0}</span> ·
                            Cases: <span className="font-medium">{moduleTotals?.cases || 0}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {moduleCards.map((m) => {
                            const active = selectedModule === m.module
                            const share = moduleTotalBilled ? (m.billedNum / moduleTotalBilled) * 100 : 0
                            return (
                                <button
                                    key={m.module}
                                    onClick={() => setSelectedModule(active ? null : m.module)}
                                    className={[
                                        "text-left rounded-3xl border bg-white p-4 shadow-sm transition",
                                        "hover:shadow-md hover:-translate-y-[1px]",
                                        active ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200",
                                    ].join(" ")}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <Badge variant={active ? "default" : "outline"} className="rounded-xl">
                                                {m.module}
                                            </Badge>
                                            <div className="mt-2 text-sm font-semibold leading-snug">
                                                {m.module_name || m.module}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {share.toFixed(1)}%
                                        </div>
                                    </div>

                                    <div className="mt-3 text-2xl font-semibold">
                                        ₹ {money(m.billed)}
                                    </div>

                                    <div className="mt-1 text-xs text-slate-500">
                                        Invoices: <span className="font-medium">{m.invoices}</span> · Cases:{" "}
                                        <span className="font-medium">{m.cases}</span>
                                    </div>

                                    <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                                        <div
                                            className="h-2 rounded-full bg-slate-900"
                                            style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
                                        />
                                    </div>
                                </button>
                            )
                        })}

                        {!moduleCards.length ? (
                            <div className="col-span-full rounded-2xl border bg-slate-50 p-6 text-center text-sm text-slate-600">
                                No module revenue for selected range/status.
                            </div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <IndianRupee className="h-4 w-4" /> Total Billed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">₹ {money(k.billed)}</div>
                        <div className="mt-2 text-xs text-slate-500">
                            Cases: <span className="font-medium">{k.cases || 0}</span> · Invoices:{" "}
                            <span className="font-medium">{k.invoices || 0}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <Receipt className="h-4 w-4" /> Collections
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">₹ {money(k.collections)}</div>
                        <div className="mt-2 text-xs text-slate-500">
                            Refunds: <span className="font-medium">₹ {money(k.refunds)}</span> · Receipts:{" "}
                            <span className="font-medium">{k.receipts || 0}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <Layers className="h-4 w-4" /> Net Components
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-semibold">Tax: ₹ {money(k.tax_total)}</div>
                        <div className="text-sm text-slate-600">Discount: ₹ {money(k.discount_total)}</div>
                        <div className="mt-2 text-xs text-slate-500">Sub total: ₹ {money(k.sub_total)}</div>
                    </CardContent>
                </Card> */}

                {/* <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Outstanding (simple)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">₹ {money(k.outstanding)}</div>
                        <div className="mt-2 text-xs text-slate-500">
                            Avg / case: <span className="font-medium">₹ {money(k.avg_per_case)}</span>
                        </div>
                    </CardContent>
                </Card> */}
            </div>

            {/* Trend */}
            <Card className="rounded-3xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Revenue Trend (Billed vs Collections)</CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                            <Area type="monotone" dataKey="billed" />
                            <Area type="monotone" dataKey="collections" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Encounter + Service group */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Encounter Revenue</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={encounter}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="encounter_type" />
                                <YAxis />
                                <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                                <Bar dataKey="billed" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Service Group Revenue (Net)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={svc}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="service_group" />
                                <YAxis />
                                <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                                <Bar dataKey="net" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Leaderboards */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-1">
                <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" /> Referral User Revenue (Top {topN})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-2xl border">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Referral User</th>
                                        <th className="px-3 py-2 text-right">Cases</th>
                                        <th className="px-3 py-2 text-right">Billed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data?.referral_user_revenue || []).map((r, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{r.user_name}</div>
                                                <div className="text-xs text-slate-500">ID: {r.user_id ?? "—"}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right">{r.cases}</td>
                                            <td className="px-3 py-2 text-right font-semibold">₹ {money(r.billed)}</td>
                                        </tr>
                                    ))}
                                    {!data?.referral_user_revenue?.length ? (
                                        <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={3}>No data</td></tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* <Card className="rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Receipt className="h-4 w-4" /> Cashier Collections (Top {topN})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-2xl border">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Cashier</th>
                                        <th className="px-3 py-2 text-right">Receipts</th>
                                        <th className="px-3 py-2 text-right">Collections</th>
                                        <th className="px-3 py-2 text-right">Refunds</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data?.cashier_collections || []).map((r, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{r.user_name}</div>
                                                <div className="text-xs text-slate-500">ID: {r.user_id ?? "—"}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right">{r.receipts}</td>
                                            <td className="px-3 py-2 text-right font-semibold">₹ {money(r.collections)}</td>
                                            <td className="px-3 py-2 text-right">₹ {money(r.refunds)}</td>
                                        </tr>
                                    ))}
                                    {!data?.cashier_collections?.length ? (
                                        <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={4}>No data</td></tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card> */}
            </div>

            <div className="text-xs text-slate-500">
                Module cards = always computed on total range/status. Dashboard charts/KPIs = reflect selected module filter (if clicked).
            </div>
        </div>
    )
}
