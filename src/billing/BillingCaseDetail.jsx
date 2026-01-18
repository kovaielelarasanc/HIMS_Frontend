// FILE: src/billing/BillingCaseDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { useCan } from "../hooks/useCan"

import {
    billingGetCase,
    billingGetInsurance,
    billingListAdvances,
    billingListInvoices,
    billingListPayments,
    billingListRefunds,
    billingCaseDashboard,
    billingCaseInvoiceSummary,
    billingMetaPayers,
    billingMetaReferrers,
    billingGetCaseSettings,
    billingUpdateCaseSettings,
    billingCaseFinance,
    isCanceledError,
} from "@/api/billings"

import { Badge, Button, StatusBadge, cn, money } from "./_ui"
import {
    ArrowLeft,
    FilePlus2,
    IndianRupee,
    RefreshCcw,
    Wallet,
    Shield,
    Layers,
    ListChecks,
    Settings,
    CheckCircle2,
} from "lucide-react"

import BillingPrintDownload from "@/billing/print/BillingPrintDownload"
import InsuranceTab from "./insurance/InsuranceTab"

import OverviewTab from "./caseTabs/OverviewTab"
import InvoiceSummaryTab from "./caseTabs/InvoiceSummaryTab"
import InvoicesTab from "./caseTabs/InvoicesTab"
import PaymentsTab from "./caseTabs/PaymentsTab"
import AdvancesTab from "./caseTabs/AdvancesTab"
import SettingsTab from "./caseTabs/SettingsTab"

import { StatCard, normItems, toNum, upper } from "./caseTabs/shared"

const TABS = [
    { key: "OVERVIEW", label: "Overview", icon: Layers },
    { key: "INVOICE_SUMMARY", label: "Invoice Summary", icon: ListChecks },
    { key: "ADD_ITEM", label: "Add Item Line", icon: FilePlus2 },
    { key: "INVOICES", label: "Invoices", icon: Layers },
    { key: "PAYMENTS", label: "Payments", icon: CheckCircle2 },
    { key: "ADVANCES", label: "Advances", icon: Wallet },
    { key: "INSURANCE", label: "Insurance / Claims", icon: Shield },
    { key: "SETTINGS", label: "Bill Type & Referral", icon: Settings },
]

export default function BillingCaseDetail() {
    const canManageInsurance = useCan("billing.insurance.manage")
    const { caseId } = useParams()
    const nav = useNavigate()

    const [tab, setTab] = useState("OVERVIEW")
    const [loading, setLoading] = useState(true)

    const [finance, setFinance] = useState(null)
    const [caseRow, setCaseRow] = useState(null)
    const [invoices, setInvoices] = useState([])
    const [payments, setPayments] = useState([])
    const [advances, setAdvances] = useState([])
    const [refunds, setRefunds] = useState([])

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

            const [inv, pay, adv, ref, fin] = await Promise.all([
                billingListInvoices(caseId, {}, { signal: ac.signal }),
                billingListPayments(caseId, {}, { signal: ac.signal }),
                billingListAdvances(caseId, {}, { signal: ac.signal }),
                billingListRefunds?.(caseId, {}, { signal: ac.signal }).catch(() => []),
                billingCaseFinance(caseId).catch(() => null),
            ])

            setInvoices(normItems(inv))
            setPayments(normItems(pay))
            setAdvances(normItems(adv))
            setRefunds(normItems(ref))
            setFinance(fin)

            // optional: keep insurance cache warm (safe)
            await billingGetInsurance(caseId, { signal: ac.signal }).catch(() => null)
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
        if (tab === "INVOICE_SUMMARY" && !summary) loadSummary({ group_by: "module", status: "" })
        if (tab === "SETTINGS") loadSettingsMeta()
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

        const totalPaid = (payments || []).reduce((s, p) => {
            if (upper(p?.status) === "VOID") return s
            const k = upper(p?.kind || "")
            if (["REFUND", "REVERSAL", "CHARGEBACK"].includes(k)) return s
            return s + toNum(p.amount)
        }, 0)

        const totalAdvance = (advances || []).reduce((s, a) => {
            const t = upper(a.entry_type || "ADVANCE")
            const amt = toNum(a.amount)
            return t === "ADVANCE" ? s + amt : s
        }, 0)

        const advanceBalanceLocal = (advances || []).reduce((s, a) => {
            const t = upper(a.entry_type || "ADVANCE")
            const amt = toNum(a.amount)
            if (t === "REFUND") return s - amt
            if (t === "ADJUSTMENT") return s - amt
            return s + amt
        }, 0)

        const availableAdvance = toNum(
            finance?.finance?.advances?.advance_balance ??
            finance?.advances?.advance_balance ??
            finance?.advance_balance ??
            advanceBalanceLocal
        )

        const due = Math.max(0, totalBilled - totalPaid)

        return { totalBilled, totalPaid, totalAdvance, availableAdvance, due }
    }, [invoices, payments, advances, finance])

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
                        }}
                        disabled={loading}
                    >
                        <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                        Refresh
                    </Button>

                    <BillingPrintDownload
                        caseId={Number(caseId)}
                        caseNumber={caseRow?.case_number}
                        patientName={caseRow?.patient_name}
                        uhid={caseRow?.uhid}
                    />

                    <Button onClick={() => nav(`/billing/cases/${caseId}/add-item`)} className="gap-2">
                        <FilePlus2 size={16} />
                        Add Item Line
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard title="Billed" value={`₹ ${money(totals.totalBilled)}`} icon={IndianRupee} />
                <StatCard title="Paid" value={`₹ ${money(totals.totalPaid)}`} icon={CheckCircle2} />
                <StatCard title="Total Advance" value={`₹ ${money(totals.totalAdvance)}`} icon={Wallet} />
                <StatCard
                    title="Available Advance"
                    value={`₹ ${money(totals.availableAdvance)}`}
                    icon={Wallet}
                    right={
                        <Badge tone={totals.availableAdvance > 0 ? "green" : "slate"}>
                            {totals.availableAdvance > 0 ? "Usable" : "—"}
                        </Badge>
                    }
                />
                <StatCard
                    title="Due"
                    value={`₹ ${money(totals.due)}`}
                    right={<Badge tone={totals.due > 0 ? "amber" : "green"}>{totals.due > 0 ? "Pending" : "Clear"}</Badge>}
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
                        <OverviewTab loading={dashLoading} dashboard={dashboard} caseRow={caseRow} onReload={loadDashboard} />
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
                        <div className="rounded-2xl border border-slate-100 bg-white p-4">
                            <div className="text-base font-extrabold text-slate-900">Add Item Line</div>
                            <div className="mt-1 text-sm text-slate-600">
                                Use smart particulars selection & automation in Add Item screen
                            </div>
                            <div className="mt-4">
                                <Button onClick={() => nav(`/billing/cases/${caseId}/add-item`)} className="gap-2">
                                    <FilePlus2 className="h-4 w-4" />
                                    Open Add Item
                                </Button>
                            </div>
                        </div>
                    )}

                    {tab === "INVOICES" && <InvoicesTab invoices={invoices} onOpen={(id) => nav(`/billing/invoices/${id}`)} />}

                    {tab === "PAYMENTS" && (
                        <PaymentsTab caseId={caseId} payments={payments} invoices={payableInvoices} onDone={loadAll} />
                    )}

                    {tab === "ADVANCES" && (
                        <AdvancesTab caseId={caseId} advances={advances} refunds={refunds} due={totals.due} onDone={loadAll} />
                    )}

                    {tab === "INSURANCE" && (
                        <InsuranceTab caseId={caseId} canManage={canManageInsurance} invoices={invoices} />
                    )}

                    {tab === "SETTINGS" && (
                        <SettingsTab
                            loading={metaLoading}
                            payerMeta={payerMeta}
                            refMeta={refMeta}
                            value={settings}
                            onChange={setSettings}
                            onReloadMeta={loadSettingsMeta}
                            saving={savingSettings}
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
                        />
                    )}
                </>
            )}
        </div>
    )
}
