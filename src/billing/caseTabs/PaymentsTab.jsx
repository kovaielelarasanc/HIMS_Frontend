// FILE: src/billing/caseTabs/PaymentsTab.jsx
import React, { useMemo, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

import { billingRecordPayment } from "@/api/billings"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, cn, money } from "../_ui"
import { Modal, PAYMENT_MODES, fmtDate, toNum, upper } from "./shared"

function pickLatestPayableInvoice(invoices = []) {
    const rows = (invoices || [])
        .filter((i) => ["APPROVED", "POSTED"].includes(upper(i.status)))
        .sort((a, b) => Number(b.id) - Number(a.id))
    return rows[0] || null
}

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
                const hay = `${p.txn_ref || ""} ${p.invoice_id || ""} ${p.mode || ""} ${p.amount || ""}`.toLowerCase()
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
                        <Input placeholder="txn ref / invoice / amount" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
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
                            #{suggestedInvoice.id} · {upper(suggestedInvoice.module)} · {suggestedInvoice.invoice_number || ""}
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
                        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Field>
                </div>
            </div>
        </Modal>
    )
}
