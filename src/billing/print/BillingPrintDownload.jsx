// FILE: src/billing/print/BillingPrintDownload.jsx
import { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import {
    ChevronDown,
    Download,
    FileJson,
    FileText,
    Printer,
    Copy,
    Receipt,
    LayoutGrid,
    Search,
} from "lucide-react"

import API from "@/api/client"
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, cn } from "@/billing/_ui"

function toISODateParam(v) {
    if (!v) return undefined
    if (typeof v === "string") return v
    try {
        const d = new Date(v)
        const yyyy = String(d.getFullYear())
        const mm = String(d.getMonth() + 1).padStart(2, "0")
        const dd = String(d.getDate()).padStart(2, "0")
        return `${yyyy}-${mm}-${dd}`
    } catch {
        return undefined
    }
}

function apiErrorMessage(e, fallback = "Request failed") {
    const d = e?.response?.data
    const detail = d?.detail
    if (typeof detail === "string" && detail.trim()) return detail
    if (Array.isArray(detail) && detail.length) {
        return detail
            .map((x) => (typeof x?.msg === "string" ? x.msg : typeof x === "string" ? x : ""))
            .filter(Boolean)
            .join(", ") || fallback
    }
    if (typeof d?.message === "string" && d.message.trim()) return d.message
    if (typeof e?.message === "string" && e.message.trim()) return e.message
    return fallback
}

function openPdfPreview(blob) {
    const url = URL.createObjectURL(blob)
    const win = window.open(url, "_blank", "noopener,noreferrer")
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    if (!win) window.location.href = url
}

function printPdfBlob(blob) {
    const url = URL.createObjectURL(blob)
    const w = window.open("", "_blank", "noopener,noreferrer")
    if (!w) {
        openPdfPreview(blob)
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
    }

    w.document.open()
    w.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print</title>
  <style>
    html, body { margin:0; padding:0; height:100%; }
    iframe { border:0; width:100%; height:100%; }
  </style>
</head>
<body>
  <iframe id="pdfFrame" src="${url}"></iframe>
  <script>
    const f = document.getElementById('pdfFrame');
    f.onload = () => { setTimeout(() => { window.focus(); window.print(); }, 250); };
  </script>
</body>
</html>
  `)
    w.document.close()

    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function downloadPdfBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename || "document.pdf"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function money(v) {
    const n = Number(v || 0)
    try {
        return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
    } catch {
        return String(n.toFixed?.(2) ?? n)
    }
}

function Modal({ title, children, onClose, right, wide = false }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
            <div className={cn("w-full rounded-2xl bg-white shadow-xl", wide ? "max-w-6xl" : "max-w-xl")}>
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
                <div className="max-h-[82vh] overflow-auto px-5 py-4">{children}</div>
            </div>
        </div>
    )
}

export default function BillingPrintDownload({ caseId, caseNumber, patientName, uhid }) {
    const [open, setOpen] = useState(false)

    // ✅ Mode tabs
    const [mode, setMode] = useState("DOCS") // DOCS | INVOICES

    // Shared print controls
    const [paper, setPaper] = useState("A4")
    const [orientation, setOrientation] = useState("portrait")
    const [includeDrafts, setIncludeDrafts] = useState(true)

    // DOCS
    const [tplKey, setTplKey] = useState("OVERVIEW")
    const [docNo, setDocNo] = useState("")
    const [docDate, setDocDate] = useState("") // YYYY-MM-DD
    const [loading, setLoading] = useState(false)

    // DOCS Data Preview
    const [dataOpen, setDataOpen] = useState(false)
    const [dataLoading, setDataLoading] = useState(false)
    const [dataJson, setDataJson] = useState(null)

    // INVOICES
    const [invLoading, setInvLoading] = useState(false)
    const [invRows, setInvRows] = useState([])
    const [invBusyId, setInvBusyId] = useState(null)

    const [invQuery, setInvQuery] = useState("")
    const [invModule, setInvModule] = useState("ALL")

    const supportsDocOverride = (key) => key === "OVERVIEW" || key === "COMMON_HEADER"

    const TEMPLATES = useMemo(() => {
        const cno = caseNumber || `CASE-${caseId}`

        return [
            {
                key: "OVERVIEW",
                label: "Overview (Module-wise)",
                desc: "Modules grouped + totals + payment/advance history",
                pdf: {
                    path: "/billing/print/overview",
                    params: () => ({
                        case_id: caseId,
                        doc_no: docNo?.trim() || undefined,
                        doc_date: toISODateParam(docDate),
                        include_draft_invoices: includeDrafts,
                        paper,
                        orientation,
                        disposition: "inline",
                    }),
                },
                data: {
                    path: "/billing/print/overview/data",
                    params: () => ({
                        case_id: caseId,
                        doc_no: docNo?.trim() || undefined,
                        doc_date: toISODateParam(docDate),
                        include_draft_invoices: includeDrafts,
                    }),
                },
                filename: () => `Billing-Overview-${cno}.pdf`,
            },

            {
                key: "COMMON_HEADER",
                label: "Common Header (NUTRYAH)",
                desc: "Brand header + Patient + Encounter + Payer block",
                pdf: {
                    path: "/billing/print/common-header",
                    params: () => ({
                        case_id: caseId,
                        doc_no: docNo?.trim() || undefined,
                        doc_date: toISODateParam(docDate),
                        paper,
                        orientation,
                        disposition: "inline",
                    }),
                },
                data: {
                    path: "/billing/print/common-header/data",
                    params: () => ({
                        case_id: caseId,
                        doc_no: docNo?.trim() || undefined,
                        doc_date: toISODateParam(docDate),
                    }),
                },
                filename: () => `Billing-Header-${cno}.pdf`,
            },

            {
                key: "FULL_HISTORY",
                label: "Full Bill History (Govt Form + Pharmacy Split-Up)",
                desc: "Summary + Detail Lines + Payments + Deposits + Insurance + Pharmacy Split-Up",
                pdf: {
                    path: caseId ? `/billing/print/cases/${caseId}/history/pdf` : "",
                    params: () => ({
                        include_draft_invoices: includeDrafts,
                        paper,
                        orientation,
                        disposition: "inline",
                    }),
                },
                data: null,
                filename: () => `Billing-FullHistory-${cno}.pdf`,
            },

            {
                key: "CASE_INVOICES",
                label: "All Invoices (Case PDF)",
                desc: "Print all invoices of this case in one PDF",
                pdf: {
                    path: caseId ? `/billing/print/cases/${caseId}/invoices/pdf` : "",
                    params: () => ({
                        include_draft_invoices: includeDrafts,
                        paper,
                        orientation,
                        disposition: "inline",
                    }),
                },
                data: null,
                filename: () => `Invoices-${cno}.pdf`,
            },

            {
                key: "PAYMENTS_LEDGER",
                label: "Payments Ledger (PDF)",
                desc: "All receipts/payments ledger for the case",
                pdf: {
                    path: caseId ? `/billing/print/cases/${caseId}/payments-ledger/pdf` : "",
                    params: () => ({ paper, orientation, disposition: "inline" }),
                },
                data: null,
                filename: () => `Payments-Ledger-${cno}.pdf`,
            },

            {
                key: "ADVANCE_LEDGER",
                label: "Advance Ledger (PDF)",
                desc: "All deposits/advances ledger for the case",
                pdf: {
                    path: caseId ? `/billing/print/cases/${caseId}/advance-ledger/pdf` : "",
                    params: () => ({ paper, orientation, disposition: "inline" }),
                },
                data: null,
                filename: () => `Advance-Ledger-${cno}.pdf`,
            },

            {
                key: "INSURANCE",
                label: "Insurance (PDF)",
                desc: "Insurance details for this case (if available)",
                pdf: {
                    path: caseId ? `/billing/print/cases/${caseId}/insurance/pdf` : "",
                    params: () => ({ paper, orientation, disposition: "inline" }),
                },
                data: null,
                filename: () => `Insurance-${cno}.pdf`,
            },
        ]
    }, [caseId, caseNumber, docNo, docDate, includeDrafts, paper, orientation])

    const tpl = useMemo(() => TEMPLATES.find((t) => t.key === tplKey), [TEMPLATES, tplKey])

    useEffect(() => {
        // reset preview when template changes
        setDataOpen(false)
        setDataJson(null)
    }, [tplKey])

    useEffect(() => {
        // fetch invoices when opening invoice mode
        if (!open) return
        if (mode !== "INVOICES") return
        fetchInvoices()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode])

    async function fetchPdfBlob({ disposition = "inline" } = {}) {
        if (!tpl?.pdf?.path) throw new Error("Template PDF path not configured")

        const params = typeof tpl?.pdf?.params === "function" ? tpl.pdf.params() : {}
        const res = await API.get(tpl.pdf.path, {
            params: { ...(params || {}), disposition },
            responseType: "blob",
        })
        return new Blob([res.data], { type: "application/pdf" })
    }

    async function runDoc(action) {
        if (!caseId) return toast.error("Case id missing")
        if (!tpl) return toast.error("Template not selected")

        setLoading(true)
        try {
            const blob = await fetchPdfBlob({ disposition: action === "download" ? "attachment" : "inline" })
            const filename = tpl.filename ? tpl.filename() : `Billing-${caseNumber || caseId}.pdf`

            if (action === "preview") openPdfPreview(blob)
            if (action === "print") printPdfBlob(blob)
            if (action === "download") downloadPdfBlob(blob, filename)
        } catch (e) {
            toast.error(apiErrorMessage(e, "Failed to generate PDF"))
        } finally {
            setLoading(false)
        }
    }

    async function loadDataPreview() {
        if (!tpl?.data?.path) return toast.error("Preview not available for this template")
        setDataLoading(true)
        try {
            const params = typeof tpl?.data?.params === "function" ? tpl.data.params() : {}
            const res = await API.get(tpl.data.path, { params })
            setDataJson(res.data)
            setDataOpen(true)
        } catch (e) {
            toast.error(apiErrorMessage(e, "Failed to load preview data"))
        } finally {
            setDataLoading(false)
        }
    }

    async function copyData() {
        try {
            await navigator.clipboard.writeText(JSON.stringify(dataJson, null, 2))
            toast.success("Copied JSON")
        } catch {
            toast.error("Copy failed")
        }
    }

    function normalizeInvoiceRow(x) {
        const id = x?.id ?? x?.invoice_id ?? x?.invoiceId ?? null
        return {
            id: id ? Number(id) : null,
            bill_no: x?.bill_no ?? x?.billNo ?? x?.invoice_number ?? x?.invoiceNumber ?? x?.doc_no ?? x?.docNo ?? "",
            invoice_number: x?.invoice_number ?? x?.invoiceNumber ?? "",
            module: x?.module ?? x?.service_group ?? x?.serviceGroup ?? "",
            status: x?.status ?? "",
            created_at: x?.created_at ?? x?.createdAt ?? x?.date ?? "",
            grand_total: x?.grand_total ?? x?.grandTotal ?? x?.total ?? x?.net_total ?? x?.netTotal ?? 0,
        }
    }

    async function fetchInvoices() {
        if (!caseId) return
        setInvLoading(true)
        try {
            // ✅ Use your existing endpoint: /billing/print/overview/data (GET)
            // It usually contains invoices; we map safely.
            const res = await API.get("/billing/print/overview/data", {
                params: {
                    case_id: caseId,
                    include_draft_invoices: includeDrafts,
                },
            })

            const payload = res?.data || {}
            const raw =
                (Array.isArray(payload?.invoices) && payload.invoices) ||
                (Array.isArray(payload?.invoice_list) && payload.invoice_list) ||
                (Array.isArray(payload?.invoice_rows) && payload.invoice_rows) ||
                (Array.isArray(payload?.data?.invoices) && payload.data.invoices) ||
                []

            const rows = (raw || []).map(normalizeInvoiceRow)
            setInvRows(rows)
        } catch (e) {
            toast.error(apiErrorMessage(e, "Failed to load invoices"))
            setInvRows([])
        } finally {
            setInvLoading(false)
        }
    }

    async function fetchInvoicePdfBlob(invoiceId, { disposition = "inline" } = {}) {
        const res = await API.get(`/billing/print/invoices/${invoiceId}/pdf`, {
            params: { paper, orientation, disposition },
            responseType: "blob",
        })
        return new Blob([res.data], { type: "application/pdf" })
    }

    async function runInvoice(action, inv) {
        const invoiceId = inv?.id
        if (!invoiceId) return toast.error("Invoice id missing in list (use 'All Invoices (Case PDF)')")
        setInvBusyId(invoiceId)
        try {
            const blob = await fetchInvoicePdfBlob(invoiceId, { disposition: action === "download" ? "attachment" : "inline" })
            const docNo = inv?.bill_no || inv?.invoice_number || `INV-${invoiceId}`
            const filename = `Invoice-${docNo}.pdf`

            if (action === "preview") openPdfPreview(blob)
            if (action === "print") printPdfBlob(blob)
            if (action === "download") downloadPdfBlob(blob, filename)
        } catch (e) {
            toast.error(apiErrorMessage(e, "Failed to generate invoice PDF"))
        } finally {
            setInvBusyId(null)
        }
    }

    const filteredInvoices = useMemo(() => {
        const q = (invQuery || "").trim().toLowerCase()
        return (invRows || [])
            .filter((r) => {
                if (invModule !== "ALL" && String(r.module || "").toUpperCase() !== invModule) return false
                if (!q) return true
                const hay = [
                    r.bill_no,
                    r.invoice_number,
                    r.module,
                    r.status,
                    r.created_at,
                    String(r.grand_total ?? ""),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                return hay.includes(q)
            })
            .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    }, [invRows, invQuery, invModule])

    const modulesForFilter = useMemo(() => {
        const set = new Set((invRows || []).map((x) => String(x.module || "").toUpperCase()).filter(Boolean))
        return ["ALL", ...Array.from(set)]
    }, [invRows])

    const previewBtnLabel = tplKey === "OVERVIEW" ? "Preview Data" : "Header JSON"

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
                <FileText className="h-4 w-4" />
                Print / Download
                <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>

            {open && (
                <Modal
                    title="Billing Print / Download"
                    wide
                    onClose={() => setOpen(false)}
                    right={
                        <div className="flex items-center gap-2">
                            <Badge tone="slate">{caseNumber ? `Case: ${caseNumber}` : `Case ID: ${caseId}`}</Badge>
                        </div>
                    }
                >
                    {/* Mode Tabs */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setMode("DOCS")}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold",
                                mode === "DOCS"
                                    ? "border-slate-200 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                            )}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            Case Documents
                        </button>

                        {/* <button
                            onClick={() => setMode("INVOICES")}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold",
                                mode === "INVOICES"
                                    ? "border-slate-200 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                            )}
                        >
                            <Receipt className="h-4 w-4" />
                            Invoice Prints
                        </button> */}

                        <div className="ml-auto hidden md:block rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            Patient: <span className="font-extrabold text-slate-900">{patientName || "—"}</span> • UHID:{" "}
                            <span className="font-extrabold text-slate-900">{uhid || "—"}</span>
                        </div>
                    </div>

                    {/* DOCS MODE */}
                    {mode === "DOCS" ? (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            {/* Left */}
                            <Card className="border border-slate-100 lg:col-span-1">
                                <CardHeader title="Documents" subtitle="Choose a format to export" />
                                <CardBody className="space-y-3">
                                    <Field label="Template">
                                        <Select value={tplKey} onChange={(e) => setTplKey(e.target.value)}>
                                            {TEMPLATES.map((t) => (
                                                <option key={t.key} value={t.key}>
                                                    {t.label}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>

                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                                        <div className="font-extrabold text-slate-900">{tpl?.label || "—"}</div>
                                        <div className="mt-1 text-slate-600">{tpl?.desc || "—"}</div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-100 bg-white p-3 text-xs text-slate-600">
                                        <div className="font-extrabold text-slate-900">Preview Info</div>
                                        <div className="mt-1">
                                            Patient: <span className="font-bold text-slate-900">{patientName || "—"}</span>
                                        </div>
                                        <div>
                                            UHID: <span className="font-bold text-slate-900">{uhid || "—"}</span>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Right */}
                            <Card className="border border-slate-100 lg:col-span-2">
                                <CardHeader
                                    title="Options"
                                    subtitle="Paper + orientation + drafts. Bill no/date override only where supported."
                                    right={
                                        tpl?.data?.path ? (
                                            <Button
                                                variant="outline"
                                                onClick={loadDataPreview}
                                                disabled={dataLoading || loading}
                                                className="gap-2"
                                            >
                                                <FileJson className="h-4 w-4" />
                                                {dataLoading ? "Loading..." : previewBtnLabel}
                                            </Button>
                                        ) : null
                                    }
                                />
                                <CardBody>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <Field label="Paper">
                                            <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
                                                <option value="A3">A3</option>
                                                <option value="A4">A4</option>
                                                <option value="A5">A5</option>
                                            </Select>
                                        </Field>

                                        <Field label="Orientation">
                                            <Select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                                                <option value="portrait">Portrait</option>
                                                <option value="landscape">Landscape</option>
                                            </Select>
                                        </Field>

                                        <Field label="Include Draft Invoices">
                                            <Select value={includeDrafts ? "YES" : "NO"} onChange={(e) => setIncludeDrafts(e.target.value === "YES")}>
                                                <option value="YES">YES</option>
                                                <option value="NO">NO</option>
                                            </Select>
                                        </Field>
                                    </div>

                                    {supportsDocOverride(tplKey) ? (
                                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <Field label="Bill Number override (optional)">
                                                <Input
                                                    placeholder="Auto (series / display doc no)"
                                                    value={docNo}
                                                    onChange={(e) => setDocNo(e.target.value)}
                                                />
                                            </Field>

                                            <Field label="Bill Date override (optional)">
                                                <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
                                            </Field>
                                        </div>
                                    ) : (
                                        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                                            <div className="font-extrabold text-slate-900">Note</div>
                                            This document does not use Bill No/Date override.
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Button onClick={() => runDoc("preview")} disabled={loading} className="gap-2">
                                            <FileText className="h-4 w-4" />
                                            {loading ? "Generating..." : "Preview"}
                                        </Button>

                                        <Button variant="outline" onClick={() => runDoc("print")} disabled={loading} className="gap-2">
                                            <Printer className="h-4 w-4" />
                                            Print
                                        </Button>

                                        <Button variant="outline" onClick={() => runDoc("download")} disabled={loading} className="gap-2">
                                            <Download className="h-4 w-4" />
                                            Download PDF
                                        </Button>
                                    </div>

                                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                                        <div className="font-extrabold text-slate-900">No raw IDs rule ✅</div>
                                        PDF must show Case No / Bill No / Receipt No (never internal row IDs).
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Data Preview modal */}
                            {dataOpen && (
                                <Modal
                                    title={tplKey === "OVERVIEW" ? "Overview Preview" : "Header JSON"}
                                    wide
                                    onClose={() => setDataOpen(false)}
                                    right={
                                        <Button variant="outline" onClick={copyData} className="gap-2" disabled={!dataJson}>
                                            <Copy className="h-4 w-4" />
                                            Copy
                                        </Button>
                                    }
                                >
                                    <pre className="max-h-[72vh] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                                        {dataJson ? JSON.stringify(dataJson, null, 2) : "—"}
                                    </pre>
                                </Modal>
                            )}
                        </div>
                    ) : (
                        // INVOICE MODE
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <Card className="border border-slate-100 lg:col-span-1">
                                <CardHeader title="Invoice Print Settings" subtitle="Paper + orientation + filter" />
                                <CardBody className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3">
                                        <Field label="Paper">
                                            <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
                                                <option value="A3">A3</option>
                                                <option value="A4">A4</option>
                                                <option value="A5">A5</option>
                                            </Select>
                                        </Field>

                                        <Field label="Orientation">
                                            <Select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                                                <option value="portrait">Portrait</option>
                                                <option value="landscape">Landscape</option>
                                            </Select>
                                        </Field>

                                        <Field label="Include Draft Invoices">
                                            <Select value={includeDrafts ? "YES" : "NO"} onChange={(e) => setIncludeDrafts(e.target.value === "YES")}>
                                                <option value="YES">YES</option>
                                                <option value="NO">NO</option>
                                            </Select>
                                        </Field>

                                        <Field label="Module Filter">
                                            <Select value={invModule} onChange={(e) => setInvModule(e.target.value)}>
                                                {modulesForFilter.map((m) => (
                                                    <option key={m} value={m}>
                                                        {m}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>

                                        <Field label="Search">
                                            <div className="relative">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <Input
                                                    className="pl-9"
                                                    placeholder="Search bill no / module / status / amount..."
                                                    value={invQuery}
                                                    onChange={(e) => setInvQuery(e.target.value)}
                                                />
                                            </div>
                                        </Field>

                                        <Button variant="outline" onClick={fetchInvoices} disabled={invLoading} className="gap-2">
                                            <Receipt className="h-4 w-4" />
                                            {invLoading ? "Refreshing..." : "Refresh Invoices"}
                                        </Button>

                                        <Button
                                            onClick={() => {
                                                // Use "All Invoices (Case PDF)" template quickly
                                                setTplKey("CASE_INVOICES")
                                                setMode("DOCS")
                                            }}
                                            className="gap-2"
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                            Print ALL Invoices (Case PDF)
                                        </Button>
                                    </div>

                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                                        <div className="font-extrabold text-slate-900">Tip ✅</div>
                                        Use <span className="font-extrabold text-slate-900">A4 Portrait</span> for standard bills.
                                        Use <span className="font-extrabold text-slate-900">Landscape</span> for wide item tables.
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="border border-slate-100 lg:col-span-2">
                                <CardHeader
                                    title="Invoices"
                                    subtitle={invLoading ? "Loading invoice list..." : `${filteredInvoices.length} invoices`}
                                    right={<Badge tone="slate">{caseNumber ? `Case: ${caseNumber}` : `Case ID: ${caseId}`}</Badge>}
                                />
                                <CardBody>
                                    {invLoading ? (
                                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm font-bold text-slate-700">
                                            Loading invoices...
                                        </div>
                                    ) : filteredInvoices.length ? (
                                        <div className="space-y-3">
                                            {filteredInvoices.map((inv) => {
                                                const docNo = inv.bill_no || inv.invoice_number || "—"
                                                const busy = invBusyId === inv.id
                                                const canPrintSingle = !!inv.id
                                                return (
                                                    <div
                                                        key={String(inv.id || docNo) + String(inv.created_at || "")}
                                                        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                                                    >
                                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="text-sm font-extrabold text-slate-900">Bill No: {docNo}</div>
                                                                    {inv.module ? <Badge tone="slate">{String(inv.module).toUpperCase()}</Badge> : null}
                                                                    {inv.status ? <Badge tone="slate">{String(inv.status).toUpperCase()}</Badge> : null}
                                                                    {!canPrintSingle ? <Badge tone="slate">NO ID (use Case PDF)</Badge> : null}
                                                                </div>
                                                                <div className="mt-1 text-xs font-bold text-slate-500">{inv.created_at || "—"}</div>
                                                            </div>

                                                            <div className="flex flex-col items-end gap-2">
                                                                <div className="text-sm font-extrabold text-slate-900">₹ {money(inv.grand_total)}</div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <Button onClick={() => runInvoice("preview", inv)} disabled={busy || !canPrintSingle} className="gap-2">
                                                                        <FileText className="h-4 w-4" />
                                                                        {busy ? "..." : "Preview"}
                                                                    </Button>
                                                                    <Button variant="outline" onClick={() => runInvoice("print", inv)} disabled={busy || !canPrintSingle} className="gap-2">
                                                                        <Printer className="h-4 w-4" />
                                                                        Print
                                                                    </Button>
                                                                    <Button variant="outline" onClick={() => runInvoice("download", inv)} disabled={busy || !canPrintSingle} className="gap-2">
                                                                        <Download className="h-4 w-4" />
                                                                        PDF
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm font-bold text-slate-700">
                                            No invoices found.
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </div>
                    )}
                </Modal>
            )}
        </>
    )
}
