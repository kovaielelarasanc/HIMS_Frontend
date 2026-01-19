// FILE: src/billing/BillingDashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { billingListCases, isCanceledError } from "@/api/billings"
import { billingSearchPatients, billingListPatientEncounters, billingCreateCaseManual } from "@/api/billings"
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    EmptyState,
    Field,
    Input,
    Select,
    StatusBadge,
    cn,
} from "./_ui"
import {
    ArrowRight,
    RefreshCcw,
    Search,
    Filter,
    Plus,
    X,
    CheckCircle2,
    SlidersHorizontal,
    Calendar,
    ChevronDown,
    ChevronUp,
    Layers,
    ShieldCheck,
    Sparkles,
    RotateCcw,
} from "lucide-react"

const ENCOUNTERS = ["ALL", "OP", "IP", "OT", "ER"]
const CASE_STATUSES = ["ALL", "OPEN", "READY_FOR_POST", "CLOSED", "CANCELLED"]
const PAYERS = ["ALL", "SELF", "INSURANCE", "CORPORATE", "MIXED"]
const MANUAL_TYPES = ["OP", "IP", "OT", "ER"]

function safeApiDetail(err) {
    const d = err?.response?.data?.detail
    if (!d) return null
    return d
}

function formatDT(dt) {
    if (!dt) return "—"
    const d = new Date(dt)
    if (Number.isNaN(d.getTime())) return "—"
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d)
}

function toISODate(v) {
    if (!v) return ""
    try {
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return ""
        const yyyy = String(d.getFullYear())
        const mm = String(d.getMonth() + 1).padStart(2, "0")
        const dd = String(d.getDate()).padStart(2, "0")
        return `${yyyy}-${mm}-${dd}`
    } catch {
        return ""
    }
}

function clampInt(v, def, min = 1, max = 1000000) {
    const n = Number(v)
    if (!Number.isFinite(n)) return def
    return Math.max(min, Math.min(max, Math.floor(n)))
}

function toneForStatus(s) {
    const v = String(s || "").toUpperCase()
    if (v.includes("READY")) return "amber"
    if (v === "OPEN") return "blue"
    if (v === "CLOSED") return "green"
    if (v === "CANCELLED") return "rose"
    return "slate"
}

export default function BillingDashboard() {
    const nav = useNavigate()
    const [sp] = useSearchParams()

    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [meta, setMeta] = useState({ total: 0, page: 1, page_size: 20 })

    const abortRef = useRef(null)

    // UI state
    const [openCreate, setOpenCreate] = useState(false)
    const [filtersOpenMobile, setFiltersOpenMobile] = useState(false)

    const filters = useMemo(() => {
        const q = sp.get("q") || ""
        const encounter_type = sp.get("encounter_type") || "ALL"
        const status = sp.get("status") || "ALL"
        const payer_mode = sp.get("payer_mode") || "ALL"
        const date_from = sp.get("date_from") || "" // YYYY-MM-DD
        const date_to = sp.get("date_to") || "" // YYYY-MM-DD
        const page = clampInt(sp.get("page") || 1, 1, 1, 1000000)
        const page_size = clampInt(sp.get("page_size") || 20, 20, 10, 200)

        return { q, encounter_type, status, payer_mode, date_from, date_to, page, page_size }
    }, [sp])

    // search input (debounced → URL)
    const [qInput, setQInput] = useState(filters.q)
    const qDebounceRef = useRef(null)

    useEffect(() => {
        setQInput(filters.q || "")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.q])

    function setFilter(key, value) {
        const u = new URLSearchParams(sp)
        if (value === "" || value == null) u.delete(key)
        else u.set(key, String(value))
        if (key !== "page") u.set("page", "1")
        nav({ search: u.toString() })
    }

    function clearAllFilters() {
        const u = new URLSearchParams(sp)
            ;["q", "encounter_type", "status", "payer_mode", "date_from", "date_to", "page"].forEach((k) => u.delete(k))
        u.set("page", "1")
        nav({ search: u.toString() })
    }

    const activeChips = useMemo(() => {
        const chips = []
        if (filters.q) chips.push({ k: "q", label: `Search: ${filters.q}` })
        if (filters.encounter_type !== "ALL") chips.push({ k: "encounter_type", label: `Encounter: ${filters.encounter_type}` })
        if (filters.status !== "ALL") chips.push({ k: "status", label: `Status: ${filters.status}` })
        if (filters.payer_mode !== "ALL") chips.push({ k: "payer_mode", label: `Payer: ${filters.payer_mode}` })
        if (filters.date_from) chips.push({ k: "date_from", label: `From: ${filters.date_from}` })
        if (filters.date_to) chips.push({ k: "date_to", label: `To: ${filters.date_to}` })
        return chips
    }, [filters])

    async function load() {
        abortRef.current?.abort?.()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const params = {
                q: filters.q || undefined,
                encounter_type: filters.encounter_type !== "ALL" ? filters.encounter_type : undefined,
                status: filters.status !== "ALL" ? filters.status : undefined,
                payer_mode: filters.payer_mode !== "ALL" ? filters.payer_mode : undefined,
                date_from: filters.date_from || undefined,
                date_to: filters.date_to || undefined,
                page: filters.page,
                page_size: filters.page_size,
            }

            const data = await billingListCases(params, { signal: ac.signal })
            const items = Array.isArray(data) ? data : (data?.items ?? [])

            setRows(items)
            setMeta({
                total: Number(data?.total ?? items.length ?? 0),
                page: Number(data?.page ?? filters.page),
                page_size: Number(data?.page_size ?? filters.page_size),
            })
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load billing cases")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.q, filters.encounter_type, filters.status, filters.payer_mode, filters.date_from, filters.date_to, filters.page, filters.page_size])

    const quick = useMemo(() => {
        const total = meta.total || rows.length
        const open = rows.filter((r) => String(r.status || "").toUpperCase() === "OPEN").length
        const ready = rows.filter((r) => String(r.status || "").toUpperCase().includes("READY")).length
        const closed = rows.filter((r) => String(r.status || "").toUpperCase() === "CLOSED").length
        const cancelled = rows.filter((r) => String(r.status || "").toUpperCase() === "CANCELLED").length
        return { total, open, ready, closed, cancelled }
    }, [rows, meta.total])

    const disableNext = rows.length < meta.page_size

    // debounced search → URL (feels premium + reduces API calls)
    useEffect(() => {
        if (qDebounceRef.current) clearTimeout(qDebounceRef.current)
        qDebounceRef.current = setTimeout(() => {
            const next = (qInput || "").trim()
            if (next === (filters.q || "")) return
            setFilter("q", next)
        }, 350)

        return () => {
            if (qDebounceRef.current) clearTimeout(qDebounceRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qInput])

    return (
        <div className="w-full">
            {/* Hero / Header */}
            <div className="relative mb-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="absolute inset-0 bg-[radial-gradient(1200px_400px_at_20%_-20%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(900px_300px_at_95%_0%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(800px_300px_at_45%_110%,rgba(245,158,11,0.10),transparent_45%)]" />
                <div className="relative px-5 py-5 sm:px-6 sm:py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <Layers className="h-4 w-4 text-slate-800" />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-xl font-extrabold text-slate-900 sm:text-2xl">Billing Dashboard</div>
                                    <div className="mt-0.5 text-xs text-slate-600 sm:text-sm">
                                        Cases, invoices, payments & posting —{" "}
                                        <span className="font-semibold text-slate-900">fast</span>,{" "}
                                        <span className="font-semibold text-slate-900">clean</span>,{" "}
                                        <span className="font-semibold text-slate-900">trackable</span>.
                                    </div>
                                </div>
                            </div>

                            {/* Active filter chips */}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {activeChips.length === 0 ? (
                                    <div className="text-xs text-slate-500">No filters applied.</div>
                                ) : (
                                    <>
                                        {activeChips.map((c) => (
                                            <span
                                                key={c.k + c.label}
                                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur"
                                            >
                                                {c.label}
                                                <button
                                                    type="button"
                                                    className="rounded-full p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                                    onClick={() => setFilter(c.k, "")}
                                                    aria-label={`Remove ${c.label}`}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </span>
                                        ))}
                                        <Button variant="outline" className="h-8 rounded-full" onClick={clearAllFilters}>
                                            <RotateCcw className="h-4 w-4" /> Reset
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="h-10 rounded-2xl"
                                    onClick={() => setOpenCreate(true)}
                                >
                                    <Plus className="h-4 w-4" />
                                    New Case
                                </Button>

                                <Button variant="outline" className="h-10 rounded-2xl" onClick={load} disabled={loading}>
                                    <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                                    Refresh
                                </Button>

                                <Button
                                    variant="outline"
                                    className="h-10 rounded-2xl lg:hidden"
                                    onClick={() => setFiltersOpenMobile((v) => !v)}
                                >
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Filters
                                    {filtersOpenMobile ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* KPI Row */}
                    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <KpiCard title="Total" value={quick.total} badge="Cases" tone="violet" hint="Across your search result" />
                        <KpiCard title="Open" value={quick.open} badge="Active" tone="blue" hint="Needs billing actions" />
                        <KpiCard title="Ready" value={quick.ready} badge="Posting" tone="amber" hint="Verify & post" />
                        <KpiCard title="Closed" value={quick.closed} badge="Done" tone="green" hint="Completed cases" />
                        <KpiCard title="Cancelled" value={quick.cancelled} badge="Stop" tone="rose" hint="No longer valid" />
                    </div>
                </div>
            </div>

            {/* Filters (desktop always, mobile collapsible) */}
            <div className={cn("mb-4", "lg:block", filtersOpenMobile ? "block" : "hidden lg:block")}>
                <Card className="overflow-hidden">
                    <CardHeader
                        title="Search & Filters"
                        subtitle="Narrow down results with smart filters — built for speed."
                        right={
                            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
                                <Filter className="h-4 w-4" />
                                Tip: Use date range for end-of-day posting
                            </div>
                        }
                    />
                    <CardBody>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                            {/* Search */}
                            <div className="lg:col-span-5">
                                <Field label="Search (Case / Patient / UHID / Phone / Encounter ID)">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="h-11 rounded-2xl pl-9"
                                            placeholder="Type & pause… (debounced)"
                                            value={qInput}
                                            onChange={(e) => setQInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") setFilter("q", (qInput || "").trim())
                                                if (e.key === "Escape") setQInput("")
                                            }}
                                        />
                                        {qInput ? (
                                            <button
                                                type="button"
                                                className="absolute right-2 top-2.5 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                                onClick={() => setQInput("")}
                                                aria-label="Clear search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </div>
                                </Field>
                            </div>

                            {/* Encounter */}
                            <div className="lg:col-span-2">
                                <Field label="Encounter Type">
                                    <Select
                                        className="h-11 rounded-2xl"
                                        value={filters.encounter_type}
                                        onChange={(e) => setFilter("encounter_type", e.target.value)}
                                    >
                                        {ENCOUNTERS.map((e) => (
                                            <option key={e} value={e}>
                                                {e}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>

                            {/* Status */}
                            <div className="lg:col-span-2">
                                <Field label="Status">
                                    <Select className="h-11 rounded-2xl" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                                        {CASE_STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>

                            {/* Payer */}
                            <div className="lg:col-span-3">
                                <Field label="Payer Mode">
                                    <Select className="h-11 rounded-2xl" value={filters.payer_mode} onChange={(e) => setFilter("payer_mode", e.target.value)}>
                                        {PAYERS.map((p) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>

                            {/* Date from/to */}
                            <div className="lg:col-span-3">
                                <Field label="From (Date)">
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="h-11 rounded-2xl pl-9"
                                            type="date"
                                            value={filters.date_from}
                                            onChange={(e) => setFilter("date_from", e.target.value)}
                                        />
                                    </div>
                                </Field>
                            </div>

                            <div className="lg:col-span-3">
                                <Field label="To (Date)">
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="h-11 rounded-2xl pl-9"
                                            type="date"
                                            value={filters.date_to}
                                            onChange={(e) => setFilter("date_to", e.target.value)}
                                        />
                                    </div>
                                </Field>
                            </div>

                            {/* Page size */}
                            <div className="lg:col-span-2">
                                <Field label="Page Size">
                                    <Select className="h-11 rounded-2xl" value={filters.page_size} onChange={(e) => setFilter("page_size", e.target.value)}>
                                        {[10, 20, 30, 50, 100].map((n) => (
                                            <option key={n} value={n}>
                                                {n} / page
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>

                            {/* Quick presets */}
                            <div className="lg:col-span-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="text-xs font-bold text-slate-700">Quick Presets</div>
                                        <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                            <Sparkles className="h-3.5 w-3.5" /> 1-click filters
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <PresetChip active={filters.status === "OPEN"} onClick={() => setFilter("status", "OPEN")}>
                                            OPEN
                                        </PresetChip>
                                        <PresetChip active={String(filters.status).includes("READY")} onClick={() => setFilter("status", "READY_FOR_POST")}>
                                            READY
                                        </PresetChip>
                                        <PresetChip active={filters.encounter_type === "OP"} onClick={() => setFilter("encounter_type", "OP")}>
                                            OP
                                        </PresetChip>
                                        <PresetChip active={filters.encounter_type === "IP"} onClick={() => setFilter("encounter_type", "IP")}>
                                            IP
                                        </PresetChip>
                                        <PresetChip
                                            active={filters.payer_mode === "INSURANCE"}
                                            onClick={() => setFilter("payer_mode", "INSURANCE")}
                                        >
                                            INSURANCE
                                        </PresetChip>
                                        <PresetChip
                                            active={filters.date_from === toISODate(new Date()) && filters.date_to === toISODate(new Date())}
                                            onClick={() => {
                                                const today = toISODate(new Date())
                                                setFilter("date_from", today)
                                                setFilter("date_to", today)
                                            }}
                                        >
                                            TODAY
                                        </PresetChip>
                                        <PresetChip onClick={clearAllFilters}>RESET</PresetChip>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile helper row */}
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs text-slate-500">
                                Showing page <b>{meta.page}</b> · Total <b>{meta.total}</b>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="slate" className="inline-flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" />
                                    Audit-friendly tracking
                                </Badge>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Cases Table */}
            <Card className="overflow-hidden">
                <CardHeader title="Billing Cases" subtitle="Open a case to manage invoices, payments, advances and posting." />
                <CardBody>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <EmptyState
                            title="No billing cases found"
                            desc="Try changing filters, or create a new billing case."
                            right={
                                <Button onClick={() => setOpenCreate(true)}>
                                    <Plus className="h-4 w-4" /> Create Case
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1100px] text-left text-sm">
                                <thead className="text-xs font-bold text-slate-600">
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        <th className="py-3 pl-2 pr-4">Case</th>
                                        <th className="py-3 pr-4">Patient</th>
                                        <th className="py-3 pr-4">Encounter</th>
                                        <th className="py-3 pr-4">Payer</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-0 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const status = String(r.status || "").toUpperCase()
                                        const payer = String(r.payer_mode || "SELF").toUpperCase()
                                        return (
                                            <tr
                                                key={r.id}
                                                className="group border-b border-slate-50 hover:bg-slate-50/60"
                                            >
                                                <td className="py-3 pl-2 pr-4 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <div
                                                            className={cn(
                                                                "mt-0.5 h-9 w-9 rounded-2xl border bg-white shadow-sm",
                                                                status.includes("READY")
                                                                    ? "border-amber-200"
                                                                    : status === "OPEN"
                                                                        ? "border-blue-200"
                                                                        : status === "CLOSED"
                                                                            ? "border-emerald-200"
                                                                            : status === "CANCELLED"
                                                                                ? "border-rose-200"
                                                                                : "border-slate-200"
                                                            )}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="truncate font-extrabold text-slate-900">
                                                                {r.case_number || `#${r.id}`}
                                                            </div>
                                                            <div className="mt-0.5 text-xs text-slate-500">
                                                                Case ID: <span className="font-semibold text-slate-700">{r.id}</span>
                                                                {r.created_at ? (
                                                                    <>
                                                                        {" "}
                                                                        · Created: <span className="font-semibold text-slate-700">{formatDT(r.created_at)}</span>
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="py-3 pr-4 align-top">
                                                    <div className="font-semibold text-slate-800">{r.patient_name || "—"}</div>
                                                    <div className="text-xs text-slate-500">
                                                        UHID: <span className="font-semibold text-slate-700">{r.uhid || "—"}</span>{" "}
                                                        · Phone: <span className="font-semibold text-slate-700">{r.phone || "—"}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Patient ID: <span className="font-semibold text-slate-700">{r.patient_id ?? "—"}</span>
                                                    </div>
                                                </td>

                                                <td className="py-3 pr-4 align-top">
                                                    <div className="font-semibold text-slate-800">
                                                        {r.encounter_type || "—"} / {r.encounter_id ?? "—"}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Tariff: <span className="font-semibold text-slate-700">{r.tariff_plan_id ?? "—"}</span>
                                                    </div>
                                                    {r.encounter_at ? (
                                                        <div className="text-xs text-slate-500">
                                                            At: <span className="font-semibold text-slate-700">{formatDT(r.encounter_at)}</span>
                                                        </div>
                                                    ) : null}
                                                </td>

                                                <td className="py-3 pr-4 align-top">
                                                    <Badge tone="slate" className="capitalize">
                                                        {payer}
                                                    </Badge>
                                                </td>

                                                <td className="py-3 pr-4 align-top">
                                                    <div className="flex items-center gap-2">
                                                        <Badge tone={toneForStatus(r.status)} className="uppercase">
                                                            {status || "—"}
                                                        </Badge>
                                                        <StatusBadge status={r.status} />
                                                    </div>
                                                </td>

                                                <td className="py-3 pr-0 text-right align-top">
                                                    <Button
                                                        variant="outline"
                                                        className="h-10 rounded-2xl"
                                                        onClick={() => nav(`/billing/cases/${r.id}`)}
                                                    >
                                                        Open
                                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs text-slate-500">
                                    Showing page <b>{meta.page}</b> · Total <b>{meta.total}</b>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-2xl"
                                        disabled={meta.page <= 1}
                                        onClick={() => setFilter("page", Math.max(1, meta.page - 1))}
                                    >
                                        Prev
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-2xl"
                                        disabled={disableNext}
                                        onClick={() => setFilter("page", meta.page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Manual Create Case Modal */}
            {openCreate && (
                <CreateCaseModal
                    onClose={() => setOpenCreate(false)}
                    onCreated={(caseId) => {
                        setOpenCreate(false)
                        load()
                        nav(`/billing/cases/${caseId}`)
                    }}
                    onOpenExisting={(caseId) => {
                        setOpenCreate(false)
                        nav(`/billing/cases/${caseId}`)
                    }}
                />
            )}
        </div>
    )
}

function KpiCard({ title, value, badge, tone, hint }) {
    return (
        <Card className="overflow-hidden">
            <CardBody className="relative flex items-center justify-between">
                <div>
                    <div className="text-xs text-slate-500">{title}</div>
                    <div className="text-lg font-extrabold text-slate-900 sm:text-xl">{value}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
                </div>
                <Badge tone={tone}>{badge}</Badge>
            </CardBody>
        </Card>
    )
}

function PresetChip({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition",
                active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    )
}

function CreateCaseModal({ onClose, onCreated, onOpenExisting }) {
    const [step, setStep] = useState(1)

    // Patient search
    const [pq, setPq] = useState("")
    const [pLoading, setPLoading] = useState(false)
    const [patients, setPatients] = useState([])
    const [patient, setPatient] = useState(null)

    // Encounter
    const [etype, setEtype] = useState("OP")
    const [eLoading, setELoading] = useState(false)
    const [encounters, setEncounters] = useState([])
    const [encounterId, setEncounterId] = useState(null)

    const pAbort = useRef(null)
    const eAbort = useRef(null)
    const debounceRef = useRef(null)

    // ESC to close
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") onClose?.()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
            const q = (pq || "").trim()
            if (q.length < 2) {
                setPatients([])
                return
            }
            pAbort.current?.abort?.()
            const ac = new AbortController()
            pAbort.current = ac

            setPLoading(true)
            try {
                const data = await billingSearchPatients({ q, limit: 20 }, { signal: ac.signal })
                setPatients(data?.items ?? [])
            } catch (e) {
                if (!isCanceledError(e)) toast.error(e?.message || "Failed to search patients")
            } finally {
                setPLoading(false)
            }
        }, 300)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [pq])

    async function loadEncounters(pid, t) {
        if (!pid || !t) return
        eAbort.current?.abort?.()
        const ac = new AbortController()
        eAbort.current = ac

        setELoading(true)
        setEncounters([])
        setEncounterId(null)

        try {
            const data = await billingListPatientEncounters(pid, { encounter_type: t, limit: 100 }, { signal: ac.signal })
            setEncounters(data?.items ?? [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load encounters")
        } finally {
            setELoading(false)
        }
    }

    useEffect(() => {
        if (patient?.id && etype) loadEncounters(patient.id, etype)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patient?.id, etype])

    async function proceedCreate() {
        if (!patient?.id || !etype || !encounterId) return
        try {
            const res = await billingCreateCaseManual({
                patient_id: patient.id,
                encounter_type: etype,
                encounter_id: Number(encounterId),
            })

            const newId = res?.id || res?.case_id || res?.case?.id
            toast.success("Billing case created")
            onCreated?.(newId)
        } catch (e) {
            const detail = safeApiDetail(e)

            if (e?.response?.status === 409 && detail && typeof detail === "object") {
                const caseId = detail?.case_id
                const msg = detail?.message || "The selected patient and encounter based Case Already available."
                toast(msg, {
                    action: caseId
                        ? { label: "Open Case", onClick: () => onOpenExisting?.(caseId) }
                        : undefined,
                })
                return
            }

            toast.error(e?.message || "Failed to create case")
        }
    }

    const stepTitle = step === 1 ? "Select Patient" : "Select Encounter"
    const progress = step === 1 ? "Step 1 of 2" : "Step 2 of 2"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
            <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                {/* Top bar */}
                <div className="relative overflow-hidden border-b border-slate-100">
                    <div className="absolute inset-0 bg-[radial-gradient(900px_260px_at_10%_-10%,rgba(99,102,241,0.14),transparent_55%),radial-gradient(700px_220px_at_95%_0%,rgba(16,185,129,0.10),transparent_45%)]" />
                    <div className="relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <Sparkles className="h-4 w-4 text-slate-800" />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-extrabold text-slate-900 sm:text-base">
                                        Create New Billing Case
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        {progress} · {stepTitle}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="h-10 rounded-2xl" onClick={onClose}>
                                <X className="h-4 w-4" /> Close
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                    {/* Left: Patient */}
                    <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-extrabold text-slate-900">1) Patient</div>
                            <Badge tone="slate">Manual</Badge>
                        </div>

                        {patient ? (
                            <Card className="border border-emerald-100">
                                <CardBody className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <div className="font-extrabold text-slate-900">{patient.name || "—"}</div>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        UHID: <span className="font-semibold text-slate-700">{patient.uhid || "—"}</span> · Phone:{" "}
                                        <span className="font-semibold text-slate-700">{patient.phone || "—"}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Patient ID: <span className="font-semibold text-slate-700">{patient.id}</span>
                                    </div>
                                    <div className="pt-3">
                                        <Button
                                            variant="outline"
                                            className="h-10 rounded-2xl"
                                            onClick={() => {
                                                setPatient(null)
                                                setStep(1)
                                                setEncounters([])
                                                setEncounterId(null)
                                                setPq("")
                                                setPatients([])
                                            }}
                                        >
                                            Change Patient
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        ) : (
                            <>
                                <Field label="Search Patient (name / UHID / phone)">
                                    <Input
                                        className="h-11 rounded-2xl"
                                        value={pq}
                                        onChange={(e) => setPq(e.target.value)}
                                        placeholder="Type minimum 2 characters..."
                                        autoFocus
                                    />
                                </Field>

                                <div className="mt-3">
                                    {pLoading ? (
                                        <div className="space-y-2">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="h-11 animate-pulse rounded-2xl bg-slate-100" />
                                            ))}
                                        </div>
                                    ) : patients.length === 0 ? (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                                            <div className="flex items-center gap-2 font-bold text-slate-800">
                                                <Search className="h-4 w-4" /> Start typing to find patients
                                            </div>
                                            <div className="mt-1">Tip: UHID / phone gives quickest matches.</div>
                                        </div>
                                    ) : (
                                        <div className="max-h-[22rem] overflow-auto rounded-2xl border border-slate-200 bg-white">
                                            {patients.map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setPatient(p)
                                                        setStep(2)
                                                    }}
                                                    className="flex w-full items-start justify-between gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-extrabold text-slate-900">{p.name || "—"}</div>
                                                        <div className="text-xs text-slate-500">
                                                            UHID: <span className="font-semibold text-slate-700">{p.uhid || "—"}</span> · Phone:{" "}
                                                            <span className="font-semibold text-slate-700">{p.phone || "—"}</span>
                                                        </div>
                                                    </div>
                                                    <Badge tone="violet">Select</Badge>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Encounter */}
                    <div className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-extrabold text-slate-900">2) Encounter</div>
                            <Badge tone="slate">{patient ? "Patient Selected" : "Waiting"}</Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <Field label="Encounter Type">
                                <Select
                                    className="h-11 rounded-2xl"
                                    value={etype}
                                    onChange={(e) => setEtype(e.target.value)}
                                    disabled={!patient}
                                >
                                    {MANUAL_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </Select>
                            </Field>

                            <Field label="Encounter IDs (with Date & Time)">
                                <div className={cn("rounded-2xl border border-slate-200 bg-white p-2", !patient ? "opacity-60" : "")}>
                                    {!patient ? (
                                        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Select a patient first.</div>
                                    ) : eLoading ? (
                                        <div className="space-y-2">
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <div key={i} className="h-11 animate-pulse rounded-2xl bg-slate-100" />
                                            ))}
                                        </div>
                                    ) : encounters.length === 0 ? (
                                        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                                            No encounters found for this patient and type.
                                        </div>
                                    ) : (
                                        <div className="max-h-[22rem] overflow-auto">
                                            {encounters.map((e) => {
                                                const selected = String(encounterId) === String(e.encounter_id)
                                                return (
                                                    <button
                                                        key={String(e.encounter_id)}
                                                        type="button"
                                                        onClick={() => setEncounterId(e.encounter_id)}
                                                        className={cn(
                                                            "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition",
                                                            selected ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-extrabold text-slate-900">
                                                                {etype} / {e.encounter_id}
                                                            </div>
                                                            <div className="text-xs text-slate-500">{formatDT(e.encounter_at)}</div>
                                                        </div>
                                                        <div className={cn("text-xs font-semibold", selected ? "text-emerald-700" : "text-slate-400")}>
                                                            {selected ? "Selected" : "Select"}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </Field>

                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                                <Button variant="outline" className="h-10 rounded-2xl" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    className="h-10 rounded-2xl"
                                    onClick={proceedCreate}
                                    disabled={!patient?.id || !etype || !encounterId}
                                >
                                    Proceed & Create Case
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                Note: If a case already exists for the selected encounter, system will block duplicate and show “Open Case”.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
