// FILE: src/billing/caseTabs/PaymentsTab.jsx
import React, { useMemo, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

import { billingRecordPayment } from "@/api/billings"
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
import { Modal, PAYMENT_MODES, fmtDate, toNum, upper } from "./shared"

/** ---------- helpers (allocation-safe) ---------- */
function paymentAllocations(p) {
    return Array.isArray(p?.allocations) ? p.allocations : []
}

function paymentAppliedAmount(p) {
    // backend recommended: p.applied_amount per invoice endpoint
    if (p?.applied_amount !== undefined && p?.applied_amount !== null) return toNum(p.applied_amount)

    const allocs = paymentAllocations(p)
    if (allocs.length) return allocs.reduce((s, a) => s + toNum(a.amount), 0)

    // legacy direct
    return toNum(p?.amount)
}

function paymentReceiptAmount(p) {
    return toNum(p?.amount)
}

function paymentInvoiceLabel(p) {
    const allocs = paymentAllocations(p)
    const ids = allocs.map((a) => a.invoice_id).filter((x) => x !== undefined && x !== null)
    const uniq = Array.from(new Set(ids.map((x) => Number(x)))).filter((n) => Number.isFinite(n))

    if (uniq.length) return uniq.map((id) => `#${id}`).join(", ")
    if (p?.invoice_id !== undefined && p?.invoice_id !== null) return `#${p.invoice_id}`
    return "—"
}

function invoiceDue(inv) {
    // prefer server fields (recommended: "outstanding")
    const o =
        inv?.outstanding ??
        inv?.patient_outstanding ??
        inv?.balance ??
        inv?.due ??
        null

    if (o !== null && o !== undefined && o !== "") return Math.max(0, toNum(o))

    // fallback: grand_total - paid (if available)
    const gt = toNum(inv?.grand_total)
    const paid = inv?.paid ?? inv?.paid_total ?? inv?.total_paid ?? null
    if (paid !== null && paid !== undefined && paid !== "") return Math.max(0, gt - toNum(paid))

    // last fallback (unknown paid): assume fully due
    return Math.max(0, gt)
}

function pickLatestPayableInvoice(invoices = []) {
    const rows = (invoices || [])
        .filter((i) => ["APPROVED", "POSTED"].includes(upper(i.status)))
        .sort((a, b) => Number(b.id) - Number(a.id))

    // ✅ pick latest with due > 0 (if we can compute it)
    const withDue = rows.filter((r) => invoiceDue(r) > 0)
    return withDue[0] || rows[0] || null
}

/** ---------- component ---------- */
export default function PaymentsTab({ caseId, payments, invoices, onDone }) {
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
                const allocs = paymentAllocations(p)
                const invs = allocs.map((a) => a.invoice_id).filter(Boolean).join(" ")
                const applied = paymentAppliedAmount(p)

                const hay = `${p.txn_ref || ""} ${p.invoice_id || ""} ${invs} ${p.mode || ""} ${p.amount || ""} ${applied || ""} ${p.notes || ""
                    }`.toLowerCase()

                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [payments, f])

    // Receipt total (what money came in)
    const receiptTotal = filtered.reduce((s, p) => s + paymentReceiptAmount(p), 0)
    // Applied total (what affects invoice due; allocation-safe)
    const appliedTotal = filtered.reduce((s, p) => s + paymentAppliedAmount(p), 0)

    return (
        <Card>
            <CardHeader
                title="Payments"
                subtitle="Filters supported (mode/date/search) + quick add (allocation-safe)"
                right={
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">Receipt Total: ₹ {money(receiptTotal)}</Badge>
                        <Badge tone="blue">Applied Total: ₹ {money(appliedTotal)}</Badge>
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
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="text-xs font-bold text-slate-600">
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 pr-4">Date</th>
                                    <th className="py-3 pr-4">Mode</th>
                                    <th className="py-3 pr-4">Ref</th>
                                    <th className="py-3 pr-4">Invoice(s)</th>
                                    <th className="py-3 pr-4 text-right">Applied</th>
                                    <th className="py-3 pr-0 text-right">Receipt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p) => {
                                    const applied = paymentAppliedAmount(p)
                                    const receipt = paymentReceiptAmount(p)
                                    const invLabel = paymentInvoiceLabel(p)

                                    return (
                                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4">{fmtDate(p.received_at || p.paid_at || p.created_at)}</td>
                                            <td className="py-3 pr-4">
                                                <Badge tone="blue">{p.mode || "CASH"}</Badge>
                                            </td>
                                            <td className="py-3 pr-4">{p.txn_ref || "—"}</td>
                                            <td className="py-3 pr-4">{invLabel}</td>

                                            <td className="py-3 pr-4 text-right font-extrabold text-slate-900">
                                                ₹ {money(applied)}
                                            </td>

                                            <td className="py-3 pr-0 text-right">
                                                <div className="font-bold text-slate-900">₹ {money(receipt)}</div>
                                                {Math.abs(receipt - applied) > 0.009 ? (
                                                    <div className="text-xs text-slate-500">
                                                        (Applied differs due to allocations)
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    )
                                })}
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
    const suggestedDue = suggestedInvoice ? invoiceDue(suggestedInvoice) : 0

    async function submit() {
        const amt = toNum(form.amount)
        if (!amt || amt <= 0) return toast.error("Enter valid amount")

        const pickedInvoiceId = form.invoice_id
            ? Number(form.invoice_id)
            : suggestedInvoice?.id
                ? Number(suggestedInvoice.id)
                : undefined

        setSaving(true)
        try {
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

    const payableInvoices = useMemo(() => {
        const rows = (invoices || [])
            .filter((i) => ["APPROVED", "POSTED"].includes(upper(i.status)))
            .sort((a, b) => Number(b.id) - Number(a.id))
        return rows
    }, [invoices])

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
                        Auto-pick invoice (latest with due):{" "}
                        <span className="font-extrabold text-slate-900">
                            #{suggestedInvoice.id} · {upper(suggestedInvoice.module)} · {suggestedInvoice.invoice_number || ""}
                            {" · "}
                            Due: ₹ {money(suggestedDue)}
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
                            Auto-pick latest with due{suggestedInvoice ? ` · #${suggestedInvoice.id}` : ""}
                        </option>

                        {payableInvoices.map((inv) => {
                            const due = invoiceDue(inv)
                            return (
                                <option key={inv.id} value={inv.id}>
                                    #{inv.id} · {upper(inv.module || "GENERAL")} · {inv.invoice_number || ""} ·
                                    Total ₹ {money(inv.grand_total)} · Due ₹ {money(due)}
                                </option>
                            )
                        })}

                        {/* fallback: include other invoices if needed */}
                        {(invoices || [])
                            .filter((inv) => !["APPROVED", "POSTED"].includes(upper(inv.status)))
                            .map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                    #{inv.id} · {upper(inv.module || "GENERAL")} · {inv.invoice_number || ""} ·
                                    Status {upper(inv.status)} · Total ₹ {money(inv.grand_total)}
                                </option>
                            ))}
                    </Select>
                </Field>

                <Field label="Txn Ref (optional)">
                    <Input value={form.txn_ref} onChange={(e) => setForm({ ...form, txn_ref: e.target.value })} />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Notes">
                        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Field>
                </div>
            </div>
        </Modal>
    )
}
