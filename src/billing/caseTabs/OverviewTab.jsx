// FILE: src/billing/caseTabs/OverviewTab.jsx
import { useMemo, useState } from "react"
import { RefreshCcw, SlidersHorizontal, Search, ChevronDown, ChevronUp, ArrowDownUp } from "lucide-react"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, cn, money, Input } from "../_ui"
import { Info } from "./shared"

function safe(v) {
    const s = String(v ?? "").trim()
    return s ? s : "—"
}

function toneForModule(mod) {
    const m = String(mod || "").toUpperCase()
    if (["PHARM", "PHARMACY", "DRUGS"].includes(m)) return "purple"
    if (["LAB", "LIS"].includes(m)) return "blue"
    if (["RAD", "RIS", "RADIOLOGY"].includes(m)) return "indigo"
    if (["ROOM", "IPD", "BED"].includes(m)) return "amber"
    if (["PROC", "OT", "SURG"].includes(m)) return "green"
    return "slate"
}

function ModuleCard({ item, index }) {
    const amount = Number(item?.amount || 0)
    const label = safe(item?.label)
    const mod = safe(item?.module)
    return (
        <div className="group rounded-3xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={toneForModule(mod)} className="whitespace-nowrap">
                            {mod}
                        </Badge>
                        <span className="text-xs font-extrabold text-slate-400">#{index + 1}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-black text-slate-900">{label}</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">Module total</div>
                </div>

                <div className="text-right">
                    <div className="text-base font-black text-slate-900">₹ {money(amount)}</div>
                    <div className="mt-0.5 text-[11px] font-bold text-slate-500">Gross</div>
                </div>
            </div>
        </div>
    )
}

function Pill({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-900">{safe(value)}</div>
        </div>
    )
}

export default function OverviewTab({ loading, dashboard, caseRow, onReload }) {
    const particulars = dashboard?.particulars || []
    const totals = dashboard?.totals || {}

    const [q, setQ] = useState("")
    const [sort, setSort] = useState("HIGH") // HIGH | LOW
    const [openAll, setOpenAll] = useState(false)

    const filtered = useMemo(() => {
        const query = String(q || "").trim().toLowerCase()
        let arr = [...particulars]

        if (query) {
            arr = arr.filter((p) => {
                const a = `${p?.module ?? ""} ${p?.label ?? ""}`.toLowerCase()
                return a.includes(query)
            })
        }

        arr.sort((a, b) => {
            const A = Number(a?.amount || 0)
            const B = Number(b?.amount || 0)
            return sort === "HIGH" ? B - A : A - B
        })

        return arr
    }, [particulars, q, sort])

    const visible = useMemo(() => {
        if (openAll) return filtered
        return filtered.slice(0, 6)
    }, [filtered, openAll])

    // IMPORTANT: No raw IDs. Show only human labels if available.
    // You can enrich later by sending payer/referrer names from API.
    const quick = useMemo(() => {
        const payerMode = caseRow?.payer_mode || "SELF"
        const billType = caseRow?.default_payer_type || "Not set"

        const payerName =
            caseRow?.default_payer_name ||
            caseRow?.default_payer_display ||
            caseRow?.payer_name ||
            "Not set"

        const referralName =
            caseRow?.referral_user_name ||   // ✅ name from backend
            caseRow?.referral_display ||
            caseRow?.referrer_name ||
            (caseRow?.referral_user_id ? "Assigned" : "Not set")

        const notes = caseRow?.referral_notes || "—"

        return { payerMode, billType, payerName, referralName, notes }
    }, [caseRow])

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* LEFT: Modules + totals */}
            <Card className="xl:col-span-2">
                <CardHeader
                    title="Overview"
                    subtitle="Module totals and current billing snapshot"
                    right={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={onReload}
                                disabled={loading}
                                className="gap-2"
                            >
                                <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                                Reload
                            </Button>
                        </div>
                    }
                />

                <CardBody className="space-y-4">
                    {/* Top controls */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search module / label..."
                                className="pl-9"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setSort((s) => (s === "HIGH" ? "LOW" : "HIGH"))}
                                className="gap-2"
                            >
                                <ArrowDownUp className="h-4 w-4" />
                                {sort === "HIGH" ? "High → Low" : "Low → High"}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => setOpenAll((s) => !s)}
                                className="gap-2"
                                disabled={filtered.length <= 6}
                            >
                                {openAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                {openAll ? "Show Less" : "Show All"}
                            </Button>
                        </div>
                    </div>

                    {/* Totals strip (premium dashboard look) */}
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Total Bill</div>
                            <div className="mt-1 text-lg font-black text-slate-900">₹ {money(totals.total_bill || 0)}</div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Payments Received</div>
                            <div className="mt-1 text-lg font-black text-slate-900">₹ {money(totals.payments_received || 0)}</div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Net Deposit</div>
                            <div className="mt-1 text-lg font-black text-slate-900">₹ {money(totals.net_deposit || 0)}</div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Balance</div>
                            <div className="mt-1 text-lg font-black text-slate-900">₹ {money(totals.balance || 0)}</div>
                        </div>
                    </div>

                    {/* Module cards */}
                    {loading ? (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
                            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
                            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
                            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState title="No billing yet" desc="Add item lines to generate totals per module." />
                    ) : (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {visible.map((p, idx) => (
                                <ModuleCard key={`${p?.module || "M"}-${idx}`} item={p} index={idx} />
                            ))}
                        </div>
                    )}

                    {/* Helpful footer note */}
                    {!loading && filtered.length > 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600">
                            Tip: Use <span className="font-black text-slate-900">Invoices</span> tab to see bill-wise breakup and approvals.
                        </div>
                    ) : null}
                </CardBody>
            </Card>

            {/* RIGHT: Quick Info (no raw IDs) */}
            <Card>
                <CardHeader
                    title="Quick Info"
                    subtitle="Payer & referral snapshot"
                    right={<SlidersHorizontal className="h-5 w-5 text-slate-400" />}
                />
                <CardBody className="space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                        <Pill label="Payer Mode" value={quick.payerMode} />
                        <Pill label="Default Bill Type" value={quick.billType} />
                        <Pill label="Default Payer" value={quick.payerName} />
                        <Pill label="Referral" value={quick.referralName} />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Referral Notes</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">
                            {safe(quick.notes)}
                        </div>
                    </div>

                    {/* Optional: keep old Info components if you still want them */}
                    {/* <Info label="Payer Mode" value={quick.payerMode} /> */}
                </CardBody>
            </Card>
        </div>
    )
}
