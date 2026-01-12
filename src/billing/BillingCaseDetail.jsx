// FILE: src/billing/BillingCaseDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import {
    billingGetCase,
    billingGetInsurance,
    billingUpsertInsurance,
    billingListAdvances,
    billingListInvoices,
    billingListPayments,
    billingListRefunds,
    billingRecordAdvance,
    billingRecordPayment,
    billingApplyAdvancesToCase,
    billingRefundDeposit,
    billingCaseDashboard,
    billingCaseInvoiceSummary,
    billingMetaPayers,
    billingMetaReferrers,
    billingGetCaseSettings,
    billingUpdateCaseSettings,
    billingListPreauths,
    billingCreatePreauth,
    billingSubmitPreauth,
    billingApprovePreauth,
    billingRejectPreauth,
    billingCancelPreauth,
    billingListClaims,
    billingCreateOrRefreshClaimFromInvoice,
    billingSubmitClaim,
    billingAcknowledgeClaim,
    billingApproveClaim,
    billingSettleClaim,
    billingRejectClaim,
    billingCancelClaim,
    billingReopenClaim,
    billingSetClaimUnderQuery,
    billingCloseClaim,
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
    Plus,
    CheckCircle2,
    XCircle,
    RotateCcw,
    Send,
    FileText,
    AlertTriangle,
} from "lucide-react"

const TABS = [
    { key: "OVERVIEW", label: "Overview", icon: Layers },
    { key: "INVOICE_SUMMARY", label: "Invoice Summary", icon: ListChecks },
    { key: "ADD_ITEM", label: "Add Item Line", icon: FilePlus2 },
    { key: "INVOICES", label: "Invoices", icon: Layers },
    { key: "PAYMENTS", label: "Payments", icon: CreditCard },
    { key: "ADVANCES", label: "Advances", icon: Wallet },
    { key: "INSURANCE", label: "Insurance / Claims", icon: Shield },
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

const normItems = (x) =>
    Array.isArray(x) ? x : x?.items ?? x?.results ?? x?.data?.items ?? x?.data ?? []

function fmtDate(v) {
    if (!v) return "—"
    try {
        return new Date(v).toLocaleString("en-IN")
    } catch {
        return String(v)
    }
}

function upper(v) {
    return String(v || "").toUpperCase()
}

function toNum(v, d = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
}

function pickLatestPayableInvoice(invoices = []) {
    const rows = (invoices || [])
        .filter((i) => ["APPROVED", "POSTED"].includes(upper(i.status)))
        .sort((a, b) => Number(b.id) - Number(a.id))
    return rows[0] || null
}

export default function BillingCaseDetail() {
    const { caseId } = useParams()
    const nav = useNavigate()

    const [tab, setTab] = useState("OVERVIEW")
    const [loading, setLoading] = useState(true)

    const [caseRow, setCaseRow] = useState(null)
    const [invoices, setInvoices] = useState([])
    const [payments, setPayments] = useState([])
    const [advances, setAdvances] = useState([])
    const [refunds, setRefunds] = useState([])
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

    // insurance flows (preauth + claims)
    const [insLoading, setInsLoading] = useState(false)
    const [preauths, setPreauths] = useState([])
    const [claims, setClaims] = useState([])

    const abortRef = useRef(null)

    async function loadAll() {
        abortRef.current?.abort?.()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const c = await billingGetCase(caseId, { signal: ac.signal })
            setCaseRow(c)

            const [inv, pay, adv, ref] = await Promise.all([
                billingListInvoices(caseId, {}, { signal: ac.signal }),
                billingListPayments(caseId, {}, { signal: ac.signal }),
                billingListAdvances(caseId, {}, { signal: ac.signal }),
                // refunds may not exist in every backend – keep safe
                billingListRefunds?.(caseId, {}, { signal: ac.signal }).catch(() => []),
            ])

            setInvoices(normItems(inv))
            setPayments(normItems(pay))
            setAdvances(normItems(adv))
            setRefunds(normItems(ref))

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

    async function loadInsuranceFlows() {
        setInsLoading(true)
        try {
            const [ins, pa, cl] = await Promise.all([
                billingGetInsurance(caseId).catch(() => null),
                billingListPreauths(caseId).catch(() => []),
                billingListClaims(caseId).catch(() => []),
            ])
            const insObj = ins?.insurance ?? ins?.data?.insurance ?? ins?.data ?? ins
            setInsurance(insObj || null)
            setPreauths(normItems(pa))
            setClaims(normItems(cl))
        } catch (e) {
            toast.error(e?.message || "Failed to load insurance / claims")
        } finally {
            setInsLoading(false)
        }
    }

    useEffect(() => {
        loadAll()
        return () => abortRef.current?.abort?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    useEffect(() => {
        if (tab === "OVERVIEW" && !dashboard) loadDashboard()
        if (tab === "INVOICE_SUMMARY" && !summary) loadSummary({ group_by: "module", status: "" })
        if (tab === "SETTINGS") loadSettingsMeta()
        if (tab === "INSURANCE") loadInsuranceFlows()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab])

    const headerTitle = useMemo(() => {
        const no = caseRow?.case_number || `#${caseRow?.id ?? ""}`
        const enc = `${caseRow?.encounter_type || "—"} / ${caseRow?.encounter_id ?? "—"}`
        return `${no} · ${enc}`
    }, [caseRow])

    const totals = useMemo(() => {
        const safeInvoices = (invoices || []).filter((i) => upper(i.status) !== "VOID")
        const totalBilled = safeInvoices.reduce((s, i) => s + toNum(i.grand_total), 0)
        const totalPaid = (payments || []).reduce((s, p) => s + toNum(p.amount), 0)

        const advanceBalance = (advances || []).reduce((s, a) => {
            const t = upper(a.entry_type || "ADVANCE")
            const amt = toNum(a.amount)
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
        return (invoices || [])
            .filter((i) => ["APPROVED", "POSTED"].includes(upper(i.status)))
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
                            <span>· Patient: {caseRow?.patient_name || "—"}</span>
                            <span className="text-slate-400">·</span>
                            <span>UHID: {caseRow?.uhid || "—"}</span>
                            <span className="text-slate-400">·</span>
                            <span>Phone: {caseRow?.phone || "—"}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            loadAll()
                            loadDashboard()
                            if (tab === "INSURANCE") loadInsuranceFlows()
                        }}
                        disabled={loading}
                    >
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
                    right={
                        <Badge tone={totals.due > 0 ? "amber" : "green"}>
                            {totals.due > 0 ? "Pending" : "Clear"}
                        </Badge>
                    }
                />
                <StatCard
                    title="Credit"
                    value={`₹ ${money(totals.credit)}`}
                    right={
                        <Badge tone={totals.credit > 0 ? "blue" : "slate"}>
                            {totals.credit > 0 ? "Available" : "—"}
                        </Badge>
                    }
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
                                tab === t.key
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                            <CardHeader
                                title="Add Item Line"
                                subtitle="Use smart particulars selection & automation in Add Item screen"
                            />
                            <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                        <InvoicesTab invoices={invoices} onOpen={(id) => nav(`/billing/invoices/${id}`)} />
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
                            refunds={refunds}
                            due={totals.due}
                            onDone={loadAll}
                        />
                    )}

                    {tab === "INSURANCE" && (
                        <InsuranceTab
                            loading={insLoading}
                            caseId={caseId}
                            insurance={insurance}
                            preauths={preauths}
                            claims={claims}
                            invoices={payableInvoices}
                            onReload={loadInsuranceFlows}
                        />
                    )}

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
                                        default_credit_plan_id: settings.default_credit_plan_id
                                            ? Number(settings.default_credit_plan_id)
                                            : null,
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

function Info({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">{label}</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">{value}</div>
        </div>
    )
}

/* -------------------- Overview Tab -------------------- */

function OverviewTab({ loading, dashboard, caseRow, onReload }) {
    const particulars = dashboard?.particulars || []
    const totals = dashboard?.totals || {}

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
                                        <tr
                                            key={p.module || idx}
                                            className="border-b border-slate-50 hover:bg-slate-50/60"
                                        >
                                            <td className="py-3 pr-4 font-bold text-slate-700">#{idx + 1}</td>
                                            <td className="py-3 pr-4">
                                                <Badge tone="slate">{p.module}</Badge>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700">{p.label}</td>
                                            <td className="py-3 pr-0 text-right font-extrabold text-slate-900">
                                                ₹ {money(p.amount)}
                                            </td>
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
                <CardHeader
                    title="Quick Info"
                    subtitle="Bill type + referral snapshot"
                    right={<Filter className="h-5 w-5 text-slate-400" />}
                />
                <CardBody className="space-y-3">
                    <Info label="Payer Mode" value={caseRow?.payer_mode || "SELF"} />
                    <Info label="Default Bill Type" value={caseRow?.default_payer_type || "—"} />
                    <Info label="Default Payer ID" value={caseRow?.default_payer_id ?? "—"} />
                    <Info label="Referral User ID" value={caseRow?.referral_user_id ?? "—"} />
                    <Info label="Referral Notes" value={caseRow?.referral_notes || "—"} />
                </CardBody>
            </Card>
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
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">Net Total: ₹ {money(netTotal)}</Badge>
                        <Button variant="outline" onClick={reset}>
                            Reset
                        </Button>
                        <Button onClick={apply} className="gap-2">
                            <Filter className="h-4 w-4" />
                            Apply
                        </Button>
                    </div>
                }
            />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <Field label="Group By">
                        <Select
                            value={filters.group_by}
                            onChange={(e) => setFilters({ ...filters, group_by: e.target.value })}
                        >
                            {GROUP_BY.map((g) => (
                                <option key={g.value} value={g.value}>
                                    {g.label}
                                </option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Module">
                        <Input
                            placeholder="Ex: LAB / ROOM / PHM"
                            value={filters.module}
                            onChange={(e) => setFilters({ ...filters, module: e.target.value.toUpperCase() })}
                        />
                    </Field>

                    <Field label="Invoice Status">
                        <Select
                            value={filters.status || "ALL"}
                            onChange={(e) =>
                                setFilters({ ...filters, status: e.target.value === "ALL" ? "" : e.target.value })
                            }
                        >
                            {INVOICE_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
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
                        <Input
                            type="date"
                            value={filters.from_date}
                            onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                        />
                    </Field>

                    <Field label="To Date">
                        <Input
                            type="date"
                            value={filters.to_date}
                            onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                        />
                    </Field>

                    <Field label="Manual?">
                        <Select
                            value={filters.is_manual}
                            onChange={(e) => setFilters({ ...filters, is_manual: e.target.value })}
                        >
                            <option value="">ALL</option>
                            <option value="true">Manual</option>
                            <option value="false">Auto</option>
                        </Select>
                    </Field>

                    <Field label="Min Net">
                        <Input
                            inputMode="decimal"
                            placeholder="0"
                            value={filters.min_net}
                            onChange={(e) => setFilters({ ...filters, min_net: e.target.value })}
                        />
                    </Field>

                    <Field label="Max Net">
                        <Input
                            inputMode="decimal"
                            placeholder="0"
                            value={filters.max_net}
                            onChange={(e) => setFilters({ ...filters, max_net: e.target.value })}
                        />
                    </Field>

                    <Field label="Service Group (optional)">
                        <Input
                            placeholder="Ex: LAB / PHARMACY / ROOM"
                            value={filters.service_group}
                            onChange={(e) =>
                                setFilters({ ...filters, service_group: e.target.value.toUpperCase() })
                            }
                        />
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
                                            {(g.items || []).map((it) => (
                                                <tr
                                                    key={it.id}
                                                    className="border-b border-slate-50 hover:bg-slate-50/60"
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="font-extrabold text-slate-900">
                                                            {it.description || "—"}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {it.item_code ? `Code: ${it.item_code}` : "—"} ·{" "}
                                                            {it.service_date ? fmtDate(it.service_date) : "—"} ·{" "}
                                                            {it.module || "—"}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4">{it.qty}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.unit_price)}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.discount_amount)}</td>
                                                    <td className="py-3 pr-4">{it.gst_rate}</td>
                                                    <td className="py-3 pr-4">₹ {money(it.tax_amount)}</td>
                                                    <td className="py-3 pr-4 font-extrabold text-slate-900">
                                                        ₹ {money(it.net_amount)}
                                                    </td>
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

/* -------------------- Invoices Tab -------------------- */

function InvoicesTab({ invoices, onOpen }) {
    const [f, setF] = useState({ q: "", status: "ALL", module: "" })

    const rows = useMemo(() => {
        const q = (f.q || "").trim().toLowerCase()
        const st = (f.status || "ALL").toUpperCase()
        const mod = (f.module || "").trim().toUpperCase()

        return [...(invoices || [])]
            .filter((r) => {
                if (st !== "ALL" && upper(r.status) !== st) return false
                if (mod && upper(r.module || "GENERAL") !== mod) return false
                if (q) {
                    const hay = `${r.invoice_number || ""} ${r.module || ""} ${r.payer_type || ""} ${r.status || ""
                        }`.toLowerCase()
                    if (!hay.includes(q)) return false
                }
                return true
            })
            .sort((a, b) => Number(b.id) - Number(a.id))
    }, [invoices, f])

    return (
        <Card>
            <CardHeader
                title="Invoices"
                subtitle="Extreme filters supported (status/module/search)"
                right={<Badge tone="slate">{rows.length} results</Badge>}
            />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Search">
                        <Input
                            placeholder="invoice no / module / payer"
                            value={f.q}
                            onChange={(e) => setF({ ...f, q: e.target.value })}
                        />
                    </Field>
                    <Field label="Status">
                        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                            {INVOICE_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Module">
                        <Input
                            placeholder="LAB / ROOM / PHM"
                            value={f.module}
                            onChange={(e) => setF({ ...f, module: e.target.value.toUpperCase() })}
                        />
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
                                            <Badge tone="slate">{upper(r.module || "GENERAL")}</Badge>
                                        </td>
                                        <td className="py-3 pr-4">{r.invoice_type || "PATIENT"}</td>
                                        <td className="py-3 pr-4">
                                            <div className="text-sm font-semibold text-slate-800">{r.payer_type || "PATIENT"}</div>
                                            <div className="text-xs text-slate-500">Payer ID: {r.payer_id ?? "—"}</div>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <StatusBadge status={r.status} />
                                        </td>
                                        <td className="py-3 pr-4 text-right font-bold text-slate-900">
                                            ₹ {money(r.grand_total)}
                                        </td>
                                        <td className="py-3 pr-0 text-right">
                                            <Button variant="outline" onClick={() => onOpen(r.id)}>
                                                Open
                                            </Button>
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

/* -------------------- Payments Tab -------------------- */

function PaymentsTab({ caseId, payments, invoices, onDone }) {
    const [open, setOpen] = useState(false)
    const [f, setF] = useState({ q: "", mode: "ALL", from: "", to: "" })

    const filtered = useMemo(() => {
        const q = (f.q || "").trim().toLowerCase()
        const mode = (f.mode || "ALL").toUpperCase()
        return (payments || []).filter((p) => {
            if (mode !== "ALL" && upper(p.mode) !== mode) return false
            const dt = p.received_at || p.paid_at || p.created_at
            if (f.from && dt && String(dt).slice(0, 10) < f.from) return false
            if (f.to && dt && String(dt).slice(0, 10) > f.to) return false
            if (q) {
                const hay = `${p.txn_ref || ""} ${p.invoice_id || ""} ${p.mode || ""} ${p.amount || ""
                    }`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [payments, f])

    const total = filtered.reduce((s, p) => s + toNum(p.amount), 0)

    return (
        <Card>
            <CardHeader
                title="Payments"
                subtitle="Extreme filters supported (mode/date/search) + quick add"
                right={
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">Filtered Total: ₹ {money(total)}</Badge>
                        <Button onClick={() => setOpen(true)}>Add Payment</Button>
                    </div>
                }
            />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Field label="Search">
                        <Input
                            placeholder="txn ref / invoice / amount"
                            value={f.q}
                            onChange={(e) => setF({ ...f, q: e.target.value })}
                        />
                    </Field>
                    <Field label="Mode">
                        <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {PAYMENT_MODES.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
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
                                        <td className="py-3 pr-4">
                                            <Badge tone="blue">{p.mode || "CASH"}</Badge>
                                        </td>
                                        <td className="py-3 pr-4">{p.txn_ref || "—"}</td>
                                        <td className="py-3 pr-4">{p.invoice_id ?? "—"}</td>
                                        <td className="py-3 pr-0 text-right font-bold text-slate-900">
                                            ₹ {money(p.amount)}
                                        </td>
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
                        onDone={() => {
                            setOpen(false)
                            onDone()
                        }}
                    />
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Advances Tab (with Apply + Refund) -------------------- */

function AdvancesTab({ caseId, advances, refunds, due, onDone }) {
    const [open, setOpen] = useState(false)
    const [applyOpen, setApplyOpen] = useState(false)
    const [refundOpen, setRefundOpen] = useState(false)
    const [f, setF] = useState({ q: "", type: "ALL", mode: "ALL", from: "", to: "" })

    const merged = useMemo(() => {
        // Some backends return refunds through /refunds, some keep inside /advances as entry_type=REFUND.
        const a = normItems(advances)
        const r = normItems(refunds).map((x) => ({
            ...x,
            entry_type: x.entry_type || "REFUND",
            amount: x.amount ?? x.refund_amount ?? x.refunded_amount,
            entry_at: x.entry_at || x.refunded_at || x.created_at,
        }))
        const all = [...a, ...r]
        // Deduplicate by id if overlaps
        const seen = new Set()
        return all.filter((x) => {
            const k = `${x?.id || ""}:${upper(x?.entry_type || "")}:${x?.amount || ""}`
            if (seen.has(k)) return false
            seen.add(k)
            return true
        })
    }, [advances, refunds])

    const filtered = useMemo(() => {
        const q = (f.q || "").trim().toLowerCase()
        const type = (f.type || "ALL").toUpperCase()
        const mode = (f.mode || "ALL").toUpperCase()

        return (merged || []).filter((a) => {
            const t = upper(a.entry_type || "ADVANCE")
            if (type !== "ALL" && t !== type) return false
            if (mode !== "ALL" && upper(a.mode) !== mode) return false

            const dt = a.entry_at || a.created_at
            if (f.from && dt && String(dt).slice(0, 10) < f.from) return false
            if (f.to && dt && String(dt).slice(0, 10) > f.to) return false

            if (q) {
                const hay = `${a.txn_ref || ""} ${a.amount || ""} ${a.mode || ""} ${a.entry_type || ""
                    } ${a.remarks || ""}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [merged, f])

    const balance = filtered.reduce((s, a) => {
        const t = upper(a.entry_type || "ADVANCE")
        const amt = toNum(a.amount)
        if (t === "REFUND") return s - amt
        if (t === "ADJUSTMENT") return s - amt
        return s + amt
    }, 0)

    return (
        <Card>
            <CardHeader
                title="Advances / Deposits"
                subtitle="Record deposits, refunds, adjustments + apply deposit to dues"
                right={
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">Filtered Balance: ₹ {money(balance)}</Badge>
                        <Button variant="outline" onClick={() => setApplyOpen(true)} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Apply to Due
                        </Button>
                        <Button variant="outline" onClick={() => setRefundOpen(true)} className="gap-2">
                            <RotateCcw className="h-4 w-4" />
                            Refund
                        </Button>
                        <Button onClick={() => setOpen(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Deposit
                        </Button>
                    </div>
                }
            />
            <CardBody>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                    <Field label="Search">
                        <Input
                            placeholder="txn ref / amount / remarks"
                            value={f.q}
                            onChange={(e) => setF({ ...f, q: e.target.value })}
                        />
                    </Field>
                    <Field label="Type">
                        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {ADV_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Mode">
                        <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {PAYMENT_MODES.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="From">
                        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
                    </Field>
                    <Field label="To">
                        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
                    </Field>
                </div>

                <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <span className="font-extrabold text-slate-900">Due:</span> ₹ {money(due || 0)}
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="font-extrabold text-slate-900">Visible Deposit Balance:</span> ₹ {money(balance)}
                        </div>
                        <div className="text-xs text-slate-500">
                            Tip: Use “Apply to Due” to adjust deposit against invoices (backend decides allocation).
                        </div>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <EmptyState title="No deposits" desc="No deposit entries match the filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="text-xs font-bold text-slate-600">
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 pr-4">Date</th>
                                    <th className="py-3 pr-4">Type</th>
                                    <th className="py-3 pr-4">Mode</th>
                                    <th className="py-3 pr-4">Ref</th>
                                    <th className="py-3 pr-4">Remarks</th>
                                    <th className="py-3 pr-0 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a) => {
                                    const t = upper(a.entry_type || "ADVANCE")
                                    const tone = t === "REFUND" ? "red" : t === "ADJUSTMENT" ? "amber" : "green"
                                    return (
                                        <tr key={`${a.id}-${t}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4">{fmtDate(a.entry_at || a.created_at)}</td>
                                            <td className="py-3 pr-4">
                                                <Badge tone={tone}>{t}</Badge>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <Badge tone="blue">{a.mode || "CASH"}</Badge>
                                            </td>
                                            <td className="py-3 pr-4">{a.txn_ref || "—"}</td>
                                            <td className="py-3 pr-4">{a.remarks || a.note || "—"}</td>
                                            <td className="py-3 pr-0 text-right font-bold text-slate-900">
                                                ₹ {money(a.amount)}
                                            </td>
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
                        entryType="ADVANCE"
                        onClose={() => setOpen(false)}
                        onDone={() => {
                            setOpen(false)
                            onDone()
                        }}
                    />
                )}

                {refundOpen && (
                    <AdvanceDialog
                        caseId={caseId}
                        entryType="REFUND"
                        onClose={() => setRefundOpen(false)}
                        onDone={() => {
                            setRefundOpen(false)
                            onDone()
                        }}
                    />
                )}

                {applyOpen && (
                    <ApplyAdvanceDialog
                        caseId={caseId}
                        due={toNum(due)}
                        onClose={() => setApplyOpen(false)}
                        onDone={() => {
                            setApplyOpen(false)
                            onDone()
                        }}
                    />
                )}
            </CardBody>
        </Card>
    )
}

/* -------------------- Insurance / Claims Tab -------------------- */

function InsuranceTab({ loading, caseId, insurance, preauths, claims, invoices, onReload }) {
    const [editOpen, setEditOpen] = useState(false)
    const [preauthOpen, setPreauthOpen] = useState(false)
    const [claimOpen, setClaimOpen] = useState(false)

    const sortedPreauths = useMemo(() => {
        return [...(preauths || [])].sort((a, b) => Number(b.id) - Number(a.id))
    }, [preauths])

    const sortedClaims = useMemo(() => {
        return [...(claims || [])].sort((a, b) => Number(b.id) - Number(a.id))
    }, [claims])

    const latestInvoice = useMemo(() => pickLatestPayableInvoice(invoices), [invoices])

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader
                    title="Insurance Case"
                    subtitle="Policy + member + approved limits (if payer_mode is INSURANCE/MIXED)"
                    right={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={onReload} disabled={loading} className="gap-2">
                                <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                                Reload
                            </Button>
                            <Button onClick={() => setEditOpen(true)} className="gap-2">
                                <Settings className="h-4 w-4" />
                                Edit Insurance
                            </Button>
                        </div>
                    }
                />
                <CardBody>
                    {loading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
                    ) : !insurance ? (
                        <EmptyState
                            title="No insurance record"
                            desc="Create insurance case to enable preauth + claims."
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Info label="Status" value={insurance.status || "—"} />
                            <Info label="Payer" value={insurance.payer_name || insurance.payer_kind || insurance.payer_id || "—"} />
                            <Info label="TPA" value={insurance.tpa_name || insurance.tpa_id || "—"} />
                            <Info label="Policy No" value={insurance.policy_no || "—"} />
                            <Info label="Member ID" value={insurance.member_id || "—"} />
                            <Info label="Plan" value={insurance.plan_name || "—"} />
                            <Info label="Sum Insured" value={`₹ ${money(insurance.sum_insured ?? insurance.coverage_limit ?? 0)}`} />
                            <Info label="Approved Limit" value={`₹ ${money(insurance.approved_limit ?? insurance.approved_amount ?? 0)}`} />
                            <div className="md:col-span-2">
                                <Info label="Notes" value={insurance.remarks || insurance.notes || "—"} />
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Preauth */}
            <Card>
                <CardHeader
                    title="Preauth Requests"
                    subtitle="Create → Submit → Approve/Reject/Cancel"
                    right={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={() => setPreauthOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                New Preauth
                            </Button>
                            <Badge tone="slate">{sortedPreauths.length} total</Badge>
                        </div>
                    }
                />
                <CardBody>
                    {loading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
                    ) : sortedPreauths.length === 0 ? (
                        <EmptyState title="No preauth" desc="Create preauth if insurer requires authorization." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-left text-sm">
                                <thead className="text-xs font-bold text-slate-600">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 pr-4">Preauth</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-4">Requested</th>
                                        <th className="py-3 pr-4">Approved</th>
                                        <th className="py-3 pr-4">Ref</th>
                                        <th className="py-3 pr-4">Updated</th>
                                        <th className="py-3 pr-0 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedPreauths.map((p) => (
                                        <PreauthRow key={p.id} preauth={p} onChanged={onReload} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Claims */}
            <Card>
                <CardHeader
                    title="Claims"
                    subtitle="Create from invoice → Submit → Ack → Approve → Settle (or Reject/Cancel/Reopen)"
                    right={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button onClick={() => setClaimOpen(true)} className="gap-2">
                                <FileText className="h-4 w-4" />
                                Create / Refresh Claim
                            </Button>
                            <Badge tone="slate">{sortedClaims.length} total</Badge>
                        </div>
                    }
                />
                <CardBody>
                    {loading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
                    ) : sortedClaims.length === 0 ? (
                        <EmptyState title="No claims" desc="Create claim from posted/approved invoice." />
                    ) : (
                        <div className="space-y-3">
                            {sortedClaims.map((c) => (
                                <ClaimCard key={c.id} claim={c} onChanged={onReload} />
                            ))}
                        </div>
                    )}

                    {claimOpen && (
                        <ClaimCreateDialog
                            caseId={caseId}
                            invoices={invoices}
                            defaultInvoiceId={latestInvoice?.id || ""}
                            onClose={() => setClaimOpen(false)}
                            onDone={() => {
                                setClaimOpen(false)
                                onReload()
                            }}
                        />
                    )}

                    {editOpen && (
                        <InsuranceEditDialog
                            caseId={caseId}
                            insurance={insurance}
                            onClose={() => setEditOpen(false)}
                            onDone={() => {
                                setEditOpen(false)
                                onReload()
                            }}
                        />
                    )}

                    {preauthOpen && (
                        <PreauthCreateDialog
                            caseId={caseId}
                            onClose={() => setPreauthOpen(false)}
                            onDone={() => {
                                setPreauthOpen(false)
                                onReload()
                            }}
                        />
                    )}
                </CardBody>
            </Card>
        </div>
    )
}

/* -------------------- Settings Tab -------------------- */

function SettingsTab({ loading, payerMeta, refMeta, value, onChange, onReloadMeta, onSave, saving }) {
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
                subtitle="Set default payer / TPA / credit plan + referral user"
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
                            <CardHeader title="Bill Types" subtitle="Default payer for this case" />
                            <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="Payer Mode">
                                    <Select
                                        value={value.payer_mode}
                                        onChange={(e) => onChange({ ...value, payer_mode: e.target.value })}
                                    >
                                        {["SELF", "INSURANCE", "CORPORATE", "MIXED"].map((x) => (
                                            <option key={x} value={x}>
                                                {x}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Default Bill Type">
                                    <Select
                                        value={value.default_payer_type}
                                        onChange={(e) => onChange({ ...value, default_payer_type: e.target.value })}
                                    >
                                        <option value="">(none)</option>
                                        <option value="PATIENT">PATIENT</option>
                                        <option value="PAYER">PAYER</option>
                                        <option value="TPA">TPA</option>
                                        <option value="CREDIT_PLAN">CREDIT PLAN</option>
                                    </Select>
                                </Field>

                                <Field label="Payer (Master)">
                                    <Select
                                        value={value.default_payer_id}
                                        onChange={(e) =>
                                            onChange({
                                                ...value,
                                                default_payer_id: e.target.value,
                                                default_tpa_id: "",
                                                default_credit_plan_id: "",
                                            })
                                        }
                                    >
                                        <option value="">(optional)</option>
                                        {payers.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.payer_type})
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="TPA (Master)">
                                    <Select
                                        value={value.default_tpa_id}
                                        onChange={(e) =>
                                            onChange({ ...value, default_tpa_id: e.target.value, default_credit_plan_id: "" })
                                        }
                                    >
                                        <option value="">(optional)</option>
                                        {filteredTpas.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Credit Plan (Master)">
                                    <Select
                                        value={value.default_credit_plan_id}
                                        onChange={(e) => onChange({ ...value, default_credit_plan_id: e.target.value })}
                                    >
                                        <option value="">(optional)</option>
                                        {filteredPlans.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                                    Tip: You can keep payer mode SELF but still set a payer/plan for internal reporting.
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="border border-slate-100">
                            <CardHeader title="Referral" subtitle="Who referred this patient (for dashboards & reports)" />
                            <CardBody className="grid grid-cols-1 gap-3">
                                <Field label="Referral User">
                                    <Select
                                        value={value.referral_user_id}
                                        onChange={(e) => onChange({ ...value, referral_user_id: e.target.value })}
                                    >
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
                                        placeholder="Ex: Referred by Dr. X for follow-up / admission..."
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

/* -------------------- Dialogs -------------------- */

function Modal({ title, children, onClose, right, wide = false }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
            <div
                className={cn(
                    "w-full rounded-2xl bg-white shadow-xl",
                    wide ? "max-w-4xl" : "max-w-xl"
                )}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="text-base font-extrabold text-slate-900">{title}</div>
                    <div className="flex items-center gap-2">
                        {right}
                        <button
                            onClick={onClose}
                            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                            Close
                        </button>
                    </div>
                </div>
                <div className="max-h-[78vh] overflow-auto px-5 py-4">{children}</div>
            </div>
        </div>
    )
}

function PaymentDialog({ caseId, invoices, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        amount: "",
        mode: "CASH",
        invoice_id: "",
        txn_ref: "",
        notes: "",
    })

    const suggestedInvoice = useMemo(() => pickLatestPayableInvoice(invoices), [invoices])

    async function submit() {
        const amt = toNum(form.amount)
        if (!amt || amt <= 0) return toast.error("Enter valid amount")

        setSaving(true)
        try {
            const pickedInvoiceId = form.invoice_id
                ? Number(form.invoice_id)
                : suggestedInvoice?.id
                    ? Number(suggestedInvoice.id)
                    : undefined

            const params = {
                amount: amt,
                mode: form.mode,
                invoice_id: pickedInvoiceId,
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
            <div className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                {suggestedInvoice ? (
                    <>
                        Auto-pick invoice if not selected:{" "}
                        <span className="font-extrabold text-slate-900">
                            #{suggestedInvoice.id} · {upper(suggestedInvoice.module)} ·{" "}
                            {suggestedInvoice.invoice_number || ""}
                        </span>
                    </>
                ) : (
                    <>
                        <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-600" />
                        No APPROVED/POSTED invoice found. You can still record payment (if backend allows).
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Amount (₹)">
                    <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                </Field>

                <Field label="Mode">
                    <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                        {PAYMENT_MODES.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field label="Invoice (optional)">
                    <Select value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
                        <option value="">
                            Auto-pick latest (Approved/Posted){suggestedInvoice ? ` · #${suggestedInvoice.id}` : ""}
                        </option>
                        {(invoices || []).map((inv) => (
                            <option key={inv.id} value={inv.id}>
                                #{inv.id} · {upper(inv.module || "GENERAL")} · {inv.invoice_number || ""} · ₹ {money(inv.grand_total)}
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

function AdvanceDialog({ caseId, entryType = "ADVANCE", onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        amount: "",
        entry_type: entryType,
        mode: "CASH",
        txn_ref: "",
        remarks: "",
    })

    async function submit() {
        const amt = toNum(form.amount)
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

            // Many backends record refund as ADVANCE entry_type=REFUND.
            // If your backend has a dedicated refund endpoint, keep this fallback:
            if (upper(form.entry_type) === "REFUND" && typeof billingRefundDeposit === "function") {
                // Try dedicated refund endpoint first (safe)
                try {
                    await billingRefundDeposit(caseId, params)
                } catch {
                    await billingRecordAdvance(caseId, params)
                }
            } else {
                await billingRecordAdvance(caseId, params)
            }

            toast.success(upper(form.entry_type) === "REFUND" ? "Refund recorded" : "Deposit recorded")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to record entry")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={upper(form.entry_type) === "REFUND" ? "Refund Deposit" : "Add Deposit"}
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Amount (₹)">
                    <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                </Field>

                <Field label="Type">
                    <Select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
                        {ADV_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field label="Mode">
                    <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                        {PAYMENT_MODES.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
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

function ApplyAdvanceDialog({ caseId, due, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        max_amount: due ? String(due) : "",
        strategy: "FIFO",
        notes: "",
    })

    async function submit() {
        const maxAmt = form.max_amount ? toNum(form.max_amount) : undefined
        if (maxAmt !== undefined && maxAmt <= 0) return toast.error("Enter valid amount")

        setSaving(true)
        try {
            await billingApplyAdvancesToCase(caseId, {
                max_amount: maxAmt,
                strategy: form.strategy,
                notes: form.notes || undefined,
            })
            toast.success("Deposit applied")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to apply deposit")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Apply Deposit to Due"
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Applying..." : "Apply"}
                </Button>
            }
        >
            <div className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                Current due: <span className="font-extrabold text-slate-900">₹ {money(due || 0)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Max Amount (₹)">
                    <Input
                        inputMode="decimal"
                        placeholder="Leave blank = apply all possible"
                        value={form.max_amount}
                        onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
                    />
                </Field>

                <Field label="Allocation Strategy">
                    <Select value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>
                        <option value="FIFO">FIFO (oldest first)</option>
                        <option value="LIFO">LIFO (latest first)</option>
                        <option value="HIGHEST_FIRST">Highest invoice first</option>
                        <option value="LOWEST_FIRST">Lowest invoice first</option>
                    </Select>
                </Field>

                <div className="md:col-span-2">
                    <Field label="Notes (optional)">
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Field>
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Backend decides exact allocation rules (invoice priority, status checks, rounding). This UI just sends your intent.
                </div>
            </div>
        </Modal>
    )
}

/* -------------------- Insurance Edit -------------------- */

function InsuranceEditDialog({ caseId, insurance, onClose, onDone }) {
    const [saving, setSaving] = useState(false)

    // Keep field names flexible (backend may not store all)
    const [form, setForm] = useState({
        status: insurance?.status || "ACTIVE",
        payer_id: insurance?.payer_id ? String(insurance.payer_id) : "",
        tpa_id: insurance?.tpa_id ? String(insurance.tpa_id) : "",
        policy_no: insurance?.policy_no || "",
        member_id: insurance?.member_id || "",
        plan_name: insurance?.plan_name || "",
        sum_insured: insurance?.sum_insured ?? insurance?.coverage_limit ?? "",
        approved_limit: insurance?.approved_limit ?? insurance?.approved_amount ?? "",
        remarks: insurance?.remarks || insurance?.notes || "",
    })

    async function submit() {
        setSaving(true)
        try {
            const payload = {
                status: form.status || null,
                payer_id: form.payer_id ? Number(form.payer_id) : null,
                tpa_id: form.tpa_id ? Number(form.tpa_id) : null,
                policy_no: form.policy_no || null,
                member_id: form.member_id || null,
                plan_name: form.plan_name || null,
                sum_insured: form.sum_insured === "" ? null : Number(form.sum_insured),
                approved_limit: form.approved_limit === "" ? null : Number(form.approved_limit),
                remarks: form.remarks || null,
            }
            await billingUpsertInsurance(caseId, payload)
            toast.success("Insurance updated")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to update insurance")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Edit Insurance Case"
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Status">
                    <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {["ACTIVE", "INACTIVE", "CLOSED"].map((x) => (
                            <option key={x} value={x}>
                                {x}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field label="Payer ID (optional)">
                    <Input value={form.payer_id} onChange={(e) => setForm({ ...form, payer_id: e.target.value })} />
                </Field>

                <Field label="TPA ID (optional)">
                    <Input value={form.tpa_id} onChange={(e) => setForm({ ...form, tpa_id: e.target.value })} />
                </Field>

                <Field label="Policy No">
                    <Input value={form.policy_no} onChange={(e) => setForm({ ...form, policy_no: e.target.value })} />
                </Field>

                <Field label="Member ID">
                    <Input value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} />
                </Field>

                <Field label="Plan Name">
                    <Input value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} />
                </Field>

                <Field label="Sum Insured (₹)">
                    <Input
                        inputMode="decimal"
                        value={String(form.sum_insured ?? "")}
                        onChange={(e) => setForm({ ...form, sum_insured: e.target.value })}
                    />
                </Field>

                <Field label="Approved Limit (₹)">
                    <Input
                        inputMode="decimal"
                        value={String(form.approved_limit ?? "")}
                        onChange={(e) => setForm({ ...form, approved_limit: e.target.value })}
                    />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Remarks / Notes">
                        <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                    </Field>
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    If your backend uses different field names, update payload keys in this dialog only (rest of module stays same).
                </div>
            </div>
        </Modal>
    )
}

/* -------------------- Preauth -------------------- */

function PreauthCreateDialog({ caseId, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        requested_amount: "",
        notes: "",
        reference_no: "",
    })

    async function submit() {
        const amt = form.requested_amount === "" ? undefined : toNum(form.requested_amount)
        if (amt !== undefined && amt <= 0) return toast.error("Enter valid requested amount")

        setSaving(true)
        try {
            await billingCreatePreauth(caseId, {
                requested_amount: amt,
                reference_no: form.reference_no || undefined,
                notes: form.notes || undefined,
            })
            toast.success("Preauth created")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to create preauth")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="New Preauth"
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Create"}
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Requested Amount (₹)">
                    <Input
                        inputMode="decimal"
                        placeholder="optional"
                        value={form.requested_amount}
                        onChange={(e) => setForm({ ...form, requested_amount: e.target.value })}
                    />
                </Field>

                <Field label="Reference No (optional)">
                    <Input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Notes (optional)">
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Field>
                </div>
            </div>
        </Modal>
    )
}

function PreauthRow({ preauth, onChanged }) {
    const [open, setOpen] = useState(false)
    const st = upper(preauth.status || "DRAFT")

    const canSubmit = ["DRAFT", "CREATED"].includes(st)
    const canApprove = ["SUBMITTED", "PENDING"].includes(st)
    const canReject = ["SUBMITTED", "PENDING"].includes(st)
    const canCancel = !["CANCELLED", "REJECTED", "APPROVED", "SETTLED", "CLOSED"].includes(st)

    return (
        <>
            <tr className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="py-3 pr-4">
                    <div className="font-extrabold text-slate-900">#{preauth.id}</div>
                    <div className="text-xs text-slate-500">{preauth.reference_no || "—"}</div>
                </td>
                <td className="py-3 pr-4">
                    <StatusBadge status={preauth.status} />
                </td>
                <td className="py-3 pr-4">₹ {money(preauth.requested_amount ?? preauth.amount_requested ?? 0)}</td>
                <td className="py-3 pr-4">₹ {money(preauth.approved_amount ?? preauth.approved_limit ?? 0)}</td>
                <td className="py-3 pr-4">{preauth.insurer_ref || preauth.txn_ref || "—"}</td>
                <td className="py-3 pr-4">{fmtDate(preauth.updated_at || preauth.created_at)}</td>
                <td className="py-3 pr-0 text-right">
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        Actions
                    </Button>
                </td>
            </tr>

            {open && (
                <PreauthActionsDialog
                    preauth={preauth}
                    canSubmit={canSubmit}
                    canApprove={canApprove}
                    canReject={canReject}
                    canCancel={canCancel}
                    onClose={() => setOpen(false)}
                    onDone={() => {
                        setOpen(false)
                        onChanged()
                    }}
                />
            )}
        </>
    )
}

function PreauthActionsDialog({ preauth, canSubmit, canApprove, canReject, canCancel, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ notes: "", approved_amount: "" })

    async function act(kind) {
        if (saving) return
        setSaving(true)
        try {
            const payload = {
                notes: form.notes || undefined,
                approved_amount: form.approved_amount === "" ? undefined : toNum(form.approved_amount),
            }
            if (kind === "submit") await billingSubmitPreauth(preauth.id, payload)
            if (kind === "approve") await billingApprovePreauth(preauth.id, payload)
            if (kind === "reject") await billingRejectPreauth(preauth.id, payload)
            if (kind === "cancel") await billingCancelPreauth(preauth.id, payload)
            toast.success("Preauth updated")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to update preauth")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={`Preauth #${preauth.id} Actions`}
            onClose={onClose}
            right={
                <div className="flex items-center gap-2">
                    {canSubmit && (
                        <Button onClick={() => act("submit")} disabled={saving} className="gap-2">
                            <Send className="h-4 w-4" />
                            Submit
                        </Button>
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Approved Amount (₹) (optional)">
                    <Input
                        inputMode="decimal"
                        value={form.approved_amount}
                        onChange={(e) => setForm({ ...form, approved_amount: e.target.value })}
                    />
                </Field>

                <Field label="Notes (optional)">
                    <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>

                <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                    {canApprove && (
                        <Button variant="outline" onClick={() => act("approve")} disabled={saving} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                        </Button>
                    )}
                    {canReject && (
                        <Button variant="outline" onClick={() => act("reject")} disabled={saving} className="gap-2">
                            <XCircle className="h-4 w-4" />
                            Reject
                        </Button>
                    )}
                    {canCancel && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!window.confirm("Cancel this preauth?")) return
                                act("cancel")
                            }}
                            disabled={saving}
                            className="gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Cancel
                        </Button>
                    )}
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Actions are enabled/disabled based on status. If your backend uses different status values, update the guards in
                    <span className="font-bold"> PreauthRow()</span>.
                </div>
            </div>
        </Modal>
    )
}

/* -------------------- Claims -------------------- */

function ClaimCreateDialog({ caseId, invoices, defaultInvoiceId, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        invoice_id: defaultInvoiceId ? String(defaultInvoiceId) : "",
        notes: "",
    })

    async function submit() {
        const invId = form.invoice_id ? Number(form.invoice_id) : null
        if (!invId) return toast.error("Select an invoice")

        setSaving(true)
        try {
            await billingCreateOrRefreshClaimFromInvoice(caseId, {
                invoice_id: invId,
                notes: form.notes || undefined,
            })
            toast.success("Claim created/refreshed")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to create claim")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Create / Refresh Claim"
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Create"}
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Invoice (Approved/Posted)">
                    <Select value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
                        <option value="">Select invoice</option>
                        {(invoices || []).map((inv) => (
                            <option key={inv.id} value={inv.id}>
                                #{inv.id} · {upper(inv.module || "GENERAL")} · {inv.invoice_number || ""} · ₹ {money(inv.grand_total)}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field label="Notes (optional)">
                    <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>

                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Claim totals should match invoice totals. If invoice changes (lines edited), refresh claim again.
                </div>
            </div>
        </Modal>
    )
}

function ClaimCard({ claim, onChanged }) {
    const [open, setOpen] = useState(false)
    const st = upper(claim.status || "DRAFT")

    // Typical lifecycle:
    // DRAFT -> SUBMITTED -> ACKNOWLEDGED -> APPROVED -> SETTLED -> CLOSED
    // also: REJECTED/CANCELLED/QUERY
    const canSubmit = ["DRAFT", "CREATED"].includes(st)
    const canAck = ["SUBMITTED"].includes(st)
    const canApprove = ["ACKNOWLEDGED", "SUBMITTED"].includes(st)
    const canSettle = ["APPROVED"].includes(st)
    const canReject = ["SUBMITTED", "ACKNOWLEDGED", "APPROVED"].includes(st)
    const canCancel = !["CANCELLED", "SETTLED", "CLOSED"].includes(st)
    const canReopen = ["REJECTED", "CANCELLED", "CLOSED"].includes(st)
    const canQuery = ["SUBMITTED", "ACKNOWLEDGED"].includes(st)
    const canClose = ["SETTLED"].includes(st)

    return (
        <div className="rounded-2xl border border-slate-100 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="slate">Claim #{claim.id}</Badge>
                    <StatusBadge status={claim.status} />
                    <Badge tone="blue">Invoice: {claim.invoice_id ?? "—"}</Badge>
                    <div className="text-xs text-slate-500">
                        Updated: {fmtDate(claim.updated_at || claim.created_at)}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-extrabold text-slate-900">
                        ₹ {money(claim.claim_amount ?? claim.total_amount ?? claim.net_amount ?? 0)}
                    </div>
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        Actions
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-4">
                <Info label="Claim Amount" value={`₹ ${money(claim.claim_amount ?? claim.total_amount ?? 0)}`} />
                <Info label="Approved" value={`₹ ${money(claim.approved_amount ?? 0)}`} />
                <Info label="Settled" value={`₹ ${money(claim.settled_amount ?? 0)}`} />
                <Info label="Insurer Ref" value={claim.insurer_ref || claim.claim_ref || "—"} />
                <div className="md:col-span-4">
                    <Info label="Notes" value={claim.notes || claim.remarks || "—"} />
                </div>
            </div>

            {open && (
                <ClaimActionsDialog
                    claim={claim}
                    guards={{ canSubmit, canAck, canApprove, canSettle, canReject, canCancel, canReopen, canQuery, canClose }}
                    onClose={() => setOpen(false)}
                    onDone={() => {
                        setOpen(false)
                        onChanged()
                    }}
                />
            )}
        </div>
    )
}

function ClaimActionsDialog({ claim, guards, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        notes: "",
        approved_amount: "",
        settled_amount: "",
        reason: "",
    })

    async function act(kind) {
        if (saving) return
        setSaving(true)
        try {
            const payload = {
                notes: form.notes || undefined,
                reason: form.reason || undefined,
                approved_amount: form.approved_amount === "" ? undefined : toNum(form.approved_amount),
                settled_amount: form.settled_amount === "" ? undefined : toNum(form.settled_amount),
            }

            if (kind === "submit") await billingSubmitClaim(claim.id, payload)
            if (kind === "ack") await billingAcknowledgeClaim(claim.id, payload)
            if (kind === "approve") await billingApproveClaim(claim.id, payload)
            if (kind === "settle") await billingSettleClaim(claim.id, payload)
            if (kind === "reject") await billingRejectClaim(claim.id, payload)
            if (kind === "cancel") await billingCancelClaim(claim.id, payload)
            if (kind === "reopen") await billingReopenClaim(claim.id, payload)
            if (kind === "query") await billingSetClaimUnderQuery(claim.id, payload)
            if (kind === "close") await billingCloseClaim(claim.id, payload)

            toast.success("Claim updated")
            onDone()
        } catch (e) {
            toast.error(e?.message || "Failed to update claim")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={`Claim #${claim.id} Actions`}
            onClose={onClose}
            wide
            right={
                <div className="flex items-center gap-2">
                    {guards.canSubmit && (
                        <Button onClick={() => act("submit")} disabled={saving} className="gap-2">
                            <Send className="h-4 w-4" />
                            Submit
                        </Button>
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Approved Amount (₹) (optional)">
                    <Input
                        inputMode="decimal"
                        value={form.approved_amount}
                        onChange={(e) => setForm({ ...form, approved_amount: e.target.value })}
                    />
                </Field>

                <Field label="Settled Amount (₹) (optional)">
                    <Input
                        inputMode="decimal"
                        value={form.settled_amount}
                        onChange={(e) => setForm({ ...form, settled_amount: e.target.value })}
                    />
                </Field>

                <Field label="Reason (optional)">
                    <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </Field>

                <div className="md:col-span-3">
                    <Field label="Notes (optional)">
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Field>
                </div>

                <div className="md:col-span-3 flex flex-wrap gap-2 pt-2">
                    {guards.canAck && (
                        <Button variant="outline" onClick={() => act("ack")} disabled={saving} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Acknowledge
                        </Button>
                    )}
                    {guards.canApprove && (
                        <Button variant="outline" onClick={() => act("approve")} disabled={saving} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                        </Button>
                    )}
                    {guards.canSettle && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!window.confirm("Mark as settled?")) return
                                act("settle")
                            }}
                            disabled={saving}
                            className="gap-2"
                        >
                            <IndianRupee className="h-4 w-4" />
                            Settle
                        </Button>
                    )}
                    {guards.canQuery && (
                        <Button variant="outline" onClick={() => act("query")} disabled={saving} className="gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Set Query
                        </Button>
                    )}
                    {guards.canClose && (
                        <Button variant="outline" onClick={() => act("close")} disabled={saving} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Close
                        </Button>
                    )}
                    {guards.canReject && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!window.confirm("Reject this claim?")) return
                                act("reject")
                            }}
                            disabled={saving}
                            className="gap-2"
                        >
                            <XCircle className="h-4 w-4" />
                            Reject
                        </Button>
                    )}
                    {guards.canCancel && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!window.confirm("Cancel this claim?")) return
                                act("cancel")
                            }}
                            disabled={saving}
                            className="gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Cancel
                        </Button>
                    )}
                    {guards.canReopen && (
                        <Button variant="outline" onClick={() => act("reopen")} disabled={saving} className="gap-2">
                            <RotateCcw className="h-4 w-4" />
                            Reopen
                        </Button>
                    )}
                </div>

                <div className="md:col-span-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    If your claim status names differ, adjust guards in <span className="font-bold">ClaimCard()</span>.
                </div>
            </div>
        </Modal>
    )
}
