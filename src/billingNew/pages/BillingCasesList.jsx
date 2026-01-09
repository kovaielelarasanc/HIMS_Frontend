// FILE: src/pages/billing/BillingCasesList.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Search, SlidersHorizontal, RefreshCcw } from "lucide-react"

import { listBillingCases, isCanceledError } from "@/api/billings"
import { useCan } from "../hooks/useCan"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const cx = (...a) => a.filter(Boolean).join(" ")

function fmtDate(v) {
    if (!v) return "-"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
}

function fmtMoney(v) {
    if (v === null || v === undefined || v === "") return "-"
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n)
}

function statusBadge(status) {
    const s = String(status || "UNKNOWN").toUpperCase()
    const map = {
        DRAFT: "bg-muted text-foreground",
        OPEN: "bg-muted text-foreground",
        APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
        POSTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
        VOID: "bg-rose-50 text-rose-700 border-rose-200",
        CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
    }
    return cx("border", map[s] || "bg-muted text-foreground")
}

export default function BillingCasesList() {
    const navigate = useNavigate()
    const can = useCan()

    // Search + filters
    const [q, setQ] = useState("")
    const [encounterType, setEncounterType] = useState("ALL")
    const [status, setStatus] = useState("ALL")
    const [payerMode, setPayerMode] = useState("ALL")

    // Paging
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    // Data
    const [loading, setLoading] = useState(true)
    const [rows, setRows] = useState([])
    const [total, setTotal] = useState(0)

    const totalPages = useMemo(() => {
        const t = Number(total || 0)
        const ps = Number(pageSize || 10)
        return Math.max(1, Math.ceil(t / ps))
    }, [total, pageSize])

    const queryObj = useMemo(
        () => ({
            q,
            encounter_type: encounterType === "ALL" ? "" : encounterType,
            status: status === "ALL" ? "" : status,
            payer_mode: payerMode === "ALL" ? "" : payerMode,
            page,
            page_size: pageSize,
        }),
        [q, encounterType, status, payerMode, page, pageSize]
    )

    const load = async (signal) => {
        if (!can("billing.cases.view")) return
        setLoading(true)
        try {
            const data = await listBillingCases(queryObj, { signal })
            setRows(data?.items || [])
            setTotal(data?.total ?? 0)
        } catch (e) {
            if (isCanceledError(e)) return
            toast.error(e?.message || "Failed to load billing cases")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        load(controller.signal)
        return () => controller.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryObj])

    const onSearchSubmit = (e) => {
        e.preventDefault()
        setPage(1)
    }

    const resetFilters = () => {
        setQ("")
        setEncounterType("ALL")
        setStatus("ALL")
        setPayerMode("ALL")
        setPage(1)
        setPageSize(10)
    }

    return (
        <div className="p-4 lg:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Billing Cases</h1>
                    <p className="text-sm text-muted-foreground">
                        Search by case number / UHID / phone / name / encounter id.
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={() => {
                        const controller = new AbortController()
                        load(controller.signal)
                    }}
                    className="rounded-2xl"
                >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        Search & Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={onSearchSubmit}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-3"
                    >
                        <div className="lg:col-span-5">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Case # / UHID / Phone / Name / Encounter ID"
                                    className="pl-9 rounded-2xl"
                                />
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <Select value={encounterType} onValueChange={setEncounterType}>
                                <SelectTrigger className="rounded-2xl">
                                    <SelectValue placeholder="Encounter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Encounters</SelectItem>
                                    <SelectItem value="OP">OP</SelectItem>
                                    <SelectItem value="IP">IP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="lg:col-span-2">
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="rounded-2xl">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Status</SelectItem>
                                    <SelectItem value="OPEN">OPEN</SelectItem>
                                    <SelectItem value="DRAFT">DRAFT</SelectItem>
                                    <SelectItem value="APPROVED">APPROVED</SelectItem>
                                    <SelectItem value="POSTED">POSTED</SelectItem>
                                    <SelectItem value="VOID">VOID</SelectItem>
                                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="lg:col-span-2">
                            <Select value={payerMode} onValueChange={setPayerMode}>
                                <SelectTrigger className="rounded-2xl">
                                    <SelectValue placeholder="Payer Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Payer Modes</SelectItem>
                                    <SelectItem value="SELF">SELF</SelectItem>
                                    <SelectItem value="TPA">TPA</SelectItem>
                                    <SelectItem value="CORPORATE">CORPORATE</SelectItem>
                                    <SelectItem value="INSURANCE">INSURANCE</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="lg:col-span-1 flex gap-2">
                            <Button type="submit" className="rounded-2xl w-full">
                                Apply
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-2xl"
                                onClick={resetFilters}
                            >
                                Reset
                            </Button>
                        </div>
                    </form>

                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm text-muted-foreground">
                            {loading ? "Loading..." : `Showing ${rows.length} of ${total}`}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Page size</span>
                            <Select
                                value={String(pageSize)}
                                onValueChange={(v) => {
                                    setPageSize(Number(v))
                                    setPage(1)
                                }}
                            >
                                <SelectTrigger className="w-[110px] rounded-2xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Cases</CardTitle>
                </CardHeader>
                <CardContent>
                    {!can("billing.cases.view") ? (
                        <div className="text-sm text-muted-foreground">
                            You don’t have permission to view billing cases.
                        </div>
                    ) : loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-2xl border p-6 text-center">
                            <div className="text-sm font-medium">No cases found</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Try a different search or clear filters.
                            </div>
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Case #</TableHead>
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Encounter</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Payer</TableHead>
                                        <TableHead className="text-right">Posted</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead>Created</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {rows.map((r) => {
                                        const patient =
                                            r?.patient ||
                                            r?.patient_info || {
                                                name: r?.patient_name,
                                                uhid: r?.patient_uhid,
                                                phone: r?.patient_phone,
                                            }

                                        return (
                                            <TableRow
                                                key={r.id}
                                                className="cursor-pointer hover:bg-muted/40"
                                                onClick={() => navigate(`/billing/cases/${r.id}`)}
                                            >
                                                <TableCell className="font-medium">
                                                    <div>{r.case_number || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Encounter ID: {r.encounter_id ?? "-"}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="font-medium">{patient?.name || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        UHID: {patient?.uhid || "-"} · Ph: {patient?.phone || "-"}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="font-medium">{r.encounter_type || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {r.encounter_type === "OP" ? "Visit" : "Admission"}
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <Badge variant="outline" className={cx("rounded-xl", statusBadge(r.status))}>
                                                        {String(r.status || "-").toUpperCase()}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="font-medium">{r.payer_mode || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Tariff: {r.tariff_plan_id ?? "-"}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    {fmtMoney(r.posted_invoice_total ?? r.posted_total)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {fmtMoney(r.paid_total)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {fmtMoney(r.balance)}
                                                </TableCell>

                                                <TableCell>{fmtDate(r.created_at)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {can("billing.cases.view") && !loading && rows.length > 0 && (
                        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-2xl"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Prev
                                </Button>
                                <Button
                                    variant="outline"
                                    className="rounded-2xl"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
