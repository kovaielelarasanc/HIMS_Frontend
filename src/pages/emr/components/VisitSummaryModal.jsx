// pages/emr/components/visitSummaryModal.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

import { emrGetVisitSummary, emrDownloadVisitSummaryPdf } from "@/api/emr"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { X, Download, Search, FileText, ClipboardCopy, CalendarDays, Stethoscope, Building2, UserRound } from "lucide-react"

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

function fmtDateTime(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function SectionCard({ title, value }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border bg-white p-4"
        >
            <div className="text-[11px] font-black tracking-widest text-slate-500 uppercase">
                {title}
            </div>
            <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {value}
            </div>
        </motion.div>
    )
}

export default function VisitSummaryModal({ open, onOpenChange, visitId }) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState(null)
    const [q, setQ] = useState("")

    const meta = data?.meta
    const patient = data?.patient
    const vitals = data?.vitals
    const orders = data?.orders
    const rx = data?.rx
    const followups = data?.followups || []
    const sections = data?.sections || []

    const filteredSections = useMemo(() => {
        const term = (q || "").trim().toLowerCase()
        if (!term) return sections
        return sections.filter((s) =>
            (s.title || "").toLowerCase().includes(term) ||
            (s.value || "").toLowerCase().includes(term)
        )
    }, [sections, q])

    useEffect(() => {
        if (!open || !visitId) return
        setLoading(true)
        setData(null)
        setQ("")
            ; (async () => {
                try {
                    const res = await emrGetVisitSummary(visitId)
                    setData(res.data)
                } catch (e) {
                    toast.error(e?.response?.data?.detail || "Failed to load visit summary")
                } finally {
                    setLoading(false)
                }
            })()
    }, [open, visitId])

    async function downloadPdf() {
        try {
            const res = await emrDownloadVisitSummaryPdf(visitId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `OPD_Visit_${visitId}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "PDF download failed")
        }
    }

    async function copySummary() {
        try {
            const txt = [
                `Patient: ${patient?.name || ""} (${patient?.uhid || ""})`,
                `Visit: ${meta?.episode_id || ""} • ${fmtDateTime(meta?.visit_at)}`,
                `Department: ${meta?.department_name || ""}`,
                `Doctor: ${meta?.doctor_name || ""}`,
                "",
                ...filteredSections.map((s) => `${s.title}\n${s.value}\n`),
            ].join("\n")
            await navigator.clipboard.writeText(txt)
            toast.success("Summary copied")
        } catch {
            toast.error("Copy failed")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-none w-[100vw] h-[100dvh] p-0 gap-0">
                {/* Sticky Header */}
                <DialogHeader className="border-b bg-white px-4 md:px-6 py-4 sticky top-0 z-20">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                            <DialogTitle className="text-lg md:text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                OPD Visit Summary (View)
                            </DialogTitle>

                            <div className="mt-2 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                <span className="inline-flex items-center gap-1">
                                    <UserRound className="h-4 w-4" />
                                    <span className="font-semibold">{patient?.name || "—"}</span>
                                    <Badge variant="secondary" className="ml-1">UHID</Badge>
                                    <span className="font-semibold">{patient?.uhid || "—"}</span>
                                </span>

                                <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="h-4 w-4" />
                                    <span className="font-semibold">{fmtDateTime(meta?.visit_at)}</span>
                                </span>

                                <span className="inline-flex items-center gap-1">
                                    <Building2 className="h-4 w-4" />
                                    <span className="font-semibold">{meta?.department_name || "—"}</span>
                                </span>

                                <span className="inline-flex items-center gap-1">
                                    <Stethoscope className="h-4 w-4" />
                                    <span className="font-semibold">{meta?.doctor_name || "—"}</span>
                                </span>

                                {!!meta?.episode_id && (
                                    <Badge className="font-bold">{meta.episode_id}</Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={copySummary} disabled={loading || !data}>
                                <ClipboardCopy className="h-4 w-4 mr-2" />
                                Copy
                            </Button>

                            <Button onClick={downloadPdf} disabled={!visitId}>
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

                {/* Body */}
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
                                    Unable to load summary.
                                </div>
                            )}

                            {!loading && data && (
                                <div className="space-y-4">
                                    <Tabs defaultValue="summary">
                                        <TabsList>
                                            <TabsTrigger value="summary">Summary</TabsTrigger>
                                            {/* <TabsTrigger value="rx">Prescription</TabsTrigger>
                                            <TabsTrigger value="orders">Orders</TabsTrigger> */}
                                            <TabsTrigger value="followups">Follow-up</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="summary" className="mt-4 space-y-4">
                                            <div className="rounded-2xl border bg-white p-4">
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="text-sm font-black text-slate-900">
                                                        Clinical Notes
                                                    </div>
                                                    <div className="w-full md:w-[420px]">
                                                        <div className="relative">
                                                            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                            <Input
                                                                value={q}
                                                                onChange={(e) => setQ(e.target.value)}
                                                                placeholder="Search in notes (diagnosis, complaint, advice...)"
                                                                className="pl-9"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <Separator className="my-3" />

                                                {/* Vitals quick strip */}
                                                {vitals && (
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <Badge variant="secondary">HT {vitals.height_cm ?? "—"} cm</Badge>
                                                        <Badge variant="secondary">WT {vitals.weight_kg ?? "—"} kg</Badge>
                                                        <Badge variant="secondary">BP {(vitals.bp_systolic ?? "—")}/{(vitals.bp_diastolic ?? "—")}</Badge>
                                                        <Badge variant="secondary">Pulse {vitals.pulse ?? "—"}</Badge>
                                                        <Badge variant="secondary">RR {vitals.rr ?? "—"}</Badge>
                                                        <Badge variant="secondary">Temp {vitals.temp_c ?? "—"}</Badge>
                                                        <Badge variant="secondary">SpO2 {vitals.spo2 ?? "—"}</Badge>
                                                    </div>
                                                )}
                                            </div>

                                            {filteredSections.length === 0 ? (
                                                <div className="rounded-2xl border bg-white p-6 text-slate-600">
                                                    No clinical notes recorded for this visit.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <AnimatePresence>
                                                        {filteredSections.map((s) => (
                                                            <SectionCard key={s.key} title={s.title} value={s.value} />
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="rx" className="mt-4 space-y-3">
                                            <div className="rounded-2xl border bg-white p-4">
                                                <div className="text-sm font-black text-slate-900">Prescription</div>
                                                <Separator className="my-3" />

                                                {(!rx?.items || rx.items.length === 0) ? (
                                                    <div className="text-sm text-slate-600">No medicines.</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {rx.items.map((it, idx) => (
                                                            <div key={idx} className="rounded-xl border p-3 bg-white">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="font-black text-slate-900">{it.drug_name || "—"}</div>
                                                                        <div className="text-xs text-slate-600 mt-1">
                                                                            {[
                                                                                it.strength,
                                                                                it.route,
                                                                                it.timing,
                                                                                it.frequency ? `Freq: ${it.frequency}` : null,
                                                                                it.duration_days ? `Days: ${it.duration_days}` : null,
                                                                                it.quantity ? `Qty: ${it.quantity}` : null,
                                                                            ].filter(Boolean).join(" • ")}
                                                                        </div>
                                                                    </div>
                                                                    <Badge variant="secondary" className="shrink-0">
                                                                        ₹{Number(it.unit_price || 0).toFixed(2)}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {!!rx?.notes && (
                                                    <div className="mt-3 rounded-xl border p-3 bg-slate-50">
                                                        <div className="text-xs font-black text-slate-700">Notes</div>
                                                        <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{rx.notes}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="orders" className="mt-4 space-y-3">
                                            <div className="rounded-2xl border bg-white p-4">
                                                <div className="text-sm font-black text-slate-900">Orders</div>
                                                <Separator className="my-3" />

                                                <div className="space-y-3">
                                                    <div>
                                                        <div className="text-xs font-black text-slate-600 uppercase tracking-widest">Lab</div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {(orders?.lab || []).length === 0 ? (
                                                                <span className="text-sm text-slate-600">No lab tests.</span>
                                                            ) : (
                                                                orders.lab.map((t, i) => <Badge key={i} variant="secondary">{t}</Badge>)
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="text-xs font-black text-slate-600 uppercase tracking-widest">Radiology</div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {(orders?.radiology || []).length === 0 ? (
                                                                <span className="text-sm text-slate-600">No scans.</span>
                                                            ) : (
                                                                orders.radiology.map((t, i) => <Badge key={i} variant="secondary">{t}</Badge>)
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="followups" className="mt-4 space-y-3">
                                            <div className="rounded-2xl border bg-white p-4">
                                                <div className="text-sm font-black text-slate-900">Follow-up</div>
                                                <Separator className="my-3" />

                                                {followups.length === 0 ? (
                                                    <div className="text-sm text-slate-600">No follow-ups.</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {followups.map((fu) => (
                                                            <div key={fu.id} className="rounded-xl border p-3 bg-white">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm font-black text-slate-900">
                                                                            Due: {fu.due_date || "—"}
                                                                        </div>
                                                                        <div className="text-xs text-slate-600 mt-1">
                                                                            Status: <span className="font-semibold">{fu.status || "—"}</span>
                                                                            {fu.note ? ` • ${fu.note}` : ""}
                                                                        </div>
                                                                    </div>
                                                                    <Badge variant="secondary" className="shrink-0">#{fu.id}</Badge>
                                                                </div>
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
