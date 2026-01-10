import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
    billingAddManualLine,
    billingApproveInvoice,
    billingDeleteLine,
    billingGetInvoice,
    billingGetInvoicePdf,
    billingListInvoiceLines,
    billingListInvoicePayments,
    billingListInvoiceAuditLogs,
    billingPayOnCase,
    billingPostInvoice,
    billingRequestInvoiceEdit,
    billingReopenInvoice,
    billingUpdateLine,
    billingModulesMeta,
    billingVoidInvoice,
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
    PdfButtons,
    StatusBadge,
    Textarea,
    cn,
    downloadBlob,
    money,
} from "./_ui"
import {
    ArrowLeft,
    CheckCircle2,
    Plus,
    RefreshCcw,
    ShieldCheck,
    Trash2,
    AlertTriangle,
    LockKeyhole,
    CreditCard,
    FileClock,
    RotateCcw,
    Search,
    ChevronDown,
    ChevronUp,
    ClipboardCopy,
    Pencil,
} from "lucide-react"

const cx = (...a) => a.filter(Boolean).join(" ")

function num(v, fb = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
}

function isPharmacyModule(m) {
    const x = String(m || "").trim().toUpperCase()
    return x === "PHM" || x === "PHC" || x === "PHARMACY"
}

/**
 * Module -> ServiceGroup lock mapping
 * (must match your ServiceGroup enum names)
 */
const MODULE_TO_GROUP = {
    DOC: "CONSULT",
    LAB: "LAB",
    BLOOD: "LAB",
    SCAN: "RAD",
    XRAY: "RAD",
    PHM: "PHARM",
    PHC: "PHARM",
    ROOM: "ROOM",
    NURSING: "NURSING",
    PROC: "PROC",
    SURG: "OT",
    ADM: "MISC",
    DIET: "MISC",
    MISC: "MISC",
}

const PAY_MODES = ["CASH", "CARD", "UPI", "BANK", "WALLET", "CHEQUE"]

export default function InvoiceEditor() {
    const { invoiceId } = useParams()
    const nav = useNavigate()

    const [loading, setLoading] = useState(true)
    const [invoice, setInvoice] = useState(null)
    const [lines, setLines] = useState([])
    const [payments, setPayments] = useState([])

    const [tab, setTab] = useState("LINES") // LINES | PAYMENTS | AUDIT

    const [manualOpen, setManualOpen] = useState(false)
    const [voidOpen, setVoidOpen] = useState(false)
    const [editReqOpen, setEditReqOpen] = useState(false)
    const [reopenOpen, setReopenOpen] = useState(false)

    const [deleteTarget, setDeleteTarget] = useState(null) // { line }
    const [editTarget, setEditTarget] = useState(null) // { line }

    const [defaultEditReason, setDefaultEditReason] = useState("Draft correction")

    const [modulesMeta, setModulesMeta] = useState(null)

    // Audit
    const [auditLogs, setAuditLogs] = useState([])
    const [auditLoading, setAuditLoading] = useState(false)
    const [auditQ, setAuditQ] = useState("")
    const [expandedAuditId, setExpandedAuditId] = useState(null)

    // Line search
    const [lineQ, setLineQ] = useState("")

    const abortRef = useRef(null)

    // -----------------------------
    // Load module meta (columns) once
    // -----------------------------
    useEffect(() => {
        let alive = true
        billingModulesMeta()
            .then((m) => alive && setModulesMeta(m))
            .catch(() => { })
        return () => { alive = false }
    }, [])

    // -----------------------------
    // Load invoice + lines + payments
    // -----------------------------
    async function load() {
        abortRef.current?.abort?.()
        const ac = new AbortController()
        abortRef.current = ac

        setLoading(true)
        try {
            const inv = await billingGetInvoice(invoiceId, { signal: ac.signal })
            setInvoice(inv)

            const [l, p] = await Promise.all([
                billingListInvoiceLines(invoiceId, {}, { signal: ac.signal }),
                billingListInvoicePayments(invoiceId, {}, { signal: ac.signal }),
            ])

            setLines(Array.isArray(l) ? l : l?.items ?? [])
            setPayments(Array.isArray(p) ? p : p?.items ?? [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load invoice")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoiceId])

    // -----------------------------
    // Load audit logs on AUDIT tab
    // -----------------------------
    async function loadAudit() {
        if (!invoiceId) return
        setAuditLoading(true)
        try {
            const r = await billingListInvoiceAuditLogs(invoiceId)
            setAuditLogs(Array.isArray(r) ? r : r?.items ?? [])
        } catch {
            // ignore soft errors
        } finally {
            setAuditLoading(false)
        }
    }

    useEffect(() => {
        let alive = true
        if (tab !== "AUDIT") return
            ; (async () => {
                await loadAudit()
                if (!alive) return
            })()
        return () => { alive = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, invoiceId])

    const statusUpper = String(invoice?.status || "").trim().toUpperCase()
    const moduleCode = String(invoice?.module || "MISC").trim().toUpperCase()
    const moduleLabel = invoice?.module_label || moduleCode

    // ✅ STRICT RULE: Editable ONLY in DRAFT
    const canEditLines = statusUpper === "DRAFT"

    const paidTotal = useMemo(() => payments.reduce((s, r) => s + num(r.amount), 0), [payments])
    const grandTotal = num(invoice?.grand_total ?? 0)
    const dueTotal = Math.max(0, grandTotal - paidTotal)

    const totals = useMemo(() => {
        const sub = lines.reduce((s, r) => s + num(r.line_total ?? num(r.qty) * num(r.unit_price)), 0)
        const disc = lines.reduce((s, r) => s + num(r.discount_amount), 0)
        const tax = lines.reduce((s, r) => s + num(r.tax_amount), 0)
        const grand = lines.reduce((s, r) => s + num(r.net_amount), 0)
        return { sub, disc, tax, grand }
    }, [lines])

    const columns = useMemo(() => {
        const colMap = modulesMeta?.columns || {}
        const key = isPharmacyModule(moduleCode) ? "PHARMACY" : "DEFAULT"
        return colMap[key] || colMap.DEFAULT || null
    }, [modulesMeta, moduleCode])

    const filteredLines = useMemo(() => {
        const q = String(lineQ || "").trim().toLowerCase()
        if (!q) return lines
        return lines.filter((r) => {
            const s = [
                r.description,
                r.item_code,
                r.item_type,
                r.source_module,
                r.item_id,
                r.service_group,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
            return s.includes(q)
        })
    }, [lines, lineQ])

    const filteredAudit = useMemo(() => {
        const q = String(auditQ || "").trim().toLowerCase()
        if (!q) return auditLogs
        return auditLogs.filter((a) => {
            const s = [
                a.action,
                a.reason,
                a.entity_type,
                a.entity_id,
                a.user_label,
                a.created_at,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
            return s.includes(q)
        })
    }, [auditLogs, auditQ])

    async function onApprove() {
        if (!invoice?.id) return
        if (lines.length === 0) return toast.error("Add at least one line before approving")
        try {
            await billingApproveInvoice(invoice.id)
            toast.success("Invoice approved")
            load()
        } catch (e) {
            toast.error(e?.message || "Approve failed")
        }
    }

    async function onPost() {
        if (!invoice?.id) return
        try {
            await billingPostInvoice(invoice.id)
            toast.success("Invoice posted")
            load()
        } catch (e) {
            toast.error(e?.message || "Post failed")
        }
    }

    async function onVoid(reason) {
        if (!invoice?.id) return
        try {
            await billingVoidInvoice(invoice.id, { reason })
            toast.success("Invoice voided")
            setVoidOpen(false)
            load()
        } catch (e) {
            toast.error(e?.message || "Void failed")
        }
    }

    async function onPrint() {
        try {
            const blob = await billingGetInvoicePdf(invoice.id)
            if (!blob) throw new Error("PDF route not available")
            const url = URL.createObjectURL(blob)
            const w = window.open(url, "_blank")
            if (!w) {
                downloadBlob(blob, `${invoice.invoice_number || "invoice"}.pdf`)
                return
            }
            w.addEventListener("load", () => {
                try { w.print() } catch { }
            })
            setTimeout(() => URL.revokeObjectURL(url), 5000)
        } catch (e) {
            toast.error(e?.message || "Failed to open PDF")
        }
    }

    async function onDownload() {
        try {
            const blob = await billingGetInvoicePdf(invoice.id)
            if (!blob) throw new Error("PDF route not available")
            downloadBlob(blob, `${invoice.invoice_number || "invoice"}.pdf`)
        } catch (e) {
            toast.error(e?.message || "Download failed")
        }
    }

    function requireReasonOrDefault() {
        const r = String(defaultEditReason || "").trim()
        if (r.length >= 3) return r
        return "Draft correction"
    }

    // ✅ UPDATED: allow delete for ALL lines in DRAFT (including auto-linked)
    // Backend should soft-delete and audit.
    function canDeleteLine(_r) {
        return Boolean(canEditLines)
    }

    // ✅ UPDATED: edit auto lines too (send reason)
    async function updateLineWithReason(lineId, patch, reason) {
        if (!invoice?.id) return
        if (!canEditLines) return toast.error("Invoice locked. Reopen to edit.")
        const rsn = String(reason || "").trim()
        if (rsn.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
        try {
            await billingUpdateLine(invoice.id, lineId, { ...patch, reason: rsn })
            toast.success("Line updated")
            load()
        } catch (e) {
            toast.error(e?.message || "Update failed")
        }
    }

    async function deleteLine(lineId, reason) {
        if (!invoice?.id) return
        if (!canEditLines) return toast.error("Invoice locked. Reopen to edit.")
        const rsn = String(reason || "").trim()
        if (rsn.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
        try {
            await billingDeleteLine(invoice.id, lineId, rsn)
            toast.success("Line removed")
            load()
        } catch (e) {
            toast.error(e?.message || "Delete failed")
        }
    }

    async function commitLinePatch(lineId, patch) {
        // inline edits use default reason
        await updateLineWithReason(lineId, patch, requireReasonOrDefault())
    }

    async function doReopen(reason) {
        if (!invoice?.id) return
        try {
            await billingReopenInvoice(invoice.id, { reason })
            toast.success("Invoice reopened to DRAFT")
            setReopenOpen(false)
            load()
        } catch (e) {
            toast.error(e?.message || "Reopen failed")
        }
    }

    async function doRequestEdit(reason) {
        if (!invoice?.id) return
        try {
            await billingRequestInvoiceEdit(invoice.id, { reason })
            toast.success("Edit request sent to admin")
            setEditReqOpen(false)
        } catch (e) {
            toast.error(e?.message || "Request failed")
        }
    }

    function copyText(t) {
        try {
            navigator.clipboard.writeText(String(t || ""))
            toast.success("Copied")
        } catch {
            toast.error("Copy failed")
        }
    }

    function lockedBanner() {
        if (statusUpper !== "APPROVED") return null
        return (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                    <LockKeyhole className="mt-0.5 h-4 w-4" />
                    <div className="flex-1">
                        <div className="font-extrabold">Invoice is locked after approval</div>
                        <div className="mt-0.5 text-amber-800">
                            To change lines, request admin approval (Audit mandatory). Admin/privileged user can reopen to DRAFT.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => setEditReqOpen(true)}>
                                <FileClock className="h-4 w-4" /> Request Edit
                            </Button>
                            <Button variant="outline" onClick={() => setReopenOpen(true)}>
                                <RotateCcw className="h-4 w-4" /> Reopen (Admin)
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Premium Header */}
            <div className="mb-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                        <Button variant="outline" onClick={() => nav(-1)}>
                            <ArrowLeft className="h-4 w-4" /> Back
                        </Button>

                        <div>
                            <div className="flex items-center gap-2">
                                <div className="text-xl font-extrabold text-slate-900">Invoice</div>
                                <StatusBadge status={invoice?.status} />
                                <Badge tone="slate">{moduleLabel}</Badge>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-800">
                                    {invoice?.invoice_number || `#${invoice?.id || ""}`}
                                </span>
                                <button
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                    onClick={() => copyText(invoice?.invoice_number || invoice?.id)}
                                >
                                    <ClipboardCopy className="h-3.5 w-3.5" /> Copy
                                </button>
                                <span>· Case ID: {invoice?.billing_case_id ?? "—"}</span>
                                {invoice?.created_at ? <span>· Created: {invoice.created_at}</span> : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" onClick={load} disabled={loading}>
                            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                            Refresh
                        </Button>

                        <PdfButtons onDownload={onDownload} onPrint={onPrint} />

                        <Button
                            variant="outline"
                            disabled={!invoice}
                            onClick={() => nav(`/billing/cases/${invoice?.billing_case_id}`)}
                        >
                            Open Case
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary + Tabs */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader title="Invoice Summary" subtitle="Totals & lifecycle actions" />
                    <CardBody>
                        {loading ? (
                            <div className="space-y-2">
                                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                            </div>
                        ) : !invoice ? (
                            <EmptyState title="Invoice not found" desc="Check ID or backend route." />
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <MiniStat label="Sub Total" value={`₹ ${money(invoice?.sub_total ?? totals.sub)}`} />
                                    <MiniStat label="Discount" value={`₹ ${money(invoice?.discount_total ?? totals.disc)}`} />
                                    <MiniStat label="Tax" value={`₹ ${money(invoice?.tax_total ?? totals.tax)}`} />
                                    <MiniStat label="Grand Total" value={`₹ ${money(invoice?.grand_total ?? totals.grand)}`} strong />
                                    <MiniStat label="Paid" value={`₹ ${money(paidTotal)}`} />
                                    <MiniStat label="Due" value={`₹ ${money(dueTotal)}`} strong />
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                                    <Button variant="outline" disabled={!invoice || statusUpper !== "DRAFT"} onClick={onApprove}>
                                        <ShieldCheck className="h-4 w-4" /> Approve
                                    </Button>

                                    <Button disabled={!invoice || statusUpper !== "APPROVED"} onClick={onPost}>
                                        <CheckCircle2 className="h-4 w-4" /> Post
                                    </Button>

                                    <Button
                                        variant="danger"
                                        disabled={!invoice || statusUpper === "POSTED" || statusUpper === "VOID"}
                                        onClick={() => setVoidOpen(true)}
                                    >
                                        <AlertTriangle className="h-4 w-4" /> Void
                                    </Button>
                                </div>

                                {lockedBanner()}
                            </>
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Workspace" subtitle="Switch panels quickly" />
                    <CardBody>
                        <div className="flex flex-col gap-2">
                            <TabBtn active={tab === "LINES"} onClick={() => setTab("LINES")} icon={<LockKeyhole className="h-4 w-4" />}>
                                Invoice Lines
                            </TabBtn>
                            <TabBtn active={tab === "PAYMENTS"} onClick={() => setTab("PAYMENTS")} icon={<CreditCard className="h-4 w-4" />}>
                                Payments
                            </TabBtn>
                            <TabBtn active={tab === "AUDIT"} onClick={() => setTab("AUDIT")} icon={<FileClock className="h-4 w-4" />}>
                                Audit Logs
                            </TabBtn>

                            <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                                <div className="font-bold text-slate-800">Rules</div>
                                <ul className="mt-1 list-disc pl-5">
                                    <li>Lines editable only in DRAFT</li>
                                    <li>After APPROVE → locked</li>
                                    <li>Edits after approval require Edit Request / Reopen</li>
                                    <li>AUTO lines are source-linked; editing changes billing only (not source stock/orders)</li>
                                </ul>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Content */}
            {tab === "LINES" ? (
                <Card className="mt-4">
                    <CardHeader
                        title="Invoice Lines"
                        subtitle={`Module: ${moduleLabel} · Edit/Delete works for both MANUAL and AUTO lines in DRAFT`}
                        right={
                            <Button onClick={() => setManualOpen(true)} disabled={!invoice || !canEditLines}>
                                <Plus className="h-4 w-4" /> Add Line
                            </Button>
                        }
                    />
                    <CardBody>
                        <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                                <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2">
                                    <Search className="h-4 w-4 text-slate-500" />
                                    <input
                                        className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                                        placeholder="Search lines by name / code / source / group…"
                                        value={lineQ}
                                        onChange={(e) => setLineQ(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Field label="Default edit reason (audit)">
                                    <Input
                                        value={defaultEditReason}
                                        onChange={(e) => setDefaultEditReason(e.target.value)}
                                        placeholder="e.g., Qty corrected / Price updated"
                                        disabled={!canEditLines}
                                    />
                                </Field>
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                                ))}
                            </div>
                        ) : filteredLines.length === 0 ? (
                            <EmptyState
                                title={lines.length === 0 ? "No lines" : "No results"}
                                desc={
                                    lines.length === 0
                                        ? (canEditLines ? "Add at least one line before approving." : "Invoice is locked.")
                                        : "Try different keywords."
                                }
                            />
                        ) : (
                            <LinesTable
                                columns={columns}
                                lines={filteredLines}
                                canEdit={canEditLines}
                                onPatch={commitLinePatch}
                                onAskDelete={(line) => setDeleteTarget({ line })}
                                onAskEdit={(line) => setEditTarget({ line })}
                                canDeleteLine={canDeleteLine}
                                isPharmacy={isPharmacyModule(moduleCode)}
                            />
                        )}

                        <div className="mt-4 flex items-center justify-between gap-2">
                            <Badge tone={canEditLines ? "blue" : "slate"}>{canEditLines ? "Editable (DRAFT)" : "Locked"}</Badge>
                            {lineQ ? (
                                <div className="text-xs text-slate-500">
                                    Showing <b>{filteredLines.length}</b> / {lines.length}
                                </div>
                            ) : null}
                        </div>
                    </CardBody>
                </Card>
            ) : tab === "PAYMENTS" ? (
                <Card className="mt-4">
                    <CardHeader title="Payments" subtitle="Record & view payments for this invoice" />
                    <CardBody>
                        {!invoice ? (
                            <EmptyState title="Invoice not loaded" desc="Open an invoice first." />
                        ) : (
                            <PaymentsPanel
                                invoice={invoice}
                                payments={payments}
                                paidTotal={paidTotal}
                                dueTotal={dueTotal}
                                onPaid={() => load()}
                            />
                        )}
                    </CardBody>
                </Card>
            ) : (
                <Card className="mt-4">
                    <CardHeader
                        title="Audit Logs"
                        subtitle="Every action is traceable (NABH friendly)"
                        right={
                            <Button variant="outline" onClick={loadAudit} disabled={auditLoading}>
                                <RefreshCcw className={cn("h-4 w-4", auditLoading ? "animate-spin" : "")} /> Refresh
                            </Button>
                        }
                    />
                    <CardBody>
                        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2">
                                <Search className="h-4 w-4 text-slate-500" />
                                <input
                                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                                    placeholder="Search audit by action / user / reason / entity…"
                                    value={auditQ}
                                    onChange={(e) => setAuditQ(e.target.value)}
                                />
                            </div>
                            <div className="text-xs text-slate-500">
                                {filteredAudit.length} record(s)
                            </div>
                        </div>

                        {auditLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                                ))}
                            </div>
                        ) : filteredAudit.length === 0 ? (
                            <EmptyState title="No audit logs" desc="Actions will appear here when edits/approvals happen." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-left text-sm">
                                    <thead className="text-xs font-bold text-slate-600">
                                        <tr className="border-b border-slate-100">
                                            <th className="py-3 pr-4">Time</th>
                                            <th className="py-3 pr-4">User</th>
                                            <th className="py-3 pr-4">Action</th>
                                            <th className="py-3 pr-4">Entity</th>
                                            <th className="py-3 pr-0">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAudit.map((a) => {
                                            const open = expandedAuditId === a.id
                                            return (
                                                <>
                                                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                                        <td className="py-3 pr-4 font-semibold text-slate-800">{a.created_at || "—"}</td>
                                                        <td className="py-3 pr-4 font-semibold text-slate-800">{a.user_label || "—"}</td>
                                                        <td className="py-3 pr-4">
                                                            <Badge tone="slate">{a.action}</Badge>
                                                        </td>
                                                        <td className="py-3 pr-4 text-slate-700">
                                                            {a.entity_type} · {a.entity_id}
                                                        </td>
                                                        <td className="py-3 pr-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="text-slate-800">{a.reason || "—"}</div>
                                                                <button
                                                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-100 bg-white px-3 py-1 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                                                                    onClick={() => setExpandedAuditId(open ? null : a.id)}
                                                                >
                                                                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                    Details
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {open ? (
                                                        <tr className="border-b border-slate-50 bg-slate-50/40">
                                                            <td colSpan={5} className="py-3">
                                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                                    <div className="rounded-2xl border border-slate-100 bg-white p-3">
                                                                        <div className="text-xs font-extrabold text-slate-700">Old</div>
                                                                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
                                                                            {JSON.stringify(a.old_json ?? {}, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                    <div className="rounded-2xl border border-slate-100 bg-white p-3">
                                                                        <div className="text-xs font-extrabold text-slate-700">New</div>
                                                                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
                                                                            {JSON.stringify(a.new_json ?? {}, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* Dialogs */}
            {manualOpen && (
                <ManualLineDialog
                    invoice={invoice}
                    moduleCode={moduleCode}
                    onClose={() => setManualOpen(false)}
                    onDone={() => {
                        setManualOpen(false)
                        load()
                    }}
                />
            )}

            {voidOpen && <VoidDialog onClose={() => setVoidOpen(false)} onConfirm={onVoid} />}

            {editReqOpen && (
                <ReasonDialog
                    title="Request Edit (Admin Approval)"
                    desc="Send an edit request to admin. Audit is mandatory for any approved invoice edits."
                    confirmText="Send Request"
                    onClose={() => setEditReqOpen(false)}
                    onConfirm={doRequestEdit}
                />
            )}

            {reopenOpen && (
                <ReasonDialog
                    title="Reopen Invoice to DRAFT"
                    desc="This will move the invoice back to DRAFT so you can edit lines again. Audit is mandatory."
                    confirmText="Reopen Now"
                    tone="danger"
                    onClose={() => setReopenOpen(false)}
                    onConfirm={doReopen}
                />
            )}

            {deleteTarget?.line ? (
                <DeleteLineDialog
                    line={deleteTarget.line}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={(reason) => {
                        deleteLine(deleteTarget.line.id, reason)
                        setDeleteTarget(null)
                    }}
                />
            ) : null}

            {editTarget?.line ? (
                <EditLineDialog
                    line={editTarget.line}
                    onClose={() => setEditTarget(null)}
                    onConfirm={(patch, reason) => {
                        updateLineWithReason(editTarget.line.id, patch, reason)
                        setEditTarget(null)
                    }}
                />
            ) : null}
        </div>
    )
}

/* ----------------------------
   Lines Table
----------------------------- */
function getNested(obj, path) {
    const parts = String(path || "").split(".")
    let cur = obj
    for (const p of parts) {
        if (!cur) return undefined
        cur = cur[p]
    }
    return cur
}

function fmtCell(key, v) {
    if (v == null) return "—"
    const k = String(key || "")
    if (k.includes("amount") || k === "unit_price" || k === "line_total" || k === "net_amount") {
        return `₹ ${money(v)}`
    }
    if (k === "qty") return String(v)
    return String(v)
}

function LinesTable({ columns, lines, canEdit, onPatch, onAskDelete, onAskEdit, canDeleteLine, isPharmacy }) {
    const cols = columns || [
        { key: "service_date", label: "Date" },
        { key: "item_code", label: "Code" },
        { key: "description", label: "Item Name" },
        { key: "qty", label: "Qty" },
        { key: "unit_price", label: "Unit Price" },
        { key: "discount_amount", label: "Discount" },
        { key: "gst_rate", label: "GST %" },
        { key: "tax_amount", label: "Tax" },
        { key: "net_amount", label: "Total" },
    ]

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="text-xs font-bold text-slate-600">
                    <tr className="border-b border-slate-100">
                        {cols.map((c) => (
                            <th key={c.key} className="py-3 pr-4">
                                {c.label}
                            </th>
                        ))}
                        <th className="py-3 pr-0 text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((r) => {
                        const canRowEdit = Boolean(canEdit)
                        const canRemove = Boolean(canDeleteLine?.(r))
                        const autoLinked = !r?.is_manual && String(r?.source_module || "").trim()

                        return (
                            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                {cols.map((c) => {
                                    const key = c.key
                                    const raw = getNested(r, key)

                                    // inline edit for qty + unit_price + discount_amount (draft only)
                                    if (key === "qty") {
                                        return (
                                            <td key={key} className="py-3 pr-4">
                                                <LineNumberInput
                                                    disabled={!canRowEdit}
                                                    value={raw ?? r.qty ?? 1}
                                                    onCommit={(v) => onPatch(r.id, { qty: Number(v || 0) })}
                                                    className="w-24"
                                                />
                                            </td>
                                        )
                                    }
                                    if (key === "unit_price") {
                                        return (
                                            <td key={key} className="py-3 pr-4">
                                                <LineNumberInput
                                                    disabled={!canRowEdit}
                                                    value={raw ?? r.unit_price ?? 0}
                                                    onCommit={(v) => onPatch(r.id, { unit_price: Number(v || 0) })}
                                                    className="w-28"
                                                />
                                            </td>
                                        )
                                    }
                                    if (key === "discount_amount") {
                                        return (
                                            <td key={key} className="py-3 pr-4">
                                                <LineNumberInput
                                                    disabled={!canRowEdit}
                                                    value={raw ?? r.discount_amount ?? 0}
                                                    onCommit={(v) => onPatch(r.id, { discount_amount: Number(v || 0) })}
                                                    className="w-28"
                                                />
                                            </td>
                                        )
                                    }

                                    return (
                                        <td key={key} className="py-3 pr-4">
                                            <div className={cx("text-slate-900", key === "description" ? "font-bold" : "font-semibold")}>
                                                {fmtCell(key, raw)}
                                            </div>

                                            {key === "description" ? (
                                                <div className="mt-0.5 text-xs text-slate-500">
                                                    {r.item_type || "—"} · {r.item_id ?? "—"} · {r.source_module || "—"}
                                                    {r.is_manual ? <span className="ml-2 rounded-lg bg-slate-100 px-2 py-0.5">MANUAL</span> : null}
                                                    {autoLinked ? <span className="ml-2 rounded-lg bg-amber-50 px-2 py-0.5 text-amber-800">AUTO</span> : null}
                                                    {isPharmacy && r?.meta?.batch_id ? (
                                                        <span className="ml-2 rounded-lg bg-slate-100 px-2 py-0.5">BATCH {r.meta.batch_id}</span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </td>
                                    )
                                })}

                                <td className="py-3 pr-0 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            disabled={!canRowEdit}
                                            onClick={() => onAskEdit(r)}
                                            title={!canRowEdit ? "Invoice locked" : "Edit line"}
                                        >
                                            <Pencil className="h-4 w-4" /> Edit
                                        </Button>

                                        <Button
                                            variant="outline"
                                            disabled={!canRemove}
                                            onClick={() => onAskDelete(r)}
                                            title={!canRemove ? "Invoice locked" : "Remove line"}
                                        >
                                            <Trash2 className="h-4 w-4" /> Remove
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>

            <div className="mt-3 text-xs text-slate-500">
                Note: AUTO lines are source-linked. Editing/removing affects billing only; it should not change stock/orders in source module.
            </div>
        </div>
    )
}

/* ----------------------------
   Payments Panel
----------------------------- */
function PaymentsPanel({ invoice, payments, paidTotal, dueTotal, onPaid }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        amount: "",
        mode: "CASH",
        txn_ref: "",
        notes: "",
    })

    const statusUpper = String(invoice?.status || "").toUpperCase()
    const canPay = statusUpper === "APPROVED" || statusUpper === "POSTED"

    async function submit() {
        if (!invoice?.billing_case_id) return toast.error("Case ID missing")
        const amt = Number(form.amount || 0)
        if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter valid amount")
        if (!canPay) return toast.error("Payments allowed only for APPROVED/POSTED invoices")

        setSaving(true)
        try {
            await billingPayOnCase(invoice.billing_case_id, {
                amount: amt,
                mode: form.mode,
                invoice_id: invoice.id,
                txn_ref: form.txn_ref || undefined,
                notes: form.notes || undefined,
            })
            toast.success("Payment recorded")
            setForm({ amount: "", mode: "CASH", txn_ref: "", notes: "" })
            onPaid?.()
        } catch (e) {
            toast.error(e?.message || "Payment failed")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader title="Payment History" subtitle="Payments linked to this invoice" />
                <CardBody>
                    {payments?.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left text-sm">
                                <thead className="text-xs font-bold text-slate-600">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 pr-4">Date</th>
                                        <th className="py-3 pr-4">Mode</th>
                                        <th className="py-3 pr-4">Txn Ref</th>
                                        <th className="py-3 pr-4">Notes</th>
                                        <th className="py-3 pr-0 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => (
                                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                            <td className="py-3 pr-4 font-semibold text-slate-800">{p.received_at || "—"}</td>
                                            <td className="py-3 pr-4">
                                                <Badge tone="slate">{p.mode || "—"}</Badge>
                                            </td>
                                            <td className="py-3 pr-4 font-semibold text-slate-800">{p.txn_ref || "—"}</td>
                                            <td className="py-3 pr-4 text-slate-700">{p.notes || "—"}</td>
                                            <td className="py-3 pr-0 text-right font-extrabold text-slate-900">₹ {money(p.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState title="No payments" desc="Record a payment on the right panel." />
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Record Payment" subtitle="Inside invoice page" />
                <CardBody>
                    <div className="space-y-3">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <Row label="Paid" value={`₹ ${money(paidTotal)}`} />
                            <Row label="Due" value={`₹ ${money(dueTotal)}`} strong />
                        </div>

                        <Field label="Amount">
                            <Input
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                placeholder="Enter amount"
                                disabled={!canPay}
                            />
                        </Field>

                        <Field label="Mode">
                            <select
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                                value={form.mode}
                                onChange={(e) => setForm({ ...form, mode: e.target.value })}
                                disabled={!canPay}
                            >
                                {PAY_MODES.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Txn Ref (optional)">
                            <Input
                                value={form.txn_ref}
                                onChange={(e) => setForm({ ...form, txn_ref: e.target.value })}
                                placeholder="UPI/Bank/Card ref"
                                disabled={!canPay}
                            />
                        </Field>

                        <Field label="Notes (optional)">
                            <Textarea
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Remarks"
                                disabled={!canPay}
                            />
                        </Field>

                        <Button onClick={submit} disabled={saving || !canPay}>
                            {saving ? "Saving..." : "Record Payment"}
                        </Button>

                        {!canPay ? (
                            <div className="text-xs text-amber-700">
                                Payments allowed only for <b>APPROVED/POSTED</b> invoices.
                            </div>
                        ) : null}
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}

/* ----------------------------
   Manual Line Dialog
----------------------------- */
function ManualLineDialog({ invoice, moduleCode, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const lockedGroup = MODULE_TO_GROUP[moduleCode] || "MISC"
    const pharmacy = isPharmacyModule(moduleCode)

    const [form, setForm] = useState({
        description: "",
        qty: 1,
        unit_price: 0,
        gst_rate: 0,
        discount_percent: 0,
        discount_amount: 0,
        doctor_id: "",
        service_date: "",
        meta_json: pharmacy
            ? {
                batch_id: "",
                expiry_date: "",
                hsn_sac: "",
                cgst_pct: "",
                sgst_pct: "",
            }
            : null,
        manual_reason: "Manual entry",
        showAdvanced: false,
    })

    async function submit() {
        if (!invoice?.id) return toast.error("Invoice not loaded")
        const statusUpper = String(invoice?.status || "").toUpperCase()
        if (statusUpper !== "DRAFT") return toast.error("Invoice locked. Reopen to edit.")
        if (!form.description?.trim()) return toast.error("Enter item name/description")
        if (String(form.manual_reason || "").trim().length < 3) return toast.error("Manual reason is mandatory")

        setSaving(true)
        try {
            const payload = {
                service_group: lockedGroup,
                description: form.description.trim(),
                qty: Number(form.qty || 1),
                unit_price: Number(form.unit_price || 0),
                gst_rate: Number(form.gst_rate || 0),
                discount_percent: Number(form.discount_percent || 0),
                discount_amount: Number(form.discount_amount || 0),
                doctor_id: moduleCode === "DOC" && form.doctor_id ? Number(form.doctor_id) : undefined,
                manual_reason: form.manual_reason || "Manual entry",
                service_date: form.service_date ? new Date(form.service_date).toISOString() : undefined,
                meta_json: pharmacy ? cleanMeta(form.meta_json) : undefined,
            }

            await billingAddManualLine(invoice.id, payload)
            toast.success("Line added")
            onDone?.()
        } catch (e) {
            toast.error(e?.message || "Failed to add line")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={`Add Line · ${invoice?.module_label || moduleCode}`}
            onClose={onClose}
            right={
                <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Add"}
                </Button>
            }
        >
            <div className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                    <div className="font-extrabold text-slate-900">Locked Service Group</div>
                    <Badge tone="slate">{lockedGroup}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                    You can add only <b>{lockedGroup}</b> lines in this invoice (module restriction).
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Qty">
                    <Input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
                </Field>

                <Field label="Unit Price (₹)">
                    <Input value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Description">
                        <Input
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="e.g., Consultation fee / Room charge / Procedure"
                        />
                    </Field>
                </div>

                <Field label="GST %">
                    <Input value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} />
                </Field>

                <Field label="Discount Amount (₹)">
                    <Input value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
                </Field>

                {pharmacy ? (
                    <div className="md:col-span-2">
                        <div className="rounded-2xl border border-slate-100 bg-white p-4">
                            <div className="font-extrabold text-slate-900">Pharmacy Meta (optional)</div>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="Batch">
                                    <Input
                                        value={form.meta_json?.batch_id || ""}
                                        onChange={(e) => setForm({ ...form, meta_json: { ...form.meta_json, batch_id: e.target.value } })}
                                    />
                                </Field>
                                <Field label="Expiry (YYYY-MM-DD)">
                                    <Input
                                        value={form.meta_json?.expiry_date || ""}
                                        onChange={(e) => setForm({ ...form, meta_json: { ...form.meta_json, expiry_date: e.target.value } })}
                                    />
                                </Field>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="md:col-span-2">
                    <Field label="Manual Reason (Audit mandatory)">
                        <Textarea
                            value={form.manual_reason}
                            onChange={(e) => setForm({ ...form, manual_reason: e.target.value })}
                            placeholder="Reason is mandatory for audit"
                        />
                    </Field>
                </div>
            </div>
        </Modal>
    )
}

function cleanMeta(m) {
    if (!m) return undefined
    const out = {}
    for (const k of Object.keys(m)) {
        const v = String(m[k] ?? "").trim()
        if (v) out[k] = v
    }
    return out
}

/* ----------------------------
   Edit/Delete dialogs for ALL lines (auto + manual)
----------------------------- */
function DeleteLineDialog({ line, onClose, onConfirm }) {
    const [reason, setReason] = useState("")
    const autoLinked = !line?.is_manual && String(line?.source_module || "").trim()

    return (
        <Modal
            title="Remove Line"
            onClose={onClose}
            right={
                <Button
                    variant="danger"
                    onClick={() => {
                        const r = String(reason || "").trim()
                        if (r.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
                        onConfirm(r)
                    }}
                >
                    Remove
                </Button>
            }
        >
            <div className={cn(
                "rounded-2xl px-4 py-3 text-sm",
                autoLinked ? "border border-amber-100 bg-amber-50 text-amber-900" : "border border-rose-100 bg-rose-50 text-rose-800"
            )}>
                {autoLinked ? (
                    <>
                        This is an <b>AUTO</b> line linked to <b>{line.source_module}</b>. Removing it will affect <b>billing only</b>.
                        It should <b>not</b> cancel/modify the source transaction (stock/orders).
                    </>
                ) : (
                    <>This line will be removed from the invoice totals.</>
                )}
            </div>

            <div className="mt-3">
                <Field label="Reason (mandatory for audit)">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason..." />
                </Field>
            </div>
        </Modal>
    )
}

function EditLineDialog({ line, onClose, onConfirm }) {
    const autoLinked = !line?.is_manual && String(line?.source_module || "").trim()

    const [form, setForm] = useState({
        description: line?.description ?? "",
        qty: line?.qty ?? 1,
        unit_price: line?.unit_price ?? 0,
        gst_rate: line?.gst_rate ?? 0,
        discount_amount: line?.discount_amount ?? 0,
        service_date: (line?.service_date || "").slice(0, 10),
        reason: "",
    })

    function buildPatch() {
        return {
            description: String(form.description || "").trim(),
            qty: Number(form.qty || 0),
            unit_price: Number(form.unit_price || 0),
            gst_rate: Number(form.gst_rate || 0),
            discount_amount: Number(form.discount_amount || 0),
            service_date: form.service_date ? new Date(form.service_date).toISOString() : undefined,
        }
    }

    return (
        <Modal
            title="Edit Line"
            onClose={onClose}
            right={
                <Button
                    onClick={() => {
                        const r = String(form.reason || "").trim()
                        if (r.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
                        const patch = buildPatch()
                        if (!patch.description) return toast.error("Description required")
                        if (!Number.isFinite(patch.qty) || patch.qty <= 0) return toast.error("Qty must be > 0")
                        onConfirm(patch, r)
                    }}
                >
                    Save
                </Button>
            }
        >
            {autoLinked ? (
                <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This is an <b>AUTO</b> line from <b>{line.source_module}</b>. Your change affects <b>billing only</b>.
                    Source module transaction should not be modified here.
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                    <Field label="Description">
                        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </Field>
                </div>

                <Field label="Qty">
                    <Input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
                </Field>

                <Field label="Unit Price (₹)">
                    <Input value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
                </Field>

                <Field label="GST %">
                    <Input value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} />
                </Field>

                <Field label="Discount Amount (₹)">
                    <Input value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Service Date (optional)">
                        <Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
                    </Field>
                </div>

                <div className="md:col-span-2">
                    <Field label="Reason (mandatory for audit)">
                        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Enter reason..." />
                    </Field>
                </div>
            </div>
        </Modal>
    )
}

/* ----------------------------
   Small UI helpers
----------------------------- */
function LineNumberInput({ value, onCommit, disabled, className }) {
    const [v, setV] = useState(String(value ?? ""))

    useEffect(() => {
        setV(String(value ?? ""))
    }, [value])

    function commit() {
        if (disabled) return
        const next = String(v ?? "").trim()
        const prev = String(value ?? "").trim()
        if (next !== prev) onCommit(next)
    }

    return (
        <Input
            className={className}
            disabled={disabled}
            value={v}
            onChange={(e) => setV(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault()
                    commit()
                }
            }}
        />
    )
}

function MiniStat({ label, value, strong }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <div className="text-xs font-bold text-slate-500">{label}</div>
            <div className={cn("mt-1 text-sm", strong ? "font-extrabold text-slate-900" : "font-bold text-slate-800")}>
                {value}
            </div>
        </div>
    )
}

function TabBtn({ active, onClick, icon, children }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-extrabold",
                active ? "border-slate-300 bg-white text-slate-900" : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100"
            )}
        >
            {icon}
            {children}
        </button>
    )
}

function Row({ label, value, strong }) {
    return (
        <div className="flex items-center justify-between">
            <div className={cn("text-xs", strong ? "font-bold text-slate-700" : "text-slate-500")}>{label}</div>
            <div className={cn("text-sm", strong ? "font-extrabold text-slate-900" : "font-bold text-slate-800")}>
                {value}
            </div>
        </div>
    )
}

/* ---------------- Dialogs ---------------- */
function Modal({ title, children, onClose, right }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="text-base font-extrabold text-slate-900">{title}</div>
                    <div className="flex items-center gap-2">
                        {right}
                        <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                            Close
                        </button>
                    </div>
                </div>
                <div className="px-5 py-4">{children}</div>
            </div>
        </div>
    )
}

function ReasonDialog({ title, desc, confirmText, tone, onClose, onConfirm }) {
    const [reason, setReason] = useState("")
    return (
        <Modal
            title={title}
            onClose={onClose}
            right={
                <Button
                    variant={tone === "danger" ? "danger" : "default"}
                    onClick={() => {
                        const r = String(reason || "").trim()
                        if (r.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
                        onConfirm(r)
                    }}
                >
                    {confirmText}
                </Button>
            }
        >
            <div className={cn(
                "rounded-2xl px-4 py-3 text-sm",
                tone === "danger"
                    ? "border border-rose-100 bg-rose-50 text-rose-800"
                    : "border border-slate-100 bg-slate-50 text-slate-700"
            )}>
                {desc}
            </div>
            <div className="mt-3">
                <Field label="Reason (mandatory for audit)">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason..." />
                </Field>
            </div>
        </Modal>
    )
}

function VoidDialog({ onClose, onConfirm }) {
    const [reason, setReason] = useState("")
    return (
        <Modal
            title="Void Invoice"
            onClose={onClose}
            right={
                <Button
                    variant="danger"
                    onClick={() => {
                        const r = String(reason || "").trim()
                        if (r.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
                        onConfirm(r)
                    }}
                >
                    Void Now
                </Button>
            }
        >
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                Voiding marks the invoice as VOID (cannot be posted). For posted invoices, use credit note flow.
            </div>
            <div className="mt-3">
                <Field label="Reason (mandatory)">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason..." />
                </Field>
            </div>
        </Modal>
    )
}
