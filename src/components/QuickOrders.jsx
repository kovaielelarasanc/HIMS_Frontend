// FILE: src/components/QuickOrders.jsx
import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
    FlaskConical,
    Radio,
    Pill,
    ScissorsLineDashed,
    ClipboardList,
    Activity,
    Clock,
    User,
    BedDouble,
    Hash,
    AlertTriangle,
    Loader2,
    Download,
    Eye,
    Printer,
    RefreshCcw,
    X,
} from "lucide-react"

import { toast } from "sonner"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"


import LabScreen from "./quickorders/LabScreen"
import RisScreen from "./quickorders/RisScreen"
import RxScreen from "./quickorders/RxScreen"
import OtScreen from "./quickorders/OtScreen"
import WardPatientUsageTab from "./quickorders/WardPatientUsagePage"
import {
    cx,
    useMediaQuery,
    safePatientName,
    safeGenderAge,
    fmtIST,
    extractApiError,
    PremiumButton,
    StatusChip,
    openBlobInNewTab,
    downloadBlob,
    printBlob,
} from "@/components/quickorders/_shared"

// ---- Quick Orders APIs ----
import {
    listLabOrdersForContext,
    listRadiologyOrdersForContext,
    listPharmacyPrescriptionsForContext,
    listOtSchedulesForContext,
    getRxDetails,
    downloadRxPdf,
    fetchVisitSummaryPdf,
} from "@/api/quickOrders"

// ---- Lab pdf ----
import { fetchLisReportPdf } from "@/api/lab"

// ✅ NEW: Ward summary (optional, to show count + recent usage on home)
import { invListPatientConsumptions } from "@/api/inventoryConsumption"





const fadeIn = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
}

function normalizeList(v) {
    if (Array.isArray(v)) return v
    if (Array.isArray(v?.data)) return v.data
    if (Array.isArray(v?.data?.items)) return v.data.items
    if (Array.isArray(v?.items)) return v.items
    return []
}

export default function QuickOrders({
    patient,
    contextType, // 'opd' | 'ipd'
    contextId, // visit_id / ipd_admission_id
    opNumber,
    ipNumber,
    bedLabel,
    currentUser,
    defaultLocationId,
    className = "",
}) {
    const isMobile = useMediaQuery("(max-width: 640px)")

    // screens: home + lab/ris/rx/ot/ward
    const [screen, setScreen] = useState("home")

    const [loadingSummary, setLoadingSummary] = useState(false)
    const [summary, setSummary] = useState({ lab: [], ris: [], rx: [], ot: [], ward: [] })

    // Details sheet
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailsType, setDetailsType] = useState(null) // 'lab' | 'ris' | 'rx' | 'ot'
    const [detailsItem, setDetailsItem] = useState(null)
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [detailsFull, setDetailsFull] = useState(null)

    const closeDetails = () => {
        setDetailsOpen(false)
        setDetailsType(null)
        setDetailsItem(null)
        setDetailsFull(null)
        setDetailsLoading(false)
    }

    // Context
    const ctx = useMemo(() => {
        if (!contextType) return null
        const v = String(contextType).toLowerCase()
        if (v === "op" || v === "opd") return "opd"
        if (v === "ip" || v === "ipd") return "ipd"
        return v
    }, [contextType])

    const contextLabel = ctx === "ipd" ? "IPD Admission" : "OPD Visit"
    const contextNumberLabel =
        ctx === "ipd"
            ? ipNumber
                ? `IP No: ${ipNumber}`
                : "IP Number not set"
            : opNumber
                ? `OP No: ${opNumber}`
                : "OP Number not set"

    const bedInfo = ctx === "ipd" && bedLabel ? `Bed: ${bedLabel}` : null
    const canUseContext = !!(patient?.id && ctx && contextId)

    const wardEncounterType = useMemo(() => {
        if (ctx === "ipd") return "IP"
        if (ctx === "opd") return "OP"
        return ctx ? String(ctx).toUpperCase() : ""
    }, [ctx])

    // Load summary
    const loadSummary = useCallback(async () => {
        if (!patient?.id || !ctx || !contextId) return
        setLoadingSummary(true)
        try {
            const [lab, ris, rx, ot, ward] = await Promise.all([
                listLabOrdersForContext({ patientId: patient.id, contextType: ctx, contextId, limit: 10 }),
                listRadiologyOrdersForContext({ patientId: patient.id, contextType: ctx, contextId, limit: 10 }),
                listPharmacyPrescriptionsForContext({ patientId: patient.id, contextType: ctx, contextId, limit: 10 }),
                ctx === "ipd"
                    ? listOtSchedulesForContext({ patientId: patient.id, admissionId: contextId, limit: 10 })
                    : Promise.resolve([]),
                // ✅ Ward usage summary (optional, helps counts + recent list)
                invListPatientConsumptions({
                    limit: 10,
                    offset: 0,
                    patient_id: Number(patient.id),
                    encounter_type: wardEncounterType,
                    encounter_id: Number(contextId),
                }).catch(() => []),
            ])

            setSummary({
                lab: normalizeList(lab),
                ris: normalizeList(ris),
                rx: normalizeList(rx),
                ot: normalizeList(ot),
                ward: normalizeList(ward),
            })
        } catch (err) {
            console.error("Failed to load quick orders summary", err)
            toast.error("Unable to load recent orders for this patient.")
            setSummary({ lab: [], ris: [], rx: [], ot: [], ward: [] })
        } finally {
            setLoadingSummary(false)
        }
    }, [patient?.id, ctx, contextId, wardEncounterType])

    useEffect(() => {
        loadSummary()
    }, [loadSummary])

    // Visit summary PDF actions (OPD)
    const visitPdfActions = async (mode) => {
        if (ctx !== "opd" || !contextId) return toast.error("Visit context missing")
        try {
            const res = await fetchVisitSummaryPdf(Number(contextId))
            const blob = new Blob([res.data], { type: "application/pdf" })
            if (mode === "view") openBlobInNewTab(blob)
            if (mode === "download") downloadBlob(blob, `opd_visit_${contextId}_summary.pdf`)
            if (mode === "print") printBlob(blob)
        } catch (e) {
            console.error(e)
            toast.error(extractApiError(e, "Visit PDF failed"))
        }
    }

    // Lab PDF actions
    const labPdfActions = async (orderId, mode) => {
        if (!orderId) return toast.error("Invalid Lab Order ID")
        try {
            const res = await fetchLisReportPdf(orderId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            if (mode === "view") openBlobInNewTab(blob)
            if (mode === "download") downloadBlob(blob, `lab_report_${orderId}.pdf`)
            if (mode === "print") printBlob(blob)
        } catch (e) {
            console.error(e)
            toast.error(extractApiError(e, "Lab PDF failed"))
        }
    }

    // Rx PDF actions
    const rxActions = async (rxId, mode) => {
        if (!rxId) return toast.error("Invalid prescription ID")
        try {
            const res = await downloadRxPdf(rxId)
            const blob = new Blob([res.data], { type: "application/pdf" })
            if (mode === "view") openBlobInNewTab(blob)
            if (mode === "download") downloadBlob(blob, `prescription_${rxId}.pdf`)
            if (mode === "print") printBlob(blob)
        } catch (e) {
            console.error(e)
            toast.error("Prescription PDF failed")
        }
    }

    // Details open
    const openDetails = async (type, item) => {
        setDetailsType(type)
        setDetailsItem(item)
        setDetailsOpen(true)
        setDetailsFull(null)

        try {
            setDetailsLoading(true)
            if (type === "rx" && item?.id) {
                const fullRes = await getRxDetails(item.id)
                setDetailsFull(fullRes?.data ?? fullRes)
                return
            }
            setDetailsFull(item)
        } catch (e) {
            console.error(e)
            toast.error("Failed to load details")
            setDetailsFull(item)
        } finally {
            setDetailsLoading(false)
        }
    }

    // Home cards
    const ModuleCard = ({ tone, icon: Icon, title, subtitle, count, onOpen }) => (
        <button
            type="button"
            onClick={onOpen}
            className={cx(
                "group w-full text-left rounded-2xl border border-slate-200 bg-white/70 backdrop-blur",
                "px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] hover:bg-white transition-all"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={cx("h-11 w-11 rounded-2xl flex items-center justify-center text-white", tone)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{subtitle}</div>
                    </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 rounded-full px-2.5 py-0.5">
                    {count}
                </span>
            </div>

            <div className="mt-3 text-[11px] text-slate-600">
                Tap to open <span className="font-semibold">{title}</span> screen
            </div>
        </button>
    )

    return (
        <>
            <motion.div className={cx("w-full", className)} {...fadeIn}>
                {/* Premium outer shell */}
                <div className="rounded-3xl sm:rounded-[30px] bg-gradient-to-br from-slate-50 via-white to-slate-100 p-[1px] shadow-[0_26px_70px_rgba(15,23,42,0.12)]">
                    <Card className="border-0 bg-white/70 backdrop-blur-xl rounded-3xl sm:rounded-[30px] overflow-hidden">
                        {/* Header */}
                        <CardHeader className="border-b border-slate-100 p-4 sm:p-5 lg:p-6">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center shadow-sm">
                                            <Activity className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base sm:text-lg font-semibold text-slate-900">
                                                Quick Orders
                                            </CardTitle>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Main dashboard + split screens for Lab / Radiology / Pharmacy / OT / Ward Usage.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <Badge className="bg-slate-900 text-slate-50 px-3 py-1 rounded-full">{contextLabel}</Badge>

                                        <Badge
                                            variant="outline"
                                            className="flex items-center gap-1.5 border-slate-300 bg-white/80 rounded-full"
                                        >
                                            <Hash className="h-3 w-3 text-slate-500" />
                                            <span className="font-medium text-slate-800">{contextNumberLabel}</span>
                                        </Badge>

                                        {bedInfo && (
                                            <Badge
                                                variant="outline"
                                                className="flex items-center gap-1.5 border-emerald-300 bg-emerald-50/90 rounded-full"
                                            >
                                                <BedDouble className="h-3 w-3 text-emerald-600" />
                                                <span className="font-medium text-emerald-700">{bedInfo}</span>
                                            </Badge>
                                        )}

                                        {ctx === "opd" && contextId && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <PremiumButton
                                                    tone="slate"
                                                    variant="outline"
                                                    className="h-9 text-[11px]"
                                                    onClick={() => visitPdfActions("view")}
                                                    type="button"
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Visit PDF
                                                </PremiumButton>
                                                <PremiumButton
                                                    tone="slate"
                                                    variant="outline"
                                                    className="h-9 text-[11px]"
                                                    onClick={() => visitPdfActions("print")}
                                                    type="button"
                                                >
                                                    <Printer className="h-4 w-4 mr-2" />
                                                    Print
                                                </PremiumButton>
                                                <PremiumButton
                                                    tone="slate"
                                                    variant="solid"
                                                    className="h-9 text-[11px]"
                                                    onClick={() => visitPdfActions("download")}
                                                    type="button"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download
                                                </PremiumButton>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Patient snapshot */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 backdrop-blur">
                                        <div className="h-9 w-9 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                                            <User className="h-4 w-4 text-slate-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[11px] text-slate-500">Patient</div>
                                            <div className="text-[12px] font-semibold text-slate-900 truncate">
                                                {safePatientName(patient)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 backdrop-blur">
                                        <div className="h-9 w-9 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                                            <Clock className="h-4 w-4 text-slate-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[11px] text-slate-500">Demographics</div>
                                            <div className="text-[12px] font-semibold text-slate-900 truncate">
                                                {safeGenderAge(patient)}
                                            </div>
                                        </div>
                                    </div>

                                    <PremiumButton
                                        type="button"
                                        tone="slate"
                                        variant="outline"
                                        className="h-10 ml-auto"
                                        onClick={() => {
                                            loadSummary()
                                            toast.success("Refreshed")
                                        }}
                                    >
                                        <RefreshCcw className="h-4 w-4 mr-2" />
                                        Refresh
                                    </PremiumButton>
                                </div>

                                {!canUseContext && (
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                                        <div>
                                            Missing patient/context. Please ensure patient, context type (OPD/IPD) and context id are present.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardHeader>

                        {/* Body */}
                        <CardContent className="p-3 sm:p-4 md:p-5">
                            {screen === "home" ? (
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                                    {/* Left: module cards */}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <ModuleCard
                                            tone="bg-sky-600"
                                            icon={FlaskConical}
                                            title="Lab"
                                            subtitle="Order tests from LIS masters"
                                            count={summary.lab?.length || 0}
                                            onOpen={() => setScreen("lab")}
                                        />
                                        <ModuleCard
                                            tone="bg-indigo-600"
                                            icon={Radio}
                                            title="Radiology"
                                            subtitle="Order investigations from RIS"
                                            count={summary.ris?.length || 0}
                                            onOpen={() => setScreen("ris")}
                                        />
                                        <ModuleCard
                                            tone="bg-emerald-600"
                                            icon={Pill}
                                            title="Pharmacy"
                                            subtitle="Create e-Prescription from inventory"
                                            count={summary.rx?.length || 0}
                                            onOpen={() => setScreen("rx")}
                                        />
                                        <ModuleCard
                                            tone="bg-amber-600"
                                            icon={ScissorsLineDashed}
                                            title="OT"
                                            subtitle="Schedule OT (IPD only)"
                                            count={ctx === "ipd" ? summary.ot?.length || 0 : "—"}
                                            onOpen={() => setScreen("ot")}
                                        />
                                        <ModuleCard
                                            tone="bg-teal-600"
                                            icon={ClipboardList}
                                            title="Ward Usage"
                                            subtitle="Consumables used (billable usage)"
                                            count={summary.ward?.length || 0}
                                            onOpen={() => setScreen("ward")}
                                        />
                                    </div>

                                    {/* Right: Summary lists */}
                                    <div className="space-y-3 lg:sticky lg:top-3 self-start">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                                                Recent orders (this {String(contextLabel || "").toLowerCase()})
                                            </h3>
                                            {loadingSummary && (
                                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Loading
                                                </span>
                                            )}
                                        </div>

                                        {/* LAB */}
                                        <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FlaskConical className="h-4 w-4 text-sky-600" />
                                                    <CardTitle className="text-xs font-semibold">Lab Orders</CardTitle>
                                                </div>
                                                <StatusChip tone="lab">{summary.lab?.length || 0}</StatusChip>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4 pt-0">
                                                <div className="space-y-2 max-h-44 overflow-auto text-[11px]">
                                                    {!summary.lab?.length && !loadingSummary && (
                                                        <div className="text-slate-500 text-[12px]">No lab orders yet.</div>
                                                    )}
                                                    {summary.lab?.map((o) => (
                                                        <button
                                                            key={o.id}
                                                            type="button"
                                                            onClick={() => openDetails("lab", o)}
                                                            className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {o.order_no || `LAB-${String(o.id).padStart(6, "0")}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 truncate">
                                                                    {fmtIST(o.created_at || o.order_datetime)}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                                {o.status || "ordered"}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* RIS */}
                                        <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Radio className="h-4 w-4 text-indigo-600" />
                                                    <CardTitle className="text-xs font-semibold">Radiology Orders</CardTitle>
                                                </div>
                                                <StatusChip tone="ris">{summary.ris?.length || 0}</StatusChip>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4 pt-0">
                                                <div className="space-y-2 max-h-44 overflow-auto text-[11px]">
                                                    {!summary.ris?.length && !loadingSummary && (
                                                        <div className="text-slate-500 text-[12px]">No radiology orders yet.</div>
                                                    )}
                                                    {summary.ris?.map((o) => (
                                                        <button
                                                            key={o.id}
                                                            type="button"
                                                            onClick={() => openDetails("ris", o)}
                                                            className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {o.order_no || `RIS-${String(o.id).padStart(6, "0")}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 truncate">
                                                                    {fmtIST(o.created_at || o.order_datetime)}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                                {o.status || "ordered"}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* RX */}
                                        <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Pill className="h-4 w-4 text-emerald-600" />
                                                    <CardTitle className="text-xs font-semibold">Pharmacy Rx</CardTitle>
                                                </div>
                                                <StatusChip tone="rx">{summary.rx?.length || 0}</StatusChip>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4 pt-0">
                                                <div className="space-y-2 max-h-44 overflow-auto text-[11px]">
                                                    {!summary.rx?.length && !loadingSummary && (
                                                        <div className="text-slate-500 text-[12px]">No prescriptions yet.</div>
                                                    )}
                                                    {summary.rx?.map((o) => (
                                                        <button
                                                            key={o.id}
                                                            type="button"
                                                            onClick={() => openDetails("rx", o)}
                                                            className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {o.rx_number || `RX-${String(o.id).padStart(6, "0")}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 truncate">
                                                                    {fmtIST(o.rx_datetime || o.created_at)}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                                {o.status || "pending"}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* OT */}
                                        {ctx === "ipd" && (
                                            <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <ScissorsLineDashed className="h-4 w-4 text-amber-600" />
                                                        <CardTitle className="text-xs font-semibold">OT Schedules</CardTitle>
                                                    </div>
                                                    <StatusChip tone="ot">{summary.ot?.length || 0}</StatusChip>
                                                </CardHeader>
                                                <CardContent className="px-4 pb-4 pt-0">
                                                    <div className="space-y-2 max-h-44 overflow-auto text-[11px]">
                                                        {!summary.ot?.length && !loadingSummary && (
                                                            <div className="text-slate-500 text-[12px]">No OT schedules yet.</div>
                                                        )}
                                                        {summary.ot?.map((o) => (
                                                            <button
                                                                key={o.id}
                                                                type="button"
                                                                onClick={() => openDetails("ot", o)}
                                                                className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                            >
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-semibold text-slate-900 truncate">
                                                                        {o.case_no || `OT-${String(o.id).padStart(6, "0")}`}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 truncate">
                                                                        {fmtIST(o.created_at || o.scheduled_at)}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-slate-600 capitalize shrink-0">
                                                                    {o.status || "planned"}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* WARD USAGE (small summary) */}
                                        <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <ClipboardList className="h-4 w-4 text-teal-600" />
                                                    <CardTitle className="text-xs font-semibold">Ward Usage</CardTitle>
                                                </div>
                                                <StatusChip tone="slate">{summary.ward?.length || 0}</StatusChip>
                                            </CardHeader>
                                            <CardContent className="px-4 pb-4 pt-0">
                                                <div className="space-y-2 max-h-44 overflow-auto text-[11px]">
                                                    {!summary.ward?.length && !loadingSummary && (
                                                        <div className="text-slate-500 text-[12px]">No usage entries yet.</div>
                                                    )}
                                                    {summary.ward?.map((r) => (
                                                        <button
                                                            key={r.consumption_id || r.id}
                                                            type="button"
                                                            onClick={() => setScreen("ward")}
                                                            className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {r.consumption_number || `#${r.consumption_id || r.id}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 truncate">{fmtIST(r.posted_at || r.created_at)}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 shrink-0">
                                                                Qty: {r.total_qty ?? "—"}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="mt-3">
                                                    <PremiumButton
                                                        tone="slate"
                                                        variant="outline"
                                                        className="h-9 w-full text-[11px]"
                                                        onClick={() => setScreen("ward")}
                                                        type="button"
                                                    >
                                                        <ClipboardList className="h-4 w-4 mr-2" />
                                                        Open Ward Usage
                                                    </PremiumButton>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ) : screen === "lab" ? (
                                <LabScreen
                                    patient={patient}
                                    ctx={ctx}
                                    contextId={contextId}
                                    canUseContext={canUseContext}
                                    onBack={() => setScreen("home")}
                                    loadSummary={loadSummary}
                                    loadingSummary={loadingSummary}
                                    summaryLab={summary.lab}
                                    openDetails={openDetails}
                                    labPdfActions={labPdfActions}
                                />
                            ) : screen === "ris" ? (
                                <RisScreen
                                    patient={patient}
                                    ctx={ctx}
                                    contextId={contextId}
                                    canUseContext={canUseContext}
                                    onBack={() => setScreen("home")}
                                    loadSummary={loadSummary}
                                    loadingSummary={loadingSummary}
                                    summaryRis={summary.ris}
                                    openDetails={openDetails}
                                />
                            ) : screen === "rx" ? (
                                <RxScreen
                                    patient={patient}
                                    ctx={ctx}
                                    contextId={contextId}
                                    canUseContext={canUseContext}
                                    onBack={() => setScreen("home")}
                                    loadSummary={loadSummary}
                                    loadingSummary={loadingSummary}
                                    summaryRx={summary.rx}
                                    openDetails={openDetails}
                                    defaultLocationId={defaultLocationId}
                                />
                            ) : screen === "ward" ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <PremiumButton
                                            tone="slate"
                                            variant="outline"
                                            className="h-10"
                                            type="button"
                                            onClick={() => setScreen("home")}
                                        >
                                            Back to Quick Orders
                                        </PremiumButton>

                                        <Badge variant="outline" className="rounded-full bg-white/80 border-slate-300">
                                            Ward Patient Usage
                                        </Badge>
                                    </div>

                                    <WardPatientUsageTab
                                        patient={patient}
                                        ctx={ctx}
                                        contextId={contextId}
                                        defaultLocationId={defaultLocationId}
                                    />
                                </div>
                            ) : (
                                <OtScreen
                                    patient={patient}
                                    ctx={ctx}
                                    contextId={contextId}
                                    canUseContext={canUseContext}
                                    onBack={() => setScreen("home")}
                                    loadSummary={loadSummary}
                                    loadingSummary={loadingSummary}
                                    summaryOt={summary.ot}
                                    openDetails={openDetails}
                                    currentUser={currentUser}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </motion.div>

            {/* Details Sheet */}
            <Sheet open={detailsOpen} onOpenChange={(v) => (v ? setDetailsOpen(true) : closeDetails())}>
                <SheetContent
                    side={isMobile ? "bottom" : "right"}
                    className={cx(
                        "p-0 overflow-hidden",
                        isMobile ? "h-[90vh] w-full rounded-t-3xl border-t border-slate-200" : "w-full sm:max-w-xl"
                    )}
                >
                    <div className="flex h-full flex-col">
                        {/* Header */}
                        <div className={cx("border-b border-slate-200 bg-white/80 backdrop-blur", isMobile ? "p-4" : "p-6")}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <SheetHeader>
                                        <SheetTitle className="text-base">
                                            {detailsType === "lab" && "Lab Order"}
                                            {detailsType === "ris" && "Radiology Order"}
                                            {detailsType === "rx" && "Prescription"}
                                            {detailsType === "ot" && "OT Schedule"}
                                        </SheetTitle>
                                        <SheetDescription className="text-xs">
                                            {detailsItem?.id ? `ID: ${detailsItem.id}` : ""}
                                        </SheetDescription>
                                    </SheetHeader>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-2xl text-slate-500"
                                    onClick={closeDetails}
                                    title="Close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className={cx(isMobile ? "px-4 py-4" : "px-6 py-6", "space-y-3")}>
                                    {detailsLoading && (
                                        <div className="text-sm text-slate-500 flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                                        </div>
                                    )}

                                    {!detailsLoading && detailsItem && (
                                        <div className="space-y-3">
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
                                                <div className="font-semibold text-slate-900">Summary</div>
                                                <div className="mt-1 text-slate-600">
                                                    Created:{" "}
                                                    <span className="font-semibold text-slate-800">
                                                        {fmtIST(detailsItem.created_at || detailsItem.order_datetime || detailsItem.rx_datetime)}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-slate-600">
                                                    Status: <span className="font-semibold text-slate-800">{detailsItem.status || "—"}</span>
                                                </div>
                                            </div>

                                            {detailsType === "rx" && detailsFull && detailsFull !== detailsItem && (
                                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs">
                                                    <div className="font-semibold text-slate-900">Rx details</div>
                                                    <div className="mt-1 text-slate-600">
                                                        Items:{" "}
                                                        <span className="font-semibold text-slate-900">
                                                            {detailsFull?.lines?.length ?? detailsFull?.data?.lines?.length ?? "—"}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Footer actions */}
                        {detailsItem?.id && (
                            <div className={cx("border-t border-slate-200 bg-white/90 backdrop-blur", isMobile ? "p-3" : "p-4")}>
                                <div className="flex flex-wrap gap-2">
                                    {detailsType === "lab" && (
                                        <>
                                            <PremiumButton
                                                tone="lab"
                                                variant="outline"
                                                className="rounded-2xl"
                                                onClick={() => labPdfActions(detailsItem.id, "view")}
                                            >
                                                <Eye className="h-4 w-4 mr-2" /> View PDF
                                            </PremiumButton>
                                            <PremiumButton
                                                tone="lab"
                                                variant="outline"
                                                className="rounded-2xl"
                                                onClick={() => labPdfActions(detailsItem.id, "print")}
                                            >
                                                <Printer className="h-4 w-4 mr-2" /> Print
                                            </PremiumButton>
                                            <PremiumButton
                                                tone="lab"
                                                variant="solid"
                                                className="rounded-2xl"
                                                onClick={() => labPdfActions(detailsItem.id, "download")}
                                            >
                                                <Download className="h-4 w-4 mr-2" /> Download
                                            </PremiumButton>
                                        </>
                                    )}

                                    {detailsType === "rx" && (
                                        <>
                                            <PremiumButton
                                                tone="rx"
                                                variant="outline"
                                                className="rounded-2xl"
                                                onClick={() => rxActions(detailsItem.id, "view")}
                                            >
                                                <Eye className="h-4 w-4 mr-2" /> View PDF
                                            </PremiumButton>
                                            <PremiumButton
                                                tone="rx"
                                                variant="outline"
                                                className="rounded-2xl"
                                                onClick={() => rxActions(detailsItem.id, "print")}
                                            >
                                                <Printer className="h-4 w-4 mr-2" /> Print
                                            </PremiumButton>
                                            <PremiumButton
                                                tone="rx"
                                                variant="solid"
                                                className="rounded-2xl"
                                                onClick={() => rxActions(detailsItem.id, "download")}
                                            >
                                                <Download className="h-4 w-4 mr-2" /> Download
                                            </PremiumButton>
                                        </>
                                    )}

                                    <PremiumButton tone="slate" variant="outline" className="rounded-2xl ml-auto" onClick={closeDetails}>
                                        Close
                                    </PremiumButton>
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    )
}
