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
    Printer,
    RefreshCcw,
    SlidersHorizontal,
    Paperclip,
} from "lucide-react"
import { toast } from "sonner"

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
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { EmrCreateRecordDialog } from "./EmrCreateRecordFlow"
import { EmrExportReleaseDialog } from "./EmrExportRelease"

import { listPatients } from "@/api/patients"
import {
    getPatientChart,
    getEmrRecord,
    listEmrDepartments,
    listEmrRecordTypes,
    exportCreateBundle,
    exportGenerateBundle,
    exportShareBundle,
    exportRevokeShare,
    downloadSharePdfBlob,
    triggerDownloadBlob,
} from "@/api/emrChart"
import { apiErrorMessage } from "@/api/_unwrap"
import { formatIST } from "@/ipd/components/timeZONE"

/**
 * ✅ EMR Patient Chart (Main Hub) — Production Ready
 * ✅ Responsive Premium UX:
 * - Desktop: 3-column (Filters / Timeline / Sticky Preview)
 * - Tablet: Timeline + Preview Drawer (right) + Filters Drawer (left)
 * - Mobile: Timeline + Preview Sheet (bottom) + Filters Sheet (bottom)
 *
 * ✅ PDF flow via Export Bundle → Generate → Share → Download → Revoke
 * ✅ Backend payload strictness respected (ExportCreateBundleIn extra="forbid")
 */

const ENCOUNTERS = ["ALL", "OP", "IP", "ER", "OT"]
const STATUSES = ["ALL", "DRAFT", "SIGNED", "FINAL", "VOID"]

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
    if (s === "SIGNED")
        return { cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", icon: CheckCircle2 }
    if (s === "FINAL")
        return { cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200", icon: CheckCircle2 }
    if (s === "DRAFT")
        return { cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200", icon: PenLine }
    if (s === "VOID")
        return { cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", icon: AlertTriangle }
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

function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => {
        if (typeof window === "undefined") return false
        return window.matchMedia?.(query)?.matches || false
    })

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia(query)
        const on = () => setMatches(!!mq.matches)
        on()
        mq.addEventListener?.("change", on)
        return () => mq.removeEventListener?.("change", on)
    }, [query])

    return matches
}

function useDebouncedValue(value, delay = 350) {
    const [v, setV] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return v
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

    const phone = p.phone ?? p.mobile ?? p.mobile_no ?? p.mobileNo ?? p.contact ?? ""

    const rawGender = (p.gender ?? p.sex ?? "").toString().trim().toLowerCase()
    const gender =
        rawGender === "male" || rawGender === "m"
            ? "M"
            : rawGender === "female" || rawGender === "f"
                ? "F"
                : rawGender
                    ? rawGender.toUpperCase()
                    : ""

    const age = p.age ?? p.age_years ?? p.ageYears ?? null
    const ageText = (p.age_short_text ?? p.ageShortText ?? p.age_text ?? p.ageText ?? "").toString().trim()

    const blood = p.blood ?? p.blood_group ?? p.bloodGroup ?? ""

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
        Array.isArray(p.flags)
            ? p.flags
            : Array.isArray(p.alerts)
                ? p.alerts
                : Array.isArray(p.tags)
                    ? p.tags
                    : p.tag
                        ? [p.tag]
                        : []

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

    const typeCode = (r.record_type_code || r.record_type || "RECORD")?.toString()
    const typeLabel = r.record_type_label || r.type_label || null

    const deptCode = r.dept_code || r.department_code || null
    const deptName = r.dept_name || r.department_name || null
    const deptShow = deptName || deptCode || "—"

    const status = r.status || "DRAFT"
    const title = r.title || typeLabel || typeMeta(typeCode).label

    const encounterType = r.encounter_type || r.encounterType || "OP"
    const encounterId = r.encounter_id || r.encounterId || ""

    const author = r.author_name || r.created_by_name || r.author || "—"
    const summary = r.preview_text || r.summary || ""

    return {
        id: r.id,
        ts,
        typeCode,
        typeLabel,
        deptCode,
        deptName,
        dept: deptShow,
        status,
        title,
        encounterType,
        encounterId,
        author,
        summary,
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

    pushKV("Chief Complaint", content.chief_complaint || content.cc)
    pushKV("History", content.history || content.hpi)
    pushKV("Assessment", content.assessment)
    pushKV("Plan", content.plan)

    const soap = content.soap || content.soap_json
    if (soap && typeof soap === "object") {
        if (soap.S) lines.push(`S: ${String(soap.S)}`)
        if (soap.O) lines.push(`O: ${String(soap.O)}`)
        if (soap.A) lines.push(`A: ${String(soap.A)}`)
        if (soap.P) lines.push(`P: ${String(soap.P)}`)
    }

    if (typeof content.note_text === "string" && content.note_text.trim()) lines.push(content.note_text.trim())
    if (typeof content.note === "string" && content.note.trim()) lines.push(content.note.trim())

    const vitals = content.vitals || content.vitals_json
    if (vitals && typeof vitals === "object") {
        const vitParts = []
        for (const k of ["bp", "pulse", "rr", "temp", "spo2", "weight", "height", "bmi"]) {
            if (vitals[k] != null && String(vitals[k]).trim() !== "") vitParts.push(`${k.toUpperCase()}: ${vitals[k]}`)
        }
        if (vitParts.length) lines.push(`Vitals: ${vitParts.join(" · ")}`)
    }

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

    return lines.filter(Boolean).slice(0, 200)
}

function extractAttachments(detailRecord) {
    const content = detailRecord?.content || {}
    const a = content.attachments || content.files || content.documents || detailRecord?.attachments || []
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

/** Open blob in new tab (best-effort), optionally trigger print */
function openBlobInNewTab(blob, { print = false } = {}) {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const w = window.open(url, "_blank", "noopener,noreferrer")
    if (print && w) {
        const t = setInterval(() => {
            try {
                if (w.closed) {
                    clearInterval(t)
                    URL.revokeObjectURL(url)
                    return
                }
                w.focus()
                w.print?.()
                clearInterval(t)
            } catch {
                // ignore
            }
        }, 650)
        setTimeout(() => clearInterval(t), 5000)
    } else {
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }
}

/** ----------------- PAGE ----------------- */
export default function EmrPatientChart() {
    const isLgUp = useMediaQuery("(min-width: 1024px)")
    const isMdUp = useMediaQuery("(min-width: 768px)")
    const isSmUp = useMediaQuery("(min-width: 640px)")

    // Patient search
    const [q, setQ] = useState("")
    const [searching, setSearching] = useState(false)
    const [results, setResults] = useState([])
    const [dropOpen, setDropOpen] = useState(false)
    const searchBoxRef = useRef(null)

    const [patient, setPatient] = useState(null)

    // Dynamic filter options
    const [deptOptions, setDeptOptions] = useState([{ value: "ALL", label: "ALL" }])
    const [typeOptions, setTypeOptions] = useState([{ value: "ALL", label: "ALL" }])
    const [loadingMeta, setLoadingMeta] = useState(false)

    // Records
    const [loadingRecords, setLoadingRecords] = useState(false)
    const [records, setRecords] = useState([])
    const [activeId, setActiveId] = useState(null)

    // Record details cache (for preview)
    const [detailMap, setDetailMap] = useState({})
    const inFlightDetailRef = useRef(new Map()) // recordId -> Promise<RecordUI>

    // Preview (tablet/mobile via Sheet)
    const [previewOpen, setPreviewOpen] = useState(false)

    // Filters sheet (tablet/mobile)
    const [filtersOpen, setFiltersOpen] = useState(false)

    // Create record dialog
    const [open, setOpen] = useState(false)

    // Edit record dialog
    const [editOpen, setEditOpen] = useState(false)
    const [editRecordId, setEditRecordId] = useState(null)

    // Export & Print
    const [exportOpen, setExportOpen] = useState(false)
    const [printOpen, setPrintOpen] = useState(false)
    const [printBusy, setPrintBusy] = useState(false)

    // Hard refresh key for forcing reload
    const [reloadKey, setReloadKey] = useState(0)

    // Filters
    const [f, setF] = useState({
        encounter: "ALL",
        dept: "ALL", // dept_code
        type: "ALL", // record_type_code
        status: "ALL",
        from: "",
        to: "",
        recordQ: "",
    })
    const debouncedRecordQ = useDebouncedValue(f.recordQ, 350)

    // Close dropdown on outside click
    useEffect(() => {
        const onDown = (e) => {
            if (!searchBoxRef.current) return
            if (!searchBoxRef.current.contains(e.target)) setDropOpen(false)
        }
        window.addEventListener("mousedown", onDown)
        return () => window.removeEventListener("mousedown", onDown)
    }, [])

    /** Load Departments + Record Types dynamically */
    useEffect(() => {
        let alive = true
        const controller = new AbortController()

        async function run() {
            setLoadingMeta(true)
            try {
                const [deptsRaw, typesRaw] = await Promise.all([
                    listEmrDepartments({ active: true }, controller.signal),
                    listEmrRecordTypes({ active: true }, controller.signal),
                ])
                if (!alive) return

                const depts = Array.isArray(deptsRaw) ? deptsRaw : deptsRaw?.data || deptsRaw?.items || []
                const types = Array.isArray(typesRaw) ? typesRaw : typesRaw?.data || typesRaw?.items || []

                const deptOpts = [
                    { value: "ALL", label: "ALL" },
                    ...depts
                        .map((d) => ({
                            value: (d.code || d.dept_code || d.deptCode || d.id || "").toString() || "—",
                            label: (d.name || d.label || d.dept_name || d.deptName || d.code || "—").toString(),
                        }))
                        .filter((x) => x.value && x.value !== "—"),
                ]

                const typeOpts = [
                    { value: "ALL", label: "ALL" },
                    ...types
                        .map((t) => ({
                            value: (t.code || t.record_type_code || t.recordTypeCode || t.id || "").toString() || "—",
                            label: (t.label || t.name || t.record_type_label || t.recordTypeLabel || t.code || "—").toString(),
                        }))
                        .filter((x) => x.value && x.value !== "—"),
                ]

                setDeptOptions(deptOpts.length ? deptOpts : [{ value: "ALL", label: "ALL" }])
                setTypeOptions(typeOpts.length ? typeOpts : [{ value: "ALL", label: "ALL" }])
            } catch (e) {
                if (!alive) return
                if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
                    toast.error(apiErrorMessage(e, "Failed to load EMR filters (departments/types)"))
                }
            } finally {
                if (alive) setLoadingMeta(false)
            }
        }

        run()
        return () => {
            alive = false
            controller.abort()
        }
    }, [])

    /** Debounced patient search */
    useEffect(() => {
        const x = (q || "").trim()
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
                if (!alive) return

                const raw = Array.isArray(rows) ? rows : rows?.data || rows?.items || rows?.results || []
                const norm = raw.map(normalizePatient).filter(Boolean)
                setResults(norm.slice(0, 10))
                setDropOpen(true)
            } catch (e) {
                if (!alive) return
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q])

    /** Load chart timeline when patient / server-safe filters change */
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
                const params = {
                    page: 1,
                    page_size: 100,
                    ...(f.status !== "ALL" ? { status: f.status } : {}),
                    ...(f.type !== "ALL" ? { record_type_code: f.type } : {}),
                    ...(f.dept !== "ALL" ? { dept_code: f.dept } : {}),
                    ...(debouncedRecordQ?.trim() ? { q: debouncedRecordQ.trim() } : {}),
                }

                const data = await getPatientChart(patient.id, params, controller.signal)
                if (!alive) return

                const items = data?.timeline?.items || data?.timeline?.data?.items || []
                const uiRows = items.map(normalizeRecordRow).filter(Boolean)

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patient?.id, f.status, f.type, f.dept, debouncedRecordQ, reloadKey])

    /** Ensure record detail loaded for preview (dedup in-flight) */
    async function ensureDetail(recordId) {
        const rid = Number(recordId || 0)
        if (!rid) return null
        if (detailMap[rid]) return detailMap[rid]

        if (inFlightDetailRef.current.has(rid)) {
            const p = inFlightDetailRef.current.get(rid)
            const r = await p
            return r || null
        }

        const p = (async () => {
            try {
                const data = await getEmrRecord(rid)
                const rec = data?.record || data?.data?.record || null
                if (!rec) return null

                const merged = normalizeRecordRow(rec)
                merged.contentLines = formatRecordContentLines(rec)
                merged.attachments = extractAttachments(rec)

                setDetailMap((m) => ({ ...(m || {}), [rid]: merged }))
                return merged
            } catch (e) {
                if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
                    toast.error(apiErrorMessage(e, "Failed to load record preview"))
                }
                return null
            } finally {
                inFlightDetailRef.current.delete(rid)
            }
        })()

        inFlightDetailRef.current.set(rid, p)
        return await p
    }

    /** Auto-load active record details so desktop preview is rich */
    useEffect(() => {
        if (!patient?.id) return
        if (!activeId) return
        ensureDetail(activeId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patient?.id, activeId])

    /** Client-side filtering (encounter/date) */
    const filtered = useMemo(() => {
        const rq = (f.recordQ || "").trim().toLowerCase()
        return (records || []).filter((r) => {
            if (f.encounter !== "ALL" && (r.encounterType || "").toUpperCase() !== f.encounter) return false
            if ((f.from || f.to) && !isBetween(r.ts, f.from || "", f.to || "")) return false

            // defensive client checks too:
            if (f.dept !== "ALL" && (r.deptCode || r.dept || "") !== f.dept) return false
            if (f.type !== "ALL" && (r.typeCode || "").toUpperCase() !== f.type) return false
            if (f.status !== "ALL" && (r.status || "").toUpperCase() !== f.status) return false

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
        return (filtered || []).find((r) => r.id === activeId) || filtered?.[0] || null
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
        setDetailMap({})
        setActiveId(null)
    }

    function clearFilters() {
        setF({ encounter: "ALL", dept: "ALL", type: "ALL", status: "ALL", from: "", to: "", recordQ: "" })
    }

    async function openPreview(r) {
        setActiveId(r.id)
        await ensureDetail(r.id)
        if (!isLgUp) setPreviewOpen(true)
    }

    function onChangeSearch(val) {
        setQ(val)
        if (patient && val !== formatPatientLabel(patient)) {
            setPatient(null)
            setRecords([])
            setActiveId(null)
            setDetailMap({})
        }
    }

    function handleNewRecord() {
        if (!patient?.id) return toast.error("Select a patient first")
        setOpen(true)
    }

    function handleEditRecord(recordId) {
        const rid = Number(recordId || 0)
        if (!rid) return toast.error("Record not selected")
        setEditRecordId(rid)
        setEditOpen(true)
    }

    function handlePrintPdf() {
        if (!patient?.id) return toast.error("Select a patient first")
        setPrintOpen(true)
    }

    function handleExport() {
        if (!patient?.id) return toast.error("Select a patient first")
        setExportOpen(true)
    }

    async function refreshActiveDetailAndRow(recordId) {
        const rid = Number(recordId || 0)
        if (!rid) return
        setDetailMap((m) => {
            const n = { ...(m || {}) }
            delete n[rid]
            return n
        })
        const fresh = await ensureDetail(rid)
        if (!fresh) return
        setRecords((rows) => (rows || []).map((x) => (x.id === rid ? { ...x, ...fresh } : x)))
    }

    // -----------------------
    // ✅ PRINT / PDF FLOW (Strict payload; matches backend ExportCreateBundleIn)
    // -----------------------
    function extractBundleId(obj) {
        if (!obj) return 0
        const bid = obj.bundle_id || obj.id || obj?.bundle?.id || obj?.data?.id || obj?.data?.bundle_id
        return Number(bid || 0)
    }
    function extractShareObj(obj) {
        return obj?.share || obj?.data?.share || obj?.data || obj || null
    }
    function extractShareId(share) {
        return Number(share?.share_id || share?.id || 0)
    }
    function extractShareToken(share) {
        return share?.share_token || share?.token || share?.shareToken || ""
    }

    function buildExportBundlePayload({ mode, patient, active, fromDate, toDate, watermarkText }) {
        const patientId = Number(patient?.id || 0)
        if (!patientId) throw new Error("patient_id missing")

        const clean = (v) => (v == null ? undefined : String(v).trim() || undefined)

        const payload = {
            patient_id: patientId,
            title: "",

            // optional
            encounter_type: undefined,
            encounter_id: undefined,

            // list (always present)
            record_ids: [],

            // optional
            from_date: clean(fromDate),
            to_date: clean(toDate),
            watermark_text: clean(watermarkText),
        }

        if (mode === "record") {
            const rid = Number(active?.id || 0)
            if (!rid) throw new Error("No active record selected")
            payload.record_ids = [rid]
            payload.title = `Record Export - ${active?.title || `#${rid}`}`.slice(0, 255)
            return payload
        }

        if (mode === "encounter") {
            const et = clean(active?.encounterType)
            const eid = clean(active?.encounterId)
            if (!et || !eid) throw new Error("Active record has no encounter")
            payload.encounter_type = et
            payload.encounter_id = eid
            payload.record_ids = []
            payload.title = `Visit Export - ${et} ${eid}`.slice(0, 255)
            return payload
        }

        payload.record_ids = []
        payload.title = `Full Chart - ${patient?.uhid || patient?.name || `Patient ${patientId}`}`.slice(0, 255)
        return payload
    }

    async function generateAndDownloadPdf({ mode, openPrint = true } = {}) {
        if (!patient?.id) return toast.error("Select a patient first")

        if ((mode === "record" || mode === "encounter") && active?.id) {
            await ensureDetail(active.id)
        }

        const safeFrom = f.from || undefined
        const safeTo = f.to || undefined

        let shareId = 0
        try {
            setPrintBusy(true)
            toast.message("Generating PDF…")

            const payload = buildExportBundlePayload({
                mode: mode === "record" ? "record" : mode === "encounter" ? "encounter" : "full",
                patient,
                active,
                fromDate: safeFrom,
                toDate: safeTo,
                watermarkText: undefined,
            })

            const created = await exportCreateBundle(payload)
            const bundleId = extractBundleId(created)
            if (!bundleId) throw new Error("Bundle created but missing bundle_id")

            await exportGenerateBundle(bundleId, {})

            const shareResp = await exportShareBundle(bundleId, { expires_in_days: 1, max_downloads: 1 })
            const share = extractShareObj(shareResp)
            shareId = extractShareId(share)
            const token = extractShareToken(share)
            if (!token) throw new Error("Share creation failed (missing token)")

            const { blob, filename } = await downloadSharePdfBlob(token)

            const fallbackName =
                filename ||
                (mode === "record"
                    ? `Record_${Number(active?.id || 0)}.pdf`
                    : mode === "encounter"
                        ? `Encounter_${String(active?.encounterType || "")}_${String(active?.encounterId || "")}.pdf`
                        : `PatientChart_${Number(patient?.id)}.pdf`)

            if (openPrint) openBlobInNewTab(blob, { print: true })
            else triggerDownloadBlob(blob, fallbackName)

            toast.success("PDF ready")
            setPrintOpen(false)
        } catch (e) {
            toast.error(apiErrorMessage(e, "PDF generation failed"))
        } finally {
            if (shareId) {
                try {
                    await exportRevokeShare(shareId)
                } catch {
                    // ignore
                }
            }
            setPrintBusy(false)
        }
    }

    const previewSide = !isMdUp ? "bottom" : "right"
    const filtersSide = !isMdUp ? "bottom" : "left"

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
                            {!isLgUp ? (
                                <Button
                                    variant="outline"
                                    className="rounded-2xl"
                                    onClick={() => setFiltersOpen(true)}
                                    disabled={!patient?.id}
                                >
                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                    Filters
                                </Button>
                            ) : (
                                <Button variant="outline" className="rounded-2xl" onClick={() => toast("Tip: Start by searching a patient")}>
                                    <Filter className="mr-2 h-4 w-4" />
                                    Quick Tips
                                </Button>
                            )}

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
                    {/* Filters / KPI (Desktop only) */}
                    {isLgUp ? (
                        <aside className="space-y-4">
                            <FiltersCard
                                f={f}
                                setF={setF}
                                kpis={kpis}
                                onClear={clearFilters}
                                deptOptions={deptOptions}
                                typeOptions={typeOptions}
                                loadingMeta={loadingMeta}
                            />
                            <QuickLegend />
                        </aside>
                    ) : null}

                    {/* Timeline */}
                    <section className="space-y-4">
                        <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                            <CardHeader className="pb-2">
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <CardTitle className="text-base">Timeline</CardTitle>
                                            <div className="text-xs text-slate-500">
                                                {patient
                                                    ? loadingRecords
                                                        ? "Loading records…"
                                                        : `${filtered.length} record(s)`
                                                    : "Search and select a patient to view records"}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                variant="outline"
                                                className="rounded-2xl"
                                                onClick={() => {
                                                    if (!patient?.id) return toast.error("Select a patient first")
                                                    toast.message("Refreshing…")
                                                    setReloadKey((k) => k + 1)
                                                }}
                                                disabled={!patient}
                                            >
                                                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                                            </Button>

                                            <Button variant="outline" className="rounded-2xl" onClick={handlePrintPdf} disabled={!patient}>
                                                <Printer className="mr-2 h-4 w-4" /> Print / PDF
                                            </Button>

                                            <Button variant="outline" className="rounded-2xl" onClick={handleExport} disabled={!patient}>
                                                <Download className="mr-2 h-4 w-4" /> Export
                                            </Button>

                                            {!isLgUp ? (
                                                <Button
                                                    variant="outline"
                                                    className="rounded-2xl"
                                                    onClick={() => setFiltersOpen(true)}
                                                    disabled={!patient}
                                                >
                                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                                    Filters
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Mobile/Tablet: KPIs + Applied filter chips (always visible, lightweight) */}
                                    {!isLgUp ? (
                                        <div className="space-y-2">
                                            <KpiRowCompact kpis={kpis} />
                                            <AppliedFiltersBar
                                                f={f}
                                                setF={setF}
                                                deptOptions={deptOptions}
                                                typeOptions={typeOptions}
                                                onClear={clearFilters}
                                            />
                                        </div>
                                    ) : null}
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
                    {isLgUp ? (
                        <section className="hidden lg:block">
                            <PreviewPane
                                record={active}
                                patient={patient}
                                onEdit={(id) => handleEditRecord(id)}
                                onPrint={() => handlePrintPdf()}
                                onCloseMobile={null}
                            />
                        </section>
                    ) : null}
                </div>

                {/* Filters Sheet (tablet/mobile) */}
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <SheetContent
                        side={filtersSide}
                        className={cn(
                            "p-0",
                            filtersSide === "bottom"
                                ? "h-[86vh] w-full sm:max-w-none rounded-t-3xl border-t border-slate-200"
                                : "h-full w-[92vw] max-w-[420px] rounded-r-3xl border-r border-slate-200"
                        )}
                    >
                        <SheetHeader className="border-b border-slate-200 px-5 py-4">
                            <SheetTitle className="text-base">Filters</SheetTitle>
                            <SheetDescription className="text-xs">
                                Adjust quickly with chips, or use advanced filters here.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="h-[calc(100%-120px)] overflow-auto p-4 md:p-5">
                            <div className="space-y-4">
                                <FiltersPanel
                                    f={f}
                                    setF={setF}
                                    kpis={kpis}
                                    onClear={clearFilters}
                                    deptOptions={deptOptions}
                                    typeOptions={typeOptions}
                                    loadingMeta={loadingMeta}
                                />
                                <QuickLegend />
                            </div>
                        </div>

                        <SheetFooter className="border-t border-slate-200 px-5 py-3">
                            <div className="flex w-full items-center justify-between gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-2xl"
                                    onClick={() => {
                                        clearFilters()
                                        toast.success("Filters reset")
                                    }}
                                >
                                    <X className="mr-2 h-4 w-4" /> Reset
                                </Button>
                                <Button className="rounded-2xl" onClick={() => setFiltersOpen(false)}>
                                    Done
                                </Button>
                            </div>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                {/* Preview Sheet (tablet/mobile) */}
                <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
                    <SheetContent
                        side={previewSide}
                        className={cn(
                            "p-0",
                            previewSide === "bottom"
                                ? "h-[88vh] w-full sm:max-w-none rounded-t-3xl border-t border-slate-200"
                                : "h-full w-[96vw] max-w-[760px] rounded-l-3xl border-l border-slate-200"
                        )}
                    >
                        <SheetHeader className="border-b border-slate-200 px-5 py-4">
                            <SheetTitle className="text-base">Record Preview</SheetTitle>
                            <SheetDescription className="text-xs">Review and take action (Edit / Print / Export).</SheetDescription>
                        </SheetHeader>

                        <div className="h-[calc(100%-120px)] overflow-auto p-4 md:p-5">
                            <PreviewPane
                                record={active}
                                patient={patient}
                                compact
                                onEdit={(id) => handleEditRecord(id)}
                                onPrint={() => handlePrintPdf()}
                                onCloseMobile={() => setPreviewOpen(false)}
                            />
                        </div>

                        <SheetFooter className="border-t border-slate-200 px-5 py-3">
                            <div className="flex w-full items-center justify-end gap-2">
                                <Button className="rounded-2xl" onClick={() => setPreviewOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                {/* Create Record Flow */}
                <EmrCreateRecordDialog
                    open={open}
                    onOpenChange={setOpen}
                    patient={patient || null}
                    defaultDeptCode={patient?.dept_code || patient?.dept || "OBGYN"}
                    onSaved={() => {
                        toast.success("Record created")
                        setReloadKey((k) => k + 1)
                    }}
                />

                {/* Edit Record Flow */}
                <EmrCreateRecordDialog
                    open={editOpen}
                    onOpenChange={(v) => {
                        setEditOpen(!!v)
                        if (!v) setEditRecordId(null)
                    }}
                    patient={patient || null}
                    defaultDeptCode={patient?.dept_code || patient?.dept || "OBGYN"}
                    mode="edit"
                    recordId={editRecordId}
                    onUpdated={async () => {
                        toast.success("Record updated")
                        if (editRecordId) await refreshActiveDetailAndRow(editRecordId)
                        setReloadKey((k) => k + 1)
                    }}
                />

                {/* Export & Release */}
                <EmrExportReleaseDialog open={exportOpen} onOpenChange={setExportOpen} patient={patient || null} />

                {/* Print / PDF Options */}
                <Dialog open={printOpen} onOpenChange={setPrintOpen}>
                    <DialogContent className="max-w-[96vw] rounded-3xl p-0 md:max-w-[760px]">
                        <DialogHeader className="border-b border-slate-200 px-5 py-4">
                            <DialogTitle className="text-base">Print / PDF</DialogTitle>
                            <DialogDescription className="text-xs">
                                Choose which scope to generate as a PDF (secure bundle download).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 p-4 md:p-5">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="text-sm font-semibold text-slate-900">Choose what to generate</div>
                                <div className="mt-1 text-xs text-slate-500">
                                    PDF is generated dynamically via Export Bundle and downloaded securely.
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <Button
                                        variant="outline"
                                        className="h-12 justify-start rounded-2xl"
                                        onClick={() => generateAndDownloadPdf({ mode: "record", openPrint: true })}
                                        disabled={!active?.id || printBusy}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        {printBusy ? "Working…" : "Current Record (Print)"}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-12 justify-start rounded-2xl"
                                        onClick={() => generateAndDownloadPdf({ mode: "record", openPrint: false })}
                                        disabled={!active?.id || printBusy}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        {printBusy ? "Working…" : "Current Record (Download)"}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-12 justify-start rounded-2xl"
                                        onClick={() => generateAndDownloadPdf({ mode: "encounter", openPrint: true })}
                                        disabled={!active?.encounterId || printBusy}
                                    >
                                        <Layers className="mr-2 h-4 w-4" />
                                        {printBusy ? "Working…" : "Active Visit (Encounter) (Print)"}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-12 justify-start rounded-2xl"
                                        onClick={() => generateAndDownloadPdf({ mode: "full", openPrint: true })}
                                        disabled={!patient?.id || printBusy}
                                    >
                                        <ClipboardList className="mr-2 h-4 w-4" />
                                        {printBusy ? "Working…" : "Full Patient Chart (Print)"}
                                    </Button>

                                    <Button
                                        className="h-12 justify-start rounded-2xl"
                                        onClick={() => {
                                            setPrintOpen(false)
                                            setExportOpen(true)
                                        }}
                                        disabled={!patient?.id || printBusy}
                                    >
                                        <Layers className="mr-2 h-4 w-4" />
                                        Open Export Builder
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-12 justify-start rounded-2xl"
                                        onClick={() => toast("Medical Pad PDF can be wired to a dedicated endpoint anytime")}
                                        disabled={!patient?.id || printBusy}
                                    >
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        Medical Pad (Later)
                                    </Button>
                                </div>

                                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                                    <div className="font-semibold text-slate-800">Note</div>
                                    <div className="mt-1">
                                        “Active Visit (Encounter)” uses the encounter details from the selected record. If your active record
                                        doesn’t have encounter_id, select a record that belongs to a visit.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="border-t border-slate-200 px-5 py-3">
                            <Button className="rounded-2xl" onClick={() => setPrintOpen(false)} disabled={printBusy}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
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
                                        {patient.age != null ? `${patient.ageText || `${patient.age}y`}` : ""}
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

/** Desktop card wrapper */
function FiltersCard({ f, setF, kpis, onClear, deptOptions, typeOptions, loadingMeta }) {
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
                <FiltersPanel
                    f={f}
                    setF={setF}
                    kpis={kpis}
                    onClear={onClear}
                    deptOptions={deptOptions}
                    typeOptions={typeOptions}
                    loadingMeta={loadingMeta}
                />
            </CardContent>
        </Card>
    )
}

/** Reusable filter controls (for desktop + sheets) */
function FiltersPanel({ f, setF, kpis, onClear, deptOptions, typeOptions, loadingMeta }) {
    return (
        <div className="space-y-4">
            <KpiRow kpis={kpis} />
            <Separator />

            <div className="grid grid-cols-1 gap-3">
                <FilterSelect
                    label="Encounter"
                    value={f.encounter}
                    options={ENCOUNTERS.map((x) => ({ value: x, label: x }))}
                    onChange={(v) => setF((s) => ({ ...s, encounter: v }))}
                />

                <FilterSelect
                    label="Department"
                    value={f.dept}
                    options={deptOptions}
                    onChange={(v) => setF((s) => ({ ...s, dept: v }))}
                    rightHint={loadingMeta ? "Loading…" : ""}
                />

                <FilterSelect
                    label="Record Type"
                    value={f.type}
                    options={typeOptions.map((x) => ({
                        value: x.value,
                        label: x.value === "ALL" ? "ALL" : x.label || typeMeta(x.value).label,
                    }))}
                    onChange={(v) => setF((s) => ({ ...s, type: v }))}
                    rightHint={loadingMeta ? "Loading…" : ""}
                />

                <FilterSelect
                    label="Status"
                    value={f.status}
                    options={STATUSES.map((x) => ({ value: x, label: x }))}
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

                <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Search in records</div>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input
                            value={f.recordQ}
                            onChange={(e) => setF((s) => ({ ...s, recordQ: e.target.value }))}
                            placeholder="Title / summary / encounter…"
                            className="h-10 rounded-2xl pl-9"
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-3">
                    <div className="text-xs font-semibold text-slate-700">Smart Tip</div>
                    <div className="mt-1 text-xs text-slate-500">
                        Use <span className="font-medium text-slate-700">Department</span> +{" "}
                        <span className="font-medium text-slate-700">Record Type</span> for fastest chart review.
                    </div>
                    <div className="mt-3">
                        <Button variant="outline" className="h-9 rounded-2xl" onClick={onClear}>
                            <X className="mr-2 h-4 w-4" />
                            Reset All
                        </Button>
                    </div>
                </div>
            </div>
        </div>
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

/** Compact KPIs for mobile/tablet timeline header */
function KpiRowCompact({ kpis }) {
    const items = [
        { label: "Total", value: kpis.total, cls: "bg-slate-50 text-slate-700 ring-slate-200" },
        { label: "Draft", value: kpis.drafts, cls: "bg-amber-50 text-amber-800 ring-amber-200" },
        { label: "Signed", value: kpis.signed, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
        { label: "Final", value: kpis.final, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
    ]
    return (
        <div className="grid grid-cols-4 gap-2">
            {items.map((x) => (
                <div key={x.label} className={cn("rounded-2xl p-2.5 ring-1", x.cls)}>
                    <div className="text-[11px] font-medium">{x.label}</div>
                    <div className="mt-0.5 text-[14px] font-semibold">{x.value}</div>
                </div>
            ))}
        </div>
    )
}

function FilterSelect({ label, value, options, onChange, rightHint }) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-600">{label}</div>
                <div className="flex items-center gap-2">
                    {rightHint ? <span className="text-[11px] text-slate-400">{rightHint}</span> : null}
                    {value !== "ALL" ? (
                        <Badge variant="outline" className="rounded-xl">
                            {value}
                        </Badge>
                    ) : null}
                </div>
            </div>

            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
            >
                {(options || []).map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

/** Applied filters: always visible + 1-tap clear per chip */
function AppliedFiltersBar({ f, setF, deptOptions, typeOptions, onClear }) {
    const deptLabel = useMemo(() => {
        if (f.dept === "ALL") return ""
        const hit = (deptOptions || []).find((x) => x.value === f.dept)
        return hit?.label || f.dept
    }, [f.dept, deptOptions])

    const typeLabel = useMemo(() => {
        if (f.type === "ALL") return ""
        const hit = (typeOptions || []).find((x) => x.value === f.type)
        return hit?.label || typeMeta(f.type).label || f.type
    }, [f.type, typeOptions])

    const chips = []
    if (f.encounter !== "ALL") chips.push({ key: "encounter", label: `Encounter: ${f.encounter}`, onClear: () => setF((s) => ({ ...s, encounter: "ALL" })) })
    if (f.dept !== "ALL") chips.push({ key: "dept", label: `Dept: ${deptLabel}`, onClear: () => setF((s) => ({ ...s, dept: "ALL" })) })
    if (f.type !== "ALL") chips.push({ key: "type", label: `Type: ${typeLabel}`, onClear: () => setF((s) => ({ ...s, type: "ALL" })) })
    if (f.status !== "ALL") chips.push({ key: "status", label: `Status: ${f.status}`, onClear: () => setF((s) => ({ ...s, status: "ALL" })) })
    if (f.from || f.to) chips.push({ key: "date", label: `Date: ${f.from || "…"} → ${f.to || "…"} `, onClear: () => setF((s) => ({ ...s, from: "", to: "" })) })
    if ((f.recordQ || "").trim()) chips.push({ key: "q", label: `Search: ${String(f.recordQ).slice(0, 24)}${String(f.recordQ).length > 24 ? "…" : ""}`, onClear: () => setF((s) => ({ ...s, recordQ: "" })) })

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
                {chips.length ? (
                    chips.map((c) => (
                        <button
                            key={c.key}
                            onClick={c.onClear}
                            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            title="Tap to clear"
                        >
                            <Filter className="h-3.5 w-3.5 text-slate-500" />
                            <span className="max-w-[240px] truncate">{c.label}</span>
                            <X className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                    ))
                ) : (
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        No filters applied
                    </div>
                )}
            </div>

            <Button variant="outline" className="shrink-0 rounded-2xl" onClick={onClear} disabled={!chips.length}>
                <X className="mr-2 h-4 w-4" />
                Clear
            </Button>
        </div>
    )
}

function RecordCard({ record, active, onClick }) {
    const tone = deptTone(record.dept)
    const st = statusPill(record.status)
    const { icon: TypeIcon, label: typeLabel } = typeMeta(record.typeCode)
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
                                {record.typeLabel || typeLabel}
                            </span>
                        </div>

                        <div className="mt-2 truncate text-[14px] font-semibold text-slate-900">{record.title}</div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" />
                                {formatIST(record.ts)}
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

/** Premium Preview: Tabs to avoid long scroll & keep hierarchy clean */
function PreviewPane({ record, patient, compact, onEdit, onPrint, onCloseMobile }) {
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
    const { icon: TypeIcon, label: typeLabel } = typeMeta(record.typeCode)
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
                                {record.typeLabel || typeLabel}
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

                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={() => onEdit?.(record.id)}>
                                <PenLine className="mr-2 h-4 w-4" /> Edit
                            </Button>
                            <Button className="rounded-2xl" onClick={() => toast("Wire sign/e-sign logic with role permissions")}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Sign
                            </Button>
                        </div>

                        {onCloseMobile ? (
                            <Button variant="ghost" size="sm" className="h-8 rounded-2xl" onClick={onCloseMobile}>
                                Close
                            </Button>
                        ) : null}
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

                <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 rounded-2xl">
                        <TabsTrigger value="summary" className="rounded-2xl">
                            Summary
                        </TabsTrigger>
                        <TabsTrigger value="details" className="rounded-2xl">
                            Details
                        </TabsTrigger>
                        <TabsTrigger value="files" className="rounded-2xl">
                            Files
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-3">
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
                                <div className="text-sm text-slate-600">No structured content (select the record again to load details).</div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="details" className="mt-3 space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <MetaTile icon={Stethoscope} label="Author" value={record.author || "—"} />
                            <MetaTile icon={Layers} label="Encounter" value={`${record.encounterType} · ${record.encounterId || "—"}`} />
                            <MetaTile icon={FileText} label="Type" value={record.typeLabel || typeMeta(record.typeCode).label} />
                            <MetaTile icon={ShieldCheck} label="Status" value={(record.status || "").toUpperCase()} />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                            <div className="font-semibold text-slate-800">Action hint</div>
                            <div className="mt-1">
                                Use <span className="font-medium text-slate-700">Print/PDF</span> for quick sharing, and{" "}
                                <span className="font-medium text-slate-700">Export Builder</span> for custom bundles.
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="files" className="mt-3">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>Attachments</span>
                            <span className="text-[11px] font-medium text-slate-400">
                                {(record.attachments || []).length || 0} file(s)
                            </span>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            {(record.attachments || []).length ? (
                                <div className="space-y-2">
                                    {record.attachments.map((a, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Paperclip className="h-4 w-4 text-slate-600" />
                                                <div className="truncate text-sm font-medium text-slate-800">{a.name}</div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="h-9 rounded-2xl"
                                                onClick={() => {
                                                    if (a.url) window.open(a.url, "_blank", "noopener,noreferrer")
                                                    else toast("No attachment url")
                                                }}
                                            >
                                                <Download className="mr-2 h-4 w-4" /> Open
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-600">No attachments.</div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={() => onPrint?.()}>
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
