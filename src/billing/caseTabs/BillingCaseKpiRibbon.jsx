// FILE: src/billing/components/BillingCaseKpiRibbon.jsx
import { useEffect, useMemo, useState } from "react"
import { Badge, Button, cn } from "../_ui"
import {
    IndianRupee,
    CheckCircle2,
    Wallet,
    Receipt,
    ChevronDown,
    ChevronUp,
    ArrowRight,
} from "lucide-react"

function clamp01(n) {
    const x = Number.isFinite(n) ? n : 0
    return Math.max(0, Math.min(1, x))
}

function pct(a, b) {
    const A = Number(a || 0)
    const B = Number(b || 0)
    if (B <= 0) return 0
    return clamp01(A / B)
}

function KpiTile({ title, value, icon: Icon, right, onClick, emphasize = false, className = "" }) {
    const Wrap = onClick ? "button" : "div"
    return (
        <Wrap
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={cn(
                "group relative flex w-full items-center gap-3 rounded-3xl border bg-white p-3 text-left shadow-sm transition",
                onClick ? "hover:-translate-y-[1px] hover:shadow-md" : "",
                emphasize ? "border-slate-900" : "border-slate-200",
                className
            )}
        >
            <div
                className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    emphasize ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800"
                )}
            >
                <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{title}</div>
                <div className="mt-0.5 truncate text-lg font-black text-slate-900">{value}</div>
            </div>

            {right ? <div className="shrink-0">{right}</div> : null}

            {onClick ? (
                <div className="absolute right-3 top-3 opacity-0 transition group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
            ) : null}
        </Wrap>
    )
}

export default function BillingCaseKpiRibbon({ totals, money, loading, onGoPayments, onGoAdvances, onGoInvoices }) {
    const [open, setOpen] = useState(false)

    // desktop open by default
    useEffect(() => {
        try {
            if (window.matchMedia("(min-width: 1024px)").matches) setOpen(true)
        } catch { }
    }, [])

    const computed = useMemo(() => {
        const billed = Number(totals?.totalBilled || 0)
        const paid = Number(totals?.totalPaid || 0)
        const advTotal = Number(totals?.totalAdvance || 0)
        const advAvail = Number(totals?.availableAdvance || 0)
        const due = Number(totals?.due || 0)

        const paidRatio = pct(paid, billed)
        const coveredAfterAdvance = Math.max(0, due - advAvail)

        return { billed, paid, advTotal, advAvail, due, paidRatio, coveredAfterAdvance }
    }, [totals])

    const dueTone = computed.due > 0 ? "amber" : "green"

    return (
        <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
            {/* header row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900">Financial Summary</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">
                        Quick view of billed, paid, advances & outstanding
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge tone={dueTone} className="whitespace-nowrap">
                        {computed.due > 0 ? "Payment Pending" : "All Clear"}
                    </Badge>

                    <button
                        type="button"
                        onClick={() => setOpen((s) => !s)}
                        className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                    >
                        {open ? (
                            <>
                                <ChevronUp className="h-4 w-4" /> Hide
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-4 w-4" /> Show
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* progress */}
           

            {/* ✅ MOBILE: swipe strip */}
            <div className="mt-3 md:hidden">
                <div className="overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex w-max snap-x snap-mandatory gap-2">
                        <KpiTile
                            className="min-w-[240px] snap-start"
                            title="Due"
                            value={`₹ ${money(computed.due)}`}
                            icon={IndianRupee}
                            emphasize
                            right={<Badge tone={computed.due > 0 ? "amber" : "green"}>{computed.due > 0 ? "Pending" : "Clear"}</Badge>}
                            onClick={computed.due > 0 ? onGoPayments : onGoInvoices}
                        />
                        <KpiTile className="min-w-[240px] snap-start" title="Paid" value={`₹ ${money(computed.paid)}`} icon={CheckCircle2} onClick={onGoPayments} />
                        <KpiTile className="min-w-[240px] snap-start" title="Billed" value={`₹ ${money(computed.billed)}`} icon={Receipt} onClick={onGoInvoices} />

                        {open ? (
                            <>
                                <KpiTile className="min-w-[240px] snap-start" title="Total Advance" value={`₹ ${money(computed.advTotal)}`} icon={Wallet} onClick={onGoAdvances} />
                                <KpiTile
                                    className="min-w-[240px] snap-start"
                                    title="Available Advance"
                                    value={`₹ ${money(computed.advAvail)}`}
                                    icon={Wallet}
                                    right={<Badge tone={computed.advAvail > 0 ? "green" : "slate"}>{computed.advAvail > 0 ? "Usable" : "—"}</Badge>}
                                    onClick={onGoAdvances}
                                />
                                <KpiTile
                                    className="min-w-[240px] snap-start"
                                    title="Due After Advance"
                                    value={`₹ ${money(computed.coveredAfterAdvance)}`}
                                    icon={IndianRupee}
                                    right={<Badge tone={computed.coveredAfterAdvance > 0 ? "amber" : "green"}>{computed.coveredAfterAdvance > 0 ? "Still Pending" : "Can be Covered"}</Badge>}
                                    onClick={onGoAdvances}
                                />
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ✅ MD+: clean grid (no scroll) */}
            <div className="mt-3 hidden md:block">
                <div className="grid grid-cols-3 gap-2">
                    <KpiTile
                        title="Due"
                        value={`₹ ${money(computed.due)}`}
                        icon={IndianRupee}
                        emphasize
                        right={<Badge tone={computed.due > 0 ? "amber" : "green"}>{computed.due > 0 ? "Pending" : "Clear"}</Badge>}
                        onClick={computed.due > 0 ? onGoPayments : onGoInvoices}
                    />
                    <KpiTile title="Paid" value={`₹ ${money(computed.paid)}`} icon={CheckCircle2} onClick={onGoPayments} />
                    <KpiTile title="Billed" value={`₹ ${money(computed.billed)}`} icon={Receipt} onClick={onGoInvoices} />
                </div>

                {open ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        <KpiTile title="Total Advance" value={`₹ ${money(computed.advTotal)}`} icon={Wallet} onClick={onGoAdvances} />
                        <KpiTile
                            title="Available Advance"
                            value={`₹ ${money(computed.advAvail)}`}
                            icon={Wallet}
                            right={<Badge tone={computed.advAvail > 0 ? "green" : "slate"}>{computed.advAvail > 0 ? "Usable" : "—"}</Badge>}
                            onClick={onGoAdvances}
                        />
                        <KpiTile
                            title="Due After Advance"
                            value={`₹ ${money(computed.coveredAfterAdvance)}`}
                            icon={IndianRupee}
                            right={<Badge tone={computed.coveredAfterAdvance > 0 ? "amber" : "green"}>{computed.coveredAfterAdvance > 0 ? "Still Pending" : "Can be Covered"}</Badge>}
                            onClick={onGoAdvances}
                        />
                    </div>
                ) : null}
            </div>

            {/* quick actions row */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button variant="outline" onClick={onGoInvoices} disabled={loading} className="gap-2 ">
                    <Receipt className="h-4 w-4" />
                    Open Invoices
                </Button>
                <Button variant="outline" onClick={onGoPayments} disabled={loading} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Record Payment
                </Button>
                <Button variant="outline" onClick={onGoAdvances} disabled={loading} className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Manage Advances
                </Button>
            </div>
        </div>
    )
}
