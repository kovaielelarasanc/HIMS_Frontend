// FILE: src/billing/BillingCaseDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
    billingGetCase,
    billingGetInsurance,
    billingListAdvances,
    billingListInvoices,
    billingListPayments,
    billingRecordAdvance,
    billingRecordPayment,
    billingCaseDashboard,
    billingCaseInvoiceSummary,
    billingMetaPayers,
    billingMetaReferrers,
    billingGetCaseSettings,
    billingUpdateCaseSettings,
    isCanceledError,
} from "@/api/billings"
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
    money,
    Textarea,
} from "./_ui"
import {
    ArrowLeft,
    FilePlus2,
    IndianRupee,
    RefreshCcw,
    Wallet,
    Shield,
    CreditCard,
    Layers,
    Filter,
    Search,
    Settings,
    ListChecks,
} from "lucide-react"

const cx = (...a) => a.filter(Boolean).join(" ")

const TABS = [
    { key: "OVERVIEW", label: "Overview", icon: Layers },
    { key: "INVOICE_SUMMARY", label: "Invoice Summary", icon: ListChecks },
    { key: "ADD_ITEM", label: "Add Item Line", icon: FilePlus2 },
    { key: "INVOICES", label: "Invoices", icon: Layers },
    { key: "PAYMENTS", label: "Payments", icon: CreditCard },
    { key: "ADVANCES", label: "Advances", icon: Wallet },
    { key: "INSURANCE", label: "Insurance", icon: Shield },
    { key: "SETTINGS", label: "Bill Type & Referral", icon: Settings },
]

const PAYMENT_MODES = ["CASH", "CARD", "UPI", "BANK", "WALLET"]
const ADV_TYPES = ["ADVANCE", "REFUND", "ADJUSTMENT"]

const INVOICE_STATUSES = ["ALL", "DRAFT", "APPROVED", "POSTED", "VOID"]
const GROUP_BY = [
    { value: "module", label: "Group by Module" },
    { value: "service_group", label: "Group by Service Group" },
    { value: "invoice", label: "Group by Invoice" },
]

export default function BillingCaseDetail() {
    const { caseId } = useParams()
    const nav = useNavigate()

    const [tab, setTab] = useState("OVERVIEW")
    const [loading, setLoading] = useState(true)

    const [caseRow, setCaseRow] = useState(null)
    const [invoices, setInvoices] = useState([])
    const [payments, setPayments] = useState([])
    const [advances, setAdvances] = useState([])
    const [insurance, setInsurance] = useState(null)

    // overview dashboard
    const [dashLoading, setDashLoading] = useState(false)
    const [dashboard, setDashboard] = useState(null)

    // invoice summary
    const [sumLoading, setSumLoading] = useState(false)
    const [summary, setSummary] = useState(null)

    // settings meta
    const [metaLoading, setMetaLoading] = useState(false)
    const [payerMeta, setPayerMeta] = useState({ payers: [], tpas: [], credit_plans: [] })
    const [refMeta, setRefMeta] = useState({ items: [] })
    const [settings, setSettings] = useState({
        payer_mode: "SELF",
        default_payer_type: "",
        default_payer_id: "",
        default_tpa_id: "",
        default_credit_plan_id: "",
        referral_user_id: "",
        referral_notes: "",
    })
    const [savingSettings, setSavingSettings] = useState(false)

    const abortRef = useRef(null)

    async function loadAll() {
        abortRef.current?.abort?.()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const c = await billingGetCase(caseId, { signal: ac.signal })
            setCaseRow(c)

            const [inv, pay, adv] = await Promise.all([
                billingListInvoices(caseId, {}, { signal: ac.signal }),
                billingListPayments(caseId, {}, { signal: ac.signal }),
                billingListAdvances(caseId, {}, { signal: ac.signal }),
            ])

            const norm = (x) => (Array.isArray(x) ? x : x?.items ?? x?.results ?? x?.data ?? [])
            setInvoices(norm(inv))
            setPayments(norm(pay))
            setAdvances(norm(adv))

            try {
                const ins = await billingGetInsurance(caseId, { signal: ac.signal })
                const insObj = ins?.insurance ?? ins?.data?.insurance ?? ins?.data ?? ins
                setInsurance(insObj || null)
            } catch {
                setInsurance(null)
            }
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load billing case")
        } finally {
            setLoading(false)
        }
    }

    async function loadDashboard() {
        setDashLoading(true)
        try {
            const d = await billingCaseDashboard(caseId)
            setDashboard(d)
        } catch (e) {
            toast.error(e?.message || "Failed to load overview")
        } finally {
            setDashLoading(false)
        }
    }

    async function loadSummary(params) {
        setSumLoading(true)
        try {
            const s = await billingCaseInvoiceSummary(caseId, params)
            setSummary(s)
        } catch (e) {
            toast.error(e?.message || "Failed to load invoice summary")
        } finally {
            setSumLoading(false)
        }
    }

    async function loadSettingsMeta() {
        setMetaLoading(true)
        try {
            const [pm, rm, cs] = await Promise.all([
                billingMetaPayers({ q: "" }),
                billingMetaReferrers({ q: "", limit: 60 }),
                billingGetCaseSettings(caseId),
            ])
            setPayerMeta(pm || { payers: [], tpas: [], credit_plans: [] })
            setRefMeta(rm || { items: [] })

            setSettings({
                payer_mode: cs?.payer_mode || caseRow?.payer_mode || "SELF",
                default_payer_type: cs?.default_payer_type || "",
                default_payer_id: cs?.default_payer_id ? String(cs.default_payer_id) : "",
                default_tpa_id: cs?.default_tpa_id ? String(cs.default_tpa_id) : "",
                default_credit_plan_id: cs?.default_credit_plan_id ? String(cs.default_credit_plan_id) : "",
                referral_user_id: cs?.referral_user_id ? String(cs.referral_user_id) : "",
                referral_notes: cs?.referral_notes || "",
            })
        } catch (e) {
            toast.error(e?.message || "Failed to load settings meta")
        } finally {
            setMetaLoading(false)
        }
    }

    useEffect(() => {
        loadAll()
        return () => abortRef.current?.abort?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    useEffect(() => {
        if (tab === "OVERVIEW" && !dashboard) loadDashboard()
        if (tab === "INVOICE_SUMMARY" && !summary) {
            // default summary
            loadSummary({ group_by: "module", status: "" })
        }
        if (tab === "SETTINGS") loadSettingsMeta()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab])

    const patientName = caseRow?.patient_name || "—"
    const uhid = caseRow?.uhid || "—"
    const phone = caseRow?.phone || "—"

    const headerTitle = useMemo(() => {
        const no = caseRow?.case_number || `#${caseRow?.id ?? ""}`
        const enc = `${caseRow?.encounter_type || "—"} / ${caseRow?.encounter_id ?? "—"}`
        return `${no} · ${enc}`
    }, [caseRow])

    const totals = useMemo(() => {
        const safeInvoices = invoices.filter((i) => String(i.status || "").toUpperCase() !== "VOID")

        const totalBilled = safeInvoices.reduce((s, i) => s + Number(i.grand_total ?? 0), 0)
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)

        const advanceBalance = advances.reduce((s, a) => {
            const t = String(a.entry_type || "ADVANCE").toUpperCase()
            const amt = Number(a.amount ?? 0)
            if (t === "REFUND") return s - amt
            if (t === "ADJUSTMENT") return s - amt
            return s + amt
        }, 0)

        const net = totalBilled - totalPaid - Math.max(0, advanceBalance)
        const due = Math.max(0, net)
        const credit = Math.max(0, -net)

        return { totalBilled, totalPaid, advanceBalance, due, credit }
    }, [invoices, payments, advances])

    const payableInvoices = useMemo(() => {
        return invoices
            .filter((i) => ["APPROVED", "POSTED"].includes(String(i.status || "").toUpperCase()))
            .sort((a, b) => Number(b.id) - Number(a.id))
    }, [invoices])

    return (
        <div className="w-full">
            {/* Top bar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <Button variant="outline" onClick={() => nav("/billing")}>
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>

                    <div>
                        <div className="text-xl font-extrabold text-slate-900">Billing Case</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-800">{headerTitle}</span>
                            <StatusBadge status={caseRow?.status} />
                            <Badge tone="slate">{caseRow?.payer_mode || "SELF"}</Badge>
                            <span>· Patient: {patientName}</span>
                            <span className="text-slate-400">·</span>
                            <span>UHID: {uhid}</span>
                            <span className="text-slate-400">·</span>
                            <span>Phone: {phone}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => { loadAll(); loadDashboard(); }} disabled={loading}>
                        <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                        Refresh
                    </Button>

                    <Button onClick={() => nav(`/billing/cases/${caseId}/add-item`)} className="gap-2">
                        <FilePlus2 size={16} />
                        Add Item Line
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard title="Billed" value={`₹ ${money(totals.totalBilled)}`} icon={IndianRupee} />
                <StatCard title="Paid" value={`₹ ${money(totals.totalPaid)}`} icon={CreditCard} />
                <StatCard title="Advance Balance" value={`₹ ${money(totals.advanceBalance)}`} icon={Wallet} />
                <StatCard
                    title="Due"
                    value={`₹ ${money(totals.due)}`}
                    right={<Badge tone={totals.due > 0 ? "amber" : "green"}>{totals.due > 0 ? "Pending" : "Clear"}</Badge>}
                />
                <StatCard
                    title="Credit"
                    value={`₹ ${money(totals.credit)}`}
                    right={<Badge tone={totals.credit > 0 ? "blue" : "slate"}>{totals.credit > 0 ? "Available" : "—"}</Badge>}
                />
            </div>

            {/* Tabs */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                {TABS.map((t) => {
                    const Icon = t.icon
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                                "flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold transition",
                                tab === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {loading ? (
                <div className="space-y-3">
                    <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
                </div>
            ) : (
                <>
                    {tab === "OVERVIEW" && (
                        <OverviewTab
                            loading={dashLoading}
                            dashboard={dashboard}
                            caseRow={caseRow}
                            onReload={loadDashboard}
                        />
                    )}

                    {tab === "INVOICE_SUMMARY" && (
                        <InvoiceSummaryTab
                            loading={sumLoading}
                            data={summary}
                            onFetch={(p) => loadSummary(p)}
                            onOpenInvoice={(id) => nav(`/billing/invoices/${id}`)}
                        />
                    )}

                    {tab === "ADD_ITEM" && (
                        <Card>
                            <CardHeader title="Add Item Line" subtitle="Use smart particulars selection & automation in Add Item screen" />
                            <CardBody className="flex items-center justify-between">
                                <div className="text-sm text-slate-600">
                                    Add items by module (ROOM/LAB/RIS/PHARMACY/DOC/PROC etc.) with filters & checklist UI.
                                </div>
                                <Button onClick={() => nav(`/billing/cases/${caseId}/add-item`)} className="gap-2">
                                    <FilePlus2 className="h-4 w-4" />
                                    Open Add Item
                                </Button>
                            </CardBody>
                        </Card>
                    )}

                    {tab === "INVOICES" && (
                        <InvoicesTab
                            invoices={invoices}
                            onOpen={(id) => nav(`/billing/invoices/${id}`)}
                        />
                    )}

                    {tab === "PAYMENTS" && (
                        <PaymentsTab
                            caseId={caseId}
                            payments={payments}
                            invoices={payableInvoices}
                            onDone={loadAll}
                        />
                    )}

                    {tab === "ADVANCES" && (
                        <AdvancesTab
                            caseId={caseId}
                            advances={advances}
                            onDone={loadAll}
                        />
                    )}

                    {tab === "INSURANCE" && <InsuranceTab insurance={insurance} />}

                    {tab === "SETTINGS" && (
                        <SettingsTab
                            loading={metaLoading}
                            payerMeta={payerMeta}
                            refMeta={refMeta}
                            value={settings}
                            onChange={setSettings}
                            onReloadMeta={loadSettingsMeta}
                            onSave={async () => {
                                setSavingSettings(true)
                                try {
                                    await billingUpdateCaseSettings(caseId, {
                                        payer_mode: settings.payer_mode,
                                        default_payer_type: settings.default_payer_type || null,
                                        default_payer_id: settings.default_payer_id ? Number(settings.default_payer_id) : null,
                                        default_tpa_id: settings.default_tpa_id ? Number(settings.default_tpa_id) : null,
                                        default_credit_plan_id: settings.default_credit_plan_id ? Number(settings.default_credit_plan_id) : null,
                                        referral_user_id: settings.referral_user_id ? Number(settings.referral_user_id) : null,
                                        referral_notes: settings.referral_notes || null,
                                    })
                                    toast.success("Case settings updated")
                                    loadAll()
                                    loadDashboard()
                                } catch (e) {
                                    toast.error(e?.message || "Failed to update case settings")
                                } finally {
                                    setSavingSettings(false)
                                }
                            }}
                            saving={savingSettings}
                        />
                    )}
                </>
            )}
        </div>
    )
}

/* -------------------- Small UI blocks -------------------- */

function StatCard({ title, value, icon: Icon, right }) {
    return (
        <Card>
            <CardBody className="flex items-center justify-between">
                <div>
                    <div className="text-xs text-slate-500">{title}</div>
                    <div className="text-lg font-extrabold text-slate-900">{value}</div>
                </div>
                {right ? right : Icon ? <Icon className="h-5 w-5 text-slate-400" /> : null}
            </CardBody>
        </Card>
    )
}

function Pill({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "rounded-xl px-3 py-2 text-xs font-extrabold transition",
                active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
        >
            {children}
        </button>
    )
}

function fmtDate(v) {
    if (!v) return "—"
    try {
        return new Date(v).toLocaleString("en-IN")
    } catch {
        return String(v)
    }
}

/* -------------------- Overview Tab -------------------- */

function OverviewTab({ loading, dashboard, caseRow, onReload }) {
    const particulars = dashboard?.particulars || []
    const totals = dashboard?.totals || {}
    const referral = {
        referral_user_id: caseRow?.referral_user_id,
        referral_notes: caseRow?.referral_notes,
    }

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
                <CardHeader
                    title="Overview"
                    subtitle="All available modules + totals (order wise)"
                    right={
                        <Button variant="outline" onClick={onReload} disabled={loading} className="gap-2">
                            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                            Reload
                        </Button>
                    }
                />
                <CardBody>
                    {loading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
                    ) : particulars.length === 0 ? (
                        <EmptyState title="No billing yet" desc="Add item lines to generate invoice totals per module." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[680px] text-left text-sm">
                                <thead className="text-xs font-extrabold text-slate-600">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 pr-4">Order</th>
                                        <th className="py-3 pr-4">Module</th>
                                        <th className="py-3 pr-4">Label</th>
                                        <th className="py-3 pr-0 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {particulars.map((p, idx) => (
                                        <tr key={p.module} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4 font-bold text-slate-700">#{idx + 1}</td>
                                            <td className="py-3 pr-4">
                                                <Badge tone="slate">{p.module}</Badge>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700">{p.label}</td>
                                            <td className="py-3 pr-0 text-right font-extrabold text-slate-900">₹ {money(p.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                        <Info label="Total Bill" value={`₹ ${money(totals.total_bill || 0)}`} />
                        <Info label="Payments Received" value={`₹ ${money(totals.payments_received || 0)}`} />
                        <Info label="Net Deposit" value={`₹ ${money(totals.net_deposit || 0)}`} />
                        <Info label="Balance" value={`₹ ${money(totals.balance || 0)}`} />
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Quick Info" subtitle="Bill type + referral snapshot" right={<Filter className="h-5 w-5 text-slate-400" />} />
                <CardBody className="space-y-3">
                    <Info label="Payer Mode" value={caseRow?.payer_mode || "SELF"} />
                    <Info label="Default Bill Type" value={caseRow?.default_payer_type || "—"} />
                    <Info label="Default Payer ID" value={caseRow?.default_payer_id ?? "—"} />
                    <Info label="Referral User ID" value={referral.referral_user_id ?? "—"} />
                    <Info label="Referral Notes" value={referral.referral_notes || "—"} />
                </CardBody>
            </Card>
        </div>
    )
}

function Info({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">{label}</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">{value}</div>
        </div>
    )
}

/* -------------------- Invoice Summary Tab -------------------- */

function InvoiceSummaryTab({ loading, data, onFetch, onOpenInvoice }) {
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

    const groups = data?.groups || []
    const netTotal = data?.totals?.net_total ?? "0"

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
        onFetch({ group_by: "module" })
    }

    return (
        <Card>
            <CardHeader
                title="Invoice Summary"
                subtitle="All invoice lines grouped with full details + extreme filters"
                right={
                    <div className="flex items-center gap-2">
                        <Badge tone="slate">Net Total: ₹ {money(netTotal)}</Badge>
                        <Button variant="outline" onClick={reset}>Reset</Button>
                        <Button onClick={apply} className="gap-2">
                            <Filter className="h-4 w-4" />
                            Apply
                        </Button>
                    </div>
                }
            />
            <CardBody>
                {/* Filters */}
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <Field label="Group By">
                        <Select value={filters.group_by} onChange={(e) => setFilters({ ...filters, group_by: e.target.value })}>
                            {GROUP_BY.map((g) => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Module">
                        <Input placeholder="Ex: LAB / ROOM / PHM" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value.toUpperCase() })} />
                    </Field>

                    <Field label="Invoice Status">
                        <Select value={filters.status || "ALL"} onChange={(e) => setFilters({ ...filters, status: e.target.value === "ALL" ? "" : e.target.value })}>
                            {INVOICE_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Search (Item/Code)">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input className="pl-9" placeholder="paracetamol / CBC / bed" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
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

                    <Field label="Service Group (optional)">
                        <Input placeholder="Ex: LAB / PHARMACY / ROOM" value={filters.service_group} onChange={(e) => setFilters({ ...filters, service_group: e.target.value.toUpperCase() })} />
                    </Field>
                </div>

                {loading ? (
                    <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
                ) : groups.length === 0 ? (
                    <EmptyState title="No invoice lines" desc="No items match your filters. Try reset." />
                ) : (
                    <div className="space-y-3">
                        {groups.map((g) => (
                            <div key={g.key} className="rounded-2xl border border-slate-100 bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Badge tone="slate">{g.label}</Badge>
                                        <Badge tone="blue">{g.count} items</Badge>
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-900">₹ {money(g.total)}</div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[980px] text-left text-sm">
                                        <thead className="text-xs font-extrabold text-slate-600">
                                            <tr className="border-b border-slate-100">
                                                <th className="py-3 px-4">Item</th>
                                                <th className="py-3 pr-4">Qty</th>
                                                <th className="py-3 pr-4">Rate</th>
                                                <th className="py-3 pr-4">Dis</th>
                                                <th className="py-3 pr-4">GST%</th>
                                                <th className="py-3 pr-4">Tax</th>
                                                <th className="py-3 pr-4">Net</th>
                                                <th className="py-3 pr-4">Invoice</th>
                                                <th className="py-3 pr-4">Status</th>
                                                <th className="py-3 pr-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {g.items.map((it) => (
                                                <tr key={it.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                                    <td className="py-3 px-4">
                                                        <div className="font-extrabold text-slate-900">{it.description || "—"}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {it.item_code ? `Code: ${it.item_code}` : "—"} · {it.service_date ? fmtDate(it.service_date) : "—"} · {it.module || "—"}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4">{it.qty}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.unit_price)}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.discount_amount)}</td>
                                                    <td className="py-3 pr-4">{it.gst_rate}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.tax_amount)}</td>
                                                    <td className="py-3 pr-4 font-extrabold text-slate-900">₹ {money(it.net_amount)}</td>
                                                    <td className="py-3 pr-4">{it.invoice_number || `#${it.invoice_id}`}</td>
                                                    <td className="py-3 pr-4">
                                                        <StatusBadge status={it.invoice_status} />
                                                    </td>
                                                    <td className="py-3 pr-4 text-right">
                                                        <Button variant="outline" onClick={() => onOpenInvoice(it.invoice_id)}>
                                                            Open
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Invoices Tab (with filters) -------------------- */

function InvoicesTab({ invoices, onOpen }) {
    const [f, setF] = useState({ q: "", status: "ALL", module: "" })

    const rows = useMemo(() => {
        const q = (f.q || "").trim().toLowerCase()
        const st = (f.status || "ALL").toUpperCase()
        const mod = (f.module || "").trim().toUpperCase()

        return [...(invoices || [])]
            .filter((r) => {
                if (st !== "ALL" && String(r.status || "").toUpperCase() !== st) return false
                if (mod && String(r.module || "GENERAL").toUpperCase() !== mod) return false
                if (q) {
                    const hay = `${r.invoice_number || ""} ${r.module || ""} ${r.payer_type || ""} ${r.status || ""}`.toLowerCase()
                    if (!hay.includes(q)) return false
                }
                return true
            })
            .sort((a, b) => Number(b.id) - Number(a.id))
    }, [invoices, f])

    return (
        <Card>
            <CardHeader title="Invoices" subtitle="Extreme filters supported (status/module/search)" right={<Badge tone="slate">{rows.length} results</Badge>} />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Search">
                        <Input placeholder="invoice no / module / payer" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                    </Field>
                    <Field label="Status">
                        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                            {INVOICE_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Module">
                        <Input placeholder="LAB / ROOM / PHM" value={f.module} onChange={(e) => setF({ ...f, module: e.target.value.toUpperCase() })} />
                    </Field>
                </div>

                {rows.length === 0 ? (
                    <EmptyState title="No invoices" desc="No invoices match the current filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="text-xs font-bold text-slate-600">
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 pr-4">Invoice</th>
                                    <th className="py-3 pr-4">Module</th>
                                    <th className="py-3 pr-4">Type</th>
                                    <th className="py-3 pr-4">Payer</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3 pr-4 text-right">Total</th>
                                    <th className="py-3 pr-0 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                        <td className="py-3 pr-4">
                                            <div className="font-bold text-slate-900">{r.invoice_number || `#${r.id}`}</div>
                                            <div className="text-xs text-slate-500">ID: {r.id}</div>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <Badge tone="slate">{(r.module || "GENERAL").toUpperCase()}</Badge>
                                        </td>
                                        <td className="py-3 pr-4">{r.invoice_type || "PATIENT"}</td>
                                        <td className="py-3 pr-4">
                                            <div className="text-sm font-semibold text-slate-800">{r.payer_type || "PATIENT"}</div>
                                            <div className="text-xs text-slate-500">Payer ID: {r.payer_id ?? "—"}</div>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <StatusBadge status={r.status} />
                                        </td>
                                        <td className="py-3 pr-4 text-right font-bold text-slate-900">₹ {money(r.grand_total)}</td>
                                        <td className="py-3 pr-0 text-right">
                                            <Button variant="outline" onClick={() => onOpen(r.id)}>Open</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Payments Tab (filters + add) -------------------- */

function PaymentsTab({ caseId, payments, invoices, onDone }) {
    const [open, setOpen] = useState(false)
    const [f, setF] = useState({ q: "", mode: "ALL", from: "", to: "" })

    const filtered = useMemo(() => {
        const q = (f.q || "").trim().toLowerCase()
        const mode = (f.mode || "ALL").toUpperCase()
        return (payments || []).filter((p) => {
            if (mode !== "ALL" && String(p.mode || "").toUpperCase() !== mode) return false
            const dt = p.received_at || p.paid_at || p.created_at
            if (f.from && dt && String(dt).slice(0, 10) < f.from) return false
            if (f.to && dt && String(dt).slice(0, 10) > f.to) return false
            if (q) {
                const hay = `${p.txn_ref || ""} ${p.invoice_id || ""} ${p.mode || ""} ${p.amount || ""}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [payments, f])

    const total = filtered.reduce((s, p) => s + Number(p.amount ?? 0), 0)

    return (
        <Card>
            <CardHeader
                title="Payments"
                subtitle="Extreme filters supported (mode/date/search) + quick add"
                right={
                    <div className="flex items-center gap-2">
                        <Badge tone="slate">Filtered Total: ₹ {money(total)}</Badge>
                        <Button onClick={() => setOpen(true)}>Add Payment</Button>
                    </div>
                }
            />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Field label="Search">
                        <Input placeholder="txn ref / invoice / amount" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                    </Field>
                    <Field label="Mode">
                        <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </Select>
                    </Field>
                    <Field label="From">
                        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
                    </Field>
                    <Field label="To">
                        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
                    </Field>
                </div>

                {filtered.length === 0 ? (
                    <EmptyState title="No payments" desc="No payments match the filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] text-left text-sm">
                            <thead className="text-xs font-bold text-slate-600">
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 pr-4">Date</th>
                                    <th className="py-3 pr-4">Mode</th>
                                    <th className="py-3 pr-4">Ref</th>
                                    <th className="py-3 pr-4">Invoice</th>
                                    <th className="py-3 pr-0 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p) => (
                                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                        <td className="py-3 pr-4">{fmtDate(p.received_at || p.paid_at || p.created_at)}</td>
                                        <td className="py-3 pr-4"><Badge tone="blue">{p.mode || "CASH"}</Badge></td>
                                        <td className="py-3 pr-4">{p.txn_ref || "—"}</td>
                                        <td className="py-3 pr-4">{p.invoice_id ?? "—"}</td>
                                        <td className="py-3 pr-0 text-right font-bold text-slate-900">₹ {money(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {open && (
                    <PaymentDialog
                        caseId={caseId}
                        invoices={invoices}
                        onClose={() => setOpen(false)}
                        onDone={() => { setOpen(false); onDone(); }}
                    />
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Advances Tab (filters + add) -------------------- */

function AdvancesTab({ caseId, advances, onDone }) {
    const [open, setOpen] = useState(false)
    const [f, setF] = useState({ q: "", type: "ALL", mode: "ALL", from: "", to: "" })

    const filtered = useMemo(() => {
        const q = (f.q || "").trim().toLowerCase()
        const type = (f.type || "ALL").toUpperCase()
        const mode = (f.mode || "ALL").toUpperCase()

        return (advances || []).filter((a) => {
            const t = String(a.entry_type || "ADVANCE").toUpperCase()
            if (type !== "ALL" && t !== type) return false
            if (mode !== "ALL" && String(a.mode || "").toUpperCase() !== mode) return false

            const dt = a.entry_at || a.created_at
            if (f.from && dt && String(dt).slice(0, 10) < f.from) return false
            if (f.to && dt && String(dt).slice(0, 10) > f.to) return false

            if (q) {
                const hay = `${a.txn_ref || ""} ${a.amount || ""} ${a.mode || ""} ${a.entry_type || ""}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [advances, f])

    const balance = filtered.reduce((s, a) => {
        const t = String(a.entry_type || "ADVANCE").toUpperCase()
        const amt = Number(a.amount ?? 0)
        if (t === "REFUND") return s - amt
        if (t === "ADJUSTMENT") return s - amt
        return s + amt
    }, 0)

    return (
        <Card>
            <CardHeader
                title="Advances"
                subtitle="Extreme filters supported (type/mode/date/search) + quick add"
                right={
                    <div className="flex items-center gap-2">
                        <Badge tone="slate">Filtered Balance: ₹ {money(balance)}</Badge>
                        <Button onClick={() => setOpen(true)}>Add Advance</Button>
                    </div>
                }
            />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                    <Field label="Search">
                        <Input placeholder="txn ref / amount" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                    </Field>
                    <Field label="Type">
                        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {ADV_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </Select>
                    </Field>
                    <Field label="Mode">
                        <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </Select>
                    </Field>
                    <Field label="From">
                        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
                    </Field>
                    <Field label="To">
                        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
                    </Field>
                </div>

                {filtered.length === 0 ? (
                    <EmptyState title="No advances" desc="No advance entries match the filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] text-left text-sm">
                            <thead className="text-xs font-bold text-slate-600">
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 pr-4">Date</th>
                                    <th className="py-3 pr-4">Type</th>
                                    <th className="py-3 pr-4">Mode</th>
                                    <th className="py-3 pr-4">Ref</th>
                                    <th className="py-3 pr-0 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a) => {
                                    const t = String(a.entry_type || "ADVANCE").toUpperCase()
                                    const tone = t === "REFUND" ? "red" : t === "ADJUSTMENT" ? "amber" : "green"
                                    return (
                                        <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4">{fmtDate(a.entry_at || a.created_at)}</td>
                                            <td className="py-3 pr-4"><Badge tone={tone}>{a.entry_type || "ADVANCE"}</Badge></td>
                                            <td className="py-3 pr-4"><Badge tone="blue">{a.mode || "CASH"}</Badge></td>
                                            <td className="py-3 pr-4">{a.txn_ref || "—"}</td>
                                            <td className="py-3 pr-0 text-right font-bold text-slate-900">₹ {money(a.amount)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {open && (
                    <AdvanceDialog
                        caseId={caseId}
                        onClose={() => setOpen(false)}
                        onDone={() => { setOpen(false); onDone(); }}
                    />
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Insurance Tab -------------------- */

function InsuranceTab({ insurance }) {
    return (
        <Card>
            <CardHeader
                title="Insurance"
                subtitle="Preauth & claim tracking (optional)"
                right={<Shield className="h-5 w-5 text-slate-400" />}
            />
            <CardBody>
                {!insurance ? (
                    <EmptyState title="No insurance record" desc="Not configured for insurance, or backend route not enabled." />
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Info label="Payer Kind" value={insurance.payer_kind || "—"} />
                        <Info label="Status" value={insurance.status || "—"} />
                        <Info label="Policy No" value={insurance.policy_no || "—"} />
                        <Info label="Member ID" value={insurance.member_id || "—"} />
                        <Info label="Plan" value={insurance.plan_name || "—"} />
                        <Info label="Approved Limit" value={`₹ ${money(insurance.approved_limit)}`} />
                    </div>
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Settings Tab -------------------- */

function SettingsTab({ loading, payerMeta, refMeta, value, onChange, onReloadMeta, onSave, saving }) {
    // filter TPA & Plans based on payer selection
    const payers = payerMeta?.payers || []
    const tpas = payerMeta?.tpas || []
    const plans = payerMeta?.credit_plans || []
    const referrers = refMeta?.items || []

    const filteredTpas = useMemo(() => {
        const pid = value.default_payer_id ? Number(value.default_payer_id) : null
        if (!pid) return tpas
        return tpas.filter((x) => !x.payer_id || Number(x.payer_id) === pid)
    }, [tpas, value.default_payer_id])

    const filteredPlans = useMemo(() => {
        const pid = value.default_payer_id ? Number(value.default_payer_id) : null
        const tid = value.default_tpa_id ? Number(value.default_tpa_id) : null
        return plans.filter((x) => {
            if (pid && x.payer_id && Number(x.payer_id) !== pid) return false
            if (tid && x.tpa_id && Number(x.tpa_id) !== tid) return false
            return true
        })
    }, [plans, value.default_payer_id, value.default_tpa_id])

    return (
        <Card>
            <CardHeader
                title="Bill Type & Referral"
                subtitle="Set default payer / TPA / credit plan + referral user (used in dashboard)"
                right={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={onReloadMeta} disabled={loading}>
                            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                            Reload
                        </Button>
                        <Button onClick={onSave} disabled={loading || saving}>
                            {saving ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>
                }
            />
            <CardBody>
                {loading ? (
                    <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card className="border border-slate-100">
                            <CardHeader title="Bill Types" subtitle="Default payer for this case (can be used while creating invoices)" />
                            <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="Payer Mode">
                                    <Select value={value.payer_mode} onChange={(e) => onChange({ ...value, payer_mode: e.target.value })}>
                                        {["SELF", "INSURANCE", "CORPORATE", "MIXED"].map((x) => (
                                            <option key={x} value={x}>{x}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Default Bill Type">
                                    <Select value={value.default_payer_type} onChange={(e) => onChange({ ...value, default_payer_type: e.target.value })}>
                                        <option value="">(none)</option>
                                        <option value="PATIENT">PATIENT</option>
                                        <option value="PAYER">PAYER</option>
                                        <option value="TPA">TPA</option>
                                        <option value="CREDIT_PLAN">CREDIT PLAN</option>
                                    </Select>
                                </Field>

                                <Field label="Payer (Master)">
                                    <Select value={value.default_payer_id} onChange={(e) => onChange({ ...value, default_payer_id: e.target.value, default_tpa_id: "", default_credit_plan_id: "" })}>
                                        <option value="">(optional)</option>
                                        {payers.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.payer_type})
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="TPA (Master)">
                                    <Select value={value.default_tpa_id} onChange={(e) => onChange({ ...value, default_tpa_id: e.target.value, default_credit_plan_id: "" })}>
                                        <option value="">(optional)</option>
                                        {filteredTpas.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Credit Plan (Master)">
                                    <Select value={value.default_credit_plan_id} onChange={(e) => onChange({ ...value, default_credit_plan_id: e.target.value })}>
                                        <option value="">(optional)</option>
                                        {filteredPlans.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                                    Tip: You can keep payer mode SELF but still set a payer/plan for internal reporting or dashboards.
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="border border-slate-100">
                            <CardHeader title="Referral" subtitle="Who referred this patient (for dashboards & reports)" />
                            <CardBody className="grid grid-cols-1 gap-3">
                                <Field label="Referral User">
                                    <Select value={value.referral_user_id} onChange={(e) => onChange({ ...value, referral_user_id: e.target.value })}>
                                        <option value="">(none)</option>
                                        {referrers.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Referral Notes (optional)">
                                    <Textarea
                                        placeholder="Ex: Referred by Dr. X for OP follow-up / admission..."
                                        value={value.referral_notes}
                                        onChange={(e) => onChange({ ...value, referral_notes: e.target.value })}
                                    />
                                </Field>
                            </CardBody>
                        </Card>
                    </div>
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Dialog Modal + Payment/Advance -------------------- */

function Modal({ title, children, onClose, right }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="text-base font-extrabold text-slate-900">{title}</div>
                    <div className="flex items-center gap-2">
                        {right}
                        <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                            Close
                        </button>
                    </div>
                </div>
                <div className="px-5 py-4">{children}</div>
            </div>
        </div>
    )
}

function PaymentDialog({ caseId, invoices, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ amount: "", mode: "CASH", invoice_id: "", txn_ref: "", notes: "" })

    async function submit() {
        const amt = Number(form.amount || 0)
        if (!amt || amt <= 0) return toast.error("Enter valid amount")

        setSaving(true)
        try {
            const params = {
                amount: amt,
                mode: form.mode,
                invoice_id: form.invoice_id ? Number(form.invoice_id) : undefined,
                txn_ref: form.txn_ref || undefined,
                notes: form.notes || undefined,
            }
            await billingRecordPayment(caseId, params)
            toast.success("Payment recorded")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to record payment")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Add Payment"
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Amount (₹)">
                    <Input inputMode="decimal" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>

                <Field label="Mode">
                    <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                        {PAYMENT_MODES.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </Select>
                </Field>

                <Field label="Invoice (optional)">
                    <Select value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
                        <option value="">Auto-pick latest (Approved/Posted)</option>
                        {(invoices || []).map((inv) => (
                            <option key={inv.id} value={inv.id}>
                                #{inv.id} · {(inv.module || "GENERAL").toUpperCase()} · {inv.invoice_number || ""} · ₹ {money(inv.grand_total)}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field label="Txn Ref (optional)">
                    <Input value={form.txn_ref} onChange={(e) => setForm({ ...form, txn_ref: e.target.value })} />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Notes">
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Field>
                </div>
            </div>
        </Modal>
    )
}

function AdvanceDialog({ caseId, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ amount: "", entry_type: "ADVANCE", mode: "CASH", txn_ref: "", remarks: "" })

    async function submit() {
        const amt = Number(form.amount || 0)
        if (!amt || amt <= 0) return toast.error("Enter valid amount")

        setSaving(true)
        try {
            const params = {
                amount: amt,
                entry_type: form.entry_type,
                mode: form.mode,
                txn_ref: form.txn_ref || undefined,
                remarks: form.remarks || undefined,
            }
            await billingRecordAdvance(caseId, params)
            toast.success("Advance recorded")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to record advance")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Add Advance"
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Amount (₹)">
                    <Input inputMode="decimal" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>

                <Field label="Type">
                    <Select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
                        {ADV_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </Select>
                </Field>

                <Field label="Mode">
                    <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                        {PAYMENT_MODES.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </Select>
                </Field>

                <Field label="Txn Ref (optional)">
                    <Input value={form.txn_ref} onChange={(e) => setForm({ ...form, txn_ref: e.target.value })} />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Remarks">
                        <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                    </Field>
                </div>
            </div>
        </Modal>
    )
}
