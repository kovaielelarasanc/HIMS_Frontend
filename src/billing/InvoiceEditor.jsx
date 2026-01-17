// FILE: src/pages/billing/InvoiceEditor.jsx
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import {
    billingAddManualLine,
    billingAddManualLineV2,
    billingApproveInvoice,
    billingDeleteLine,
    billingGetInvoice,
    billingGetInvoicePdf,
    billingListInvoiceAuditLogs,
    billingListInvoiceLines,
    billingListInvoicePayments,
    billingModulesMeta,
    billingPayOnCase,
    billingPostInvoice,
    billingReopenInvoice,
    billingRequestInvoiceEdit,
    billingUpdateLine,
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
} from "@/billing/_ui"

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
    Stethoscope,
    Building2,
    UserRound,
    FileDown,
    Printer,
} from "lucide-react"

const cx = (...a) => a.filter(Boolean).join(" ")

function num(v, fb = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
}
function upper(v) {
    return String(v || "").trim().toUpperCase()
}

function isPharmacyModule(m) {
    const x = String(m || "").trim().toUpperCase()
    return x === "PHM" || x === "PHC" || x === "PHARMACY"
}

function isDocModule(m) {
    return String(m || "").trim().toUpperCase() === "DOC"
}

function prettyModuleLabel(code, fallback) {
    const x = String(code || "").trim().toUpperCase()
    if (x === "DOC") return "Doctor Fees"
    if (x === "LAB") return "Laboratory"
    if (x === "BLOOD") return "Blood Bank"
    if (x === "SCAN" || x === "XRAY" || x === "RAD") return "Radiology"
    if (x === "PHM" || x === "PHC" || x === "PHARMACY") return "Pharmacy"
    if (x === "ROOM") return "Room / Bed Charges"
    if (x === "PROC") return "Procedures"
    if (x === "OT") return "OT"
    return fallback || x || "MISC"
}

function fmtDateISO(v) {
    if (!v) return ""
    try {
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
        return d.toISOString().slice(0, 10)
    } catch {
        return String(v).slice(0, 10)
    }
}

function fmtDateTime(v) {
    if (!v) return "—"
    try {
        return new Date(v).toLocaleString("en-IN")
    } catch {
        return String(v)
    }
}

/* =========================================================
   ✅ Allocation-based paid calculation (invoice)
========================================================= */
function paymentAllocatedToThisInvoice(p, invoiceId) {
    const invId = Number(invoiceId)
    if (!Number.isFinite(invId) || invId <= 0) return 0

    // ignore VOID only
    if (upper(p?.status) === "VOID") return 0

    // allow more kinds (your backend may use ADVANCE / ADJUSTMENT etc.)
    const k = upper(p?.kind || "")
    const blocked = ["REFUND", "REVERSAL", "CHARGEBACK", "VOID"]
    if (k && blocked.includes(k)) return 0

    // direct allocated fields (some APIs return this)
    const direct =
        p?.allocated_amount ??
        p?.amount_allocated ??
        p?.invoice_amount ??
        p?.invoice_allocated_amount ??
        p?.applied_amount

    if (direct != null) return Math.max(0, num(direct, 0))

    // allocations array
    const allocs =
        Array.isArray(p?.allocations) ? p.allocations :
            Array.isArray(p?.payment_allocations) ? p.payment_allocations :
                null

    if (Array.isArray(allocs) && allocs.length) {
        const sum = allocs.reduce((s, a) => {
            if (upper(a?.status) === "VOID") return s
            const aInv = Number(a?.invoice_id ?? a?.billing_invoice_id ?? a?.invoiceId)
            if (aInv !== invId) return s
            return s + num(a?.amount ?? a?.allocated_amount, 0)
        }, 0)
        return Math.max(0, Number(sum.toFixed(2)))
    }

    // fallback only if payment tied to invoice
    if (Number(p?.invoice_id) === invId) return Math.max(0, num(p?.amount, 0))

    return 0
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
    RAD: "RAD",
    PHM: "PHARM",
    PHC: "PHARM",
    PHARMACY: "PHARM",
    ROOM: "ROOM",
    NURSING: "NURSING",
    PROC: "PROC",
    SURG: "OT",
    OT: "OT",
    ADM: "MISC",
    DIET: "MISC",
    MISC: "MISC",
}

// ✅ backend PayMode enum: CASH, CARD, UPI, BANK, WALLET
const PAY_MODES = ["CASH", "CARD", "UPI", "BANK", "WALLET"]

// ✅ Fallback columns (if backend meta not provided)
const FALLBACK_DEFAULT_COLS = [
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

// ✅ DOC columns (Doctor + Department visible)
const FALLBACK_DOC_COLS = [
    { key: "service_date", label: "Service Date" },
    { key: "department_name", label: "Department" },
    { key: "doctor_name", label: "Doctor" },
    { key: "description", label: "Particular" },
    { key: "qty", label: "Qty" },
    { key: "unit_price", label: "Amount" },
    { key: "discount_amount", label: "Discount" },
    { key: "gst_rate", label: "GST %" },
    { key: "tax_amount", label: "Tax" },
    { key: "net_amount", label: "Total" },
]

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
        return () => {
            alive = false
        }
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

            setLines(Array.isArray(l) ? l : l?.items ?? l?.results ?? [])
            setPayments(Array.isArray(p) ? p : p?.items ?? p?.results ?? [])
        } catch (e) {
            if (!isCanceledError(e)) toast.error(e?.message || "Failed to load invoice")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        return () => abortRef.current?.abort?.()
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
            setAuditLogs(Array.isArray(r) ? r : r?.items ?? r?.results ?? [])
        } catch {
            // ignore soft errors
        } finally {
            setAuditLoading(false)
        }
    }

    useEffect(() => {
        if (tab !== "AUDIT") return
        let alive = true
            ; (async () => {
                await loadAudit()
                if (!alive) return
            })()
        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, invoiceId])

    const statusUpper = String(invoice?.status || "").trim().toUpperCase()
    const moduleCode = String(invoice?.module || "MISC").trim().toUpperCase()
    const moduleLabel = prettyModuleLabel(moduleCode, invoice?.module_label || moduleCode)

    const docMode = isDocModule(moduleCode)

    // ✅ STRICT RULE: Editable ONLY in DRAFT
    const canEditLines = statusUpper === "DRAFT"

    // ✅ Paid/Due computed from allocations (or invoice computed fields if present)
    const grandTotal = num(invoice?.grand_total ?? 0)

    const paidTotal = useMemo(() => {
        // allocation-first truth
        const allocPaid = payments.reduce((s, p) => s + paymentAllocatedToThisInvoice(p, invoice?.id), 0)

        // fallback only if payments not loaded yet
        if (!payments?.length) {
            const fromInv = invoice?.paid_total ?? invoice?.paid_amount ?? invoice?.paid ?? null
            if (fromInv != null && Number.isFinite(Number(fromInv))) return Math.max(0, num(fromInv, 0))
        }

        return Math.max(0, Number(allocPaid.toFixed(2)))
    }, [payments, invoice?.id, invoice?.paid_total, invoice?.paid_amount, invoice?.paid])

    const dueTotal = useMemo(() => {
        // ALWAYS compute due from grand - paid (prevents stale due_total UI)
        const due = grandTotal - paidTotal
        return Math.max(0, Number(due.toFixed(2)))
    }, [grandTotal, paidTotal])

    const totals = useMemo(() => {
        const sub = lines.reduce((s, r) => s + num(r.line_total ?? num(r.qty) * num(r.unit_price)), 0)
        const disc = lines.reduce((s, r) => s + num(r.discount_amount), 0)
        const tax = lines.reduce((s, r) => s + num(r.tax_amount), 0)
        const grand = lines.reduce((s, r) => s + num(r.net_amount), 0)
        return { sub, disc, tax, grand }
    }, [lines])

    // ✅ Columns: prefer backend meta; fallback to DOC/DEFAULT local columns
    const columns = useMemo(() => {
        const colMap = modulesMeta?.columns || {}

        let base
        if (docMode) {
            base = colMap.DOC || FALLBACK_DOC_COLS
        } else {
            const key = isPharmacyModule(moduleCode) ? "PHARMACY" : "DEFAULT"
            base = colMap[key] || colMap.DEFAULT || FALLBACK_DEFAULT_COLS
        }

        // ✅ Pharmacy: enforce Batch No column (and convert batch_id -> batch_no if needed)
        if (isPharmacyModule(moduleCode)) {
            return ensurePharmacyBatchNoColumn(base)
        }

        return base
    }, [modulesMeta, moduleCode, docMode])


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
                r.doctor_name,
                r.department_name,
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
            const s = [a.action, a.reason, a.entity_type, a.entity_id, a.user_label, a.created_at]
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
                try {
                    w.print()
                } catch { }
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
            toast.error(e?.message || e?.response?.data?.detail || "Update failed")
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

    function LockedBanner() {
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
            <div className="relative overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                {/* soft background */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-slate-200/40 blur-3xl" />
                    <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-slate-100 blur-3xl" />
                </div>

                {/* Header */}
                <div className="relative p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                            <Button variant="outline" onClick={() => nav(-1)}>
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Button>

                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-xl font-extrabold text-slate-900">Invoice</div>
                                    <StatusBadge status={invoice?.status} />
                                    <Badge tone="slate">{moduleLabel}</Badge>
                                    {docMode ? (
                                        <span className="inline-flex items-center gap-1 rounded-xl border border-slate-100 bg-white px-2 py-1 text-xs font-extrabold text-slate-700">
                                            <Stethoscope className="h-3.5 w-3.5" /> DOC
                                        </span>
                                    ) : null}
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
                                    {invoice?.created_at ? <span>· Created: {fmtDateTime(invoice.created_at)}</span> : null}
                                </div>

                                {docMode ? (
                                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        <InfoTile
                                            icon={<Stethoscope className="h-4 w-4 text-slate-500" />}
                                            title="Module"
                                            value="Doctor Fees (Manual Amount)"
                                        />
                                        <InfoTile
                                            icon={<Building2 className="h-4 w-4 text-slate-500" />}
                                            title="Policy"
                                            value="No Doctor Fee Master · Price is manual"
                                        />
                                        <InfoTile
                                            icon={<UserRound className="h-4 w-4 text-slate-500" />}
                                            title="Data"
                                            value="Doctor + Department saved per line"
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button variant="outline" onClick={load} disabled={loading}>
                                <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                                Refresh
                            </Button>

                            {PdfButtons ? (
                                <PdfButtons onDownload={onDownload} onPrint={onPrint} />
                            ) : (
                                <>
                                    <Button variant="outline" onClick={onDownload} disabled={!invoice}>
                                        <FileDown className="h-4 w-4" /> Download
                                    </Button>
                                    <Button variant="outline" onClick={onPrint} disabled={!invoice}>
                                        <Printer className="h-4 w-4" /> Print
                                    </Button>
                                </>
                            )}

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

                {/* Summary + right workspace */}
                <div className="relative grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-3">
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
                                <EmptyState title="Invoice not found" desc="Check invoice ID or backend route." />
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <MiniStat label="Sub Total" value={`₹ ${money(invoice?.sub_total ?? totals.sub)}`} />
                                        <MiniStat label="Discount" value={`₹ ${money(invoice?.discount_total ?? totals.disc)}`} />
                                        <MiniStat label="Tax" value={`₹ ${money(invoice?.tax_total ?? totals.tax)}`} />
                                        <MiniStat label="Grand Total" value={`₹ ${money(invoice?.grand_total ?? totals.grand)}`} strong />
                                        <MiniStat label="Paid (Allocated)" value={`₹ ${money(paidTotal)}`} />
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

                                    <LockedBanner />
                                </>
                            )}
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader title="Workspace" subtitle="Switch panels quickly" />
                        <CardBody>
                            <div className="flex flex-col gap-2">
                                <TabBtn
                                    active={tab === "LINES"}
                                    onClick={() => setTab("LINES")}
                                    icon={docMode ? <Stethoscope className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                                >
                                    Invoice Lines
                                </TabBtn>
                                <TabBtn
                                    active={tab === "PAYMENTS"}
                                    onClick={() => setTab("PAYMENTS")}
                                    icon={<CreditCard className="h-4 w-4" />}
                                >
                                    Payments
                                </TabBtn>
                                <TabBtn
                                    active={tab === "AUDIT"}
                                    onClick={() => setTab("AUDIT")}
                                    icon={<FileClock className="h-4 w-4" />}
                                >
                                    Audit Logs
                                </TabBtn>

                                <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                                    <div className="font-bold text-slate-800">Rules</div>
                                    <ul className="mt-1 list-disc pl-5">
                                        <li>Lines editable only in DRAFT</li>
                                        <li>After APPROVE → locked</li>
                                        <li>Edits after approval require Edit Request / Reopen</li>
                                        <li>AUTO lines are source-linked; edit affects billing only</li>
                                    </ul>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Content */}
                <div className="relative px-4 pb-5 sm:px-5">
                    {tab === "LINES" ? (
                        <Card className="mt-1">
                            <CardHeader
                                title={docMode ? "Doctor Fees Lines" : "Invoice Lines"}
                                subtitle={
                                    docMode
                                        ? "Doctor & Department are stored per line. Amount is manual (No fee master)."
                                        : `Module: ${moduleLabel} · Edit/Delete works for both MANUAL and AUTO lines in DRAFT`
                                }
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
                                                placeholder={docMode ? "Search doctor / department / particular…" : "Search lines by name / code / source / group…"}
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
                                                ? canEditLines
                                                    ? "Add at least one line before approving."
                                                    : "Invoice is locked."
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
                                        isPharmacy={isPharmacyModule(moduleCode)}
                                        docMode={docMode}
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
                        <Card className="mt-1">
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
                        <Card className="mt-1">
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
                                    <div className="text-xs text-slate-500">{filteredAudit.length} record(s)</div>
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
                                                        <Fragment key={a.id}>
                                                            <tr className="border-b border-slate-50 hover:bg-slate-50/60">
                                                                <td className="py-3 pr-4 font-semibold text-slate-800">{fmtDateTime(a.created_at || a.at)}</td>
                                                                <td className="py-3 pr-4 font-semibold text-slate-800">{a.user_label || a.user_name || "—"}</td>
                                                                <td className="py-3 pr-4">
                                                                    <Badge tone="slate">{a.action || "—"}</Badge>
                                                                </td>
                                                                <td className="py-3 pr-4 text-slate-700">
                                                                    {a.entity_type || "—"} · {a.entity_id ?? "—"}
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
                                                                                    {JSON.stringify(a.old_json ?? a.old ?? {}, null, 2)}
                                                                                </pre>
                                                                            </div>
                                                                            <div className="rounded-2xl border border-slate-100 bg-white p-3">
                                                                                <div className="text-xs font-extrabold text-slate-700">New</div>
                                                                                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
                                                                                    {JSON.stringify(a.new_json ?? a.new ?? {}, null, 2)}
                                                                                </pre>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ) : null}
                                                        </Fragment>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    )}
                </div>

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
                        docMode={docMode}
                        isPharmacy={isPharmacyModule(moduleCode)}
                        onClose={() => setEditTarget(null)}
                        onConfirm={(patch, reason) => {
                            updateLineWithReason(editTarget.line.id, patch, reason)
                            setEditTarget(null)
                        }}
                    />
                ) : null}
            </div>
        </div>
    )
}

/* ---------------------------------
   Small UI blocks
---------------------------------- */

function TabBtn({ active, onClick, icon, children }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-100 bg-white text-slate-800 hover:bg-slate-50"
            )}
        >
            <div className="flex items-center gap-2">
                <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-xl", active ? "bg-white/10" : "bg-slate-50")}>
                    {icon}
                </span>
                <div className="text-sm font-extrabold">{children}</div>
            </div>
            <span className={cn("text-xs font-bold", active ? "text-white/70" : "text-slate-500")}>
                {active ? "Active" : "Open"}
            </span>
        </button>
    )
}

function MiniStat({ label, value, strong }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">{label}</div>
            <div className={cn("mt-1 text-sm font-extrabold text-slate-900", strong ? "text-base" : "")}>
                {value}
            </div>
        </div>
    )
}

function InfoTile({ icon, title, value }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <div className="text-[11px] font-extrabold text-slate-500">{title}</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                {icon}
                {value}
            </div>
        </div>
    )
}

/* ---------------------------------
   Lines Table
---------------------------------- */

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
    if (v == null || v === "") return "—"
    const k = String(key || "")

    if (k === "service_date") {
        return fmtDateISO(v) || "—"
    }
    if (k.includes("amount") || k === "unit_price" || k === "line_total" || k === "net_amount") {
        return `₹ ${money(v)}`
    }
    return String(v)
}

function getLineMeta(line) {
    const m =
        (line?.meta && typeof line.meta === "object" ? line.meta : null) ||
        (line?.meta_json && typeof line.meta_json === "object" ? line.meta_json : null) ||
        (line?.metaJson && typeof line.metaJson === "object" ? line.metaJson : null)
    return m || null
}

function getBatchNo(line) {
    const m = getLineMeta(line)
    const v =
        m?.batch_no ??
        m?.batchNo ??
        m?.batch_number ??
        m?.batchNumber ??
        m?.batch
    const s = String(v ?? "").trim()
    return s || ""
}

function ensurePharmacyBatchNoColumn(cols) {
    const base = Array.isArray(cols) ? [...cols] : []

    // If backend gives batch_id column, convert it to batch_no column (UI-only)
    const idxBatchId = base.findIndex((c) => String(c?.key || "").toLowerCase().includes("batch_id"))
    if (idxBatchId >= 0) {
        base[idxBatchId] = { ...base[idxBatchId], key: "batch_no", label: "Batch No" }
        return base
    }

    // If Batch No already exists, keep as-is
    const hasBatchNo = base.some((c) => {
        const k = String(c?.key || "").toLowerCase()
        return k === "batch_no" || k.endsWith(".batch_no") || k.includes("batch_no")
    })
    if (hasBatchNo) return base

    // Insert after Item Name/Description
    const idxDesc = base.findIndex((c) => String(c?.key || "") === "description")
    const insertAt = idxDesc >= 0 ? idxDesc + 1 : 3

    return [
        ...base.slice(0, insertAt),
        { key: "batch_no", label: "Batch No" },
        ...base.slice(insertAt),
    ]
}



function LinesTable({ columns, lines, canEdit, onPatch, onAskDelete, onAskEdit, isPharmacy, docMode }) {
    const cols = columns || (docMode ? FALLBACK_DOC_COLS : FALLBACK_DEFAULT_COLS)
    const hasBatchCol = isPharmacy && cols.some((c) => String(c?.key || "") === "batch_no")

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
                        const autoLinked = !r?.is_manual && String(r?.source_module || "").trim()
                        console.log(r.meta, " batch id")
                        return (
                            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                {cols.map((c) => {
                                    const key = c.key
                                    const raw = getNested(r, key)
                                    if (key === "batch_no" && isPharmacy) {
                                        const bn = getBatchNo(r)
                                        return (
                                            <td key={key} className="py-3 pr-4">
                                                {bn ? (
                                                    <span className="inline-flex max-w-[180px] truncate rounded-xl border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-extrabold text-slate-800">
                                                        {bn}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                        )
                                    }
                                    if (key === "qty") {
                                        return (
                                            <td key={key} className="py-3 pr-4">
                                                <LineNumberInput
                                                    disabled={!canEdit}
                                                    value={raw ?? r.qty ?? 1}
                                                    onCommit={(v) => onPatch(r.id, { qty: Number(v || 0) })}
                                                    className="w-24"
                                                />
                                            </td>
                                        )
                                    }
                                    if (key === "unit_price") {
                                        function toDecStr(v) {
                                            const s = String(v ?? "").replace(/[₹,\s]/g, "").trim()
                                            return s === "" ? "0" : s
                                        }
                                        return (
                                            <td key={key} className="py-3 pr-4">
                                                <LineNumberInput
                                                    disabled={!canEdit}
                                                    value={raw ?? r.unit_price ?? 0}
                                                    onCommit={(v) => onPatch(r.id, { unit_price: toDecStr(v) })}
                                                    className="w-28"
                                                />
                                            </td>
                                        )
                                    }
                                    if (key === "discount_amount") {
                                        return (
                                            <td key={key} className="py-3 pr-4">
                                                <LineNumberInput
                                                    disabled={!canEdit}
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
                                                    {isPharmacy && !hasBatchCol ? (
                                                        (() => {
                                                            const bn = getBatchNo(r)
                                                            return bn ? (
                                                                <span className="ml-2 rounded-lg bg-slate-100 px-2 py-0.5">BATCH {bn}</span>
                                                            ) : null
                                                        })()
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </td>
                                    )
                                })}

                                <td className="py-3 pr-0 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" disabled={!canEdit} onClick={() => onAskEdit(r)}>
                                            <Pencil className="h-4 w-4" /> Edit
                                        </Button>

                                        <Button variant="outline" disabled={!canEdit} onClick={() => onAskDelete(r)}>
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

/* ---------------------------------
   Inline number input
---------------------------------- */

function LineNumberInput({ value, onCommit, disabled, className }) {
    const [v, setV] = useState(value ?? "")
    useEffect(() => setV(value ?? ""), [value])

    function commit() {
        if (disabled) return
        const x = String(v ?? "").trim()
        if (x === "") return
        onCommit?.(x)
    }

    return (
        <input
            className={cn(
                "h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400",
                disabled ? "bg-slate-50 text-slate-500" : "",
                className
            )}
            value={v}
            onChange={(e) => setV(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") setV(value ?? "")
            }}
            disabled={disabled}
            inputMode="decimal"
        />
    )
}

/* ---------------------------------
   Payments Panel
---------------------------------- */

function Row({ label, value, strong }) {
    return (
        <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-600">{label}</div>
            <div className={cn("text-sm font-extrabold text-slate-900", strong ? "text-base" : "")}>{value}</div>
        </div>
    )
}

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
            const payerType = upper(invoice?.payer_type || "PATIENT")
            const payerIdRaw = invoice?.payer_id
            const payerId =
                payerType === "PATIENT"
                    ? undefined
                    : (payerIdRaw != null && Number(payerIdRaw) > 0 ? Number(payerIdRaw) : undefined)

            await billingPayOnCase(invoice.billing_case_id, {
                amount: amt,
                mode: form.mode,
                invoice_id: invoice.id,
                payer_type: payerType,
                payer_id: payerId,
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
                <CardHeader title="Payment History" subtitle="Allocated amount affects Due" />
                <CardBody>
                    {payments?.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="text-xs font-bold text-slate-600">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 pr-4">Date</th>
                                        <th className="py-3 pr-4">Mode</th>
                                        <th className="py-3 pr-4">Txn Ref</th>
                                        <th className="py-3 pr-4">Notes</th>
                                        <th className="py-3 pr-0 text-right">Allocated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => {
                                        const allocated = paymentAllocatedToThisInvoice(p, invoice?.id)
                                        return (
                                            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                                <td className="py-3 pr-4 font-semibold text-slate-800">{fmtDateTime(p.received_at || p.paid_at || p.created_at)}</td>
                                                <td className="py-3 pr-4">
                                                    <Badge tone="slate">{p.mode || "—"}</Badge>
                                                </td>
                                                <td className="py-3 pr-4 font-semibold text-slate-800">{p.txn_ref || "—"}</td>
                                                <td className="py-3 pr-4 text-slate-700">{p.notes || "—"}</td>
                                                <td className="py-3 pr-0 text-right font-extrabold text-slate-900">
                                                    ₹ {money(allocated)}
                                                    <div className="text-[11px] font-semibold text-slate-500">
                                                        Receipt: ₹ {money(p.amount)}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
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
                            <Row label="Paid (Allocated)" value={`₹ ${money(paidTotal)}`} />
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

/* ---------------------------------
   Modal + dialogs
---------------------------------- */

function Modal({ title, children, onClose, right }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="text-base font-extrabold text-slate-900">{title}</div>
                    <div className="flex items-center gap-2">
                        {right}
                        <button
                            onClick={onClose}
                            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                            Close
                        </button>
                    </div>
                </div>
                <div className="px-5 py-4">{children}</div>
            </div>
        </div>
    )
}

function ReasonDialog({ title, desc, confirmText, onClose, onConfirm, tone }) {
    const [reason, setReason] = useState("")
    const danger = tone === "danger"
    return (
        <Modal
            title={title}
            onClose={onClose}
            right={
                <Button
                    variant={danger ? "danger" : "default"}
                    onClick={() => {
                        const r = String(reason || "").trim()
                        if (r.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
                        onConfirm?.(r)
                    }}
                >
                    {confirmText || "Confirm"}
                </Button>
            }
        >
            <div className="text-sm text-slate-600">{desc}</div>
            <div className="mt-4">
                <Field label="Reason (required)">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Type reason..." />
                </Field>
            </div>
            <div className="mt-3 text-xs text-slate-500">Audit rule: reason is mandatory for compliance.</div>
        </Modal>
    )
}

function VoidDialog({ onClose, onConfirm }) {
    return (
        <ReasonDialog
            title="Void Invoice"
            desc="Voiding invoice will cancel it for billing. This action is audited."
            confirmText="Void Now"
            tone="danger"
            onClose={onClose}
            onConfirm={onConfirm}
        />
    )
}

function DeleteLineDialog({ line, onClose, onConfirm }) {
    const [reason, setReason] = useState("")
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
                        onConfirm?.(r)
                    }}
                >
                    Remove
                </Button>
            }
        >
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="font-extrabold text-slate-900">{line?.description || "—"}</div>
                <div className="mt-0.5 text-xs text-slate-600">
                    Qty: {line?.qty ?? "—"} · Unit: ₹ {money(line?.unit_price)} · Total: ₹ {money(line?.net_amount)}
                </div>
            </div>

            <div className="mt-4">
                <Field label="Reason (required)">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why removing this line?" />
                </Field>
            </div>
        </Modal>
    )
}

function cleanMeta(meta) {
    if (!meta || typeof meta !== "object") return undefined
    const out = {}
    for (const [k, v] of Object.entries(meta)) {
        if (v === "" || v == null) continue
        out[k] = v
    }
    return Object.keys(out).length ? out : undefined
}

function EditLineDialog({ line, docMode, isPharmacy, onClose, onConfirm }) {
    const [reason, setReason] = useState("Correction")
    const [form, setForm] = useState({
        service_date: fmtDateISO(line?.service_date),
        description: line?.description || "",
        qty: String(line?.qty ?? 1),
        unit_price: String(line?.unit_price ?? 0),
        discount_amount: String(line?.discount_amount ?? 0),
        gst_rate: String(line?.gst_rate ?? 0),
        doctor_name: line?.doctor_name || "",
        department_name: line?.department_name || "",
        meta_json: isPharmacy ? JSON.stringify(line?.meta ?? line?.meta_json ?? {}, null, 2) : "",
    })

    function buildPatch() {
        const patch = {
            service_date: form.service_date ? new Date(form.service_date).toISOString() : null,
            description: String(form.description || "").trim() || null,
            qty: Number(form.qty || 0),
            unit_price: Number(form.unit_price || 0),
            discount_amount: Number(form.discount_amount || 0),
            gst_rate: Number(form.gst_rate || 0),
        }

        if (docMode) {
            patch.doctor_name = String(form.doctor_name || "").trim() || null
            patch.department_name = String(form.department_name || "").trim() || null
        }

        if (isPharmacy) {
            try {
                const obj = form.meta_json?.trim() ? JSON.parse(form.meta_json) : {}
                patch.meta_json = cleanMeta(obj) || null
            } catch {
                throw new Error("Meta JSON invalid (pharmacy)")
            }
        }

        const out = {}
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) continue
            if (v === null) continue
            out[k] = v
        }
        return out
    }

    return (
        <Modal
            title="Edit Line"
            onClose={onClose}
            right={
                <Button
                    onClick={() => {
                        const r = String(reason || "").trim()
                        if (r.length < 3) return toast.error("Reason is mandatory (min 3 chars)")
                        let patch
                        try {
                            patch = buildPatch()
                        } catch (e) {
                            return toast.error(e?.message || "Invalid input")
                        }
                        if (!patch || Object.keys(patch).length === 0) return toast.error("Nothing to update")
                        onConfirm?.(patch, r)
                    }}
                >
                    Save Changes
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Service Date">
                    <Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
                </Field>

                <Field label="GST %">
                    <Input value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} inputMode="decimal" />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Description">
                        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </Field>
                </div>

                {docMode ? (
                    <>
                        <Field label="Department">
                            <Input value={form.department_name} onChange={(e) => setForm({ ...form, department_name: e.target.value })} />
                        </Field>
                        <Field label="Doctor">
                            <Input value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} />
                        </Field>
                    </>
                ) : null}

                <Field label="Qty">
                    <Input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} inputMode="decimal" />
                </Field>

                <Field label="Unit Price">
                    <Input value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} inputMode="decimal" />
                </Field>

                <Field label="Discount Amount">
                    <Input value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} inputMode="decimal" />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Reason (required)">
                        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why editing this line?" />
                    </Field>
                </div>

                {isPharmacy ? (
                    <div className="md:col-span-2">
                        <Field label="Meta JSON (optional)">
                            <Textarea
                                value={form.meta_json}
                                onChange={(e) => setForm({ ...form, meta_json: e.target.value })}
                                placeholder='{"batch_no":"AB1234","expiry_date":"2026-12-31","hsn_sac":"3004"}'
                            />
                        </Field>
                        <div className="mt-2 text-xs text-slate-500">
                            Pharmacy tip: store batch_no / expiry_date / HSN/SAC if available.
                        </div>
                    </div>
                ) : null}
            </div>
        </Modal>
    )
}

/* ---------------------------------
   Manual line (DOC enhanced)
---------------------------------- */

function ManualLineDialog({ invoice, moduleCode, onClose, onDone }) {
    const [saving, setSaving] = useState(false)
    const lockedGroup = MODULE_TO_GROUP[moduleCode] || "MISC"
    const pharmacy = isPharmacyModule(moduleCode)
    const docMode = isDocModule(moduleCode)

    const [form, setForm] = useState({
        description: "",
        qty: 1,
        unit_price: 0,
        gst_rate: 0,
        discount_amount: 0,
        service_date: "",

        doctor_name: "",
        department_name: "",

        meta_json: pharmacy ? { batch_no: "", expiry_date: "", hsn_sac: "" } : null,

        manual_reason: "Manual entry",
    })

    async function submit() {
        if (!invoice?.id) return toast.error("Invoice not loaded")
        const statusUpper = String(invoice?.status || "").toUpperCase()
        if (statusUpper !== "DRAFT") return toast.error("Invoice locked. Reopen to edit.")

        if (!String(form.description || "").trim()) return toast.error("Enter item name/description")
        if (String(form.manual_reason || "").trim().length < 3) return toast.error("Manual reason is mandatory")

        if (docMode) {
            if (!String(form.department_name || "").trim()) return toast.error("Department is required for DOC lines")
            if (!String(form.doctor_name || "").trim()) return toast.error("Doctor is required for DOC lines")
        }

        setSaving(true)
        try {
            const payload = {
                service_group: lockedGroup,
                description: String(form.description || "").trim(),
                qty: Number(form.qty || 1),
                unit_price: Number(form.unit_price || 0),
                gst_rate: Number(form.gst_rate || 0),
                discount_amount: Number(form.discount_amount || 0),
                manual_reason: String(form.manual_reason || "Manual entry"),
                service_date: form.service_date ? new Date(form.service_date).toISOString() : undefined,
                doctor_name: docMode ? String(form.doctor_name || "").trim() : undefined,
                department_name: docMode ? String(form.department_name || "").trim() : undefined,
                meta_json: pharmacy ? cleanMeta(form.meta_json) : undefined,
            }

            // ✅ Use V2 JSON body (supports meta_json / doc fields). Fallback to legacy if needed.
            try {
                await billingAddManualLineV2(invoice.id, payload)
            } catch (e) {
                // legacy fallback (may not support meta_json well)
                await billingAddManualLine(invoice.id, payload)
            }

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
            title={`Add Line · ${invoice?.module_label || prettyModuleLabel(moduleCode, moduleCode)}`}
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
                <Field label="Service Date (optional)">
                    <Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
                </Field>

                <Field label="GST %">
                    <Input value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} inputMode="decimal" />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Description">
                        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </Field>
                </div>

                {docMode ? (
                    <>
                        <Field label="Department">
                            <Input value={form.department_name} onChange={(e) => setForm({ ...form, department_name: e.target.value })} placeholder="Ex: Cardiology" />
                        </Field>
                        <Field label="Doctor">
                            <Input value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} placeholder="Ex: Dr. Kumar" />
                        </Field>
                    </>
                ) : null}

                <Field label="Qty">
                    <Input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} inputMode="decimal" />
                </Field>

                <Field label="Unit Price">
                    <Input value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} inputMode="decimal" />
                </Field>

                <Field label="Discount Amount">
                    <Input value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} inputMode="decimal" />
                </Field>

                <div className="md:col-span-2">
                    <Field label="Manual Reason (required)">
                        <Textarea value={form.manual_reason} onChange={(e) => setForm({ ...form, manual_reason: e.target.value })} placeholder="Why manual entry?" />
                    </Field>
                </div>

                {pharmacy ? (
                    <div className="md:col-span-2">
                        <Field label="Meta (optional)">
                            <Textarea
                                value={JSON.stringify(form.meta_json || {}, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const obj = e.target.value?.trim() ? JSON.parse(e.target.value) : {}
                                        setForm({ ...form, meta_json: obj })
                                    } catch {
                                        // ignore parse errors live
                                    }
                                }}
                                placeholder='{"batch_id":"123","expiry_date":"2026-12-31","hsn_sac":"3004"}'
                            />
                        </Field>
                    </div>
                ) : null}
            </div>
        </Modal>
    )
}
