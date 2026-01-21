// FILE: frontend/src/emr/new/EmrPatientChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Search,
    UserRound,
    Calendar,
    Filter,
    X,
    Clock3,
    FileText,
    Stethoscope,
    Pill,
    TestTube2,
    ScanLine,
    ClipboardList,
    ShieldCheck,
    Download,
    PenLine,
    CheckCircle2,
    AlertTriangle,
    Layers,
    Building2,
    Hash,
} from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { EmrCreateRecordDialog } from "./EmrCreateRecordFlow"

/**
 * ✅ Drop-in EMR Patient Chart (Main Hub)
 * - Search patient (UHID/Name/Phone)
 * - Patient header
 * - Timeline (grouped by day)
 * - Filters
 * - Preview pane (desktop) + Preview modal (mobile)
 *
 * Integrate API:
 * 1) Replace mockSearchPatients(q) with backend search
 * 2) Replace mockFetchRecords(patientId) with backend fetch
 */

const ENCOUNTERS = ["ALL", "OP", "IP", "ER", "OT"]
const STATUSES = ["ALL", "DRAFT", "SIGNED", "FINAL", "VOID"]
const TYPES = [
    "ALL",
    "OPD_NOTE",
    "PROGRESS_NOTE",
    "PRESCRIPTION",
    "LAB_RESULT",
    "RADIOLOGY_REPORT",
    "CONSENT",
    "DISCHARGE_SUMMARY",
    "NURSING_NOTE",
    "EXTERNAL_DOCUMENT",
]

/** Departments derived from your uploaded department-wise case sheet list (canonicalized) */
const DEPARTMENTS = [
    "ALL",
    "Common (All)",
    "Anaesthesiology",
    "Cardiology",
    "CVTS",
    "Cosmetology",
    "Dentistry",
    "Dermatology",
    "Diabetology",
    "ENT",
    "General Medicine",
    "General Surgery",
    "Gastroenterology",
    "GI Surgery",
    "ICU",
    "IVF",
    "Nephrology",
    "Neurology",
    "Neurosurgery",
    "OBGYN",
    "Oncology",
    "Ophthalmology",
    "Orthopedics",
    "Paediatrics",
    "Pathology/Lab",
    "Physiotherapy",
    "Psychiatry",
    "Pulmonology",
    "Urology",
    "Vascular Surgery",
]

/** “Apple premium” multi-tone styles by department */
function deptTone(deptRaw) {
    const d = (deptRaw || "").toUpperCase()
    const map = {
        "OBGYN": {
            bar: "from-pink-500/70 via-rose-500/60 to-orange-400/50",
            chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(244,63,94,0.45)]",
        },
        "CARDIOLOGY": {
            bar: "from-red-500/70 via-rose-500/60 to-amber-400/40",
            chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(239,68,68,0.45)]",
        },
        "ICU": {
            bar: "from-indigo-500/70 via-blue-500/55 to-cyan-400/45",
            chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(99,102,241,0.45)]",
        },
        "ORTHOPEDICS": {
            bar: "from-emerald-500/65 via-teal-500/55 to-lime-400/40",
            chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(16,185,129,0.45)]",
        },
        "DERMATOLOGY": {
            bar: "from-fuchsia-500/60 via-pink-500/50 to-amber-400/35",
            chip: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(217,70,239,0.45)]",
        },
        "PATHOLOGY/LAB": {
            bar: "from-amber-500/60 via-yellow-500/50 to-orange-400/40",
            chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(245,158,11,0.45)]",
        },
        "UROLOGY": {
            bar: "from-sky-500/60 via-cyan-500/55 to-emerald-400/40",
            chip: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(14,165,233,0.45)]",
        },
        "NEUROLOGY": {
            bar: "from-violet-500/60 via-indigo-500/55 to-sky-400/40",
            chip: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(139,92,246,0.45)]",
        },
        "GENERAL MEDICINE": {
            bar: "from-slate-500/55 via-zinc-500/45 to-sky-400/35",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(100,116,139,0.35)]",
        },
    }
    return map[d] || {
        bar: "from-slate-500/55 via-slate-400/35 to-sky-400/25",
        chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
        glow: "shadow-[0_20px_70px_-35px_rgba(100,116,139,0.28)]",
    }
}

function statusPill(st) {
    const s = (st || "").toUpperCase()
    if (s === "SIGNED") return { cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", icon: CheckCircle2 }
    if (s === "FINAL") return { cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200", icon: CheckCircle2 }
    if (s === "DRAFT") return { cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200", icon: PenLine }
    if (s === "VOID") return { cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", icon: AlertTriangle }
    return { cls: "bg-slate-50 text-slate-700 ring-1 ring-slate-200", icon: FileText }
}

function typeMeta(t) {
    const x = (t || "").toUpperCase()
    const map = {
        OPD_NOTE: { label: "OPD Note", icon: Stethoscope },
        PROGRESS_NOTE: { label: "Progress Note", icon: ClipboardList },
        PRESCRIPTION: { label: "Prescription", icon: Pill },
        LAB_RESULT: { label: "Lab Result", icon: TestTube2 },
        RADIOLOGY_REPORT: { label: "Radiology", icon: ScanLine },
        CONSENT: { label: "Consent", icon: ShieldCheck },
        DISCHARGE_SUMMARY: { label: "Discharge", icon: Layers },
        NURSING_NOTE: { label: "Nursing", icon: ClipboardList },
        EXTERNAL_DOCUMENT: { label: "External Doc", icon: FileText },
    }
    return map[x] || { label: (t || "Record"), icon: FileText }
}

function fmtDate(d) {
    try {
        const dt = new Date(d)
        return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
        return String(d || "")
    }
}

function fmtTime(d) {
    try {
        const dt = new Date(d)
        return dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    } catch {
        return ""
    }
}

function isBetween(dateIso, fromIso, toIso) {
    const v = dateIso ? new Date(dateIso).getTime() : 0
    const f = fromIso ? new Date(fromIso).getTime() : -Infinity
    const t = toIso ? new Date(toIso).getTime() : Infinity
    return v >= f && v <= t
}

function groupLabel(ts) {
    const d = new Date(ts)
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const diffDays = Math.round((start - day) / (24 * 3600 * 1000))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays <= 7) return "This Week"
    return fmtDate(day)
}

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

/** ----------------- MOCK DATA + MOCK API (replace with real API) ----------------- */

const MOCK_PATIENTS = [
    { id: 101, uhid: "NH-000101", name: "Pavithra S", phone: "9600457842", gender: "F", age: 26, blood: "O+", flags: ["Allergy"], lastVisit: "2026-01-18T10:20:00Z" },
    { id: 102, uhid: "NH-000102", name: "Arun K", phone: "9345123456", gender: "M", age: 34, blood: "B+", flags: [], lastVisit: "2026-01-20T07:10:00Z" },
    { id: 103, uhid: "NH-000103", name: "Sangeetha R", phone: "9790012345", gender: "F", age: 29, blood: "A+", flags: ["High Risk"], lastVisit: "2026-01-21T03:35:00Z" },
    { id: 104, uhid: "NH-000104", name: "Karthik V", phone: "9000011111", gender: "M", age: 41, blood: "AB+", flags: ["Diabetic"], lastVisit: "2026-01-14T09:00:00Z" },
    { id: 105, uhid: "NH-000105", name: "Meena L", phone: "8888888888", gender: "F", age: 51, blood: "O-", flags: ["HTN"], lastVisit: "2026-01-11T12:00:00Z" },
]

const MOCK_RECORDS_BY_PATIENT = {
    101: [
        mkRecord("2026-01-21T02:15:00Z", "OPD_NOTE", "OBGYN", "SIGNED", "OP visit · Pelvic pain", "OP", "OP-2026-00121", [
            "Chief complaint: Pelvic pain (3 days)",
            "History: mild fever, no discharge",
            "Exam: tenderness lower abdomen",
            "Plan: USG pelvis, CBC, NSAID",
        ], [{ name: "USG_Pelvis_Request.pdf" }]),
        mkRecord("2026-01-21T03:05:00Z", "LAB_RESULT", "Pathology/Lab", "FINAL", "CBC Result", "OP", "OP-2026-00121", [
            "Hb: 12.1 g/dL",
            "WBC: 11,200 /mm³ (mild high)",
            "Platelets: 2.4 lakh",
        ]),
        mkRecord("2026-01-20T05:40:00Z", "PRESCRIPTION", "OBGYN", "SIGNED", "Rx · Pain management", "OP", "OP-2026-00118", [
            "Tab Ibuprofen 400mg · SOS after food",
            "Cap Pantoprazole 40mg · OD",
            "Review in 2 days",
        ]),
        mkRecord("2026-01-18T10:20:00Z", "RADIOLOGY_REPORT", "OBGYN", "FINAL", "USG Pelvis Report", "OP", "OP-2026-00112", [
            "Uterus: normal size",
            "Ovary: simple cyst ~3.2cm (right)",
            "Impression: benign cyst; follow-up advised",
        ], [{ name: "USG_Pelvis_Report.pdf" }]),
        mkRecord("2026-01-14T09:10:00Z", "CONSENT", "OBGYN", "SIGNED", "Consent · Procedure", "OP", "OP-2026-00102", [
            "Consent captured for minor procedure.",
            "Risks explained; patient understood.",
        ]),
    ],
    102: [
        mkRecord("2026-01-20T07:10:00Z", "OPD_NOTE", "General Medicine", "DRAFT", "OP visit · Fever", "OP", "OP-2026-00119", [
            "Chief complaint: Fever (2 days)",
            "Plan: CBC, Dengue NS1, Paracetamol",
        ]),
        mkRecord("2026-01-20T09:15:00Z", "LAB_RESULT", "Pathology/Lab", "FINAL", "Dengue NS1", "OP", "OP-2026-00119", ["Negative"]),
    ],
    103: [
        mkRecord("2026-01-21T03:35:00Z", "OPD_NOTE", "Cardiology", "SIGNED", "OP visit · Chest discomfort", "OP", "OP-2026-00122", [
            "ECG advised; troponin ordered",
            "Vitals stable; counselled",
        ]),
    ],
    104: [
        mkRecord("2026-01-14T09:00:00Z", "PROGRESS_NOTE", "ICU", "SIGNED", "ICU Day-2 Progress", "IP", "IP-2026-00033", [
            "Stable overnight; oxygen weaned",
            "Continue antibiotics; monitor vitals",
        ]),
    ],
    105: [
        mkRecord("2026-01-11T12:00:00Z", "DISCHARGE_SUMMARY", "General Medicine", "FINAL", "Discharge Summary", "IP", "IP-2026-00021", [
            "Dx: HTN",
            "Meds on discharge: Amlodipine",
            "Follow-up: 1 week",
        ], [{ name: "Discharge_Summary.pdf" }]),
    ],
}

function mkRecord(ts, type, dept, status, title, encounterType, encounterId, lines = [], attachments = []) {
    const id = `${type}-${dept}-${ts}`
    return {
        id,
        ts,
        type,
        dept,
        status,
        title,
        encounterType,
        encounterId,
        author: status === "DRAFT" ? "—" : "Dr. K. Priya",
        summary: (lines || []).slice(0, 2).join(" · "),
        contentLines: lines || [],
        attachments: attachments || [],
    }
}

async function mockSearchPatients(q) {
    await sleep(120)
    const x = (q || "").trim().toLowerCase()
    if (!x) return []
    return MOCK_PATIENTS.filter((p) => {
        const hay = `${p.uhid} ${p.name} ${p.phone}`.toLowerCase()
        return hay.includes(x)
    }).slice(0, 8)
}

async function mockFetchRecords(patientId) {
    await sleep(140)
    return MOCK_RECORDS_BY_PATIENT[patientId] || []
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
}

/** ----------------- PAGE ----------------- */

export default function EmrPatientChart() {
    const isMobile = useIsMobile(1024)
    const navigate = useNavigate()
    // Patient search
    const [q, setQ] = useState("")
    const [searching, setSearching] = useState(false)
    const [results, setResults] = useState([])
    const [dropOpen, setDropOpen] = useState(false)
    const searchBoxRef = useRef(null)
    const [open, setOpen] = useState(false)
    const [patient, setPatient] = useState(null)

    // Records
    const [loadingRecords, setLoadingRecords] = useState(false)
    const [records, setRecords] = useState([])
    const [activeId, setActiveId] = useState(null)

    const patients = {
        id: 101,
        uhid: "NH-000101",
        name: "Pavithra S",
        gender: "F",
        age: 26,
        phone: "9600457842",
    }
    // Preview modal (mobile)
    const [previewOpen, setPreviewOpen] = useState(false)

    // Filters
    const [f, setF] = useState({
        encounter: "ALL",
        dept: "ALL",
        type: "ALL",
        status: "ALL",
        from: "",
        to: "",
        recordQ: "",
    })

    // Close dropdown on outside click
    useEffect(() => {
        const onDown = (e) => {
            if (!searchBoxRef.current) return
            if (!searchBoxRef.current.contains(e.target)) setDropOpen(false)
        }
        window.addEventListener("mousedown", onDown)
        return () => window.removeEventListener("mousedown", onDown)
    }, [])

    // Debounced patient search
    useEffect(() => {
        let alive = true
        const t = setTimeout(async () => {
            const x = (q || "").trim()
            if (!x) {
                setResults([])
                setSearching(false)
                return
            }
            setSearching(true)
            const rows = await mockSearchPatients(x)
            if (!alive) return
            setResults(rows)
            setSearching(false)
            setDropOpen(true)
        }, 250)
        return () => {
            alive = false
            clearTimeout(t)
        }
    }, [q])

    // Load records when patient changes
    useEffect(() => {
        let alive = true
        async function run() {
            if (!patient?.id) {
                setRecords([])
                setActiveId(null)
                return
            }
            setLoadingRecords(true)
            try {
                const rows = await mockFetchRecords(patient.id)
                if (!alive) return
                const sorted = [...rows].sort((a, b) => new Date(b.ts) - new Date(a.ts))
                setRecords(sorted)
                setActiveId(sorted?.[0]?.id || null)
            } catch (e) {
                toast.error("Failed to load EMR records")
            } finally {
                if (alive) setLoadingRecords(false)
            }
        }
        run()
        return () => {
            alive = false
        }
    }, [patient?.id])

    const filtered = useMemo(() => {
        const rq = (f.recordQ || "").trim().toLowerCase()
        return (records || []).filter((r) => {
            if (f.encounter !== "ALL" && (r.encounterType || "").toUpperCase() !== f.encounter) return false
            if (f.dept !== "ALL" && (r.dept || "") !== f.dept) return false
            if (f.type !== "ALL" && (r.type || "").toUpperCase() !== f.type) return false
            if (f.status !== "ALL" && (r.status || "").toUpperCase() !== f.status) return false
            if ((f.from || f.to) && !isBetween(r.ts, f.from || "", f.to || "")) return false
            if (rq) {
                const hay = `${r.title || ""} ${r.summary || ""} ${r.contentLines?.join(" ") || ""} ${r.encounterId || ""}`.toLowerCase()
                if (!hay.includes(rq)) return false
            }
            return true
        })
    }, [records, f])

    const grouped = useMemo(() => {
        const m = new Map()
        for (const r of filtered) {
            const g = groupLabel(r.ts)
            if (!m.has(g)) m.set(g, [])
            m.get(g).push(r)
        }
        // Preserve “Today/Yesterday/This Week” order, then rest by date desc.
        const order = ["Today", "Yesterday", "This Week"]
        const keys = Array.from(m.keys())
        const special = order.filter((k) => m.has(k))
        const rest = keys
            .filter((k) => !order.includes(k))
            .sort((a, b) => {
                // groupLabel returns date string for older; sort by parsing.
                const pa = Date.parse(a)
                const pb = Date.parse(b)
                if (Number.isFinite(pa) && Number.isFinite(pb)) return pb - pa
                return 0
            })
        const out = []
        for (const k of [...special, ...rest]) {
            out.push([k, m.get(k)])
        }
        return out
    }, [filtered])

    const active = useMemo(() => {
        return (filtered || []).find((r) => r.id === activeId) || (filtered?.[0] || null)
    }, [filtered, activeId])

    const kpis = useMemo(() => {
        const total = filtered.length
        const signed = filtered.filter((r) => (r.status || "").toUpperCase() === "SIGNED").length
        const final = filtered.filter((r) => (r.status || "").toUpperCase() === "FINAL").length
        const drafts = filtered.filter((r) => (r.status || "").toUpperCase() === "DRAFT").length
        return { total, signed, final, drafts }
    }, [filtered])

    function pickPatient(p) {
        setPatient(p)
        setQ(`${p.uhid} · ${p.name}`)
        setDropOpen(false)
    }

    function clearFilters() {
        setF({ encounter: "ALL", dept: "ALL", type: "ALL", status: "ALL", from: "", to: "", recordQ: "" })
    }

    function openPreview(r) {
        setActiveId(r.id)
        if (isMobile) setPreviewOpen(true)
    }

    return (
        <div className="min-h-[calc(100vh-0px)] w-full bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60">
            {/* Top App Header */}
            <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
                <div className="mx-auto max-w-[1400px] px-3 py-3 md:px-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-sky-500/10 to-rose-500/15 ring-1 ring-slate-200">
                                <UserRound className="h-5 w-5 text-slate-700" />
                            </div>
                            <div>
                                <div className="text-[15px] font-semibold text-slate-900">EMR Patient Chart</div>
                                <div className="text-xs text-slate-500">Search → Timeline → Preview (NUTRYAH Premium)</div>
                            </div>
                        </div>

                        {/* Patient Search */}
                        <div ref={searchBoxRef} className="relative w-full md:max-w-[520px]">
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                <Search className="h-4 w-4 text-slate-500" />
                                <Input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    onFocus={() => setDropOpen(true)}
                                    placeholder="Search by UHID / Name / Phone…"
                                    className="h-8 border-0 bg-transparent p-0 text-[14px] shadow-none focus-visible:ring-0"
                                />
                                {q ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-xl"
                                        onClick={() => {
                                            setQ("")
                                            setResults([])
                                            setDropOpen(false)
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>

                            <AnimatePresence>
                                {dropOpen && (results.length > 0 || searching) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                        className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                                    >
                                        <div className="max-h-[320px] overflow-auto">
                                            {searching ? (
                                                <div className="px-4 py-3 text-sm text-slate-600">Searching…</div>
                                            ) : (
                                                results.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => pickPatient(p)}
                                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                                                    >
                                                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                                                            <UserRound className="h-5 w-5 text-slate-600" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-[14px] font-semibold text-slate-900">
                                                                {p.name}
                                                                <span className="ml-2 text-xs font-medium text-slate-500">{p.gender} · {p.age}y</span>
                                                            </div>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Hash className="h-3.5 w-3.5" /> {p.uhid}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Building2 className="h-3.5 w-3.5" /> {p.phone}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Calendar className="h-3.5 w-3.5" /> Last: {fmtDate(p.lastVisit)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Badge className="rounded-xl bg-slate-900 text-white">Open</Badge>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="rounded-2xl"
                                onClick={() => toast("Tip: Start by searching a patient")}
                            >
                                <Filter className="mr-2 h-4 w-4" />
                                Quick Tips
                            </Button>
                            <Button
                                className="rounded-2xl"
                                onClick={() => setOpen(!open)}
                            >
                                <PenLine className="mr-2 h-4 w-4" />
                                New Record
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main */}
            <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-6 md:py-6">
                {/* Patient Header */}
                <PatientHeader patient={patient} />

                {/* Layout */}
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr_420px]">
                    {/* Filters / KPI */}
                    <aside className="space-y-4">
                        <FiltersCard f={f} setF={setF} kpis={kpis} onClear={clearFilters} />
                        <QuickLegend />
                    </aside>

                    {/* Timeline */}
                    <section className="space-y-4">
                        <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                            <CardHeader className="pb-2">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <CardTitle className="text-base">Timeline</CardTitle>
                                        <div className="text-xs text-slate-500">
                                            {patient ? (
                                                <>
                                                    {loadingRecords ? "Loading records…" : `${filtered.length} record(s)`}
                                                </>
                                            ) : (
                                                "Search and select a patient to view records"
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="relative w-full md:w-[280px]">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                            <Input
                                                value={f.recordQ}
                                                onChange={(e) => setF((s) => ({ ...s, recordQ: e.target.value }))}
                                                placeholder="Search within records…"
                                                className="h-10 rounded-2xl pl-9"
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="rounded-2xl"
                                            onClick={() => {
                                                navigator
                                            }}
                                            disabled={!patient}
                                        >
                                            <Download className="mr-2 h-4 w-4" /> Export
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="pt-0">
                                {!patient ? (
                                    <EmptyHint />
                                ) : loadingRecords ? (
                                    <SkeletonTimeline />
                                ) : filtered.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                                        <div className="text-sm font-semibold text-slate-800">No records match your filters</div>
                                        <div className="mt-1 text-xs text-slate-500">Try clearing filters or changing date range.</div>
                                        <div className="mt-4">
                                            <Button variant="outline" className="rounded-2xl" onClick={clearFilters}>
                                                <X className="mr-2 h-4 w-4" /> Clear Filters
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="max-h-[72vh] overflow-auto pr-1">
                                        <div className="space-y-5">
                                            {grouped.map(([label, list]) => (
                                                <div key={label} className="space-y-2">
                                                    <div className="sticky top-0 z-10 -mx-2 px-2 py-2">
                                                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                                                            <Clock3 className="h-3.5 w-3.5" />
                                                            {label}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {list.map((r) => (
                                                            <RecordCard
                                                                key={r.id}
                                                                record={r}
                                                                active={r.id === active?.id}
                                                                onClick={() => openPreview(r)}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    {/* Preview Pane (desktop) */}
                    <section className="hidden lg:block">
                        <PreviewPane record={active} patient={patient} />
                    </section>
                </div>

                {/* Preview Modal (mobile/tablet) */}
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent className="max-w-[96vw] rounded-3xl p-0 md:max-w-[720px]">
                        <DialogHeader className="border-b border-slate-200 px-5 py-4">
                            <DialogTitle className="text-base">Record Preview</DialogTitle>
                        </DialogHeader>
                        <div className="p-4 md:p-5">
                            <PreviewPane record={active} patient={patient} compact />
                        </div>
                        <DialogFooter className="border-t border-slate-200 px-5 py-3">
                            <Button className="rounded-2xl" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <EmrCreateRecordDialog
                open={open}
                onOpenChange={setOpen}
                patient={patients}
                defaultDept="OBGYN"
                onSaved={(payload) => console.log("UI payload:", payload)}
            />
        </div>
    )
}

/** ----------------- SUBCOMPONENTS ----------------- */

function PatientHeader({ patient }) {
    return (
        <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <CardContent className="p-4 md:p-5">
                {!patient ? (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                                <UserRound className="h-6 w-6 text-slate-600" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-slate-900">No patient selected</div>
                                <div className="text-xs text-slate-500">Use the search bar above to open a patient chart.</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge className="rounded-xl bg-slate-900 text-white">EMR Hub</Badge>
                            <Badge variant="outline" className="rounded-xl">Timeline</Badge>
                            <Badge variant="outline" className="rounded-xl">Preview</Badge>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-sky-500/10 to-rose-500/15 ring-1 ring-slate-200">
                                <UserRound className="h-6 w-6 text-slate-700" />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-slate-900">
                                    {patient.name}
                                    <span className="ml-2 text-sm font-medium text-slate-500">
                                        {patient.gender} · {patient.age}y · {patient.blood}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                        <Hash className="h-3.5 w-3.5" /> {patient.uhid}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Building2 className="h-3.5 w-3.5" /> {patient.phone}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" /> Last visit: {fmtDate(patient.lastVisit)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {(patient.flags || []).length ? (
                                patient.flags.map((x) => (
                                    <Badge key={x} className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                        <AlertTriangle className="mr-1 h-3.5 w-3.5" /> {x}
                                    </Badge>
                                ))
                            ) : (
                                <Badge className="rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> No alerts
                                </Badge>
                            )}
                            <Badge variant="outline" className="rounded-xl">OP/IP Linked</Badge>
                            <Badge variant="outline" className="rounded-xl">Audit Ready</Badge>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function FiltersCard({ f, setF, kpis, onClear }) {
    return (
        <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Filters</CardTitle>
                    <Button variant="ghost" size="sm" className="rounded-2xl" onClick={onClear}>
                        <X className="mr-2 h-4 w-4" /> Reset
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <KpiRow kpis={kpis} />

                <Separator />

                <div className="grid grid-cols-1 gap-3">
                    <FilterSelect
                        label="Encounter"
                        value={f.encounter}
                        options={ENCOUNTERS}
                        onChange={(v) => setF((s) => ({ ...s, encounter: v }))}
                    />
                    <FilterSelect
                        label="Department"
                        value={f.dept}
                        options={DEPARTMENTS}
                        onChange={(v) => setF((s) => ({ ...s, dept: v }))}
                    />
                    <FilterSelect
                        label="Record Type"
                        value={f.type}
                        options={TYPES}
                        onChange={(v) => setF((s) => ({ ...s, type: v }))}
                        renderOption={(x) => typeMeta(x).label}
                    />
                    <FilterSelect
                        label="Status"
                        value={f.status}
                        options={STATUSES}
                        onChange={(v) => setF((s) => ({ ...s, status: v }))}
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <div className="mb-1 text-xs font-medium text-slate-600">From</div>
                            <Input
                                type="date"
                                value={f.from}
                                onChange={(e) => setF((s) => ({ ...s, from: e.target.value }))}
                                className="h-10 rounded-2xl"
                            />
                        </div>
                        <div>
                            <div className="mb-1 text-xs font-medium text-slate-600">To</div>
                            <Input
                                type="date"
                                value={f.to}
                                onChange={(e) => setF((s) => ({ ...s, to: e.target.value }))}
                                className="h-10 rounded-2xl"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-3">
                        <div className="text-xs font-semibold text-slate-700">Smart Tip</div>
                        <div className="mt-1 text-xs text-slate-500">
                            Keep <span className="font-medium text-slate-700">Department</span> +{" "}
                            <span className="font-medium text-slate-700">Record Type</span> filters for fastest chart review.
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function KpiRow({ kpis }) {
    const items = [
        { label: "Total", value: kpis.total, cls: "bg-slate-50 text-slate-700 ring-slate-200" },
        { label: "Draft", value: kpis.drafts, cls: "bg-amber-50 text-amber-800 ring-amber-200" },
        { label: "Signed", value: kpis.signed, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
        { label: "Final", value: kpis.final, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
    ]
    return (
        <div className="grid grid-cols-2 gap-2">
            {items.map((x) => (
                <div
                    key={x.label}
                    className={cn("rounded-2xl p-3 ring-1", x.cls)}
                >
                    <div className="text-xs font-medium">{x.label}</div>
                    <div className="mt-1 text-lg font-semibold">{x.value}</div>
                </div>
            ))}
        </div>
    )
}

function FilterSelect({ label, value, options, onChange, renderOption }) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-600">{label}</div>
                {value !== "ALL" ? (
                    <Badge variant="outline" className="rounded-xl">{value}</Badge>
                ) : null}
            </div>

            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                >
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {renderOption ? renderOption(o) : o}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}

function RecordCard({ record, active, onClick }) {
    const tone = deptTone(record.dept)
    const st = statusPill(record.status)
    const { icon: TypeIcon, label: typeLabel } = typeMeta(record.type)
    const StIcon = st.icon

    return (
        <button
            onClick={onClick}
            className={cn(
                "group relative w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition",
                active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
            )}
        >
            {/* tone bar */}
            <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />

            <div className={cn("p-4", active ? tone.glow : "")}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", tone.chip)}>
                                <Building2 className="h-3.5 w-3.5" />
                                {record.dept}
                            </span>

                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", st.cls)}>
                                <StIcon className="h-3.5 w-3.5" />
                                {(record.status || "").toUpperCase()}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                <TypeIcon className="h-3.5 w-3.5" />
                                {typeLabel}
                            </span>
                        </div>

                        <div className="mt-2 truncate text-[14px] font-semibold text-slate-900">
                            {record.title}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" />
                                {fmtTime(record.ts)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5" />
                                {record.encounterType} · {record.encounterId}
                            </span>
                            {record.author && record.author !== "—" ? (
                                <span className="inline-flex items-center gap-1">
                                    <Stethoscope className="h-3.5 w-3.5" />
                                    {record.author}
                                </span>
                            ) : null}
                        </div>

                        {record.summary ? (
                            <div className="mt-2 line-clamp-2 text-xs text-slate-600">
                                {record.summary}
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <Badge className="rounded-xl bg-slate-900 text-white">
                            View
                        </Badge>
                        {record.attachments?.length ? (
                            <Badge variant="outline" className="rounded-xl">
                                {record.attachments.length} file(s)
                            </Badge>
                        ) : null}
                    </div>
                </div>
            </div>
        </button>
    )
}

function PreviewPane({ record, patient, compact }) {
    if (!patient) {
        return (
            <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                <CardHeader>
                    <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                    Select a patient, then click any record to preview here.
                </CardContent>
            </Card>
        )
    }

    if (!record) {
        return (
            <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                <CardHeader>
                    <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                    No record selected.
                </CardContent>
            </Card>
        )
    }

    const tone = deptTone(record.dept)
    const st = statusPill(record.status)
    const { icon: TypeIcon, label: typeLabel } = typeMeta(record.type)
    const StIcon = st.icon

    return (
        <Card className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", compact ? "" : "sticky top-[92px]")}>
            <div className={cn("h-2 w-full bg-gradient-to-r", tone.bar)} />
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", tone.chip)}>
                                <Building2 className="h-3.5 w-3.5" />
                                {record.dept}
                            </span>

                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", st.cls)}>
                                <StIcon className="h-3.5 w-3.5" />
                                {(record.status || "").toUpperCase()}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                <TypeIcon className="h-3.5 w-3.5" />
                                {typeLabel}
                            </span>
                        </div>

                        <CardTitle className="mt-2 text-base">{record.title}</CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" /> {fmtDate(record.ts)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" /> {fmtTime(record.ts)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5" /> {record.encounterType} · {record.encounterId}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => toast("Wire edit flow in Phase 2 (+ New Record)")}
                        >
                            <PenLine className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button
                            className="rounded-2xl"
                            onClick={() => toast("Wire sign/e-sign logic with role permissions")}
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Sign
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-indigo-50/30 p-4">
                    <div className="text-xs font-semibold text-slate-700">Patient</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                        {patient.name} <span className="text-xs font-medium text-slate-500">({patient.uhid})</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        {patient.gender} · {patient.age}y · {patient.phone}
                    </div>
                </div>

                <div>
                    <div className="mb-2 text-xs font-semibold text-slate-700">Content</div>
                    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4", tone.glow)}>
                        {(record.contentLines || []).length ? (
                            <ul className="space-y-2 text-sm text-slate-700">
                                {record.contentLines.map((x, idx) => (
                                    <li key={idx} className="leading-relaxed">
                                        <span className="mr-2 text-slate-400">•</span>
                                        {x}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-slate-600">No structured content.</div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MetaTile icon={Stethoscope} label="Author" value={record.author || "—"} />
                    <MetaTile icon={Layers} label="Encounter" value={`${record.encounterType} · ${record.encounterId}`} />
                </div>

                <div>
                    <div className="mb-2 text-xs font-semibold text-slate-700">Attachments</div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        {(record.attachments || []).length ? (
                            <div className="space-y-2">
                                {record.attachments.map((a, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <FileText className="h-4 w-4 text-slate-600" />
                                            <div className="truncate text-sm font-medium text-slate-800">{a.name}</div>
                                        </div>
                                        <Button variant="outline" className="h-9 rounded-2xl" onClick={() => toast("Wire download endpoint")}>
                                            <Download className="mr-2 h-4 w-4" /> Download
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-600">No attachments.</div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => toast("Wire print/PDF view")}
                    >
                        <FileText className="mr-2 h-4 w-4" /> Print / PDF
                    </Button>
                    <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => toast("Wire audit drawer (who/what/when)")}
                    >
                        <ShieldCheck className="mr-2 h-4 w-4" /> Audit Trail
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function MetaTile({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Icon className="h-4 w-4 text-slate-600" /> {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
        </div>
    )
}

function EmptyHint() {
    return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm">
                <Search className="h-6 w-6 text-slate-700" />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-900">Search a patient to open EMR</div>
            <div className="mt-1 text-xs text-slate-500">
                Use UHID / name / phone. Then review records by date in the timeline.
            </div>
        </div>
    )
}

function SkeletonTimeline() {
    return (
        <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                    <div className="h-1.5 w-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
                    <div className="p-4">
                        <div className="h-4 w-40 rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
                        <div className="mt-3 h-3 w-72 rounded bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function QuickLegend() {
    return (
        <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800 ring-1 ring-amber-200">Draft</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">Signed</span>
                    <span className="rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-700 ring-1 ring-sky-200">Final</span>
                    <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700 ring-1 ring-rose-200">Void</span>
                </div>
                <Separator />
                <div className="space-y-1">
                    <div className="font-semibold text-slate-800">Apple-premium workflow</div>
                    <div>Timeline is fast scan, Preview is deep read, Filters make it “1-click retrieval”.</div>
                </div>
            </CardContent>

        </Card>
    )
}
