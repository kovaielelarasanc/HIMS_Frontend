// FILE: src/billing/caseTabs/AdvancesTab.jsx
import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, RotateCcw, Plus, Search, X, History } from "lucide-react"

import {
    billingRecordAdvance,
    billingRefundDeposit,
    billingCaseFinance,
    billingListInvoiceOutstanding,
    billingApplyAdvanceSelected,
    billingListAdvanceApplications,
} from "@/api/billings"

import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, Textarea, cn, money } from "../_ui"
import { ADV_TYPES, PAYMENT_MODES, Modal, normItems, fmtDate, toNum, upper, Info } from "./shared"

export default function AdvancesTab({ caseId, advances, refunds, due, onDone }) {
    const [open, setOpen] = useState(false)
    const [applyOpen, setApplyOpen] = useState(false)
    const [refundOpen, setRefundOpen] = useState(false)
    const [f, setF] = useState({ q: "", type: "ALL", mode: "ALL", from: "", to: "" })

    const merged = useMemo(() => {
        const a = normItems(advances)
        const r = normItems(refunds).map((x) => ({
            ...x,
            entry_type: x.entry_type || "REFUND",
            amount: x.amount ?? x.refund_amount ?? x.refunded_amount,
            entry_at: x.entry_at || x.refunded_at || x.created_at,
        }))
        const all = [...a, ...r]
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
                const hay = `${a.txn_ref || ""} ${a.amount || ""} ${a.mode || ""} ${a.entry_type || ""} ${a.remarks || ""}`.toLowerCase()
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
                        <Input placeholder="txn ref / amount / remarks" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                    </Field>
                    <Field label="Type">
                        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {ADV_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Mode">
                        <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                            <option value="ALL">ALL</option>
                            {PAYMENT_MODES.map((m) => (
                                <option key={m} value={m}>{m}</option>
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

            if (upper(form.entry_type) === "REFUND" && typeof billingRefundDeposit === "function") {
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

export function ApplyAdvanceDialog({ caseId, onClose, onDone }) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [balance, setBalance] = useState(0)
    const [rows, setRows] = useState([])

    const [q, setQ] = useState("")
    const [module, setModule] = useState("ALL")
    const [status, setStatus] = useState("ALL")

    const [selected, setSelected] = useState(() => new Set())
    const [applyAmount, setApplyAmount] = useState("")
    const [notes, setNotes] = useState("")
    const [histOpen, setHistOpen] = useState(false)

    async function load() {
        setLoading(true)
        try {
            const f = await billingCaseFinance(caseId)
            const advBal = toNum(f?.finance?.advances?.advance_balance ?? f?.advances?.advance_balance ?? f?.advance_balance)
            setBalance(advBal)

            const o = await billingListInvoiceOutstanding(caseId, { statuses: "APPROVED,POSTED" })
            setRows(o?.items || [])
        } catch (e) {
            toast.error(e?.message || "Failed to load invoices / advance balance")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    const modules = useMemo(() => {
        const set = new Set(["ALL"])
        for (const r of rows) set.add(upper(r.module || "GENERAL"))
        return Array.from(set)
    }, [rows])

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase()
        return (rows || []).filter((r) => {
            if (module !== "ALL" && upper(r.module || "GENERAL") !== module) return false
            if (status !== "ALL" && upper(r.status) !== status) return false
            if (qq) {
                const hay = `${r.invoice_number || ""} ${r.invoice_id || ""} ${r.module || ""}`.toLowerCase()
                if (!hay.includes(qq)) return false
            }
            return true
        })
    }, [rows, q, module, status])

    const selectedRows = useMemo(() => {
        const ids = selected
        return filtered.filter((r) => ids.has(Number(r.invoice_id)))
    }, [filtered, selected])

    const selectedDue = useMemo(() => selectedRows.reduce((s, r) => s + toNum(r.patient_outstanding), 0), [selectedRows])
    const maxCanApply = useMemo(() => Math.max(0, Math.min(balance, selectedDue)), [balance, selectedDue])

    useEffect(() => {
        if (!selected.size) {
            setApplyAmount("")
            return
        }
        const cur = applyAmount === "" ? NaN : toNum(applyAmount)
        if (!Number.isFinite(cur) || cur <= 0 || cur > maxCanApply) {
            setApplyAmount(maxCanApply > 0 ? String(maxCanApply) : "")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDue, balance])

    function toggle(id) {
        const s = new Set(selected)
        const k = Number(id)
        if (s.has(k)) s.delete(k)
        else s.add(k)
        setSelected(s)
    }

    function selectAllVisible() {
        const s = new Set(selected)
        for (const r of filtered) {
            if (toNum(r.patient_outstanding) > 0) s.add(Number(r.invoice_id))
        }
        setSelected(s)
    }

    function clearAll() {
        setSelected(new Set())
    }

    const applyAmtNum = applyAmount === "" ? 0 : toNum(applyAmount)
    const invalid =
        selected.size === 0 ||
        selectedDue <= 0 ||
        balance <= 0 ||
        applyAmtNum <= 0 ||
        applyAmtNum > balance ||
        applyAmtNum > selectedDue

    async function submit() {
        if (invalid) {
            if (!selected.size) return toast.error("Select at least one invoice")
            if (balance <= 0) return toast.error("No advance balance available")
            if (selectedDue <= 0) return toast.error("Selected invoices have no due")
            if (applyAmtNum <= 0) return toast.error("Enter valid apply amount")
            if (applyAmtNum > balance) return toast.error("Apply amount exceeds advance balance")
            if (applyAmtNum > selectedDue) return toast.error("Apply amount exceeds selected due")
            return
        }

        setSaving(true)
        try {
            const invoiceIds = Array.from(selected).map(Number)
            const res = await billingApplyAdvanceSelected(caseId, {
                invoice_ids: invoiceIds,
                apply_amount: applyAmtNum,
                notes: notes || undefined,
            })
            toast.success(`Advance applied: ₹ ${money(res?.applied_amount || applyAmtNum)}`)
            onDone()
        } catch (e) {
            toast.error(e?.response?.data?.detail?.message || e?.message || "Failed to apply advance")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Apply Advance (Select Invoices)"
            onClose={onClose}
            wide
            right={
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setHistOpen(true)} className="gap-2">
                        <History className="h-4 w-4" /> History
                    </Button>
                    <Button onClick={submit} disabled={saving || invalid} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {saving ? "Applying..." : "Apply"}
                    </Button>
                </div>
            }
        >
            {loading ? (
                <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
            ) : (
                <>
                    <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Info label="Advance Balance" value={`₹ ${money(balance)}`} />
                        <Info label="Selected Due" value={`₹ ${money(selectedDue)}`} />
                        <Info label="Max Can Apply" value={`₹ ${money(maxCanApply)}`} />
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                        <Field label="Search">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input className="pl-9" placeholder="Invoice no / module" value={q} onChange={(e) => setQ(e.target.value)} />
                            </div>
                        </Field>

                        <Field label="Module">
                            <Select value={module} onChange={(e) => setModule(e.target.value)}>
                                {modules.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </Select>
                        </Field>

                        <Field label="Status">
                            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                                {["ALL", "APPROVED", "POSTED"].map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Select>
                        </Field>

                        <Field label="Apply Amount (₹)">
                            <Input inputMode="decimal" placeholder={`Max ${money(maxCanApply)}`} value={applyAmount} onChange={(e) => setApplyAmount(e.target.value)} />
                            <div className="mt-1 text-xs text-slate-500">Must be ≤ advance balance and ≤ selected due.</div>
                        </Field>

                        <div className="md:col-span-4">
                            <Field label="Notes (optional)">
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                            </Field>
                        </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Badge tone="slate">{filtered.length} invoices</Badge>
                            <Badge tone="blue">{selected.size} selected</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={selectAllVisible}>Select All Visible</Button>
                            <Button variant="outline" onClick={clearAll} className="gap-2">
                                <X className="h-4 w-4" /> Clear
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="text-xs font-bold text-slate-600">
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 px-4">Select</th>
                                    <th className="py-3 pr-4">Invoice</th>
                                    <th className="py-3 pr-4">Module</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3 pr-4 text-right">Outstanding</th>
                                    <th className="py-3 pr-4 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r) => {
                                    const id = Number(r.invoice_id)
                                    const out = toNum(r.patient_outstanding)
                                    const checked = selected.has(id)
                                    const disabled = out <= 0
                                    return (
                                        <tr key={id} className={cn("border-b border-slate-50 hover:bg-slate-50/60", disabled && "opacity-60")}>
                                            <td className="py-3 px-4">
                                                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(id)} className="h-4 w-4" />
                                            </td>
                                            <td className="py-3 pr-4">
                                                <div className="font-extrabold text-slate-900">{r.invoice_number || `#${id}`}</div>
                                                <div className="text-xs text-slate-500">ID: {id}</div>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <Badge tone="slate">{upper(r.module || "GENERAL")}</Badge>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <Badge tone={upper(r.status) === "POSTED" ? "green" : "amber"}>{upper(r.status)}</Badge>
                                            </td>
                                            <td className="py-3 pr-4 text-right font-extrabold text-slate-900">₹ {money(out)}</td>
                                            <td className="py-3 pr-4 text-right text-slate-700">₹ {money(r.grand_total)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {histOpen && <AdvanceApplyHistoryDialog caseId={caseId} onClose={() => setHistOpen(false)} />}
                </>
            )}
        </Modal>
    )
}

function AdvanceApplyHistoryDialog({ caseId, onClose }) {
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState([])

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const r = await billingListAdvanceApplications(caseId)
                setItems(r?.items || [])
            } catch (e) {
                toast.error(e?.message || "Failed to load apply history")
            } finally {
                setLoading(false)
            }
        })()
    }, [caseId])

    return (
        <Modal title="Advance Apply History" onClose={onClose} wide>
            {loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">No apply history yet.</div>
            ) : (
                <div className="space-y-3">
                    {items.map((x, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-100 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone="slate">Receipt: {x?.payment?.receipt_number || "—"}</Badge>
                                    <Badge tone="blue">₹ {money(x?.payment?.amount || 0)}</Badge>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {x?.payment?.received_at ? new Date(x.payment.received_at).toLocaleString("en-IN") : "—"}
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="text-xs font-bold text-slate-600 mb-2">Invoice Allocations</div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {(x.allocations || []).map((a, i) => (
                                        <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                            <div className="font-extrabold text-slate-900">{a.invoice_number || `#${a.invoice_id}`}</div>
                                            <div className="text-xs text-slate-600">{upper(a.module)} · {upper(a.status)}</div>
                                            <div className="mt-1 text-sm font-extrabold text-slate-900">₹ {money(a.amount)}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 text-xs font-bold text-slate-600 mb-2">Consumed Advances</div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {(x.consumed_advances || []).map((c, i) => (
                                        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-3">
                                            <div className="text-xs text-slate-500">Advance #{c.advance_id}</div>
                                            <div className="text-sm font-extrabold text-slate-900">₹ {money(c.amount)}</div>
                                            <div className="text-xs text-slate-500">{c.mode || "—"} · {c.txn_ref || "—"}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    )
}
