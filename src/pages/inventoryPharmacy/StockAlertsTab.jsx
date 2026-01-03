// FILE: src/pages/pharmacy/StockAlertsDashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    RefreshCcw,
    Download,
    Search,
    Filter,
    ShieldAlert,
    Boxes,
    CalendarDays,
    TrendingUp,
    Warehouse,
    BadgeAlert,
    Layers,
    X,
    Eye,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

import {
    getStockAlertsSummary,
    listStockAlerts,
    getItemBatches,
    getStockSummary,
    getQuarantineBatches,
    exportStockAlerts,
    downloadBlob,
    //   isCanceledError,
} from "@/api/pharmacyStockAlerts"

const ALL = "__ALL__"

const ALERT_TYPES = [
    { key: "LOW_STOCK", label: "Low Stock" },
    { key: "OUT_OF_STOCK", label: "Out of Stock" },
    { key: "NEAR_EXPIRY", label: "Near Expiry" },
    { key: "EXPIRED", label: "Expired" },
    { key: "NON_MOVING", label: "Non-moving" },
    { key: "REORDER", label: "Reorder Suggested" },
    { key: "BATCH_RISK", label: "Batch Risk" },
    { key: "NEGATIVE_STOCK", label: "Negative / Mismatch" },
    { key: "HIGH_VALUE_EXPIRY", label: "High Value Expiry" },
    { key: "CONTROLLED_DRUG", label: "Controlled / High-risk" },
    { key: "FEFO_RISK", label: "FEFO Risk" },
    { key: "OVER_STOCK", label: "Over Stock" },
]

const REPORT_TYPES = [
    { key: "LOW_STOCK", label: "Low stock list" },
    { key: "OUT_OF_STOCK", label: "Out of stock list" },
    { key: "NEAR_EXPIRY", label: "Near expiry list" },
    { key: "EXPIRED", label: "Expired stock list" },
    { key: "NON_MOVING", label: "Non-moving stock list" },
    { key: "VALUATION", label: "Stock valuation report" },
]

function fmtDate(d) {
    if (!d) return "—"
    try {
        const dt = typeof d === "string" ? new Date(d) : d
        if (Number.isNaN(dt.getTime())) return String(d)
        return dt.toLocaleDateString("en-IN")
    } catch {
        return String(d)
    }
}

function fmtNum(v) {
    if (v === null || v === undefined || v === "") return "—"
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)
}

function fmtMoney(v) {
    if (v === null || v === undefined || v === "") return "—"
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(n)
}

function SevBadge({ severity }) {
    const s = (severity || "").toUpperCase()
    const cls =
        s === "CRIT"
            ? "bg-red-50 text-red-700 border-red-200"
            : s === "WARN"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
    return (
        <Badge variant="outline" className={cls}>
            {s || "INFO"}
        </Badge>
    )
}

function KpiCard({ icon: Icon, title, value, sub }) {
    return (
        <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl border border-slate-200 bg-white p-2">
                        <Icon className="h-5 w-5 text-slate-700" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-600">{title}</div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
                        {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function MiniTable({ columns, rows, loading, emptyText = "No data found" }) {
    console.log(rows, "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg");
    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                className={`px-3 py-2 text-left text-xs font-semibold text-slate-700 ${c.className || ""}`}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <tr key={`sk_${i}`}>
                                {columns.map((c) => (
                                    <td key={`sk_${i}_${c.key}`} className="px-3 py-2">
                                        <Skeleton className="h-4 w-[140px]" />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : rows?.length ? (
                        rows.map((r, idx) => {
                            const rowKey = [
                                r?.type ?? "TYPE",
                                r?.severity ?? "SEV",
                                r?.location_id ?? "LOC",
                                r?.item_id ?? "ITEM",
                                r?.batch_id ?? r?.batch_no ?? "BATCH",
                                r?.expiry_date ?? "EXP",
                                idx,
                            ].join("|")

                            return (
                                <tr key={rowKey} className="hover:bg-slate-50/70">
                                    {columns.map((c) => (
                                        <td key={`${rowKey}_${c.key}`} className={`px-3 py-2 align-top ${c.tdClassName || ""}`}>
                                            {c.render ? c.render(r) : r?.[c.key] ?? "—"}
                                        </td>
                                    ))}
                                </tr>
                            )
                        })
                    ) : (
                        <tr>
                            <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">
                                {emptyText}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

function Pager({ total = 0, limit = 200, offset = 0, onChange }) {
    const page = Math.floor(offset / limit) + 1
    const pages = Math.max(Math.ceil(total / limit), 1)
    const canPrev = offset > 0
    const canNext = offset + limit < total

    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
                Total: <span className="font-semibold text-slate-900">{total}</span> • Page{" "}
                <span className="font-semibold text-slate-900">{page}</span> /{" "}
                <span className="font-semibold text-slate-900">{pages}</span>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!canPrev}
                    onClick={() => onChange?.({ limit, offset: Math.max(offset - limit, 0) })}
                >
                    Prev
                </Button>
                <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!canNext}
                    onClick={() => onChange?.({ limit, offset: offset + limit })}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}

export default function StockAlertsDashboard() {
    // -------------------------
    // Global filters
    // -------------------------
    const [locationId, setLocationId] = useState(ALL)
    const [itemType, setItemType] = useState(ALL)
    const [scheduleCode, setScheduleCode] = useState(ALL)
    const [supplierId, setSupplierId] = useState("") // input (optional)

    const [daysNearExpiry, setDaysNearExpiry] = useState("90")
    const [nonMovingDays, setNonMovingDays] = useState("60")
    const [fastMovingDays, setFastMovingDays] = useState("30")
    const [consumptionDays, setConsumptionDays] = useState("30")
    const [leadTimeDays, setLeadTimeDays] = useState("7")
    const [highValueThreshold, setHighValueThreshold] = useState("0")

    // -------------------------
    // Tabs + data
    // -------------------------
    const [tab, setTab] = useState("dashboard")

    // summary
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summary, setSummary] = useState(null)

    // alerts list
    const [alertType, setAlertType] = useState("LOW_STOCK")
    const [alertsLoading, setAlertsLoading] = useState(false)
    const [alerts, setAlerts] = useState([])
    const [alertsLimit, setAlertsLimit] = useState(200)
    const [alertsOffset, setAlertsOffset] = useState(0)

    // stock list
    const [stockQ, setStockQ] = useState("")
    const [stockLoading, setStockLoading] = useState(false)
    const [stockResp, setStockResp] = useState({ total: 0, rows: [], totals: { value_purchase: 0, value_mrp: 0 } })
    const [stockLimit, setStockLimit] = useState(200)
    const [stockOffset, setStockOffset] = useState(0)

    // quarantine
    const [quarQ, setQuarQ] = useState("")
    const [quarLoading, setQuarLoading] = useState(false)
    const [quarResp, setQuarResp] = useState({ total: 0, rows: [] })
    const [quarLimit, setQuarLimit] = useState(200)
    const [quarOffset, setQuarOffset] = useState(0)

    // batches modal
    const [batchesOpen, setBatchesOpen] = useState(false)
    const [batchesLoading, setBatchesLoading] = useState(false)
    const [batchesItem, setBatchesItem] = useState(null)
    const [batchesRows, setBatchesRows] = useState([])

    // export
    const [reportType, setReportType] = useState("NEAR_EXPIRY")
    const [reportFormat, setReportFormat] = useState("xlsx")
    const [exporting, setExporting] = useState(false)

    // abort + req ids (race-safe)
    const summaryAbort = useRef(null)
    const alertsAbort = useRef(null)
    const stockAbort = useRef(null)
    const quarAbort = useRef(null)
    const batchesAbort = useRef(null)

    const summaryReqId = useRef(0)
    const alertsReqId = useRef(0)
    const stockReqId = useRef(0)
    const quarReqId = useRef(0)
    const batchesReqId = useRef(0)

    const commonParams = useMemo(() => {
        const p = {
            location_id: locationId !== ALL ? Number(locationId) : undefined,
            item_type: itemType !== ALL ? itemType : undefined,
            schedule_code: scheduleCode !== ALL ? scheduleCode : undefined,
            supplier_id: supplierId ? Number(supplierId) : undefined,
            days_near_expiry: Number(daysNearExpiry || 90),
            non_moving_days: Number(nonMovingDays || 60),
            fast_moving_days: Number(fastMovingDays || 30),
            consumption_days: Number(consumptionDays || 30),
            lead_time_days: Number(leadTimeDays || 7),
            high_value_expiry_threshold: String(highValueThreshold ?? "0"),
        }
        Object.keys(p).forEach((k) => p[k] === undefined && delete p[k])
        return p
    }, [
        locationId,
        itemType,
        scheduleCode,
        supplierId,
        daysNearExpiry,
        nonMovingDays,
        fastMovingDays,
        consumptionDays,
        leadTimeDays,
        highValueThreshold,
    ])

    // cleanup (abort all)
    useEffect(() => {
        return () => {
            summaryAbort.current?.abort()
            alertsAbort.current?.abort()
            stockAbort.current?.abort()
            quarAbort.current?.abort()
            batchesAbort.current?.abort()
            summaryReqId.current++
            alertsReqId.current++
            stockReqId.current++
            quarReqId.current++
            batchesReqId.current++
        }
    }, [])

    // ----------------------------------------------------
    // Summary (race + abort safe)
    // ----------------------------------------------------
    async function loadSummary() {
        summaryAbort.current?.abort()
        const controller = new AbortController()
        summaryAbort.current = controller
        const reqId = ++summaryReqId.current

        setSummaryLoading(true)
        try {
            const data = await getStockAlertsSummary(
                { ...commonParams, preview_limit: 25 },
                { signal: controller.signal }
            )
            if (reqId !== summaryReqId.current) return
            setSummary(data)
        } catch (e) {
            //   if (isCanceledError(e)) return
            if (reqId !== summaryReqId.current) return
            toast.error(e?.message || "Failed to load summary")
        } finally {
            if (reqId === summaryReqId.current) setSummaryLoading(false)
        }
    }

    // ----------------------------------------------------
    // Alerts list (race + abort safe) + uses passed offset/limit
    // ----------------------------------------------------
    async function loadAlerts({ reset = false, offset, limit } = {}) {
        alertsAbort.current?.abort()
        const controller = new AbortController()
        alertsAbort.current = controller
        const reqId = ++alertsReqId.current

        const off = typeof offset === "number" ? offset : (reset ? 0 : alertsOffset)
        const lim = typeof limit === "number" ? limit : alertsLimit

        setAlertsLoading(true)
        try {
            const data = await listStockAlerts(
                {
                    ...commonParams,
                    alert_type: alertType,
                    include_batches: true,
                    limit: lim,
                    offset: off,
                },
                { signal: controller.signal }
            )
            if (reqId !== alertsReqId.current) return
            setAlerts(data || [])
            setAlertsOffset(off)
            setAlertsLimit(lim)
        } catch (e) {
            //   if (isCanceledError(e)) return
            if (reqId !== alertsReqId.current) return
            toast.error(e?.message || "Failed to load alerts")
        } finally {
            if (reqId === alertsReqId.current) setAlertsLoading(false)
        }
    }

    // ----------------------------------------------------
    // Stock (race + abort safe) + uses passed offset/limit
    // ----------------------------------------------------
    async function loadStock({ reset = false, offset, limit } = {}) {
        stockAbort.current?.abort()
        const controller = new AbortController()
        stockAbort.current = controller
        const reqId = ++stockReqId.current

        const off = typeof offset === "number" ? offset : (reset ? 0 : stockOffset)
        const lim = typeof limit === "number" ? limit : stockLimit

        setStockLoading(true)
        try {
            const data = await getStockSummary(
                {
                    location_id: locationId !== ALL ? Number(locationId) : undefined,
                    item_type: itemType !== ALL ? itemType : undefined,
                    schedule_code: scheduleCode !== ALL ? scheduleCode : undefined,
                    supplier_id: supplierId ? Number(supplierId) : undefined,
                    q: stockQ?.trim() || undefined,
                    include_zero: false,
                    only_saleable: false,
                    limit: lim,
                    offset: off,
                },
                { signal: controller.signal }
            )
            if (reqId !== stockReqId.current) return
            setStockResp(data || { total: 0, rows: [], totals: { value_purchase: 0, value_mrp: 0 } })
            setStockOffset(off)
            setStockLimit(lim)
        } catch (e) {
            //   if (isCanceledError(e)) return
            if (reqId !== stockReqId.current) return
            toast.error(e?.message || "Failed to load stock list")
        } finally {
            if (reqId === stockReqId.current) setStockLoading(false)
        }
    }

    // ----------------------------------------------------
    // Quarantine (race + abort safe) + uses passed offset/limit
    // ----------------------------------------------------
    async function loadQuarantine({ reset = false, offset, limit } = {}) {
        quarAbort.current?.abort()
        const controller = new AbortController()
        quarAbort.current = controller
        const reqId = ++quarReqId.current

        const off = typeof offset === "number" ? offset : (reset ? 0 : quarOffset)
        const lim = typeof limit === "number" ? limit : quarLimit

        setQuarLoading(true)
        try {
            const data = await getQuarantineBatches(
                {
                    location_id: locationId !== ALL ? Number(locationId) : undefined,
                    item_type: itemType !== ALL ? itemType : undefined,
                    schedule_code: scheduleCode !== ALL ? scheduleCode : undefined,
                    supplier_id: supplierId ? Number(supplierId) : undefined,
                    q: quarQ?.trim() || undefined,
                    include_expired: true,
                    limit: lim,
                    offset: off,
                },
                { signal: controller.signal }
            )
            if (reqId !== quarReqId.current) return
            setQuarResp(data || { total: 0, rows: [] })
            setQuarOffset(off)
            setQuarLimit(lim)
        } catch (e) {
            //   if (isCanceledError(e)) return
            if (reqId !== quarReqId.current) return
            toast.error(e?.message || "Failed to load quarantine list")
        } finally {
            if (reqId === quarReqId.current) setQuarLoading(false)
        }
    }

    // ----------------------------------------------------
    // Batches modal (race + abort safe)
    // ----------------------------------------------------
    async function openBatches({ item_id, item_name, location_id }) {
        setBatchesOpen(true)
        setBatchesItem({ item_id, item_name, location_id })
        setBatchesRows([])
        setBatchesLoading(true)

        batchesAbort.current?.abort()
        const controller = new AbortController()
        batchesAbort.current = controller
        const reqId = ++batchesReqId.current

        try {
            const rows = await getItemBatches(
                item_id,
                { location_id: location_id ? Number(location_id) : undefined },
                { signal: controller.signal }
            )
            if (reqId !== batchesReqId.current) return
            setBatchesRows(rows || [])
        } catch (e) {
            //   if (isCanceledError(e)) return
            if (reqId !== batchesReqId.current) return
            toast.error(e?.message || "Failed to load batches")
        } finally {
            if (reqId === batchesReqId.current) setBatchesLoading(false)
        }
    }

    // abort batches if dialog is closed
    useEffect(() => {
        if (!batchesOpen) {
            batchesAbort.current?.abort()
            batchesReqId.current++
            setBatchesLoading(false)
        }
    }, [batchesOpen])

    // ----------------------------------------------------
    // Export
    // ----------------------------------------------------
    async function doExport() {
        setExporting(true)
        try {
            const blob = await exportStockAlerts({
                report_type: reportType,
                format: reportFormat,
                location_id: locationId !== ALL ? Number(locationId) : undefined,
                item_type: itemType !== ALL ? itemType : undefined,
                schedule_code: scheduleCode !== ALL ? scheduleCode : undefined,
                supplier_id: supplierId ? Number(supplierId) : undefined,
                days_near_expiry: Number(daysNearExpiry || 90),
                non_moving_days: Number(nonMovingDays || 60),
                consumption_days: Number(consumptionDays || 30),
                lead_time_days: Number(leadTimeDays || 7),
            })

            const ext = reportFormat === "pdf" ? "pdf" : "xlsx"
            const name = `pharmacy_${reportType.toLowerCase()}_${new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, "-")}.${ext}`

            downloadBlob(blob, name)
            toast.success("Export started")
        } catch (e) {
            toast.error(e?.message || "Export failed")
        } finally {
            setExporting(false)
        }
    }

    // ----------------------------------------------------
    // Auto-load
    // ----------------------------------------------------
    useEffect(() => {
        loadSummary()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [commonParams])

    useEffect(() => {
        if (tab !== "alerts") return
        loadAlerts({ reset: true, offset: 0 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, alertType, commonParams])

    useEffect(() => {
        if (tab === "stock") loadStock({ reset: true, offset: 0 })
        if (tab === "quarantine") loadQuarantine({ reset: true, offset: 0 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, locationId, itemType, scheduleCode, supplierId])

    const locations = summary?.locations || []
    console.log(location, "admvjhadvjhadvvkjvadjhadvjhad");
    const k = summary?.kpis || {}

    const locationOptions = useMemo(() => {
        const opts = locations.map((x) => ({ id: String(x.location_id), name: x.location_name }))
        const m = new Map()
        for (const o of opts) m.set(o.id, o)
        return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name))
    }, [locations])

    return (
        <div className="w-full p-4 md:p-6">
            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-2">
                            <Warehouse className="h-5 w-5 text-slate-800" />
                        </div>
                        <h1 className="truncate text-lg font-semibold text-slate-900">
                            Pharmacy Inventory • Stock & Alerts
                        </h1>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                        Batch-wise stock visibility • FEFO signals • Near-expiry & non-moving alerts • Exports
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                            loadSummary()
                            if (tab === "alerts") loadAlerts()
                            if (tab === "stock") loadStock()
                            if (tab === "quarantine") loadQuarantine()
                        }}
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="mb-4 rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Filter className="h-4 w-4 text-slate-700" />
                        Filters (applies across Dashboard / Alerts / Stock / Quarantine / Export)
                    </CardTitle>
                </CardHeader>

                <CardContent className="pt-0">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                        {/* Store */}
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Store</label>
                            <Select value={locationId} onValueChange={setLocationId}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All stores</SelectItem>
                                    {locationOptions.map((o) => (
                                        <SelectItem key={o.id} value={o.id}>
                                            {o.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="mt-1 text-[11px] text-slate-500">
                                Default is <span className="font-semibold">ALL</span>
                            </div>
                        </div>

                        {/* Item Type */}
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Item Type</label>
                            <Select value={itemType} onValueChange={setItemType}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    <SelectItem value="DRUG">DRUG</SelectItem>
                                    <SelectItem value="CONSUMABLE">CONSUMABLE</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Schedule */}
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Schedule</label>
                            <Select value={scheduleCode} onValueChange={setScheduleCode}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    <SelectItem value="H">H</SelectItem>
                                    <SelectItem value="H1">H1</SelectItem>
                                    <SelectItem value="X">X</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Supplier */}
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Supplier ID</label>
                            <Input
                                className="rounded-xl"
                                placeholder="Optional (e.g., 12)"
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value.replace(/[^\d]/g, ""))}
                            />
                        </div>

                        {/* Near Expiry Days */}
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Near Expiry Window</label>
                            <Select value={daysNearExpiry} onValueChange={setDaysNearExpiry}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Days" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="60">60 days</SelectItem>
                                    <SelectItem value="90">90 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Non-moving Days */}
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Non-moving Threshold</label>
                            <Select value={nonMovingDays} onValueChange={setNonMovingDays}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Days" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="60">60 days</SelectItem>
                                    <SelectItem value="90">90 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Consumption days */}
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Consumption Window</label>
                            <Select value={consumptionDays} onValueChange={setConsumptionDays}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Days" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="15">15 days</SelectItem>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="60">60 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Lead time */}
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Lead Time</label>
                            <Select value={leadTimeDays} onValueChange={setLeadTimeDays}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Days" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3">3 days</SelectItem>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="14">14 days</SelectItem>
                                    <SelectItem value="21">21 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* High value threshold */}
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-slate-600">High Value Threshold (₹)</label>
                            <Input
                                className="rounded-xl"
                                placeholder="0 (disabled)"
                                value={highValueThreshold}
                                onChange={(e) => setHighValueThreshold(e.target.value.replace(/[^\d.]/g, ""))}
                            />
                            <div className="mt-1 text-[11px] text-slate-500">
                                Set &gt;0 to enable <span className="font-semibold">High Value Expiry Risk</span>.
                            </div>
                        </div>

                        {/* fast moving days */}
                        <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Fast-moving Window</label>
                            <Select value={fastMovingDays} onValueChange={setFastMovingDays}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Days" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="15">15 days</SelectItem>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="60">60 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Export */}
                        <div className="md:col-span-12">
                            <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <Download className="h-4 w-4" />
                                        Export
                                    </div>

                                    <Select value={reportType} onValueChange={setReportType}>
                                        <SelectTrigger className="h-9 w-[240px] rounded-xl">
                                            <SelectValue placeholder="Select report" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {REPORT_TYPES.map((r) => (
                                                <SelectItem key={r.key} value={r.key}>
                                                    {r.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={reportFormat} onValueChange={setReportFormat}>
                                        <SelectTrigger className="h-9 w-[120px] rounded-xl">
                                            <SelectValue placeholder="Format" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="xlsx">Excel</SelectItem>
                                            <SelectItem value="pdf">PDF</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Button className="h-9 rounded-xl" disabled={exporting} onClick={doExport}>
                                        <Download className="mr-2 h-4 w-4" />
                                        {exporting ? "Exporting..." : "Export"}
                                    </Button>
                                </div>

                                <div className="text-xs text-slate-600">
                                    Exports are <span className="font-semibold">batch-wise</span>.
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="mb-4 w-full justify-start rounded-2xl border border-slate-200 bg-white p-1">
                    <TabsTrigger value="dashboard" className="rounded-xl">Dashboard</TabsTrigger>
                    <TabsTrigger value="alerts" className="rounded-xl">Alerts</TabsTrigger>
                    <TabsTrigger value="stock" className="rounded-xl">Stock (Batch-wise)</TabsTrigger>
                    <TabsTrigger value="quarantine" className="rounded-xl">Quarantine</TabsTrigger>
                </TabsList>

                {/* Dashboard */}
                <TabsContent value="dashboard">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <KpiCard
                            icon={Boxes}
                            title="Total Items / Active / Inactive"
                            value={
                                summaryLoading
                                    ? "—"
                                    : `${fmtNum(k.total_items_count)} / ${fmtNum(k.active_items_count)} / ${fmtNum(k.inactive_items_count)}`
                            }
                            sub="Master item status"
                        />
                        <KpiCard
                            icon={Layers}
                            title="Stock Value (Purchase / MRP)"
                            value={summaryLoading ? "—" : `${fmtMoney(k.stock_value_purchase)} / ${fmtMoney(k.stock_value_mrp)}`}
                            sub="Batch-wise valuation"
                        />
                        <KpiCard
                            icon={BadgeAlert}
                            title="Low Stock / Out of Stock"
                            value={summaryLoading ? "—" : `${fmtNum(k.low_stock_count)} / ${fmtNum(k.out_of_stock_count)}`}
                            sub="Immediate action"
                        />
                        <KpiCard
                            icon={CalendarDays}
                            title="Near Expiry (7 / 30 / 60 / 90)"
                            value={
                                summaryLoading
                                    ? "—"
                                    : `${fmtNum(k.near_expiry_7)} / ${fmtNum(k.near_expiry_30)} / ${fmtNum(k.near_expiry_60)} / ${fmtNum(k.near_expiry_90)}`
                            }
                            sub="Expiry buckets"
                        />

                        <KpiCard
                            icon={ShieldAlert}
                            title="Expired (Count / Value)"
                            value={summaryLoading ? "—" : `${fmtNum(k.expired_count)} • ${fmtMoney(k.expired_value_purchase)}`}
                            sub="Quarantine / write-off"
                        />
                        <KpiCard
                            icon={BadgeAlert}
                            title="Non-moving (30 / 60 / 90)"
                            value={
                                summaryLoading
                                    ? "—"
                                    : `${fmtNum(k.non_moving_30_count)} / ${fmtNum(k.non_moving_60_count)} / ${fmtNum(k.non_moving_90_count)}`
                            }
                            sub="No transaction window"
                        />
                        <KpiCard
                            icon={TrendingUp}
                            title="Smart Alerts"
                            value={
                                summaryLoading
                                    ? "—"
                                    : `${fmtNum(k.reorder_count)} reorder • ${fmtNum(k.batch_risk_count)} batch-risk • ${fmtNum(k.negative_stock_count)} mismatch`
                            }
                            sub="Predictive + integrity"
                        />
                        <KpiCard
                            icon={ShieldAlert}
                            title="FEFO Compliance (Approx)"
                            value={summaryLoading ? "—" : k.fefo_compliance_pct != null ? `${fmtNum(k.fefo_compliance_pct)}%` : "—"}
                            sub="Lower is risk"
                        />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Store-wise Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <MiniTable
                                    loading={summaryLoading}
                                    rows={locations}
                                    columns={[
                                        {
                                            key: "location_name",
                                            header: "Store",
                                            render: (r) => <div className="font-medium text-slate-900">{r.location_name}</div>,
                                        },
                                        { key: "items_with_stock", header: "Items w/ Stock", render: (r) => fmtNum(r.items_with_stock) },
                                        { key: "low_stock_count", header: "Low", render: (r) => fmtNum(r.low_stock_count) },
                                        { key: "out_of_stock_count", header: "Out", render: (r) => fmtNum(r.out_of_stock_count) },
                                        { key: "expiry_risk_count", header: "Expiry Risk", render: (r) => fmtNum(r.expiry_risk_count) },
                                        { key: "stock_value_purchase", header: "Value (Purchase)", render: (r) => fmtMoney(r.stock_value_purchase) },
                                    ]}
                                    emptyText="No pharmacy stores found"
                                />
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Actionable Alerts Preview</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <MiniTable
                                    loading={summaryLoading}
                                    rows={summary?.alerts_preview || []}
                                    columns={[
                                        { key: "severity", header: "Sev", render: (r) => <SevBadge severity={r.severity} /> },
                                        { key: "type", header: "Type", render: (r) => <Badge variant="secondary">{r.type}</Badge> },
                                        {
                                            key: "item_name",
                                            header: "Item",
                                            render: (r) => (
                                                <div className="min-w-[220px]">
                                                    <div className="font-medium text-slate-900">{r.item_name || "—"}</div>
                                                    <div className="text-xs text-slate-500">{r.location_name || "—"}</div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "batch_no",
                                            header: "Batch / Expiry",
                                            render: (r) => (
                                                <div className="text-xs">
                                                    <div className="text-slate-900">{r.batch_no || "—"}</div>
                                                    <div className="text-slate-500">{fmtDate(r.expiry_date)}</div>
                                                </div>
                                            ),
                                        },
                                        { key: "on_hand_qty", header: "Qty", render: (r) => fmtNum(r.on_hand_qty) },
                                        {
                                            key: "actions",
                                            header: "Action",
                                            render: (r) => (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 rounded-xl"
                                                    onClick={() => openBatches({ item_id: r.item_id, item_name: r.item_name, location_id: r.location_id })}
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Batches
                                                </Button>
                                            ),
                                        },
                                    ]}
                                    emptyText="No alerts preview"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Fast-moving Top 10</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <MiniTable
                                    loading={summaryLoading}
                                    rows={k.fast_moving_top || []}
                                    columns={[
                                        { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
                                        { key: "name", header: "Item", render: (r) => <span className="font-medium">{r.name}</span> },
                                        { key: "out_qty", header: "Out Qty", render: (r) => fmtNum(r.out_qty) },
                                        {
                                            key: "action",
                                            header: "FEFO",
                                            render: (r) => (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 rounded-xl"
                                                    onClick={() => openBatches({ item_id: r.item_id, item_name: r.name })}
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View
                                                </Button>
                                            ),
                                        },
                                    ]}
                                    emptyText="No movement data"
                                />
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Next to Dispense (FEFO Suggestions)</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <MiniTable
                                    loading={summaryLoading}
                                    rows={summary?.fefo_next_to_dispense || []}
                                    columns={[
                                        { key: "location_name", header: "Store", render: (r) => <span className="text-xs">{r.location_name}</span> },
                                        { key: "item_name", header: "Item", render: (r) => <span className="font-medium">{r.item_name}</span> },
                                        {
                                            key: "batches",
                                            header: "Top Batches (Earliest Expiry)",
                                            render: (r) => (
                                                <div className="min-w-[280px] space-y-1">
                                                    {(r.batches || []).slice(0, 3).map((b, i) => (
                                                        <div key={`${b.batch_id || b.batch_no || i}`} className="flex items-center justify-between gap-2 text-xs">
                                                            <span className="font-mono text-slate-700">{b.batch_no}</span>
                                                            <span className="text-slate-500">{fmtDate(b.expiry_date)}</span>
                                                            <span className="font-medium text-slate-900">{fmtNum(b.current_qty)}</span>
                                                        </div>
                                                    ))}
                                                    {!r.batches?.length ? <span className="text-xs text-slate-500">—</span> : null}
                                                </div>
                                            ),
                                        },
                                    ]}
                                    emptyText="No FEFO suggestions"
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Alerts */}
                <TabsContent value="alerts">
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <CardTitle className="text-sm">Alerts List (Batch-wise actionable rows)</CardTitle>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Select value={alertType} onValueChange={(v) => setAlertType(v)}>
                                        <SelectTrigger className="h-9 w-[220px] rounded-xl">
                                            <SelectValue placeholder="Alert type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ALERT_TYPES.map((a) => (
                                                <SelectItem key={a.key} value={a.key}>
                                                    {a.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={String(alertsLimit)} onValueChange={(v) => setAlertsLimit(Number(v))}>
                                        <SelectTrigger className="h-9 w-[120px] rounded-xl">
                                            <SelectValue placeholder="Limit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                            <SelectItem value="200">200</SelectItem>
                                            <SelectItem value="500">500</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Button variant="outline" className="h-9 rounded-xl" onClick={() => loadAlerts({ reset: true, offset: 0 })}>
                                        <RefreshCcw className="mr-2 h-4 w-4" />
                                        Reload
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                {/* If backend doesn't provide total for alerts, keep pagination manual or add total in backend later */}
                                <div className="text-xs text-slate-600">
                                    Loaded: <span className="font-semibold text-slate-900">{alerts?.length || 0}</span> rows • Offset{" "}
                                    <span className="font-semibold text-slate-900">{alertsOffset}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        disabled={alertsOffset <= 0}
                                        onClick={() => loadAlerts({ offset: Math.max(alertsOffset - alertsLimit, 0), limit: alertsLimit })}
                                    >
                                        Prev
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        disabled={(alerts?.length || 0) < alertsLimit}
                                        onClick={() => loadAlerts({ offset: alertsOffset + alertsLimit, limit: alertsLimit })}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>

                            <MiniTable
                                loading={alertsLoading}
                                rows={alerts}
                                columns={[
                                    { key: "severity", header: "Sev", render: (r) => <SevBadge severity={r.severity} /> },
                                    { key: "type", header: "Type", render: (r) => <Badge variant="secondary">{r.type}</Badge> },
                                    {
                                        key: "item",
                                        header: "Item / Store",
                                        render: (r) => (
                                            <div className="min-w-[260px]">
                                                <div className="font-medium text-slate-900">{r.item_name || "—"}</div>
                                                <div className="text-xs text-slate-500">
                                                    {r.item_code ? <span className="font-mono">{r.item_code}</span> : "—"} • {r.location_name || "—"}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: "batch",
                                        header: "Batch / Expiry",
                                        render: (r) => (
                                            <div className="min-w-[160px] text-xs">
                                                <div className="font-mono text-slate-800">{r.batch_no || "—"}</div>
                                                <div className="text-slate-500">{fmtDate(r.expiry_date)}</div>
                                                {r.days_to_expiry != null ? <div className="text-slate-500">DTE: {fmtNum(r.days_to_expiry)}</div> : null}
                                            </div>
                                        ),
                                    },
                                    {
                                        key: "qty",
                                        header: "Qty / Reorder",
                                        render: (r) => (
                                            <div className="text-xs">
                                                <div className="font-semibold text-slate-900">On-hand: {fmtNum(r.on_hand_qty)}</div>
                                                {r.reorder_level != null ? <div className="text-slate-600">Reorder: {fmtNum(r.reorder_level)}</div> : null}
                                                {r.suggested_reorder_qty != null ? <div className="text-slate-600">Suggest: {fmtNum(r.suggested_reorder_qty)}</div> : null}
                                            </div>
                                        ),
                                    },
                                    {
                                        key: "price",
                                        header: "Price (Batch-wise)",
                                        render: (r) => (
                                            <div className="text-xs">
                                                <div className="text-slate-900">Cost: {fmtMoney(r.unit_cost)}</div>
                                                <div className="text-slate-600">MRP: {fmtMoney(r.mrp)}</div>
                                                {r.value_risk_purchase != null ? <div className="text-slate-600">Value: {fmtMoney(r.value_risk_purchase)}</div> : null}
                                            </div>
                                        ),
                                    },
                                    { key: "message", header: "Message", render: (r) => <div className="min-w-[220px] text-xs text-slate-700">{r.message}</div> },
                                    {
                                        key: "action",
                                        header: "Actions",
                                        render: (r) => (
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 rounded-xl"
                                                    onClick={() => openBatches({ item_id: r.item_id, item_name: r.item_name, location_id: r.location_id })}
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Batches
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 rounded-xl"
                                                    onClick={() => toast.info("Action endpoints (reorder/transfer/quarantine) can be added next.")}
                                                >
                                                    Quick Action
                                                </Button>
                                            </div>
                                        ),
                                    },
                                ]}
                                emptyText="No alerts found for this filter."
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Stock */}
                <TabsContent value="stock">
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <CardTitle className="text-sm">Stock List (Batch-wise price, ALL stores default)</CardTitle>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="h-9 w-[260px] rounded-xl pl-9"
                                            placeholder="Search item / code / batch..."
                                            value={stockQ}
                                            onChange={(e) => setStockQ(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && loadStock({ reset: true, offset: 0 })}
                                        />
                                    </div>
                                    <Button variant="outline" className="h-9 rounded-xl" onClick={() => loadStock({ reset: true, offset: 0 })}>
                                        <Search className="mr-2 h-4 w-4" />
                                        Search
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-9 rounded-xl"
                                        onClick={() => {
                                            setStockQ("")
                                            loadStock({ reset: true, offset: 0 })
                                        }}
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1">
                                    Total Purchase Value:{" "}
                                    <span className="font-semibold text-slate-900">{fmtMoney(stockResp?.totals?.value_purchase)}</span>
                                </span>
                                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1">
                                    Total MRP Value: <span className="font-semibold text-slate-900">{fmtMoney(stockResp?.totals?.value_mrp)}</span>
                                </span>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <Pager
                                    total={stockResp?.total || 0}
                                    limit={stockLimit}
                                    offset={stockOffset}
                                    onChange={({ limit, offset }) => loadStock({ limit, offset })}
                                />

                                <Select value={String(stockLimit)} onValueChange={(v) => loadStock({ limit: Number(v), offset: 0 })}>
                                    <SelectTrigger className="h-9 w-[120px] rounded-xl">
                                        <SelectValue placeholder="Limit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                        <SelectItem value="200">200</SelectItem>
                                        <SelectItem value="500">500</SelectItem>
                                        <SelectItem value="1000">1000</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <MiniTable
                                loading={stockLoading}
                                rows={stockResp?.rows || []}
                                columns={[
                                    { key: "location_name", header: "Store", render: (r) => <span className="text-xs">{r.location_name}</span> },
                                    {
                                        key: "item_name",
                                        header: "Item",
                                        render: (r) => (
                                            <div className="min-w-[260px]">
                                                <div className="font-medium text-slate-900">{r.item_name}</div>
                                                <div className="text-xs text-slate-500">
                                                    <span className="font-mono">{r.item_code}</span>
                                                    {r.schedule_code ? ` • Sch-${r.schedule_code}` : ""}
                                                    {r.item_type ? ` • ${r.item_type}` : ""}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    { key: "batch_no", header: "Batch", render: (r) => <span className="font-mono text-xs">{r.batch_no}</span> },
                                    { key: "expiry_date", header: "Expiry", render: (r) => fmtDate(r.expiry_date) },
                                    { key: "qty", header: "Qty", render: (r) => <span className="font-semibold">{fmtNum(r.qty)}</span> },
                                    { key: "unit_cost", header: "Unit Cost", render: (r) => fmtMoney(r.unit_cost) },
                                    { key: "mrp", header: "MRP", render: (r) => fmtMoney(r.mrp) },
                                    { key: "value_purchase", header: "Value (Purchase)", render: (r) => fmtMoney(r.value_purchase) },
                                    {
                                        key: "action",
                                        header: "Batches",
                                        render: (r) => (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 rounded-xl"
                                                onClick={() => openBatches({ item_id: r.item_id, item_name: r.item_name, location_id: r.location_id })}
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                View
                                            </Button>
                                        ),
                                    },
                                ]}
                                emptyText="No stock found."
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Quarantine */}
                <TabsContent value="quarantine">
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <CardTitle className="text-sm">Quarantine / Hold / Expired (Batch-wise)</CardTitle>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="h-9 w-[260px] rounded-xl pl-9"
                                            placeholder="Search item / code / batch..."
                                            value={quarQ}
                                            onChange={(e) => setQuarQ(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && loadQuarantine({ reset: true, offset: 0 })}
                                        />
                                    </div>
                                    <Button variant="outline" className="h-9 rounded-xl" onClick={() => loadQuarantine({ reset: true, offset: 0 })}>
                                        <Search className="mr-2 h-4 w-4" />
                                        Search
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-9 rounded-xl"
                                        onClick={() => {
                                            setQuarQ("")
                                            loadQuarantine({ reset: true, offset: 0 })
                                        }}
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <Pager
                                    total={quarResp?.total || 0}
                                    limit={quarLimit}
                                    offset={quarOffset}
                                    onChange={({ limit, offset }) => loadQuarantine({ limit, offset })}
                                />

                                <Select value={String(quarLimit)} onValueChange={(v) => loadQuarantine({ limit: Number(v), offset: 0 })}>
                                    <SelectTrigger className="h-9 w-[120px] rounded-xl">
                                        <SelectValue placeholder="Limit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                        <SelectItem value="200">200</SelectItem>
                                        <SelectItem value="500">500</SelectItem>
                                        <SelectItem value="1000">1000</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <MiniTable
                                loading={quarLoading}
                                rows={quarResp?.rows || []}
                                columns={[
                                    { key: "location_name", header: "Store", render: (r) => <span className="text-xs">{r.location_name}</span> },
                                    {
                                        key: "item_name",
                                        header: "Item",
                                        render: (r) => (
                                            <div className="min-w-[260px]">
                                                <div className="font-medium text-slate-900">{r.item_name}</div>
                                                <div className="text-xs text-slate-500">
                                                    <span className="font-mono">{r.item_code}</span>
                                                    {r.schedule_code ? ` • Sch-${r.schedule_code}` : ""}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    { key: "batch_no", header: "Batch", render: (r) => <span className="font-mono text-xs">{r.batch_no}</span> },
                                    { key: "expiry_date", header: "Expiry", render: (r) => fmtDate(r.expiry_date) },
                                    { key: "qty", header: "Qty", render: (r) => <span className="font-semibold">{fmtNum(r.qty)}</span> },
                                    { key: "unit_cost", header: "Unit Cost", render: (r) => fmtMoney(r.unit_cost) },
                                    { key: "mrp", header: "MRP", render: (r) => fmtMoney(r.mrp) },
                                    {
                                        key: "status",
                                        header: "Status",
                                        render: (r) => (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                {r.status || (r.is_saleable === false ? "NOT_SALEABLE" : "—")}
                                            </Badge>
                                        ),
                                    },
                                    {
                                        key: "action",
                                        header: "Actions",
                                        render: () => (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 rounded-xl"
                                                onClick={() => toast.info("Action endpoints (write-off/return/transfer) can be added next.")}
                                            >
                                                Quick Action
                                            </Button>
                                        ),
                                    },
                                ]}
                                emptyText="No quarantine batches found."
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Batches Modal */}
            <Dialog open={batchesOpen} onOpenChange={setBatchesOpen}>
                <DialogContent className="max-w-3xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Item Batches (Batch-wise prices)</DialogTitle>
                        <DialogDescription>
                            {batchesItem?.item_name ? (
                                <span className="font-medium text-slate-900">{batchesItem.item_name}</span>
                            ) : (
                                "—"
                            )}
                            {batchesItem?.location_id ? (
                                <span className="text-slate-500"> • Store ID: {batchesItem.location_id}</span>
                            ) : (
                                <span className="text-slate-500"> • All stores (if supported)</span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-2">
                        <MiniTable
                            loading={batchesLoading}
                            rows={batchesRows}
                            columns={[
                                { key: "batch_no", header: "Batch", render: (r) => <span className="font-mono text-xs">{r.batch_no}</span> },
                                { key: "expiry_date", header: "Expiry", render: (r) => fmtDate(r.expiry_date) },
                                { key: "current_qty", header: "Qty", render: (r) => <span className="font-semibold">{fmtNum(r.current_qty)}</span> },
                                { key: "unit_cost", header: "Unit Cost", render: (r) => fmtMoney(r.unit_cost) },
                                { key: "mrp", header: "MRP", render: (r) => fmtMoney(r.mrp) },
                                { key: "tax_percent", header: "Tax %", render: (r) => fmtNum(r.tax_percent) },
                                {
                                    key: "is_saleable",
                                    header: "Saleable",
                                    render: (r) => (
                                        <Badge
                                            variant="outline"
                                            className={
                                                r.is_saleable
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                            }
                                        >
                                            {r.is_saleable ? "YES" : "NO"}
                                        </Badge>
                                    ),
                                },
                                { key: "status", header: "Status", render: (r) => <span className="text-xs">{r.status || "—"}</span> },
                            ]}
                            emptyText="No batches found."
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
