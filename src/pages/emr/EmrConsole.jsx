// FILE: src/pages/emr/EmrConsole.jsx
import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import {
    emrSearchPatients,

    // OPD
    emrGetPatientOpdVisits,
    emrDownloadVisitSummaryPdf,
    emrDownloadPatientOpdHistoryPdf,

    // LAB
    emrGetPatientLabOrders,
    emrDownloadLabReportPdf,
    emrDownloadPatientLabHistoryPdf,

    // PHARMACY (Rx)
    emrGetPatientPharmacyPrescriptions,
    emrDownloadPharmacyPrescriptionPdf,
} from "@/api/emr"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

import {
    ArrowRight,
    UserRound,
    Download,
    RefreshCcw,
    Stethoscope,
    BedDouble,
    FlaskConical,
    ScanLine,
    Pill,
    IndianRupee,
    Layers,
} from "lucide-react"

import PatientSearchPicker from "./components/PatientSearchPicker"
import PatientHeaderCard from "./components/PatientHeaderCard"
import HistoryList from "./components/HistoryList"
import VisitCard from "./components/VisitCard"
import LabOrderCard from "./components/LabOrderCard"

import VisitSummaryModal from "./components/VisitSummaryModal"
import LabReportModal from "./components/LabReportModal"

import PharmacyRxCard from "./components/PharmacyRxCard"
import PharmacyRxModal from "./components/PharmacyRxModal"

/* ---------------- utils ---------------- */
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

function safeUHID(p) {
    return p?.uhid || (p?.id ? `PAT-${p.id}` : "PATIENT")
}

function safeFileName(name) {
    return String(name || "")
        .replaceAll("/", "-")
        .replaceAll("\\", "-")
        .replaceAll(" ", "_")
        .trim()
}

/* ---------------- main ---------------- */
export default function EmrConsole() {
    // pick | console
    const [step, setStep] = useState("pick")
    const [selected, setSelected] = useState(null)

    // Tabs
    const [activeTab, setActiveTab] = useState("opd") // opd | ipd | lab | ris | pharmacy | billing

    // OPD
    const [loadingOpd, setLoadingOpd] = useState(false)
    const [opdVisits, setOpdVisits] = useState([])

    // LAB
    const [loadingLab, setLoadingLab] = useState(false)
    const [labOrders, setLabOrders] = useState([])

    // IPD placeholder
    const [loadingIpd, setLoadingIpd] = useState(false)
    const [ipdItems, setIpdItems] = useState([])

    // RIS placeholder
    const [loadingRis, setLoadingRis] = useState(false)
    const [risItems, setRisItems] = useState([])

    // PHARMACY Rx
    const [loadingPharmacy, setLoadingPharmacy] = useState(false)
    const [pharmacyRx, setPharmacyRx] = useState([])
    const [openRx, setOpenRx] = useState(false)
    const [activeRxId, setActiveRxId] = useState(null)

    // BILLING placeholder
    const [loadingBilling, setLoadingBilling] = useState(false)
    const [billingItems, setBillingItems] = useState([])

    // OPD modal
    const [openVisitSummary, setOpenVisitSummary] = useState(false)
    const [activeVisitId, setActiveVisitId] = useState(null)

    // LAB modal
    const [openLabReport, setOpenLabReport] = useState(false)
    const [activeOrderId, setActiveOrderId] = useState(null)

    function openOpdSummary(visitId) {
        setActiveVisitId(visitId)
        setOpenVisitSummary(true)
    }

    function openLab(orderId) {
        setActiveOrderId(orderId)
        setOpenLabReport(true)
    }

    function openPharmacyRx(rxId) {
        setActiveRxId(rxId)
        setOpenRx(true)
    }

    // reset on patient change
    function resetAllData() {
        setOpdVisits([])
        setLabOrders([])
        setIpdItems([])
        setRisItems([])
        setPharmacyRx([])
        setBillingItems([])
        setActiveTab("opd")
        setActiveVisitId(null)
        setActiveOrderId(null)
        setActiveRxId(null)
    }

    async function proceed() {
        if (!selected?.id) return
        setStep("console")
        resetAllData()
        await loadTabData("opd", { force: true })
    }

    async function loadTabData(tabKey, { force = false } = {}) {
        if (!selected?.id) return

        // ✅ OPD
        if (tabKey === "opd") {
            if (!force && opdVisits.length > 0) return
            setLoadingOpd(true)
            try {
                const res = await emrGetPatientOpdVisits(selected.id, { limit: 200 })
                setOpdVisits(Array.isArray(res?.data) ? res.data : [])
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Failed to load OPD history")
            } finally {
                setLoadingOpd(false)
            }
            return
        }

        // ✅ LAB
        if (tabKey === "lab") {
            if (!force && labOrders.length > 0) return
            setLoadingLab(true)
            try {
                const res = await emrGetPatientLabOrders(selected.id, { limit: 200 })
                setLabOrders(Array.isArray(res?.data) ? res.data : [])
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Failed to load LAB history")
            } finally {
                setLoadingLab(false)
            }
            return
        }

        // ✅ PHARMACY (Rx)
        if (tabKey === "pharmacy") {
            if (!force && pharmacyRx.length > 0) return
            setLoadingPharmacy(true)
            try {
                const res = await emrGetPatientPharmacyPrescriptions(selected.id, {})
                setPharmacyRx(Array.isArray(res?.data) ? res.data : [])
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Failed to load Pharmacy prescriptions")
            } finally {
                setLoadingPharmacy(false)
            }
            return
        }

        // --- placeholders (UI ready; connect later) ---
        if (tabKey === "ipd") {
            if (!force && ipdItems.length > 0) return
            setLoadingIpd(true)
            try {
                setIpdItems([])
            } catch (e) {
                toast.error("Failed to load IPD history")
            } finally {
                setLoadingIpd(false)
            }
            return
        }

        if (tabKey === "ris") {
            if (!force && risItems.length > 0) return
            setLoadingRis(true)
            try {
                setRisItems([])
            } catch (e) {
                toast.error("Failed to load Radiology history")
            } finally {
                setLoadingRis(false)
            }
            return
        }

        if (tabKey === "billing") {
            if (!force && billingItems.length > 0) return
            setLoadingBilling(true)
            try {
                setBillingItems([])
            } catch (e) {
                toast.error("Failed to load Billing history")
            } finally {
                setLoadingBilling(false)
            }
        }
    }

    // Lazy load on tab change
    useEffect(() => {
        if (step !== "console") return
        loadTabData(activeTab)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, step])

    /* ---------------- Downloads ---------------- */
    async function downloadOpdSinglePdf(visitId) {
        try {
            const res = await emrDownloadVisitSummaryPdf(visitId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `OPD_Visit_${visitId}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "OPD PDF download failed")
        }
    }

    async function downloadOpdAllPdf() {
        if (!selected?.id) return
        try {
            const res = await emrDownloadPatientOpdHistoryPdf(selected.id, { limit: 400 })
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `EMR_OPD_HISTORY_${safeUHID(selected)}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "OPD history PDF failed")
        }
    }

    async function downloadLabSinglePdf(orderId) {
        try {
            const res = await emrDownloadLabReportPdf(orderId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `LAB_Report_${orderId}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Lab PDF download failed")
        }
    }

    async function downloadLabAllPdf() {
        if (!selected?.id) return
        try {
            const res = await emrDownloadPatientLabHistoryPdf(selected.id, { limit: 400 })
            const blob = new Blob([res.data], { type: "application/pdf" })
            downloadBlob(blob, `EMR_LAB_HISTORY_${safeUHID(selected)}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Lab history PDF failed")
        }
    }

    async function downloadPharmacyRxPdf(rxId, rxNoForName = null) {
        try {
            const res = await emrDownloadPharmacyPrescriptionPdf(rxId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            const base = rxNoForName ? safeFileName(rxNoForName) : `RX-${rxId}`
            downloadBlob(blob, `Prescription_${base}.pdf`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Prescription PDF download failed")
        }
    }

    const tabMeta = useMemo(() => {
        return {
            opd: { label: "OPD", icon: Stethoscope, badge: opdVisits?.length || 0 },
            // ipd: { label: "IPD", icon: BedDouble, badge: ipdItems?.length || 0 },
            lab: { label: "LAB", icon: FlaskConical, badge: labOrders?.length || 0 },
            // ris: { label: "Radiology", icon: ScanLine, badge: risItems?.length || 0 },
            pharmacy: { label: "Pharmacy", icon: Pill, badge: pharmacyRx?.length || 0 },
            // billing: { label: "Billing", icon: IndianRupee, badge: billingItems?.length || 0 },
        }
    }, [opdVisits, ipdItems, labOrders, risItems, pharmacyRx, billingItems])

    function renderTopActions() {
        if (step !== "console") return null

        const refresh = () => loadTabData(activeTab, { force: true })

        const DownloadBtn = () => {
            if (activeTab === "opd") {
                return (
                    <Button onClick={downloadOpdAllPdf}>
                        <Download className="h-4 w-4 mr-2" />
                        Download OPD History PDF
                    </Button>
                )
            }
            if (activeTab === "lab") {
                return (
                    <Button onClick={downloadLabAllPdf}>
                        <Download className="h-4 w-4 mr-2" />
                        Download LAB History PDF
                    </Button>
                )
            }

            // Pharmacy / others: no "all PDF" endpoint now
            return (
                <Button variant="outline" disabled>
                    <Download className="h-4 w-4 mr-2" />
                    Download (Coming soon)
                </Button>
            )
        }

        return (
            <div className="flex items-center gap-2 flex-wrap">
                <Button
                    variant="outline"
                    onClick={() => {
                        setStep("pick")
                        setSelected(null)
                        resetAllData()
                    }}
                >
                    Back
                </Button>

                <Button variant="outline" onClick={refresh}>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>

                <DownloadBtn />
            </div>
        )
    }

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <Layers className="h-6 w-6" />
                        EMR Console
                    </h1>
                    <p className="text-sm text-slate-600">
                        Select Patient → Proceed → View full medical record in one page (OPD / IPD / LAB / etc.)
                    </p>
                </div>

                {renderTopActions()}
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
                            resetAllData()
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
                            {step === "pick" ? "Patient Preview" : "Medical Record (EMR Console)"}
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        {!selected?.id ? (
                            <div className="rounded-xl border p-6 text-slate-600">
                                Select a patient from the left to continue.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <PatientHeaderCard patient={selected} />

                                <Separator />

                                {step === "pick" ? (
                                    <div className="rounded-xl border p-5 text-slate-600">
                                        Click <span className="font-bold">PROCEED</span> to open EMR Console.
                                    </div>
                                ) : (
                                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <TabsList className="flex flex-wrap">
                                                {Object.entries(tabMeta).map(([k, t]) => {
                                                    const Icon = t.icon
                                                    return (
                                                        <TabsTrigger key={k} value={k} className="gap-2">
                                                            <Icon className="h-4 w-4" />
                                                            <span>{t.label}</span>
                                                            <Badge variant="secondary" className="ml-1">
                                                                {t.badge}
                                                            </Badge>
                                                        </TabsTrigger>
                                                    )
                                                })}
                                            </TabsList>

                                            <div className="text-xs text-slate-500">Tip: Tabs load on demand (fast).</div>
                                        </div>

                                        {/* OPD */}
                                        <TabsContent value="opd" className="mt-4">
                                            <HistoryList
                                                title="OPD Visits"
                                                loading={loadingOpd}
                                                items={opdVisits}
                                                emptyText="No OPD visits found for this patient."
                                                renderItem={(v) => (
                                                    <VisitCard
                                                        key={v?.visit_id ?? v?.id}
                                                        visit={v}
                                                        onDownloadPdf={downloadOpdSinglePdf}
                                                        onView={openOpdSummary}
                                                    />
                                                )}
                                            />
                                        </TabsContent>

                                        {/* IPD (placeholder) */}
                                        <TabsContent value="ipd" className="mt-4">
                                            <HistoryList
                                                title="IPD Admissions"
                                                loading={loadingIpd}
                                                items={ipdItems}
                                                emptyText="IPD EMR not connected yet (UI ready)."
                                                renderItem={(x) => (
                                                    <div className="rounded-2xl border bg-white p-4">IPD item: {JSON.stringify(x)}</div>
                                                )}
                                            />
                                        </TabsContent>

                                        {/* LAB */}
                                        <TabsContent value="lab" className="mt-4">
                                            <HistoryList
                                                title="Lab Orders"
                                                loading={loadingLab}
                                                items={labOrders}
                                                emptyText="No lab orders found for this patient."
                                                renderItem={(o) => (
                                                    <LabOrderCard
                                                        key={o?.order_id ?? o?.id}
                                                        order={o}
                                                        onDownloadPdf={downloadLabSinglePdf}
                                                        onView={openLab}
                                                    />
                                                )}
                                            />
                                        </TabsContent>

                                        {/* RIS (placeholder) */}
                                        <TabsContent value="ris" className="mt-4">
                                            <HistoryList
                                                title="Radiology Orders"
                                                loading={loadingRis}
                                                items={risItems}
                                                emptyText="Radiology EMR not connected yet (UI ready)."
                                                renderItem={(x) => (
                                                    <div className="rounded-2xl border bg-white p-4">RIS item: {JSON.stringify(x)}</div>
                                                )}
                                            />
                                        </TabsContent>

                                        {/* ✅ Pharmacy (CONNECTED: Prescriptions) */}
                                        <TabsContent value="pharmacy" className="mt-4">
                                            <HistoryList
                                                title="Pharmacy Prescriptions"
                                                loading={loadingPharmacy}
                                                items={pharmacyRx}
                                                emptyText="No pharmacy prescriptions found for this patient."
                                                renderItem={(rx) => (
                                                    <PharmacyRxCard
                                                        key={rx?.id}
                                                        rx={rx}
                                                        onView={openPharmacyRx}
                                                        onDownloadPdf={(rxId) => {
                                                            // try to name file with rx_number if backend sends it in list
                                                            const rxNo = rx?.rx_number || rx?.prescription_number || null
                                                            downloadPharmacyRxPdf(rxId, rxNo)
                                                        }}
                                                    />
                                                )}
                                            />
                                        </TabsContent>

                                        {/* Billing (placeholder) */}
                                        <TabsContent value="billing" className="mt-4">
                                            <HistoryList
                                                title="Billing / Invoices"
                                                loading={loadingBilling}
                                                items={billingItems}
                                                emptyText="Billing EMR not connected yet (UI ready)."
                                                renderItem={(x) => (
                                                    <div className="rounded-2xl border bg-white p-4">Billing item: {JSON.stringify(x)}</div>
                                                )}
                                            />
                                        </TabsContent>
                                    </Tabs>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <AnimatePresence>
                {step === "console" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 text-xs text-slate-500"
                    >
                        EMR Console v1: OPD + LAB + Pharmacy Rx connected. Next: connect IPD / RIS / Billing endpoints.
                    </motion.div>
                )}
            </AnimatePresence>

            {/* OPD modal */}
            <VisitSummaryModal
                open={openVisitSummary}
                onOpenChange={setOpenVisitSummary}
                visitId={activeVisitId}
            />

            {/* LAB modal */}
            <LabReportModal
                open={openLabReport}
                onOpenChange={setOpenLabReport}
                orderId={activeOrderId}
            />

            {/* ✅ Pharmacy modal */}
            <PharmacyRxModal open={openRx} onOpenChange={setOpenRx} rxId={activeRxId} />
        </div>
    )
}
