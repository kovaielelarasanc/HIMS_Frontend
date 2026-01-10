import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
    billingListEditRequests,
    billingApproveEditRequest,
    billingRejectEditRequest,
    isCanceledError,
} from "@/api/billings"
import { Button, Card, CardBody, CardHeader, Field, Input, Textarea, Badge, cn, EmptyState } from "./_ui"
import { CheckCircle2, XCircle, RefreshCcw, Search, ArrowRight } from "lucide-react"

function toneForStatus(s) {
    const x = String(s || "").toUpperCase()
    if (x === "PENDING") return "amber"
    if (x === "APPROVED") return "green"
    if (x === "REJECTED") return "rose"
    return "slate"
}

export default function InvoiceEditRequests() {
    const nav = useNavigate()

    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [status, setStatus] = useState("PENDING")
    const [q, setQ] = useState("")

    const [decision, setDecision] = useState({ notes: "", unlock_hours: 24 })
    const [selected, setSelected] = useState(null)

    async function load() {
        setLoading(true)
        try {
            const r = await billingListEditRequests({ status })
            setRows(Array.isArray(r) ? r : r?.items ?? [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load requests")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [status])

    const filtered = useMemo(() => {
        const qq = String(q || "").trim().toLowerCase()
        if (!qq) return rows
        return rows.filter((r) => {
            const s = [
                r.id,
                r.invoice_id,
                r.billing_case_id,
                r.reason,
                r.status,
                r.requested_at,
            ].join(" ").toLowerCase()
            return s.includes(qq)
        })
    }, [rows, q])

    async function approve(id) {
        const hrs = Number(decision.unlock_hours || 24)
        if (!Number.isFinite(hrs) || hrs < 1) return toast.error("Unlock hours must be >= 1")
        try {
            await billingApproveEditRequest(id, {
                decision_notes: decision.notes || "",
                unlock_hours: hrs,
            })
            toast.success("Approved & invoice reopened to DRAFT")
            setSelected(null)
            setDecision({ notes: "", unlock_hours: 24 })
            load()
        } catch (e) {
            toast.error(e?.message || "Approve failed")
        }
    }

    async function reject(id) {
        try {
            await billingRejectEditRequest(id, {
                decision_notes: decision.notes || "",
                unlock_hours: Number(decision.unlock_hours || 24),
            })
            toast.success("Rejected")
            setSelected(null)
            setDecision({ notes: "", unlock_hours: 24 })
            load()
        } catch (e) {
            toast.error(e?.message || "Reject failed")
        }
    }

    return (
        <div className="w-full">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-xl font-extrabold text-slate-900">Invoice Edit Requests</div>
                    <div className="text-xs text-slate-500">Mandatory admin/permitted review screen</div>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} /> Refresh
                    </Button>
                </div>
            </div>

            <Card className="mb-4">
                <CardHeader title="Search" subtitle="Find by invoice / case / reason" />
                <CardBody>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2">
                        <Search className="h-4 w-4 text-slate-500" />
                        <input
                            className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                            placeholder="Search requests…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Requests" subtitle="Approve to reopen invoice to DRAFT (audit captured)" />
                <CardBody>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                            ))}
                        </div>
                    ) : filtered?.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1200px] text-left text-sm">
                                <thead className="text-xs font-bold text-slate-600">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 pr-4">Requested At</th>
                                        <th className="py-3 pr-4">Invoice</th>
                                        <th className="py-3 pr-4">Case</th>
                                        <th className="py-3 pr-4">Reason</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-0 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((r) => (
                                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4 font-semibold text-slate-800">{r.requested_at || "—"}</td>
                                            <td className="py-3 pr-4 font-semibold text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <span>#{r.invoice_id}</span>
                                                    <button
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                                        onClick={() => nav(`/billing/invoices/${r.invoice_id}`)}
                                                    >
                                                        Open <ArrowRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4 font-semibold text-slate-800">
                                                <button
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                                    onClick={() => nav(`/billing/cases/${r.billing_case_id}`)}
                                                >
                                                    #{r.billing_case_id} <ArrowRight className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700">{r.reason}</td>
                                            <td className="py-3 pr-4">
                                                <Badge tone={toneForStatus(r.status)}>{r.status}</Badge>
                                            </td>
                                            <td className="py-3 pr-0 text-right">
                                                <Button
                                                    variant="outline"
                                                    disabled={String(r.status).toUpperCase() !== "PENDING"}
                                                    onClick={() => setSelected(r)}
                                                >
                                                    Review
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState title="No requests" desc="When users request invoice edits, they appear here." />
                    )}
                </CardBody>
            </Card>

            {selected ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
                    <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div className="text-base font-extrabold text-slate-900">Review Request #{selected.id}</div>
                            <button onClick={() => setSelected(null)} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                                Close
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                                <div className="font-extrabold text-slate-900">Invoice #{selected.invoice_id}</div>
                                <div className="text-xs text-slate-600 mt-1">Case #{selected.billing_case_id}</div>
                                <div className="mt-2 text-sm text-slate-800"><b>Reason:</b> {selected.reason}</div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="Unlock Hours">
                                    <Input
                                        value={decision.unlock_hours}
                                        onChange={(e) => setDecision({ ...decision, unlock_hours: e.target.value })}
                                        placeholder="24"
                                    />
                                </Field>

                                <div className="md:col-span-2">
                                    <Field label="Decision Notes (optional)">
                                        <Textarea
                                            value={decision.notes}
                                            onChange={(e) => setDecision({ ...decision, notes: e.target.value })}
                                            placeholder="Approval/rejection notes"
                                        />
                                    </Field>
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="danger" onClick={() => reject(selected.id)}>
                                    <XCircle className="h-4 w-4" /> Reject
                                </Button>
                                <Button onClick={() => approve(selected.id)}>
                                    <CheckCircle2 className="h-4 w-4" /> Approve & Reopen
                                </Button>
                            </div>

                            <div className="text-xs text-slate-500">
                                Note: Approve should reopen invoice to <b>DRAFT</b>. Backend must enforce permission.
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
