// FILE: src/pages/emr/components/PharmacyRxModal.jsx
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { emrGetPharmacyPrescription, emrDownloadPharmacyPrescriptionPdf } from "@/api/emr"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import { Download, Pill, UserRound, Stethoscope } from "lucide-react"

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

function rxNoOf(rx) {
    return rx?.rx_number || rx?.prescription_number || (rx?.id ? `RX-${rx.id}` : "—")
}

function fmtDateTime(v) {
    if (!v) return "—"
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}

export default function PharmacyRxModal({ open, onOpenChange, rxId }) {
    const [loading, setLoading] = useState(false)
    const [rx, setRx] = useState(null)

    useEffect(() => {
        if (!open || !rxId) return
        setLoading(true)
        setRx(null)
            ; (async () => {
                try {
                    const res = await emrGetPharmacyPrescription(rxId)
                    setRx(res?.data || null)
                } catch (e) {
                    toast.error(e?.response?.data?.detail || "Failed to load prescription")
                } finally {
                    setLoading(false)
                }
            })()
    }, [open, rxId])

    const header = useMemo(() => {
        const rxNo = rxNoOf(rx)
        const when = fmtDateTime(rx?.rx_datetime || rx?.created_at)
        const type = rx?.type || "—"
        const status = rx?.status || "—"
        const op = rx?.op_uid || "—"
        const ip = rx?.ip_uid || "—"
        return { rxNo, when, type, status, op, ip }
    }, [rx])

    async function downloadPdf() {
        if (!rxId) return
        try {
            const res = await emrDownloadPharmacyPrescriptionPdf(rxId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            const safe = String(header.rxNo).replaceAll("/", "-").replaceAll("\\", "-").replaceAll(" ", "_")
            downloadBlob(blob, `Prescription_${safe}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Prescription PDF download failed")
        }
    }

    const lines = rx?.lines || []
    const patient = rx?.patient || null
    const doctor = rx?.doctor || null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden">
                <DialogHeader className="p-4 md:p-5 border-b">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <DialogTitle className="flex items-center gap-2 text-slate-900">
                                <Pill className="h-5 w-5" />
                                Pharmacy Prescription
                            </DialogTitle>
                            <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                                <span className="font-semibold text-slate-800">{header.rxNo}</span>
                                <Badge variant="secondary">{String(header.type).toUpperCase()}</Badge>
                                <Badge variant="outline">{String(header.status).toUpperCase()}</Badge>
                                <span>• {header.when}</span>
                            </div>
                        </div>

                        <div className="shrink-0">
                            <Button onClick={downloadPdf}>
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-4 md:p-5 space-y-4">
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-64 w-full" />
                        </div>
                    ) : !rx ? (
                        <div className="rounded-xl border p-6 text-slate-600">No data</div>
                    ) : (
                        <>
                            {/* Patient + Doctor summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Card className="rounded-2xl p-4 border">
                                    <div className="flex items-center gap-2 font-black text-slate-900">
                                        <UserRound className="h-4 w-4" /> Patient
                                    </div>
                                    <div className="mt-2 text-sm text-slate-700 space-y-1">
                                        <div className="font-semibold text-slate-900">
                                            {patient?.full_name ||
                                                [patient?.prefix, patient?.first_name, patient?.last_name].filter(Boolean).join(" ") ||
                                                "—"}
                                        </div>
                                        <div className="text-xs text-slate-600">
                                            UHID: <span className="font-semibold text-slate-800">{patient?.uhid || "—"}</span>
                                            {"  "}• Phone: <span className="font-semibold text-slate-800">{patient?.phone || "—"}</span>
                                        </div>
                                        <div className="text-xs text-slate-600">
                                            DOB: <span className="font-semibold text-slate-800">{patient?.dob || "—"}</span>
                                            {"  "}• Gender: <span className="font-semibold text-slate-800">{patient?.gender || "—"}</span>
                                            {"  "}• Age: <span className="font-semibold text-slate-800">{patient?.age_display || "—"}</span>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="rounded-2xl p-4 border">
                                    <div className="flex items-center gap-2 font-black text-slate-900">
                                        <Stethoscope className="h-4 w-4" /> Doctor
                                    </div>
                                    <div className="mt-2 text-sm text-slate-700 space-y-1">
                                        <div className="font-semibold text-slate-900">
                                            {doctor?.full_name || "—"}
                                        </div>
                                        <div className="text-xs text-slate-600">
                                            Reg No: <span className="font-semibold text-slate-800">{doctor?.registration_no || "—"}</span>
                                        </div>
                                        <div className="text-xs text-slate-600">
                                            OP UID: <span className="font-semibold text-slate-800">{header.op}</span>
                                            {"  "}• IP UID: <span className="font-semibold text-slate-800">{header.ip}</span>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {rx?.notes ? (
                                <Card className="rounded-2xl p-4 border bg-slate-50">
                                    <div className="text-sm font-black text-slate-900">Notes</div>
                                    <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{rx.notes}</div>
                                </Card>
                            ) : null}

                            <Separator />

                            {/* Lines */}
                            <Card className="rounded-2xl border overflow-hidden">
                                <div className="px-4 py-3 border-b bg-slate-50">
                                    <div className="font-black text-slate-900">Medicines</div>
                                    <div className="text-xs text-slate-600">
                                        Requested / Dispensed / Remaining + Dosing info
                                    </div>
                                </div>

                                <div className="p-4 space-y-3">
                                    {lines.length === 0 ? (
                                        <div className="rounded-xl border p-4 text-slate-600">No medicines</div>
                                    ) : (
                                        lines.map((ln, idx) => (
                                            <div key={ln?.id || ln?.line_id || idx} className="rounded-2xl border p-4 bg-white">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-black text-slate-900 truncate">
                                                            {ln?.item_name || "—"}
                                                            {ln?.item_strength ? (
                                                                <span className="ml-2 text-xs font-semibold text-slate-600">
                                                                    ({ln.item_strength})
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                                                            {ln?.dose_text ? <span>Dose: <b className="text-slate-800">{ln.dose_text}</b></span> : null}
                                                            {ln?.frequency_code ? <span>Freq: <b className="text-slate-800">{ln.frequency_code}</b></span> : null}
                                                            {ln?.duration_days ? <span>Days: <b className="text-slate-800">{ln.duration_days}</b></span> : null}
                                                            {ln?.route ? <span>Route: <b className="text-slate-800">{ln.route}</b></span> : null}
                                                            {ln?.timing ? <span>Timing: <b className="text-slate-800">{ln.timing}</b></span> : null}
                                                        </div>

                                                        {ln?.instructions ? (
                                                            <div className="mt-2 text-sm text-slate-700">
                                                                <span className="text-xs font-bold text-slate-600">Instructions:</span>{" "}
                                                                {ln.instructions}
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="shrink-0 text-right">
                                                        <div className="text-xs text-slate-600">Qty</div>
                                                        <div className="mt-1 text-sm font-black text-slate-900">
                                                            {Number(ln?.requested_qty ?? 0)} / {Number(ln?.dispensed_qty ?? 0)} /{" "}
                                                            {Number(ln?.remaining_qty ?? Math.max(Number(ln?.requested_qty ?? 0) - Number(ln?.dispensed_qty ?? 0), 0))}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">Req / Disp / Rem</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
