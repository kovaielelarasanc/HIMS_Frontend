// FILE: src/billing/caseTabs/InvoicesTab.jsx
import React, { useMemo, useState } from "react"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, money } from "../_ui"
import { INVOICE_STATUSES, upper } from "./shared"

export default function InvoicesTab({ invoices, onOpen }) {
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
                                            <Badge tone="slate">{upper(r.module || "GENERAL")}</Badge>
                                        </td>
                                        <td className="py-3 pr-4">{r.invoice_type || "PATIENT"}</td>
                                        <td className="py-3 pr-4">
                                            <div className="text-sm font-semibold text-slate-800">{r.payer_type || "PATIENT"}</div>
                                            <div className="text-xs text-slate-500">Payer ID: {r.payer_id ?? "—"}</div>
                                        </td>
                                        <td className="py-3 pr-4">{upper(r.status)}</td>
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
