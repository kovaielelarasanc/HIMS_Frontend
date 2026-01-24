// FILE: frontend/src/emr/EmrRecentPinned.jsx
// ✅ EMR Recent & Pinned (Quick Access) — Production-ready, API-driven
//
// Uses APIs:
// - GET  /api/emr/meta
// - GET  /api/emr/quick
// - POST /api/emr/quick/pin/patient
// - POST /api/emr/quick/pin/record
// - GET  /api/emr/patients/{patient_id}/encounters?limit=1
// - GET  /api/emr/records/{record_id}
//
// Routing assumptions (edit if your routes differ):
// - Patient Chart: /emr/chart?patient_id=...
// - Create Record: /emr/records/new?patient_id=...&encounter_type=...&encounter_id=...&dept_code=...
//
// Requires: shadcn/ui + Tailwind + react-router-dom + lucide-react + cn util.

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
    Search,
    Pin,
    PinOff,
    ArrowRight,
    Clock3,
    Calendar,
    Stethoscope,
    FileText,
    ClipboardList,
    Sparkles,
    UserRound,
    Layers,
    Filter,
    X,
    Play,
    ExternalLink,
    Star,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
    emrMetaGet,
    emrQuickGet,
    emrSetPatientPinned,
    emrSetRecordPinned,
    emrPatientEncounters,
    emrRecordGet,
    errMsg,
} from "@/api/emrApi"

/* ------------------------------- helpers ------------------------------- */

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
function isWithinDays(dateStr, days) {
    try {
        const t = new Date(dateStr).getTime()
        const now = Date.now()
        return now - t <= days * 24 * 60 * 60 * 1000
    } catch {
        return true
    }
}
function uniq(arr) {
    return Array.from(new Set((arr || []).filter(Boolean)))
}

function deptTone(deptRaw) {
    const d = (deptRaw || "").toUpperCase()
    const map = {
        OBGYN: {
            bar: "from-pink-500/75 via-rose-500/55 to-orange-400/45",
            chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(244,63,94,0.50)]",
            btn: "bg-rose-600 hover:bg-rose-700",
            iconBg: "bg-rose-50 text-rose-700 ring-rose-200",
        },
        CARDIOLOGY: {
            bar: "from-red-500/75 via-rose-500/55 to-amber-400/40",
            chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(239,68,68,0.50)]",
            btn: "bg-red-600 hover:bg-red-700",
            iconBg: "bg-red-50 text-red-700 ring-red-200",
        },
        ICU: {
            bar: "from-indigo-500/75 via-blue-500/55 to-cyan-400/40",
            chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(99,102,241,0.50)]",
            btn: "bg-indigo-600 hover:bg-indigo-700",
            iconBg: "bg-indigo-50 text-indigo-700 ring-indigo-200",
        },
        ORTHOPEDICS: {
            bar: "from-emerald-500/70 via-teal-500/55 to-lime-400/35",
            chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(16,185,129,0.50)]",
            btn: "bg-emerald-600 hover:bg-emerald-700",
            iconBg: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        },
        "GENERAL MEDICINE": {
            bar: "from-slate-500/65 via-zinc-500/45 to-sky-400/30",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.35)]",
            btn: "bg-slate-900 hover:bg-slate-800",
            iconBg: "bg-slate-50 text-slate-700 ring-slate-200",
        },
    }
    return (
        map[d] || {
            bar: "from-slate-500/65 via-slate-400/35 to-sky-400/25",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.25)]",
            btn: "bg-slate-900 hover:bg-slate-800",
            iconBg: "bg-slate-50 text-slate-700 ring-slate-200",
        }
    )
}

const TIME_RANGES = [
    { key: "TODAY", label: "Today", days: 1 },
    { key: "7D", label: "7 days", days: 7 },
    { key: "30D", label: "30 days", days: 30 },
    { key: "ALL", label: "All", days: 36500 },
]

/* ------------------------------- UI bits ------------------------------- */

function SoftIcon({ icon: Icon, tone, className }) {
    return (
        <div
            className={cn(
                "grid h-10 w-10 place-items-center rounded-2xl ring-1 ring-slate-200",
                tone?.iconBg || "bg-slate-50 text-slate-700",
                className
            )}
        >
            <Icon className="h-5 w-5" />
        </div>
    )
}

function PillBadge({ children, className, ...props }) {
    return (
        <Badge className={cn("rounded-xl", className)} {...props}>
            {children}
        </Badge>
    )
}

function EmptyBlock({ title, desc, action }) {
    return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-6 text-center backdrop-blur">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{desc}</div>
            {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
        </div>
    )
}

function ChipSelect({ value, onChange, options, icon: Icon }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {options.map((o) => {
                const active = o === value || o?.key === value
                const label = typeof o === "string" ? o : o.label
                const k = typeof o === "string" ? o : o.key
                return (
                    <button
                        key={k}
                        onClick={() => onChange?.(k)}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                            active ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:bg-white"
                        )}
                    >
                        {Icon ? <Icon className="h-3.5 w-3.5 text-slate-600" /> : null}
                        <span className="text-slate-800">{label}</span>
                    </button>
                )
            })}
        </div>
    )
}

function IconBtn({ title, onClick, children, disabled }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={!!disabled}
            className={cn(
                "grid h-9 w-9 place-items-center rounded-2xl ring-1 ring-slate-200 transition",
                disabled ? "cursor-not-allowed bg-slate-50 text-slate-300" : "bg-white text-slate-700 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    )
}

/* ------------------------------- main page ------------------------------- */

export default function EmrRecentPinned({
    // Optional: pass your logged-in clinician info for “My drafts”
    currentUser = { id: 1, name: "Clinician" },

    // Optional overrides for navigation
    onOpenChart, // (patient) => void
    onOpenRecord, // (record) => void
    onCreateRecord, // ({patient_id, encounter_type, encounter_id, dept_code}) => void

    // Optional: if you want to mount it as a TAB inside Patient Chart
    compact = false,
}) {
    const navigate = useNavigate()

    const [tab, setTab] = useState("patients") // patients | records | drafts
    const [q, setQ] = useState("")
    const [dept, setDept] = useState("ALL")
    const [range, setRange] = useState("7D")
    const [showFilters, setShowFilters] = useState(false)

    const [meta, setMeta] = useState(null)
    const [quick, setQuick] = useState(null)

    const [loading, setLoading] = useState(true)
    const [loadingPins, setLoadingPins] = useState({}) // key => boolean

    const [encByPatient, setEncByPatient] = useState({}) // patient_id -> encounter (latest)
    const [recordById, setRecordById] = useState({}) // record_id -> record

    const toastOnceRef = useRef(new Set())

    const timeDays = useMemo(() => TIME_RANGES.find((x) => x.key === range)?.days ?? 7, [range])

    const deptOptions = useMemo(() => {
        const items = meta?.departments || []
        return [{ key: "ALL", label: "All" }, ...items.map((d) => ({ key: d.code, label: d.name }))]
    }, [meta])

    const deptNameByCode = useMemo(() => {
        const m = new Map()
            ; (meta?.departments || []).forEach((d) => m.set(String(d.code || "").toUpperCase(), d.name))
        return m
    }, [meta])

    const recordTypeLabelByCode = useMemo(() => {
        const m = new Map()
            ; (meta?.record_types || []).forEach((t) => m.set(String(t.code || "").toUpperCase(), t.label))
        return m
    }, [meta])

    // Fetch meta + quick
    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoading(true)
                try {
                    const days = timeDays >= 36500 ? 36500 : timeDays
                    const [m, qk] = await Promise.all([
                        emrMetaGet().catch((e) => {
                            throw e
                        }),
                        emrQuickGet({ days, limitPatients: 50, limitRecords: 60, limitDrafts: 30 }).catch((e) => {
                            throw e
                        }),
                    ])
                    if (!alive) return
                    setMeta(m)
                    setQuick(qk)
                } catch (e) {
                    if (!alive) return
                    toast.error(errMsg(e, "Failed to load quick access"))
                    setQuick(null)
                } finally {
                    if (alive) setLoading(false)
                }
            })()
        return () => {
            alive = false
        }
        // refetch when range changes (because backend quick uses days)
    }, [timeDays])

    // Load latest encounters for displayed patients (batch via parallel calls)
    useEffect(() => {
        let alive = true
        if (!quick) return

        const pinnedIds = uniq(quick?.pinned_patients || [])
        const recentIds = uniq((quick?.recents || []).map((r) => r?.patient_id))
        const ids = uniq([...pinnedIds, ...recentIds]).slice(0, 80)

        const missing = ids.filter((pid) => !encByPatient[String(pid)])
        if (!missing.length) return

            ; (async () => {
                const results = await Promise.allSettled(
                    missing.map(async (pid) => {
                        const out = await emrPatientEncounters(pid, { limit: 1 })
                        const enc = out?.encounters?.[0] || null
                        return { pid, enc }
                    })
                )
                if (!alive) return
                setEncByPatient((prev) => {
                    const next = { ...prev }
                    for (const r of results) {
                        if (r.status === "fulfilled") {
                            next[String(r.value.pid)] = r.value.enc
                        }
                    }
                    return next
                })
            })()

        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quick])

    // Load record details for pinned/recent/drafts (batch via parallel calls)
    useEffect(() => {
        let alive = true
        if (!quick) return

        const pinned = uniq(quick?.pinned_records || [])
        const recentViewed = uniq(
            (quick?.recents || [])
                .map((x) => x?.record_id)
                .filter((rid) => rid && Number(rid) !== 0)
        )
        const drafts = uniq((quick?.resume_drafts || []).map((d) => d?.record_id))

        const ids = uniq([...pinned, ...recentViewed, ...drafts]).slice(0, 120)
        const missing = ids.filter((rid) => !recordById[String(rid)])

        if (!missing.length) return

            ; (async () => {
                const results = await Promise.allSettled(
                    missing.map(async (rid) => {
                        console.log(rid, "1234567890");

                        const rec = await emrRecordGet(rid)
                        return { rid, rec }
                    })
                )
                if (!alive) return
                setRecordById((prev) => {
                    const next = { ...prev }
                    for (const r of results) {
                        if (r.status === "fulfilled" && r.value?.rec) {
                            next[String(r.value.rid)] = r.value.rec
                        }
                    }
                    return next
                })
            })()

        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quick])

    // helper: last seen per patient (from quick.recents)
    const lastSeenByPatient = useMemo(() => {
        const m = new Map()
            ; (quick?.recents || []).forEach((r) => {
                const pid = String(r?.patient_id || "")
                if (!pid) return
                const t = r?.last_seen_at || null
                if (!t) return
                const prev = m.get(pid)
                if (!prev || new Date(t).getTime() > new Date(prev).getTime()) m.set(pid, t)
            })
        return m
    }, [quick])

    const pinnedPatients = useMemo(() => uniq(quick?.pinned_patients || []), [quick])
    const pinnedRecords = useMemo(() => uniq(quick?.pinned_records || []), [quick])

    // Build patient objects for UI
    const allPatients = useMemo(() => {
        const patientMap = quick?.patient_map || {}
        const ids = uniq([
            ...(quick?.pinned_patients || []),
            ...((quick?.recents || []).map((r) => r?.patient_id) || []),
        ])

        return ids
            .map((pid) => {
                const p = patientMap?.[String(pid)] || {}
                const enc = encByPatient[String(pid)] || null
                const lastSeen = lastSeenByPatient.get(String(pid)) || null

                const deptCode = enc?.department_code || null
                const deptName = enc?.department_name || (deptCode ? deptNameByCode.get(String(deptCode).toUpperCase()) : null)

                return {
                    id: String(pid),
                    uhid: p?.uhid || "—",
                    name: p?.full_name || p?.name || "—",
                    phone: p?.phone || "",
                    last_seen_at: lastSeen,
                    last_encounter: enc
                        ? {
                            encounter_type: enc.encounter_type,
                            encounter_id: enc.encounter_id,
                            department_code: enc.department_code,
                            department_name: deptName || enc.department_name || "—",
                            doctor_name: enc.doctor_name || "—",
                            when: enc.encounter_at || lastSeen,
                        }
                        : null,
                }
            })
            .filter(Boolean)
    }, [quick, encByPatient, lastSeenByPatient, deptNameByCode])

    const filteredPatients = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        return (allPatients || [])
            .filter((p) => {
                const enc = p.last_encounter
                const deptCode = String(enc?.department_code || "").toUpperCase()
                if (dept === "ALL") return true
                return deptCode === String(dept).toUpperCase()
            })
            .filter((p) => {
                const when = p?.last_encounter?.when || p?.last_seen_at
                if (timeDays >= 36500) return true
                return isWithinDays(when, timeDays)
            })
            .filter((p) => {
                if (!qq) return true
                const hay = `${p.name} ${p.uhid} ${p.phone} ${p.last_encounter?.department_name || ""} ${p.last_encounter?.doctor_name || ""}`.toLowerCase()
                return hay.includes(qq)
            })
            .sort((a, b) => {
                const ta = new Date(a?.last_encounter?.when || a?.last_seen_at || 0).getTime()
                const tb = new Date(b?.last_encounter?.when || b?.last_seen_at || 0).getTime()
                return tb - ta
            })
    }, [allPatients, q, dept, timeDays])

    const pinnedPatientObjs = useMemo(() => {
        const set = new Set(pinnedPatients || [])
        return filteredPatients.filter((p) => set.has(p.id))
    }, [filteredPatients, pinnedPatients])

    const recentPatientObjs = useMemo(() => {
        const set = new Set(pinnedPatients || [])
        return filteredPatients.filter((p) => !set.has(p.id)).slice(0, 16)
    }, [filteredPatients, pinnedPatients])

    // Build record objects for UI (from recordById + quick.record_map fallback)
    const allRecentRecordIds = useMemo(() => {
        const ids = (quick?.recents || [])
            .map((x) => x?.record_id)
            .filter((rid) => rid && Number(rid) !== 0)
        return uniq(ids).slice(0, 40)
    }, [quick])

    const filteredRecords = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        const rmapFallback = quick?.record_map || {}
        const pmap = quick?.patient_map || {}

        const recs = allRecentRecordIds.map((rid) => {
            const rec = recordById[String(rid)] || null
            const fb = rmapFallback[String(rid)] || {}
            const patientId = String(rec?.patient_id || fb?.patient_id || "")
            const p = pmap?.[patientId] || {}

            const deptCode = rec?.dept_code || rec?.deptCode || fb?.dept_code || fb?.deptCode || ""
            const deptName = deptCode ? (deptNameByCode.get(String(deptCode).toUpperCase()) || deptCode) : "—"

            const typeCode = rec?.record_type_code || rec?.recordTypeCode || fb?.record_type_code || ""
            const typeLabel = typeCode ? (recordTypeLabelByCode.get(String(typeCode).toUpperCase()) || typeCode) : "—"

            const when = rec?.updated_at || rec?.created_at || fb?.updated_at || fb?.last_seen_at || null

            return {
                id: String(rid),
                patient_id: patientId,
                patient_name: p?.full_name || p?.name || "—",
                patient_uhid: p?.uhid || "—",
                dept_code: deptCode,
                dept: deptName,
                type: typeLabel,
                title: rec?.title || fb?.title || "—",
                status: rec?.status || fb?.status || "—",
                when,
            }
        })

        return recs
            .filter(Boolean)
            .filter((r) => {
                if (dept === "ALL") return true
                return String(r.dept_code || "").toUpperCase() === String(dept).toUpperCase()
            })
            .filter((r) => {
                if (timeDays >= 36500) return true
                return isWithinDays(r.when, timeDays)
            })
            .filter((r) => {
                if (!qq) return true
                const hay = `${r.title} ${r.type} ${r.dept} ${r.patient_name} ${r.patient_uhid} ${r.status}`.toLowerCase()
                return hay.includes(qq)
            })
            .sort((a, b) => new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime())
    }, [allRecentRecordIds, recordById, quick, q, dept, timeDays, deptNameByCode, recordTypeLabelByCode])

    const pinnedRecordObjs = useMemo(() => {
        const set = new Set(pinnedRecords || [])
        return filteredRecords.filter((r) => set.has(r.id))
    }, [filteredRecords, pinnedRecords])

    const recentRecordObjs = useMemo(() => {
        const set = new Set(pinnedRecords || [])
        return filteredRecords.filter((r) => !set.has(r.id)).slice(0, 20)
    }, [filteredRecords, pinnedRecords])

    // Drafts
    const myDrafts = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        const drafts = quick?.resume_drafts || []
        const pmap = quick?.patient_map || {}

        // resume_drafts already mine (backend filters by created_by_user_id in quick_get)
        // If you want strict mine: compare recordById[record_id].created_by_user_id to currentUser.id
        return drafts
            .map((d) => {
                const rec = recordById[String(d.record_id)] || null
                const patientId = String(d.patient_id || rec?.patient_id || "")
                const p = pmap?.[patientId] || {}
                const deptCode = d?.dept_code || rec?.dept_code || ""
                const deptName = deptCode ? (deptNameByCode.get(String(deptCode).toUpperCase()) || deptCode) : "—"

                const encType = rec?.encounter_type || rec?.encounterType || null
                const encId = rec?.encounter_id || rec?.encounterId || null

                return {
                    id: String(d.record_id),
                    record_id: String(d.record_id),
                    patient_id: patientId,
                    patient_name: p?.full_name || p?.name || "—",
                    patient_uhid: p?.uhid || "—",
                    dept_code: deptCode,
                    dept: deptName,
                    title: d?.title || rec?.title || "—",
                    updated_at: d?.updated_at || rec?.updated_at || null,
                    visit: encType && encId ? { encType, encId } : null,
                }
            })
            .filter((d) => {
                if (dept === "ALL") return true
                return String(d.dept_code || "").toUpperCase() === String(dept).toUpperCase()
            })
            .filter((d) => {
                if (timeDays >= 36500) return true
                return isWithinDays(d.updated_at, timeDays)
            })
            .filter((d) => {
                if (!qq) return true
                const hay = `${d.title} ${d.dept} ${d.patient_name} ${d.patient_uhid}`.toLowerCase()
                return hay.includes(qq)
            })
            .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
    }, [quick, recordById, currentUser?.id, q, dept, timeDays, deptNameByCode])

    function openChart(patient) {
        if (onOpenChart) return onOpenChart(patient)
        navigate(`/emr/chart?patient_id=${encodeURIComponent(patient.id)}`)
    }

    function openRecord(record) {
        if (onOpenRecord) return onOpenRecord(record)
        navigate(
            `/emr/chart?patient_id=${encodeURIComponent(record.patient_id)}&record_id=${encodeURIComponent(record.id)}`
        )
    }

    function createRecord(patient) {
        const enc = patient?.last_encounter
        if (!enc?.encounter_type || !enc?.encounter_id) {
            // prevent bad payloads like your "encounter_type: null" / "encounter_id: null"
            const key = `no-enc-${patient?.id}`
            if (!toastOnceRef.current.has(key)) {
                toastOnceRef.current.add(key)
                toast.error("No recent encounter found for this patient. Open chart and select an encounter.")
            }
            return openChart(patient)
        }

        const payload = {
            patient_id: patient.id,
            encounter_type: enc.encounter_type,
            encounter_id: enc.encounter_id,
            dept_code: enc.department_code || null,
        }

        if (onCreateRecord) return onCreateRecord(payload)

        const qs = new URLSearchParams()
        qs.set("patient_id", String(payload.patient_id))
        qs.set("encounter_type", String(payload.encounter_type))
        qs.set("encounter_id", String(payload.encounter_id))
        if (payload.dept_code) qs.set("dept_code", String(payload.dept_code))
        navigate(`/emr/records/new?${qs.toString()}`)
    }

    async function togglePinPatient(id) {
        const key = `pp:${id}`
        if (loadingPins[key]) return
        const isPinned = pinnedPatients.includes(String(id))
        setLoadingPins((p) => ({ ...p, [key]: true }))
        try {
            await emrSetPatientPinned(id, !isPinned)
            setQuick((prev) => {
                const cur = prev || {}
                const arr = uniq(cur.pinned_patients || [])
                const next = isPinned ? arr.filter((x) => String(x) !== String(id)) : uniq([...arr, String(id)])
                return { ...cur, pinned_patients: next }
            })
            toast.success(isPinned ? "Patient unpinned" : "Patient pinned")
        } catch (e) {
            toast.error(errMsg(e, "Failed to update pin"))
        } finally {
            setLoadingPins((p) => ({ ...p, [key]: false }))
        }
    }

    async function togglePinRecord(id) {
        const key = `pr:${id}`
        if (loadingPins[key]) return
        const isPinned = pinnedRecords.includes(String(id))
        setLoadingPins((p) => ({ ...p, [key]: true }))
        try {
            await emrSetRecordPinned(id, !isPinned)
            setQuick((prev) => {
                const cur = prev || {}
                const arr = uniq(cur.pinned_records || [])
                const next = isPinned ? arr.filter((x) => String(x) !== String(id)) : uniq([...arr, String(id)])
                return { ...cur, pinned_records: next }
            })
            toast.success(isPinned ? "Record unpinned" : "Record pinned")
        } catch (e) {
            toast.error(errMsg(e, "Failed to update pin"))
        } finally {
            setLoadingPins((p) => ({ ...p, [key]: false }))
        }
    }

    function resetFilters() {
        setQ("")
        setDept("ALL")
        setRange("7D")
        toast.success("Filters cleared")
    }

    return (
        <div
            className={cn(
                "w-full",
                compact ? "min-h-full" : "min-h-[100dvh]",
                "bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60"
            )}
        >
            <div className={cn("mx-auto w-full max-w-[1400px]", compact ? "p-0" : "p-4 md:p-6")}>
                {/* Sticky Header */}
                <div className={cn(compact ? "" : "sticky top-0 z-20 -mx-4 md:-mx-6")}>
                    <div
                        className={cn(
                            "rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-xl shadow-sm",
                            compact ? "rounded-none border-x-0 border-t-0" : "px-4 py-4 md:px-6"
                        )}
                    >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                                        <Sparkles className="h-5 w-5 text-slate-800" />
                                    </div>
                                    <div>
                                        <div className="text-base font-semibold text-slate-900">Recent & Pinned</div>
                                        <div className="text-xs text-slate-500">
                                            Fastest entry for doctors/nurses · resume drafts · continue last encounter
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
                                {/* Search */}
                                <div className="relative w-full lg:w-[360px]">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                    <Input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search patient / UHID / record title / department…"
                                        className="h-10 rounded-2xl pl-9"
                                    />
                                    {q?.trim() ? (
                                        <button
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                                            onClick={() => setQ("")}
                                            title="Clear"
                                            type="button"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    ) : null}
                                </div>

                                {/* Quick actions */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button variant="outline" className="h-10 rounded-2xl" onClick={() => setShowFilters((s) => !s)}>
                                        <Filter className="mr-2 h-4 w-4" />
                                        Filters
                                    </Button>

                                    <Button variant="outline" className="h-10 rounded-2xl" onClick={resetFilters} title="Clear filters">
                                        <X className="mr-2 h-4 w-4" />
                                        Reset
                                    </Button>

                                    <Button className="h-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => navigate("/emr/chart")}>
                                        EMR Chart <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Filters row */}
                        {showFilters ? (
                            <div className="mt-4 space-y-3">
                                <Separator />
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <ChipSelect value={dept} onChange={setDept} options={deptOptions} icon={Layers} />
                                    <ChipSelect value={range} onChange={setRange} options={TIME_RANGES} icon={Clock3} />
                                </div>
                            </div>
                        ) : null}

                        {/* Tabs */}
                        <div className="mt-4">
                            <Tabs value={tab} onValueChange={setTab}>
                                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    <TabsList className="w-max min-w-full justify-start gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                                        <TabsTrigger value="patients" className="whitespace-nowrap rounded-xl">
                                            Patients
                                        </TabsTrigger>
                                        <TabsTrigger value="records" className="whitespace-nowrap rounded-xl">
                                            Records
                                        </TabsTrigger>
                                        <TabsTrigger value="drafts" className="whitespace-nowrap rounded-xl">
                                            My Drafts
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {/* Content */}
                                <div className="mt-4">
                                    <TabsContent value="patients">
                                        <div className="space-y-4">
                                            <SectionCard
                                                title="Pinned Patients"
                                                subtitle="Your shortcuts — one click to open chart or continue last encounter"
                                                count={pinnedPatientObjs.length}
                                                icon={Star}
                                            >
                                                {loading ? (
                                                    <EmptyBlock title="Loading…" desc="Fetching pinned patients." />
                                                ) : pinnedPatientObjs.length ? (
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                        {pinnedPatientObjs.map((p) => (
                                                            <PatientCard
                                                                key={p.id}
                                                                patient={p}
                                                                pinned
                                                                onPin={() => togglePinPatient(p.id)}
                                                                onOpen={() => openChart(p)}
                                                                onContinue={() => createRecord(p)}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyBlock title="No pinned patients" desc="Pin frequent patients to access instantly." />
                                                )}
                                            </SectionCard>

                                            <SectionCard
                                                title="Recent Patients"
                                                subtitle="Patients you opened recently (based on activity) — filtered by your settings"
                                                count={recentPatientObjs.length}
                                                icon={UserRound}
                                            >
                                                {loading ? (
                                                    <EmptyBlock title="Loading…" desc="Fetching recent patients." />
                                                ) : recentPatientObjs.length ? (
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                        {recentPatientObjs.map((p) => (
                                                            <PatientCard
                                                                key={p.id}
                                                                patient={p}
                                                                pinned={pinnedPatients.includes(p.id)}
                                                                onPin={() => togglePinPatient(p.id)}
                                                                onOpen={() => openChart(p)}
                                                                onContinue={() => createRecord(p)}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyBlock title="No recent patients" desc="Try expanding the date range or clearing filters." />
                                                )}
                                            </SectionCard>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="records">
                                        <div className="space-y-4">
                                            <SectionCard
                                                title="Pinned Records"
                                                subtitle="Important records you want to revisit quickly"
                                                count={pinnedRecordObjs.length}
                                                icon={Pin}
                                            >
                                                {loading ? (
                                                    <EmptyBlock title="Loading…" desc="Fetching pinned records." />
                                                ) : pinnedRecordObjs.length ? (
                                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                                        {pinnedRecordObjs.map((r) => (
                                                            <RecordCard
                                                                key={r.id}
                                                                record={r}
                                                                pinned
                                                                onPin={() => togglePinRecord(r.id)}
                                                                onOpen={() => openRecord(r)}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyBlock title="No pinned records" desc="Pin key reports, summaries, or important notes." />
                                                )}
                                            </SectionCard>

                                            <SectionCard
                                                title="Recent Records"
                                                subtitle="Records you opened recently (based on activity)"
                                                count={recentRecordObjs.length}
                                                icon={FileText}
                                            >
                                                {loading ? (
                                                    <EmptyBlock title="Loading…" desc="Fetching recent records." />
                                                ) : recentRecordObjs.length ? (
                                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                                        {recentRecordObjs.map((r) => (
                                                            <RecordCard
                                                                key={r.id}
                                                                record={r}
                                                                pinned={pinnedRecords.includes(r.id)}
                                                                onPin={() => togglePinRecord(r.id)}
                                                                onOpen={() => openRecord(r)}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyBlock title="No recent records" desc="Open a chart/record to populate this list." />
                                                )}
                                            </SectionCard>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="drafts">
                                        <div className="space-y-4">
                                            <SectionCard
                                                title="Quick Resume Drafts"
                                                subtitle="Continue unfinished work — fastest way to finish daily documentation"
                                                count={myDrafts.length}
                                                icon={Play}
                                            >
                                                {loading ? (
                                                    <EmptyBlock title="Loading…" desc="Fetching drafts." />
                                                ) : myDrafts.length ? (
                                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                                        {myDrafts.map((d) => (
                                                            <DraftCard
                                                                key={d.id}
                                                                draft={d}
                                                                onResume={() => {
                                                                    // safest generic resume route:
                                                                    navigate(`/emr/chart?patient_id=${encodeURIComponent(d.patient_id)}&record_id=${encodeURIComponent(d.record_id)}`)
                                                                }}
                                                                onOpenPatient={() => navigate(`/emr/chart?patient_id=${encodeURIComponent(d.patient_id)}`)}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyBlock
                                                        title="No drafts"
                                                        desc="Great — you’re fully caught up."
                                                        action={
                                                            <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => navigate("/emr/chart")}>
                                                                Go to EMR Chart <ArrowRight className="ml-2 h-4 w-4" />
                                                            </Button>
                                                        }
                                                    />
                                                )}
                                            </SectionCard>

                                            <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                                                            <Sparkles className="h-5 w-5 text-slate-800" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-semibold text-slate-900">UX Tip</div>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                Best daily flow: <span className="font-semibold text-slate-700">Open pinned patients</span> → resume{" "}
                                                                <span className="font-semibold text-slate-700">drafts</span> → finish and{" "}
                                                                <span className="font-semibold text-slate-700">sign</span>.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </div>
                    </div>
                </div>

                {/* bottom spacing so nothing hides under fixed shells */}
                <div className={cn(compact ? "h-2" : "h-8")} />
            </div>
        </div>
    )
}

/* ------------------------------- section + cards ------------------------------- */

function SectionCard({ title, subtitle, count, icon: Icon, children }) {
    return (
        <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
            <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <CardTitle className="text-base">{title}</CardTitle>
                        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <PillBadge variant="outline" className="rounded-xl">
                            <Icon className="mr-1 h-3.5 w-3.5" />
                            {count ?? 0}
                        </PillBadge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">{children}</CardContent>
        </Card>
    )
}

function PatientCard({ patient, pinned, onPin, onOpen, onContinue }) {
    console.log(patient, "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww");

    const enc = patient?.last_encounter
    const tone = deptTone(enc?.department_name || enc?.department_code || "")
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300",
                tone.glow
            )}
        >
            <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <PillBadge className={cn("rounded-xl", tone.chip)}>
                                <Stethoscope className="mr-1 h-3.5 w-3.5" />
                                {enc?.department_name || "—"}
                            </PillBadge>
                            <PillBadge variant="outline" className="rounded-xl">
                                <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                {(enc?.encounter_type || "—") + " · " + (enc?.encounter_id || "—")}
                            </PillBadge>
                            {pinned ? (
                                <PillBadge className="rounded-xl bg-slate-900 text-white">
                                    <Pin className="mr-1 h-3.5 w-3.5" />
                                    Pinned
                                </PillBadge>
                            ) : null}
                        </div>

                        <div className="mt-2 truncate text-sm font-semibold text-slate-900">
                            {patient.name} <span className="text-slate-400">·</span> {patient.uhid}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" /> {fmtDate(enc?.when || patient?.last_seen_at)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" /> {fmtTime(enc?.when || patient?.last_seen_at)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5" /> {enc?.doctor_name || "—"}
                            </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button variant="outline" className="h-9 rounded-2xl" onClick={onOpen}>
                                Open Chart <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                            <Button className={cn("h-9 rounded-2xl", tone.btn)} onClick={onContinue}>
                                Continue <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <IconBtn title={pinned ? "Unpin" : "Pin"} onClick={onPin}>
                            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </IconBtn>
                    </div>
                </div>
            </div>
        </div>
    )
}

function statusChip(status) {
    const s = (status || "").toUpperCase()
    if (s === "DRAFT") return "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
    if (s === "SIGNED") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
    if (s === "RESULT") return "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200"
    return "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
}

function RecordCard({ record, pinned, onPin, onOpen }) {
    const tone = deptTone(record?.dept || "")
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300",
                tone.glow
            )}
        >
            <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <PillBadge className={cn("rounded-xl", tone.chip)}>
                                <Stethoscope className="mr-1 h-3.5 w-3.5" />
                                {record.dept}
                            </PillBadge>
                            <PillBadge className={cn("rounded-xl", statusChip(record.status))}>{record.status}</PillBadge>
                            {pinned ? (
                                <PillBadge className="rounded-xl bg-slate-900 text-white">
                                    <Pin className="mr-1 h-3.5 w-3.5" />
                                    Pinned
                                </PillBadge>
                            ) : null}
                        </div>

                        <div className="mt-2 text-sm font-semibold text-slate-900">{record.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                            {record.patient_name} <span className="text-slate-300">·</span> {record.patient_uhid}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" /> {fmtDate(record.when)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" /> {fmtTime(record.when)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5" /> {record.type}
                            </span>
                        </div>

                        <div className="mt-3">
                            <Button variant="outline" className="h-9 rounded-2xl" onClick={onOpen}>
                                Open Record <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <IconBtn title={pinned ? "Unpin" : "Pin"} onClick={onPin}>
                            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </IconBtn>
                    </div>
                </div>
            </div>
        </div>
    )
}

function DraftCard({ draft, onResume, onOpenPatient }) {
    const tone = deptTone(draft?.dept)
    return (
        <div className={cn("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm", tone.glow)}>
            <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <PillBadge className={cn("rounded-xl", tone.chip)}>
                                <Stethoscope className="mr-1 h-3.5 w-3.5" />
                                {draft.dept}
                            </PillBadge>
                            <PillBadge className={cn("rounded-xl", statusChip("DRAFT"))}>DRAFT</PillBadge>
                            {draft.visit ? (
                                <PillBadge variant="outline" className="rounded-xl">
                                    <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                    {draft.visit?.encType} · {draft.visit?.encId}
                                </PillBadge>
                            ) : null}
                        </div>

                        <div className="mt-2 text-sm font-semibold text-slate-900">{draft.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                            {draft.patient_name} <span className="text-slate-300">·</span> {draft.patient_uhid}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" /> Updated {fmtDate(draft.updated_at)} {fmtTime(draft.updated_at)}
                            </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button className={cn("h-9 rounded-2xl", tone.btn)} onClick={onResume}>
                                <Play className="mr-2 h-4 w-4" />
                                Resume Draft
                            </Button>
                            <Button variant="outline" className="h-9 rounded-2xl" onClick={onOpenPatient}>
                                Open Patient <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <SoftIcon icon={FileText} tone={tone} />
                </div>
            </div>
        </div>
    )
}
