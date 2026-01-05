// FILE: src/pages/pharmacy/StockAlertsDashboard.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
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
    Check,
    ChevronsUpDown,
    Loader2,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"

import {
    getStockAlertsSummary,
    listStockAlerts,
    getItemBatches,
    getStockSummary,
    getQuarantineBatches,
    exportStockAlerts,
    downloadBlob,
} from "@/api/pharmacyStockAlerts"

import { listInventoryLocations, listSuppliers } from "@/api/inventory"

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

// ---------- format helpers ----------
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

function isCanceledError(e) {
    return (
        e?.name === "AbortError" ||
        e?.code === "ERR_CANCELED" ||
        String(e?.message || "").toLowerCase().includes("canceled")
    )
}

function getErrMsg(e) {
    const msg =
        e?.response?.data?.error?.msg ||
        e?.response?.data?.message ||
        e?.message ||
        "Request failed"
    return String(msg)
}

// debounce hook
function useDebouncedValue(value, delay = 250) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

const isNumeric = (v) => /^\d+$/.test(String(v ?? ""))

function buildLocationParams(locationId) {
    if (!locationId || locationId === ALL) return {}
    const v = String(locationId)
    if (isNumeric(v)) return { location_id: Number(v) }
    return { location_code: v } // ✅ supports code-based locations like "Main", "ICU"
}

function buildSupplierParams(supplierId) {
    if (!supplierId || supplierId === ALL) return {}
    const v = String(supplierId)
    return isNumeric(v) ? { supplier_id: Number(v) } : {} // supplier is usually numeric
}

// ---------- UI pieces ----------
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
                                r?.location_id ?? r?.location_code ?? "LOC",
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

function KV({ label, value }) {
    return (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2">
            <div className="text-xs font-medium text-slate-600">{label}</div>
            <div className="max-w-[65%] break-words text-right text-xs text-slate-900">{value ?? "—"}</div>
        </div>
    )
}

function MobileCards({
    rows,
    loading,
    emptyText,
    titleKey = "item_name",
    subtitle,
    rightTop,
    rightBottom,
    onOpen,
}) {
    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="rounded-2xl border-slate-200">
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[70%]" />
                                <Skeleton className="h-3 w-[45%]" />
                                <Skeleton className="h-3 w-[55%]" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (!rows?.length) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                {emptyText}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {rows.map((r, idx) => (
                <Card
                    key={r?.id || r?.batch_id || r?.batch_no || `${idx}`}
                    className="cursor-pointer rounded-2xl border-slate-200 shadow-sm active:scale-[0.99]"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onOpen?.(r)}
                    onClick={() => onOpen?.(r)}
                >
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900">{r?.[titleKey] || "—"}</div>
                                {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle(r)}</div> : null}
                            </div>
                            <div className="shrink-0 text-right">
                                {rightTop ? <div className="text-xs">{rightTop(r)}</div> : null}
                                {rightBottom ? <div className="mt-1 text-xs text-slate-600">{rightBottom(r)}</div> : null}
                            </div>
                        </div>

                        <div className="mt-3 text-xs text-slate-500">
                            Tap to view more details
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function SupplierCombobox({ value, onChange }) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState("")
    const dq = useDebouncedValue(q, 250)

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const abortRef = useRef(null)

    const labelOf = (s) =>
        s?.name ||
        s?.supplier_name ||
        s?.company_name ||
        s?.legal_name ||
        s?.display_name ||
        `Supplier #${s?.id || s?.supplier_id || "—"}`

    const selected = useMemo(() => {
        if (!value || value === ALL) return null
        const found = rows.find((x) => String(x.id ?? x.supplier_id) === String(value))
        return found || null
    }, [value, rows])

    const load = useCallback(async (query) => {
        abortRef.current?.abort()
        const c = new AbortController()
        abortRef.current = c

        setLoading(true)
        try {
            // ✅ supports both: listSuppliers(q, opts) and listSuppliers(q, opts, config)
            const res = await listSuppliers(
                query || "",
                { is_active: true, limit: 25 },
                { signal: c.signal }
            )

            const data = res?.data ?? res
            const arr =
                Array.isArray(data) ? data :
                    Array.isArray(data?.data) ? data.data :
                        data?.rows || data?.items || []

            setRows(arr)
        } catch (e) {
            if (isCanceledError(e)) return
            toast.error(getErrMsg(e))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!open) return
        load(dq)
    }, [open, dq, load])

    useEffect(() => {
        return () => abortRef.current?.abort()
    }, [])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between rounded-xl">
                    <span className="truncate text-left">
                        {value === ALL || !value ? "All suppliers" : selected ? labelOf(selected) : `Supplier #${value}`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 text-slate-500" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                    <div className="flex items-center gap-2 px-3 py-2">
                        <CommandInput placeholder="Search supplier..." value={q} onValueChange={setQ} />
                        {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
                    </div>

                    <CommandList>
                        <CommandEmpty>No suppliers found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="__all__"
                                onSelect={() => {
                                    onChange?.(ALL)
                                    setOpen(false)
                                }}
                            >
                                <Check className={`mr-2 h-4 w-4 ${value === ALL ? "opacity-100" : "opacity-0"}`} />
                                All suppliers
                            </CommandItem>

                            {rows.map((s) => {
                                const sid = String(s.id ?? s.supplier_id)
                                return (
                                    <CommandItem
                                        key={sid}
                                        value={labelOf(s)}
                                        onSelect={() => {
                                            onChange?.(sid)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check className={`mr-2 h-4 w-4 ${String(value) === sid ? "opacity-100" : "opacity-0"}`} />
                                        <div className="min-w-0">
                                            <div className="truncate text-sm">{labelOf(s)}</div>
                                            {s?.code || s?.supplier_code ? (
                                                <div className="truncate text-xs text-slate-500">{s.code || s.supplier_code}</div>
                                            ) : null}
                                        </div>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

// ---------- page ----------
export default function StockAlertsDashboard() {
    // ✅ Applied filters (used for API)
    const [filters, setFilters] = useState({
        locationId: ALL,
        itemType: ALL,
        scheduleCode: ALL,
        supplierId: ALL,
        daysNearExpiry: "90",
        nonMovingDays: "60",
        fastMovingDays: "30",
        consumptionDays: "30",
        leadTimeDays: "7",
        highValueThreshold: "0",
    })

    // ✅ Draft filters (only inside filter dialog)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
    const [draft, setDraft] = useState(filters)

    // tabs
    const [tab, setTab] = useState("dashboard")

    // dashboard minimal/expand (mobile)
    const [showMoreKpis, setShowMoreKpis] = useState(false)

    // summary
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summary, setSummary] = useState(null)

    // locations master
    const [locLoading, setLocLoading] = useState(false)
    const [locOptions, setLocOptions] = useState([])

    // alerts
    const [alertType, setAlertType] = useState("LOW_STOCK")
    const [alertsLoading, setAlertsLoading] = useState(false)
    const [alerts, setAlerts] = useState([])
    const [alertsLimit, setAlertsLimit] = useState(200)
    const [alertsOffset, setAlertsOffset] = useState(0)

    // stock
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

    // export dialog
    const [exportOpen, setExportOpen] = useState(false)
    const [reportType, setReportType] = useState("NEAR_EXPIRY")
    const [reportFormat, setReportFormat] = useState("xlsx")
    const [exporting, setExporting] = useState(false)

    // mobile detail dialog
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailTitle, setDetailTitle] = useState("Details")
    const [detailRows, setDetailRows] = useState([])
    const [detailActions, setDetailActions] = useState(null)

    // abort + req ids
    const summaryAbort = useRef(null)
    const alertsAbort = useRef(null)
    const stockAbort = useRef(null)
    const quarAbort = useRef(null)
    const batchesAbort = useRef(null)
    const locAbort = useRef(null)

    const summaryReqId = useRef(0)
    const alertsReqId = useRef(0)
    const stockReqId = useRef(0)
    const quarReqId = useRef(0)
    const batchesReqId = useRef(0)
    const locReqId = useRef(0)

    const commonParams = useMemo(() => {
        const p = {
            ...buildLocationParams(filters.locationId),
            ...buildSupplierParams(filters.supplierId),
            item_type: filters.itemType !== ALL ? filters.itemType : undefined,
            schedule_code: filters.scheduleCode !== ALL ? filters.scheduleCode : undefined,
            days_near_expiry: Number(filters.daysNearExpiry || 90),
            non_moving_days: Number(filters.nonMovingDays || 60),
            fast_moving_days: Number(filters.fastMovingDays || 30),
            consumption_days: Number(filters.consumptionDays || 30),
            lead_time_days: Number(filters.leadTimeDays || 7),
            high_value_expiry_threshold: String(filters.highValueThreshold ?? "0"),
        }
        Object.keys(p).forEach((k) => p[k] === undefined && delete p[k])
        return p
    }, [filters])

    // cleanup
    useEffect(() => {
        return () => {
            summaryAbort.current?.abort()
            alertsAbort.current?.abort()
            stockAbort.current?.abort()
            quarAbort.current?.abort()
            batchesAbort.current?.abort()
            locAbort.current?.abort()

            summaryReqId.current++
            alertsReqId.current++
            stockReqId.current++
            quarReqId.current++
            batchesReqId.current++
            locReqId.current++
        }
    }, [])

    // sync draft on open
    useEffect(() => {
        if (filtersOpen) {
            setDraft(filters)
            setShowAdvancedFilters(false)
        }
    }, [filtersOpen, filters])

    // ---------- locations ----------
    async function loadLocations() {
        locAbort.current?.abort()
        const controller = new AbortController()
        locAbort.current = controller
        const reqId = ++locReqId.current

        setLocLoading(true)
        try {
            const res = await listInventoryLocations({ signal: controller.signal })
            const data = res?.data ?? res

            if (reqId !== locReqId.current) return

            const arr = Array.isArray(data) ? data : data?.rows || data?.items || []

            const normalized = arr
                .map((x) => ({
                    id: String(x.location_id ?? x.id ?? x.locationId ?? x.locationID ?? x.code),
                    name: x.location_name ?? x.locationName ?? x.name ?? "—",
                }))
                .filter((x) => x.id && x.id !== "undefined" && x.id !== "null")

            const m = new Map()
            for (const o of normalized) m.set(o.id, o)
            setLocOptions(Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name)))
        } catch (e) {
            if (reqId !== locReqId.current) return
            if (isCanceledError(e)) return
            toast.error(getErrMsg(e))
        } finally {
            if (reqId === locReqId.current) setLocLoading(false)
        }
    }

    useEffect(() => {
        loadLocations()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ---------- summary ----------
    async function loadSummary() {
        summaryAbort.current?.abort()
        const controller = new AbortController()
        summaryAbort.current = controller
        const reqId = ++summaryReqId.current

        setSummaryLoading(true)
        try {
            const data = await getStockAlertsSummary({ ...commonParams, preview_limit: 25 }, { signal: controller.signal })
            if (reqId !== summaryReqId.current) return
            setSummary(data)
        } catch (e) {
            console.log(e, "error loadSummary");
            if (reqId !== summaryReqId.current) return
            if (isCanceledError(e)) return
            toast.error(getErrMsg(e))
        } finally {
            if (reqId === summaryReqId.current) setSummaryLoading(false)
        }
    }

    // ---------- alerts ----------
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
            console.log(e, "error listStockAlerts");
            if (reqId !== alertsReqId.current) return
            if (isCanceledError(e)) return
            toast.error(getErrMsg(e))
        } finally {
            if (reqId === alertsReqId.current) setAlertsLoading(false)
        }
    }

    // ---------- stock ----------
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
                    ...buildLocationParams(filters.locationId),
                    ...buildSupplierParams(filters.supplierId),
                    item_type: filters.itemType !== ALL ? filters.itemType : undefined,
                    schedule_code: filters.scheduleCode !== ALL ? filters.scheduleCode : undefined,
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
            console.log(e, "error getStockSummary");
            if (reqId !== stockReqId.current) return
            if (isCanceledError(e)) return
            toast.error(getErrMsg(e))
        } finally {
            if (reqId === stockReqId.current) setStockLoading(false)
        }
    }

    // ---------- quarantine ----------
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
                    ...buildLocationParams(filters.locationId),
                    ...buildSupplierParams(filters.supplierId),
                    item_type: filters.itemType !== ALL ? filters.itemType : undefined,
                    schedule_code: filters.scheduleCode !== ALL ? filters.scheduleCode : undefined,
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
            console.log(e, "error getQuarantineBatches");
            if (reqId !== quarReqId.current) return
            if (isCanceledError(e)) return
            toast.error(getErrMsg(e))
        } finally {
            if (reqId === quarReqId.current) setQuarLoading(false)
        }
    }

    // ---------- batches ----------
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
            console.log(e, "error getItemBatches");
            if (reqId !== batchesReqId.current) return
            if (isCanceledError(e)) return
            toast.error(getErrMsg(e))
        } finally {
            if (reqId === batchesReqId.current) setBatchesLoading(false)
        }
    }

    useEffect(() => {
        if (!batchesOpen) {
            batchesAbort.current?.abort()
            batchesReqId.current++
            setBatchesLoading(false)
        }
    }, [batchesOpen])

    // ---------- export ----------
    async function doExport() {
        setExporting(true)
        try {
            const blob = await exportStockAlerts({
                report_type: reportType,
                format: reportFormat,
                ...buildLocationParams(filters.locationId),
                ...buildSupplierParams(filters.supplierId),
                item_type: filters.itemType !== ALL ? filters.itemType : undefined,
                schedule_code: filters.scheduleCode !== ALL ? filters.scheduleCode : undefined,
                days_near_expiry: Number(filters.daysNearExpiry || 90),
                non_moving_days: Number(filters.nonMovingDays || 60),
                consumption_days: Number(filters.consumptionDays || 30),
                lead_time_days: Number(filters.leadTimeDays || 7),
            })

            const ext = reportFormat === "pdf" ? "pdf" : "xlsx"
            const name = `pharmacy_${reportType.toLowerCase()}_${new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, "-")}.${ext}`

            downloadBlob(blob, name)
            toast.success("Export started")
            setExportOpen(false)
        } catch (e) {
            console.log(e, "error downloadBlob");
            console.log(e, "error exportStockAlerts");
            toast.error(getErrMsg(e))
        } finally {
            setExporting(false)
        }
    }

    // ---------- auto-load ----------
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
    }, [tab, filters.locationId, filters.itemType, filters.scheduleCode, filters.supplierId])

    const locationsSummaryRows = summary?.locations || []
    const k = summary?.kpis || {}

    const openDetail = (title, fields, actions = null) => {
        setDetailTitle(title)
        setDetailRows(fields)
        setDetailActions(actions)
        setDetailOpen(true)
    }

    const activeLocationLabel = useMemo(() => {
        if (!filters.locationId || filters.locationId === ALL) return "All stores"
        const found = locOptions.find((x) => String(x.id) === String(filters.locationId))
        return found?.name || String(filters.locationId)
    }, [filters.locationId, locOptions])

    // ---------- apply/reset filters ----------
    const applyFilters = () => {
        setFilters(draft)
        setAlertsOffset(0)
        setStockOffset(0)
        setQuarOffset(0)
        setFiltersOpen(false)
    }

    const resetDraft = () => {
        setDraft({
            locationId: ALL,
            itemType: ALL,
            scheduleCode: ALL,
            supplierId: ALL,
            daysNearExpiry: "90",
            nonMovingDays: "60",
            fastMovingDays: "30",
            consumptionDays: "30",
            leadTimeDays: "7",
            highValueThreshold: "0",
        })
        setShowAdvancedFilters(false)
    }

    // KPI cards config
    const kpiCards = [
        {
            icon: Boxes,
            title: "Total Items / Active / Inactive",
            value: summaryLoading ? "—" : `${fmtNum(k.total_items_count)} / ${fmtNum(k.active_items_count)} / ${fmtNum(k.inactive_items_count)}`,
            sub: "Master item status",
        },
        {
            icon: Layers,
            title: "Stock Value (Purchase / MRP)",
            value: summaryLoading ? "—" : `${fmtMoney(k.stock_value_purchase)} / ${fmtMoney(k.stock_value_mrp)}`,
            sub: "Batch-wise valuation",
        },
        {
            icon: BadgeAlert,
            title: "Low Stock / Out of Stock",
            value: summaryLoading ? "—" : `${fmtNum(k.low_stock_count)} / ${fmtNum(k.out_of_stock_count)}`,
            sub: "Immediate action",
        },
        {
            icon: CalendarDays,
            title: "Near Expiry (7 / 30 / 60 / 90)",
            value: summaryLoading ? "—" : `${fmtNum(k.near_expiry_7)} / ${fmtNum(k.near_expiry_30)} / ${fmtNum(k.near_expiry_60)} / ${fmtNum(k.near_expiry_90)}`,
            sub: "Expiry buckets",
        },
        {
            icon: ShieldAlert,
            title: "Expired (Count / Value)",
            value: summaryLoading ? "—" : `${fmtNum(k.expired_count)} • ${fmtMoney(k.expired_value_purchase)}`,
            sub: "Quarantine / write-off",
        },
        {
            icon: BadgeAlert,
            title: "Non-moving (30 / 60 / 90)",
            value: summaryLoading ? "—" : `${fmtNum(k.non_moving_30_count)} / ${fmtNum(k.non_moving_60_count)} / ${fmtNum(k.non_moving_90_count)}`,
            sub: "No transaction window",
        },
        {
            icon: TrendingUp,
            title: "Smart Alerts",
            value: summaryLoading ? "—" : `${fmtNum(k.reorder_count)} reorder • ${fmtNum(k.batch_risk_count)} batch-risk • ${fmtNum(k.negative_stock_count)} mismatch`,
            sub: "Predictive + integrity",
        },
        {
            icon: ShieldAlert,
            title: "FEFO Compliance (Approx)",
            value: summaryLoading ? "—" : (k.fefo_compliance_pct != null ? `${fmtNum(k.fefo_compliance_pct)}%` : "—"),
            sub: "Lower is risk",
        },
    ]

    return (
        <div className="w-full p-4 md:p-6">
            {/* Header */}
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                        Batch-wise stock • FEFO signals • Alerts • Export reports
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                            loadLocations()
                            loadSummary()
                            if (tab === "alerts") loadAlerts()
                            if (tab === "stock") loadStock()
                            if (tab === "quarantine") loadQuarantine()
                        }}
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>

                    {/* ✅ Filters only on click */}
                    <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setFiltersOpen(true)}
                        title="Filters"
                    >
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                    </Button>

                    {/* ✅ Export dialog */}
                    <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setExportOpen(true)}
                        title="Export"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Active filters (essential, always visible) */}
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700">
                    Store: <span className="ml-1 font-semibold text-slate-900">{activeLocationLabel}</span>
                </Badge>
                {filters.itemType !== ALL ? (
                    <Badge variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700">
                        Type: <span className="ml-1 font-semibold text-slate-900">{filters.itemType}</span>
                    </Badge>
                ) : null}
                {filters.scheduleCode !== ALL ? (
                    <Badge variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700">
                        Schedule: <span className="ml-1 font-semibold text-slate-900">{filters.scheduleCode}</span>
                    </Badge>
                ) : null}
                {filters.supplierId !== ALL ? (
                    <Badge variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700">
                        Supplier: <span className="ml-1 font-semibold text-slate-900">#{filters.supplierId}</span>
                    </Badge>
                ) : null}
            </div>

            {/* Tabs (scrollable on mobile) */}
            <Tabs value={tab} onValueChange={setTab}>
                <div className="mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <TabsList className="w-max min-w-full justify-start gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                        <TabsTrigger value="dashboard" className="whitespace-nowrap rounded-xl">
                            Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="alerts" className="whitespace-nowrap rounded-xl">
                            Alerts
                        </TabsTrigger>
                        <TabsTrigger value="stock" className="whitespace-nowrap rounded-xl">
                            Stock (Batch-wise)
                        </TabsTrigger>
                        <TabsTrigger value="quarantine" className="whitespace-nowrap rounded-xl">
                            Quarantine
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Dashboard */}
                <TabsContent value="dashboard">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        {kpiCards.map((c, idx) => (
                            <div
                                key={c.title}
                                className={`${idx >= 4 ? `${showMoreKpis ? "block" : "hidden"} md:block` : "block"}`}
                            >
                                <KpiCard icon={c.icon} title={c.title} value={c.value} sub={c.sub} />
                            </div>
                        ))}
                    </div>

                    {/* ✅ mobile expand/collapse (essential first) */}
                    <div className="mt-3 md:hidden">
                        <Button
                            variant="outline"
                            className="w-full rounded-xl"
                            onClick={() => setShowMoreKpis((s) => !s)}
                        >
                            {showMoreKpis ? "Show less" : "Show more insights"}
                        </Button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Store-wise Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="hidden md:block">
                                    <MiniTable
                                        loading={summaryLoading}
                                        rows={locationsSummaryRows}
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
                                </div>

                                <div className="md:hidden">
                                    <MobileCards
                                        rows={locationsSummaryRows}
                                        loading={summaryLoading}
                                        emptyText="No pharmacy stores found"
                                        titleKey="location_name"
                                        subtitle={(r) => `Items: ${fmtNum(r.items_with_stock)} • Low: ${fmtNum(r.low_stock_count)} • Out: ${fmtNum(r.out_of_stock_count)}`}
                                        rightTop={(r) => <Badge variant="outline">{fmtMoney(r.stock_value_purchase)}</Badge>}
                                        rightBottom={(r) => `Expiry Risk: ${fmtNum(r.expiry_risk_count)}`}
                                        onOpen={(r) => {
                                            openDetail(`Store • ${r.location_name || "—"}`, [
                                                { label: "Items w/ Stock", value: fmtNum(r.items_with_stock) },
                                                { label: "Low Stock", value: fmtNum(r.low_stock_count) },
                                                { label: "Out of Stock", value: fmtNum(r.out_of_stock_count) },
                                                { label: "Expiry Risk", value: fmtNum(r.expiry_risk_count) },
                                                { label: "Stock Value (Purchase)", value: fmtMoney(r.stock_value_purchase) },
                                            ])
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Actionable Alerts Preview</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="hidden md:block">
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
                                </div>

                                <div className="md:hidden">
                                    <MobileCards
                                        rows={summary?.alerts_preview || []}
                                        loading={summaryLoading}
                                        emptyText="No alerts preview"
                                        titleKey="item_name"
                                        subtitle={(r) => `${r.location_name || "—"} • Batch: ${r.batch_no || "—"} • Exp: ${fmtDate(r.expiry_date)}`}
                                        rightTop={(r) => <SevBadge severity={r.severity} />}
                                        rightBottom={(r) => `Qty: ${fmtNum(r.on_hand_qty)}`}
                                        onOpen={(r) => {
                                            openDetail(
                                                `Alert • ${r.item_name || "—"}`,
                                                [
                                                    { label: "Severity", value: r.severity },
                                                    { label: "Type", value: r.type },
                                                    { label: "Store", value: r.location_name },
                                                    { label: "Batch", value: r.batch_no },
                                                    { label: "Expiry", value: fmtDate(r.expiry_date) },
                                                    { label: "On-hand Qty", value: fmtNum(r.on_hand_qty) },
                                                    { label: "Message", value: r.message || "—" },
                                                ],
                                                <Button
                                                    className="w-full rounded-xl"
                                                    variant="outline"
                                                    onClick={() => openBatches({ item_id: r.item_id, item_name: r.item_name, location_id: r.location_id })}
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View Batches
                                                </Button>
                                            )
                                        }}
                                    />
                                </div>
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

                            {/* Desktop */}
                            <div className="hidden md:block">
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
                                                        {r.item_code ? <span className="font-mono">{r.item_code}</span> : "—"} • {r.location_name || r.location_code || "—"}
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
                                            header: "Price",
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
                                                </div>
                                            ),
                                        },
                                    ]}
                                    emptyText="No alerts found for this filter."
                                />
                            </div>

                            {/* Mobile (minimal card, details on tap) */}
                            <div className="md:hidden">
                                <MobileCards
                                    rows={alerts}
                                    loading={alertsLoading}
                                    emptyText="No alerts found for this filter."
                                    titleKey="item_name"
                                    subtitle={(r) => `${r.location_name || r.location_code || "—"} • Batch: ${r.batch_no || "—"} • Exp: ${fmtDate(r.expiry_date)}`}
                                    rightTop={(r) => <SevBadge severity={r.severity} />}
                                    rightBottom={(r) => `Qty: ${fmtNum(r.on_hand_qty)}`}
                                    onOpen={(r) => {
                                        openDetail(
                                            `Alert • ${r.item_name || "—"}`,
                                            [
                                                { label: "Severity", value: r.severity },
                                                { label: "Type", value: r.type },
                                                { label: "Store", value: r.location_name || r.location_code || "—" },
                                                { label: "Item Code", value: r.item_code || "—" },
                                                { label: "Batch", value: r.batch_no || "—" },
                                                { label: "Expiry", value: fmtDate(r.expiry_date) },
                                                { label: "Days To Expiry", value: r.days_to_expiry != null ? fmtNum(r.days_to_expiry) : "—" },
                                                { label: "On-hand Qty", value: fmtNum(r.on_hand_qty) },
                                                { label: "Reorder Level", value: r.reorder_level != null ? fmtNum(r.reorder_level) : "—" },
                                                { label: "Suggested Reorder", value: r.suggested_reorder_qty != null ? fmtNum(r.suggested_reorder_qty) : "—" },
                                                { label: "Unit Cost", value: fmtMoney(r.unit_cost) },
                                                { label: "MRP", value: fmtMoney(r.mrp) },
                                                { label: "Value Risk", value: r.value_risk_purchase != null ? fmtMoney(r.value_risk_purchase) : "—" },
                                                { label: "Message", value: r.message || "—" },
                                            ],
                                            <Button
                                                className="w-full rounded-xl"
                                                variant="outline"
                                                onClick={() => openBatches({ item_id: r.item_id, item_name: r.item_name, location_id: r.location_id })}
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                View Batches
                                            </Button>
                                        )
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Stock */}
                <TabsContent value="stock">
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <CardTitle className="text-sm">Stock List (Batch-wise)</CardTitle>
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
                                    Purchase Value:{" "}
                                    <span className="font-semibold text-slate-900">{fmtMoney(stockResp?.totals?.value_purchase)}</span>
                                </span>
                                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1">
                                    MRP Value: <span className="font-semibold text-slate-900">{fmtMoney(stockResp?.totals?.value_mrp)}</span>
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

                            <div className="hidden md:block">
                                <MiniTable
                                    loading={stockLoading}
                                    rows={stockResp?.rows || []}
                                    columns={[
                                        { key: "location_name", header: "Store", render: (r) => <span className="text-xs">{r.location_name || r.location_code}</span> },
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
                                        { key: "value_purchase", header: "Value", render: (r) => fmtMoney(r.value_purchase) },
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
                            </div>

                            <div className="md:hidden">
                                <MobileCards
                                    rows={stockResp?.rows || []}
                                    loading={stockLoading}
                                    emptyText="No stock found."
                                    titleKey="item_name"
                                    subtitle={(r) => `${r.location_name || r.location_code || "—"} • Batch: ${r.batch_no || "—"} • Exp: ${fmtDate(r.expiry_date)}`}
                                    rightTop={(r) => <Badge variant="outline">{fmtNum(r.qty)}</Badge>}
                                    rightBottom={(r) => `${fmtMoney(r.mrp)}`}
                                    onOpen={(r) => {
                                        openDetail(
                                            `Stock • ${r.item_name || "—"}`,
                                            [
                                                { label: "Store", value: r.location_name || r.location_code || "—" },
                                                { label: "Item Code", value: r.item_code || "—" },
                                                { label: "Type", value: r.item_type || "—" },
                                                { label: "Schedule", value: r.schedule_code || "—" },
                                                { label: "Batch", value: r.batch_no || "—" },
                                                { label: "Expiry", value: fmtDate(r.expiry_date) },
                                                { label: "Qty", value: fmtNum(r.qty) },
                                                { label: "Unit Cost", value: fmtMoney(r.unit_cost) },
                                                { label: "MRP", value: fmtMoney(r.mrp) },
                                                { label: "Value (Purchase)", value: fmtMoney(r.value_purchase) },
                                            ],
                                            <Button
                                                className="w-full rounded-xl"
                                                variant="outline"
                                                onClick={() => openBatches({ item_id: r.item_id, item_name: r.item_name, location_id: r.location_id })}
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                View Batches
                                            </Button>
                                        )
                                    }}
                                />
                            </div>
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

                            <div className="hidden md:block">
                                <MiniTable
                                    loading={quarLoading}
                                    rows={quarResp?.rows || []}
                                    columns={[
                                        { key: "location_name", header: "Store", render: (r) => <span className="text-xs">{r.location_name || r.location_code}</span> },
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
                                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                                    {r.status || (r.is_saleable === false ? "NOT_SALEABLE" : "—")}
                                                </Badge>
                                            ),
                                        },
                                    ]}
                                    emptyText="No quarantine batches found."
                                />
                            </div>

                            <div className="md:hidden">
                                <MobileCards
                                    rows={quarResp?.rows || []}
                                    loading={quarLoading}
                                    emptyText="No quarantine batches found."
                                    titleKey="item_name"
                                    subtitle={(r) => `${r.location_name || r.location_code || "—"} • Batch: ${r.batch_no || "—"} • Exp: ${fmtDate(r.expiry_date)}`}
                                    rightTop={(r) => (
                                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                            {r.status || (r.is_saleable === false ? "NOT_SALEABLE" : "—")}
                                        </Badge>
                                    )}
                                    rightBottom={(r) => `Qty: ${fmtNum(r.qty)}`}
                                    onOpen={(r) => {
                                        openDetail(`Quarantine • ${r.item_name || "—"}`, [
                                            { label: "Store", value: r.location_name || r.location_code || "—" },
                                            { label: "Item Code", value: r.item_code || "—" },
                                            { label: "Schedule", value: r.schedule_code || "—" },
                                            { label: "Batch", value: r.batch_no || "—" },
                                            { label: "Expiry", value: fmtDate(r.expiry_date) },
                                            { label: "Qty", value: fmtNum(r.qty) },
                                            { label: "Unit Cost", value: fmtMoney(r.unit_cost) },
                                            { label: "MRP", value: fmtMoney(r.mrp) },
                                            { label: "Status", value: r.status || (r.is_saleable === false ? "NOT_SALEABLE" : "—") },
                                        ])
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Filters Dialog (shown only when filter icon/button clicked) */}
            <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
                <DialogContent className="max-w-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Filters</DialogTitle>
                        <DialogDescription>Change filters, then tap “Apply”.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                        {/* Store */}
                        <div className="md:col-span-4">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Store</label>
                            <Select
                                value={draft.locationId}
                                onValueChange={(v) => setDraft((s) => ({ ...s, locationId: v }))}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All stores</SelectItem>
                                    {locLoading ? <SelectItem value="__loading__" disabled>Loading...</SelectItem> : null}
                                    {locOptions.map((o) => (
                                        <SelectItem key={o.id} value={o.id}>
                                            {o.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="mt-1 text-[11px] text-slate-500">Uses location id/code safely.</div>
                        </div>

                        {/* Item Type */}
                        <div className="md:col-span-4">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Item Type</label>
                            <Select
                                value={draft.itemType}
                                onValueChange={(v) => setDraft((s) => ({ ...s, itemType: v }))}
                            >
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
                        <div className="md:col-span-4">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Schedule</label>
                            <Select
                                value={draft.scheduleCode}
                                onValueChange={(v) => setDraft((s) => ({ ...s, scheduleCode: v }))}
                            >
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
                        <div className="md:col-span-12">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Supplier</label>
                            <SupplierCombobox
                                value={draft.supplierId}
                                onChange={(v) => setDraft((s) => ({ ...s, supplierId: v }))}
                            />
                            <div className="mt-1 text-[11px] text-slate-500">Search by name/code, works smoothly on mobile.</div>
                        </div>

                        {/* Advanced toggle */}
                        <div className="md:col-span-12">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full rounded-xl"
                                onClick={() => setShowAdvancedFilters((s) => !s)}
                            >
                                {showAdvancedFilters ? "Hide advanced" : "Show advanced (expiry/non-moving/lead time)"}
                            </Button>
                        </div>

                        {/* Advanced filters (collapsed initially) */}
                        {showAdvancedFilters ? (
                            <>
                                <div className="md:col-span-3">
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Near Expiry</label>
                                    <Select value={draft.daysNearExpiry} onValueChange={(v) => setDraft((s) => ({ ...s, daysNearExpiry: v }))}>
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

                                <div className="md:col-span-3">
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Non-moving</label>
                                    <Select value={draft.nonMovingDays} onValueChange={(v) => setDraft((s) => ({ ...s, nonMovingDays: v }))}>
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

                                <div className="md:col-span-3">
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Consumption</label>
                                    <Select value={draft.consumptionDays} onValueChange={(v) => setDraft((s) => ({ ...s, consumptionDays: v }))}>
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

                                <div className="md:col-span-3">
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Lead Time</label>
                                    <Select value={draft.leadTimeDays} onValueChange={(v) => setDraft((s) => ({ ...s, leadTimeDays: v }))}>
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

                                <div className="md:col-span-6">
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Fast-moving Window</label>
                                    <Select value={draft.fastMovingDays} onValueChange={(v) => setDraft((s) => ({ ...s, fastMovingDays: v }))}>
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

                                <div className="md:col-span-6">
                                    <label className="mb-1 block text-xs font-medium text-slate-600">High Value Threshold (₹)</label>
                                    <Input
                                        className="rounded-xl"
                                        placeholder="0 (disabled)"
                                        value={draft.highValueThreshold}
                                        onChange={(e) => setDraft((s) => ({ ...s, highValueThreshold: e.target.value.replace(/[^\d.]/g, "") }))}
                                    />
                                </div>
                            </>
                        ) : null}
                    </div>

                    <div className="mt-4 flex flex-col-reverse gap-2 md:flex-row md:justify-between">
                        <Button variant="outline" className="rounded-xl" onClick={resetDraft}>
                            Reset
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" className="rounded-xl" onClick={() => setFiltersOpen(false)}>
                                Cancel
                            </Button>
                            <Button className="rounded-xl" onClick={applyFilters}>
                                Apply
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Export Dialog */}
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                <DialogContent className="max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Export</DialogTitle>
                        <DialogDescription>Exports are batch-wise (current applied filters).</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Report</label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger className="h-9 rounded-xl">
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
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Format</label>
                            <Select value={reportFormat} onValueChange={setReportFormat}>
                                <SelectTrigger className="h-9 rounded-xl">
                                    <SelectValue placeholder="Format" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="xlsx">Excel</SelectItem>
                                    <SelectItem value="pdf">PDF</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button className="h-10 rounded-xl" disabled={exporting} onClick={doExport}>
                            <Download className="mr-2 h-4 w-4" />
                            {exporting ? "Exporting..." : "Export"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Mobile Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">{detailTitle}</DialogTitle>
                        <DialogDescription>Tap outside to close.</DialogDescription>
                    </DialogHeader>

                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3">
                        {detailRows?.length ? detailRows.map((f, idx) => <KV key={idx} label={f.label} value={f.value} />) : null}
                    </div>

                    {detailActions ? <div className="mt-3">{detailActions}</div> : null}
                </DialogContent>
            </Dialog>

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
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                    : "border-rose-200 bg-rose-50 text-rose-700"
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
