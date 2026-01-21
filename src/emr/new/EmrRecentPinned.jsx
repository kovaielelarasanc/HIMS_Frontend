// FILE: frontend/src/emr/EmrRecentPinned.jsx
// ✅ EMR Recent & Pinned (Quick Access) — UI Only (Apple-premium, responsive, multicolor tone)
// - Recent patients / records
// - Pinned patients / records (persisted in localStorage)
// - Quick resume drafts + continue last visit
//
// Routing assumptions (edit if your routes differ):
// - Patient Chart: /emr/chart?patient_id=...
// - Create Record: /emr/records/new?patient_id=...&visit_id=...
//
// Requires: shadcn/ui + Tailwind + react-router-dom + lucide-react + cn util.

import React, { useEffect, useMemo, useState } from "react"
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

/* ------------------------------- helpers ------------------------------- */

const LS_KEYS = {
    pinnedPatients: "emr.pinned.patients.v1",
    pinnedRecords: "emr.pinned.records.v1",
}

function safeJsonParse(v, fallback) {
    try {
        const x = JSON.parse(v)
        return x ?? fallback
    } catch {
        return fallback
    }
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
        return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    } catch {
        return ""
    }
}

function isWithinDays(dateStr, days) {
    try {
        const t = new Date(dateStr).getTime()
        const now = Date.now()
        const delta = now - t
        return delta <= days * 24 * 60 * 60 * 1000
    } catch {
        return true
    }
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

const DEPTS = ["ALL", "OBGYN", "Cardiology", "ICU", "Orthopedics", "General Medicine", "General Surgery"]

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
                            active
                                ? "border-slate-300 bg-white shadow-sm"
                                : "border-slate-200 bg-white/60 hover:bg-white"
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
                disabled
                    ? "cursor-not-allowed bg-slate-50 text-slate-300"
                    : "bg-white text-slate-700 hover:bg-slate-50"
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
    onCreateRecord, // ({patient_id, visit_id}) => void

    // Optional: if you want to mount it as a TAB inside Patient Chart
    compact = false,
}) {
    const navigate = useNavigate()

    const [tab, setTab] = useState("patients") // patients | records | drafts
    const [q, setQ] = useState("")
    const [dept, setDept] = useState("ALL")
    const [range, setRange] = useState("7D")
    const [showFilters, setShowFilters] = useState(false)

    const [pinnedPatients, setPinnedPatients] = useState([])
    const [pinnedRecords, setPinnedRecords] = useState([])

    // Dummy: patients + visits + records + drafts
    const data = useMemo(() => seedDummyData(currentUser), [currentUser?.id])

    // load pins
    useEffect(() => {
        const pp = safeJsonParse(localStorage.getItem(LS_KEYS.pinnedPatients), [])
        const pr = safeJsonParse(localStorage.getItem(LS_KEYS.pinnedRecords), [])
        setPinnedPatients(Array.isArray(pp) ? pp : [])
        setPinnedRecords(Array.isArray(pr) ? pr : [])
    }, [])

    // persist pins
    useEffect(() => {
        localStorage.setItem(LS_KEYS.pinnedPatients, JSON.stringify(pinnedPatients || []))
    }, [pinnedPatients])

    useEffect(() => {
        localStorage.setItem(LS_KEYS.pinnedRecords, JSON.stringify(pinnedRecords || []))
    }, [pinnedRecords])

    const timeDays = useMemo(() => TIME_RANGES.find((x) => x.key === range)?.days ?? 7, [range])

    const filteredPatients = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        return (data.patients || [])
            .filter((p) => (dept === "ALL" ? true : (p.last_visit?.dept || "").toUpperCase() === dept.toUpperCase()))
            .filter((p) => (timeDays >= 36500 ? true : isWithinDays(p.last_visit?.when, timeDays)))
            .filter((p) => {
                if (!qq) return true
                const hay = `${p.name} ${p.uhid} ${p.phone} ${p.last_visit?.dept || ""} ${p.last_visit?.doctor || ""}`.toLowerCase()
                return hay.includes(qq)
            })
            .sort((a, b) => new Date(b.last_visit?.when).getTime() - new Date(a.last_visit?.when).getTime())
    }, [data.patients, q, dept, timeDays])

    const filteredRecords = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        return (data.records || [])
            .filter((r) => (dept === "ALL" ? true : (r.dept || "").toUpperCase() === dept.toUpperCase()))
            .filter((r) => (timeDays >= 36500 ? true : isWithinDays(r.when, timeDays)))
            .filter((r) => {
                if (!qq) return true
                const hay = `${r.title} ${r.type} ${r.dept} ${r.patient_name} ${r.patient_uhid} ${r.status}`.toLowerCase()
                return hay.includes(qq)
            })
            .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    }, [data.records, q, dept, timeDays])

    const myDrafts = useMemo(() => {
        const qq = (q || "").trim().toLowerCase()
        return (data.drafts || [])
            .filter((d) => d.owner_id === currentUser?.id)
            .filter((d) => (dept === "ALL" ? true : (d.dept || "").toUpperCase() === dept.toUpperCase()))
            .filter((d) => (timeDays >= 36500 ? true : isWithinDays(d.updated_at, timeDays)))
            .filter((d) => {
                if (!qq) return true
                const hay = `${d.title} ${d.dept} ${d.patient_name} ${d.patient_uhid}`.toLowerCase()
                return hay.includes(qq)
            })
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }, [data.drafts, currentUser?.id, q, dept, timeDays])

    const pinnedPatientObjs = useMemo(() => {
        const set = new Set(pinnedPatients || [])
        return filteredPatients.filter((p) => set.has(p.id))
    }, [filteredPatients, pinnedPatients])

    const recentPatientObjs = useMemo(() => {
        const set = new Set(pinnedPatients || [])
        return filteredPatients.filter((p) => !set.has(p.id)).slice(0, 16)
    }, [filteredPatients, pinnedPatients])

    const pinnedRecordObjs = useMemo(() => {
        const set = new Set(pinnedRecords || [])
        return filteredRecords.filter((r) => set.has(r.id))
    }, [filteredRecords, pinnedRecords])

    const recentRecordObjs = useMemo(() => {
        const set = new Set(pinnedRecords || [])
        return filteredRecords.filter((r) => !set.has(r.id)).slice(0, 20)
    }, [filteredRecords, pinnedRecords])

    function openChart(patient) {
        if (onOpenChart) return onOpenChart(patient)
        navigate(`/emr/chart?patient_id=${encodeURIComponent(patient.id)}`)
    }

    function openRecord(record) {
        if (onOpenRecord) return onOpenRecord(record)
        navigate(`/emr/chart?patient_id=${encodeURIComponent(record.patient_id)}&record_id=${encodeURIComponent(record.id)}`)
    }

    function createRecord(patient) {
        const visit = patient?.last_visit
        if (!visit) return toast.error("No visit available for this patient")
        if (onCreateRecord) return onCreateRecord({ patient_id: patient.id, visit_id: visit.id })
        navigate(`/emr/records/new?patient_id=${encodeURIComponent(patient.id)}&visit_id=${encodeURIComponent(visit.id)}`)
    }

    function togglePinPatient(id) {
        setPinnedPatients((p) => {
            const set = new Set(p || [])
            if (set.has(id)) set.delete(id)
            else set.add(id)
            return [...set]
        })
    }

    function togglePinRecord(id) {
        setPinnedRecords((p) => {
            const set = new Set(p || [])
            if (set.has(id)) set.delete(id)
            else set.add(id)
            return [...set]
        })
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
                                            Fastest entry for doctors/nurses · resume drafts · continue last visit
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
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-2xl"
                                        onClick={() => setShowFilters((s) => !s)}
                                    >
                                        <Filter className="mr-2 h-4 w-4" />
                                        Filters
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-2xl"
                                        onClick={resetFilters}
                                        title="Clear filters"
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Reset
                                    </Button>

                                    <Button
                                        className="h-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                        onClick={() => navigate("/emr/chart")}
                                    >
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
                                    <ChipSelect value={dept} onChange={setDept} options={DEPTS} icon={Layers} />
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
                                            {/* Pinned Patients */}
                                            <SectionCard
                                                title="Pinned Patients"
                                                subtitle="Your shortcuts — one click to open chart or continue last visit"
                                                count={pinnedPatientObjs.length}
                                                icon={Star}
                                            >
                                                {pinnedPatientObjs.length ? (
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
                                                    <EmptyBlock
                                                        title="No pinned patients"
                                                        desc="Pin frequent patients to access instantly."
                                                    />
                                                )}
                                            </SectionCard>

                                            {/* Recent Patients */}
                                            <SectionCard
                                                title="Recent Patients"
                                                subtitle="Recently opened patients (based on activity) — filtered by your settings"
                                                count={recentPatientObjs.length}
                                                icon={UserRound}
                                            >
                                                {recentPatientObjs.length ? (
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
                                            {/* Pinned Records */}
                                            <SectionCard
                                                title="Pinned Records"
                                                subtitle="Important records you want to revisit quickly"
                                                count={pinnedRecordObjs.length}
                                                icon={Pin}
                                            >
                                                {pinnedRecordObjs.length ? (
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
                                                    <EmptyBlock
                                                        title="No pinned records"
                                                        desc="Pin key reports, summaries, or important notes."
                                                    />
                                                )}
                                            </SectionCard>

                                            {/* Recent Records */}
                                            <SectionCard
                                                title="Recent Records"
                                                subtitle="Latest clinical notes, results, and documents"
                                                count={recentRecordObjs.length}
                                                icon={FileText}
                                            >
                                                {recentRecordObjs.length ? (
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
                                                    <EmptyBlock title="No recent records" desc="Try expanding the date range or clearing filters." />
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
                                                {myDrafts.length ? (
                                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                                        {myDrafts.map((d) => (
                                                            <DraftCard
                                                                key={d.id}
                                                                draft={d}
                                                                onResume={() => {
                                                                    toast("Resume (UI only) — route this to your draft editor screen")
                                                                    navigate(`/emr/chart?patient_id=${encodeURIComponent(d.patient_id)}&draft_id=${encodeURIComponent(d.id)}`)
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
                                                            <Button
                                                                className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                                                onClick={() => navigate("/emr/chart")}
                                                            >
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
                                                                Best daily flow: <span className="font-semibold text-slate-700">Open pinned patients</span> →
                                                                resume <span className="font-semibold text-slate-700">drafts</span> →
                                                                finish and <span className="font-semibold text-slate-700">sign</span>.
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
    const tone = deptTone(patient?.last_visit?.dept)
    const visit = patient?.last_visit

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
                                {visit?.dept || "—"}
                            </PillBadge>
                            <PillBadge variant="outline" className="rounded-xl">
                                <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                {visit?.encType || "—"} · {visit?.encId || "—"}
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
                                <Calendar className="h-3.5 w-3.5" /> {fmtDate(visit?.when)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" /> {fmtTime(visit?.when)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5" /> {visit?.doctor || "—"}
                            </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button variant="outline" className="h-9 rounded-2xl" onClick={onOpen}>
                                Open Chart <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                            <Button className={cn("h-9 rounded-2xl", tone.btn)} onClick={onContinue}>
                                Continue Visit <ArrowRight className="ml-2 h-4 w-4" />
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
    const tone = deptTone(record?.dept)
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
                            <PillBadge className={cn("rounded-xl", statusChip(record.status))}>
                                {record.status}
                            </PillBadge>
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
                            <PillBadge variant="outline" className="rounded-xl">
                                <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                {draft.visit?.encType} · {draft.visit?.encId}
                            </PillBadge>
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

/* ------------------------------- dummy dataset ------------------------------- */

function seedDummyData(currentUser) {
    // You’ll replace with API later:
    // - GET /emr/recent?range=7D&dept=...
    // - GET /emr/pins
    // - GET /emr/drafts?mine=1
    const patients = [
        {
            id: "P-1001",
            uhid: "NH-000122",
            name: "Pavithra S",
            phone: "9600457842",
            last_visit: {
                id: "OP-2026-00122",
                encType: "OP",
                encId: "OP-2026-00122",
                dept: "OBGYN",
                doctor: "Dr. K. Priya",
                when: "2026-01-21T03:35:00Z",
            },
        },
        {
            id: "P-1002",
            uhid: "NH-000118",
            name: "Arun K",
            phone: "9876543210",
            last_visit: {
                id: "OP-2026-00118",
                encType: "OP",
                encId: "OP-2026-00118",
                dept: "General Medicine",
                doctor: "Dr. R. Kumar",
                when: "2026-01-20T06:10:00Z",
            },
        },
        {
            id: "P-1003",
            uhid: "NH-000033",
            name: "Meena R",
            phone: "9000000001",
            last_visit: {
                id: "IP-2026-00033",
                encType: "IP",
                encId: "IP-2026-00033",
                dept: "ICU",
                doctor: "Dr. A. Selvam",
                when: "2026-01-14T09:00:00Z",
            },
        },
        {
            id: "P-1004",
            uhid: "NH-000009",
            name: "Vignesh M",
            phone: "9000000002",
            last_visit: {
                id: "ER-2026-00009",
                encType: "ER",
                encId: "ER-2026-00009",
                dept: "Cardiology",
                doctor: "Dr. S. Nithya",
                when: "2026-01-11T12:20:00Z",
            },
        },
        {
            id: "P-1005",
            uhid: "NH-000201",
            name: "Karthik S",
            phone: "9000000003",
            last_visit: {
                id: "OP-2026-00201",
                encType: "OP",
                encId: "OP-2026-00201",
                dept: "Orthopedics",
                doctor: "Dr. P. Anand",
                when: "2026-01-19T10:10:00Z",
            },
        },
    ]

    const records = [
        {
            id: "R-9001",
            patient_id: "P-1001",
            patient_name: "Pavithra S",
            patient_uhid: "NH-000122",
            dept: "OBGYN",
            type: "OPD_NOTE",
            title: "OBGYN OPD Note · Antenatal Visit",
            status: "DRAFT",
            when: "2026-01-21T04:10:00Z",
        },
        {
            id: "R-9002",
            patient_id: "P-1002",
            patient_name: "Arun K",
            patient_uhid: "NH-000118",
            dept: "General Medicine",
            type: "OPD_NOTE",
            title: "OPD Consultation · Fever & Body Pain",
            status: "SIGNED",
            when: "2026-01-20T07:00:00Z",
        },
        {
            id: "R-9003",
            patient_id: "P-1003",
            patient_name: "Meena R",
            patient_uhid: "NH-000033",
            dept: "ICU",
            type: "PROGRESS_NOTE",
            title: "ICU Progress Note · Day 3",
            status: "SIGNED",
            when: "2026-01-14T12:00:00Z",
        },
        {
            id: "R-9004",
            patient_id: "P-1004",
            patient_name: "Vignesh M",
            patient_uhid: "NH-000009",
            dept: "Cardiology",
            type: "LAB_RESULT",
            title: "Lab Result · Lipid Profile",
            status: "RESULT",
            when: "2026-01-11T14:10:00Z",
        },
    ]

    const drafts = [
        {
            id: "D-7001",
            owner_id: currentUser?.id || 1,
            patient_id: "P-1001",
            patient_name: "Pavithra S",
            patient_uhid: "NH-000122",
            dept: "OBGYN",
            title: "OBGYN OPD Note · Follow-up",
            updated_at: "2026-01-21T05:10:00Z",
            visit: { encType: "OP", encId: "OP-2026-00122" },
        },
        {
            id: "D-7002",
            owner_id: currentUser?.id || 1,
            patient_id: "P-1005",
            patient_name: "Karthik S",
            patient_uhid: "NH-000201",
            dept: "Orthopedics",
            title: "Ortho OPD Note · Knee Pain",
            updated_at: "2026-01-19T11:15:00Z",
            visit: { encType: "OP", encId: "OP-2026-00201" },
        },
    ]

    return { patients, records, drafts }
}
