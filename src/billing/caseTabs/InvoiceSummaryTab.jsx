// FILE: src/billing/caseTabs/InvoiceSummaryTab.jsx
import { useMemo, useState } from "react"
import {
    Filter,
    Search,
    ChevronDown,
    ChevronUp,
    SlidersHorizontal,
    ArrowDownUp,
    Receipt,
    ExternalLink,
} from "lucide-react"

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
    cn,
    money,
} from "../_ui"

import { GROUP_BY, INVOICE_STATUSES, fmtDate } from "./shared"

function safe(v) {
    const s = String(v ?? "").trim()
    return s ? s : "—"
}

function toneStatus(st) {
    const s = String(st || "").toUpperCase()
    if (["POSTED", "PAID"].includes(s)) return "green"
    if (["APPROVED"].includes(s)) return "blue"
    if (["DRAFT"].includes(s)) return "amber"
    if (["VOID", "CANCELLED"].includes(s)) return "red"
    return "slate"
}

function toneModule(mod) {
    const m = String(mod || "").toUpperCase()
    if (["PHARM", "PHARMACY", "DRUGS"].includes(m)) return "purple"
    if (["LAB", "LIS"].includes(m)) return "blue"
    if (["RAD", "RIS", "RADIOLOGY"].includes(m)) return "indigo"
    if (["ROOM", "IPD", "BED"].includes(m)) return "amber"
    if (["PROC", "OT", "SURG"].includes(m)) return "green"
    return "slate"
}

function Chip({ tone = "slate", children }) {
    return (
        <Badge tone={tone} className="whitespace-nowrap">
            {children}
        </Badge>
    )
}

function SummaryStat({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-base font-black text-slate-900">{value}</div>
        </div>
    )
}

function ItemRow({ it, onOpenInvoice }) {
    const invLabel = it?.invoice_number ? String(it.invoice_number) : "Invoice"
    const desc = safe(it?.description)
    const meta = [
        it?.item_code ? `Code: ${it.item_code}` : null,
        it?.service_date ? fmtDate(it.service_date) : null,
        it?.module ? String(it.module).toUpperCase() : null,
        it?.service_group ? String(it.service_group).toUpperCase() : null,
        it?.is_manual === true ? "Manual" : it?.is_manual === false ? "Auto" : null,
    ].filter(Boolean)

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{desc}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        {meta.length ? meta.map((m, idx) => <span key={idx} className="truncate">{m}</span>) : <span>—</span>}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Chip tone="slate">Qty: {safe(it?.qty)}</Chip>
                        <Chip tone="slate">Rate: ₹ {money(it?.unit_price)}</Chip>
                        <Chip tone="slate">Dis: ₹ {money(it?.discount_amount)}</Chip>
                        <Chip tone="slate">GST: {safe(it?.gst_rate)}%</Chip>
                        <Chip tone="slate">Tax: ₹ {money(it?.tax_amount)}</Chip>
                        <Chip tone="blue">Net: ₹ {money(it?.net_amount)}</Chip>
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <div className="flex flex-col items-end gap-2">
                        <Chip tone={toneStatus(it?.invoice_status)}>{safe(it?.invoice_status)}</Chip>

                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => onOpenInvoice(it?.invoice_id)}
                            disabled={!it?.invoice_id}
                        >
                            <Receipt className="h-4 w-4" />
                            <span className="hidden sm:inline">{invLabel}</span>
                            <span className="sm:hidden">Open</span>
                            <ExternalLink className="h-4 w-4 text-slate-400" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function GroupCard({ g, open, onToggle, onOpenInvoice }) {
    const label = safe(g?.label || g?.key)
    const count = Number(g?.count || (g?.items || []).length || 0)
    const total = Number(g?.total || 0)

    // tiny insights (optional)
    const statusCounts = useMemo(() => {
        const m = {}
        for (const it of g?.items || []) {
            const st = String(it?.invoice_status || "—").toUpperCase()
            m[st] = (m[st] || 0) + 1
        }
        return m
    }, [g])

    const topStatuses = useMemo(() => {
        const arr = Object.entries(statusCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
        return arr
    }, [statusCounts])

    return (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* header */}
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate" className="whitespace-nowrap">
                            {label}
                        </Badge>
                        <Badge tone="blue" className="whitespace-nowrap">
                            {count} items
                        </Badge>
                        <div className="flex flex-wrap items-center gap-2">
                            {topStatuses.map(([st, n]) => (
                                <Badge key={st} tone={toneStatus(st)} className="whitespace-nowrap">
                                    {st}: {n}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                        Group total and line details
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <div className="text-right">
                        <div className="text-base font-black text-slate-900">₹ {money(total)}</div>
                        <div className="text-[11px] font-bold text-slate-500">Group Total</div>
                    </div>

                    <Button variant="outline" onClick={onToggle} className="gap-2">
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {open ? "Hide" : "Details"}
                    </Button>
                </div>
            </div>

            {/* body */}
            {open ? (
                <div className="p-4">
                    <div className="grid grid-cols-1 gap-2">
                        {(g?.items || []).map((it) => (
                            <ItemRow key={it?.id || `${it?.invoice_id}-${it?.item_code}-${it?.net_amount}`} it={it} onOpenInvoice={onOpenInvoice} />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default function InvoiceSummaryTab({ loading, data, onFetch, onOpenInvoice }) {
    const [filters, setFilters] = useState({
        group_by: "module",
        module: "",
        status: "",
        service_group: "",
        q: "",
        from_date: "",
        to_date: "",
        is_manual: "",
        min_net: "",
        max_net: "",
    })

    const [showFilters, setShowFilters] = useState(false)
    const [expanded, setExpanded] = useState({}) // groupKey -> boolean

    const groups = data?.groups || []
    const netTotal = data?.totals?.net_total ?? "0"

    const activeChips = useMemo(() => {
        const chips = []
        chips.push({ t: "slate", v: `Group: ${safe(filters.group_by)}` })
        if (filters.module) chips.push({ t: toneModule(filters.module), v: `Module: ${filters.module}` })
        if (filters.status) chips.push({ t: toneStatus(filters.status), v: `Status: ${filters.status}` })
        if (filters.service_group) chips.push({ t: "slate", v: `Svc: ${filters.service_group}` })
        if (filters.is_manual) chips.push({ t: "slate", v: filters.is_manual === "true" ? "Manual" : "Auto" })
        if (filters.from_date || filters.to_date) chips.push({ t: "slate", v: `Date: ${filters.from_date || "—"} → ${filters.to_date || "—"}` })
        if (filters.min_net || filters.max_net) chips.push({ t: "slate", v: `Net: ${filters.min_net || "0"} → ${filters.max_net || "∞"}` })
        if (filters.q) chips.push({ t: "slate", v: `Search: ${filters.q}` })
        return chips
    }, [filters])

    function apply() {
        onFetch({
            group_by: filters.group_by,
            module: filters.module,
            status: filters.status,
            service_group: filters.service_group,
            q: filters.q,
            from_date: filters.from_date,
            to_date: filters.to_date,
            is_manual: filters.is_manual === "" ? undefined : filters.is_manual === "true",
            min_net: filters.min_net || undefined,
            max_net: filters.max_net || undefined,
        })
    }

    function reset() {
        const x = {
            group_by: "module",
            module: "",
            status: "",
            service_group: "",
            q: "",
            from_date: "",
            to_date: "",
            is_manual: "",
            min_net: "",
            max_net: "",
        }
        setFilters(x)
        setExpanded({})
        onFetch({ group_by: "module" })
    }

    function toggleGroup(key) {
        setExpanded((s) => ({ ...s, [key]: !s[key] }))
    }

    return (
        <Card>
            <CardHeader
                title="Invoice Summary"
                subtitle="Grouped invoice lines with smart filters"
                right={
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">Net Total: ₹ {money(netTotal)}</Badge>
                        <Button variant="outline" onClick={reset}>Reset</Button>
                        <Button onClick={apply} className="gap-2">
                            <Filter className="h-4 w-4" />
                            Apply
                        </Button>
                    </div>
                }
            />

            <CardBody className="space-y-4">
                {/* compact header row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {activeChips.slice(0, 6).map((c, idx) => (
                            <Chip key={idx} tone={c.t}>{c.v}</Chip>
                        ))}
                        {activeChips.length > 6 ? <Chip tone="slate">+{activeChips.length - 6} more</Chip> : null}
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters((s) => !s)}
                            className="gap-2"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            {showFilters ? "Hide Filters" : "Show Filters"}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => {
                                // expand top 3 groups quickly
                                const next = {}
                                for (const g of (groups || []).slice(0, 3)) next[g.key] = true
                                setExpanded((s) => ({ ...next, ...s }))
                            }}
                            className="gap-2"
                            disabled={!groups?.length}
                        >
                            <ArrowDownUp className="h-4 w-4" />
                            Expand Top
                        </Button>
                    </div>
                </div>

                {/* filters panel */}
                {showFilters ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                            <Field label="Group By">
                                <Select
                                    value={filters.group_by}
                                    onChange={(e) => setFilters({ ...filters, group_by: e.target.value })}
                                >
                                    {GROUP_BY.map((g) => (
                                        <option key={g.value} value={g.value}>{g.label}</option>
                                    ))}
                                </Select>
                            </Field>

                            <Field label="Module">
                                <Input
                                    placeholder="LAB / ROOM / PHM"
                                    value={filters.module}
                                    onChange={(e) => setFilters({ ...filters, module: e.target.value.toUpperCase() })}
                                />
                            </Field>

                            <Field label="Invoice Status">
                                <Select
                                    value={filters.status || "ALL"}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value === "ALL" ? "" : e.target.value })}
                                >
                                    {INVOICE_STATUSES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </Select>
                            </Field>

                            <Field label="Search (Item/Code)">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="paracetamol / CBC / bed"
                                        value={filters.q}
                                        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                                    />
                                </div>
                            </Field>

                            <Field label="From Date">
                                <Input type="date" value={filters.from_date} onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} />
                            </Field>

                            <Field label="To Date">
                                <Input type="date" value={filters.to_date} onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} />
                            </Field>

                            <Field label="Manual?">
                                <Select value={filters.is_manual} onChange={(e) => setFilters({ ...filters, is_manual: e.target.value })}>
                                    <option value="">ALL</option>
                                    <option value="true">Manual</option>
                                    <option value="false">Auto</option>
                                </Select>
                            </Field>

                            <Field label="Min Net">
                                <Input inputMode="decimal" placeholder="0" value={filters.min_net} onChange={(e) => setFilters({ ...filters, min_net: e.target.value })} />
                            </Field>

                            <Field label="Max Net">
                                <Input inputMode="decimal" placeholder="0" value={filters.max_net} onChange={(e) => setFilters({ ...filters, max_net: e.target.value })} />
                            </Field>

                            <Field label="Service Group">
                                <Input
                                    placeholder="LAB / PHARMACY / ROOM"
                                    value={filters.service_group}
                                    onChange={(e) => setFilters({ ...filters, service_group: e.target.value.toUpperCase() })}
                                />
                            </Field>
                        </div>
                    </div>
                ) : null}

                {/* top stats */}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <SummaryStat label="Groups" value={String(groups?.length || 0)} />
                    <SummaryStat label="Net Total" value={`₹ ${money(netTotal)}`} />
                    <SummaryStat label="Applied Status" value={filters.status ? safe(filters.status) : "ALL"} />
                    <SummaryStat label="Applied Module" value={filters.module ? safe(filters.module) : "ALL"} />
                </div>

                {/* content */}
                {loading ? (
                    <div className="h-56 animate-pulse rounded-3xl bg-slate-100" />
                ) : groups.length === 0 ? (
                    <EmptyState title="No invoice lines" desc="No items match your filters. Try reset." />
                ) : (
                    <div className="space-y-3">
                        {groups.map((g) => (
                            <GroupCard
                                key={g.key}
                                g={g}
                                open={!!expanded[g.key]}
                                onToggle={() => toggleGroup(g.key)}
                                onOpenInvoice={onOpenInvoice}
                            />
                        ))}
                    </div>
                )}
            </CardBody>
        </Card>
    )
}
