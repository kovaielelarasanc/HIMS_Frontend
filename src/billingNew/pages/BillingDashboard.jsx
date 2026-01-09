// FILE: src/billing/pages/BillingDashboard.jsx
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
    BarChart3,
    CalendarDays,
    IndianRupee,
    Layers,
    Stethoscope,
    WalletCards,
} from "lucide-react"
import { toast } from "sonner"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
} from "recharts"

import { getDashboard, pickMsg } from "../api/billing"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

function ymd(d) {
    const pad = (n) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}
function formatINR(n) {
    const val = Number(n || 0)
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(val)
}

function getWidget(widgets, code) {
    return (widgets || []).find((w) => w?.code === code)
}

export default function BillingDashboard() {
    const today = useMemo(() => new Date(), [])
    const [preset, setPreset] = useState("today") // today | last7 | thisMonth | custom
    const [dateFrom, setDateFrom] = useState(ymd(today))
    const [dateTo, setDateTo] = useState(ymd(today))

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState(null)

    // preset apply
    useEffect(() => {
        const t = new Date()
        if (preset === "today") {
            setDateFrom(ymd(t))
            setDateTo(ymd(t))
        } else if (preset === "last7") {
            const s = new Date(t)
            s.setDate(s.getDate() - 6)
            setDateFrom(ymd(s))
            setDateTo(ymd(t))
        } else if (preset === "thisMonth") {
            setDateFrom(ymd(startOfMonth(t)))
            setDateTo(ymd(t))
        }
    }, [preset])

    async function load() {
        setLoading(true)
        try {
            const res = await getDashboard({ date_from: dateFrom, date_to: dateTo })
            setData(res)
        } catch (e) {
            toast.error(pickMsg(e))
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFrom, dateTo])

    const widgets = data?.widgets || []
    const caps = data?.filters?.caps || {}

    const revenueTotal = getWidget(widgets, "revenue_total")?.data ?? 0
    const revenuePending = getWidget(widgets, "revenue_pending")?.data ?? 0
    const revenueOpd = getWidget(widgets, "revenue_opd")?.data ?? 0
    const revenueIpd = getWidget(widgets, "revenue_ipd")?.data ?? 0
    const revenuePharmacy = getWidget(widgets, "revenue_pharmacy")?.data ?? 0
    const revenueLab = getWidget(widgets, "revenue_lab")?.data ?? 0
    const revenueRad = getWidget(widgets, "revenue_radiology")?.data ?? 0
    const revenueOt = getWidget(widgets, "revenue_ot")?.data ?? 0

    const revenueByStream = getWidget(widgets, "revenue_by_stream")?.data || [
        { label: "OPD", value: revenueOpd },
        { label: "IPD", value: revenueIpd },
        { label: "Pharmacy", value: revenuePharmacy },
        { label: "Lab", value: revenueLab },
        { label: "Radiology", value: revenueRad },
        { label: "OT", value: revenueOt },
    ]

    const paymentModes = getWidget(widgets, "payment_modes")?.data || []
    const patientFlow = getWidget(widgets, "patient_flow")?.data || []

    const visibleStream = revenueByStream.filter((x) => Number(x?.value || 0) > 0)

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-slate-700" />
                        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                            Billing Dashboard
                        </h1>
                        <Badge variant="secondary" className="rounded-full">
                            Revenue Management
                        </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                        Stream-wise performance (OP/IP/Lab/RIS/Pharmacy/OT) + collections insights.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={preset === "today" ? "default" : "outline"}
                        className="rounded-xl"
                        onClick={() => setPreset("today")}
                    >
                        Today
                    </Button>
                    <Button
                        variant={preset === "last7" ? "default" : "outline"}
                        className="rounded-xl"
                        onClick={() => setPreset("last7")}
                    >
                        Last 7 Days
                    </Button>
                    <Button
                        variant={preset === "thisMonth" ? "default" : "outline"}
                        className="rounded-xl"
                        onClick={() => setPreset("thisMonth")}
                    >
                        This Month
                    </Button>

                    <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm">
                        <CalendarDays className="h-4 w-4 text-slate-600" />
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => {
                                    setPreset("custom")
                                    setDateFrom(e.target.value)
                                }}
                                className="text-sm bg-transparent outline-none"
                            />
                            <span className="text-slate-400">→</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => {
                                    setPreset("custom")
                                    setDateTo(e.target.value)
                                }}
                                className="text-sm bg-transparent outline-none"
                            />
                        </div>
                        <Button onClick={load} size="sm" className="rounded-xl">
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
                <MetricCard
                    loading={loading}
                    title="Total Revenue"
                    value={formatINR(revenueTotal)}
                    subtitle="Finalized / posted revenue (selected range)"
                    icon={<IndianRupee className="h-5 w-5" />}
                />
                <MetricCard
                    loading={loading}
                    title="Pending Bill Amount"
                    value={formatINR(revenuePending)}
                    subtitle="Open invoices (not finalized/cancelled)"
                    icon={<Layers className="h-5 w-5" />}
                />
                <MetricCard
                    loading={loading}
                    title="OPD + IPD Revenue"
                    value={formatINR(Number(revenueOpd || 0) + Number(revenueIpd || 0))}
                    subtitle="Core consultation / admission billing"
                    icon={<Stethoscope className="h-5 w-5" />}
                />
                <MetricCard
                    loading={loading}
                    title="Collections Snapshot"
                    value={paymentModes?.length ? "Available" : "—"}
                    subtitle="Payment modes breakdown (selected range)"
                    icon={<WalletCards className="h-5 w-5" />}
                />
            </div>

            <Separator />

            {/* Charts row */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Stream revenue */}
                <Card className="rounded-2xl shadow-sm lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                            <span>Revenue by Stream</span>
                            <Badge variant="secondary" className="rounded-full">
                                {dateFrom} → {dateTo}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-40" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : (
                            <div className="h-72">
                                {visibleStream.length === 0 ? (
                                    <EmptyState text="No stream revenue found for selected period." />
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={revenueByStream}>
                                            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(v) => formatINR(v)} />
                                            <Bar dataKey="value" radius={[10, 10, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        )}

                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                            <MiniKpi label="OPD" value={formatINR(revenueOpd)} disabled={!caps?.can_opd} />
                            <MiniKpi label="IPD" value={formatINR(revenueIpd)} disabled={!caps?.can_ipd} />
                            <MiniKpi label="Pharmacy" value={formatINR(revenuePharmacy)} disabled={!caps?.can_pharmacy} />
                            <MiniKpi label="Lab" value={formatINR(revenueLab)} disabled={!caps?.can_lab} />
                            <MiniKpi label="Radiology" value={formatINR(revenueRad)} disabled={!caps?.can_radiology} />
                            <MiniKpi label="OT" value={formatINR(revenueOt)} disabled={!caps?.can_ot} />
                        </div>
                    </CardContent>
                </Card>

                {/* Payment modes */}
                <Card className="rounded-2xl shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Payment Modes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-36" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : (
                            <div className="h-72">
                                {paymentModes.length === 0 ? (
                                    <EmptyState text="No payment data available for selected period." />
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={paymentModes}
                                                dataKey="value"
                                                nameKey="label"
                                                innerRadius={55}
                                                outerRadius={85}
                                                paddingAngle={3}
                                            >
                                                {paymentModes.map((_, idx) => (
                                                    <Cell key={idx} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => formatINR(v)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        )}

                        <div className="mt-3 space-y-2">
                            {paymentModes.slice(0, 6).map((m, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{m.label}</span>
                                    <span className="font-medium text-slate-900">{formatINR(m.value)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Patient flow (optional) */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Patient Flow (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-64 w-full" />
                    ) : (
                        <div className="h-72">
                            {patientFlow.length === 0 ? (
                                <EmptyState text="No patient flow data available." />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={patientFlow}>
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="new_patients" radius={[10, 10, 0, 0]} />
                                        <Bar dataKey="opd_visits" radius={[10, 10, 0, 0]} />
                                        <Bar dataKey="ipd_admissions" radius={[10, 10, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-slate-500"
            >
                Tip: For strict “revenue” use POSTED invoices; for “billing created” use APPROVED/DRAFT too (workflow dependent).
            </motion.div>
        </div>
    )
}

function MetricCard({ loading, title, value, subtitle, icon }) {
    return (
        <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-sm text-slate-600">{title}</p>
                        {loading ? (
                            <Skeleton className="h-7 w-36" />
                        ) : (
                            <p className="text-xl font-semibold text-slate-900">{value}</p>
                        )}
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-2 text-slate-700">
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function MiniKpi({ label, value, disabled }) {
    return (
        <div
            className={[
                "rounded-2xl border p-3 bg-white shadow-sm",
                disabled ? "opacity-50" : "",
            ].join(" ")}
        >
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-sm font-semibold text-slate-900 mt-1">{value}</div>
        </div>
    )
}

function EmptyState({ text }) {
    return (
        <div className="h-full flex items-center justify-center rounded-2xl border border-dashed bg-slate-50">
            <div className="text-sm text-slate-600">{text}</div>
        </div>
    )
}
