// FILE: frontend/src/emr/EmrTemplateLibrary.jsx
import React, { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Plus,
    Search,
    Filter,
    X,
    Building2,
    ClipboardList,
    Sparkles,
    FileText,
    CheckCircle2,
    Globe,
    EyeOff,
    History,
    Copy,
    Pencil,
    Trash2,
    ArrowUp,
    ArrowDown,
    RefreshCcw,
    LayoutGrid,
    List,
    Tag,
    Shield,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import TemplateEditorDialog from "../templates/TemplateEditorDialog"
// -------------------------------
// Constants / Helpers
// -------------------------------
const DEPARTMENTS = [
    "Common (All)",
    "Anaesthesiology",
    "Cardiology",
    "Dermatology",
    "ENT",
    "General Medicine",
    "General Surgery",
    "ICU",
    "Neurology",
    "OBGYN",
    "Orthopedics",
    "Paediatrics",
    "Pathology/Lab",
    "Psychiatry",
    "Urology",
]

const RECORD_TYPES = [
    { key: "OPD_NOTE", label: "OPD Consultation" },
    { key: "PROGRESS_NOTE", label: "Daily Progress" },
    { key: "PRESCRIPTION", label: "Prescription" },
    { key: "LAB_RESULT", label: "Lab Result" },
    { key: "RADIOLOGY_REPORT", label: "Radiology Report" },
    { key: "CONSENT", label: "Consent" },
    { key: "DISCHARGE_SUMMARY", label: "Discharge Summary" },
    { key: "EXTERNAL_DOCUMENT", label: "External Document" },
]

const STATUSES = ["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"]

function deptTone(deptRaw) {
    const d = (deptRaw || "").toUpperCase()
    const map = {
        OBGYN: {
            bar: "from-pink-500/75 via-rose-500/55 to-orange-400/45",
            chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(244,63,94,0.55)]",
            btn: "bg-rose-600 hover:bg-rose-700",
            dot: "bg-rose-500",
        },
        CARDIOLOGY: {
            bar: "from-red-500/75 via-rose-500/55 to-amber-400/40",
            chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(239,68,68,0.55)]",
            btn: "bg-red-600 hover:bg-red-700",
            dot: "bg-red-500",
        },
        ICU: {
            bar: "from-indigo-500/75 via-blue-500/55 to-cyan-400/40",
            chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(99,102,241,0.55)]",
            btn: "bg-indigo-600 hover:bg-indigo-700",
            dot: "bg-indigo-500",
        },
        ORTHOPEDICS: {
            bar: "from-emerald-500/70 via-teal-500/55 to-lime-400/35",
            chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(16,185,129,0.55)]",
            btn: "bg-emerald-600 hover:bg-emerald-700",
            dot: "bg-emerald-500",
        },
        "PATHOLOGY/LAB": {
            bar: "from-amber-500/70 via-yellow-500/55 to-orange-400/35",
            chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(245,158,11,0.55)]",
            btn: "bg-amber-600 hover:bg-amber-700",
            dot: "bg-amber-500",
        },
        "GENERAL MEDICINE": {
            bar: "from-slate-500/65 via-zinc-500/45 to-sky-400/30",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.40)]",
            btn: "bg-slate-900 hover:bg-slate-800",
            dot: "bg-slate-600",
        },
    }
    return (
        map[d] || {
            bar: "from-slate-500/65 via-slate-400/35 to-sky-400/25",
            chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
            glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.30)]",
            btn: "bg-slate-900 hover:bg-slate-800",
            dot: "bg-slate-500",
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

function nowISO() {
    return new Date().toISOString()
}

function uid(prefix = "TPL") {
    return `${prefix}-${Math.random().toString(16).slice(2, 8)}-${Date.now().toString(16).slice(-6)}`
}

function typeLabel(key) {
    return RECORD_TYPES.find((r) => r.key === key)?.label || key
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

// -------------------------------
// Dummy Seed Data (UI only)
// -------------------------------
function seedTemplates() {
    const base = [
        makeTemplate({
            dept: "Common (All)",
            type: "OPD_NOTE",
            name: "OPD Consultation (Standard)",
            sections: ["Chief Complaint", "History", "Exam", "Assessment", "Plan"],
            published: true,
            premium: false,
        }),
        makeTemplate({
            dept: "OBGYN",
            type: "OPD_NOTE",
            name: "OBGYN OPD Note (Premium)",
            sections: ["LMP/EDD", "Obstetric History", "Exam", "Plan"],
            published: true,
            premium: true,
        }),
        makeTemplate({
            dept: "ICU",
            type: "PROGRESS_NOTE",
            name: "ICU Progress Note (Detailed)",
            sections: ["Ventilator", "ABG", "Infusions", "Plan"],
            published: false,
            premium: true,
        }),
        makeTemplate({
            dept: "Pathology/Lab",
            type: "LAB_RESULT",
            name: "CBC Report Template",
            sections: ["Hb", "WBC", "Platelets"],
            published: true,
            premium: false,
        }),
        makeTemplate({
            dept: "Cardiology",
            type: "OPD_NOTE",
            name: "Cardiology OPD Note",
            sections: ["Symptoms", "Risk Factors", "ECG", "Plan"],
            published: false,
            premium: false,
        }),
    ]

    // Add versions for a couple
    base[0].versions = [
        makeVersion({ v: 1, status: "PUBLISHED", note: "Initial release", at: "2026-01-10T08:10:00Z" }),
        makeVersion({ v: 2, status: "PUBLISHED", note: "Added Plan section enhancements", at: "2026-01-18T07:20:00Z" }),
    ]
    base[0].version = 2

    base[1].versions = [
        makeVersion({ v: 1, status: "PUBLISHED", note: "Premium OBGYN case sheet", at: "2026-01-12T09:00:00Z" }),
    ]
    base[1].version = 1

    return base
}

function makeVersion({ v, status, note, at }) {
    return {
        id: uid("VER"),
        v,
        status,
        note: note || "",
        updated_at: at || nowISO(),
        updated_by: "Admin",
    }
}

function makeTemplate({ dept, type, name, sections, published, premium }) {
    const id = uid("TPL")
    const ver = 1
    const status = published ? "PUBLISHED" : "DRAFT"
    return {
        id,
        dept,
        type,
        name,
        description: "",
        premium: !!premium,
        is_default: false,
        restricted: false, // like confidential templates
        status, // PUBLISHED | DRAFT | ARCHIVED
        version: ver,
        updated_at: nowISO(),
        updated_by: "Admin",
        sections: sections || [],
        schema_json: `{\n  "blocks": [\n    { "type": "text", "label": "Example" }\n  ]\n}`,
        versions: [makeVersion({ v: 1, status, note: "Initial", at: nowISO() })],
    }
}

// -------------------------------
// Main Page Component
// -------------------------------
export default function EmrTemplateLibrary() {
    const isMobile = useIsMobile(1024)

    const [view, setView] = useState("list") // list | dept
    const [templates, setTemplates] = useState(seedTemplates)

    const [selectedId, setSelectedId] = useState(null)

    // filters
    const [f, setF] = useState({
        q: "",
        dept: "ALL",
        type: "ALL",
        status: "ALL",
        onlyPremium: false,
    })

    // dialogs
    const [openEditor, setOpenEditor] = useState(false)
    const [editId, setEditId] = useState(null)

    const [openVersions, setOpenVersions] = useState(false)
    const [versionsForId, setVersionsForId] = useState(null)

    const selected = useMemo(() => templates.find((t) => t.id === selectedId) || null, [templates, selectedId])

    // default select first in list
    useEffect(() => {
        if (!selectedId && templates?.length) setSelectedId(templates[0].id)
    }, [templates, selectedId])

    const stats = useMemo(() => {
        const total = templates.length
        const pub = templates.filter((t) => t.status === "PUBLISHED").length
        const draft = templates.filter((t) => t.status === "DRAFT").length
        const arch = templates.filter((t) => t.status === "ARCHIVED").length
        return { total, pub, draft, arch }
    }, [templates])

    const filtered = useMemo(() => {
        const q = (f.q || "").trim().toLowerCase()
        return templates
            .filter((t) => {
                if (f.dept !== "ALL" && t.dept !== f.dept) return false
                if (f.type !== "ALL" && t.type !== f.type) return false
                if (f.status !== "ALL" && t.status !== f.status) return false
                if (f.onlyPremium && !t.premium) return false
                if (q) {
                    const hay = `${t.name} ${t.dept} ${t.type} ${t.sections.join(" ")} ${t.status}`.toLowerCase()
                    if (!hay.includes(q)) return false
                }
                return true
            })
            .sort((a, b) => {
                // published first, then dept, then name
                const pr = (x) => (x.status === "PUBLISHED" ? 0 : x.status === "DRAFT" ? 1 : 2)
                return pr(a) - pr(b) || a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name)
            })
    }, [templates, f])

    const grouped = useMemo(() => {
        const m = new Map()
        for (const t of filtered) {
            const k = t.dept || "Unknown"
            if (!m.has(k)) m.set(k, [])
            m.get(k).push(t)
        }
        return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    }, [filtered])

    function openCreate() {
        setEditId(null)
        setOpenEditor(true)
    }

    function openEdit(id) {
        setEditId(id)
        setOpenEditor(true)
    }

    function removeTemplate(id) {
        const t = templates.find((x) => x.id === id)
        if (!t) return
        // soft archive instead of delete
        setTemplates((prev) => prev.map((x) => (x.id === id ? { ...x, status: "ARCHIVED", updated_at: nowISO(), updated_by: "Admin" } : x)))
        toast.success("Template archived")
    }

    function duplicateTemplate(id) {
        const t = templates.find((x) => x.id === id)
        if (!t) return
        const copy = {
            ...t,
            id: uid("TPL"),
            name: `${t.name} (Copy)`,
            status: "DRAFT",
            version: 1,
            updated_at: nowISO(),
            updated_by: "Admin",
            versions: [makeVersion({ v: 1, status: "DRAFT", note: "Copied from existing template", at: nowISO() })],
        }
        setTemplates((prev) => [copy, ...prev])
        setSelectedId(copy.id)
        toast.success("Template duplicated")
    }

    function togglePublish(id) {
        const t = templates.find((x) => x.id === id)
        if (!t) return
        if (t.status === "ARCHIVED") return toast.error("Archived templates cannot be published")
        const next = t.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
        setTemplates((prev) =>
            prev.map((x) => {
                if (x.id !== id) return x
                const verNote = next === "PUBLISHED" ? "Published" : "Unpublished (Back to Draft)"
                const v = bumpVersion(x, {
                    status: next,
                    note: verNote,
                    keepSameVersion: true, // publish/unpublish does NOT change version number (policy)
                })
                return { ...v, status: next, updated_at: nowISO(), updated_by: "Admin" }
            })
        )
        toast.success(next === "PUBLISHED" ? "Published" : "Unpublished")
    }

    function bumpVersion(template, { status, note, keepSameVersion }) {
        const currentV = Number(template.version || 1)
        const newV = keepSameVersion ? currentV : currentV + 1
        const nextVer = makeVersion({ v: newV, status: status || template.status, note, at: nowISO() })
        const versions = [...(template.versions || [])]

        // if keepSameVersion, replace last entry for that version to reflect state
        if (keepSameVersion) {
            // remove any version with same v at end
            const idx = versions.findIndex((vv) => vv.v === newV)
            if (idx >= 0) versions[idx] = nextVer
            else versions.push(nextVer)
        } else {
            versions.push(nextVer)
        }

        return {
            ...template,
            version: newV,
            versions,
            updated_at: nowISO(),
            updated_by: "Admin",
        }
    }

    function openVersionHistory(id) {
        setVersionsForId(id)
        setOpenVersions(true)
    }

    function restoreVersion(templateId, versionNumber) {
        const t = templates.find((x) => x.id === templateId)
        if (!t) return

        // UI policy: restoring creates a NEW DRAFT version (next version)
        setTemplates((prev) =>
            prev.map((x) => {
                if (x.id !== templateId) return x
                const restored = bumpVersion(x, {
                    status: "DRAFT",
                    note: `Restored from v${versionNumber}`,
                    keepSameVersion: false,
                })
                return { ...restored, status: "DRAFT" }
            })
        )

        toast.success(`Restored as new draft from v${versionNumber}`)
    }

    function onEditorSave(payload, mode) {
        // mode: "CREATE" | "UPDATE" | "NEW_VERSION"
        if (mode === "CREATE") {
            const t = {
                id: uid("TPL"),
                dept: payload.dept,
                type: payload.type,
                name: payload.name,
                description: payload.description || "",
                premium: !!payload.premium,
                is_default: !!payload.is_default,
                restricted: !!payload.restricted,
                status: payload.publish ? "PUBLISHED" : "DRAFT",
                version: 1,
                updated_at: nowISO(),
                updated_by: "Admin",
                sections: payload.sections || [],
                schema_json: payload.schema_json || "{\n}",
                versions: [makeVersion({ v: 1, status: payload.publish ? "PUBLISHED" : "DRAFT", note: "Created", at: nowISO() })],
            }
            setTemplates((prev) => [t, ...prev])
            setSelectedId(t.id)
            setOpenEditor(false)
            toast.success("Template created")
            return
        }

        if (mode === "UPDATE") {
            setTemplates((prev) =>
                prev.map((x) => {
                    if (x.id !== payload.id) return x
                    const nextStatus = payload.publish ? "PUBLISHED" : x.status
                    const updated = {
                        ...x,
                        dept: payload.dept,
                        type: payload.type,
                        name: payload.name,
                        description: payload.description || "",
                        premium: !!payload.premium,
                        is_default: !!payload.is_default,
                        restricted: !!payload.restricted,
                        sections: payload.sections || [],
                        schema_json: payload.schema_json || "{\n}",
                        status: nextStatus,
                        updated_at: nowISO(),
                        updated_by: "Admin",
                    }
                    // Update (no version bump) but record in history as same version edit
                    const verNote = "Edited (same version)"
                    const v = bumpVersion(updated, { status: updated.status, note: verNote, keepSameVersion: true })
                    return v
                })
            )
            setOpenEditor(false)
            toast.success("Template updated")
            return
        }

        if (mode === "NEW_VERSION") {
            setTemplates((prev) =>
                prev.map((x) => {
                    if (x.id !== payload.id) return x
                    const nextStatus = payload.publish ? "PUBLISHED" : "DRAFT"
                    const updated = {
                        ...x,
                        dept: payload.dept,
                        type: payload.type,
                        name: payload.name,
                        description: payload.description || "",
                        premium: !!payload.premium,
                        is_default: !!payload.is_default,
                        restricted: !!payload.restricted,
                        sections: payload.sections || [],
                        schema_json: payload.schema_json || "{\n}",
                        status: nextStatus,
                    }
                    const v = bumpVersion(updated, { status: nextStatus, note: "Saved as new version", keepSameVersion: false })
                    return v
                })
            )
            setOpenEditor(false)
            toast.success("New version created")
            return
        }
    }

    return (
        <div className="w-full">
            {/* Header */}
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/70 backdrop-blur-xl">
                <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                                    <FileText className="h-5 w-5 text-slate-700" />
                                </div>
                                <div>
                                    <div className="text-[15px] font-semibold text-slate-900">Template Library</div>
                                    <div className="text-xs text-slate-500">Department-wise templates · versioning · publish control</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="hidden md:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2">
                                <Button
                                    variant={view === "list" ? "default" : "ghost"}
                                    className={cn("h-9 rounded-xl", view === "list" ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
                                    onClick={() => setView("list")}
                                >
                                    <List className="mr-2 h-4 w-4" /> List
                                </Button>
                                <Button
                                    variant={view === "dept" ? "default" : "ghost"}
                                    className={cn("h-9 rounded-xl", view === "dept" ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
                                    onClick={() => setView("dept")}
                                >
                                    <LayoutGrid className="mr-2 h-4 w-4" /> Department
                                </Button>
                            </div>

                            <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={openCreate}>
                                <Plus className="mr-2 h-4 w-4" /> New Template
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-xl">
                            Total: <span className="ml-1 font-semibold">{stats.total}</span>
                        </Badge>
                        <Badge className="rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                            Published: <span className="ml-1 font-semibold">{stats.pub}</span>
                        </Badge>
                        <Badge className="rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                            Draft: <span className="ml-1 font-semibold">{stats.draft}</span>
                        </Badge>
                        <Badge className="rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                            Archived: <span className="ml-1 font-semibold">{stats.arch}</span>
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6">
                {/* Filters */}
                <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                    <CardContent className="p-4 md:p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                                <div className="relative w-full md:max-w-[420px]">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                    <Input
                                        value={f.q}
                                        onChange={(e) => setF((p) => ({ ...p, q: e.target.value }))}
                                        placeholder="Search templates (name, dept, type, sections)…"
                                        className="h-10 rounded-2xl pl-9"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={f.dept}
                                        onChange={(e) => setF((p) => ({ ...p, dept: e.target.value }))}
                                        className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                    >
                                        <option value="ALL">All Departments</option>
                                        {DEPARTMENTS.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={f.type}
                                        onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))}
                                        className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                    >
                                        <option value="ALL">All Record Types</option>
                                        {RECORD_TYPES.map((t) => (
                                            <option key={t.key} value={t.key}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={f.status}
                                        onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))}
                                        className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                    >
                                        {STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s === "ALL" ? "All Status" : s}
                                            </option>
                                        ))}
                                    </select>

                                    <Button
                                        variant={f.onlyPremium ? "default" : "outline"}
                                        className={cn("h-10 rounded-2xl", f.onlyPremium ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
                                        onClick={() => setF((p) => ({ ...p, onlyPremium: !p.onlyPremium }))}
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Premium
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-2xl"
                                        onClick={() => setF({ q: "", dept: "ALL", type: "ALL", status: "ALL", onlyPremium: false })}
                                    >
                                        <X className="mr-2 h-4 w-4" /> Reset
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Filter className="h-4 w-4" />
                                Showing <span className="font-semibold text-slate-800">{filtered.length}</span> template(s)
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Content Area */}
                <div className="mt-4">
                    {view === "dept" ? (
                        <DepartmentGrid
                            groups={grouped}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onEdit={openEdit}
                            onPublish={togglePublish}
                            onDuplicate={duplicateTemplate}
                            onArchive={removeTemplate}
                            onVersions={openVersionHistory}
                            isMobile={isMobile}
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
                            <TemplatesList
                                rows={filtered}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                onEdit={openEdit}
                                onPublish={togglePublish}
                                onDuplicate={duplicateTemplate}
                                onArchive={removeTemplate}
                                onVersions={openVersionHistory}
                                isMobile={isMobile}
                            />

                            {/* Preview Pane (desktop) */}
                            <div className="hidden xl:block">
                                <PreviewPane
                                    tpl={selected}
                                    onEdit={() => selected && openEdit(selected.id)}
                                    onPublish={() => selected && togglePublish(selected.id)}
                                    onDuplicate={() => selected && duplicateTemplate(selected.id)}
                                    onArchive={() => selected && removeTemplate(selected.id)}
                                    onVersions={() => selected && openVersionHistory(selected.id)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Dialog */}
            <TemplateEditorDialog
                open={openEditor}
                onOpenChange={setOpenEditor}
                template={editId ? templates.find((t) => t.id === editId) : null}
                onSave={onEditorSave}
            />

            {/* Versions Dialog */}
            <VersionsDialog
                open={openVersions}
                onOpenChange={setOpenVersions}
                template={versionsForId ? templates.find((t) => t.id === versionsForId) : null}
                onRestore={(v) => versionsForId && restoreVersion(versionsForId, v)}
            />
        </div>
    )
}

// -------------------------------
// Department Grid View
// -------------------------------
function DepartmentGrid({
    groups,
    selectedId,
    onSelect,
    onEdit,
    onPublish,
    onDuplicate,
    onArchive,
    onVersions,
    isMobile,
}) {
    return (
        <div className="space-y-4">
            {groups.map(([dept, rows]) => {
                const tone = deptTone(dept)
                const pub = rows.filter((r) => r.status === "PUBLISHED").length
                const draft = rows.filter((r) => r.status === "DRAFT").length

                return (
                    <Card key={dept} className={cn("rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur", tone.glow)}>
                        <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("h-2.5 w-2.5 rounded-full", tone.dot)} />
                                        <CardTitle className="text-base">{dept}</CardTitle>
                                        <Badge className={cn("rounded-xl", tone.chip)}>
                                            <Building2 className="mr-1 h-3.5 w-3.5" /> {rows.length}
                                        </Badge>
                                        <Badge className="rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Published {pub}</Badge>
                                        <Badge className="rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">Draft {draft}</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">Templates available for this department</div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {rows.map((t) => (
                                    <TemplateTile
                                        key={t.id}
                                        tpl={t}
                                        active={t.id === selectedId}
                                        onClick={() => onSelect(t.id)}
                                        onEdit={() => onEdit(t.id)}
                                        onPublish={() => onPublish(t.id)}
                                        onDuplicate={() => onDuplicate(t.id)}
                                        onArchive={() => onArchive(t.id)}
                                        onVersions={() => onVersions(t.id)}
                                        compact={isMobile}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}

            {!groups.length ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
                    <div className="text-sm font-semibold text-slate-800">No templates match your filters</div>
                    <div className="mt-1 text-xs text-slate-500">Try resetting filters or create a new template.</div>
                </div>
            ) : null}
        </div>
    )
}

// -------------------------------
// List View (Table + Mobile Cards)
// -------------------------------
function TemplatesList({
    rows,
    selectedId,
    onSelect,
    onEdit,
    onPublish,
    onDuplicate,
    onArchive,
    onVersions,
    isMobile,
}) {
    if (isMobile) {
        return (
            <div className="space-y-3">
                {rows.map((t) => (
                    <TemplateTile
                        key={t.id}
                        tpl={t}
                        active={t.id === selectedId}
                        onClick={() => onSelect(t.id)}
                        onEdit={() => onEdit(t.id)}
                        onPublish={() => onPublish(t.id)}
                        onDuplicate={() => onDuplicate(t.id)}
                        onArchive={() => onArchive(t.id)}
                        onVersions={() => onVersions(t.id)}
                        compact
                    />
                ))}
                {!rows.length ? <Empty /> : null}
            </div>
        )
    }

    return (
        <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <CardTitle className="text-base">Templates</CardTitle>
                        <div className="text-xs text-slate-500">Select a template to preview (right side)</div>
                    </div>
                    <Badge variant="outline" className="rounded-xl">
                        {rows.length} row(s)
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {!rows.length ? <Empty /> : null}

                {rows.length ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr_0.6fr_1fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                            <div>Name</div>
                            <div>Department</div>
                            <div>Type</div>
                            <div>Status</div>
                            <div>Ver</div>
                            <div className="text-right">Actions</div>
                        </div>

                        <div className="divide-y divide-slate-200">
                            {rows.map((t) => {
                                const active = t.id === selectedId
                                const tone = deptTone(t.dept)
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => onSelect(t.id)}
                                        className={cn(
                                            "grid w-full grid-cols-[1.3fr_1fr_1fr_0.8fr_0.6fr_1fr] items-center gap-2 px-3 py-3 text-left transition",
                                            active ? "bg-white" : "bg-white/60 hover:bg-white",
                                            active ? "ring-1 ring-slate-200" : ""
                                        )}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("h-2 w-2 rounded-full", deptTone(t.dept).dot)} />
                                                <div className="truncate text-sm font-semibold text-slate-900">{t.name}</div>
                                                {t.premium ? (
                                                    <Badge className="rounded-xl bg-slate-900 text-white">
                                                        <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
                                                    </Badge>
                                                ) : null}
                                                {t.restricted ? (
                                                    <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                                        <Shield className="mr-1 h-3.5 w-3.5" /> Restricted
                                                    </Badge>
                                                ) : null}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                {t.sections?.length || 0} sections · Updated {fmtDate(t.updated_at)}
                                            </div>
                                        </div>

                                        <div className="min-w-0">
                                            <Badge className={cn("rounded-xl", tone.chip)}>
                                                <Building2 className="mr-1 h-3.5 w-3.5" />
                                                <span className="truncate">{t.dept}</span>
                                            </Badge>
                                        </div>

                                        <div className="min-w-0">
                                            <Badge variant="outline" className="rounded-xl">
                                                <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                                <span className="truncate">{typeLabel(t.type)}</span>
                                            </Badge>
                                        </div>

                                        <div>
                                            <StatusPill status={t.status} />
                                        </div>

                                        <div className="text-sm font-semibold text-slate-900">v{t.version}</div>

                                        <div className="flex justify-end gap-2">
                                            <IconBtn title="Edit" onClick={(e) => (e.preventDefault(), onEdit(t.id))}>
                                                <Pencil className="h-4 w-4" />
                                            </IconBtn>
                                            <IconBtn title="Versions" onClick={(e) => (e.preventDefault(), onVersions(t.id))}>
                                                <History className="h-4 w-4" />
                                            </IconBtn>
                                            <IconBtn title={t.status === "PUBLISHED" ? "Unpublish" : "Publish"} onClick={(e) => (e.preventDefault(), onPublish(t.id))}>
                                                {t.status === "PUBLISHED" ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                                            </IconBtn>
                                            <IconBtn title="Duplicate" onClick={(e) => (e.preventDefault(), onDuplicate(t.id))}>
                                                <Copy className="h-4 w-4" />
                                            </IconBtn>
                                            <IconBtn title="Archive" onClick={(e) => (e.preventDefault(), onArchive(t.id))}>
                                                <Trash2 className="h-4 w-4" />
                                            </IconBtn>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}

// -------------------------------
// Tile (used in mobile + dept grid)
// -------------------------------
function TemplateTile({
    tpl,
    active,
    onClick,
    onEdit,
    onPublish,
    onDuplicate,
    onArchive,
    onVersions,
    compact,
}) {
    const tone = deptTone(tpl.dept)
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition",
                active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
            )}
        >
            <div className={cn("h-2 w-full bg-gradient-to-r", tone.bar)} />
            <div className={cn("p-4", active ? tone.glow : "")}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("rounded-xl", tone.chip)}>
                                <Building2 className="mr-1 h-3.5 w-3.5" />
                                {tpl.dept}
                            </Badge>
                            <Badge variant="outline" className="rounded-xl">
                                <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                {typeLabel(tpl.type)}
                            </Badge>
                            <StatusPill status={tpl.status} />
                            <Badge variant="outline" className="rounded-xl">
                                <Tag className="mr-1 h-3.5 w-3.5" /> v{tpl.version}
                            </Badge>
                            {tpl.premium ? (
                                <Badge className="rounded-xl bg-slate-900 text-white">
                                    <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
                                </Badge>
                            ) : null}
                            {tpl.restricted ? (
                                <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                    <Shield className="mr-1 h-3.5 w-3.5" /> Restricted
                                </Badge>
                            ) : null}
                        </div>

                        <div className="mt-2 truncate text-sm font-semibold text-slate-900">{tpl.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                            {tpl.sections?.length || 0} sections · Updated {fmtDate(tpl.updated_at)} by {tpl.updated_by}
                        </div>

                        {!compact && tpl.sections?.length ? (
                            <div className="mt-2 line-clamp-2 text-xs text-slate-600">{tpl.sections.join(" · ")}</div>
                        ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <Badge className={cn("rounded-xl", active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700")}>
                            {active ? "Selected" : "Select"}
                        </Badge>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        className="h-9 rounded-2xl"
                        onClick={(e) => (e.preventDefault(), onEdit())}
                    >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button
                        variant="outline"
                        className="h-9 rounded-2xl"
                        onClick={(e) => (e.preventDefault(), onVersions())}
                    >
                        <History className="mr-2 h-4 w-4" /> Versions
                    </Button>
                    <Button
                        className={cn("h-9 rounded-2xl", tpl.status === "PUBLISHED" ? "bg-slate-900 text-white hover:bg-slate-800" : tone.btn)}
                        onClick={(e) => (e.preventDefault(), onPublish())}
                    >
                        {tpl.status === "PUBLISHED" ? (
                            <>
                                <EyeOff className="mr-2 h-4 w-4" /> Unpublish
                            </>
                        ) : (
                            <>
                                <Globe className="mr-2 h-4 w-4" /> Publish
                            </>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        className="h-9 rounded-2xl"
                        onClick={(e) => (e.preventDefault(), onDuplicate())}
                    >
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                    </Button>

                    <Button
                        variant="outline"
                        className="h-9 rounded-2xl"
                        onClick={(e) => (e.preventDefault(), onArchive())}
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Archive
                    </Button>
                </div>
            </div>
        </button>
    )
}

// -------------------------------
// Preview Pane (desktop right)
// -------------------------------
function PreviewPane({ tpl, onEdit, onPublish, onDuplicate, onArchive, onVersions }) {
    if (!tpl) {
        return (
            <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                <CardContent className="p-8 text-center">
                    <div className="text-sm font-semibold text-slate-800">Select a template</div>
                    <div className="mt-1 text-xs text-slate-500">Preview appears here</div>
                </CardContent>
            </Card>
        )
    }

    const tone = deptTone(tpl.dept)

    return (
        <Card className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
            <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-base">{tpl.name}</CardTitle>
                        <div className="mt-1 text-xs text-slate-500">
                            {tpl.dept} · {typeLabel(tpl.type)} · v{tpl.version} · Updated {fmtDate(tpl.updated_at)}
                        </div>
                    </div>
                    <StatusPill status={tpl.status} />
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-xl", tone.chip)}>
                        <Building2 className="mr-1 h-3.5 w-3.5" />
                        {tpl.dept}
                    </Badge>
                    <Badge variant="outline" className="rounded-xl">
                        <ClipboardList className="mr-1 h-3.5 w-3.5" />
                        {typeLabel(tpl.type)}
                    </Badge>
                    {tpl.premium ? (
                        <Badge className="rounded-xl bg-slate-900 text-white">
                            <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
                        </Badge>
                    ) : null}
                    {tpl.restricted ? (
                        <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                            <Shield className="mr-1 h-3.5 w-3.5" /> Restricted
                        </Badge>
                    ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-700">Sections</div>
                    {tpl.sections?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {tpl.sections.slice(0, 14).map((s) => (
                                <span key={s} className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                    {s}
                                </span>
                            ))}
                            {tpl.sections.length > 14 ? (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                    +{tpl.sections.length - 14} more
                                </span>
                            ) : null}
                        </div>
                    ) : (
                        <div className="mt-1 text-xs text-slate-500">No sections</div>
                    )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-700">Template Schema (UI)</div>
                    <pre className="mt-2 max-h-[260px] overflow-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                        {tpl.schema_json || "{ }"}
                    </pre>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={onEdit}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button variant="outline" className="rounded-2xl" onClick={onVersions}>
                        <History className="mr-2 h-4 w-4" /> Versions
                    </Button>
                    <Button className={cn("rounded-2xl", tpl.status === "PUBLISHED" ? "bg-slate-900 text-white hover:bg-slate-800" : tone.btn)} onClick={onPublish}>
                        {tpl.status === "PUBLISHED" ? (
                            <>
                                <EyeOff className="mr-2 h-4 w-4" /> Unpublish
                            </>
                        ) : (
                            <>
                                <Globe className="mr-2 h-4 w-4" /> Publish
                            </>
                        )}
                    </Button>
                    <Button variant="outline" className="rounded-2xl" onClick={onDuplicate}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                    </Button>
                    <Button variant="outline" className="rounded-2xl" onClick={onArchive}>
                        <Trash2 className="mr-2 h-4 w-4" /> Archive
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// -------------------------------
// Editor Dialog (Create/Edit + Versioning)
// -------------------------------
// function TemplateEditorDialog({ open, onOpenChange, template, onSave }) {
//     const isEdit = !!template

//     const [mode, setMode] = useState("UPDATE") // UPDATE | NEW_VERSION (for edit), CREATE for create
//     const [form, setForm] = useState({
//         id: null,
//         dept: "Common (All)",
//         type: "OPD_NOTE",
//         name: "",
//         description: "",
//         premium: false,
//         is_default: false,
//         restricted: false,
//         publish: false,
//         sections: [],
//         schema_json: "{\n}",
//     })
//     const [secInput, setSecInput] = useState("")

//     useEffect(() => {
//         if (!open) return
//         if (isEdit) {
//             setMode("UPDATE")
//             setForm({
//                 id: template.id,
//                 dept: template.dept,
//                 type: template.type,
//                 name: template.name,
//                 description: template.description || "",
//                 premium: !!template.premium,
//                 is_default: !!template.is_default,
//                 restricted: !!template.restricted,
//                 publish: template.status === "PUBLISHED",
//                 sections: [...(template.sections || [])],
//                 schema_json: template.schema_json || "{\n}",
//             })
//         } else {
//             setMode("CREATE")
//             setForm({
//                 id: null,
//                 dept: "Common (All)",
//                 type: "OPD_NOTE",
//                 name: "",
//                 description: "",
//                 premium: false,
//                 is_default: false,
//                 restricted: false,
//                 publish: false,
//                 sections: ["Chief Complaint", "History", "Exam", "Assessment", "Plan"],
//                 schema_json: `{\n  "blocks": [\n    { "type": "text", "label": "Example" }\n  ]\n}`,
//             })
//         }
//         setSecInput("")
//     }, [open, isEdit, template])

//     const tone = deptTone(form.dept)

//     function addSection() {
//         const v = (secInput || "").trim()
//         if (!v) return
//         if (form.sections.includes(v)) return toast.error("Section already exists")
//         setForm((p) => ({ ...p, sections: [...p.sections, v] }))
//         setSecInput("")
//     }

//     function removeSection(idx) {
//         setForm((p) => ({ ...p, sections: p.sections.filter((_, i) => i !== idx) }))
//     }

//     function moveSection(idx, dir) {
//         const arr = [...(form.sections || [])]
//         const j = idx + dir
//         if (j < 0 || j >= arr.length) return
//         const tmp = arr[idx]
//         arr[idx] = arr[j]
//         arr[j] = tmp
//         setForm((p) => ({ ...p, sections: arr }))
//     }

//     function validate() {
//         if (!form.name.trim() || form.name.trim().length < 3) return "Template name is required (min 3 chars)"
//         if (!form.dept) return "Department is required"
//         if (!form.type) return "Record type is required"
//         if (!form.sections?.length) return "Add at least one section"
//         return null
//     }

//     function submit() {
//         const err = validate()
//         if (err) return toast.error(err)

//         if (!isEdit) {
//             onSave?.(form, "CREATE")
//             return
//         }

//         if (mode === "UPDATE") onSave?.(form, "UPDATE")
//         if (mode === "NEW_VERSION") onSave?.(form, "NEW_VERSION")
//     }

//     return (
//         <Dialog open={!!open} onOpenChange={onOpenChange}>
//             <DialogContent
//                 className={cn(
//                     // full screen on mobile, centered on desktop
//                     "w-[98vw] max-w-[1100px] rounded-3xl border-slate-200 bg-white/85 p-0 backdrop-blur-xl",
//                     "max-h-[90dvh] overflow-hidden"
//                 )}
//             >
//                 <div className="flex min-h-0 flex-col">
//                     <div className={cn("h-2 w-full bg-gradient-to-r", tone.bar)} />

//                     <DialogHeader className="px-4 pt-4 md:px-6">
//                         <div className="flex items-start justify-between gap-3">
//                             <div className="min-w-0">
//                                 <DialogTitle className="text-base">
//                                     {isEdit ? "Edit Template" : "Create Template"}
//                                 </DialogTitle>
//                                 <div className="mt-1 text-xs text-slate-500">
//                                     Department-wise · sections builder · versioning · publish control
//                                 </div>
//                             </div>

//                             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => onOpenChange?.(false)}>
//                                 <X className="h-4 w-4" />
//                             </Button>
//                         </div>
//                     </DialogHeader>

//                     <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6">
//                         <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
//                             {/* Left: Form */}
//                             <div className="space-y-4">
//                                 {/* Core */}
//                                 <Card className="rounded-3xl border-slate-200 bg-white">
//                                     <CardContent className="p-4">
//                                         <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
//                                             <div>
//                                                 <div className="mb-1 text-xs font-semibold text-slate-700">Template Name *</div>
//                                                 <Input
//                                                     value={form.name}
//                                                     onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
//                                                     placeholder="e.g., OPD Consultation (Standard)"
//                                                     className="h-10 rounded-2xl"
//                                                 />
//                                                 <div className="mt-1 text-xs text-slate-500">Used in Record creation flow.</div>
//                                             </div>

//                                             <div>
//                                                 <div className="mb-1 text-xs font-semibold text-slate-700">Record Type *</div>
//                                                 <select
//                                                     value={form.type}
//                                                     onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
//                                                     className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
//                                                 >
//                                                     {RECORD_TYPES.map((t) => (
//                                                         <option key={t.key} value={t.key}>
//                                                             {t.label}
//                                                         </option>
//                                                     ))}
//                                                 </select>
//                                             </div>

//                                             <div>
//                                                 <div className="mb-1 text-xs font-semibold text-slate-700">Department *</div>
//                                                 <select
//                                                     value={form.dept}
//                                                     onChange={(e) => setForm((p) => ({ ...p, dept: e.target.value }))}
//                                                     className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
//                                                 >
//                                                     {DEPARTMENTS.map((d) => (
//                                                         <option key={d} value={d}>
//                                                             {d}
//                                                         </option>
//                                                     ))}
//                                                 </select>
//                                             </div>

//                                             <div>
//                                                 <div className="mb-1 text-xs font-semibold text-slate-700">Description</div>
//                                                 <Input
//                                                     value={form.description}
//                                                     onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
//                                                     placeholder="Optional short description…"
//                                                     className="h-10 rounded-2xl"
//                                                 />
//                                             </div>
//                                         </div>

//                                         <Separator className="my-4" />

//                                         <div className="flex flex-wrap items-center justify-between gap-3">
//                                             <div className="flex flex-wrap items-center gap-3">
//                                                 <ToggleRow
//                                                     title="Premium"
//                                                     desc="Show premium badge"
//                                                     checked={form.premium}
//                                                     onCheckedChange={(v) => setForm((p) => ({ ...p, premium: !!v }))}
//                                                 />
//                                                 <ToggleRow
//                                                     title="Default"
//                                                     desc="Preferred template"
//                                                     checked={form.is_default}
//                                                     onCheckedChange={(v) => setForm((p) => ({ ...p, is_default: !!v }))}
//                                                 />
//                                                 <ToggleRow
//                                                     title="Restricted"
//                                                     desc="Visibility controlled"
//                                                     checked={form.restricted}
//                                                     onCheckedChange={(v) => setForm((p) => ({ ...p, restricted: !!v }))}
//                                                 />
//                                             </div>

//                                             <div className="flex items-center gap-2">
//                                                 <Badge className={cn("rounded-xl", tone.chip)}>
//                                                     <Building2 className="mr-1 h-3.5 w-3.5" />
//                                                     {form.dept}
//                                                 </Badge>
//                                                 <Badge variant="outline" className="rounded-xl">
//                                                     <ClipboardList className="mr-1 h-3.5 w-3.5" />
//                                                     {typeLabel(form.type)}
//                                                 </Badge>
//                                             </div>
//                                         </div>
//                                     </CardContent>
//                                 </Card>

//                                 {/* Sections Builder */}
//                                 <Card className="rounded-3xl border-slate-200 bg-white">
//                                     <CardHeader className="pb-2">
//                                         <div className="flex items-center justify-between gap-2">
//                                             <CardTitle className="text-base">Sections Builder</CardTitle>
//                                             <Badge variant="outline" className="rounded-xl">
//                                                 {(form.sections || []).length} section(s)
//                                             </Badge>
//                                         </div>
//                                         <div className="text-xs text-slate-500">Add / reorder / remove sections used in record UI.</div>
//                                     </CardHeader>
//                                     <CardContent className="space-y-3">
//                                         <div>
//                                             <div className="flex flex-col gap-2 md:flex-row md:items-center">
//                                                 <Input
//                                                     value={secInput}
//                                                     onChange={(e) => setSecInput(e.target.value)}
//                                                     placeholder="Add section (e.g., Vitals)"
//                                                     className="h-10 rounded-2xl"
//                                                     onKeyDown={(e) => {
//                                                         if (e.key === "Enter") {
//                                                             e.preventDefault()
//                                                             addSection()
//                                                         }
//                                                     }}
//                                                 />
//                                                 <Button className={cn("h-10 rounded-2xl", tone.btn)} onClick={addSection}>
//                                                     <Plus className="mr-2 h-4 w-4" /> Add
//                                                 </Button>
//                                             </div>

//                                             {(form.sections || []).length ? (
//                                                 <div className="mt-3 space-y-2">
//                                                     {form.sections.map((s, idx) => (
//                                                         <div
//                                                             key={`${s}-${idx}`}
//                                                             className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
//                                                         >
//                                                             <div className="min-w-0 truncate text-sm font-semibold text-slate-800">
//                                                                 {s}
//                                                             </div>

//                                                             <div className="flex items-center gap-1">
//                                                                 <IconBtn
//                                                                     title="Move Up"
//                                                                     onClick={() => moveSection(idx, -1)}
//                                                                     disabled={idx === 0}
//                                                                 >
//                                                                     <ArrowUp className="h-4 w-4" />
//                                                                 </IconBtn>

//                                                                 <IconBtn
//                                                                     title="Move Down"
//                                                                     onClick={() => moveSection(idx, +1)}
//                                                                     disabled={idx === form.sections.length - 1}
//                                                                 >
//                                                                     <ArrowDown className="h-4 w-4" />
//                                                                 </IconBtn>

//                                                                 <IconBtn title="Remove" onClick={() => removeSection(idx)}>
//                                                                     <Trash2 className="h-4 w-4" />
//                                                                 </IconBtn>
//                                                             </div>
//                                                         </div>
//                                                     ))}
//                                                 </div>
//                                             ) : (
//                                                 <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
//                                                     <div className="text-sm font-semibold text-slate-800">No sections</div>
//                                                     <div className="mt-1 text-xs text-slate-500">
//                                                         Add at least one section to save.
//                                                     </div>
//                                                 </div>
//                                             )}
//                                         </div>
//                                     </CardContent>

//                                 </Card>

//                                 {/* Schema JSON */}
//                                 <Card className="rounded-3xl border-slate-200 bg-white">
//                                     <CardHeader className="pb-2">
//                                         <CardTitle className="text-base">Template Schema (UI)</CardTitle>
//                                         <div className="text-xs text-slate-500">Later connect to your dynamic form renderer.</div>
//                                     </CardHeader>
//                                     <CardContent>
//                                         <textarea
//                                             value={form.schema_json}
//                                             onChange={(e) => setForm((p) => ({ ...p, schema_json: e.target.value }))}
//                                             rows={10}
//                                             className="w-full rounded-2xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none focus:border-slate-300"
//                                             placeholder='{\n  "blocks": []\n}'
//                                         />
//                                     </CardContent>
//                                 </Card>
//                             </div>

//                             {/* Right: Review + Publish + Version Policy */}
//                             <div className="space-y-4">
//                                 <Card className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
//                                     <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
//                                     <CardHeader className="pb-2">
//                                         <CardTitle className="text-base">Review</CardTitle>
//                                         <div className="text-xs text-slate-500">Snapshot before saving</div>
//                                     </CardHeader>
//                                     <CardContent className="space-y-3">
//                                         <div className="flex flex-wrap items-center gap-2">
//                                             <Badge className={cn("rounded-xl", tone.chip)}>
//                                                 <Building2 className="mr-1 h-3.5 w-3.5" /> {form.dept}
//                                             </Badge>
//                                             <Badge variant="outline" className="rounded-xl">
//                                                 <ClipboardList className="mr-1 h-3.5 w-3.5" /> {typeLabel(form.type)}
//                                             </Badge>
//                                             {form.premium ? (
//                                                 <Badge className="rounded-xl bg-slate-900 text-white">
//                                                     <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
//                                                 </Badge>
//                                             ) : null}
//                                             {form.restricted ? (
//                                                 <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
//                                                     <Shield className="mr-1 h-3.5 w-3.5" /> Restricted
//                                                 </Badge>
//                                             ) : null}
//                                         </div>

//                                         <div className="text-sm font-semibold text-slate-900">{form.name?.trim() || "Untitled"}</div>
//                                         <div className="text-xs text-slate-500">{form.description?.trim() || "No description"}</div>

//                                         <Separator />

//                                         <div className="text-xs font-semibold text-slate-700">Sections</div>
//                                         {form.sections?.length ? (
//                                             <div className="flex flex-wrap gap-2">
//                                                 {form.sections.slice(0, 12).map((s) => (
//                                                     <span key={s} className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
//                                                         {s}
//                                                     </span>
//                                                 ))}
//                                                 {form.sections.length > 12 ? (
//                                                     <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
//                                                         +{form.sections.length - 12} more
//                                                     </span>
//                                                 ) : null}
//                                             </div>
//                                         ) : (
//                                             <div className="text-xs text-slate-500">—</div>
//                                         )}
//                                     </CardContent>
//                                 </Card>

//                                 <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
//                                     <CardHeader className="pb-2">
//                                         <CardTitle className="text-base">Publishing</CardTitle>
//                                         <div className="text-xs text-slate-500">Drafts are editable. Published is visible in Create Record.</div>
//                                     </CardHeader>
//                                     <CardContent className="space-y-3">
//                                         <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
//                                             <div className="min-w-0">
//                                                 <div className="text-sm font-semibold text-slate-900">Publish now</div>
//                                                 <div className="text-xs text-slate-500">Make template available in workflows</div>
//                                             </div>
//                                             <Switch checked={!!form.publish} onCheckedChange={(v) => setForm((p) => ({ ...p, publish: !!v }))} />
//                                         </div>

//                                         {isEdit ? (
//                                             <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
//                                                 <div className="text-xs font-semibold text-slate-700">Versioning Mode</div>
//                                                 <div className="mt-1 text-xs text-slate-500">
//                                                     Use <span className="font-semibold text-slate-700">Update</span> to edit same version or{" "}
//                                                     <span className="font-semibold text-slate-700">New Version</span> to create v+1.
//                                                 </div>

//                                                 <div className="mt-3 flex gap-2">
//                                                     <Button
//                                                         variant={mode === "UPDATE" ? "default" : "outline"}
//                                                         className={cn("h-9 rounded-2xl", mode === "UPDATE" ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
//                                                         onClick={() => setMode("UPDATE")}
//                                                     >
//                                                         <Pencil className="mr-2 h-4 w-4" /> Update
//                                                     </Button>
//                                                     <Button
//                                                         variant={mode === "NEW_VERSION" ? "default" : "outline"}
//                                                         className={cn("h-9 rounded-2xl", mode === "NEW_VERSION" ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
//                                                         onClick={() => setMode("NEW_VERSION")}
//                                                     >
//                                                         <RefreshCcw className="mr-2 h-4 w-4" /> New Version
//                                                     </Button>
//                                                 </div>
//                                             </div>
//                                         ) : null}
//                                     </CardContent>
//                                 </Card>
//                             </div>
//                         </div>
//                     </div>

//                     <DialogFooter className="border-t border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-6">
//                         <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
//                             <div className="text-xs text-slate-500">
//                                 {isEdit ? (
//                                     <>
//                                         Editing <span className="font-semibold text-slate-700">{template?.name}</span>
//                                     </>
//                                 ) : (
//                                     <>Creating a new template</>
//                                 )}
//                             </div>

//                             <div className="flex flex-wrap gap-2">
//                                 <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange?.(false)}>
//                                     Cancel
//                                 </Button>
//                                 <Button className={cn("rounded-2xl", tone.btn)} onClick={submit}>
//                                     <CheckCircle2 className="mr-2 h-4 w-4" />
//                                     {isEdit ? (mode === "NEW_VERSION" ? "Save New Version" : "Save Changes") : "Create Template"}
//                                 </Button>
//                             </div>
//                         </div>
//                     </DialogFooter>
//                 </div>
//             </DialogContent>
//         </Dialog >
//     )
// }

function ToggleRow({ title, desc, checked, onCheckedChange }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="text-xs text-slate-500">{desc}</div>
            </div>
            <Switch checked={!!checked} onCheckedChange={onCheckedChange} />
        </div>
    )
}

// -------------------------------
// Versions Dialog
// -------------------------------
function VersionsDialog({ open, onOpenChange, template, onRestore }) {
    if (!template) {
        return (
            <Dialog open={!!open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[700px] rounded-3xl border-slate-200 bg-white/85 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Versions</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-slate-600">No template selected</div>
                </DialogContent>
            </Dialog>
        )
    }

    const tone = deptTone(template.dept)
    const versions = [...(template.versions || [])].sort((a, b) => (b.v || 0) - (a.v || 0))

    return (
        <Dialog open={!!open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-[820px] rounded-3xl border-slate-200 bg-white/85 p-0 backdrop-blur-xl overflow-hidden">
                <div className={cn("h-2 w-full bg-gradient-to-r", tone.bar)} />

                <div className="px-4 pt-4 md:px-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-900">Version History</div>
                            <div className="mt-1 text-xs text-slate-500">
                                {template.name} · {template.dept} · {typeLabel(template.type)}
                            </div>
                        </div>

                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => onOpenChange?.(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusPill status={template.status} />
                        <Badge variant="outline" className="rounded-xl">
                            Current: <span className="ml-1 font-semibold">v{template.version}</span>
                        </Badge>
                        {template.premium ? (
                            <Badge className="rounded-xl bg-slate-900 text-white">
                                <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
                            </Badge>
                        ) : null}
                    </div>
                </div>

                <div className="max-h-[70dvh] overflow-y-auto px-4 pb-4 md:px-6">
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                        <div className="grid grid-cols-[0.6fr_1fr_1.2fr_0.8fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                            <div>Version</div>
                            <div>Status</div>
                            <div>Note</div>
                            <div className="text-right">Action</div>
                        </div>

                        <div className="divide-y divide-slate-200">
                            {versions.map((v) => (
                                <div key={v.id} className="grid grid-cols-[0.6fr_1fr_1.2fr_0.8fr] items-center gap-2 bg-white px-3 py-3">
                                    <div className="text-sm font-semibold text-slate-900">v{v.v}</div>
                                    <div>
                                        <StatusPill status={v.status} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm text-slate-800">{v.note || "—"}</div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {fmtDate(v.updated_at)} · {v.updated_by}
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            variant="outline"
                                            className="h-9 rounded-2xl"
                                            onClick={() => onRestore?.(v.v)}
                                        >
                                            <RefreshCcw className="mr-2 h-4 w-4" /> Restore
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {!versions.length ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                            <div className="text-sm font-semibold text-slate-800">No versions</div>
                            <div className="mt-1 text-xs text-slate-500">This template has no history yet.</div>
                        </div>
                    ) : null}
                </div>

                <div className="border-t border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-6">
                    <div className="text-xs text-slate-500">
                        Restore creates a <span className="font-semibold text-slate-700">new Draft version</span> (v+1) in UI policy.
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// -------------------------------
// Small UI helpers
// -------------------------------
function StatusPill({ status }) {
    const s = (status || "").toUpperCase()
    if (s === "PUBLISHED") {
        return (
            <Badge className="rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <Globe className="mr-1 h-3.5 w-3.5" /> Published
            </Badge>
        )
    }
    if (s === "DRAFT") {
        return (
            <Badge className="rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                <Pencil className="mr-1 h-3.5 w-3.5" /> Draft
            </Badge>
        )
    }
    if (s === "ARCHIVED") {
        return (
            <Badge className="rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <EyeOff className="mr-1 h-3.5 w-3.5" /> Archived
            </Badge>
        )
    }
    return (
        <Badge variant="outline" className="rounded-xl">
            {status || "—"}
        </Badge>
    )
}

function IconBtn({ title, onClick, disabled, children }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={!!disabled}
            className={cn(
                "grid h-9 w-9 place-items-center rounded-2xl ring-1 ring-slate-200 transition",
                disabled ? "bg-slate-50 text-slate-300" : "bg-white text-slate-700 hover:bg-slate-50"
            )}
        >
            {children}
        </button>
    )
}

function Empty() {
    return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
            <div className="text-sm font-semibold text-slate-800">No templates found</div>
            <div className="mt-1 text-xs text-slate-500">Try clearing filters or create a new template.</div>
        </div>
    )
}
