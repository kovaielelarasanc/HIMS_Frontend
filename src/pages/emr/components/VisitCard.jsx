
// pages/emr/components/VisitCard.jsx
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, CalendarDays, Stethoscope, Building2, Eye } from "lucide-react"

import { getVisitId, getEpisodeId, getVisitAt, fmtDateTime } from "./visitFormat"

export default function VisitCard({ visit, onDownloadPdf, onView }) {
    const visitId = getVisitId(visit)
    const episodeId = getEpisodeId(visit) || (visitId ? `VISIT-${visitId}` : "VISIT")
    const visitAt = fmtDateTime(getVisitAt(visit))

    const departmentName = visit?.department_name || "—"
    const doctorName = visit?.doctor_name || "—"

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => visitId && onView?.(visitId)}
            className="rounded-2xl border bg-white p-4 cursor-pointer hover:bg-slate-50 transition"
            role="button"
            tabIndex={0}
        >
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="font-bold">{episodeId}</Badge>

                        <span className="text-sm text-slate-700 inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" />
                            <span className="font-semibold">{visitAt}</span>
                        </span>
                    </div>

                    <div className="mt-2 text-sm text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            <span className="font-semibold">{departmentName}</span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                            <Stethoscope className="h-4 w-4" />
                            <span className="font-semibold">{doctorName}</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation()
                            visitId && onView?.(visitId)
                        }}
                        disabled={!visitId}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                    </Button>

                    <Button
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation()
                            visitId && onDownloadPdf?.(visitId)
                        }}
                        disabled={!visitId}
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}
