// FILE: pages/emr/components/LabOrderCard.jsx
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, FileText, AlertTriangle, CalendarDays } from "lucide-react"

function fmt(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

export default function LabOrderCard({ order, onDownloadPdf, onView }) {
    const id = order?.order_id
    const labNo = order?.lab_no || (id ? `LAB-${String(id).padStart(6, "0")}` : "LAB")
    const created = fmt(order?.created_at)
    const status = (order?.status || "—").toUpperCase()
    const critical = Number(order?.critical_count || 0)

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => id && onView?.(id)}
            className="rounded-2xl border bg-white p-4 cursor-pointer hover:bg-slate-50 transition"
            role="button"
            tabIndex={0}
        >
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="font-bold">{labNo}</Badge>
                        <Badge variant="secondary">{status}</Badge>

                        {critical > 0 && (
                            <Badge className="bg-rose-600 text-white">
                                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                Critical: {critical}
                            </Badge>
                        )}

                        <span className="text-sm text-slate-700 inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" />
                            <span className="font-semibold">{created}</span>
                        </span>
                    </div>

                    {!!order?.tests?.length && (
                        <div className="mt-2 text-xs text-slate-600">
                            {order.tests.join(" • ")}
                            {order.tests_count > order.tests.length ? ` • +${order.tests_count - order.tests.length} more` : ""}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation()
                            id && onView?.(id)
                        }}
                        disabled={!id}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                    </Button>

                    <Button
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation()
                            id && onDownloadPdf?.(id)
                        }}
                        disabled={!id}
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}
