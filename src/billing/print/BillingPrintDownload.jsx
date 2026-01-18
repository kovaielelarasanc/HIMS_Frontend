// FILE: src/billing/print/BillingPrintDownload.jsx
import { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import { ChevronDown, Download, FileJson, FileText, Printer, Copy } from "lucide-react"

import API from "@/api/client"
import { billingExportCasePdf } from "@/api/billings"

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
            <div className={cn("w-full rounded-2xl bg-white shadow-xl", wide ? "max-w-5xl" : "max-w-xl")}>
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
                <div className="max-h-[78vh] overflow-auto px-5 py-4">{children}</div>
            </div>
        </div>
    )
}

export default function BillingPrintDownload({ caseId, caseNumber, patientName, uhid }) {
    const TEMPLATES = useMemo(
        () => [
            {
                key: "OVERVIEW",
                label: "Overview (Module-wise)",
                desc: "Particulars grouped by module + totals + payment/advance history",
                path: "/billing/print/overview",
                dataPath: "/billing/print/overview/data",
                filename: () => `Billing-Overview-${caseNumber || `CASE-${caseId}`}.pdf`,
            },
            {
                key: "COMMON_HEADER",
                label: "Common Header (NUTRYAH)",
                desc: "Brand header + Patient + Encounter + Payer block",
                path: "/billing/print/common-header",
                dataPath: "/billing/print/common-header/data",
                filename: () => `Billing-Header-${caseNumber || `CASE-${caseId}`}.pdf`,
            },
            {
                key: "FULL_HISTORY",
                label: "Full Bill History (Overview + All Invoices)",
                desc: "Overview summary followed by each invoice (complete billing history)",
                path: "/billing/print/full-history",
                dataPath: "/billing/print/full-history/data",
                filename: () => `Billing-FullHistory-${caseNumber || `CASE-${caseId}`}.pdf`,
            },
        ],
        [caseId, caseNumber]
    )

    const [open, setOpen] = useState(false)
    const [tplKey, setTplKey] = useState("OVERVIEW")

    const [docNo, setDocNo] = useState("")
    const [docDate, setDocDate] = useState("") // YYYY-MM-DD
    const [loading, setLoading] = useState(false)

    const [dataOpen, setDataOpen] = useState(false)
    const [dataLoading, setDataLoading] = useState(false)
    const [dataJson, setDataJson] = useState(null)

    const tpl = useMemo(() => TEMPLATES.find((t) => t.key === tplKey), [TEMPLATES, tplKey])

    useEffect(() => {
        // reset preview when template changes
        setDataOpen(false)
        setDataJson(null)
    }, [tplKey])

    function buildParams() {
        const params = {}
        if (caseId) params.case_id = caseId
        if (docNo?.trim()) params.doc_no = docNo.trim()
        const d = toISODateParam(docDate)
        if (d) params.doc_date = d
        return params
    }

    async function fetchPdfBlob() {
        if (!tpl) throw new Error("Template not found")
        if (tpl.disabled) throw new Error("Template disabled")

        // If template uses new endpoint
        if (tpl.path) {
            const res = await API.get(tpl.path, {
                params: buildParams(),
                responseType: "blob",
            })
            return new Blob([res.data], { type: "application/pdf" })
        }

        // Else legacy export
        if (tpl.legacyKind) {
            const blob = await billingExportCasePdf(caseId, {
                kind: tpl.legacyKind,
                download: false,
                doc_no: docNo?.trim() || undefined,
                doc_date: toISODateParam(docDate),
            })
            return blob
        }

        throw new Error("No PDF source configured")
    }

    async function run(mode) {
        if (!caseId) return toast.error("Case id missing")
        if (!tpl) return toast.error("Template not selected")
        if (tpl.disabled) return toast.error("This template is not available yet")

        setLoading(true)
        try {
            const blob = await fetchPdfBlob()
            const filename = tpl.filename ? tpl.filename() : `Billing-${caseNumber || caseId}.pdf`

            if (mode === "preview") openPdfPreview(blob)
            if (mode === "print") printPdfBlob(blob)
            if (mode === "download") downloadPdfBlob(blob, filename)
        } catch (e) {
            toast.error(e?.message || "Failed to generate PDF")
        } finally {
            setLoading(false)
        }
    }

    async function loadDataPreview() {
        if (!tpl?.dataPath) return toast.error("Preview not available for this template")
        setDataLoading(true)
        try {
            const res = await API.get(tpl.dataPath, { params: buildParams() })
            setDataJson(res.data)
            setDataOpen(true)
        } catch (e) {
            toast.error(e?.message || "Failed to load preview data")
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
                    right={<Badge tone="slate">{caseNumber ? `Case: ${caseNumber}` : `Case ID: ${caseId}`}</Badge>}
                >
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Left */}
                        <Card className="border border-slate-100 lg:col-span-1">
                            <CardHeader title="Documents" subtitle="Choose a format to export" />
                            <CardBody className="space-y-3">
                                <Field label="Template">
                                    <Select value={tplKey} onChange={(e) => setTplKey(e.target.value)}>
                                        {TEMPLATES.map((t) => (
                                            <option key={t.key} value={t.key} disabled={!!t.disabled}>
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
                                subtitle="Override bill number/date only if required"
                                right={
                                    tpl?.dataPath ? (
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
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <Field label="Bill Number override (optional)">
                                        <Input
                                            placeholder="Auto (case/invoice series)"
                                            value={docNo}
                                            onChange={(e) => setDocNo(e.target.value)}
                                        />
                                    </Field>

                                    <Field label="Bill Date override (optional)">
                                        <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
                                    </Field>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button onClick={() => run("preview")} disabled={loading || tpl?.disabled} className="gap-2">
                                        <FileText className="h-4 w-4" />
                                        {loading ? "Generating..." : "Preview"}
                                    </Button>

                                    <Button variant="outline" onClick={() => run("print")} disabled={loading || tpl?.disabled} className="gap-2">
                                        <Printer className="h-4 w-4" />
                                        Print
                                    </Button>

                                    <Button variant="outline" onClick={() => run("download")} disabled={loading || tpl?.disabled} className="gap-2">
                                        <Download className="h-4 w-4" />
                                        Download PDF
                                    </Button>
                                </div>

                                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                                    <div className="font-extrabold text-slate-900">No raw IDs rule ✅</div>
                                    PDF must show Case No / Invoice No / Receipt No (never internal row IDs).
                                </div>
                            </CardBody>
                        </Card>
                    </div>

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
                            {/* Pretty preview for OVERVIEW */}
                            {tplKey === "OVERVIEW" && dataJson?.totals ? (
                                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-xs font-bold text-slate-500">Total Bill</div>
                                        <div className="mt-1 text-lg font-extrabold text-slate-900">₹ {money(dataJson.totals.total_bill)}</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-xs font-bold text-slate-500">Payment Received</div>
                                        <div className="mt-1 text-lg font-extrabold text-slate-900">₹ {money(dataJson.totals.payments_received)}</div>
                                        {Number(dataJson.totals.advance_applied || 0) > 0 ? (
                                            <div className="mt-1 text-xs font-bold text-slate-500">
                                                Advance Applied: ₹ {money(dataJson.totals.advance_applied)}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                        <div className="text-xs font-bold text-slate-500">Balance</div>
                                        <div className="mt-1 text-lg font-extrabold text-slate-900">₹ {money(dataJson.totals.balance)}</div>
                                    </div>

                                    <div className="md:col-span-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                        <div className="text-sm font-extrabold text-slate-900">Module Totals</div>
                                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                            {(dataJson.modules || []).map((m) => (
                                                <div key={m.module} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3">
                                                    <div>
                                                        <div className="text-sm font-extrabold text-slate-900">{m.label || m.module}</div>
                                                        <div className="text-xs font-bold text-slate-500">{(m.invoices || []).length} invoices</div>
                                                    </div>
                                                    <div className="text-sm font-extrabold text-slate-900">₹ {money(m.total)}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-3 text-xs font-bold text-slate-500">
                                            Payments: {(dataJson.payment_history || []).length} • Advances: {(dataJson.advance_history || []).length}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <pre className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                                {dataJson ? JSON.stringify(dataJson, null, 2) : "—"}
                            </pre>
                        </Modal>
                    )}
                </Modal>
            )}
        </>
    )
}
