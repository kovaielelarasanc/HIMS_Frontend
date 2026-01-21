// FILE: frontend/src/emr/EmrExportRelease.jsx
import React, { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
    X,
    Search,
    RefreshCcw,
    Building2,
    Layers,
    Calendar,
    Clock3,
    FileText,
    Paperclip,
    Lock,
    KeyRound,
    Shield,
    Users,
    UserPlus,
    Download,
    Share2,
    FileDown,
    History,
    CheckCircle2,
    AlertTriangle,
    ListChecks,
    Eye,
    EyeOff,
    Settings,
    Plus,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

/**
 * ✅ EMR Export & Release (MRD / Sharing) — UI Only
 * Features:
 * - Export builder (bundle PDF): cover page, index, watermark, password, attachments, audit summary
 * - Permissions: roles/users, expiry, download/print controls, OTP toggle (placeholder)
 * - Release actions: generate bundle, download, share (email/whatsapp placeholders)
 * - Audit logs: event timeline
 * - Apple Premium UI + multi-color dept tone + responsive + full scroll-safe layout
 *
 * Backend later:
 * - GET /emr/patients/:id/visits
 * - GET /emr/visits/:id/records
 * - POST /emr/exports/build
 * - POST /emr/exports/:id/release
 * - GET /emr/exports/:id/audit
 */

function useIsMobile(breakpointPx = 1024) {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
        const on = () => setIsMobile(mq.matches)
        on()
        mq.addEventListener?.("change", on)
        return () => mq.removeEventListener?.("change", on)
    }, [breakpointPx])
    return isMobile
}

function deptTone(deptRaw) {
    const d = (deptRaw || "").toUpperCase()
    const map = {
        OBGYN: {
            bar: "from-pink-500/80 via-rose-500/55 to-orange-400/45",
            chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(244,63,94,0.55)]",
            btn: "bg-rose-600 hover:bg-rose-700",
        },
        CARDIOLOGY: {
            bar: "from-red-500/80 via-rose-500/55 to-amber-400/40",
            chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(239,68,68,0.55)]",
            btn: "bg-red-600 hover:bg-red-700",
        },
        ICU: {
            bar: "from-indigo-500/80 via-blue-500/55 to-cyan-400/40",
            chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(99,102,241,0.55)]",
            btn: "bg-indigo-600 hover:bg-indigo-700",
        },
        ORTHOPEDICS: {
            bar: "from-emerald-500/75 via-teal-500/55 to-lime-400/35",
            chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(16,185,129,0.55)]",
            btn: "bg-emerald-600 hover:bg-emerald-700",
        },
        "PATHOLOGY/LAB": {
            bar: "from-amber-500/75 via-yellow-500/55 to-orange-400/35",
            chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(245,158,11,0.55)]",
            btn: "bg-amber-600 hover:bg-amber-700",
        },
        RADIOLOGY: {
            bar: "from-cyan-500/75 via-sky-500/55 to-indigo-400/35",
            chip: "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(34,211,238,0.50)]",
            btn: "bg-sky-600 hover:bg-sky-700",
        },
        "GENERAL MEDICINE": {
            bar: "from-slate-500/70 via-zinc-500/45 to-sky-400/30",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.40)]",
            btn: "bg-slate-900 hover:bg-slate-800",
        },
    }
    return (
        map[d] || {
            bar: "from-slate-500/65 via-slate-400/35 to-sky-400/25",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.30)]",
            btn: "bg-slate-900 hover:bg-slate-800",
        }
    )
}

function fmtDate(d) {
    try {
        return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
        return String(d || "")
    }
}
function fmtTime(d) {
    try {
        return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    } catch {
        return ""
    }
}
function uid(prefix = "EXP") {
    return `${prefix}-${Math.random().toString(16).slice(2, 7).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
}

const DEPARTMENTS = ["ALL", "Common (All)", "General Medicine", "General Surgery", "OBGYN", "Cardiology", "Orthopedics", "ICU", "Pathology/Lab", "Radiology"]

const SHARE_ROLES = ["Doctor", "Nurse", "Receptionist", "Lab Staff", "Radiology Staff", "MRD", "Admin"]
const EXTERNAL_CHANNELS = ["Email", "WhatsApp", "Download Link"]

function demoPatient() {
    return { id: 1, name: "Pavithra S", uhid: "NH-000001", age: 26, gender: "F", phone: "9600457842" }
}
function demoVisits() {
    return [
        { id: "OP-2026-00122", type: "OP", dept: "OBGYN", doctor: "Dr. K. Priya", when: "2026-01-21T03:35:00Z", status: "In Progress" },
        { id: "OP-2026-00118", type: "OP", dept: "General Medicine", doctor: "Dr. R. Kumar", when: "2026-01-20T06:10:00Z", status: "Completed" },
        { id: "IP-2026-00033", type: "IP", dept: "ICU", doctor: "Dr. A. Selvam", when: "2026-01-14T09:00:00Z", status: "Admitted" },
    ]
}
function demoRecords(visitId) {
    const base = [
        {
            id: "REC-00011",
            dept: "OBGYN",
            type: "OPD_NOTE",
            title: "OBGYN OPD Note · LMP/EDD Review",
            updated_at: "2026-01-21T04:10:00Z",
            signed: false,
            confidential: false,
            pages_est: 2,
            attachments: 1,
        },
        {
            id: "REC-00012",
            dept: "OBGYN",
            type: "LAB_RESULT",
            title: "CBC Result · Report",
            updated_at: "2026-01-21T04:30:00Z",
            signed: true,
            confidential: false,
            pages_est: 1,
            attachments: 1,
            abnormal: true,
        },
        {
            id: "REC-00013",
            dept: "OBGYN",
            type: "CONSENT",
            title: "Consent · Procedure",
            updated_at: "2026-01-20T10:10:00Z",
            signed: true,
            confidential: true,
            pages_est: 2,
            attachments: 0,
        },
        {
            id: "REC-00014",
            dept: "ICU",
            type: "PROGRESS_NOTE",
            title: "ICU Progress Note · Day 3",
            updated_at: "2026-01-15T06:10:00Z",
            signed: false,
            confidential: true,
            pages_est: 3,
            attachments: 0,
        },
        {
            id: "REC-00015",
            dept: "Radiology",
            type: "RADIOLOGY_REPORT",
            title: "USG Abdomen · Report",
            updated_at: "2026-01-21T05:05:00Z",
            signed: true,
            confidential: false,
            pages_est: 2,
            attachments: 1,
        },
    ]
    // UI-only: filter records by visit dept as a feel-good demo
    if (!visitId) return base
    if (visitId.startsWith("IP")) return base.filter((r) => ["ICU"].includes(r.dept))
    if (visitId.startsWith("OP-2026-00118")) return base.filter((r) => ["General Medicine", "Radiology"].includes(r.dept) || r.dept === "Common (All)")
    return base.filter((r) => r.dept === "OBGYN" || r.dept === "Radiology" || r.dept === "Common (All)")
}

/** -----------------------------------------------
 * Optional Fullscreen Wrapper (scroll-safe)
 * ----------------------------------------------- */
export function EmrExportReleaseDialog({ open, onOpenChange, patient }) {
    return (
        <Dialog open={!!open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0",
                    "!w-screen !h-[100dvh] !max-w-none",
                    "rounded-none border-0 bg-white/70 p-0 backdrop-blur-xl",
                    "overflow-hidden"
                )}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <DialogHeader className="shrink-0 border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-6">
                        <div className="flex items-center justify-between gap-3">
                            <DialogTitle className="text-base">Export & Release</DialogTitle>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => onOpenChange?.(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">MRD export builder · permissions · audit logs</div>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <EmrExportRelease patient={patient} fullscreen />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

/** -----------------------------------------------
 * Main Page Component
 * ----------------------------------------------- */
export default function EmrExportRelease({ patient: patientProp, fullscreen = false }) {
    const isMobile = useIsMobile(1024)

    const patient = patientProp || demoPatient()
    const visits = useMemo(() => demoVisits(), [])
    const [visitId, setVisitId] = useState(visits?.[0]?.id || "")
    const visit = useMemo(() => visits.find((v) => v.id === visitId) || null, [visits, visitId])

    const allRecords = useMemo(() => demoRecords(visitId), [visitId])

    // filters
    const [q, setQ] = useState("")
    const [dept, setDept] = useState("ALL")
    const [onlySigned, setOnlySigned] = useState(false)
    const [showConfidential, setShowConfidential] = useState(true)

    // selection
    const [selected, setSelected] = useState(() => new Set())
    const selectedCount = selected.size

    // right side tabs
    const [tab, setTab] = useState("BUILDER") // BUILDER | PERMISSIONS | AUDIT

    // Export Builder
    const [bundleName, setBundleName] = useState("")
    const [purpose, setPurpose] = useState("MRD Release")
    const [includeCover, setIncludeCover] = useState(true)
    const [includeIndex, setIncludeIndex] = useState(true)
    const [includeAttachments, setIncludeAttachments] = useState(true)
    const [includeAuditSummary, setIncludeAuditSummary] = useState(false)
    const [watermarkOn, setWatermarkOn] = useState(true)
    const [watermarkText, setWatermarkText] = useState("NUTRYAH · CONFIDENTIAL")
    const [passwordOn, setPasswordOn] = useState(false)
    const [password, setPassword] = useState("")
    const [maskPHI, setMaskPHI] = useState(false) // UI-only
    const [notes, setNotes] = useState("")

    // Permissions
    const [internalRoles, setInternalRoles] = useState(() => new Set(["MRD"]))
    const [externalChannels, setExternalChannels] = useState(() => new Set(["Email"]))
    const [expiryDays, setExpiryDays] = useState(7)
    const [requireOtp, setRequireOtp] = useState(false)
    const [allowDownload, setAllowDownload] = useState(true)
    const [allowPrint, setAllowPrint] = useState(false)
    const [allowForward, setAllowForward] = useState(false)

    // Output
    const [bundle, setBundle] = useState(null) // {id, created_at, pages, size_est, status}
    const [released, setReleased] = useState(false)

    // Audit logs
    const [audit, setAudit] = useState(() => [
        { at: new Date().toISOString(), by: "System", action: "Opened Export & Release", meta: "UI only" },
    ])

    const tone = deptTone(visit?.dept || "General Medicine")

    // Init name
    useEffect(() => {
        const defaultName = `MRD_${patient.uhid}_${(visit?.id || "VISIT").replaceAll("-", "")}_${new Date().toISOString().slice(0, 10)}`
        setBundleName((p) => p || defaultName)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visit?.id])

    // Clear selection when visit changes
    useEffect(() => {
        setSelected(new Set())
        setBundle(null)
        setReleased(false)
        addAudit("Changed Visit", visitId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitId])

    function addAudit(action, meta) {
        setAudit((p) => [{ at: new Date().toISOString(), by: "You", action, meta: meta || "" }, ...p])
    }

    const filteredRecords = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        let x = [...allRecords]

        if (dept !== "ALL") x = x.filter((r) => (r.dept || "").toUpperCase() === dept.toUpperCase())
        if (onlySigned) x = x.filter((r) => !!r.signed)
        if (!showConfidential) x = x.filter((r) => !r.confidential)

        if (qq) {
            x = x.filter((r) => {
                const hay = `${r.id} ${r.title} ${r.type} ${r.dept}`.toLowerCase()
                return hay.includes(qq)
            })
        }
        // sort latest updated
        x.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        return x
    }, [allRecords, q, dept, onlySigned, showConfidential])

    const selectedRows = useMemo(() => allRecords.filter((r) => selected.has(r.id)), [allRecords, selected])

    const selectedPages = useMemo(() => {
        let pages = selectedRows.reduce((s, r) => s + Number(r.pages_est || 0), 0)
        if (includeCover) pages += 1
        if (includeIndex) pages += 1
        if (includeAuditSummary) pages += 1
        return pages
    }, [selectedRows, includeCover, includeIndex, includeAuditSummary])

    const selectedAttachments = useMemo(() => selectedRows.reduce((s, r) => s + Number(r.attachments || 0), 0), [selectedRows])

    const hasConfidentialSelected = useMemo(() => selectedRows.some((r) => r.confidential), [selectedRows])
    const hasUnsignedSelected = useMemo(() => selectedRows.some((r) => !r.signed), [selectedRows])
    const hasAbnormalSelected = useMemo(() => selectedRows.some((r) => !!r.abnormal), [selectedRows])

    function toggleSelect(id) {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAllVisible() {
        setSelected((prev) => {
            const next = new Set(prev)
            filteredRecords.forEach((r) => next.add(r.id))
            return next
        })
        toast.success("Selected all visible records")
    }

    function clearSelection() {
        setSelected(new Set())
        toast.success("Selection cleared")
    }

    function clearFilters() {
        setQ("")
        setDept("ALL")
        setOnlySigned(false)
        setShowConfidential(true)
        toast.success("Filters reset")
    }

    function validateBuild() {
        if (!visitId) return "Choose a visit"
        if (!selectedCount) return "Select at least one record"
        if (!bundleName.trim() || bundleName.trim().length < 3) return "Bundle name is required (min 3 chars)"
        if (passwordOn && (!password || password.length < 6)) return "Password must be at least 6 characters"
        return null
    }

    function buildBundle() {
        const err = validateBuild()
        if (err) return toast.error(err)

        const id = uid("EXP")
        const sizeEstMb = Math.max(0.3, (selectedPages * 0.18) + (includeAttachments ? selectedAttachments * 0.35 : 0)).toFixed(1)
        const obj = {
            id,
            created_at: new Date().toISOString(),
            name: bundleName.trim(),
            pages: selectedPages,
            size_est_mb: sizeEstMb,
            status: "READY",
        }
        setBundle(obj)
        setReleased(false)
        toast.success("Bundle generated (UI only)")
        addAudit("Built Export Bundle", `${obj.id} · ${obj.pages} pages · ~${obj.size_est_mb}MB`)
    }

    function releaseBundle(channel) {
        if (!bundle) return toast.error("Generate bundle first")
        setReleased(true)
        toast.success(`Released via ${channel} (UI only)`)
        addAudit("Released Export", `${bundle.id} via ${channel}`)
    }

    function downloadBundle() {
        if (!bundle) return toast.error("Generate bundle first")
        toast.success("Download started (UI only)")
        addAudit("Downloaded Bundle", bundle.id)
    }

    function resetAll() {
        clearFilters()
        clearSelection()
        setBundle(null)
        setReleased(false)
        setTab("BUILDER")
        setPurpose("MRD Release")
        setIncludeCover(true)
        setIncludeIndex(true)
        setIncludeAttachments(true)
        setIncludeAuditSummary(false)
        setWatermarkOn(true)
        setWatermarkText("NUTRYAH · CONFIDENTIAL")
        setPasswordOn(false)
        setPassword("")
        setMaskPHI(false)
        setNotes("")
        setInternalRoles(new Set(["MRD"]))
        setExternalChannels(new Set(["Email"]))
        setExpiryDays(7)
        setRequireOtp(false)
        setAllowDownload(true)
        setAllowPrint(false)
        setAllowForward(false)
        toast.success("Reset done")
        addAudit("Reset Export Builder", "UI only")
    }

    // Mobile: open right pane in dialog
    const [mobilePaneOpen, setMobilePaneOpen] = useState(false)

    return (
        <div className="min-h-[100dvh] w-full bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60">
            {/* Sticky header */}
            <div className={cn("sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur-xl", fullscreen ? "" : "")}>
                <div className="mx-auto w-full max-w-[1500px] px-4 py-3 md:px-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className={cn("h-2.5 w-2.5 rounded-full bg-gradient-to-r", tone.bar)} />
                                <div className="text-[15px] font-semibold text-slate-900">Export & Release</div>
                                <Badge variant="outline" className="rounded-xl">
                                    MRD / Sharing
                                </Badge>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Bundle PDF export · permissions · audit trail
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={resetAll}>
                                <X className="mr-2 h-4 w-4" /> Reset
                            </Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => toast("Refresh (wire API later)")}>
                                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                            </Button>
                            {isMobile ? (
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={() => setMobilePaneOpen(true)}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Builder
                                </Button>
                            ) : (
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={buildBundle}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Generate Bundle
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Patient + Visit bar */}
                    <div className="mt-3 rounded-3xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_360px]">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900">
                                        {patient.name} <span className="text-slate-500">({patient.uhid})</span>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {patient.age} / {patient.gender} · {patient.phone}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={cn("rounded-xl", tone.chip)}>
                                        <Building2 className="mr-1 h-3.5 w-3.5" />
                                        {visit?.dept || "—"}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-xl">
                                        <Layers className="mr-1 h-3.5 w-3.5" />
                                        {visit?.type || "—"} · {visit?.id || "—"}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                                <select
                                    value={visitId}
                                    onChange={(e) => setVisitId(e.target.value)}
                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                >
                                    {visits.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.type} · {v.id} · {v.dept}
                                        </option>
                                    ))}
                                </select>

                                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <Calendar className="h-4 w-4" />
                                        {visit ? fmtDate(visit.when) : "—"}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <Clock3 className="h-4 w-4" />
                                        {visit ? fmtTime(visit.when) : "—"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile quick stats */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Pill icon={ListChecks} label="Selected" value={selectedCount} />
                        <Pill icon={FileText} label="Pages" value={selectedPages} />
                        <Pill icon={Paperclip} label="Attach" value={includeAttachments ? selectedAttachments : 0} />
                        {bundle ? (
                            <Pill icon={FileDown} label="Bundle" value={bundle.status} toneClass="bg-emerald-50 text-emerald-700 ring-emerald-200" />
                        ) : (
                            <Pill icon={FileDown} label="Bundle" value="Not built" />
                        )}
                    </div>
                </div>
            </div>

            {/* Main body */}
            <div className="mx-auto w-full max-w-[1500px] px-4 py-4 md:px-6">
                <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[520px_1fr]">
                    {/* Left: Records selection */}
                    <Card className="min-h-0 rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
                        <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">Export Builder</CardTitle>
                                    <div className="mt-1 text-xs text-slate-500">Pick records to include in the PDF bundle.</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="rounded-xl">
                                        {filteredRecords.length} records
                                    </Badge>
                                    <Badge className="rounded-xl bg-slate-900 text-white">
                                        <ListChecks className="mr-1 h-3.5 w-3.5" />
                                        {selectedCount}
                                    </Badge>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_170px_170px]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                    <Input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search record title / type / dept…"
                                        className="h-10 rounded-2xl pl-9"
                                    />
                                </div>

                                <select
                                    value={dept}
                                    onChange={(e) => setDept(e.target.value)}
                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                >
                                    {DEPARTMENTS.map((d) => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>

                                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Signed only
                                    </div>
                                    <Switch checked={onlySigned} onCheckedChange={(v) => setOnlySigned(!!v)} />
                                </div>
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr]">
                                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        {showConfidential ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        Confidential
                                    </div>
                                    <Switch checked={showConfidential} onCheckedChange={(v) => setShowConfidential(!!v)} />
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Button variant="outline" className="h-10 rounded-2xl" onClick={clearFilters}>
                                        <X className="mr-2 h-4 w-4" /> Clear
                                    </Button>
                                    <Button variant="outline" className="h-10 rounded-2xl" onClick={selectAllVisible} disabled={!filteredRecords.length}>
                                        <Plus className="mr-2 h-4 w-4" /> Select All
                                    </Button>
                                    <Button variant="outline" className="h-10 rounded-2xl" onClick={clearSelection} disabled={!selectedCount}>
                                        Unselect
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="min-h-0">
                            <div className="max-h-[calc(100dvh-430px)] min-h-[260px] overflow-y-auto pr-1 lg:max-h-[calc(100dvh-360px)]">
                                <div className="space-y-2">
                                    {filteredRecords.map((r) => (
                                        <RecordRow
                                            key={r.id}
                                            row={r}
                                            checked={selected.has(r.id)}
                                            onToggle={() => toggleSelect(r.id)}
                                        />
                                    ))}

                                    {!filteredRecords.length ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                                            <div className="text-sm font-semibold text-slate-800">No records found</div>
                                            <div className="mt-1 text-xs text-slate-500">Try clearing filters/search.</div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Warnings */}
                            <div className="mt-4 space-y-2">
                                {hasUnsignedSelected ? (
                                    <Warn tone="amber" icon={AlertTriangle} title="Unsigned records selected" desc="MRD export usually requires signed documents. You can still export (config policy later)." />
                                ) : null}
                                {hasConfidentialSelected ? (
                                    <Warn tone="rose" icon={Lock} title="Confidential records included" desc="Make sure permissions and watermark/password are enabled before release." />
                                ) : null}
                                {hasAbnormalSelected ? (
                                    <Warn tone="indigo" icon={AlertTriangle} title="Abnormal results present" desc="Consider adding audit summary for medico-legal clarity." />
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right: Builder / Permissions / Audit (desktop) */}
                    <div className="hidden min-h-0 lg:block">
                        <RightPane
                            tab={tab}
                            setTab={setTab}
                            tone={tone}
                            patient={patient}
                            visit={visit}
                            selectedRows={selectedRows}
                            selectedCount={selectedCount}
                            selectedPages={selectedPages}
                            selectedAttachments={selectedAttachments}
                            builder={{
                                bundleName,
                                setBundleName,
                                purpose,
                                setPurpose,
                                includeCover,
                                setIncludeCover,
                                includeIndex,
                                setIncludeIndex,
                                includeAttachments,
                                setIncludeAttachments,
                                includeAuditSummary,
                                setIncludeAuditSummary,
                                watermarkOn,
                                setWatermarkOn,
                                watermarkText,
                                setWatermarkText,
                                passwordOn,
                                setPasswordOn,
                                password,
                                setPassword,
                                maskPHI,
                                setMaskPHI,
                                notes,
                                setNotes,
                            }}
                            perms={{
                                internalRoles,
                                setInternalRoles,
                                externalChannels,
                                setExternalChannels,
                                expiryDays,
                                setExpiryDays,
                                requireOtp,
                                setRequireOtp,
                                allowDownload,
                                setAllowDownload,
                                allowPrint,
                                setAllowPrint,
                                allowForward,
                                setAllowForward,
                            }}
                            bundle={bundle}
                            released={released}
                            onBuild={buildBundle}
                            onDownload={downloadBundle}
                            onRelease={releaseBundle}
                            audit={audit}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Right Pane (full-screen dialog with scroll) */}
            <Dialog open={mobilePaneOpen} onOpenChange={setMobilePaneOpen}>
                <DialogContent
                    className={cn(
                        "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0",
                        "!w-screen !h-[100dvh] !max-w-none",
                        "rounded-none border-0 bg-white/70 p-0 backdrop-blur-xl",
                        "overflow-hidden"
                    )}
                >
                    <div className="flex h-full min-h-0 flex-col">
                        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl">
                            <div className="flex items-center justify-between gap-3">
                                <DialogTitle className="text-base">Export Builder</DialogTitle>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => setMobilePaneOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Build · permissions · audit</div>
                        </DialogHeader>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4">
                            <RightPane
                                tab={tab}
                                setTab={setTab}
                                tone={tone}
                                patient={patient}
                                visit={visit}
                                selectedRows={selectedRows}
                                selectedCount={selectedCount}
                                selectedPages={selectedPages}
                                selectedAttachments={selectedAttachments}
                                builder={{
                                    bundleName,
                                    setBundleName,
                                    purpose,
                                    setPurpose,
                                    includeCover,
                                    setIncludeCover,
                                    includeIndex,
                                    setIncludeIndex,
                                    includeAttachments,
                                    setIncludeAttachments,
                                    includeAuditSummary,
                                    setIncludeAuditSummary,
                                    watermarkOn,
                                    setWatermarkOn,
                                    watermarkText,
                                    setWatermarkText,
                                    passwordOn,
                                    setPasswordOn,
                                    password,
                                    setPassword,
                                    maskPHI,
                                    setMaskPHI,
                                    notes,
                                    setNotes,
                                }}
                                perms={{
                                    internalRoles,
                                    setInternalRoles,
                                    externalChannels,
                                    setExternalChannels,
                                    expiryDays,
                                    setExpiryDays,
                                    requireOtp,
                                    setRequireOtp,
                                    allowDownload,
                                    setAllowDownload,
                                    allowPrint,
                                    setAllowPrint,
                                    allowForward,
                                    setAllowForward,
                                }}
                                bundle={bundle}
                                released={released}
                                onBuild={buildBundle}
                                onDownload={downloadBundle}
                                onRelease={releaseBundle}
                                audit={audit}
                                compact
                            />
                        </div>

                        <div className="shrink-0 border-t border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl">
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="outline" className="rounded-2xl" onClick={() => setMobilePaneOpen(false)}>
                                    Close
                                </Button>
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={buildBundle}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Generate Bundle
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

/** -----------------------------------------------
 * Right Pane (Builder / Permissions / Audit)
 * ----------------------------------------------- */
function RightPane({
    tab,
    setTab,
    tone,
    patient,
    visit,
    selectedRows,
    selectedCount,
    selectedPages,
    selectedAttachments,
    builder,
    perms,
    bundle,
    released,
    onBuild,
    onDownload,
    onRelease,
    audit,
    compact = false,
}) {
    const {
        bundleName,
        setBundleName,
        purpose,
        setPurpose,
        includeCover,
        setIncludeCover,
        includeIndex,
        setIncludeIndex,
        includeAttachments,
        setIncludeAttachments,
        includeAuditSummary,
        setIncludeAuditSummary,
        watermarkOn,
        setWatermarkOn,
        watermarkText,
        setWatermarkText,
        passwordOn,
        setPasswordOn,
        password,
        setPassword,
        maskPHI,
        setMaskPHI,
        notes,
        setNotes,
    } = builder

    const {
        internalRoles,
        setInternalRoles,
        externalChannels,
        setExternalChannels,
        expiryDays,
        setExpiryDays,
        requireOtp,
        setRequireOtp,
        allowDownload,
        setAllowDownload,
        allowPrint,
        setAllowPrint,
        allowForward,
        setAllowForward,
    } = perms

    return (
        <Card className={cn("min-h-0 rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
            <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
            <CardHeader className={cn("pb-2", compact ? "px-0" : "")}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-base">Release Center</CardTitle>
                        <div className="mt-1 text-xs text-slate-500">Configure export · permissions · audit logs</div>
                    </div>

                    <Badge className={cn("rounded-xl", tone.chip)}>
                        <Building2 className="mr-1 h-3.5 w-3.5" />
                        {visit?.dept || "—"}
                    </Badge>
                </div>

                <div className="mt-3">
                    <Tabs value={tab} onValueChange={setTab}>
                        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <TabsList className="w-max min-w-full justify-start gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                                <TabsTrigger value="BUILDER" className="whitespace-nowrap rounded-xl">
                                    Builder
                                </TabsTrigger>
                                <TabsTrigger value="PERMISSIONS" className="whitespace-nowrap rounded-xl">
                                    Permissions
                                </TabsTrigger>
                                <TabsTrigger value="AUDIT" className="whitespace-nowrap rounded-xl">
                                    Audit
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </Tabs>
                </div>
            </CardHeader>

            <CardContent className={cn("min-h-0 space-y-4", compact ? "px-0" : "")}>
                {/* Summary card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-xl">
                            <Layers className="mr-1 h-3.5 w-3.5" /> {visit?.type || "—"} · {visit?.id || "—"}
                        </Badge>
                        <Badge variant="outline" className="rounded-xl">
                            <Calendar className="mr-1 h-3.5 w-3.5" /> {visit ? fmtDate(visit.when) : "—"}
                        </Badge>
                        <Badge variant="outline" className="rounded-xl">
                            <Clock3 className="mr-1 h-3.5 w-3.5" /> {visit ? fmtTime(visit.when) : "—"}
                        </Badge>
                        <Badge className="rounded-xl bg-slate-900 text-white">
                            <ListChecks className="mr-1 h-3.5 w-3.5" /> {selectedCount} selected
                        </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <MiniStat icon={FileText} label="Pages" value={selectedPages} />
                        <MiniStat icon={Paperclip} label="Attachments" value={includeAttachments ? selectedAttachments : 0} />
                        <MiniStat icon={Shield} label="Purpose" value={purpose || "—"} />
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                        Patient: <span className="font-semibold text-slate-700">{patient.name}</span> ({patient.uhid})
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {tab === "BUILDER" ? (
                        <motion.div
                            key="builder"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="space-y-4"
                        >
                            <Card className="rounded-3xl border-slate-200 bg-white">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Bundle Settings</CardTitle>
                                    <div className="text-xs text-slate-500">PDF bundle config (UI only)</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <Field label="Bundle name *" hint="Used for MRD export filename">
                                            <Input value={bundleName} onChange={(e) => setBundleName(e.target.value)} className="h-10 rounded-2xl" />
                                        </Field>

                                        <Field label="Purpose" hint="Shown in audit logs and cover page">
                                            <select
                                                value={purpose}
                                                onChange={(e) => setPurpose(e.target.value)}
                                                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                            >
                                                <option>MRD Release</option>
                                                <option>Insurance Submission</option>
                                                <option>Referral Sharing</option>
                                                <option>Patient Copy</option>
                                            </select>
                                        </Field>
                                    </div>

                                    <Separator />

                                    <ToggleCard
                                        icon={FileText}
                                        title="Cover page"
                                        desc="Patient + visit summary cover"
                                        checked={includeCover}
                                        onCheckedChange={setIncludeCover}
                                    />
                                    <ToggleCard
                                        icon={ListChecks}
                                        title="Index page"
                                        desc="Record list with page mapping"
                                        checked={includeIndex}
                                        onCheckedChange={setIncludeIndex}
                                    />
                                    <ToggleCard
                                        icon={Paperclip}
                                        title="Include attachments"
                                        desc="Append uploaded PDFs/images"
                                        checked={includeAttachments}
                                        onCheckedChange={setIncludeAttachments}
                                    />
                                    <ToggleCard
                                        icon={History}
                                        title="Audit summary page"
                                        desc="Add audit summary into PDF"
                                        checked={includeAuditSummary}
                                        onCheckedChange={setIncludeAuditSummary}
                                    />

                                    <Separator />

                                    <ToggleCard
                                        icon={Shield}
                                        title="Watermark"
                                        desc="Watermark on every page"
                                        checked={watermarkOn}
                                        onCheckedChange={setWatermarkOn}
                                        right={
                                            <Input
                                                value={watermarkText}
                                                onChange={(e) => setWatermarkText(e.target.value)}
                                                className="h-10 rounded-2xl"
                                                placeholder="Watermark text…"
                                                disabled={!watermarkOn}
                                            />
                                        }
                                    />

                                    <ToggleCard
                                        icon={KeyRound}
                                        title="Password protect"
                                        desc="Encrypt PDF bundle"
                                        checked={passwordOn}
                                        onCheckedChange={setPasswordOn}
                                        right={
                                            <Input
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="h-10 rounded-2xl"
                                                placeholder="Min 6 chars…"
                                                disabled={!passwordOn}
                                                type="password"
                                            />
                                        }
                                    />

                                    <ToggleCard
                                        icon={EyeOff}
                                        title="Mask PHI (preview)"
                                        desc="UI-only toggle for future redaction"
                                        checked={maskPHI}
                                        onCheckedChange={setMaskPHI}
                                    />

                                    <div>
                                        <div className="mb-1 text-xs font-semibold text-slate-700">Internal Notes (optional)</div>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={4}
                                            className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-300"
                                            placeholder="Notes visible in audit & MRD release context…"
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <Button className={cn("rounded-2xl", tone.btn)} onClick={onBuild} disabled={!selectedCount}>
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Generate Bundle
                                        </Button>

                                        <Button variant="outline" className="rounded-2xl" onClick={onDownload} disabled={!bundle}>
                                            <Download className="mr-2 h-4 w-4" />
                                            Download
                                        </Button>
                                    </div>

                                    {bundle ? (
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span className="font-semibold">Bundle ready:</span> {bundle.name} · {bundle.pages} pages · ~{bundle.size_est_mb}MB
                                            </div>
                                            <div className="mt-1 text-xs text-emerald-800">ID: {bundle.id} · Created {fmtDate(bundle.created_at)} {fmtTime(bundle.created_at)}</div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                                            <div className="text-sm font-semibold text-slate-800">No bundle yet</div>
                                            <div className="mt-1 text-xs text-slate-500">Select records and generate bundle.</div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Release actions */}
                            <Card className="rounded-3xl border-slate-200 bg-white">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Release</CardTitle>
                                    <div className="text-xs text-slate-500">Share/export actions (UI only)</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        <ActionBtn disabled={!bundle} onClick={() => onRelease("MRD")} icon={Shield} tone={tone} title="MRD Release" desc="Issue official MRD copy" />
                                        <ActionBtn disabled={!bundle} onClick={() => onRelease("Email")} icon={Share2} tone={tone} title="Email" desc="Send to recipient" />
                                        <ActionBtn disabled={!bundle} onClick={() => onRelease("WhatsApp")} icon={Share2} tone={tone} title="WhatsApp" desc="Share link/message" />
                                    </div>

                                    {released ? (
                                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Released successfully (UI only)
                                            </div>
                                            <div className="mt-1 text-xs text-indigo-800">Audit updated automatically.</div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : null}

                    {tab === "PERMISSIONS" ? (
                        <motion.div
                            key="perms"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="space-y-4"
                        >
                            <Card className="rounded-3xl border-slate-200 bg-white">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Access Controls</CardTitle>
                                    <div className="text-xs text-slate-500">Who can view/download this export</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="rounded-3xl border border-slate-200 bg-white p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">Internal Roles</div>
                                                <div className="text-xs text-slate-500">Allowed roles inside hospital</div>
                                            </div>
                                            <Badge variant="outline" className="rounded-xl">
                                                {internalRoles.size}
                                            </Badge>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {SHARE_ROLES.map((r) => {
                                                const active = internalRoles.has(r)
                                                return (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => {
                                                            setInternalRoles((prev) => {
                                                                const next = new Set(prev)
                                                                if (next.has(r)) next.delete(r)
                                                                else next.add(r)
                                                                return next
                                                            })
                                                        }}
                                                        className={cn(
                                                            "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
                                                            active
                                                                ? "bg-slate-900 text-white ring-slate-900"
                                                                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Users className="mr-1 inline h-3.5 w-3.5" />
                                                        {r}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 bg-white p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">External Channels</div>
                                                <div className="text-xs text-slate-500">How the bundle can be shared</div>
                                            </div>
                                            <Badge variant="outline" className="rounded-xl">
                                                {externalChannels.size}
                                            </Badge>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {EXTERNAL_CHANNELS.map((c) => {
                                                const active = externalChannels.has(c)
                                                return (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => {
                                                            setExternalChannels((prev) => {
                                                                const next = new Set(prev)
                                                                if (next.has(c)) next.delete(c)
                                                                else next.add(c)
                                                                return next
                                                            })
                                                        }}
                                                        className={cn(
                                                            "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
                                                            active
                                                                ? "bg-slate-900 text-white ring-slate-900"
                                                                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Share2 className="mr-1 inline h-3.5 w-3.5" />
                                                        {c}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <Separator />

                                    <ToggleCard
                                        icon={Download}
                                        title="Allow download"
                                        desc="Recipient can download the file"
                                        checked={allowDownload}
                                        onCheckedChange={setAllowDownload}
                                    />
                                    <ToggleCard
                                        icon={FileDown}
                                        title="Allow print"
                                        desc="Recipient can print the file"
                                        checked={allowPrint}
                                        onCheckedChange={setAllowPrint}
                                    />
                                    <ToggleCard
                                        icon={Share2}
                                        title="Allow forward"
                                        desc="Recipient can forward/share"
                                        checked={allowForward}
                                        onCheckedChange={setAllowForward}
                                    />

                                    <Separator />

                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <Field label="Expiry (days)" hint="Auto revoke access after N days">
                                            <Input
                                                value={String(expiryDays)}
                                                onChange={(e) => {
                                                    const n = Math.max(0, Math.min(365, Number(e.target.value || 0)))
                                                    setExpiryDays(Number.isFinite(n) ? n : 0)
                                                }}
                                                className="h-10 rounded-2xl"
                                                type="number"
                                                min={0}
                                                max={365}
                                            />
                                        </Field>

                                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900">Require OTP</div>
                                                    <div className="text-xs text-slate-500">External access OTP (future)</div>
                                                </div>
                                                <Switch checked={requireOtp} onCheckedChange={(v) => setRequireOtp(!!v)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                                        <div className="flex items-start gap-2">
                                            <UserPlus className="h-4 w-4" />
                                            Configure user-specific permissions in backend later (users, tokens, consent).
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : null}

                    {tab === "AUDIT" ? (
                        <motion.div
                            key="audit"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="space-y-4"
                        >
                            <Card className="rounded-3xl border-slate-200 bg-white">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Audit Logs</CardTitle>
                                    <div className="text-xs text-slate-500">Every export/release event is recorded</div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="max-h-[520px] overflow-y-auto pr-1">
                                        {audit?.length ? (
                                            <div className="space-y-2">
                                                {audit.map((a, idx) => (
                                                    <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge className="rounded-xl bg-slate-900 text-white">
                                                                    <History className="mr-1 h-3.5 w-3.5" />
                                                                    {a.action}
                                                                </Badge>
                                                                <Badge variant="outline" className="rounded-xl">
                                                                    {a.by}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                {fmtDate(a.at)} · {fmtTime(a.at)}
                                                            </div>
                                                        </div>

                                                        {a.meta ? (
                                                            <div className="mt-2 text-xs text-slate-600">{a.meta}</div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                                                <div className="text-sm font-semibold text-slate-800">No audit entries</div>
                                                <div className="mt-1 text-xs text-slate-500">Build or release to generate logs.</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-700">
                                        Tip: On backend, store audit events with user_id, ip, device, consent_ref, and document hash.
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </CardContent>
        </Card>
    )
}

/** -----------------------------------------------
 * Small UI components
 * ----------------------------------------------- */
function Pill({ icon: Icon, label, value, toneClass }) {
    const cls = toneClass || "bg-slate-50 text-slate-700 ring-slate-200"
    return (
        <div className={cn("inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ring-1", cls)}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <span className="ml-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-slate-900 ring-1 ring-slate-200">{value}</span>
        </div>
    )
}

function RecordRow({ row, checked, onToggle }) {
    const tone = deptTone(row.dept)
    return (
        <button
            type="button"
            onClick={onToggle}
            className={cn(
                "w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition",
                checked ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
            )}
        >
            <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
            <div className={cn("p-4", checked ? tone.glow : "")}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                "mt-0.5 grid h-9 w-9 place-items-center rounded-2xl ring-1",
                                checked ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200"
                            )}
                            aria-hidden="true"
                        >
                            {checked ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">+</span>}
                        </div>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn("rounded-xl", tone.chip)}>
                                    <Building2 className="mr-1 h-3.5 w-3.5" />
                                    {row.dept}
                                </Badge>
                                <Badge variant="outline" className="rounded-xl">
                                    <FileText className="mr-1 h-3.5 w-3.5" />
                                    {row.type}
                                </Badge>
                                {row.confidential ? (
                                    <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                        <Lock className="mr-1 h-3.5 w-3.5" /> Confidential
                                    </Badge>
                                ) : null}
                                {row.abnormal ? (
                                    <Badge className="rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                                        <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Abnormal
                                    </Badge>
                                ) : null}
                            </div>

                            <div className="mt-2 truncate text-sm font-semibold text-slate-900">{row.title}</div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" /> {fmtDate(row.updated_at)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Clock3 className="h-3.5 w-3.5" /> {fmtTime(row.updated_at)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" /> {row.pages_est} page(s)
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Paperclip className="h-3.5 w-3.5" /> {row.attachments} attach
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge className={cn("rounded-xl", row.signed ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200")}>
                            {row.signed ? "Signed" : "Draft"}
                        </Badge>
                    </div>
                </div>
            </div>
        </button>
    )
}

function MiniStat({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                    <Icon className="h-4 w-4 text-slate-700" />
                </div>
                <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700">{label}</div>
                    <div className="truncate text-sm font-semibold text-slate-900">{String(value)}</div>
                </div>
            </div>
        </div>
    )
}

function Field({ label, hint, children }) {
    return (
        <div>
            <div className="mb-1 text-xs font-semibold text-slate-700">{label}</div>
            {children}
            {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
    )
}

function ToggleCard({ icon: Icon, title, desc, checked, onCheckedChange, right }) {
    return (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                    <Icon className="h-5 w-5 text-slate-700" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
                </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                {right ? <div className="min-w-[220px]">{right}</div> : null}
                <Switch checked={!!checked} onCheckedChange={(v) => onCheckedChange?.(!!v)} />
            </div>
        </div>
    )
}

function ActionBtn({ disabled, onClick, icon: Icon, tone, title, desc }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition",
                disabled ? "cursor-not-allowed opacity-60" : "hover:border-slate-300",
                "border-slate-200"
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn("grid h-11 w-11 place-items-center rounded-3xl ring-1 ring-slate-200", disabled ? "bg-slate-50 text-slate-600" : "bg-slate-900 text-white ring-slate-900")}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <div className="mt-1 text-xs text-slate-500">{desc}</div>
                    {disabled ? (
                        <div className="mt-2 text-xs text-slate-500">Generate bundle first</div>
                    ) : (
                        <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <span className={cn("h-1.5 w-1.5 rounded-full bg-gradient-to-r", tone.bar)} />
                            Ready
                        </div>
                    )}
                </div>
            </div>
        </button>
    )
}

function Warn({ tone = "amber", icon: Icon, title, desc }) {
    const map = {
        amber: "border-amber-200 bg-amber-50 text-amber-900",
        rose: "border-rose-200 bg-rose-50 text-rose-900",
        indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    }
    return (
        <div className={cn("flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm", map[tone] || map.amber)}>
            <Icon className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">
                <div className="text-sm font-semibold">{title}</div>
                <div className="mt-0.5 text-xs opacity-90">{desc}</div>
            </div>
        </div>
    )
}
