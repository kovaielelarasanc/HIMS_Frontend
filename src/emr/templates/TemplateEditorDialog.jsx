// FILE: frontend/src/emr/templates/TemplateEditorDialog.jsx
import React, { useEffect, useMemo, useRef, useState } from "react"
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
  Braces,
  Undo2,
  Wand2,
  Tag,
  ChevronDown,
  Search,
  Library,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { emrMeta } from "@/api/emrMeta"
// import { emrTemplatesClient } from "@/api/emrTemplatesClient"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { emrTemplatesClient } from "@/api/emrTemplatesClient"

/** -------------------- helpers -------------------- */

function errMsg(e, fallback = "Something went wrong") {
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  )
}

function deptTone(deptCodeRaw) {
  const d = (deptCodeRaw || "").toUpperCase()
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

function safeTrim(s) {
  return String(s ?? "").trim()
}

function normalizeSection(s) {
  return safeTrim(s).replace(/\s+/g, " ")
}

function ensureJsonText(v, fallback = "{\n}") {
  if (v == null) return fallback
  if (typeof v === "string") return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return fallback
  }
}

function prettifyJsonString(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(raw ?? "")
  }
}

function validateJsonString(raw) {
  try {
    const s = typeof raw === "string" ? raw : JSON.stringify(raw)
    JSON.parse(s)
    return null
  } catch (e) {
    return e?.message || "Invalid JSON"
  }
}

function toArrayMaybe(v) {
  if (Array.isArray(v)) return v
  if (typeof v === "string") {
    const s = v.trim()
    if (!s) return []
    try {
      const j = JSON.parse(s)
      if (Array.isArray(j)) return j
    } catch { }
    if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean)
  }
  return []
}

function makeCodeFromLabel(label, usedSet, maxLen = 32) {
  let base = safeTrim(label)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")

  if (!base) base = "ITEM"
  if (/^\d/.test(base)) base = `X_${base}`
  base = base.slice(0, maxLen).replace(/_+$/g, "")

  let code = base
  let n = 2
  while (usedSet?.has?.(code)) {
    const suffix = `_${n++}`
    code = (base.slice(0, Math.max(1, maxLen - suffix.length)) + suffix).replace(/_+$/g, "")
  }
  return code
}

function IconBtn({ title, onClick, disabled, children, className }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!!disabled}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-2xl ring-1 ring-slate-200 transition",
        disabled ? "cursor-not-allowed bg-slate-50 text-slate-300" : "bg-white text-slate-700 hover:bg-slate-50",
        className
      )}
    >
      {children}
    </button>
  )
}

function ToggleRow({ title, desc, checked, onCheckedChange, disabled }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2", disabled ? "opacity-70" : "")}>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <div className="ml-auto">
        <Switch disabled={!!disabled} checked={!!checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

/** -------------------- clinical phase mapping (MATCH BACKEND) -------------------- */

const PHASES = [
  { key: "INTAKE", label: "Intake", hint: "Reason for visit, triage, vitals" },
  { key: "HISTORY", label: "History", hint: "HPI, past history, meds, allergies" },
  { key: "EXAM", label: "Examination", hint: "PE, system exam, findings" },
  { key: "ASSESSMENT", label: "Assessment", hint: "Dx, differential, severity" },
  { key: "PLAN", label: "Plan", hint: "Rx, orders, advice, follow-up" },
  { key: "DISCHARGE", label: "Closure", hint: "Summary, instructions, warnings" },
]

function phaseOfSection(nameRaw) {
  const n = (nameRaw || "").toLowerCase()
  if (/(chief complaint|triage|vitals|presenting)/.test(n)) return "INTAKE"
  if (/(history|hpi|past|family|social|allerg|medication|immun|obstetric)/.test(n)) return "HISTORY"
  if (/(exam|examination|inspection|palpation|systemic|finding)/.test(n)) return "EXAM"
  if (/(assessment|diagnosis|impression|problem list|ddx|differential)/.test(n)) return "ASSESSMENT"
  if (/(plan|treatment|prescription|orders|investigation|lab|radiology|procedure|advice|follow)/.test(n)) return "PLAN"
  if (/(summary|discharge|instructions|warning|counsel)/.test(n)) return "DISCHARGE"
  return "PLAN"
}

function groupSectionsByPhase(sections) {
  const m = new Map(PHASES.map((p) => [p.key, []]))
  ;(sections || []).forEach((s) => {
    const k = phaseOfSection(s)
    if (!m.has(k)) m.set(k, [])
    const arr = m.get(k) || []
    arr.push(s)
    m.set(k, arr)
  })
  return m
}

/** -------------------- local fallback library -------------------- */

const FALLBACK_LIBRARY = [
  "Chief Complaint",
  "Triage",
  "Vitals",
  "HPI",
  "Past Medical History",
  "Surgical History",
  "Family History",
  "Social History",
  "Allergies",
  "Medication History",
  "Menstrual / Obstetric History",
  "Examination",
  "Systemic Examination",
  "Diagnosis",
  "Differential Diagnosis",
  "Assessment",
  "Plan",
  "Prescription",
  "Investigations / Orders",
  "Lab Orders",
  "Radiology Orders",
  "Advice",
  "Follow-up",
  "Discharge Summary",
  "Instructions",
  "Warning Signs",
]

/** -------------------- presets (local fallback) -------------------- */

function presetSections(kind) {
  const k = (kind || "").toUpperCase()
  if (k === "SOAP") {
    return [
      "Chief Complaint",
      "Vitals",
      "History of Present Illness",
      "Past / Family / Social History",
      "Allergies",
      "Medication History",
      "Examination",
      "Assessment / Diagnosis",
      "Plan",
      "Prescription",
      "Investigations / Orders",
      "Advice & Follow-up",
    ]
  }
  if (k === "IPD_PROGRESS") {
    return [
      "Vitals",
      "Intake / Output",
      "Overnight Events",
      "Focused Examination",
      "Assessment / Diagnosis",
      "Current Medications",
      "Investigations / Results",
      "Plan",
      "Orders",
      "Nursing Notes",
    ]
  }
  if (k === "DISCHARGE") {
    return [
      "Admission Details",
      "Final Diagnosis",
      "Hospital Course / Summary",
      "Procedures",
      "Investigations",
      "Discharge Medications",
      "Instructions",
      "Follow-up",
      "Warning Signs",
    ]
  }
  if (k === "NURSING") {
    return [
      "Triage / Vitals",
      "Pain Score",
      "Allergies",
      "IV Fluids / Lines",
      "Medication Administration",
      "Nursing Notes",
      "Patient Education",
      "Shift Handover",
    ]
  }
  return ["Chief Complaint", "History", "Exam", "Assessment", "Plan"]
}

/** -------------------- Smart Meta Picker -------------------- */

function SmartMetaPicker({
  label,
  placeholder,
  items,
  valueCode,
  getCode,
  getPrimaryLabel,
  getSecondaryLabel,
  onSelectCode,
  onQuickCreate,
  className,
  disabled = false,
}) {
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)

  const selected = useMemo(() => {
    const code = String(valueCode || "")
    return (items || []).find((x) => String(getCode(x)) === code) || null
  }, [items, valueCode, getCode])

  useEffect(() => {
    function onDown(e) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    if (!open) setQ("")
  }, [valueCode, open])

  const filtered = useMemo(() => {
    const query = safeTrim(q).toLowerCase()
    const arr = Array.isArray(items) ? items : []
    if (!query) return arr.slice(0, 30)
    return arr
      .filter((x) => {
        const code = String(getCode(x) || "").toLowerCase()
        const p = String(getPrimaryLabel(x) || "").toLowerCase()
        const s = String(getSecondaryLabel?.(x) || "").toLowerCase()
        return code.includes(query) || p.includes(query) || s.includes(query)
      })
      .slice(0, 30)
  }, [items, q, getCode, getPrimaryLabel, getSecondaryLabel])

  const typed = safeTrim(q)
  const exactMatch = useMemo(() => {
    if (!typed) return null
    const t = typed.toLowerCase()
    return (items || []).find((x) => String(getPrimaryLabel(x) || "").trim().toLowerCase() === t) || null
  }, [items, typed, getPrimaryLabel])

  async function quickCreate() {
    const text = safeTrim(q)
    if (!text) return

    if (exactMatch) {
      onSelectCode?.(String(getCode(exactMatch)))
      setOpen(false)
      return
    }

    setBusy(true)
    try {
      const created = await onQuickCreate?.(text)
      if (created) {
        onSelectCode?.(String(getCode(created)))
        toast.success(`${label} added`)
        setOpen(false)
        setQ("")
      }
    } catch (e) {
      toast.error(errMsg(e, `Failed to add ${label}`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={wrapRef} className={cn("relative", disabled ? "opacity-70" : "", className)}>
      <div className="mb-1 text-xs font-semibold text-slate-700">{label} *</div>

      <div className="relative">
        <Input
          disabled={disabled}
          value={open ? q : selected ? `${getPrimaryLabel(selected)} (${getCode(selected)})` : ""}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn("h-10 rounded-2xl pr-10", "font-sans tracking-[-0.01em]")}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700",
            disabled ? "cursor-not-allowed opacity-60 hover:bg-transparent" : ""
          )}
          title="Toggle list"
        >
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </div>

      {open && !disabled ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(2,6,23,0.35)]">
          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.length ? (
              filtered.map((x) => {
                const code = String(getCode(x) || "")
                const primary = String(getPrimaryLabel(x) || "")
                const secondary = String(getSecondaryLabel?.(x) || "")
                const active = code === String(valueCode || "")
                return (
                  <button
                    key={code || primary}
                    type="button"
                    onClick={() => {
                      onSelectCode?.(code)
                      setOpen(false)
                      setQ("")
                    }}
                    className={cn(
                      "w-full rounded-2xl px-3 py-2 text-left transition",
                      active ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{primary}</div>
                        <div className={cn("truncate text-xs", active ? "text-white/70" : "text-slate-500")}>
                          {code}
                          {secondary ? ` · ${secondary}` : ""}
                        </div>
                      </div>
                      {active ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-600">No matches. Type to add.</div>
            )}

            {typed ? (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={quickCreate}
                  className={cn(
                    "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50",
                    busy ? "opacity-60" : ""
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {exactMatch ? "Select existing" : `Add “${typed}”`}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {exactMatch ? "This already exists in the list" : "Click to create instantly (code auto-generated)"}
                      </div>
                    </div>
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </div>
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-500">
            Tip: Type and click “Add” to create quickly.
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** -------------------- main component -------------------- */

export default function TemplateEditorDialog({ open, onOpenChange, template, onSave }) {
  const isEdit = !!template
  const nameRef = useRef(null)

  const [departments, setDepartments] = useState([])
  const [recordTypes, setRecordTypes] = useState([])

  // modes: CREATE uses "CREATE". Edit uses "UPDATE" or "NEW_VERSION"
  const [mode, setMode] = useState("UPDATE")
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    id: null,
    dept_code: "",
    record_type_code: "",
    name: "",
    description: "",
    changelog: "",
    premium: false,
    is_default: false,
    restricted: false,
    publish: false,
    sections: [],
    schema_json: "{\n}",
  })

  // sections builder UX
  const [secInput, setSecInput] = useState("")
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(null)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editingVal, setEditingVal] = useState("")
  const [undoSections, setUndoSections] = useState(null)

  // schema validation
  const [schemaErr, setSchemaErr] = useState(null)

  // live preview/review (backend)
  const [review, setReview] = useState({ phase_summary: [], warnings: [], publish_ready: true })
  const [reviewLoading, setReviewLoading] = useState(false)

  // section library (API + fallback)
  const [libQ, setLibQ] = useState("")
  const [libLoading, setLibLoading] = useState(false)
  const [libItems, setLibItems] = useState([])
  const [libErr, setLibErr] = useState(null)

  // presets from meta bootstrap (optional)
  const [presets, setPresets] = useState([])

  const tone = useMemo(() => deptTone(form.dept_code), [form.dept_code])

  const originalRef = useRef({
    sections: [],
    schema_json: "{\n}",
    publish: false,
    dept_code: "",
    record_type_code: "",
  })

  function normalizeSectionsForSave(sections) {
    return (sections || [])
      .map((s) => normalizeSection(s))
      .filter(Boolean)
      .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
  }

  function readTemplatePublished(tpl) {
    if (typeof tpl?.publish === "boolean") return tpl.publish
    if (typeof tpl?.published === "boolean") return tpl.published
    const st = String(
      tpl?.status ||
      tpl?.version_status ||
      tpl?.latest_version?.status ||
      tpl?.latest_version?.state ||
      ""
    ).toUpperCase()
    return st === "PUBLISHED"
  }

  // ---- meta load (safe against close/unmount) ----
  const metaReqIdRef = useRef(0)
  async function loadMeta() {
    const reqId = ++metaReqIdRef.current
    try {
      const meta = await emrMeta.bootstrap(true)
      if (reqId !== metaReqIdRef.current) return

      setDepartments(Array.isArray(meta.departments) ? meta.departments : [])
      setRecordTypes(Array.isArray(meta.record_types) ? meta.record_types : [])
      setPresets(Array.isArray(meta.presets) ? meta.presets : [])
    } catch (e) {
      if (reqId !== metaReqIdRef.current) return
      toast.error(errMsg(e, "Failed to load EMR meta"))
      setDepartments([])
      setRecordTypes([])
      setPresets([])
    }
  }

  // ---- open lifecycle ----
  useEffect(() => {
    if (!open) return

    setTimeout(() => nameRef.current?.focus?.(), 0)
    loadMeta()

    // reset UI states
    setSecInput("")
    setSelectedSectionIdx(null)
    setEditingIdx(null)
    setEditingVal("")
    setUndoSections(null)
    setSaving(false)

    setLibQ("")
    setLibItems([])
    setLibErr(null)
    setLibLoading(false)

    if (isEdit) {
      setMode("UPDATE")

      const dept = String(template?.dept_code || template?.dept || template?.department || "").toUpperCase()
      const type = String(template?.record_type_code || template?.type || template?.record_type || "").toUpperCase()

      const rawSections =
        template?.sections ??
        template?.sections_json ??
        template?.latest_version?.sections ??
        template?.latest_version?.sections_json ??
        []

      const sections = toArrayMaybe(rawSections).map((x) => String(x || "")).filter(Boolean)
      const schemaText = ensureJsonText(
        template?.schema_json ?? template?.latest_version?.schema_json,
        "{\n}"
      )
      const published = readTemplatePublished(template)
      const schemaPretty = prettifyJsonString(schemaText)

      originalRef.current = {
        sections: normalizeSectionsForSave(sections),
        schema_json: schemaPretty,
        publish: !!published,
        dept_code: dept,
        record_type_code: type,
      }

      setForm({
        id: template.id,
        dept_code: dept,
        record_type_code: type,
        name: template.name || "",
        description: template.description || "",
        changelog: "",
        premium: !!template.premium,
        is_default: !!template.is_default,
        restricted: !!template.restricted,
        publish: !!published,
        sections,
        schema_json: schemaPretty,
      })

      setSchemaErr(validateJsonString(schemaPretty))
    } else {
      setMode("CREATE")
      const seedSchema = `{
  "schema_version": 1,
  "ui": {},
  "rules": [],
  "sections": []
}`
      originalRef.current = {
        sections: [],
        schema_json: seedSchema,
        publish: false,
        dept_code: "",
        record_type_code: "",
      }
      setForm({
        id: null,
        dept_code: "",
        record_type_code: "",
        name: "",
        description: "",
        changelog: "",
        premium: false,
        is_default: false,
        restricted: false,
        publish: false,
        sections: presetSections("SOAP"),
        schema_json: seedSchema,
      })
      setSchemaErr(validateJsonString(seedSchema))
    }
  }, [open, isEdit, template?.id])

  // after meta loads, only fill empty codes (CREATE only)
  useEffect(() => {
    if (!open) return
    if (isEdit) return
    setForm((p) => {
      const next = { ...p }
      if (!next.dept_code && departments?.length) next.dept_code = String(departments[0]?.code || "COMMON").toUpperCase()
      if (!next.record_type_code && recordTypes?.length) next.record_type_code = String(recordTypes[0]?.code || "OPD_NOTE").toUpperCase()
      return next
    })
  }, [open, isEdit, departments, recordTypes])

  // schema debounce validation
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setSchemaErr(validateJsonString(form.schema_json || "{\n}")), 250)
    return () => clearTimeout(t)
  }, [open, form.schema_json])

  const deptLabel = (code) => departments.find((d) => String(d.code || "").toUpperCase() === String(code || "").toUpperCase())?.name || code || "—"
  const typeLabel = (code) => recordTypes.find((t) => String(t.code || "").toUpperCase() === String(code || "").toUpperCase())?.label || code || "—"

  async function quickCreateDept(typedName) {
    const used = new Set((departments || []).map((d) => String(d.code || "").toUpperCase()))
    const code = makeCodeFromLabel(typedName, used, 32)
    const created = await emrMeta.createDepartment({ code, name: typedName, is_active: true, display_order: 1000 })
    await loadMeta()
    return created
  }

  async function quickCreateType(typedLabel) {
    const used = new Set((recordTypes || []).map((t) => String(t.code || "").toUpperCase()))
    const code = makeCodeFromLabel(typedLabel, used, 32)
    const created = await emrMeta.createRecordType({
      code,
      label: typedLabel,
      category: null,
      is_active: true,
      display_order: 1000,
    })
    await loadMeta()
    return created
  }

  // ---------- section library fetch ----------
  useEffect(() => {
    if (!open) return
    if (!form.dept_code || !form.record_type_code) return

    let alive = true
    const t = setTimeout(async () => {
      setLibLoading(true)
      setLibErr(null)
      try {
        const res = await emrTemplatesClient.sectionLibraryList({
          q: safeTrim(libQ),
          dept_code: form.dept_code || "ALL",
          record_type_code: form.record_type_code || "ALL",
          active: true,
          limit: 250,
        })
        const data = res?.data ?? res
        if (!alive) return
        setLibItems(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!alive) return
        setLibErr(errMsg(e, "Failed to load section library"))
        setLibItems(
          FALLBACK_LIBRARY.map((label) => ({
            id: null,
            code: makeCodeFromLabel(label, new Set(), 32),
            label,
            dept_code: "ALL",
            record_type_code: "ALL",
            group: "FALLBACK",
            display_order: 9999,
            is_active: true,
          }))
        )
      } finally {
        if (alive) setLibLoading(false)
      }
    }, 250)

    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [open, form.dept_code, form.record_type_code, libQ])

  // ---------- live preview / review ----------
  useEffect(() => {
    if (!open) return
    if (!form.dept_code || !form.record_type_code) return
    if (schemaErr) {
      setReview({ phase_summary: [], warnings: ["Fix JSON errors to preview"], publish_ready: false })
      return
    }

    let alive = true
    const t = setTimeout(async () => {
      setReviewLoading(true)
      try {
        const res = await emrTemplatesClient.previewSchema({
          dept_code: form.dept_code,
          record_type_code: form.record_type_code,
          sections: normalizeSectionsForSave(form.sections),
          schema_json: form.schema_json,
        })
        const data = res?.data ?? res
        if (!alive) return
        setReview(data || { phase_summary: [], warnings: [], publish_ready: true })
      } catch (e) {
        if (!alive) return
        setReview({ phase_summary: [], warnings: [errMsg(e, "Preview failed")], publish_ready: false })
      } finally {
        if (alive) setReviewLoading(false)
      }
    }, 350)

    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [open, form.dept_code, form.record_type_code, form.sections, form.schema_json, schemaErr])

  // ---------- sections builder core ----------
  function addSectionAt(labelRaw, insertAfterIdx = null) {
    const v = normalizeSection(labelRaw)
    if (!v) return

    const exists = (form.sections || []).some((s) => normalizeSection(s).toLowerCase() === v.toLowerCase())
    if (exists) return toast.error("Section already exists")

    setForm((p) => {
      const arr = [...(p.sections || [])]
      const idx = typeof insertAfterIdx === "number" ? insertAfterIdx : null
      if (idx === null || idx < 0 || idx >= arr.length) {
        arr.push(v)
        return { ...p, sections: arr }
      }
      arr.splice(idx + 1, 0, v)
      return { ...p, sections: arr }
    })

    setSecInput("")
  }

  function addSectionFromInput() {
    addSectionAt(secInput, selectedSectionIdx)
  }

  function removeSection(idx) {
    setForm((p) => ({ ...p, sections: (p.sections || []).filter((_, i) => i !== idx) }))
    setSelectedSectionIdx((p) => {
      if (p === null) return null
      if (idx === p) return null
      if (idx < p) return p - 1
      return p
    })
    if (editingIdx === idx) {
      setEditingIdx(null)
      setEditingVal("")
    }
  }

  function moveSection(idx, dir) {
    setForm((p) => {
      const arr = [...(p.sections || [])]
      const j = idx + dir
      if (j < 0 || j >= arr.length) return p
      const tmp = arr[idx]
      arr[idx] = arr[j]
      arr[j] = tmp
      return { ...p, sections: arr }
    })
    setSelectedSectionIdx((sidx) => {
      if (sidx === null) return null
      if (sidx === idx) return idx + dir
      if (sidx === idx + dir) return idx
      return sidx
    })
  }

  function startEditSection(idx) {
    setEditingIdx(idx)
    setEditingVal(form.sections?.[idx] || "")
  }

  function cancelEditSection() {
    setEditingIdx(null)
    setEditingVal("")
  }

  function saveEditSection() {
    const v = normalizeSection(editingVal)
    if (!v) return toast.error("Section label cannot be empty")

    const exists = (form.sections || []).some(
      (s, i) => i !== editingIdx && normalizeSection(s).toLowerCase() === v.toLowerCase()
    )
    if (exists) return toast.error("Another section with same name already exists")

    setForm((p) => {
      const arr = [...(p.sections || [])]
      if (typeof editingIdx === "number" && editingIdx >= 0 && editingIdx < arr.length) arr[editingIdx] = v
      return { ...p, sections: arr }
    })
    setEditingIdx(null)
    setEditingVal("")
  }

  function applyPreset(presetCode) {
    const code = String(presetCode || "").toUpperCase()
    const p = (presets || []).find((x) => String(x.code || "").toUpperCase() === code)

    const nextSections = Array.isArray(p?.sections) ? p.sections : presetSections(code)

    setUndoSections(form.sections || [])
    setForm((prev) => ({ ...prev, sections: nextSections }))
    setSelectedSectionIdx(null)
    toast.success("Preset applied")
  }

  function undoLastSections() {
    if (!undoSections) return
    setForm((p) => ({ ...p, sections: undoSections }))
    setUndoSections(null)
    toast.success("Sections restored")
  }

  function validateCommon() {
    const name = safeTrim(form.name)
    if (!name || name.length < 3) return "Template name is required (min 3 chars)"
    if (!form.dept_code) return "Department is required"
    if (!form.record_type_code) return "Record type is required"

    const sections = normalizeSectionsForSave(form.sections)
    if (!sections.length) return "Add at least one section"

    const jsonErr = validateJsonString(form.schema_json || "{\n}")
    if (jsonErr) return `Schema JSON is invalid: ${jsonErr}`
    return null
  }

  function diffForUpdateMode() {
    const curSections = normalizeSectionsForSave(form.sections)
    const curSchema = prettifyJsonString(form.schema_json || "{\n}")
    const curPublish = !!form.publish

    const a = JSON.stringify(curSections)
    const b = JSON.stringify(originalRef.current.sections || [])
    const sectionsChanged = a !== b
    const schemaChanged = curSchema !== (originalRef.current.schema_json || "{\n}")
    const publishChanged = curPublish !== !!originalRef.current.publish

    return { sectionsChanged, schemaChanged, publishChanged }
  }

  async function submit() {
    // UPDATE mode must not send version fields to backend (extra="forbid")
    if (isEdit && mode === "UPDATE") {
      const d = diffForUpdateMode()
      if (d.sectionsChanged || d.schemaChanged || d.publishChanged) {
        setMode("NEW_VERSION")
        toast.info("You changed Sections / Schema / Publish. Switched to “New Version” mode to save safely.")
        return
      }
    }

    const vErr = validateCommon()
    if (vErr) return toast.error(vErr)

    setSaving(true)
    try {
      if (!isEdit) {
        // CREATE
        const payload = {
          dept: String(form.dept_code || "").toUpperCase(),
          type: String(form.record_type_code || "").toUpperCase(),
          name: safeTrim(form.name),
          description: safeTrim(form.description) || null,
          premium: !!form.premium,
          is_default: !!form.is_default,
          restricted: !!form.restricted,
          publish: !!form.publish,
          changelog: safeTrim(form.changelog) || null,
          sections: normalizeSectionsForSave(form.sections),
          schema_json: prettifyJsonString(form.schema_json || "{\n}"),
        }
        await Promise.resolve(onSave?.(payload, "CREATE"))
        return
      }

      if (mode === "UPDATE") {
        // UPDATE (metadata only)
        const payload = {
          name: safeTrim(form.name),
          description: safeTrim(form.description) || null,
          premium: !!form.premium,
          is_default: !!form.is_default,
          restricted: !!form.restricted,
        }
        await Promise.resolve(onSave?.({ id: form.id, ...payload }, "UPDATE"))
        return
      }

      if (mode === "NEW_VERSION") {
        // NEW VERSION
        const payload = {
          changelog: safeTrim(form.changelog) || null,
          publish: !!form.publish,
          sections: normalizeSectionsForSave(form.sections),
          schema_json: prettifyJsonString(form.schema_json || "{\n}"),
        }
        await Promise.resolve(onSave?.({ id: form.id, ...payload }, "NEW_VERSION"))
        return
      }
    } catch (e) {
      toast.error(errMsg(e, "Failed to save template"))
    } finally {
      setSaving(false)
    }
  }

  function onClose() {
    if (saving) return
    onOpenChange?.(false)
  }

  function handleOpenChange(next) {
    if (!next && saving) return
    onOpenChange?.(next)
  }

  const phaseMap = useMemo(() => groupSectionsByPhase(form.sections || []), [form.sections])
  const selectedSectionLabel =
    typeof selectedSectionIdx === "number" && selectedSectionIdx >= 0
      ? (form.sections?.[selectedSectionIdx] || null)
      : null

  const publishDisabled = isEdit && mode === "UPDATE"

  const filteredLib = useMemo(() => {
    const q = safeTrim(libQ).toLowerCase()
    const arr = Array.isArray(libItems) ? libItems : []
    const out = !q
      ? arr
      : arr.filter((x) => {
        const label = String(x.label || "").toLowerCase()
        const code = String(x.code || "").toLowerCase()
        const group = String(x.group || "").toLowerCase()
        return label.includes(q) || code.includes(q) || group.includes(q)
      })
    return out.slice(0, 48)
  }, [libItems, libQ])

  return (
    <Dialog open={!!open} onOpenChange={handleOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (saving) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (saving) e.preventDefault()
        }}
        className={cn(
          "!fixed !left-0 !top-0 !translate-x-0 !translate-y-0 !inset-0",
          "!w-screen !h-[100dvh] !max-w-none",
          "md:!inset-auto md:!left-1/2 md:!top-1/2 md:!-translate-x-1/2 md:!-translate-y-1/2",
          "md:!w-[98vw] md:!max-w-[1120px] md:!h-[92dvh]",
          "rounded-none md:rounded-3xl border border-slate-200 bg-white/85 p-0 backdrop-blur-xl shadow-xl",
          "overflow-hidden",
          "font-sans"
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className={cn("h-2 w-full shrink-0 bg-gradient-to-r", tone.bar)} />

          <DialogHeader className="shrink-0 border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-base">{isEdit ? "Edit Template" : "Create Template"}</DialogTitle>
                <div className="mt-1 text-xs text-slate-500">
                  Clinical phases · section library · safe versioning · backend preview
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-2xl"
                onClick={onClose}
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_440px]">
              {/* Left */}
              <div className="space-y-4">
                {/* Basics */}
                <Card className="rounded-3xl border-slate-200 bg-white">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold text-slate-700">Template Name *</div>
                        <Input
                          ref={nameRef}
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="e.g., OPD Consultation (Standard)"
                          className="h-10 rounded-2xl font-sans tracking-[-0.01em]"
                        />
                      </div>

                      <SmartMetaPicker
                        label="Record Type"
                        placeholder="Search or type to add… (e.g., OPD Consultation)"
                        items={recordTypes}
                        valueCode={form.record_type_code}
                        getCode={(x) => x.code}
                        getPrimaryLabel={(x) => x.label}
                        getSecondaryLabel={(x) => x.category}
                        onSelectCode={(code) => setForm((p) => ({ ...p, record_type_code: code }))}
                        onQuickCreate={quickCreateType}
                        disabled={isEdit}
                      />

                      <SmartMetaPicker
                        label="Department"
                        placeholder="Search or type to add… (e.g., Cardiology)"
                        items={departments}
                        valueCode={form.dept_code}
                        getCode={(x) => x.code}
                        getPrimaryLabel={(x) => x.name}
                        onSelectCode={(code) => setForm((p) => ({ ...p, dept_code: code }))}
                        onQuickCreate={quickCreateDept}
                        disabled={isEdit}
                      />

                      <div>
                        <div className="mb-1 text-xs font-semibold text-slate-700">Description</div>
                        <Input
                          value={form.description}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Optional short description…"
                          className="h-10 rounded-2xl font-sans tracking-[-0.01em]"
                        />
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold text-slate-700">
                          Changelog {isEdit ? (mode === "NEW_VERSION" ? "*" : "(optional)") : "(optional)"}
                        </div>
                        <Input
                          value={form.changelog}
                          onChange={(e) => setForm((p) => ({ ...p, changelog: e.target.value }))}
                          placeholder={isEdit ? "e.g., Updated discharge sections / new blocks" : "e.g., Initial version"}
                          className="h-10 rounded-2xl"
                        />
                        {isEdit && mode === "UPDATE" ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            Tip: Changelog is used when you save a <b>New Version</b>.
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-start gap-2">
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
                    </div>

                    <Separator className="my-4" />

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("rounded-xl", tone.chip)}>
                          <Building2 className="mr-1 h-3.5 w-3.5" />
                          {deptLabel(form.dept_code)}
                        </Badge>
                        <Badge variant="outline" className="rounded-xl">
                          <ClipboardList className="mr-1 h-3.5 w-3.5" />
                          {typeLabel(form.record_type_code)}
                        </Badge>
                        {selectedSectionLabel ? (
                          <Badge className="rounded-xl bg-slate-900 text-white">
                            <Tag className="mr-1 h-3.5 w-3.5" />
                            Selected: {selectedSectionLabel}
                          </Badge>
                        ) : null}
                      </div>

                      {isEdit && mode === "UPDATE" ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <div className="font-semibold">Update mode</div>
                          <div className="mt-1 text-amber-800">
                            Update changes only template metadata (name/flags). To change sections/schema/publish, use <b>New Version</b>.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                {/* Sections */}
                <Card className="rounded-3xl border-slate-200 bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Sections Builder</CardTitle>
                      <div className="flex items-center gap-2">
                        {undoSections ? (
                          <Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={undoLastSections}>
                            <Undo2 className="mr-2 h-4 w-4" /> Undo
                          </Button>
                        ) : null}
                        <Badge variant="outline" className="rounded-xl">
                          {(Array.isArray(form.sections) ? form.sections : []).length} section(s)
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Tip: click a section to “select”, then new sections will insert after it.
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Presets */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-700">Clinical Presets</div>
                        <div className="text-[11px] text-slate-500">Fast setup for doctors & nurses</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={() => applyPreset("SOAP")}>
                          <Wand2 className="mr-2 h-4 w-4" /> SOAP
                        </Button>
                        <Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={() => applyPreset("IPD_PROGRESS")}>
                          <Wand2 className="mr-2 h-4 w-4" /> IPD Progress
                        </Button>
                        <Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={() => applyPreset("DISCHARGE")}>
                          <Wand2 className="mr-2 h-4 w-4" /> Discharge
                        </Button>
                        <Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={() => applyPreset("NURSING")}>
                          <Wand2 className="mr-2 h-4 w-4" /> Nursing
                        </Button>
                      </div>
                    </div>

                    {/* Section Library */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-900 text-white">
                            <Library className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">Section Library</div>
                            <div className="text-[11px] text-slate-500">
                              Click to add. Uses dept/type library; fallback available.
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {libLoading ? "Loading…" : libErr ? "Fallback" : `${libItems?.length || 0} items`}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={libQ}
                            onChange={(e) => setLibQ(e.target.value)}
                            placeholder="Search library… (e.g., Vitals, Allergy, Discharge)"
                            className="h-10 rounded-2xl pl-10"
                          />
                        </div>
                        {libErr ? (
                          <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {libErr}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {filteredLib.length ? (
                            filteredLib.map((x) => {
                              const label = String(x.label || x.code || "")
                              const exists = (form.sections || []).some(
                                (s) => normalizeSection(s).toLowerCase() === normalizeSection(label).toLowerCase()
                              )
                              return (
                                <button
                                  key={`${x.code}:${label}`}
                                  type="button"
                                  disabled={exists}
                                  onClick={() => addSectionAt(label, selectedSectionIdx)}
                                  className={cn(
                                    "rounded-2xl border px-3 py-1.5 text-xs font-semibold transition",
                                    exists
                                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                                  )}
                                  title={x.code ? `${label} (${x.code})` : label}
                                >
                                  {label}
                                </button>
                              )
                            })
                          ) : (
                            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                              No library matches.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Backend phases preview */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Clinical Phases</div>
                        <div className="text-xs text-slate-500">{reviewLoading ? "Updating…" : "Live preview"}</div>
                      </div>

                      <div className="mt-2 space-y-2">
                        {(review.phase_summary || []).map((p) => (
                          <div key={p.phase} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold text-slate-800">{p.label}</div>
                              <Badge variant="outline" className="rounded-xl text-[11px]">{p.count}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(p.titles || []).map((s) => (
                                <span
                                  key={`${p.phase}:${s}`}
                                  className="rounded-2xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                            {p.hint ? <div className="mt-2 text-[11px] text-slate-500">{p.hint}</div> : null}
                          </div>
                        ))}
                      </div>

                      {(review.warnings || []).length ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          <div className="font-semibold">Warnings</div>
                          <ul className="mt-2 list-disc pl-5">
                            {review.warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {/* Add custom */}
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <Input
                        value={secInput}
                        onChange={(e) => setSecInput(e.target.value)}
                        placeholder={selectedSectionLabel ? `Add after “${selectedSectionLabel}” (e.g., Vitals)` : "Add section (e.g., Vitals)"}
                        className="h-10 rounded-2xl"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addSectionFromInput()
                          }
                        }}
                      />
                      <Button type="button" className={cn("h-10 rounded-2xl", tone.btn)} onClick={addSectionFromInput}>
                        <Plus className="mr-2 h-4 w-4" /> Add
                      </Button>
                    </div>

                    {/* List */}
                    {(Array.isArray(form.sections) ? form.sections : []).length ? (
                      <div className="space-y-2">
                        {(Array.isArray(form.sections) ? form.sections : []).map((s, idx) => {
                          const selected = idx === selectedSectionIdx
                          const phase = phaseOfSection(s)
                          const phaseLabel = PHASES.find((p) => p.key === phase)?.label || "Plan"
                          return (
                            <div
                              key={`sec:${String(s).toLowerCase()}:${idx}`}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-2xl px-3 py-2 ring-1 transition",
                                selected ? "bg-slate-900 text-white ring-slate-900" : "bg-slate-50 ring-slate-200 hover:bg-slate-100"
                              )}
                              onClick={() => setSelectedSectionIdx(idx)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="min-w-0">
                                {editingIdx === idx ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editingVal}
                                      onChange={(e) => setEditingVal(e.target.value)}
                                      className={cn("h-9 rounded-2xl", selected ? "bg-white text-slate-900" : "bg-white")}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEditSection()
                                        if (e.key === "Escape") cancelEditSection()
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      className={cn(
                                        "h-9 rounded-2xl",
                                        selected ? "bg-white text-slate-900 hover:bg-slate-50" : "bg-slate-900 text-white"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        saveEditSection()
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className={cn("h-9 rounded-2xl", selected ? "border-white/25 bg-transparent text-white hover:bg-white/10" : "")}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        cancelEditSection()
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <div className={cn("truncate text-sm font-semibold", selected ? "text-white" : "text-slate-900")}>
                                      {s}
                                    </div>
                                    <div className={cn("mt-0.5 text-[11px]", selected ? "text-white/70" : "text-slate-500")}>
                                      Phase: {phaseLabel}
                                    </div>
                                  </>
                                )}
                              </div>

                              {editingIdx !== idx ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <IconBtn
                                    title="Rename"
                                    onClick={() => startEditSection(idx)}
                                    className={selected ? "bg-white/10 text-white ring-white/25 hover:bg-white/15" : ""}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </IconBtn>
                                  <IconBtn
                                    title="Move Up"
                                    onClick={() => moveSection(idx, -1)}
                                    disabled={idx === 0}
                                    className={selected ? "bg-white/10 text-white ring-white/25 hover:bg-white/15" : ""}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </IconBtn>
                                  <IconBtn
                                    title="Move Down"
                                    onClick={() => moveSection(idx, +1)}
                                    disabled={idx === (form.sections || []).length - 1}
                                    className={selected ? "bg-white/10 text-white ring-white/25 hover:bg-white/15" : ""}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </IconBtn>
                                  <IconBtn
                                    title="Remove"
                                    onClick={() => removeSection(idx)}
                                    className={selected ? "bg-white/10 text-white ring-white/25 hover:bg-white/15" : ""}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </IconBtn>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                        <div className="text-sm font-semibold text-slate-800">No sections</div>
                        <div className="mt-1 text-xs text-slate-500">Add at least one section to save.</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Schema */}
                <Card className="rounded-3xl border-slate-200 bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">Template Schema (UI)</CardTitle>
                        <div className="text-xs text-slate-500">Must be valid JSON</div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-2xl"
                        onClick={() => {
                          setForm((p) => ({ ...p, schema_json: prettifyJsonString(p.schema_json || "{\n}") }))
                          toast.success("Formatted JSON")
                        }}
                      >
                        <Braces className="mr-2 h-4 w-4" />
                        Format
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <textarea
                      value={form.schema_json}
                      onChange={(e) => setForm((p) => ({ ...p, schema_json: e.target.value }))}
                      rows={11}
                      className={cn(
                        "w-full rounded-2xl border bg-white p-3 font-mono text-xs text-slate-900 outline-none",
                        schemaErr ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-slate-300"
                      )}
                      placeholder='{\n  "schema_version": 1,\n  "sections": []\n}'
                    />

                    {schemaErr ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                        <div className="font-semibold">Invalid JSON</div>
                        <div className="mt-1 break-words">{schemaErr}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">JSON looks valid.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right */}
              <div className="space-y-4">
                <Card className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
                  <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Review</CardTitle>
                    <div className="text-xs text-slate-500">Clinical flow + snapshot before saving</div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("rounded-xl", tone.chip)}>
                        <Building2 className="mr-1 h-3.5 w-3.5" /> {deptLabel(form.dept_code)}
                      </Badge>
                      <Badge variant="outline" className="rounded-xl">
                        <ClipboardList className="mr-1 h-3.5 w-3.5" /> {typeLabel(form.record_type_code)}
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

                      <Badge
                        className={cn(
                          "rounded-xl",
                          review.publish_ready && !schemaErr ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                        )}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        {reviewLoading ? "Checking…" : (review.publish_ready && !schemaErr ? "Publish ready" : "Needs attention")}
                      </Badge>
                    </div>

                    <div className="text-sm font-semibold text-slate-900">{safeTrim(form.name) || "Untitled"}</div>
                    <div className="text-xs text-slate-500">{safeTrim(form.description) || "No description"}</div>

                    <Separator />

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">Publish now</div>
                        <div className="text-xs text-slate-500">
                          {publishDisabled ? "Switch to New Version to publish" : "Available in Create Record"}
                        </div>
                      </div>
                      <Switch
                        disabled={publishDisabled}
                        checked={!!form.publish}
                        onCheckedChange={(v) => {
                          if (publishDisabled) {
                            toast.info("Switch to “New Version” mode to publish.")
                            return
                          }
                          setForm((p) => ({ ...p, publish: !!v }))
                        }}
                      />
                    </div>

                    {/* Clinical Phases (local grouping for UX) */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">Clinical Phases</div>
                        <div className="text-xs text-slate-500">Quick navigation</div>
                      </div>

                      <div className="mt-2 space-y-2">
                        {PHASES.map((p) => {
                          const list = phaseMap.get(p.key) || []
                          if (!list.length) return null
                          return (
                            <div key={p.key} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold text-slate-800">{p.label}</div>
                                <Badge variant="outline" className="rounded-xl text-[11px]">
                                  {list.length}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {list.map((s) => {
                                  const isSel = s === selectedSectionLabel
                                  return (
                                    <button
                                      key={`${p.key}:${s}`}
                                      type="button"
                                      className={cn(
                                        "rounded-2xl border px-2.5 py-1 text-[11px] font-semibold transition",
                                        isSel
                                          ? "border-slate-900 bg-slate-900 text-white"
                                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      )}
                                      onClick={() => {
                                        const idx = (form.sections || []).findIndex((x) => x === s)
                                        if (idx >= 0) setSelectedSectionIdx(idx)
                                      }}
                                    >
                                      {s}
                                    </button>
                                  )
                                })}
                              </div>
                              <div className="mt-2 text-[11px] text-slate-500">{p.hint}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {isEdit ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className="text-xs font-semibold text-slate-700">Versioning Mode</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={mode === "UPDATE" ? "default" : "outline"}
                            className={cn("h-9 rounded-2xl", mode === "UPDATE" ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
                            onClick={() => setMode("UPDATE")}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Update
                          </Button>

                          <Button
                            type="button"
                            variant={mode === "NEW_VERSION" ? "default" : "outline"}
                            className={cn("h-9 rounded-2xl", mode === "NEW_VERSION" ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
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

          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-slate-500">
                {isEdit ? <>Editing template #{form.id}</> : <>Creating a new template</>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>

                <Button
                  type="button"
                  className={cn("rounded-2xl", tone.btn)}
                  onClick={submit}
                  disabled={saving || !!schemaErr}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {saving
                    ? "Saving..."
                    : isEdit
                      ? mode === "NEW_VERSION"
                        ? "Save New Version"
                        : "Save Changes"
                      : "Create Template"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
