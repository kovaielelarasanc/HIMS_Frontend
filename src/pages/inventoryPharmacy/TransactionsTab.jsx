// FILE: src/pages/inventoryPharmacy/TransactionsTab.jsx
import { useMemo, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Search, X, Download, CalendarRange, FileText } from "lucide-react"

import { GLASS_CARD, formatNumber } from "./UI"
import {
    downloadStockTransactionsPdf,
    downloadScheduleMedicineReportPdf,
} from "@/api/inventory"
import { formatIST } from "@/ipd/components/timeZONE"

const REF_FILTERS = [
    { key: "PHARMACY_RX", label: "Pharmacy RX" },
    { key: "GRN", label: "GRN" },
    { key: "RETURN", label: "Return" },
]

const isoDateToday = () => new Date().toISOString().slice(0, 10)

const startOfDayLocal = (yyyyMmDd) => {
    if (!yyyyMmDd) return null
    const d = new Date(`${yyyyMmDd}T00:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
}

const endOfDayLocal = (yyyyMmDd) => {
    if (!yyyyMmDd) return null
    const d = new Date(`${yyyyMmDd}T23:59:59`)
    return Number.isNaN(d.getTime()) ? null : d
}

const badgeTone = (txnType = "") => {
    const t = (txnType || "").toLowerCase()
    if (t.includes("in") || t.includes("grn") || t.includes("receive"))
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
    if (
        t.includes("out") ||
        t.includes("issue") ||
        t.includes("consume") ||
        t.includes("sale") ||
        t.includes("dispense")
    )
        return "bg-rose-50 text-rose-700 border-rose-200"
    if (t.includes("adjust"))
        return "bg-amber-50 text-amber-800 border-amber-200"
    return "bg-slate-50 text-slate-700 border-slate-200"
}

/** ✅ When axios responseType is "blob", errors can also be Blob. */
const readBlobText = (blob) =>
    new Promise((resolve) => {
        if (!blob) return resolve("")
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => resolve("")
        reader.readAsText(blob)
    })

const extractBlobError = async (e) => {
    const data = e?.response?.data
    if (data instanceof Blob) {
        const text = await readBlobText(data)
        try {
            const j = JSON.parse(text)
            return j?.detail || j?.message || text || "Failed to download PDF."
        } catch {
            return text || "Failed to download PDF."
        }
    }
    return e?.response?.data?.detail || e?.message || "Failed to download PDF."
}

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
}

export default function TransactionsTab({
    txns = [],
    txnLoading,

    // ✅ Location is handled in the common TOP filter
    activeLocationId = null,
}) {
    const [txnQuery, setTxnQuery] = useState("")

    // ✅ ONE merged filter (Ref + Txn types)
    // Values:
    // - "ALL"
    // - "REF:GRN" / "REF:PHARMACY_RX" / "REF:RETURN"
    // - "TXN:DISPENSE" / "TXN:ADJUST" ... (derived from data)
    const [typeFilter, setTypeFilter] = useState("ALL")

    // ✅ Single date range for list + both PDF actions
    const [dateFrom, setDateFrom] = useState(isoDateToday())
    const [dateTo, setDateTo] = useState(isoDateToday())

    // Schedule report option
    const [onlyOutgoing, setOnlyOutgoing] = useState(true)

    const [downloadingTxnPdf, setDownloadingTxnPdf] = useState(false)
    const [downloadingSchedulePdf, setDownloadingSchedulePdf] = useState(false)

    const q = (txnQuery || "").toLowerCase().trim()

    const txnTypes = useMemo(() => {
        const s = new Set()
            ; (Array.isArray(txns) ? txns : []).forEach((t) => {
                if (t?.txn_type) s.add(String(t.txn_type))
            })
        return Array.from(s).sort((a, b) => a.localeCompare(b))
    }, [txns])

    const mergedTypeOptions = useMemo(() => {
        const out = [{ value: "ALL", label: "All Filters (Everything)" }]

        // Ref types
        for (const r of REF_FILTERS) {
            out.push({ value: `REF:${r.key}`, label: `Ref • ${r.label}` })
        }

        // Txn types (from data)
        for (const t of txnTypes) {
            out.push({ value: `TXN:${t}`, label: `Txn • ${t}` })
        }

        return out
    }, [txnTypes])

    const parsedTypeFilter = useMemo(() => {
        if (!typeFilter || typeFilter === "ALL") return { kind: "ALL", value: "" }
        if (typeFilter.startsWith("REF:"))
            return { kind: "REF", value: typeFilter.slice(4) }
        if (typeFilter.startsWith("TXN:"))
            return { kind: "TXN", value: typeFilter.slice(4) }
        return { kind: "ALL", value: "" }
    }, [typeFilter])

    const filteredTxns = useMemo(() => {
        const base = Array.isArray(txns) ? txns : []
        let out = base

        // ✅ merged filter
        if (parsedTypeFilter.kind === "REF") {
            out = out.filter(
                (t) => (t?.ref_type || "").toUpperCase() === parsedTypeFilter.value
            )
        } else if (parsedTypeFilter.kind === "TXN") {
            out = out.filter((t) => String(t?.txn_type || "") === parsedTypeFilter.value)
        }

        // date range filter (swap if user selected reversed)
        let start = startOfDayLocal(dateFrom)
        let end = endOfDayLocal(dateTo)
        if (start && end && start > end) {
            const tmp = start
            start = end
            end = tmp
        }
        if (start) {
            out = out.filter((t) => {
                const dt = t?.txn_time ? new Date(t.txn_time) : null
                return dt && dt >= start
            })
        }
        if (end) {
            out = out.filter((t) => {
                const dt = t?.txn_time ? new Date(t.txn_time) : null
                return dt && dt <= end
            })
        }

        // search
        if (q) {
            out = out.filter((t) => {
                const hay = [
                    t?.item_name,
                    t?.item_code,
                    t?.batch_no,
                    t?.location_name,
                    t?.txn_type,
                    t?.ref_display,
                    t?.ref_type,
                    t?.ref_id,
                    t?.user_name,
                    t?.doctor_name,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                return hay.includes(q)
            })
        }

        // newest first
        out = [...out].sort((a, b) => {
            const ta = a?.txn_time ? new Date(a.txn_time).getTime() : 0
            const tb = b?.txn_time ? new Date(b.txn_time).getTime() : 0
            return tb - ta
        })

        return out
    }, [txns, q, parsedTypeFilter, dateFrom, dateTo])

    const clearSearch = useCallback(() => setTxnQuery(""), [])

    const clearDates = useCallback(() => {
        setDateFrom("")
        setDateTo("")
    }, [])

    const setToday = useCallback(() => {
        const t = isoDateToday()
        setDateFrom(t)
        setDateTo(t)
    }, [])

    // ✅ Transactions PDF = exports visible rows (merged filter + search + date)
    const onDownloadTxnPdf = useCallback(async () => {
        const ids = (filteredTxns || []).map((x) => x?.id).filter(Boolean)

        if (!ids.length) {
            toast.message("No transactions to export.")
            return
        }
        if (ids.length > 5000) {
            toast.error("Too many rows. Please narrow filters (max 5000).")
            return
        }

        setDownloadingTxnPdf(true)
        try {
            const params = { ids: ids.join(","), limit: 5000 }

            // ✅ apply merged filter to backend for clarity (optional; ids already narrow it)
            if (parsedTypeFilter.kind === "REF") params.ref_type = parsedTypeFilter.value
            if (parsedTypeFilter.kind === "TXN") params.txn_type = parsedTypeFilter.value

            if (dateFrom) params.from_date = `${dateFrom}T00:00:00`
            if (dateTo) params.to_date = `${dateTo}T23:59:59`

            // location from top (optional safety)
            if (activeLocationId) params.location_id = Number(activeLocationId)

            const blob = await downloadStockTransactionsPdf(params)
            if (!(blob instanceof Blob)) {
                toast.error("Invalid PDF response.")
                return
            }

            downloadBlob(blob, `stock_transactions_${isoDateToday()}.pdf`)
            toast.success("Transactions PDF downloaded.")
        } catch (e) {
            const msg = await extractBlobError(e)
            toast.error(msg)
        } finally {
            setDownloadingTxnPdf(false)
        }
    }, [filteredTxns, parsedTypeFilter, dateFrom, dateTo, activeLocationId])

    // ✅ Schedule PDF = date range (+ top location) + onlyOutgoing
    const onDownloadSchedulePdf = useCallback(async () => {
        if (!dateFrom || !dateTo) {
            toast.error("Select From & To dates for Schedule report.")
            return
        }

        let s = startOfDayLocal(dateFrom)
        let e = endOfDayLocal(dateTo)
        if (!s || !e) {
            toast.error("Invalid date range.")
            return
        }
        if (s > e) {
            const tmp = s
            s = e
            e = tmp
        }

        const df = new Date(s).toISOString().slice(0, 10)
        const dt = new Date(e).toISOString().slice(0, 10)

        setDownloadingSchedulePdf(true)
        try {
            const params = {
                date_from: df,
                date_to: dt,
                only_outgoing: onlyOutgoing,
            }
            if (activeLocationId) params.location_id = Number(activeLocationId)

            const blob = await downloadScheduleMedicineReportPdf(params)
            if (!(blob instanceof Blob)) {
                toast.error("Invalid PDF response.")
                return
            }

            downloadBlob(blob, `schedule_medicine_report_${df}_${dt}.pdf`)
            toast.success("Schedule PDF downloaded.")
        } catch (e) {
            const msg = await extractBlobError(e)
            toast.error(msg)
        } finally {
            setDownloadingSchedulePdf(false)
        }
    }, [dateFrom, dateTo, onlyOutgoing, activeLocationId])

    const totalCount = Array.isArray(txns) ? txns.length : 0
    const activeFilterLabel =
        mergedTypeOptions.find((o) => o.value === typeFilter)?.label || "All Filters (Everything)"

    return (
        <Card className={GLASS_CARD}>
            <CardHeader className="gap-3">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            Stock transactions
                            <Badge variant="outline" className="text-xs">
                                {filteredTxns.length} / {totalCount}
                            </Badge>
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                            Audit trail of every stock movement (GRN, returns, Rx, adjustments).
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="relative w-full sm:w-80">
                            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search item / batch / location / ref..."
                                className="bg-white/80 rounded-2xl h-10 pl-9 pr-9"
                                value={txnQuery}
                                onChange={(e) => setTxnQuery(e.target.value)}
                            />
                            {txnQuery ? (
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100"
                                    aria-label="Clear search"
                                >
                                    <X className="h-4 w-4 text-slate-500" />
                                </button>
                            ) : null}
                        </div>

                        <Button
                            type="button"
                            className="rounded-2xl h-10 gap-2"
                            onClick={onDownloadTxnPdf}
                            disabled={downloadingTxnPdf}
                        >
                            <Download className="h-4 w-4" />
                            {downloadingTxnPdf ? "Downloading..." : "Transactions PDF"}
                        </Button>
                    </div>
                </div>

                {/* Filters (merged + date) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                    <div className="lg:col-span-12">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {/* ✅ ONE merged filter */}
                            <div className="min-w-0">
                                <p className="text-[11px] text-slate-500 mb-1">All filter</p>
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="rounded-2xl bg-white/80 h-10">
                                        <SelectValue placeholder="All Filters (Everything)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mergedTypeOptions.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date from */}
                            <div className="min-w-0">
                                <p className="text-[11px] text-slate-500 mb-1">From</p>
                                <Input
                                    type="date"
                                    className="bg-white/80 rounded-2xl h-10 min-w-0"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                            </div>

                            {/* Date to */}
                            <div className="min-w-0">
                                <p className="text-[11px] text-slate-500 mb-1">To</p>
                                <Input
                                    type="date"
                                    className="bg-white/80 rounded-2xl h-10 min-w-0"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Date helper + Schedule report */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                    <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                                    <CalendarRange className="h-4 w-4 text-slate-700" />
                                    Date range (applies to list + exports)
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    Current filter:{" "}
                                    <span className="font-medium text-slate-700">{activeFilterLabel}</span>.{" "}
                                    Transactions PDF exports visible rows (filter + search + date).
                                </p>
                            </div>

                            <div className="flex gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl h-9 px-3 text-xs"
                                    onClick={setToday}
                                >
                                    Today
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl h-9 px-3 text-xs"
                                    onClick={clearDates}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-700" />
                                    Schedule Medicine Report (PDF)
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    Uses only Date range (and your top Location). Ignores Search / Filter.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                <button
                                    type="button"
                                    onClick={() => setOnlyOutgoing((v) => !v)}
                                    className={`h-10 px-4 rounded-2xl border text-xs font-medium transition ${onlyOutgoing
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : "bg-slate-50 text-slate-700 border-slate-200"
                                        }`}
                                    title="Only outgoing (dispense/sale)"
                                >
                                    Only Outgoing: {onlyOutgoing ? "Yes" : "No"}
                                </button>

                                <Button
                                    type="button"
                                    className="rounded-2xl h-10 gap-2"
                                    onClick={onDownloadSchedulePdf}
                                    disabled={downloadingSchedulePdf}
                                >
                                    <Download className="h-4 w-4" />
                                    {downloadingSchedulePdf ? "Downloading..." : "Schedule PDF"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Desktop table */}
                <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden bg-white/70 backdrop-blur">
                    <div className="grid grid-cols-[1.05fr,1.55fr,1.05fr,1.15fr,1fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                        <span>Date / type</span>
                        <span>Item / batch</span>
                        <span>Location</span>
                        <span>Qty / cost</span>
                        <span>User / ref</span>
                    </div>

                    <div className="max-h-[560px] overflow-auto divide-y divide-slate-100">
                        {txnLoading ? (
                            <div className="p-3 space-y-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : filteredTxns.length === 0 ? (
                            <div className="p-4 text-sm text-slate-500">
                                No stock transactions found.
                            </div>
                        ) : (
                            filteredTxns.map((tx) => {
                                const qty = Number(tx?.quantity_change || 0)
                                const qtyTone =
                                    qty > 0
                                        ? "text-emerald-700"
                                        : qty < 0
                                            ? "text-rose-700"
                                            : "text-slate-700"

                                return (
                                    <div
                                        key={tx.id}
                                        className="grid grid-cols-[1.05fr,1.55fr,1.05fr,1.15fr,1fr] items-start px-3 py-2 text-xs gap-2"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium text-slate-900">
                                                {formatIST(tx.txn_time)}
                                            </p>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <span
                                                    className={`inline-flex items-center border rounded-full px-2 py-0.5 text-[11px] ${badgeTone(
                                                        tx?.txn_type
                                                    )}`}
                                                >
                                                    {tx?.txn_type || "—"}
                                                </span>
                                                <span className="text-slate-500 text-[11px] truncate">
                                                    {tx?.ref_display
                                                        ? `• ${tx.ref_display}`
                                                        : tx?.ref_type && tx?.ref_id
                                                            ? `• ${tx.ref_type} #${tx.ref_id}`
                                                            : ""}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-slate-900 truncate">
                                                {tx?.item_name ||
                                                    (tx?.item_id ? `Item #${tx.item_id}` : "—")}
                                            </p>
                                            <p className="text-slate-500 text-[11px] truncate">
                                                {tx?.item_code ? <span>Code: {tx.item_code} • </span> : null}
                                                Batch:{" "}
                                                {tx?.batch_no
                                                    ? tx.batch_no
                                                    : tx?.batch_id
                                                        ? `#${tx.batch_id}`
                                                        : "—"}
                                            </p>
                                        </div>

                                        <div className="text-slate-700 truncate">
                                            {tx?.location_name ||
                                                (tx?.location_id ? `Location #${tx.location_id}` : "—")}
                                        </div>

                                        <div className="min-w-0">
                                            <p className={`text-slate-900 ${qtyTone}`}>
                                                Qty: {formatNumber(tx?.quantity_change)}
                                            </p>
                                            <p className="text-slate-500 text-[11px] truncate">
                                                Rate: ₹{formatNumber(tx?.unit_cost)} • MRP: ₹
                                                {formatNumber(tx?.mrp)}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-slate-900 text-[11px] truncate">
                                                {tx?.user_name ||
                                                    (tx?.user_id ? `User #${tx.user_id}` : "System")}
                                            </p>
                                            <p className="text-slate-500 text-[11px] truncate">
                                                {tx?.ref_display ||
                                                    (tx?.ref_type && tx?.ref_id
                                                        ? `${tx.ref_type} #${tx.ref_id}`
                                                        : "—")}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                    {txnLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-20 w-full rounded-2xl" />
                            <Skeleton className="h-20 w-full rounded-2xl" />
                            <Skeleton className="h-20 w-full rounded-2xl" />
                        </div>
                    ) : filteredTxns.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500 rounded-2xl border border-slate-200 bg-white/70">
                            No stock transactions found.
                        </div>
                    ) : (
                        filteredTxns.map((tx) => {
                            const qty = Number(tx?.quantity_change || 0)
                            const qtyTone =
                                qty > 0
                                    ? "text-emerald-700"
                                    : qty < 0
                                        ? "text-rose-700"
                                        : "text-slate-700"

                            return (
                                <div
                                    key={tx.id}
                                    className="rounded-2xl border border-slate-200 bg-white/80 p-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 truncate">
                                                {tx?.item_name ||
                                                    (tx?.item_id ? `Item #${tx.item_id}` : "—")}
                                            </p>
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {tx?.item_code ? `Code: ${tx.item_code} • ` : ""}
                                                Batch:{" "}
                                                {tx?.batch_no
                                                    ? tx.batch_no
                                                    : tx?.batch_id
                                                        ? `#${tx.batch_id}`
                                                        : "—"}
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="text-[11px] text-slate-500">
                                                {formatIST(tx?.txn_time)}
                                            </p>
                                            <p className={`text-sm font-semibold ${qtyTone}`}>
                                                {formatNumber(tx?.quantity_change)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span
                                            className={`inline-flex items-center border rounded-full px-2 py-0.5 text-[11px] ${badgeTone(
                                                tx?.txn_type
                                            )}`}
                                        >
                                            {tx?.txn_type || "—"}
                                        </span>
                                        {tx?.location_name ? (
                                            <span className="text-[11px] text-slate-600 truncate">
                                                {tx.location_name}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2">
                                            <p className="text-slate-500">Rate</p>
                                            <p className="text-slate-900 font-medium">
                                                ₹{formatNumber(tx?.unit_cost)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2">
                                            <p className="text-slate-500">MRP</p>
                                            <p className="text-slate-900 font-medium">
                                                ₹{formatNumber(tx?.mrp)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2 text-[11px] text-slate-600">
                                        <p className="truncate">
                                            <span className="text-slate-500">User: </span>
                                            {tx?.user_name ||
                                                (tx?.user_id ? `User #${tx.user_id}` : "System")}
                                        </p>
                                        <p className="truncate">
                                            <span className="text-slate-500">Ref: </span>
                                            {tx?.ref_display ||
                                                (tx?.ref_type && tx?.ref_id
                                                    ? `${tx.ref_type} #${tx.ref_id}`
                                                    : "—")}
                                        </p>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                <p className="text-[11px] text-slate-500">
                    Transactions PDF exports the rows you currently see (Filter + Search + Date).
                    Schedule PDF uses only Date range (and your top Location).
                </p>
            </CardContent>
        </Card>
    )
}
