// FILE: src/pages/emr/components/PharmacyRxCard.jsx
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Eye, Pill } from "lucide-react"

function rxNoOf(rx) {
    return (
        rx?.rx_number ||
        rx?.prescription_number ||
        rx?.prescription_no ||
        rx?.prescriptionNumber ||
        (rx?.id ? `RX-${rx.id}` : "—")
    )
}

function fmtDateTime(v) {
    if (!v) return "—"
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}

function statusVariant(status) {
    const s = String(status || "").toUpperCase()
    if (s === "DISPENSED") return "default"
    if (s === "PARTIALLY_DISPENSED") return "secondary"
    if (s === "ISSUED") return "outline"
    if (s === "DRAFT") return "outline"
    if (s === "CANCELLED") return "destructive"
    return "secondary"
}

export default function PharmacyRxCard({ rx, onView, onDownloadPdf }) {
    const rxNo = rxNoOf(rx)
    const when = fmtDateTime(rx?.rx_datetime || rx?.created_at)
    const type = rx?.type || "—"
    const status = rx?.status || "—"
    const doctor = rx?.doctor_name || rx?.doctor?.full_name || "—"
    const items = rx?.item_count ?? rx?.lines_count ?? rx?.items_count

    return (
        <Card className="rounded-2xl border bg-white">
            <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-2 font-black text-slate-900">
                                <Pill className="h-4 w-4" />
                                <span className="truncate">{rxNo}</span>
                            </div>

                            <Badge variant="secondary">{String(type).toUpperCase()}</Badge>
                            <Badge variant={statusVariant(status)}>{String(status).toUpperCase()}</Badge>

                            {typeof items !== "undefined" && items !== null && (
                                <Badge variant="outline">{items} items</Badge>
                            )}
                        </div>

                        <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                                <span className="font-semibold text-slate-700">Date:</span> {when}
                            </span>
                            <span className="truncate">
                                <span className="font-semibold text-slate-700">Doctor:</span> {doctor}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" onClick={() => onView?.(rx?.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                        </Button>
                        <Button onClick={() => onDownloadPdf?.(rx?.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
