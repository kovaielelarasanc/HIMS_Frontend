// FILE: pages/emr/EmrLabPage.jsx
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import {
    emrSearchPatients,
    emrGetPatientLabOrders,
    emrDownloadLabReportPdf,
    emrDownloadPatientLabHistoryPdf,
} from "@/api/emr"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { ArrowRight, UserRound, Download, FlaskConical } from "lucide-react"

import PatientSearchPicker from "./components/PatientSearchPicker"
import PatientHeaderCard from "./components/PatientHeaderCard"
import HistoryList from "./components/HistoryList"

import LabOrderCard from "./components/LabOrderCard"
import LabReportModal from "./components/LabReportModal"

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

export default function EmrLabPage() {
    const [step, setStep] = useState("pick") // pick | history
    const [selected, setSelected] = useState(null)

    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState([])

    const [openReport, setOpenReport] = useState(false)
    const [activeOrderId, setActiveOrderId] = useState(null)

    function openLabReport(orderId) {
        setActiveOrderId(orderId)
        setOpenReport(true)
    }

    async function proceed() {
        if (!selected?.id) return
        setStep("history")
        setLoading(true)
        setOrders([])
        try {
            const res = await emrGetPatientLabOrders(selected.id, { limit: 200 })
            setOrders(res.data || [])
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to load LAB history")
        } finally {
            setLoading(false)
        }
    }

    async function downloadSingle(orderId) {
        try {
            const res = await emrDownloadLabReportPdf(orderId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `LAB_Report_${orderId}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "PDF download failed")
        }
    }

    async function downloadAll() {
        if (!selected?.id) return
        try {
            const res = await emrDownloadPatientLabHistoryPdf(selected.id, { limit: 300 })
            const blob = new Blob([res.data], { type: "application/pdf" })
            const uhid = selected?.uhid || `PAT-${selected.id}`
            downloadBlob(blob, `EMR_LAB_HISTORY_${uhid}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "History PDF download failed")
        }
    }

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <FlaskConical className="h-6 w-6" />
                        EMR — LAB
                    </h1>
                    <p className="text-sm text-slate-600">
                        Select Patient → Proceed → View Lab Report History (View + PDFs)
                    </p>
                </div>

                {step === "history" && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setStep("pick")
                                setOrders([])
                            }}
                        >
                            Back
                        </Button>

                        <Button onClick={downloadAll}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Full LAB History PDF
                        </Button>
                    </div>
                )}
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* LEFT */}
                <div className="lg:col-span-4">
                    <PatientSearchPicker
                        fetchPatients={async ({ q, limit, offset }) => {
                            const res = await emrSearchPatients({ q, limit, offset })
                            return Array.isArray(res?.data) ? res.data : []
                        }}
                        selectedPatient={selected}
                        onSelect={(p) => {
                            setSelected(p)
                            setStep("pick")
                            setOrders([])
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
                            {step === "pick" ? "Patient Preview" : "LAB History (EMR)"}
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
                                    rightActionLabel={step === "history" ? "Full LAB PDF" : ""}
                                    onRightAction={step === "history" ? downloadAll : null}
                                />

                                <Separator />

                                {step === "pick" ? (
                                    <div className="rounded-xl border p-5 text-slate-600">
                                        Click <span className="font-bold">PROCEED</span> to load Lab history.
                                    </div>
                                ) : (
                                    <HistoryList
                                        title="Lab Orders"
                                        loading={loading}
                                        items={orders}
                                        emptyText="No lab orders found for this patient."
                                        renderItem={(o) => (
                                            <LabOrderCard
                                                key={o.order_id}
                                                order={o}
                                                onDownloadPdf={downloadSingle}
                                                onView={openLabReport}
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
                        EMR v1: OPD + LAB history. Next: Radiology / Pharmacy / Billing history.
                    </motion.div>
                )}
            </AnimatePresence>

            <LabReportModal
                open={openReport}
                onOpenChange={setOpenReport}
                orderId={activeOrderId}
            />
        </div>
    )
}
