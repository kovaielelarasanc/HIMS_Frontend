// FILE: src/components/quickorders/OtScreen.jsx
import { useEffect, useRef, useState } from "react"
import { ScissorsLineDashed, Search, Loader2, AlertTriangle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

import DoctorPicker from "@/opd/components/DoctorPicker"
import WardRoomBedPicker from "@/components/pickers/BedPicker"

import { listOtProcedures } from "@/api/ot"
import { createOtScheduleFromContext } from "@/api/quickOrders"

import { cx, PremiumButton, StatusChip, extractApiError, fmtIST } from "./_shared"

export default function OtScreen({
    patient,
    ctx,
    contextId,
    canUseContext,
    onBack,
    loadSummary,
    loadingSummary,
    summaryOt = [],
    openDetails,
    currentUser,
}) {
    const [otDate, setOtDate] = useState("")
    const [otStart, setOtStart] = useState("")
    const [otEnd, setOtEnd] = useState("")

    const [otProcedureQuery, setOtProcedureQuery] = useState("")
    const [otProcedureOptions, setOtProcedureOptions] = useState([])
    const [otProcedureSearching, setOtProcedureSearching] = useState(false)
    const [showOtDropdown, setShowOtDropdown] = useState(false)
    const otDropRef = useRef(null)
    const [otSelectedProcedure, setOtSelectedProcedure] = useState(null)

    const [otPriority, setOtPriority] = useState("Elective")
    const [otSide, setOtSide] = useState("")
    const [otNote, setOtNote] = useState("")

    const [otBedId, setOtBedId] = useState(null)
    const [otSurgeonId, setOtSurgeonId] = useState(currentUser?.id || null)
    const [otAnaesthetistId, setOtAnaesthetistId] = useState(null)
    const [otSubmitting, setOtSubmitting] = useState(false)

    // Close dropdown on outside click / ESC
    useEffect(() => {
        const onDown = (e) => {
            const t = e.target
            if (otDropRef.current && !otDropRef.current.contains(t)) setShowOtDropdown(false)
        }
        const onKey = (e) => {
            if (e.key === "Escape") setShowOtDropdown(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [])

    // Debounced procedure search
    useEffect(() => {
        if (!otProcedureQuery || otProcedureQuery.trim().length < 2) {
            setOtProcedureOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setOtProcedureSearching(true)
                const res = await listOtProcedures({ search: otProcedureQuery.trim(), isActive: true, limit: 20 })
                if (cancelled) return
                const items = Array.isArray(res?.data?.items) ? res.data.items : Array.isArray(res?.data) ? res.data : []
                setOtProcedureOptions(items)
                setShowOtDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error("Failed to fetch OT procedures.")
            } finally {
                if (!cancelled) setOtProcedureSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [otProcedureQuery])

    const handleSelectOtProcedure = (p) => {
        setOtSelectedProcedure(p)
        setOtProcedureQuery(p.name || p.procedure_name || "")
        setShowOtDropdown(false)
    }

    const handleSubmitOt = async () => {
        if (ctx !== "ipd") return toast.warning("OT booking via quick orders is only for IPD.")
        if (!otDate || !otStart) return toast.warning("Please select OT date and start time.")
        if (!patient?.id || !contextId) return toast.error("Missing patient or admission for OT schedule.")

        const surgeonId = otSurgeonId || currentUser?.id
        if (!surgeonId) return toast.error("Please select a surgeon.")

        const procedureName = otSelectedProcedure ? otSelectedProcedure.name || otSelectedProcedure.procedure_name : otProcedureQuery?.trim()
        if (!procedureName) return toast.error("Please enter a procedure name.")

        setOtSubmitting(true)
        try {
            await createOtScheduleFromContext({
                patientId: patient.id,
                contextType: ctx,
                admissionId: contextId,
                bedId: otBedId,
                surgeonUserId: surgeonId,
                anaesthetistUserId: otAnaesthetistId,
                date: otDate,
                plannedStartTime: otStart,
                plannedEndTime: otEnd || null,
                priority: otPriority,
                side: otSide || null,
                procedureName,
                primaryProcedureId: otSelectedProcedure?.id || null,
                additionalProcedureIds: [],
                notes: otNote,
            })

            toast.success("OT schedule created.")
            setOtDate("")
            setOtStart("")
            setOtEnd("")
            setOtBedId(null)
            setOtProcedureQuery("")
            setOtSelectedProcedure(null)
            setOtSide("")
            setOtPriority("Elective")
            setOtAnaesthetistId(null)
            setOtNote("")
            loadSummary?.()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, "Failed to create OT schedule."))
        } finally {
            setOtSubmitting(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <PremiumButton tone="slate" variant="outline" className="h-10" onClick={onBack} type="button">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </PremiumButton>
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center">
                            <ScissorsLineDashed className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-900">OT Schedule</div>
                            <div className="text-[11px] text-slate-500">IPD only — book OT with procedure + surgeon.</div>
                        </div>
                    </div>
                </div>

                <StatusChip tone="ot">{summaryOt?.length || 0} cases</StatusChip>
            </div>

            {ctx !== "ipd" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    OT quick booking is only for IPD admission context.
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                {/* Left: Create */}
                <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                            <ScissorsLineDashed className="h-4 w-4 text-amber-600" />
                            Create OT Schedule
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                        <div className="grid sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">
                                    OT Date <span className="text-rose-500">*</span>
                                </label>
                                <Input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} className="h-10 text-xs rounded-2xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">
                                    Start time <span className="text-rose-500">*</span>
                                </label>
                                <Input type="time" value={otStart} onChange={(e) => setOtStart(e.target.value)} className="h-10 text-xs rounded-2xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">End time (optional)</label>
                                <Input type="time" value={otEnd} onChange={(e) => setOtEnd(e.target.value)} className="h-10 text-xs rounded-2xl" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">OT Location / Bed</label>
                            <WardRoomBedPicker value={otBedId ? Number(otBedId) : null} onChange={(bedId) => setOtBedId(bedId || null)} />
                        </div>

                        <div ref={otDropRef} className="space-y-1.5 relative">
                            <label className="text-xs font-medium text-slate-600">Procedure (OT Master or free text)</label>
                            <div className="relative">
                                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-3" />
                                <Input
                                    value={otProcedureQuery}
                                    onChange={(e) => {
                                        setOtProcedureQuery(e.target.value)
                                        setShowOtDropdown(true)
                                    }}
                                    placeholder="Search procedure name / code…"
                                    className="h-10 text-xs pl-7 rounded-2xl"
                                />
                            </div>

                            {showOtDropdown && (otProcedureOptions.length > 0 || otProcedureSearching) && (
                                <div className="absolute z-30 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-xl max-h-56 overflow-auto text-xs">
                                    {otProcedureSearching && (
                                        <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Searching…
                                        </div>
                                    )}
                                    {!otProcedureSearching && !otProcedureOptions.length && <div className="px-3 py-2 text-slate-500">No procedures found.</div>}
                                    {!otProcedureSearching &&
                                        otProcedureOptions.map((p) => (
                                            <button key={p.id} type="button" onClick={() => handleSelectOtProcedure(p)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5">
                                                <span className="font-medium text-slate-900">{p.name || p.procedure_name}</span>
                                                <span className="text-[11px] text-slate-500">{p.code || "—"}</span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Side</label>
                                <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800" value={otSide} onChange={(e) => setOtSide(e.target.value)}>
                                    <option value="">Not applicable</option>
                                    <option value="Right">Right</option>
                                    <option value="Left">Left</option>
                                    <option value="Bilateral">Bilateral</option>
                                    <option value="Midline">Midline</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Priority</label>
                                <div className="flex flex-wrap gap-2">
                                    {["Elective", "Emergency"].map((p) => {
                                        const active = otPriority === p
                                        return (
                                            <PremiumButton key={p} type="button" tone="ot" variant={active ? "solid" : "outline"} className="h-9 px-3 text-[11px] rounded-xl flex-1 min-w-[120px]" onClick={() => setOtPriority(p)}>
                                                {p}
                                            </PremiumButton>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <DoctorPicker label="Surgeon" value={otSurgeonId ? Number(otSurgeonId) : null} onChange={(id) => setOtSurgeonId(id || null)} />
                            <DoctorPicker label="Anaesthetist" value={otAnaesthetistId ? Number(otAnaesthetistId) : null} onChange={(id) => setOtAnaesthetistId(id || null)} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Notes / anaesthesia plan (optional)</label>
                            <Textarea rows={2} value={otNote} onChange={(e) => setOtNote(e.target.value)} className="resize-none text-xs rounded-2xl" />
                        </div>

                        <div className="flex justify-end">
                            <PremiumButton type="button" tone="ot" variant="solid" disabled={otSubmitting || !canUseContext || ctx !== "ipd"} onClick={handleSubmitOt} className="h-10 px-5 text-xs">
                                {otSubmitting ? "Creating OT schedule…" : "Create OT schedule"}
                            </PremiumButton>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Recent */}
                <Card className="border-slate-200 bg-white/70 backdrop-blur rounded-2xl">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ScissorsLineDashed className="h-4 w-4 text-amber-600" />
                            <CardTitle className="text-xs font-semibold">Recent OT Schedules</CardTitle>
                        </div>
                        <StatusChip tone="ot">{summaryOt?.length || 0}</StatusChip>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="space-y-2 max-h-80 overflow-auto text-[11px]">
                            {!summaryOt?.length && !loadingSummary && <div className="text-slate-500 text-[12px]">No OT schedules yet.</div>}
                            {summaryOt?.map((o) => (
                                <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => openDetails?.("ot", o)}
                                    className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50"
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-slate-900 truncate">{o.case_no || `OT-${String(o.id).padStart(6, "0")}`}</span>
                                        <span className="text-[10px] text-slate-500 truncate">{fmtIST(o.created_at || o.scheduled_at)}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-600 capitalize shrink-0">{o.status || "planned"}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
