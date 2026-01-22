// FILE: frontend/src/billing/caseTabs/CollectTab.jsx
import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CreditCard, Receipt, RefreshCcw, Sparkles, Plus, X } from "lucide-react"

import { getCaseFinancials, postCasePayment } from "@/api/billingPayments"
import { Badge, Button, Card, CardBody, Field, Input, Select, money, cn } from "../_ui"

const MODES = [
    { value: "CASH", label: "Cash" },
    { value: "CARD", label: "Card" },
    { value: "UPI", label: "UPI" },
    { value: "BANK", label: "Bank" },
    { value: "WALLET", label: "Wallet" },
]

// ---------- utils ----------
function toNum(x) {
    const s = String(x ?? "").replace(/,/g, "").trim()
    const n = Number(s || 0)
    return Number.isFinite(n) ? n : 0
}
function round2(n) {
    return Math.round((toNum(n) + Number.EPSILON) * 100) / 100
}
function as2(n) {
    return round2(n).toFixed(2)
}
function sanitizeMoneyInput(raw) {
    // keep digits + single dot
    const s = String(raw ?? "")
        .replace(/[^\d.]/g, "")
        .replace(/(\..*)\./g, "$1")
    return s
}
function mkKey() {
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function MiniToggle({ checked, onChange, label }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <span
                className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition",
                    checked ? "bg-slate-900" : "bg-slate-200"
                )}
                onClick={() => onChange(!checked)}
                role="switch"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onChange(!checked)
                }}
            >
                <span
                    className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                        checked ? "translate-x-5" : "translate-x-1"
                    )}
                />
            </span>
            <span className="text-sm text-slate-700">{label}</span>
        </label>
    )
}

export default function CollectTab({ caseId, refreshKey }) {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [data, setData] = useState(null)

    // defaults for quick add/fill
    const [defaultMode, setDefaultMode] = useState("CASH")

    const [notes, setNotes] = useState("")
    const [q, setQ] = useState("")

    // UX
    const [showSettled, setShowSettled] = useState(false)

    /**
     * splitsByInv:
     * {
     *   [invId]: [{ key, mode, amount, txn_ref }]
     * }
     */
    const [splitsByInv, setSplitsByInv] = useState({})

    async function load() {
        if (!caseId) return
        try {
            setLoading(true)
            const d = await getCaseFinancials(caseId)
            setData(d)

            const invs = d?.invoices || []
            const ids = new Set(invs.map((i) => Number(i.id)))

            setSplitsByInv((prev) => {
                const next = { ...prev }

                // ensure keys exist, and clear splits for settled invoices
                for (const inv of invs) {
                    const id = Number(inv.id)
                    const due = round2(inv.due)
                    if (!next[id]) {
                        // create minimal default split row (empty amount)
                        next[id] = [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }]
                    } else {
                        // if invoice is now settled, clear amounts
                        if (due <= 0) {
                            next[id] = [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }]
                        } else {
                            // keep existing splits but sanitize
                            next[id] = (next[id] || []).map((s) => ({
                                ...s,
                                amount: s?.amount ? sanitizeMoneyInput(s.amount) : "",
                                txn_ref: s?.txn_ref ?? "",
                                mode: s?.mode || defaultMode,
                                key: s?.key || mkKey(),
                            }))
                            if (next[id].length === 0) next[id] = [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }]
                        }
                    }
                }

                // drop stale invoices
                for (const k of Object.keys(next)) {
                    if (!ids.has(Number(k))) delete next[k]
                }

                return next
            })
        } catch (e) {
            toast.error(e?.message || "Failed to load")
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, refreshKey])

    const allInvoices = useMemo(() => {
        return [...(data?.invoices || [])].map((x) => ({
            ...x,
            _id: Number(x.id),
            _grand: round2(x.grand_total),
            _paid: round2(x.paid),
            _due: round2(x.due),
            _status: String(x.status || ""),
            _module: String(x.module || ""),
            _invoiceNo: String(x.invoice_number || ""),
            _payerType: String(x.payer_type || ""),
        }))
    }, [data])

    const filteredInvoices = useMemo(() => {
        const needle = (q || "").trim().toLowerCase()
        let list = [...allInvoices]

        if (!showSettled) list = list.filter((r) => r._due > 0)

        if (!needle) return list
        return list.filter((r) => {
            const hay = `${r._invoiceNo} ${r._module} ${r._payerType} ${r._status}`.toLowerCase()
            return hay.includes(needle)
        })
    }, [allInvoices, q, showSettled])

    const dueByIdLocal = useMemo(() => {
        const m = new Map()
        for (const inv of allInvoices) m.set(inv._id, inv._due)
        return m
    }, [allInvoices])

    function invPlanned(invId) {
        const rows = splitsByInv?.[Number(invId)] || []
        return round2(
            rows.reduce((s, r) => s + round2(r?.amount), 0)
        )
    }

    const invalidByInv = useMemo(() => {
        const out = {}
        for (const inv of allInvoices) {
            const due = inv._due
            const planned = invPlanned(inv._id)
            out[inv._id] = planned > due + 0.0001
        }
        return out
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allInvoices, splitsByInv])

    const totals = useMemo(() => {
        let paying = 0
        let lines = 0

        for (const inv of allInvoices) {
            const p = invPlanned(inv._id)
            if (p > 0) {
                paying += p
                lines += 1
            }
        }

        return { paying: round2(paying), lines }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allInvoices, splitsByInv])

    const modeTotals = useMemo(() => {
        // group totals by mode (ignoring txn_ref here)
        const m = new Map()
        for (const inv of allInvoices) {
            const splits = splitsByInv?.[inv._id] || []
            for (const s of splits) {
                const amt = round2(s?.amount)
                if (amt <= 0) continue
                const key = String(s?.mode || "CASH")
                m.set(key, round2((m.get(key) || 0) + amt))
            }
        }
        return m
    }, [allInvoices, splitsByInv])

    const caseDue = round2(data?.totals?.due)
    const walletBal = round2(data?.advance_wallet?.balance)
    const remaining = Math.max(0, round2(caseDue - totals.paying))

    // -------- split ops --------
    function setSplit(invId, splitKey, patch) {
        const id = Number(invId)
        setSplitsByInv((prev) => {
            const rows = [...(prev?.[id] || [])]
            const idx = rows.findIndex((r) => r.key === splitKey)
            if (idx >= 0) rows[idx] = { ...rows[idx], ...patch }
            return { ...prev, [id]: rows }
        })
    }

    function addSplit(invId, seed = {}) {
        const id = Number(invId)
        setSplitsByInv((prev) => {
            const rows = [...(prev?.[id] || [])]
            rows.push({
                key: mkKey(),
                mode: seed.mode || defaultMode,
                amount: seed.amount ?? "",
                txn_ref: seed.txn_ref ?? "",
            })
            return { ...prev, [id]: rows }
        })
    }

    function removeSplit(invId, splitKey) {
        const id = Number(invId)
        setSplitsByInv((prev) => {
            const rows = (prev?.[id] || []).filter((r) => r.key !== splitKey)
            const safe = rows.length ? rows : [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }]
            return { ...prev, [id]: safe }
        })
    }

    function clearInvoice(invId) {
        const id = Number(invId)
        setSplitsByInv((prev) => ({
            ...prev,
            [id]: [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }],
        }))
    }

    function maxInvoice(invId) {
        const id = Number(invId)
        const due = round2(dueByIdLocal.get(id) || 0)
        if (due <= 0) return

        const planned = invPlanned(id)
        const rem = round2(due - planned)
        if (rem <= 0) return

        // add a new split for remaining due (default mode)
        addSplit(id, { mode: defaultMode, amount: as2(rem) })
    }

    function fillFullDueVisible() {
        for (const inv of filteredInvoices) {
            maxInvoice(inv._id)
        }
    }

    function clearAll() {
        const next = {}
        for (const inv of allInvoices) {
            next[inv._id] = [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }]
        }
        setSplitsByInv(next)
    }

    // -------- submit --------
    async function submit() {
        if (!caseId) return

        // block if any invoice planned > due
        const bad = allInvoices.find((inv) => invalidByInv[inv._id])
        if (bad) {
            toast.error(`Planned amount exceeds due for ${bad._invoiceNo}. Please adjust.`)
            return
        }

        if (totals.paying <= 0) {
            toast.error("Enter at least one payment amount")
            return
        }

        setSubmitting(true)
        try {
            // ✅ fresh dues
            const fresh = await getCaseFinancials(caseId)
            setData(fresh)

            const dueById = new Map((fresh?.invoices || []).map((i) => [Number(i.id), round2(i.due)]))

            /**
             * Build “payment groups”:
             * key = mode + "|" + (txn_ref||"")
             * Each group -> one API call (one receipt)
             */
            const groups = new Map()
            const warnAdjusted = []

            for (const inv of fresh?.invoices || []) {
                const invId = Number(inv.id)
                const invDue = round2(dueById.get(invId) || 0)
                if (invDue <= 0) continue

                const splits = splitsByInv?.[invId] || []
                // total planned for this invoice
                let planned = splits.reduce((s, sp) => s + round2(sp?.amount), 0)
                planned = round2(planned)

                if (planned <= 0) continue

                // ✅ clamp per invoice to current due (reduce from the last splits)
                if (planned > invDue + 0.0001) {
                    let over = round2(planned - invDue)
                    // reduce from end
                    const adjustedSplits = [...splits]
                    for (let i = adjustedSplits.length - 1; i >= 0 && over > 0; i--) {
                        const amt = round2(adjustedSplits[i]?.amount)
                        if (amt <= 0) continue
                        const take = Math.min(amt, over)
                        const nextAmt = round2(amt - take)
                        adjustedSplits[i] = { ...adjustedSplits[i], amount: nextAmt > 0 ? as2(nextAmt) : "" }
                        over = round2(over - take)
                    }
                    warnAdjusted.push(invId)
                    // update state for this invoice (so UI matches)
                    setSplitsByInv((prev) => ({ ...prev, [invId]: adjustedSplits }))
                }

                // rebuild using possibly adjusted values
                let invSum = 0
                for (const sp of (splitsByInv?.[invId] || splits)) {
                    const mode = String(sp?.mode || "CASH")
                    const txn = String(sp?.txn_ref || "").trim()
                    const amt = round2(sp?.amount)
                    if (amt <= 0) continue

                    // if invoice due changed and we adjusted, protect again
                    const dueNow = round2(dueById.get(invId) || 0)
                    const allow = Math.max(0, round2(dueNow - invSum))
                    const finalAmt = amt > allow ? allow : amt
                    if (finalAmt <= 0) continue

                    invSum = round2(invSum + finalAmt)

                    const gKey = `${mode}|${txn}`
                    if (!groups.has(gKey)) {
                        groups.set(gKey, {
                            mode,
                            txn_ref: txn || null,
                            allocations: new Map(), // invoice_id -> amount
                        })
                    }
                    const g = groups.get(gKey)
                    g.allocations.set(invId, round2((g.allocations.get(invId) || 0) + finalAmt))
                }
            }

            if (warnAdjusted.length) {
                toast.message("Some lines were adjusted to latest due. Please review.")
            }

            const groupList = [...groups.values()].map((g) => ({
                mode: g.mode,
                txn_ref: g.txn_ref,
                allocations: [...g.allocations.entries()].map(([invoice_id, amount]) => ({
                    invoice_id,
                    amount: round2(amount),
                })),
            }))

            // nothing left
            const hasAny = groupList.some((g) => g.allocations.some((a) => round2(a.amount) > 0))
            if (!hasAny) {
                toast.error("No outstanding due for selected lines. Refresh and try again.")
                return
            }

            // ✅ Post sequentially (multiple receipts)
            const receipts = []
            for (const g of groupList) {
                const allocs = g.allocations
                    .map((a) => ({ ...a, amount: round2(a.amount) }))
                    .filter((a) => a.amount > 0)

                if (!allocs.length) continue

                const total = round2(allocs.reduce((s, a) => s + round2(a.amount), 0))

                const payload = {
                    mode: g.mode,
                    txn_ref: g.txn_ref,
                    notes: notes || null,
                    amount: as2(total),
                    allocations: allocs.map((a) => ({ invoice_id: a.invoice_id, amount: as2(a.amount) })),
                    payer_type: "PATIENT",
                    payer_id: null,
                }

                const res = await postCasePayment(caseId, payload)
                if (res?.receipt_number) receipts.push(res.receipt_number)
            }

            toast.success(
                receipts.length
                    ? `Payment recorded (${receipts.length} receipt${receipts.length > 1 ? "s" : ""}: ${receipts.join(", ")})`
                    : "Payment recorded"
            )

            await load()
            // keep notes, reset splits
            clearAll()
        } catch (e) {
            toast.error(e?.message || "Payment failed")
            await load().catch(() => null)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden border-slate-100">
                {/* Header */}
                <div className="p-4 md:p-5 bg-gradient-to-r from-white via-slate-50 to-white">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100">
                                    <Receipt className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="text-lg font-semibold text-slate-900">Collect Payment</div>
                                        <Badge variant="soft">Split by mode</Badge>
                                        {submitting && <Badge variant="outline">Processing…</Badge>}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-0.5">
                                        Split each invoice into CASH/UPI/CARD/BANK etc. System will generate multiple receipts automatically.
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full">
                                    Total Due: <span className="ml-1 font-semibold">{money(caseDue)}</span>
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                    Paying Now: <span className="ml-1 font-semibold">{money(totals.paying)}</span>
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                    Remaining: <span className="ml-1 font-semibold">{money(remaining)}</span>
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                    Advance Wallet: <span className="ml-1 font-semibold">{money(walletBal)}</span>
                                </Badge>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {[...modeTotals.entries()]
                                    .filter(([, v]) => round2(v) > 0)
                                    .map(([k, v]) => (
                                        <Badge key={k} variant="soft" className="rounded-full">
                                            {k}: <span className="ml-1 font-semibold">{money(v)}</span>
                                        </Badge>
                                    ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                            <MiniToggle checked={showSettled} onChange={setShowSettled} label="Show settled" />
                            <Button variant="ghost" onClick={load} disabled={loading || submitting}>
                                <RefreshCcw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mt-4">
                        <div className="lg:col-span-4">
                            <Field label="Search">
                                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice no / module / status" />
                            </Field>
                        </div>

                        <div className="lg:col-span-3">
                            <Field label="Default mode (for new splits / MAX)">
                                <Select value={defaultMode} onChange={(e) => setDefaultMode(e.target.value)} disabled={submitting}>
                                    {MODES.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        </div>

                        <div className="lg:col-span-3">
                            <Field label="Notes (optional)">
                                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarks" disabled={submitting} />
                            </Field>
                        </div>

                        <div className="lg:col-span-2 flex items-end gap-2">
                            <Button className="w-full" onClick={fillFullDueVisible} variant="secondary" disabled={loading || submitting}>
                                <Sparkles className="h-4 w-4 mr-2" />
                                MAX (Visible)
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Desktop table */}
                <CardBody className="p-0">
                    <div className="hidden md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-slate-600">
                                        <th className="p-3">Invoice</th>
                                        <th className="p-3">Module</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Grand</th>
                                        <th className="p-3 text-right">Paid</th>
                                        <th className="p-3 text-right">Due</th>
                                        <th className="p-3">Split payments</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {(filteredInvoices || []).map((inv) => {
                                        const disabled = inv._due <= 0 || submitting
                                        const splits = splitsByInv?.[inv._id] || [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }]
                                        const planned = invPlanned(inv._id)
                                        const bad = !!invalidByInv[inv._id]

                                        return (
                                            <tr key={inv._id} className={cn("border-t align-top", bad && "bg-rose-50/40")}>
                                                <td className="p-3 font-semibold text-slate-900">{inv._invoiceNo}</td>
                                                <td className="p-3">{inv._module || "-"}</td>
                                                <td className="p-3">
                                                    <Badge variant={inv._due <= 0 ? "outline" : "soft"}>{inv._status || "-"}</Badge>
                                                </td>
                                                <td className="p-3 text-right">{money(inv._grand)}</td>
                                                <td className="p-3 text-right">{money(inv._paid)}</td>
                                                <td className="p-3 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={cn(inv._due <= 0 ? "text-slate-400" : "font-semibold text-slate-900")}>
                                                            {money(inv._due)}
                                                        </span>
                                                        {planned > 0 && (
                                                            <span className={cn("text-xs", bad ? "text-rose-700" : "text-slate-500")}>
                                                                Planned: {money(planned)}
                                                            </span>
                                                        )}
                                                        {bad && <span className="text-xs text-rose-700">Exceeds due</span>}
                                                    </div>
                                                </td>

                                                <td className="p-3">
                                                    <div className={cn("rounded-2xl border p-3", bad ? "border-rose-200 bg-white" : "border-slate-100 bg-white")}>
                                                        <div className="space-y-2">
                                                            {splits.map((s, idx) => {
                                                                const amtVal = s?.amount ?? ""
                                                                const showRemove = splits.length > 1
                                                                return (
                                                                    <div key={s.key} className="flex flex-wrap items-center gap-2">
                                                                        <Select
                                                                            className="h-9 w-28"
                                                                            value={s.mode || "CASH"}
                                                                            disabled={disabled}
                                                                            onChange={(e) => setSplit(inv._id, s.key, { mode: e.target.value })}
                                                                        >
                                                                            {MODES.map((m) => (
                                                                                <option key={m.value} value={m.value}>
                                                                                    {m.label}
                                                                                </option>
                                                                            ))}
                                                                        </Select>

                                                                        <Input
                                                                            className="h-9 w-28 text-right"
                                                                            placeholder="0.00"
                                                                            value={amtVal}
                                                                            disabled={disabled}
                                                                            inputMode="decimal"
                                                                            onChange={(e) => setSplit(inv._id, s.key, { amount: sanitizeMoneyInput(e.target.value) })}
                                                                            onBlur={() => {
                                                                                const v = round2(amtVal)
                                                                                setSplit(inv._id, s.key, { amount: v > 0 ? as2(v) : "" })
                                                                            }}
                                                                        />

                                                                        <Input
                                                                            className="h-9 flex-1 min-w-[180px]"
                                                                            placeholder="Txn ref (optional)"
                                                                            value={s.txn_ref ?? ""}
                                                                            disabled={disabled}
                                                                            onChange={(e) => setSplit(inv._id, s.key, { txn_ref: e.target.value })}
                                                                        />

                                                                        {showRemove && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                className="h-9 px-3"
                                                                                disabled={disabled}
                                                                                onClick={() => removeSplit(inv._id, s.key)}
                                                                                title="Remove split"
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        )}

                                                                        {/* only show on last split line */}
                                                                        {idx === splits.length - 1 && (
                                                                            <div className="ml-auto flex items-center gap-2">
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="secondary"
                                                                                    className="h-9 px-3"
                                                                                    disabled={disabled}
                                                                                    onClick={() => addSplit(inv._id, { mode: defaultMode, amount: "" })}
                                                                                    title="Add split"
                                                                                >
                                                                                    <Plus className="h-4 w-4 mr-2" />
                                                                                    Split
                                                                                </Button>

                                                                                <Button
                                                                                    type="button"
                                                                                    variant="secondary"
                                                                                    className="h-9 px-3"
                                                                                    disabled={disabled || inv._due <= 0}
                                                                                    onClick={() => maxInvoice(inv._id)}
                                                                                    title="Add remaining due as a new split (default mode)"
                                                                                >
                                                                                    MAX
                                                                                </Button>

                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    className="h-9 px-3"
                                                                                    disabled={disabled}
                                                                                    onClick={() => clearInvoice(inv._id)}
                                                                                    title="Clear this invoice"
                                                                                >
                                                                                    Clear
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}

                                    {!loading && (filteredInvoices?.length || 0) === 0 && (
                                        <tr>
                                            <td className="p-8 text-center text-slate-500" colSpan={7}>
                                                No invoices found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile view */}
                    <div className="md:hidden p-3 space-y-3">
                        {(filteredInvoices || []).map((inv) => {
                            const disabled = inv._due <= 0 || submitting
                            const splits = splitsByInv?.[inv._id] || [{ key: mkKey(), mode: defaultMode, amount: "", txn_ref: "" }]
                            const planned = invPlanned(inv._id)
                            const bad = !!invalidByInv[inv._id]

                            return (
                                <div key={inv._id} className={cn("rounded-2xl border p-4 bg-white", bad ? "border-rose-200" : "border-slate-100")}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold text-slate-900 truncate">{inv._invoiceNo}</div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {inv._module || "-"} · {inv._status || "-"}
                                            </div>
                                        </div>
                                        <Badge variant={inv._due <= 0 ? "outline" : "soft"} className="shrink-0">
                                            Due {money(inv._due)}
                                        </Badge>
                                    </div>

                                    {planned > 0 && (
                                        <div className={cn("mt-2 text-xs", bad ? "text-rose-700" : "text-slate-600")}>
                                            Planned: <span className="font-semibold">{money(planned)}</span>
                                            {bad ? " (exceeds due)" : ""}
                                        </div>
                                    )}

                                    <div className="mt-3 space-y-2">
                                        {splits.map((s) => (
                                            <div key={s.key} className="rounded-xl border border-slate-100 p-3">
                                                <div className="flex gap-2">
                                                    <Select
                                                        className="h-9 w-28"
                                                        value={s.mode || "CASH"}
                                                        disabled={disabled}
                                                        onChange={(e) => setSplit(inv._id, s.key, { mode: e.target.value })}
                                                    >
                                                        {MODES.map((m) => (
                                                            <option key={m.value} value={m.value}>
                                                                {m.label}
                                                            </option>
                                                        ))}
                                                    </Select>

                                                    <Input
                                                        className="h-9 flex-1 text-right"
                                                        placeholder="0.00"
                                                        value={s.amount ?? ""}
                                                        disabled={disabled}
                                                        inputMode="decimal"
                                                        onChange={(e) => setSplit(inv._id, s.key, { amount: sanitizeMoneyInput(e.target.value) })}
                                                        onBlur={() => {
                                                            const v = round2(s.amount)
                                                            setSplit(inv._id, s.key, { amount: v > 0 ? as2(v) : "" })
                                                        }}
                                                    />
                                                </div>

                                                <div className="mt-2 flex gap-2">
                                                    <Input
                                                        className="h-9 flex-1"
                                                        placeholder="Txn ref (optional)"
                                                        value={s.txn_ref ?? ""}
                                                        disabled={disabled}
                                                        onChange={(e) => setSplit(inv._id, s.key, { txn_ref: e.target.value })}
                                                    />
                                                    {splits.length > 1 && (
                                                        <Button variant="ghost" className="h-9 px-3" disabled={disabled} onClick={() => removeSplit(inv._id, s.key)}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                                        <Button variant="secondary" disabled={disabled} onClick={() => addSplit(inv._id, { mode: defaultMode, amount: "" })}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Split
                                        </Button>
                                        <Button variant="secondary" disabled={disabled} onClick={() => maxInvoice(inv._id)}>
                                            MAX
                                        </Button>
                                        <Button variant="ghost" disabled={disabled} onClick={() => clearInvoice(inv._id)}>
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardBody>

                {/* Sticky footer */}
                <div className="sticky bottom-0 z-10 border-t border-slate-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
                    <div className="p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="text-sm text-slate-600">
                            Selected invoices: <span className="font-semibold text-slate-900">{totals.lines}</span> · Paying{" "}
                            <span className="font-semibold text-slate-900">{money(totals.paying)}</span> · Remaining{" "}
                            <span className="font-semibold text-slate-900">{money(remaining)}</span>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" onClick={clearAll} disabled={loading || submitting}>
                                Clear all
                            </Button>
                            <Button onClick={submit} disabled={loading || submitting || totals.paying <= 0}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                {submitting ? "Processing…" : `Collect ${money(totals.paying)}`}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}
