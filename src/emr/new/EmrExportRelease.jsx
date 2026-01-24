// FILE: frontend/src/emr/EmrExportRelease.jsx
import React, { useEffect, useMemo, useRef, useState } from "react"
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
import API from "@/api/client"

/**
 * ✅ EMR Export & Release — Production API Integrated
 *
 * Uses:
 * - GET  /api/emr/patients/:id/summary              (added below in backend patch)
 * - GET  /api/emr/patients/:id/encounters           (already exists in your backend)
 * - GET  /api/emr/records?patient_id=:id            (already exists; we filter by encounter client-side)
 * - POST /api/emr/exports/bundles                   (already exists)
 * - PUT  /api/emr/exports/bundles/:id               (already exists)
 * - POST /api/emr/exports/bundles/:id/generate      (patched below to accept optional {pdf_password})
 * - POST /api/emr/exports/bundles/:id/share         (already exists)
 * - GET  /api/emr/exports/bundles/:id/audit         (added below in backend patch)
 * - GET  /api/emr/exports/share/:token              (already exists; used for download/share link)
 */

// ---------------------------
// API Helper (safe unwrap)
// ---------------------------
// const API_ORIGIN = (import.meta?.env?.VITE_API_ORIGIN || "").replace(/\/$/, "")
const EMR_BASE = `${API}/emr`

function getAccessToken() {
    // If you use cookies, keep it empty; fetch will still work with credentials.
    return localStorage.getItem("access_token") || localStorage.getItem("token") || ""
}

function normalizeApiError(err) {
    if (!err) return "Unknown error"
    if (typeof err === "string") return err
    if (err?.message) return err.message
    return "Request failed"
}

async function apiFetch(path, { method = "GET", body, signal } = {}) {
    const token = getAccessToken()
    const headers = { "Content-Type": "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${EMR_BASE}${path}`, {
        method,
        headers,
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
        signal,
    })

    let json = null
    const ct = res.headers.get("content-type") || ""
    if (ct.includes("application/json")) {
        json = await res.json().catch(() => null)
    } else {
        // For non-json responses (rare here), try text
        const text = await res.text().catch(() => "")
        json = text ? { raw: text } : null
    }

    // Support your backend's ok()/err() wrapper shapes
    const unwrapped =
        json && typeof json === "object" && "status" in json
            ? json.status
                ? json.data ?? json
                : (() => {
                    const msg =
                        json?.msg ||
                        json?.message ||
                        json?.error?.message ||
                        json?.error ||
                        "Request failed"
                    const e = new Error(msg)
                    e.details = json
                    throw e
                })()
            : json

    if (!res.ok) {
        const msg =
            (json && (json?.detail || json?.msg || json?.message)) ||
            `HTTP ${res.status}`
        const e = new Error(msg)
        e.details = json
        throw e
    }

    return unwrapped
}

// Download helper for Bearer-token auth
async function downloadPdfViaFetch(urlPath, filename = "export.pdf") {
    const token = getAccessToken()
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(urlPath, { headers, credentials: "include" })
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(blobUrl)
}

// ---------------------------
// UI Helpers
// ---------------------------
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
        return new Date(d).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
    } catch {
        return String(d || "")
    }
}
function fmtTime(d) {
    try {
        return new Date(d).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return ""
    }
}

// ---------------------------
// Fullscreen Wrapper
// ---------------------------
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-2xl"
                                onClick={() => onOpenChange?.(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            MRD export builder · permissions · audit logs
                        </div>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <EmrExportRelease patient={patient} fullscreen />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ---------------------------
// Main Component
// ---------------------------
export default function EmrExportRelease({ patient: patientProp, fullscreen = false }) {
    const isMobile = useIsMobile(1024)

    // patientProp can be {id} or full object. We always fetch real summary for correctness.
    const patientId = Number(patientProp?.id || patientProp?.patient_id || 0) || 0

    // Core data
    const [patient, setPatient] = useState(patientProp || null)
    const [encounters, setEncounters] = useState([])
    const [visitKey, setVisitKey] = useState("") // `${encounter_type}:${encounter_id}`
    const [records, setRecords] = useState([])

    // Meta lists (dynamic > fallback)
    const [deptOptions, setDeptOptions] = useState(["ALL"])
    const SHARE_ROLES = useMemo(
        () => ["Doctor", "Nurse", "Receptionist", "Lab Staff", "Radiology Staff", "MRD", "Admin"],
        []
    )
    const EXTERNAL_CHANNELS = useMemo(() => ["Email", "WhatsApp", "Download Link"], [])

    // Loading / errors
    const [loading, setLoading] = useState({
        patient: false,
        encounters: false,
        records: false,
        build: false,
        audit: false,
        share: false,
    })

    const abortRef = useRef({ patient: null, encounters: null, records: null, audit: null })

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

    // Permissions (UI policy today, server enforces expiry/max-download only)
    const [internalRoles, setInternalRoles] = useState(() => new Set(["MRD"]))
    const [externalChannels, setExternalChannels] = useState(() => new Set(["Email"]))
    const [expiryDays, setExpiryDays] = useState(7)
    const [requireOtp, setRequireOtp] = useState(false)
    const [allowDownload, setAllowDownload] = useState(true)
    const [allowPrint, setAllowPrint] = useState(false)
    const [allowForward, setAllowForward] = useState(false)

    // Output
    const [bundle, setBundle] = useState(null) // {id, created_at, pages, size_est_mb, status, share_token?, share_url?}
    const [released, setReleased] = useState(false)

    // Audit logs (from API)
    const [audit, setAudit] = useState([])

    const activeVisit = useMemo(() => {
        const [t, id] = (visitKey || "").split(":")
        const encounter_type = (t || "").toUpperCase()
        const encounter_id = Number(id || 0) || 0
        const row = encounters.find(
            (e) => String(e.encounter_type).toUpperCase() === encounter_type && Number(e.encounter_id) === encounter_id
        )
        return row || null
    }, [visitKey, encounters])

    const tone = deptTone(activeVisit?.dept_code || activeVisit?.dept_name || "General Medicine")

    // ---------------------------
    // Load patient + encounters
    // ---------------------------
    useEffect(() => {
        console.log(patientId, "888888888888888888888888888888888");

        if (!patientId) return

            ; (async () => {
                abortRef.current.patient?.abort?.()
                const controller = new AbortController()
                abortRef.current.patient = controller

                try {
                    setLoading((p) => ({ ...p, patient: true }))
                    const p = await apiFetch(`/patients/${patientId}/summary`, { signal: controller.signal })
                    setPatient(p)
                } catch (e) {
                    toast.error(normalizeApiError(e))
                } finally {
                    setLoading((p) => ({ ...p, patient: false }))
                }
            })()
    }, [patientId])

    useEffect(() => {
        if (!patientId) return

            ; (async () => {
                abortRef.current.encounters?.abort?.()
                const controller = new AbortController()
                abortRef.current.encounters = controller

                try {
                    setLoading((p) => ({ ...p, encounters: true }))
                    const rows = await apiFetch(`/patients/${patientId}/encounters?limit=100`, { signal: controller.signal })

                    const norm = (Array.isArray(rows) ? rows : [])
                        .map((r) => ({
                            encounter_type: (r.encounter_type || "").toUpperCase(),
                            encounter_id: Number(r.encounter_id || 0) || 0,
                            encounter_code: r.encounter_code || `${r.encounter_type}-${r.encounter_id}`,
                            dept_code: r.dept_code || r.dept || "",
                            dept_name: r.dept_name || r.dept || "",
                            doctor_name: r.doctor_name || r.doctor || "",
                            status: r.status || "",
                            encounter_at: r.encounter_at || r.created_at || null,
                        }))
                        .filter((r) => r.encounter_type && r.encounter_id)

                    setEncounters(norm)

                    // default selection
                    if (!visitKey && norm.length) {
                        setVisitKey(`${norm[0].encounter_type}:${norm[0].encounter_id}`)
                    }
                } catch (e) {
                    toast.error(normalizeApiError(e))
                } finally {
                    setLoading((p) => ({ ...p, encounters: false }))
                }
            })()
    }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Init bundle name when visit changes
    useEffect(() => {
        if (!patient?.uhid) return
        if (!activeVisit) return
        const safeCode = String(activeVisit.encounter_code || `${activeVisit.encounter_type}-${activeVisit.encounter_id}`)
            .replaceAll(":", "_")
            .replaceAll("/", "_")
            .replaceAll(" ", "_")
        const defaultName = `MRD_${patient.uhid}_${safeCode}_${new Date().toISOString().slice(0, 10)}`
        setBundleName((p) => p || defaultName)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeVisit?.encounter_type, activeVisit?.encounter_id, patient?.uhid])

    // Clear selection/bundle when visit changes
    useEffect(() => {
        setSelected(new Set())
        setBundle(null)
        setReleased(false)
        setAudit([])
    }, [visitKey])

    // ---------------------------
    // Load records for patient (and filter by encounter client-side)
    // ---------------------------
    useEffect(() => {
        if (!patientId) return
        if (!activeVisit) return

            ; (async () => {
                abortRef.current.records?.abort?.()
                const controller = new AbortController()
                abortRef.current.records = controller

                try {
                    setLoading((p) => ({ ...p, records: true }))

                    // We fetch patient records once (paged) and filter by encounter fields.
                    // This avoids backend changes. (If you want server-side encounter filtering, tell me.)
                    const pageSize = 100
                    let page = 1
                    let all = []
                    let total = 0

                    // max 5 pages (500 records) to prevent runaway; adjust if needed.
                    for (let i = 0; i < 5; i++) {
                        const resp = await apiFetch(
                            `/records?patient_id=${patientId}&page=${page}&page_size=${pageSize}`,
                            { signal: controller.signal }
                        )
                        const items = resp?.items || []
                        total = Number(resp?.total || 0) || items.length
                        all = all.concat(items)

                        if (all.length >= total || items.length < pageSize) break
                        page += 1
                    }

                    const encType = String(activeVisit.encounter_type || "").toUpperCase()
                    const encId = Number(activeVisit.encounter_id || 0) || 0

                    // Normalize rows into the UI schema
                    const mapped = all
                        .filter((r) => String(r.encounter_type || "").toUpperCase() === encType && Number(r.encounter_id || 0) === encId)
                        .map((r) => ({
                            id: String(r.id),
                            dept: r.dept_code || r.dept_name || "Common (All)",
                            type: r.record_type_code || r.record_type || "RECORD",
                            title: r.title || r.summary || `Record #${r.id}`,
                            updated_at: r.updated_at || r.created_at || new Date().toISOString(),
                            signed: !!r.signed_at || String(r.status || "").toUpperCase() === "SIGNED",
                            confidential: !!r.is_confidential,
                            pages_est: Number(r.pages_est || 1) || 1, // backend can send pages_est; default 1
                            attachments: Number(r.attachments_count || 0) || 0,
                            abnormal: !!r.has_abnormal,
                        }))

                    setRecords(mapped)

                    // department filter options (dynamic)
                    const deptSet = new Set(["ALL"])
                    mapped.forEach((x) => deptSet.add(String(x.dept || "").trim() || "Common (All)"))
                    setDeptOptions(Array.from(deptSet))
                } catch (e) {
                    toast.error(normalizeApiError(e))
                    setRecords([])
                } finally {
                    setLoading((p) => ({ ...p, records: false }))
                }
            })()
    }, [patientId, activeVisit?.encounter_type, activeVisit?.encounter_id])

    // ---------------------------
    // Filtering + selection math
    // ---------------------------
    const filteredRecords = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        let x = [...records]

        if (dept !== "ALL") x = x.filter((r) => (r.dept || "").toUpperCase() === dept.toUpperCase())
        if (onlySigned) x = x.filter((r) => !!r.signed)
        if (!showConfidential) x = x.filter((r) => !r.confidential)

        if (qq) {
            x = x.filter((r) => {
                const hay = `${r.id} ${r.title} ${r.type} ${r.dept}`.toLowerCase()
                return hay.includes(qq)
            })
        }

        x.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        return x
    }, [records, q, dept, onlySigned, showConfidential])

    const selectedRows = useMemo(
        () => records.filter((r) => selected.has(r.id)),
        [records, selected]
    )

    const selectedPages = useMemo(() => {
        let pages = selectedRows.reduce((s, r) => s + Number(r.pages_est || 0), 0)
        if (includeCover) pages += 1
        if (includeIndex) pages += 1
        if (includeAuditSummary) pages += 1
        return pages
    }, [selectedRows, includeCover, includeIndex, includeAuditSummary])

    const selectedAttachments = useMemo(
        () => selectedRows.reduce((s, r) => s + Number(r.attachments || 0), 0),
        [selectedRows]
    )

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
        if (!patientId) return "Patient is missing"
        if (!activeVisit) return "Choose a visit"
        if (!selectedCount) return "Select at least one record"
        if (!bundleName.trim() || bundleName.trim().length < 3) return "Bundle name is required (min 3 chars)"
        if (passwordOn && (!password || password.length < 6)) return "Password must be at least 6 characters"
        return null
    }

    // ---------------------------
    // API Actions: Build / Generate / Share / Audit
    // ---------------------------
    async function fetchAudit(bundleId) {
        if (!bundleId) return
        abortRef.current.audit?.abort?.()
        const controller = new AbortController()
        abortRef.current.audit = controller

        try {
            setLoading((p) => ({ ...p, audit: true }))
            const rows = await apiFetch(`/exports/bundles/${bundleId}/audit?limit=200`, { signal: controller.signal })
            // expected rows: [{at, by, action, meta}]
            setAudit(Array.isArray(rows) ? rows : [])
        } catch (e) {
            // audit is non-blocking
            console.warn(e)
        } finally {
            setLoading((p) => ({ ...p, audit: false }))
        }
    }

    async function buildBundle() {
        const err = validateBuild()
        if (err) return toast.error(err)

        try {
            setLoading((p) => ({ ...p, build: true }))

            const recordIds = selectedRows
                .map((r) => Number(r.id))
                .filter((n) => Number.isFinite(n) && n > 0)

            // 1) Create bundle
            const created = await apiFetch(`/exports/bundles`, {
                method: "POST",
                body: {
                    patient_id: patientId,
                    encounter_type: activeVisit.encounter_type,
                    encounter_id: activeVisit.encounter_id,
                    title: bundleName.trim(),
                    watermark_text: watermarkOn ? watermarkText : "",
                    record_ids: recordIds,
                    // Keep extra "notes/purpose" in title/notes on UI for now (DB schema dependent)
                },
            })

            const bundleId = Number(created?.bundle_id || created?.id || 0)
            if (!bundleId) throw new Error("Bundle creation failed: missing bundle_id")

            // 2) Generate PDF (optional password)
            const gen = await apiFetch(`/exports/bundles/${bundleId}/generate`, {
                method: "POST",
                body: passwordOn ? { pdf_password: password } : {},
            })

            const status = gen?.status || "GENERATED"

            const sizeEstMb = Math.max(
                0.3,
                selectedPages * 0.18 + (includeAttachments ? selectedAttachments * 0.35 : 0)
            ).toFixed(1)

            setBundle({
                id: bundleId,
                created_at: new Date().toISOString(),
                name: bundleName.trim(),
                pages: selectedPages,
                size_est_mb: sizeEstMb,
                status,
            })
            setReleased(false)

            toast.success("Bundle generated successfully")
            await fetchAudit(bundleId)
        } catch (e) {
            toast.error(normalizeApiError(e))
        } finally {
            setLoading((p) => ({ ...p, build: false }))
        }
    }

    async function releaseBundle(channel) {
        if (!bundle?.id) return toast.error("Generate bundle first")

        try {
            setLoading((p) => ({ ...p, share: true }))

            // Backend supports expiry + max_downloads today.
            const share = await apiFetch(`/exports/bundles/${bundle.id}/share`, {
                method: "POST",
                body: {
                    expires_in_days: Math.max(0, Math.min(365, Number(expiryDays || 0))),
                    max_downloads: 0, // 0 = unlimited in your service
                },
            })

            const token = share?.share_token
            if (!token) throw new Error("Share creation failed: missing share_token")

            const shareUrl = `${API_ORIGIN || window.location.origin}/api/emr/exports/share/${token}`

            setBundle((p) => ({ ...(p || {}), share_token: token, share_url: shareUrl }))
            setReleased(true)

            toast.success(`Released via ${channel}`)
            await fetchAudit(bundle.id)
        } catch (e) {
            toast.error(normalizeApiError(e))
        } finally {
            setLoading((p) => ({ ...p, share: false }))
        }
    }

    async function downloadBundle() {
        if (!bundle?.share_url && !bundle?.id) return toast.error("Generate bundle first")

        try {
            // For download we generate a fresh share token (safer than storing one)
            const share = await apiFetch(`/exports/bundles/${bundle.id}/share`, {
                method: "POST",
                body: { expires_in_days: 0, max_downloads: 0 },
            })

            const token = share?.share_token
            if (!token) throw new Error("Download token generation failed")

            const url = `${API_ORIGIN || window.location.origin}/api/emr/exports/share/${token}`
            const filename = `${bundle?.name || "export"}.pdf`

            // If auth uses cookies, window.open works too.
            // If auth uses Bearer token, we fetch blob.
            const tokenLocal = getAccessToken()
            if (tokenLocal) {
                await downloadPdfViaFetch(url, filename)
            } else {
                window.open(url, "_blank", "noopener,noreferrer")
            }

            toast.success("Download started")
            await fetchAudit(bundle.id)
        } catch (e) {
            toast.error(normalizeApiError(e))
        }
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
        setAudit([])
        toast.success("Reset done")
    }

    async function refreshAll() {
        if (!patientId) return
        toast.message("Refreshing…")
        // re-trigger by resetting keys
        try {
            setLoading((p) => ({ ...p, patient: true, encounters: true, records: true }))
            const p = await apiFetch(`/patients/${patientId}/summary`)
            setPatient(p)

            const rows = await apiFetch(`/patients/${patientId}/encounters?limit=100`)
            const norm = (Array.isArray(rows) ? rows : [])
                .map((r) => ({
                    encounter_type: (r.encounter_type || "").toUpperCase(),
                    encounter_id: Number(r.encounter_id || 0) || 0,
                    encounter_code: r.encounter_code || `${r.encounter_type}-${r.encounter_id}`,
                    dept_code: r.dept_code || r.dept || "",
                    dept_name: r.dept_name || r.dept || "",
                    doctor_name: r.doctor_name || r.doctor || "",
                    status: r.status || "",
                    encounter_at: r.encounter_at || r.created_at || null,
                }))
                .filter((r) => r.encounter_type && r.encounter_id)

            setEncounters(norm)
            if (!visitKey && norm.length) setVisitKey(`${norm[0].encounter_type}:${norm[0].encounter_id}`)

            toast.success("Refreshed")
        } catch (e) {
            toast.error(normalizeApiError(e))
        } finally {
            setLoading((p) => ({ ...p, patient: false, encounters: false, records: false }))
        }
    }

    // Mobile: open right pane in dialog
    const [mobilePaneOpen, setMobilePaneOpen] = useState(false)

    const visitsForSelect = useMemo(() => {
        return encounters.map((v) => ({
            key: `${v.encounter_type}:${v.encounter_id}`,
            label: `${v.encounter_type} · ${v.encounter_code || v.encounter_id} · ${v.dept_code || v.dept_name || "-"}`,
            when: v.encounter_at,
        }))
    }, [encounters])

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
                                <Badge variant="outline" className="rounded-xl">MRD / Sharing</Badge>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Bundle PDF export · permissions · audit trail</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={resetAll}>
                                <X className="mr-2 h-4 w-4" /> Reset
                            </Button>
                            <Button variant="outline" className="rounded-2xl" onClick={refreshAll} disabled={loading.patient || loading.encounters || loading.records}>
                                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                            </Button>

                            {isMobile ? (
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={() => setMobilePaneOpen(true)}>
                                    <Settings className="mr-2 h-4 w-4" /> Builder
                                </Button>
                            ) : (
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={buildBundle} disabled={loading.build}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    {loading.build ? "Generating…" : "Generate Bundle"}
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
                                        {patient?.name || "—"} <span className="text-slate-500">({patient?.uhid || "—"})</span>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {(patient?.age ?? "—")} / {(patient?.gender ?? "—")} · {(patient?.phone ?? "—")}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={cn("rounded-xl", tone.chip)}>
                                        <Building2 className="mr-1 h-3.5 w-3.5" />
                                        {activeVisit?.dept_code || activeVisit?.dept_name || "—"}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-xl">
                                        <Layers className="mr-1 h-3.5 w-3.5" />
                                        {(activeVisit?.encounter_type || "—")} · {(activeVisit?.encounter_code || "—")}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                                <select
                                    value={visitKey}
                                    onChange={(e) => setVisitKey(e.target.value)}
                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                    disabled={!visitsForSelect.length || loading.encounters}
                                >
                                    {visitsForSelect.length ? (
                                        visitsForSelect.map((v) => (
                                            <option key={v.key} value={v.key}>
                                                {v.label}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">No visits</option>
                                    )}
                                </select>

                                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <Calendar className="h-4 w-4" />
                                        {activeVisit?.encounter_at ? fmtDate(activeVisit.encounter_at) : "—"}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <Clock3 className="h-4 w-4" />
                                        {activeVisit?.encounter_at ? fmtTime(activeVisit.encounter_at) : "—"}
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
                                    {deptOptions.map((d) => (
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
                                    {loading.records ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                                            <div className="text-sm font-semibold text-slate-800">Loading records…</div>
                                            <div className="mt-1 text-xs text-slate-500">Fetching real-time data from API.</div>
                                        </div>
                                    ) : (
                                        filteredRecords.map((r) => (
                                            <RecordRow key={r.id} row={r} checked={selected.has(r.id)} onToggle={() => toggleSelect(r.id)} />
                                        ))
                                    )}

                                    {!loading.records && !filteredRecords.length ? (
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
                                    <Warn
                                        tone="amber"
                                        icon={AlertTriangle}
                                        title="Unsigned records selected"
                                        desc="MRD export usually requires signed documents. You can still export depending on policy."
                                    />
                                ) : null}
                                {hasConfidentialSelected ? (
                                    <Warn
                                        tone="rose"
                                        icon={Lock}
                                        title="Confidential records included"
                                        desc="Enable watermark/password and verify permissions before release."
                                    />
                                ) : null}
                                {hasAbnormalSelected ? (
                                    <Warn
                                        tone="indigo"
                                        icon={AlertTriangle}
                                        title="Abnormal results present"
                                        desc="Consider adding audit summary for medico-legal clarity."
                                    />
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
                            visit={activeVisit}
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
                            loading={loading}
                            onBuild={buildBundle}
                            onDownload={downloadBundle}
                            onRelease={releaseBundle}
                            audit={audit}
                            shareRoles={SHARE_ROLES}
                            externalChannelList={EXTERNAL_CHANNELS}
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
                                visit={activeVisit}
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
                                loading={loading}
                                onBuild={buildBundle}
                                onDownload={downloadBundle}
                                onRelease={releaseBundle}
                                audit={audit}
                                shareRoles={SHARE_ROLES}
                                externalChannelList={EXTERNAL_CHANNELS}
                                compact
                            />
                        </div>

                        <div className="shrink-0 border-t border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl">
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="outline" className="rounded-2xl" onClick={() => setMobilePaneOpen(false)}>
                                    Close
                                </Button>
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={buildBundle} disabled={loading.build}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    {loading.build ? "Generating…" : "Generate Bundle"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ---------------------------
// Right Pane (Builder / Permissions / Audit)
// ---------------------------
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
    loading,
    onBuild,
    onDownload,
    onRelease,
    audit,
    shareRoles,
    externalChannelList,
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
                        {visit?.dept_code || visit?.dept_name || "—"}
                    </Badge>
                </div>

                <div className="mt-3">
                    <Tabs value={tab} onValueChange={setTab}>
                        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <TabsList className="w-max min-w-full justify-start gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                                <TabsTrigger value="BUILDER" className="whitespace-nowrap rounded-xl">Builder</TabsTrigger>
                                <TabsTrigger value="PERMISSIONS" className="whitespace-nowrap rounded-xl">Permissions</TabsTrigger>
                                <TabsTrigger value="AUDIT" className="whitespace-nowrap rounded-xl">Audit</TabsTrigger>
                            </TabsList>
                        </div>
                    </Tabs>
                </div>
            </CardHeader>

            <CardContent className={cn("min-h-0 space-y-4", compact ? "px-0" : "")}>
                {/* Summary */}
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-xl">
                            <Layers className="mr-1 h-3.5 w-3.5" /> {visit?.encounter_type || "—"} · {visit?.encounter_code || "—"}
                        </Badge>
                        <Badge variant="outline" className="rounded-xl">
                            <Calendar className="mr-1 h-3.5 w-3.5" /> {visit?.encounter_at ? fmtDate(visit.encounter_at) : "—"}
                        </Badge>
                        <Badge variant="outline" className="rounded-xl">
                            <Clock3 className="mr-1 h-3.5 w-3.5" /> {visit?.encounter_at ? fmtTime(visit.encounter_at) : "—"}
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
                        Patient: <span className="font-semibold text-slate-700">{patient?.name || "—"}</span> ({patient?.uhid || "—"})
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
                                    <div className="text-xs text-slate-500">PDF bundle config (API integrated)</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <Field label="Bundle name *" hint="Used for MRD export filename">
                                            <Input value={bundleName} onChange={(e) => setBundleName(e.target.value)} className="h-10 rounded-2xl" />
                                        </Field>

                                        <Field label="Purpose" hint="Shown in audit logs and cover page (UI policy today)">
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

                                    <ToggleCard icon={FileText} title="Cover page" desc="Patient + visit summary cover" checked={includeCover} onCheckedChange={setIncludeCover} />
                                    <ToggleCard icon={ListChecks} title="Index page" desc="Record list with page mapping" checked={includeIndex} onCheckedChange={setIncludeIndex} />
                                    <ToggleCard icon={Paperclip} title="Include attachments" desc="Append uploaded PDFs/images" checked={includeAttachments} onCheckedChange={setIncludeAttachments} />
                                    <ToggleCard icon={History} title="Audit summary page" desc="Add audit summary into PDF" checked={includeAuditSummary} onCheckedChange={setIncludeAuditSummary} />

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
                                        desc="Encrypt PDF bundle (backend patched to accept pdf_password)"
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
                                        <Button className={cn("rounded-2xl", tone.btn)} onClick={onBuild} disabled={!selectedCount || loading.build}>
                                            <FileDown className="mr-2 h-4 w-4" />
                                            {loading.build ? "Generating…" : "Generate Bundle"}
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
                                            <div className="mt-1 text-xs text-emerald-800">
                                                ID: {bundle.id} · Created {fmtDate(bundle.created_at)} {fmtTime(bundle.created_at)}
                                            </div>
                                            {bundle.share_url ? (
                                                <div className="mt-2 text-xs text-emerald-900">
                                                    Share URL: <span className="break-all font-semibold">{bundle.share_url}</span>
                                                </div>
                                            ) : null}
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
                                    <div className="text-xs text-slate-500">Share/export actions (API integrated)</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        <ActionBtn disabled={!bundle || loading.share} onClick={() => onRelease("MRD")} icon={Shield} tone={tone} title="MRD Release" desc="Issue MRD share token" />
                                        <ActionBtn disabled={!bundle || loading.share} onClick={() => onRelease("Email")} icon={Share2} tone={tone} title="Email" desc="Generate share token (email sending later)" />
                                        <ActionBtn disabled={!bundle || loading.share} onClick={() => onRelease("WhatsApp")} icon={Share2} tone={tone} title="WhatsApp" desc="Generate share token (WhatsApp sending later)" />
                                    </div>

                                    {released ? (
                                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Released successfully
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
                                    <div className="text-xs text-slate-500">UI policy today (backend enforces expiry/max-download)</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="rounded-3xl border border-slate-200 bg-white p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">Internal Roles</div>
                                                <div className="text-xs text-slate-500">Allowed roles inside hospital</div>
                                            </div>
                                            <Badge variant="outline" className="rounded-xl">{internalRoles.size}</Badge>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {shareRoles.map((r) => {
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
                                                            active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
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
                                            <Badge variant="outline" className="rounded-xl">{externalChannels.size}</Badge>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {externalChannelList.map((c) => {
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
                                                            active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
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

                                    <ToggleCard icon={Download} title="Allow download" desc="UI policy (enforce later in share model)" checked={allowDownload} onCheckedChange={setAllowDownload} />
                                    <ToggleCard icon={FileDown} title="Allow print" desc="UI policy (enforce later in share model)" checked={allowPrint} onCheckedChange={setAllowPrint} />
                                    <ToggleCard icon={Share2} title="Allow forward" desc="UI policy (enforce later in share model)" checked={allowForward} onCheckedChange={setAllowForward} />

                                    <Separator />

                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <Field label="Expiry (days)" hint="Backend uses this for share token expiry">
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
                                                    <div className="text-xs text-slate-500">Future (not enforced yet)</div>
                                                </div>
                                                <Switch checked={requireOtp} onCheckedChange={(v) => setRequireOtp(!!v)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                                        <div className="flex items-start gap-2">
                                            <UserPlus className="h-4 w-4" />
                                            User-specific permissions, consent, OTP, and channel delivery can be enforced after share model extension.
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
                                        {loading.audit ? (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                                                <div className="text-sm font-semibold text-slate-800">Loading audit…</div>
                                                <div className="mt-1 text-xs text-slate-500">Fetching from API.</div>
                                            </div>
                                        ) : audit?.length ? (
                                            <div className="space-y-2">
                                                {audit.map((a, idx) => (
                                                    <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge className="rounded-xl bg-slate-900 text-white">
                                                                    <History className="mr-1 h-3.5 w-3.5" />
                                                                    {a.action || "EVENT"}
                                                                </Badge>
                                                                <Badge variant="outline" className="rounded-xl">
                                                                    {a.by || "—"}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                {a.at ? `${fmtDate(a.at)} · ${fmtTime(a.at)}` : "—"}
                                                            </div>
                                                        </div>

                                                        {a.meta ? <div className="mt-2 text-xs text-slate-600">{String(a.meta)}</div> : null}
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
                                        Tip: Backend audit can store user_id, ip, ua, consent_ref, and document hash for medico-legal traceability.
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

// ---------------------------
// Small UI components
// ---------------------------
function Pill({ icon: Icon, label, value, toneClass }) {
    const cls = toneClass || "bg-slate-50 text-slate-700 ring-slate-200"
    return (
        <div className={cn("inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ring-1", cls)}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <span className="ml-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-slate-900 ring-1 ring-slate-200">
                {value}
            </span>
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
                        <Badge
                            className={cn(
                                "rounded-xl",
                                row.signed
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                    : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
                            )}
                        >
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
                <div
                    className={cn(
                        "grid h-11 w-11 place-items-center rounded-3xl ring-1 ring-slate-200",
                        disabled ? "bg-slate-50 text-slate-600" : "bg-slate-900 text-white ring-slate-900"
                    )}
                >
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
