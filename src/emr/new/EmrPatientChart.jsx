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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

import { EmrCreateRecordDialog } from "./EmrCreateRecordFlow"
import { EmrExportReleaseDialog } from "./EmrExportRelease"

import { listPatients } from "@/api/patients"
import { getPatientChart, getEmrRecord } from "@/api/emrChart"
import { apiErrorMessage } from "@/api/_unwrap"

/**
 * ✅ EMR Patient Chart (Main Hub) — API Wired
 * - Search patient via GET /patients?q=
 * - Fetch chart timeline via GET /emr/patients/{id}/chart
 * - Fetch record preview via GET /emr/records/{record_id}
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
        OBGYN: {
            bar: "from-pink-500/70 via-rose-500/60 to-orange-400/50",
            chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(244,63,94,0.45)]",
        },
        CARDIOLOGY: {
            bar: "from-red-500/70 via-rose-500/60 to-amber-400/40",
            chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(239,68,68,0.45)]",
        },
        ICU: {
            bar: "from-indigo-500/70 via-blue-500/55 to-cyan-400/45",
            chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(99,102,241,0.45)]",
        },
        ORTHOPEDICS: {
            bar: "from-emerald-500/65 via-teal-500/55 to-lime-400/40",
            chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(16,185,129,0.45)]",
        },
        DERMATOLOGY: {
            bar: "from-fuchsia-500/60 via-pink-500/50 to-amber-400/35",
            chip: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(217,70,239,0.45)]",
        },
        "PATHOLOGY/LAB": {
            bar: "from-amber-500/60 via-yellow-500/50 to-orange-400/40",
            chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(245,158,11,0.45)]",
        },
        UROLOGY: {
            bar: "from-sky-500/60 via-cyan-500/55 to-emerald-400/40",
            chip: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(14,165,233,0.45)]",
        },
        NEUROLOGY: {
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
    return (
        map[d] || {
            bar: "from-slate-500/55 via-slate-400/35 to-sky-400/25",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_20px_70px_-35px_rgba(100,116,139,0.28)]",
        }
    )
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
    return map[x] || { label: t || "Record", icon: FileText }
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

/** ---------- Normalizers (patient + record) ---------- */

function normalizePatient(p) {
    if (!p) return null

    const id = p.id ?? p.patient_id ?? p.patientId

    const uhid =
        p.uhid ??
        p.patient_code ??
        p.mrn ??
        p.reg_no ??
        p.regNo ??
        p.code ??
        ""

    const first = (p.first_name ?? p.firstName ?? "").trim()
    const last = (p.last_name ?? p.lastName ?? "").trim()

    const name =
        (p.name ??
            p.full_name ??
            p.fullName ??
            p.display_name ??
            [first, last].filter(Boolean).join(" ")
        )?.trim() || "—"

    const phone =
        p.phone ??
        p.mobile ??
        p.mobile_no ??
        p.mobileNo ??
        p.contact ??
        ""

    // normalize gender to UI-friendly short code
    const rawGender = (p.gender ?? p.sex ?? "").toString().trim().toLowerCase()
    const gender =
        rawGender === "male" || rawGender === "m"
            ? "M"
            : rawGender === "female" || rawGender === "f"
                ? "F"
                : rawGender
                    ? rawGender.toUpperCase()
                    : ""

    // prefer exact age string if available
    const age =
        p.age ??
        p.age_years ??
        p.ageYears ??
        null

    const ageText =
        (p.age_short_text ?? p.ageShortText ?? p.age_text ?? p.ageText ?? "").toString().trim()

    const blood =
        p.blood ??
        p.blood_group ??
        p.bloodGroup ??
        ""

    const lastVisit =
        p.lastVisit ??
        p.last_visit ??
        p.last_visit_at ??
        p.lastVisitAt ??
        p.updated_at ??
        p.updatedAt ??
        p.created_at ??
        null

    const flags =
        Array.isArray(p.flags) ? p.flags :
            Array.isArray(p.alerts) ? p.alerts :
                Array.isArray(p.tags) ? p.tags :
                    p.tag ? [p.tag] :
                        []

    return {
        ...p,
        id,
        uhid,
        name,
        phone,
        gender,
        age,
        ageText,
        blood,
        lastVisit,
        flags,
    }
}


function normalizeRecordRow(r) {
    if (!r) return null
    const ts = r.updated_at || r.created_at || r.signed_at || null
    const type = r.record_type_code || r.record_type || "RECORD"
    const dept = r.dept_name || r.dept_code || "—"
    const status = r.status || "DRAFT"
    const title = r.title || typeMeta(type).label
    const encounterType = r.encounter_type || r.encounterType || "OP"
    const encounterId = r.encounter_id || r.encounterId || ""
    const author = r.author_name || r.created_by_name || r.author || "—"
    const summary = r.preview_text || r.summary || ""
    return {
        id: r.id,
        ts,
        type,
        dept,
        status,
        title,
        encounterType,
        encounterId,
        author,
        summary,
        // filled after detail fetch:
        contentLines: [],
        attachments: [],
        _raw: r,
    }
}

function formatRecordContentLines(detailRecord) {
    const content = detailRecord?.content || {}
    const lines = []

    const pushKV = (k, v) => {
        if (v == null) return
        if (typeof v === "string" && v.trim()) lines.push(`${k}: ${v.trim()}`)
        else if (typeof v === "number" || typeof v === "boolean") lines.push(`${k}: ${String(v)}`)
    }

    // Common fields
    pushKV("Chief Complaint", content.chief_complaint || content.cc)
    pushKV("History", content.history || content.hpi)
    pushKV("Assessment", content.assessment)
    pushKV("Plan", content.plan)

    // SOAP blocks (if stored)
    const soap = content.soap || content.soap_json
    if (soap && typeof soap === "object") {
        if (soap.S) lines.push(`S: ${String(soap.S)}`)
        if (soap.O) lines.push(`O: ${String(soap.O)}`)
        if (soap.A) lines.push(`A: ${String(soap.A)}`)
        if (soap.P) lines.push(`P: ${String(soap.P)}`)
    }

    // Note text
    if (typeof content.note_text === "string" && content.note_text.trim()) {
        lines.push(content.note_text.trim())
    }
    if (typeof content.note === "string" && content.note.trim()) {
        lines.push(content.note.trim())
    }

    // Vitals
    const vitals = content.vitals || content.vitals_json
    if (vitals && typeof vitals === "object") {
        const vitParts = []
        for (const k of ["bp", "pulse", "rr", "temp", "spo2", "weight", "height", "bmi"]) {
            if (vitals[k] != null && String(vitals[k]).trim() !== "") vitParts.push(`${k.toUpperCase()}: ${vitals[k]}`)
        }
        if (vitParts.length) lines.push(`Vitals: ${vitParts.join(" · ")}`)
    }

    // Meds
    const meds = content.meds || content.meds_json
    if (Array.isArray(meds) && meds.length) {
        for (const m of meds.slice(0, 30)) {
            if (typeof m === "string") lines.push(m)
            else if (m && typeof m === "object") {
                const n = m.name || m.drug || m.item || "Medicine"
                const dose = m.dose || m.strength || ""
                const freq = m.freq || m.frequency || ""
                const dur = m.duration || ""
                const inst = m.instructions || m.note || ""
                lines.push([n, dose, freq, dur].filter(Boolean).join(" · ") + (inst ? ` — ${inst}` : ""))
            }
        }
    }

    // Sections (template style)
    const sections = content.sections
    if (Array.isArray(sections) && sections.length) {
        for (const s of sections.slice(0, 25)) {
            if (!s) continue
            const title = s.title || s.name || ""
            if (title) lines.push(`— ${title} —`)
            const items = s.items || s.lines || s.fields
            if (Array.isArray(items)) {
                for (const it of items.slice(0, 40)) {
                    if (typeof it === "string" && it.trim()) lines.push(`• ${it.trim()}`)
                    else if (it && typeof it === "object") {
                        const k = it.label || it.key || it.name || "Item"
                        const v = it.value ?? it.val ?? it.text ?? ""
                        if (String(v).trim()) lines.push(`• ${k}: ${v}`)
                    }
                }
            }
        }
    }

    // Fallback: if nothing captured, show “No structured content”
    return lines.filter(Boolean).slice(0, 200)
}

function extractAttachments(detailRecord) {
    const content = detailRecord?.content || {}
    const a =
        content.attachments ||
        content.files ||
        content.documents ||
        detailRecord?.attachments ||
        []
    if (!Array.isArray(a)) return []
    return a
        .map((x) => {
            if (!x) return null
            if (typeof x === "string") return { name: x }
            return {
                name: x.name || x.filename || x.file_name || "Attachment",
                url: x.url || x.path || x.download_url || null,
            }
        })
        .filter(Boolean)
}

function formatPatientLabel(p) {
    if (!p) return ""
    return `${p.uhid || "UHID"} · ${p.name || "Patient"}`
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

    const [patient, setPatient] = useState(null)

    // Records
    const [loadingRecords, setLoadingRecords] = useState(false)
    const [records, setRecords] = useState([])
    const [activeId, setActiveId] = useState(null)

    // Record details cache (for preview)
    const [detailMap, setDetailMap] = useState({}) // { [recordId]: { ...uiRecordMerged } }

    // Preview modal (mobile)
    const [previewOpen, setPreviewOpen] = useState(false)

    // Create record dialog
    const [open, setOpen] = useState(false)

    // Edit record dialog
    const [editOpen, setEditOpen] = useState(false)
    const [editRecordId, setEditRecordId] = useState(null)

    // Export & Print
    const [exportOpen, setExportOpen] = useState(false)
    const [printOpen, setPrintOpen] = useState(false)

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

    /** Debounced patient search */
    useEffect(() => {
        const x = (q || "").trim()
        // don’t auto-search if input equals selected patient label
        if (patient && x === formatPatientLabel(patient)) return

        if (!x || x.length < 2) {
            setResults([])
            setSearching(false)
            return
        }

        let alive = true
        const controller = new AbortController()

        const t = setTimeout(async () => {
            setSearching(true)
            try {
                const rows = await listPatients(x, controller.signal)
                console.log(rows, "checked");

                if (!alive) return
                const norm = (rows?.data || [])?.map(normalizePatient).filter(Boolean)
                setResults(norm.slice(0, 10))
                setDropOpen(true)
            } catch (e) {
                if (!alive) return
                // ignore abort
                if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
                    toast.error(apiErrorMessage(e, "Failed to search patients"))
                }
            } finally {
                if (alive) setSearching(false)
            }
        }, 250)

        return () => {
            alive = false
            controller.abort()
            clearTimeout(t)
        }
    }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

    /** Load chart timeline when patient changes */
    useEffect(() => {
        let alive = true
        const controller = new AbortController()

        async function run() {
            if (!patient?.id) {
                setRecords([])
                setActiveId(null)
                setDetailMap({})
                return
            }

            setLoadingRecords(true)
            try {
                // Server side filters that are safe:
                const params = {
                    page: 1,
                    page_size: 20,
                    // pass only exact-safe filters:
                    ...(f.status !== "ALL" ? { status: f.status } : {}),
                    ...(f.type !== "ALL" ? { record_type_code: f.type } : {}),
                    ...(f.recordQ?.trim() ? { q: f.recordQ.trim() } : {}),
                }
                console.log(params, "checked");


                const data = await getPatientChart(patient.id, params, controller.signal)
                if (!alive) return

                const items = data?.timeline?.items || []
                const uiRows = items.map(normalizeRecordRow).filter(Boolean)

                // Sort desc by ts
                const sorted = [...uiRows].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0))

                setRecords(sorted)
                setActiveId(sorted?.[0]?.id || null)
            } catch (e) {
                if (!alive) return
                if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
                    toast.error(apiErrorMessage(e, "Failed to load EMR records"))
                }
            } finally {
                if (alive) setLoadingRecords(false)
            }
        }

        run()
        return () => {
            alive = false
            controller.abort()
        }
        // patient changes => reload
    }, [patient?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    /** Ensure record detail loaded for preview */
    async function ensureDetail(recordId) {
        if (!recordId) return
        if (detailMap[recordId]) return

        const controller = new AbortController()
        try {
            const data = await getEmrRecord(recordId, controller.signal)
            const rec = data?.record || data?.data?.record || null
            if (!rec) return

            const merged = normalizeRecordRow(rec)
            merged.contentLines = formatRecordContentLines(rec)
            merged.attachments = extractAttachments(rec)

            setDetailMap((m) => ({ ...m, [recordId]: merged }))
        } catch (e) {
            if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
                toast.error(apiErrorMessage(e, "Failed to load record preview"))
            }
        }
    }

    /** Client-side filtering (dept/date/encounter) */
    const filtered = useMemo(() => {
        const rq = (f.recordQ || "").trim().toLowerCase()
        return (records || []).filter((r) => {
            if (f.encounter !== "ALL" && (r.encounterType || "").toUpperCase() !== f.encounter) return false
            if (f.dept !== "ALL" && (r.dept || "") !== f.dept) return false
            if (f.type !== "ALL" && (r.type || "").toUpperCase() !== f.type) return false
            if (f.status !== "ALL" && (r.status || "").toUpperCase() !== f.status) return false
            if ((f.from || f.to) && !isBetween(r.ts, f.from || "", f.to || "")) return false

            if (rq) {
                const hay = `${r.title || ""} ${r.summary || ""} ${r.encounterId || ""}`.toLowerCase()
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
        const order = ["Today", "Yesterday", "This Week"]
        const keys = Array.from(m.keys())
        const special = order.filter((k) => m.has(k))
        const rest = keys
            .filter((k) => !order.includes(k))
            .sort((a, b) => {
                const pa = Date.parse(a)
                const pb = Date.parse(b)
                if (Number.isFinite(pa) && Number.isFinite(pb)) return pb - pa
                return 0
            })
        return [...special, ...rest].map((k) => [k, m.get(k)])
    }, [filtered])

    const activeBase = useMemo(() => {
        return (filtered || []).find((r) => r.id === activeId) || (filtered?.[0] || null)
    }, [filtered, activeId])

    const active = useMemo(() => {
        if (!activeBase) return null
        return detailMap[activeBase.id] || activeBase
    }, [activeBase, detailMap])

    const kpis = useMemo(() => {
        const total = filtered.length
        const signed = filtered.filter((r) => (r.status || "").toUpperCase() === "SIGNED").length
        const final = filtered.filter((r) => (r.status || "").toUpperCase() === "FINAL").length
        const drafts = filtered.filter((r) => (r.status || "").toUpperCase() === "DRAFT").length
        return { total, signed, final, drafts }
    }, [filtered])

    function pickPatient(p) {
        const np = normalizePatient(p)
        setPatient(np)
        setQ(formatPatientLabel(np))
        setResults([])
        setDropOpen(false)
    }

    function clearFilters() {
        setF({ encounter: "ALL", dept: "ALL", type: "ALL", status: "ALL", from: "", to: "", recordQ: "" })
    }

    async function openPreview(r) {
        setActiveId(r.id)
        await ensureDetail(r.id)
        if (isMobile) setPreviewOpen(true)
    }

    function onChangeSearch(val) {
        setQ(val)
        // if user edits search after selecting a patient => clear selected patient
        if (patient && val !== formatPatientLabel(patient)) {
            setPatient(null)
            setRecords([])
            setActiveId(null)
            setDetailMap({})
        }
    }

    function handleNewRecord() {
        if (!patient?.id) {
            toast.error("Select a patient first")
            return
        }
        setOpen(true)
    }

    function handleEditRecord(recordId) {
        const rid = Number(recordId || 0)
        if (!rid) {
            toast.error("Record not selected")
            return
        }
        setEditRecordId(rid)
        setEditOpen(true)
    }

    function handlePrintPdf() {
        if (!patient?.id) {
            toast.error("Select a patient first")
            return
        }
        setPrintOpen(true)
    }

    function handleExport() {
        if (!patient?.id) {
            toast.error("Select a patient first")
            return
        }
        // wire your export page/flow if available
        // Example route: /emr/export?patient_id=...
        // navigate(`/emr/export?patient_id=${patient.id}`)
        setExportOpen(true)
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
                                    onChange={(e) => onChangeSearch(e.target.value)}
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
                                            setPatient(null)
                                            setRecords([])
                                            setActiveId(null)
                                            setDetailMap({})
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
                                            ) : results.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-slate-600">No matches</div>
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
                                                                <span className="ml-2 text-xs font-medium text-slate-500">
                                                                    {p.gender ? `${p.gender} · ` : ""}
                                                                    {p.age != null ? `${p.age}y` : ""}
                                                                </span>
                                                            </div>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Hash className="h-3.5 w-3.5" /> {p.uhid || "—"}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Building2 className="h-3.5 w-3.5" /> {p.phone || "—"}
                                                                </span>
                                                                {p.lastVisit ? (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Calendar className="h-3.5 w-3.5" /> Last: {fmtDate(p.lastVisit)}
                                                                    </span>
                                                                ) : null}
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
                            <Button variant="outline" className="rounded-2xl" onClick={() => toast("Tip: Start by searching a patient")}>
                                <Filter className="mr-2 h-4 w-4" />
                                Quick Tips
                            </Button>
                            <Button className="rounded-2xl" onClick={handleNewRecord} disabled={!patient?.id}>
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
                                            {patient ? (loadingRecords ? "Loading records…" : `${filtered.length} record(s)`) : "Search and select a patient to view records"}
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
                                        <Button variant="outline" className="rounded-2xl" onClick={handleExport} disabled={!patient}>
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
                                                            <RecordCard key={r.id} record={r} active={r.id === active?.id} onClick={() => openPreview(r)} />
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
                        <PreviewPane record={active} patient={patient} onEdit={() => handleEditRecord(active?.id)} onPrint={handlePrintPdf} />
                    </section>
                </div>

                {/* Preview Modal (mobile/tablet) */}
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent className="max-w-[96vw] rounded-3xl p-0 md:max-w-[720px]">
                        <DialogHeader className="border-b border-slate-200 px-5 py-4">
                            <DialogTitle className="text-base">Record Preview</DialogTitle>
                        </DialogHeader>
                        <div className="p-4 md:p-5">
                            <PreviewPane record={active} patient={patient} compact onEdit={() => handleEditRecord(active?.id)} onPrint={handlePrintPdf} />
                        </div>
                        <DialogFooter className="border-t border-slate-200 px-5 py-3">
                            <Button className="rounded-2xl" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Create Record Flow */}
            <EmrCreateRecordDialog
                open={open}
                onOpenChange={setOpen}
                patient={patient || null}
                defaultDeptCode={(patient?.dept_code || patient?.dept || "OBGYN")}
                onSaved={(payload) => console.log("UI payload:", payload)}
            />

            {/* Edit Record Flow (same UI as New Record) */}
            <EmrCreateRecordDialog
                open={editOpen}
                onOpenChange={(v) => {
                    setEditOpen(!!v)
                    if (!v) setEditRecordId(null)
                }}
                patient={patient || null}
                defaultDeptCode={(patient?.dept_code || patient?.dept_code || patient?.dept || "OBGYN")}
                mode="edit"
                recordId={editRecordId}
                onUpdated={async () => {
                    const rid = Number(editRecordId || 0)
                    if (!rid) return
                    // bust cache and reload preview + list row best-effort
                    setDetailMap((m) => {
                        const n = { ...(m || {}) }
                        delete n[rid]
                        return n
                    })
                    await ensureDetail(rid)
                    // update list title if loaded
                    setRecords((rows) => (rows || []).map((x) => (x.id === rid ? { ...x, ...(detailMap[rid] || {}) } : x)))
                }}
            />

            {/* Export & Release */}
            <EmrExportReleaseDialog open={exportOpen} onOpenChange={setExportOpen} patient={patient || null} />

            {/* Print / PDF Options */}
            <Dialog open={printOpen} onOpenChange={setPrintOpen}>
                <DialogContent className="max-w-[96vw] rounded-3xl p-0 md:max-w-[720px]">
                    <DialogHeader className="border-b border-slate-200 px-5 py-4">
                        <DialogTitle className="text-base">Print / PDF</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 p-4 md:p-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-900">Choose what to print</div>
                            <div className="mt-1 text-xs text-slate-500">
                                These are UI print options. Connect each option to your backend PDF endpoints when ready.
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-2xl justify-start"
                                    onClick={() => toast("TODO: Print current record (connect to PDF endpoint)")}
                                    disabled={!active?.id}
                                >
                                    <FileText className="mr-2 h-4 w-4" /> Current Record
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-2xl justify-start"
                                    onClick={() => toast("TODO: Print patient chart bundle (connect to export PDF)")}
                                    disabled={!patient?.id}
                                >
                                    <Download className="mr-2 h-4 w-4" /> Patient Chart Bundle
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-2xl justify-start"
                                    onClick={() => toast("TODO: Print Medical Pad (connect to medical pad endpoint)")}
                                    disabled={!patient?.id}
                                >
                                    <ClipboardList className="mr-2 h-4 w-4" /> Medical Pad
                                </Button>
                                <Button
                                    className="h-12 rounded-2xl justify-start"
                                    onClick={() => {
                                        setPrintOpen(false)
                                        setExportOpen(true)
                                    }}
                                    disabled={!patient?.id}
                                >
                                    <Layers className="mr-2 h-4 w-4" /> Open Export Builder
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t border-slate-200 px-5 py-3">
                        <Button className="rounded-2xl" onClick={() => setPrintOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            <Badge variant="outline" className="rounded-xl">
                                Timeline
                            </Badge>
                            <Badge variant="outline" className="rounded-xl">
                                Preview
                            </Badge>
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
                                        {patient.gender ? `${patient.gender || "—"} · ` : ""}
                                        {patient.age != null ? `${(patient.ageText || (patient.age != null ? `${patient.age}y` : "—"))}` : ""}
                                        {patient.blood ? ` · ${patient.blood || "—"}` : ""}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                        <Hash className="h-3.5 w-3.5" /> {patient.uhid || "—"}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Building2 className="h-3.5 w-3.5" /> {patient.phone || "—"}
                                    </span>
                                    {patient.lastVisit ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5" /> Last visit: {fmtDate(patient.lastVisit)}
                                        </span>
                                    ) : null}
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
                            <Badge variant="outline" className="rounded-xl">
                                OP/IP Linked
                            </Badge>
                            <Badge variant="outline" className="rounded-xl">
                                Audit Ready
                            </Badge>
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
                    <FilterSelect label="Encounter" value={f.encounter} options={ENCOUNTERS} onChange={(v) => setF((s) => ({ ...s, encounter: v }))} />
                    <FilterSelect label="Department" value={f.dept} options={DEPARTMENTS} onChange={(v) => setF((s) => ({ ...s, dept: v }))} />
                    <FilterSelect
                        label="Record Type"
                        value={f.type}
                        options={TYPES}
                        onChange={(v) => setF((s) => ({ ...s, type: v }))}
                        renderOption={(x) => typeMeta(x).label}
                    />
                    <FilterSelect label="Status" value={f.status} options={STATUSES} onChange={(v) => setF((s) => ({ ...s, status: v }))} />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <div className="mb-1 text-xs font-medium text-slate-600">From</div>
                            <Input type="date" value={f.from} onChange={(e) => setF((s) => ({ ...s, from: e.target.value }))} className="h-10 rounded-2xl" />
                        </div>
                        <div>
                            <div className="mb-1 text-xs font-medium text-slate-600">To</div>
                            <Input type="date" value={f.to} onChange={(e) => setF((s) => ({ ...s, to: e.target.value }))} className="h-10 rounded-2xl" />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-3">
                        <div className="text-xs font-semibold text-slate-700">Smart Tip</div>
                        <div className="mt-1 text-xs text-slate-500">
                            Keep <span className="font-medium text-slate-700">Department</span> + <span className="font-medium text-slate-700">Record Type</span> filters
                            for fastest chart review.
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
                <div key={x.label} className={cn("rounded-2xl p-3 ring-1", x.cls)}>
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
                {value !== "ALL" ? <Badge variant="outline" className="rounded-xl">{value}</Badge> : null}
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

                        <div className="mt-2 truncate text-[14px] font-semibold text-slate-900">{record.title}</div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" />
                                {fmtTime(record.ts)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5" />
                                {record.encounterType} · {record.encounterId || "—"}
                            </span>
                            {record.author && record.author !== "—" ? (
                                <span className="inline-flex items-center gap-1">
                                    <Stethoscope className="h-3.5 w-3.5" />
                                    {record.author}
                                </span>
                            ) : null}
                        </div>

                        {record.summary ? <div className="mt-2 line-clamp-2 text-xs text-slate-600">{record.summary}</div> : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <Badge className="rounded-xl bg-slate-900 text-white">View</Badge>
                    </div>
                </div>
            </div>
        </button>
    )
}

function PreviewPane({ record, patient, compact, onEdit, onPrint }) {
    if (!patient) {
        return (
            <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                <CardHeader>
                    <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">Select a patient, then click any record to preview here.</CardContent>
            </Card>
        )
    }

    if (!record) {
        return (
            <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                <CardHeader>
                    <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">No record selected.</CardContent>
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
                                <Calendar className="h-3.5 w-3.5" /> {record.ts ? fmtDate(record.ts) : "—"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" /> {record.ts ? fmtTime(record.ts) : ""}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5" /> {record.encounterType} · {record.encounterId || "—"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-2xl" onClick={() => onEdit?.(record)}>
                            <PenLine className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button className="rounded-2xl" onClick={() => toast("Wire sign/e-sign logic with role permissions")}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Sign
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-indigo-50/30 p-4">
                    <div className="text-xs font-semibold text-slate-700">Patient</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                        {patient.name} <span className="text-xs font-medium text-slate-500">({patient.uhid || "—"})</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        {patient.gender ? `${patient.gender} · ` : ""}
                        {patient.age != null ? `${patient.age}y · ` : ""}
                        {patient.phone || "—"}
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
                    <MetaTile icon={Layers} label="Encounter" value={`${record.encounterType} · ${record.encounterId || "—"}`} />
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
                    <Button variant="outline" className="rounded-2xl" onClick={() => onPrint?.(record)}>
                        <FileText className="mr-2 h-4 w-4" /> Print / PDF
                    </Button>
                    <Button variant="outline" className="rounded-2xl" onClick={() => toast("Wire audit drawer (who/what/when)")}>
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
            <div className="mt-1 text-xs text-slate-500">Use UHID / name / phone. Then review records by date in the timeline.</div>
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
