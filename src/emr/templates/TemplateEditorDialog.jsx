// FILE: frontend/src/emr/templates/TemplateEditorDialog.jsx
import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
    X,
    Plus,
    ArrowUp,
    ArrowDown,
    Trash2,
    Building2,
    ClipboardList,
    Sparkles,
    Shield,
    CheckCircle2,
    Pencil,
    RefreshCcw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

/** ---------- DATA (replace with API later) ---------- */
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

function typeLabel(k) {
    return RECORD_TYPES.find((x) => x.key === k)?.label || k || "—"
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

/** ---------- SMALL UI HELPERS ---------- */
function IconBtn({ title, onClick, disabled, children }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
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

function ToggleRow({ title, desc, checked, onCheckedChange }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="text-xs text-slate-500">{desc}</div>
            </div>
            <div className="ml-auto">
                <Switch checked={!!checked} onCheckedChange={onCheckedChange} />
            </div>
        </div>
    )
}

/** ---------- MAIN DIALOG ---------- */
export default function TemplateEditorDialog({ open, onOpenChange, template, onSave }) {
    const isEdit = !!template

    const [mode, setMode] = useState("UPDATE") // UPDATE | NEW_VERSION | CREATE
    const [form, setForm] = useState({
        id: null,
        dept: "Common (All)",
        type: "OPD_NOTE",
        name: "",
        description: "",
        premium: false,
        is_default: false,
        restricted: false,
        publish: false,
        sections: [],
        schema_json: "{\n}",
    })
    const [secInput, setSecInput] = useState("")

    useEffect(() => {
        if (!open) return

        if (isEdit) {
            setMode("UPDATE")
            setForm({
                id: template.id,
                dept: template.dept,
                type: template.type,
                name: template.name,
                description: template.description || "",
                premium: !!template.premium,
                is_default: !!template.is_default,
                restricted: !!template.restricted,
                publish: template.status === "PUBLISHED",
                sections: [...(template.sections || [])],
                schema_json: template.schema_json || "{\n}",
            })
        } else {
            setMode("CREATE")
            setForm({
                id: null,
                dept: "Common (All)",
                type: "OPD_NOTE",
                name: "",
                description: "",
                premium: false,
                is_default: false,
                restricted: false,
                publish: false,
                sections: ["Chief Complaint", "History", "Exam", "Assessment", "Plan"],
                schema_json: `{\n  "blocks": [\n    { "type": "text", "label": "Example" }\n  ]\n}`,
            })
        }
        setSecInput("")
    }, [open, isEdit, template])

    const tone = useMemo(() => deptTone(form.dept), [form.dept])

    function addSection() {
        const v = (secInput || "").trim()
        if (!v) return
        if ((form.sections || []).includes(v)) return toast.error("Section already exists")
        setForm((p) => ({ ...p, sections: [...(p.sections || []), v] }))
        setSecInput("")
    }

    function removeSection(idx) {
        setForm((p) => ({ ...p, sections: (p.sections || []).filter((_, i) => i !== idx) }))
    }

    function moveSection(idx, dir) {
        const arr = [...(form.sections || [])]
        const j = idx + dir
        if (j < 0 || j >= arr.length) return
            ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
        setForm((p) => ({ ...p, sections: arr }))
    }

    function validate() {
        if (!form.name.trim() || form.name.trim().length < 3) return "Template name is required (min 3 chars)"
        if (!form.dept) return "Department is required"
        if (!form.type) return "Record type is required"
        if (!form.sections?.length) return "Add at least one section"
        return null
    }

    function submit() {
        const err = validate()
        if (err) return toast.error(err)

        if (!isEdit) return onSave?.(form, "CREATE")
        if (mode === "UPDATE") return onSave?.(form, "UPDATE")
        if (mode === "NEW_VERSION") return onSave?.(form, "NEW_VERSION")
    }

    return (
        <Dialog open={!!open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    // ✅ Full-screen (mobile) + centered modal (desktop)
                    "!fixed !left-0 !top-0 !translate-x-0 !translate-y-0 !inset-0",
                    "!w-screen !h-[100dvh] !max-w-none",
                    "md:!inset-auto md:!left-1/2 md:!top-1/2 md:!-translate-x-1/2 md:!-translate-y-1/2",
                    "md:!w-[98vw] md:!max-w-[1100px] md:!h-[92dvh]",
                    // ✅ visuals
                    "rounded-none md:rounded-3xl border border-slate-200 bg-white/85 p-0 backdrop-blur-xl shadow-xl",
                    // ✅ IMPORTANT: allow inner body scroll only
                    "overflow-hidden"
                )}
            >
                {/* ✅ Flex shell: header + body(scroll) + footer */}
                <div className="flex h-full min-h-0 flex-col">
                    {/* Tone bar */}
                    <div className={cn("h-2 w-full shrink-0 bg-gradient-to-r", tone.bar)} />

                    {/* Header (always visible) */}
                    <DialogHeader className="shrink-0 border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <DialogTitle className="text-base">
                                    {isEdit ? "Edit Template" : "Create Template"}
                                </DialogTitle>
                                <div className="mt-1 text-xs text-slate-500">
                                    Department-wise · sections builder · versioning · publish control
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-2xl"
                                onClick={() => onOpenChange?.(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    {/* ✅ Scroll area (THIS is the fix) */}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
                            {/* Left: Form */}
                            <div className="space-y-4">
                                {/* Core */}
                                <Card className="rounded-3xl border-slate-200 bg-white">
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <div>
                                                <div className="mb-1 text-xs font-semibold text-slate-700">Template Name *</div>
                                                <Input
                                                    value={form.name}
                                                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                                    placeholder="e.g., OPD Consultation (Standard)"
                                                    className="h-10 rounded-2xl"
                                                />
                                                <div className="mt-1 text-xs text-slate-500">Used in Record creation flow.</div>
                                            </div>

                                            <div>
                                                <div className="mb-1 text-xs font-semibold text-slate-700">Record Type *</div>
                                                <select
                                                    value={form.type}
                                                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                                >
                                                    {RECORD_TYPES.map((t) => (
                                                        <option key={t.key} value={t.key}>
                                                            {t.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <div className="mb-1 text-xs font-semibold text-slate-700">Department *</div>
                                                <select
                                                    value={form.dept}
                                                    onChange={(e) => setForm((p) => ({ ...p, dept: e.target.value }))}
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                                                >
                                                    {DEPARTMENTS.map((d) => (
                                                        <option key={d} value={d}>
                                                            {d}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <div className="mb-1 text-xs font-semibold text-slate-700">Description</div>
                                                <Input
                                                    value={form.description}
                                                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                                    placeholder="Optional short description…"
                                                    className="h-10 rounded-2xl"
                                                />
                                            </div>
                                        </div>

                                        <Separator className="my-4" />

                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                <ToggleRow
                                                    title="Premium"
                                                    desc="Show premium badge"
                                                    checked={form.premium}
                                                    onCheckedChange={(v) => setForm((p) => ({ ...p, premium: !!v }))}
                                                />
                                                <ToggleRow
                                                    title="Default"
                                                    desc="Preferred template"
                                                    checked={form.is_default}
                                                    onCheckedChange={(v) => setForm((p) => ({ ...p, is_default: !!v }))}
                                                />
                                                <ToggleRow
                                                    title="Restricted"
                                                    desc="Visibility controlled"
                                                    checked={form.restricted}
                                                    onCheckedChange={(v) => setForm((p) => ({ ...p, restricted: !!v }))}
                                                />
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge className={cn("rounded-xl", tone.chip)}>
                                                    <Building2 className="mr-1 h-3.5 w-3.5" />
                                                    {form.dept}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-xl">
                                                    <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                                    {typeLabel(form.type)}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Sections Builder */}
                                <Card className="rounded-3xl border-slate-200 bg-white">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <CardTitle className="text-base">Sections Builder</CardTitle>
                                            <Badge variant="outline" className="rounded-xl">
                                                {(form.sections || []).length} section(s)
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Add / reorder / remove sections used in record UI.
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-3">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                            <Input
                                                value={secInput}
                                                onChange={(e) => setSecInput(e.target.value)}
                                                placeholder="Add section (e.g., Vitals)"
                                                className="h-10 rounded-2xl"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault()
                                                        addSection()
                                                    }
                                                }}
                                            />
                                            <Button type="button" className={cn("h-10 rounded-2xl", tone.btn)} onClick={addSection}>
                                                <Plus className="mr-2 h-4 w-4" /> Add
                                            </Button>
                                        </div>

                                        {(form.sections || []).length ? (
                                            <div className="space-y-2">
                                                {form.sections.map((s, idx) => (
                                                    <div
                                                        key={`${s}-${idx}`}
                                                        className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                                                    >
                                                        <div className="min-w-0 truncate text-sm font-semibold text-slate-800">{s}</div>
                                                        <div className="flex items-center gap-1">
                                                            <IconBtn title="Move Up" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>
                                                                <ArrowUp className="h-4 w-4" />
                                                            </IconBtn>
                                                            <IconBtn
                                                                title="Move Down"
                                                                onClick={() => moveSection(idx, +1)}
                                                                disabled={idx === form.sections.length - 1}
                                                            >
                                                                <ArrowDown className="h-4 w-4" />
                                                            </IconBtn>
                                                            <IconBtn title="Remove" onClick={() => removeSection(idx)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </IconBtn>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                                                <div className="text-sm font-semibold text-slate-800">No sections</div>
                                                <div className="mt-1 text-xs text-slate-500">Add at least one section to save.</div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Schema JSON */}
                                <Card className="rounded-3xl border-slate-200 bg-white">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Template Schema (UI)</CardTitle>
                                        <div className="text-xs text-slate-500">Later connect to your dynamic form renderer.</div>
                                    </CardHeader>
                                    <CardContent>
                                        <textarea
                                            value={form.schema_json}
                                            onChange={(e) => setForm((p) => ({ ...p, schema_json: e.target.value }))}
                                            rows={10}
                                            className="w-full rounded-2xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none focus:border-slate-300"
                                            placeholder='{\n  "blocks": []\n}'
                                        />
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right: Review + Publish + Version */}
                            <div className="space-y-4">
                                <Card className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
                                    <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Review</CardTitle>
                                        <div className="text-xs text-slate-500">Snapshot before saving</div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge className={cn("rounded-xl", tone.chip)}>
                                                <Building2 className="mr-1 h-3.5 w-3.5" /> {form.dept}
                                            </Badge>
                                            <Badge variant="outline" className="rounded-xl">
                                                <ClipboardList className="mr-1 h-3.5 w-3.5" /> {typeLabel(form.type)}
                                            </Badge>
                                            {form.premium ? (
                                                <Badge className="rounded-xl bg-slate-900 text-white">
                                                    <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
                                                </Badge>
                                            ) : null}
                                            {form.restricted ? (
                                                <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                                    <Shield className="mr-1 h-3.5 w-3.5" /> Restricted
                                                </Badge>
                                            ) : null}
                                        </div>

                                        <div className="text-sm font-semibold text-slate-900">{form.name?.trim() || "Untitled"}</div>
                                        <div className="text-xs text-slate-500">{form.description?.trim() || "No description"}</div>

                                        <Separator />

                                        <div className="text-xs font-semibold text-slate-700">Sections</div>
                                        {form.sections?.length ? (
                                            <div className="flex flex-wrap gap-2">
                                                {form.sections.slice(0, 12).map((s) => (
                                                    <span
                                                        key={s}
                                                        className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                                {form.sections.length > 12 ? (
                                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                                        +{form.sections.length - 12} more
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500">—</div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Publishing</CardTitle>
                                        <div className="text-xs text-slate-500">
                                            Drafts are editable. Published is visible in Create Record.
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-900">Publish now</div>
                                                <div className="text-xs text-slate-500">Make template available in workflows</div>
                                            </div>
                                            <Switch
                                                checked={!!form.publish}
                                                onCheckedChange={(v) => setForm((p) => ({ ...p, publish: !!v }))}
                                            />
                                        </div>

                                        {isEdit ? (
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                                                <div className="text-xs font-semibold text-slate-700">Versioning Mode</div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    Use <span className="font-semibold text-slate-700">Update</span> to edit same version or{" "}
                                                    <span className="font-semibold text-slate-700">New Version</span> to create v+1.
                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        variant={mode === "UPDATE" ? "default" : "outline"}
                                                        className={cn(
                                                            "h-9 rounded-2xl",
                                                            mode === "UPDATE" ? "bg-slate-900 text-white hover:bg-slate-800" : ""
                                                        )}
                                                        onClick={() => setMode("UPDATE")}
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" /> Update
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant={mode === "NEW_VERSION" ? "default" : "outline"}
                                                        className={cn(
                                                            "h-9 rounded-2xl",
                                                            mode === "NEW_VERSION" ? "bg-slate-900 text-white hover:bg-slate-800" : ""
                                                        )}
                                                        onClick={() => setMode("NEW_VERSION")}
                                                    >
                                                        <RefreshCcw className="mr-2 h-4 w-4" /> New Version
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    {/* Footer (always visible) */}
                    <DialogFooter className="shrink-0 border-t border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-6">
                        <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="text-xs text-slate-500">
                                {isEdit ? (
                                    <>
                                        Editing <span className="font-semibold text-slate-700">{template?.name}</span>
                                    </>
                                ) : (
                                    <>Creating a new template</>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onOpenChange?.(false)}>
                                    Cancel
                                </Button>
                                <Button type="button" className={cn("rounded-2xl", tone.btn)} onClick={submit}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    {isEdit ? (mode === "NEW_VERSION" ? "Save New Version" : "Save Changes") : "Create Template"}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
