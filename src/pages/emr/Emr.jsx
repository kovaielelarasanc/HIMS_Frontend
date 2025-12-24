// FILE: src/pages/EmrPage.jsx (or wherever you keep EMR page)
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import {
    emrSearchPatients,
    emrGetPatientOpdVisits,
    emrDownloadVisitSummaryPdf,
    emrDownloadPatientOpdHistoryPdf,
} from "@/api/emr"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { ArrowRight, UserRound, Download } from "lucide-react"

import PatientSearchPicker from "./components/PatientSearchPicker"
import PatientHeaderCard from "./components/PatientHeaderCard"
import HistoryList from "./components/HistoryList"
import VisitCard from "./components/VisitCard"
import VisitSummaryModal from "./components/VisitSummaryModal"

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

export default function EmrPage() {
    const [step, setStep] = useState("pick") // pick | history
    const [selected, setSelected] = useState(null)

    const [loadingVisits, setLoadingVisits] = useState(false)
    const [visits, setVisits] = useState([])

    // ✅ View Summary Modal state (MUST be inside component)
    const [openSummary, setOpenSummary] = useState(false)
    const [activeVisitId, setActiveVisitId] = useState(null)

    function openVisitSummary(visitId) {
        if (!visitId) return
        setActiveVisitId(visitId)
        setOpenSummary(true)
    }

    function closeVisitSummary(nextOpen) {
        setOpenSummary(nextOpen)
        if (!nextOpen) setActiveVisitId(null)
    }

    async function proceed() {
        if (!selected?.id) return
        setStep("history")
        setLoadingVisits(true)
        setVisits([])
        try {
            const res = await emrGetPatientOpdVisits(selected.id, { limit: 100 })
            setVisits(Array.isArray(res?.data) ? res.data : [])
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to load OPD history")
        } finally {
            setLoadingVisits(false)
        }
    }

    async function downloadVisitPdf(visitId) {
        if (!visitId) return
        try {
            const res = await emrDownloadVisitSummaryPdf(visitId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `OPD_Visit_${visitId}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "PDF download failed")
        }
    }

    async function downloadAllOpdPdf() {
        if (!selected?.id) return
        try {
            const res = await emrDownloadPatientOpdHistoryPdf(selected.id, { limit: 200 })
            const blob = new Blob([res.data], { type: "application/pdf" })
            const uhid = selected?.uhid || `PAT-${selected.id}`
            downloadBlob(blob, `EMR_OPD_HISTORY_${uhid}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "History PDF download failed")
        }
    }

    function onBack() {
        setStep("pick")
        setVisits([])
        setLoadingVisits(false)
        setOpenSummary(false)
        setActiveVisitId(null)
    }

    return (
        <>
            <div className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
                            EMR
                        </h1>
                        <p className="text-sm text-slate-600">
                            Select Patient → Proceed → View OPD History (Summary + PDFs)
                        </p>
                    </div>

                    {step === "history" && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={onBack}>
                                Back
                            </Button>

                            <Button onClick={downloadAllOpdPdf} disabled={!selected?.id}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Full OPD History PDF
                            </Button>
                        </div>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* LEFT */}
                    <div className="lg:col-span-4">
                        <PatientSearchPicker
                            fetchPatients={async ({ q, limit }) => {
                                try {
                                    const res = await emrSearchPatients({ q, limit })
                                    return Array.isArray(res?.data) ? res.data : []
                                } catch (e) {
                                    toast.error(e?.response?.data?.detail || "Patient search failed")
                                    return []
                                }
                            }}
                            selectedPatient={selected}
                            onSelect={(p) => {
                                setSelected(p)
                                setStep("pick")
                                setVisits([])
                                setLoadingVisits(false)
                                setOpenSummary(false)
                                setActiveVisitId(null)
                            }}
                        />

                        <div className="mt-3">
                            <Button className="w-full" disabled={!selected?.id} onClick={proceed}>
                                PROCEED <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </div>

                    {/* RIGHT */}
                    <Card className="lg:col-span-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserRound className="h-5 w-5" />
                                {step === "pick" ? "Patient Preview" : "OPD History (EMR)"}
                            </CardTitle>
                        </CardHeader>

                        <CardContent>
                            {!selected?.id ? (
                                <div className="rounded-xl border p-6 text-slate-600">
                                    Select a patient from the left to continue.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <PatientHeaderCard
                                        patient={selected}
                                        rightActionLabel={step === "history" ? "Full OPD PDF" : ""}
                                        onRightAction={step === "history" ? downloadAllOpdPdf : null}
                                    />

                                    <Separator />

                                    {step === "pick" ? (
                                        <div className="rounded-xl border p-5 text-slate-600">
                                            Click <span className="font-bold">PROCEED</span> to load OPD visit history.
                                        </div>
                                    ) : (
                                        <HistoryList
                                            title="OPD Visits"
                                            loading={loadingVisits}
                                            items={visits}
                                            emptyText="No OPD visits found for this patient."
                                            renderItem={(v) => (
                                                <VisitCard
                                                    key={v.visit_id}
                                                    visit={v}
                                                    onDownloadPdf={downloadVisitPdf}
                                                    onView={openVisitSummary}
                                                />
                                            )}
                                        />
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <AnimatePresence>
                    {step === "history" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="mt-4 text-xs text-slate-500"
                        >
                            EMR v1: OPD Summary only. Next: IPD / Lab / Radiology / Pharmacy / Billing history.
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ✅ MUST be inside component render */}
            <VisitSummaryModal
                open={openSummary}
                onOpenChange={closeVisitSummary}
                visitId={activeVisitId}
            />
        </>
    )
}
