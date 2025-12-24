// FILE: pages/emr/components/LabReportModal.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { emrGetLabOrderReport, emrDownloadLabReportPdf } from "@/api/emr"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { X, Download, Search, FileText, ClipboardCopy, AlertTriangle } from "lucide-react"

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => window.URL.revokeObjectURL(url), 800)
}

function fmt(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function flagBadge(flag) {
    const f = String(flag || "").toUpperCase()
    if (!f) return <Badge variant="secondary">—</Badge>
    if (f === "H" || f === "HIGH") return <Badge className="bg-rose-600 text-white">HIGH</Badge>
    if (f === "L" || f === "LOW") return <Badge className="bg-amber-500 text-white">LOW</Badge>
    if (f === "N" || f === "NORMAL") return <Badge className="bg-emerald-600 text-white">NORMAL</Badge>
    return <Badge variant="secondary">{f}</Badge>
}

export default function LabReportModal({ open, onOpenChange, orderId }) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState(null)
    const [q, setQ] = useState("")

    const meta = data?.meta
    const patient = data?.patient
    const sections = data?.sections || []
    const attachments = data?.attachments || []

    const filteredSections = useMemo(() => {
        const term = (q || "").trim().toLowerCase()
        if (!term) return sections

        return sections
            .map((s) => {
                const rows = (s.rows || []).filter((r) => {
                    const hay = `${r.service_name || ""} ${r.result_value || ""} ${r.flag || ""} ${r.comments || ""} ${r.normal_range || ""}`.toLowerCase()
                    return hay.includes(term)
                })
                return { ...s, rows }
            })
            .filter((s) => (s.rows || []).length > 0)
    }, [sections, q])

    useEffect(() => {
        if (!open || !orderId) return
        setLoading(true)
        setData(null)
        setQ("")
            ; (async () => {
                try {
                    const res = await emrGetLabOrderReport(orderId)
                    setData(res.data)
                } catch (e) {
                    toast.error(e?.response?.data?.detail || "Failed to load lab report")
                } finally {
                    setLoading(false)
                }
            })()
    }, [open, orderId])

    async function downloadPdf() {
        if (!orderId) return
        try {
            const res = await emrDownloadLabReportPdf(orderId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `LAB_Report_${orderId}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "PDF download failed")
        }
    }

    async function copySummary() {
        try {
            const lines = []
            lines.push(`Patient: ${patient?.name || ""} (${patient?.uhid || ""})`)
            lines.push(`Lab No: ${meta?.lab_no || ""}`)
            lines.push(`Status: ${meta?.status || ""} • Created: ${fmt(meta?.created_at)}`)
            lines.push("")
            for (const s of filteredSections) {
                lines.push(`== ${s.title} ==`)
                for (const r of (s.rows || [])) {
                    lines.push(`${r.service_name} : ${r.result_value || "-"} ${r.unit || ""} [${r.flag || "-"}]`)
                }
                lines.push("")
            }
            await navigator.clipboard.writeText(lines.join("\n"))
            toast.success("Report copied")
        } catch {
            toast.error("Copy failed")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-none w-[100vw] h-[100dvh] p-0 gap-0">
                <DialogHeader className="border-b bg-white px-4 md:px-6 py-4 sticky top-0 z-20">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                            <DialogTitle className="text-lg md:text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Lab Report (View)
                            </DialogTitle>

                            <div className="mt-2 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                <span className="font-semibold">{patient?.name || "—"}</span>
                                <Badge variant="secondary">UHID</Badge>
                                <span className="font-semibold">{patient?.uhid || "—"}</span>

                                <Badge className="font-bold">{meta?.lab_no || "—"}</Badge>
                                <Badge variant="secondary">{String(meta?.status || "—").toUpperCase()}</Badge>

                                <span className="text-xs text-slate-500">
                                    Created: <span className="font-semibold text-slate-700">{fmt(meta?.created_at)}</span>
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={copySummary} disabled={loading || !data}>
                                <ClipboardCopy className="h-4 w-4 mr-2" />
                                Copy
                            </Button>

                            <Button onClick={downloadPdf} disabled={!orderId}>
                                <Download className="h-4 w-4 mr-2" />
                                PDF
                            </Button>

                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                <X className="h-4 w-4 mr-2" />
                                Close
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 bg-slate-50">
                    <ScrollArea className="h-full">
                        <div className="px-4 md:px-6 py-5">
                            {loading && (
                                <div className="space-y-3">
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            )}

                            {!loading && !data && (
                                <div className="rounded-2xl border bg-white p-6 text-slate-600">
                                    Unable to load report.
                                </div>
                            )}

                            {!loading && data && (
                                <div className="space-y-4">
                                    <Tabs defaultValue="report">
                                        <TabsList>
                                            <TabsTrigger value="report">Report</TabsTrigger>
                                            <TabsTrigger value="attachments">Attachments</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="report" className="mt-4 space-y-4">
                                            <div className="rounded-2xl border bg-white p-4">
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="text-sm font-black text-slate-900">
                                                        Results
                                                    </div>
                                                    <div className="w-full md:w-[420px]">
                                                        <div className="relative">
                                                            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                            <Input
                                                                value={q}
                                                                onChange={(e) => setQ(e.target.value)}
                                                                placeholder="Search test / result / flag / comments..."
                                                                className="pl-9"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <Separator className="my-3" />

                                                {filteredSections.length === 0 ? (
                                                    <div className="text-sm text-slate-600">No results found.</div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {filteredSections.map((sec) => (
                                                            <div key={sec.key} className="rounded-2xl border bg-white overflow-hidden">
                                                                <div className="px-4 py-3 bg-slate-50 border-b">
                                                                    <div className="font-black text-slate-900 text-sm">{sec.title}</div>
                                                                </div>

                                                                <div className="p-4">
                                                                    <div className="space-y-2">
                                                                        {(sec.rows || []).map((r, idx) => (
                                                                            <div key={idx} className="rounded-xl border p-3">
                                                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                                                    <div className="min-w-0">
                                                                                        <div className="font-black text-slate-900">
                                                                                            {r.service_name || "—"}
                                                                                        </div>
                                                                                        <div className="text-xs text-slate-600 mt-1 whitespace-pre-line">
                                                                                            Ref: {r.normal_range || "-"}
                                                                                        </div>
                                                                                        {!!r.comments && (
                                                                                            <div className="text-xs text-slate-600 mt-1">
                                                                                                Note: {r.comments}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-2">
                                                                                        {flagBadge(r.flag)}
                                                                                        <Badge variant="secondary" className="font-bold">
                                                                                            {r.result_value || "—"} {r.unit || ""}
                                                                                        </Badge>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="attachments" className="mt-4 space-y-3">
                                            <div className="rounded-2xl border bg-white p-4">
                                                <div className="text-sm font-black text-slate-900">Attachments</div>
                                                <Separator className="my-3" />

                                                {attachments.length === 0 ? (
                                                    <div className="text-sm text-slate-600">No attachments.</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {attachments.map((a) => (
                                                            <div key={a.id} className="rounded-xl border p-3">
                                                                <div className="text-sm font-bold text-slate-900">#{a.id}</div>
                                                                <div className="text-xs text-slate-600 mt-1">{a.note || "—"}</div>
                                                                <a
                                                                    href={a.file_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-sm text-blue-600 underline mt-2 inline-block"
                                                                >
                                                                    Open file
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}
