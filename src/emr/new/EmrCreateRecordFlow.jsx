// FILE: frontend/src/emr/EmrCreateRecordFlow.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock3,
  Layers,
  Building2,
  Stethoscope,
  ClipboardList,
  FileText,
  ShieldCheck,
  Pill,
  TestTube2,
  ScanLine,
  Sparkles,
  CheckCircle2,
  PenLine,
  AlertTriangle,
  Search,
  Paperclip,
  Printer,
  RefreshCcw,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import API from "@/api/client"

/**
 * ✅ FIXES INCLUDED (Production-ready):
 * 1) ✅ ReferenceError fix: `patientEff` was used before it was declared (TDZ). Reordered logic.
 * 2) ✅ Print preview was inside PatientMiniCard but referenced parent variables (title/dept/template/etc.) -> moved to parent via props.
 * 3) ✅ Validation fix: encounter_type/encounter_id are OPTIONAL when visit is Unlinked; previous validateDraftPayload wrongly required them.
 * 4) ✅ Visits fetch uses resolved patient id reliably.
 * 5) ✅ Safer mappings + stable keys + hidden fields control preserved.
 */
function SignaturePad({
  value,
  onChange,
  disabled = false,
  height = 160,
  className,
  canvasClassName,
  clearLabel = "Clear",
  penWidth = 2,
}) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })
  const [hasInk, setHasInk] = useState(false)

  const dataUrl = useMemo(() => {
    if (!value) return ""
    if (typeof value === "string") return value
    return value?.data_url || value?.dataUrl || ""
  }, [value])

  const resizeAndRedraw = useCallback(
    (imgUrl) => {
      const canvas = canvasRef.current
      if (!canvas || typeof window === "undefined") return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const cssW = Math.max(1, rect.width || 560)
      const cssH = Math.max(1, rect.height || height)

      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)

      // draw in CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      if (imgUrl && String(imgUrl).startsWith("data:image")) {
        const img = new Image()
        img.onload = () => {
          ctx.clearRect(0, 0, cssW, cssH)
          ctx.drawImage(img, 0, 0, cssW, cssH)
          setHasInk(true)
        }
        img.src = imgUrl
      } else {
        setHasInk(false)
      }
    },
    [height]
  )

  // initial draw + when value changes
  useEffect(() => {
    resizeAndRedraw(dataUrl)
  }, [dataUrl, resizeAndRedraw])

  // keep crisp on resize
  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => resizeAndRedraw(dataUrl)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [dataUrl, resizeAndRedraw])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.clientX
    const clientY = e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const start = (e) => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    drawingRef.current = true
    try {
      canvas.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }

    const p = getPos(e)
    lastRef.current = p

    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineWidth = penWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
  }

  const move = (e) => {
    if (disabled) return
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const p = getPos(e)
    const last = lastRef.current

    // smooth-ish line: mid-point technique
    const midX = (last.x + p.x) / 2
    const midY = (last.y + p.y) / 2

    ctx.quadraticCurveTo(last.x, last.y, midX, midY)
    ctx.stroke()

    lastRef.current = p
    setHasInk(true)
  }

  const end = () => {
    if (disabled) return
    if (!drawingRef.current) return
    drawingRef.current = false

    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    setHasInk(true)
    onChange?.({ data_url: url })
  }

  const clear = () => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width || 560, rect.height || height)
    setHasInk(false)
    onChange?.({ data_url: "" })
  }

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-2", className)}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: `${height}px` }}
          className={cn("touch-none", disabled ? "opacity-60" : "", canvasClassName)}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-slate-500">{hasInk ? "Signed" : "Draw signature here"}</div>
        <Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={clear} disabled={disabled}>
          {clearLabel}
        </Button>
      </div>
    </div>
  )
}
// -------------------- helpers (API unwrap + errors) --------------------
function unwrapOk(resp) {
  const d = resp?.data
  if (d && typeof d === "object" && "status" in d) {
    if (d.status) return d.data
    const msg = d?.error?.msg || d?.msg || "Request failed"
    throw new Error(msg)
  }
  return d
}

function errMsg(e, fallback = "Something went wrong") {
  const r = e?.response?.data
  if (typeof r === "string") return r
  if (r?.detail) return typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail)
  if (r?.error?.msg) return r.error.msg
  if (r?.msg) return r.msg
  return e?.message || fallback
}

function asMaybeInt(v) {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const s = String(v).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
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


export function normalizePatient(p) {
  if (!p) return null
  const id = p.id ?? p.patient_id ?? p.patientId
  const uhid = p.uhid ?? p.patient_code ?? p.mrn ?? p.reg_no ?? p.regNo ?? p.code
  const name =
    p.name ??
    p.full_name ??
    p.fullName ??
    [p.first_name ?? p.firstName, p.last_name ?? p.lastName].filter(Boolean).join(" ") ??
    "—"
  const phone = p.phone ?? p.mobile ?? p.mobile_no ?? p.mobileNo ?? p.contact ?? ""
  const gender = p.gender ?? p.sex ?? ""
  const age = p.age ?? p.age_years ?? p.ageYears ?? null
  const blood = p.blood ?? p.blood_group ?? p.bloodGroup ?? ""
  const lastVisit = p.lastVisit ?? p.last_visit ?? p.last_visit_at ?? p.updated_at ?? p.updatedAt ?? null
  const flags = Array.isArray(p.flags) ? p.flags : Array.isArray(p.alerts) ? p.alerts : []
  return { ...p, id, uhid, name, phone, gender, age, blood, lastVisit, flags }
}

// -------------------- UI config --------------------
const STEPS = [
  { key: "visit", title: "Choose Visit", desc: "Pick OP/IP/ER/OT context (optional)" },
  { key: "type", title: "Record Type", desc: "What are you creating?" },
  { key: "template", title: "Template", desc: "Select best-fit case sheet" },
  { key: "review", title: "Review & Save", desc: "Draft / Sign / Attachments" },
]

function deptTone(deptCodeOrName) {
  const d = String(deptCodeOrName || "").toUpperCase()
  const map = {
    OBGYN: {
      bar: "from-pink-500/75 via-rose-500/55 to-orange-400/45",
      chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(244,63,94,0.55)]",
      btn: "bg-rose-600 hover:bg-rose-700",
    },
    CARDIOLOGY: {
      bar: "from-red-500/75 via-rose-500/55 to-amber-400/40",
      chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(239,68,68,0.55)]",
      btn: "bg-red-600 hover:bg-red-700",
    },
    ICU: {
      bar: "from-indigo-500/75 via-blue-500/55 to-cyan-400/40",
      chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(99,102,241,0.55)]",
      btn: "bg-indigo-600 hover:bg-indigo-700",
    },
    ORTHOPEDICS: {
      bar: "from-emerald-500/70 via-teal-500/55 to-lime-400/35",
      chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(16,185,129,0.55)]",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    PATHOLOGY_LAB: {
      bar: "from-amber-500/70 via-yellow-500/55 to-orange-400/35",
      chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(245,158,11,0.55)]",
      btn: "bg-amber-600 hover:bg-amber-700",
    },
    GENERAL_MEDICINE: {
      bar: "from-slate-500/65 via-zinc-500/45 to-sky-400/30",
      chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.40)]",
      btn: "bg-slate-900 hover:bg-slate-800",
    },
    COMMON: {
      bar: "from-slate-500/65 via-slate-400/35 to-sky-400/25",
      chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
      glow: "shadow-[0_24px_80px_-40px_rgba(100,116,139,0.30)]",
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

function recordIcon(code) {
  const c = String(code || "").toUpperCase()
  const map = {
    OPD_NOTE: Stethoscope,
    PROGRESS_NOTE: ClipboardList,
    PRESCRIPTION: Pill,
    LAB_RESULT: TestTube2,
    RADIOLOGY_REPORT: ScanLine,
    CONSENT: ShieldCheck,
    DISCHARGE_SUMMARY: FileText,
    EXTERNAL_DOCUMENT: Paperclip,
  }
  return map[c] || FileText
}

// -------------------- schema helpers (OUTSIDE: avoids remount/reset) --------------------
function sectionLabel(s) {
  if (!s) return ""
  if (typeof s === "string") return s
  return String(s.title || s.name || s.label || s.key || s.code || "").trim()
}

function normalizeSectionsArray(sections) {
  const arr = Array.isArray(sections) ? sections : []
  return arr.map(sectionLabel).filter(Boolean)
}

function slugKey(s) {
  const str = String(s || "").trim().toLowerCase()
  if (!str) return "section"
  return str
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
}

function parseMaybeJson(v) {
  if (!v) return null
  if (typeof v === "object") return v
  if (typeof v !== "string") return null
  const s = v.trim()
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function ensureTemplateSchemaShape(schema) {
  if (!schema || typeof schema !== "object") return { sections: [] }
  const sections = Array.isArray(schema.sections) ? schema.sections : []
  return { ...schema, sections }
}


function sectionKeyOf(sec, idx) {
  return safeStr(sec?.code || sec?.key || sec?.name || sec?.id, `SECTION_${idx + 1}`)
}

function itemKeyOf(item, fallback = "") {
  return safeStr(item?.key || item?.code || item?.name || item?.id, fallback)
}

function normalizeTemplateSchema(template) {
  const schemaRaw =
    parseMaybeJson(template?.schema_json) ||
    parseMaybeJson(template?.schema) ||
    parseMaybeJson(template?.content?.schema_json) ||
    template?.schema ||
    template?.content?.schema ||
    null

  if (schemaRaw && typeof schemaRaw === "object") {
    const s = ensureTemplateSchemaShape(schemaRaw)
    s.sections = (s.sections || []).map((sec, idx) => {
      const code = sectionKeyOf(sec, idx)
      return {
        ...sec,
        code,
        label: sec?.label || sec?.title || sec?.name || code,
        layout: sec?.layout || "STACK",
        items: Array.isArray(sec?.items) ? sec.items : [],
      }
    })
    return s
  }

  const raw = template?.sections || template?.section_defs || []
  if (!Array.isArray(raw)) return ensureTemplateSchemaShape({ schema_version: 1, sections: [] })

  if (raw.length && raw.every((x) => typeof x === "string")) {
    const sections = raw.map((title, idx) => {
      const code = slugKey(title).toUpperCase() || `SECTION_${idx + 1}`
      return {
        code,
        label: String(title),
        layout: "STACK",
        items: [
          {
            key: `${slugKey(title) || "notes"}_notes`,
            type: "textarea",
            label: "Notes",
            placeholder: `Enter ${title}…`,
            required: false,
            ui: { width: "FULL" },
          },
        ],
      }
    })
    return ensureTemplateSchemaShape({ schema_version: 1, sections })
  }

  const sections = raw
    .map((s, idx) => {
      if (!s || typeof s !== "object") return null
      const label = s?.label || s?.title || s?.name || `Section ${idx + 1}`
      const code = String(s?.code || s?.key || slugKey(label).toUpperCase() || `SECTION_${idx + 1}`)

      const itemsRaw = Array.isArray(s?.items) ? s.items : null
      const fieldsRaw = Array.isArray(s?.fields) ? s.fields : []
      const items =
        itemsRaw && itemsRaw.length
          ? itemsRaw
          : fieldsRaw.length > 0
            ? fieldsRaw.map((f, j) => {
              const k = f?.key || f?.code || slugKey(f?.label || `field_${j + 1}`)
              const type = String(f?.type || "textarea").toLowerCase()
              return {
                key: String(k || `field_${j + 1}`),
                type,
                label: f?.label || f?.name || `Field ${j + 1}`,
                required: !!f?.required,
                placeholder: f?.placeholder || "",
                options: Array.isArray(f?.options) ? f.options : [],
                ui: { width: "HALF" },
                meta: {
                  min: f?.min,
                  max: f?.max,
                  rows: f?.rows,
                  help: f?.help || "",
                },
                default_value: f?.default,
              }
            })
            : [
              {
                key: `${slugKey(label) || "notes"}_notes`,
                type: "textarea",
                label: "Notes",
                placeholder: `Enter ${label}…`,
                required: false,
                ui: { width: "FULL" },
              },
            ]
      return { code, label: String(label), layout: s?.layout || "STACK", items }
    })
    .filter(Boolean)

  return ensureTemplateSchemaShape({ schema_version: 1, sections })
}

function normalizeTemplateBlueprint(template) {
  return normalizeTemplateSchema(template)
}

function normalizeSectionItems(items) {
  const arr = Array.isArray(items) ? items : []
  // only items with kind=field or no kind
  return arr.filter(Boolean)
}

function flattenSectionData(data) {
  const out = {}
  const obj = data && typeof data === "object" ? data : {}
  for (const sk of Object.keys(obj)) {
    const sec = obj[sk]
    if (!sec || typeof sec !== "object") continue
    // sectionless (supports groupKey.fieldKey rules)
    flattenAny(sec, out, "")
    // namespaced (supports SECTIONKEY.groupKey.fieldKey)
    flattenAny(sec, out, String(sk))
  }
  return out
}

function evalVisibleWhen(expr, scopeData, sectionRoot) {
  // supports {op, field_key, value} and a couple variants
  if (!expr || typeof expr !== "object") return true
  const op = safeStr(expr.op, "eq").toLowerCase()
  const fk = safeStr(expr.field_key || expr.fieldKey, "")
  const target = expr.value

  if (!fk) return true
  const current = resolveScopedValue(fk, scopeData, sectionRoot)

  if (op === "eq") return current === target
  if (op === "ne") return current !== target
  if (op === "truthy") return !!current
  if (op === "falsy") return !current
  if (op === "in") return asArray(target).includes(current)
  if (op === "not_in") return !asArray(target).includes(current)
  if (op === "exists") return current !== undefined && current !== null && current !== ""
  return true
}

function isVisible(item, showHidden, scopeData, sectionRoot) {
  const uiHidden = !!item?.ui?.hidden
  if (uiHidden && !showHidden) return false
  const visibleWhen = item?.rules?.visible_when || item?.rules?.visibleWhen
  if (visibleWhen) return evalVisibleWhen(visibleWhen, scopeData, sectionRoot)
  return true
}

function isEmptyValueByType(type, v) {
  const t = String(type || "text").toLowerCase()
  if (v === null || v === undefined) return true
  if (t === "multiselect") return !Array.isArray(v) || v.length === 0
  if (t === "table") return !Array.isArray(v) || v.length === 0
  if (t === "boolean") return false
  if (typeof v === "string") return !v.trim()
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === "object") {
    if (v?.data_url) return !String(v.data_url || "").trim()
    if (v?.name) return !String(v.name || "").trim()
    return Object.keys(v).length === 0
  }
  return false
}

function walkSectionItems(items, fn) {
  const arr = normalizeSectionItems(items)
  const stack = [...arr]
  while (stack.length) {
    const it = stack.shift()
    if (!it) continue
    const t = String(it.type || it.kind || "text").toLowerCase()
    if (t === "group") {
      const kids = Array.isArray(it.items) ? it.items : []
      stack.unshift(...kids)
    } else {
      fn(it)
    }
  }
}

function walkSectionItemsWithPath(items, fn, prefix = []) {
  const arr = normalizeSectionItems(items)
  arr.forEach((it, idx) => {
    if (!it) return
    const t = String(it.type || it.kind || "text").toLowerCase()
    if (t === "group") {
      const groupKey = itemKeyOf(it, `group_${idx}`)
      const kids = normalizeSectionItems(it?.items || it?.group?.items || [])
      walkSectionItemsWithPath(kids, fn, [...(prefix || []), groupKey])
    } else {
      fn(it, prefix || [])
    }
  })
}


function initDataFromSchema(schema, prev) {
  const next = { ...(prev || {}) }
  const s = ensureTemplateSchemaShape(schema)

  for (let i = 0; i < (s.sections || []).length; i++) {
    const sec = s.sections[i]
    const sk = sectionKeyOf(sec, i)
    if (!next[sk] || typeof next[sk] !== "object") next[sk] = {}

    walkSectionItemsWithPath(sec?.items || [], (it, pathPrefix) => {
      const fk = itemKeyOf(it, `${sk}_field`)
      if (!fk) return

      const fullPath = [...(pathPrefix || []), fk].filter(Boolean)
      const dot = pathToString(fullPath)

      // already set nested?
      const nestedExisting = getIn(next[sk], fullPath)
      if (nestedExisting !== undefined) return

      // already set as dot-string?
      if (next[sk] && typeof next[sk] === "object" && dot && next[sk][dot] !== undefined) return

      // legacy flat value exists (avoid overwriting)
      if ((pathPrefix || []).length && next[sk][fk] !== undefined) return

      const t = String(it?.type || "text").toLowerCase()
      const def = it?.default_value ?? it?.default ?? it?.ui?.default ?? it?.meta?.default

      let v
      if (def !== undefined) v = def
      else if (t === "boolean") v = false
      else if (t === "multiselect") v = []
      else if (t === "table") v = []
      else v = ""

      next[sk] = setIn(next[sk], fullPath, v)
    })
  }
  return next
}

function initDataFromBlueprint(schema, prev) {
  return initDataFromSchema(schema, prev)
}

function findMissingRequired(schema, data) {
  const miss = []
  const s = ensureTemplateSchemaShape(schema)
  const record = data && typeof data === "object" ? data : {}

  for (let i = 0; i < (s.sections || []).length; i++) {
    const sec = s.sections[i]
    const sk = sectionKeyOf(sec, i)
    const secTitle = sec?.label || sec?.title || sec?.name || sk
    const secData = (record && sk && record[sk] && typeof record[sk] === "object") ? record[sk] : {}

    // flat scope for rules within this section (includes groupKey.fieldKey)
    const secFlat = flattenAny(secData, {}, "")

    walkSectionItemsWithPath(sec?.items || [], (it, pathPrefix) => {
      const fk = itemKeyOf(it, "")
      if (!fk) return
      if (!it?.required) return

      const groupRoot = (pathPrefix || []).length ? (getIn(secData, pathPrefix) || {}) : {}
      const scopeData = (pathPrefix || []).length ? { ...secFlat, ...(groupRoot || {}) } : secFlat

      // ✅ FIX: correct order isVisible(item, showHiddenBool, scopeData, sectionRoot)
      if (!isVisible(it, false, scopeData, secData)) return

      const val = getFieldValue(secData, pathPrefix || [], fk)
      if (isEmptyValueByType(it?.type, val)) {
        miss.push({
          sectionKey: sk,
          sectionTitle: secTitle,
          fieldKey: fk,
          fieldLabel: it?.label || it?.title || fk,
        })
      }
    })
  }
  return miss
}

function calcFilledCount(schema, data) {
  let total = 0
  let filled = 0
  const s = ensureTemplateSchemaShape(schema)
  const record = data && typeof data === "object" ? data : {}

  for (let i = 0; i < (s.sections || []).length; i++) {
    const sec = s.sections[i]
    const sk = sectionKeyOf(sec, i)
    const secData = (record && sk && record[sk] && typeof record[sk] === "object") ? record[sk] : {}
    const secFlat = flattenAny(secData, {}, "")

    walkSectionItemsWithPath(sec?.items || [], (it, pathPrefix) => {
      const fk = itemKeyOf(it, "")
      if (!fk) return

      const groupRoot = (pathPrefix || []).length ? (getIn(secData, pathPrefix) || {}) : {}
      const scopeData = (pathPrefix || []).length ? { ...secFlat, ...(groupRoot || {}) } : secFlat

      // only count visible fields (hidden + rules respected)
      if (!isVisible(it, false, scopeData, secData)) return

      total += 1
      const val = getFieldValue(secData, pathPrefix || [], fk)
      if (!isEmptyValueByType(it?.type, val)) filled += 1
    })
  }

  return { filled, total }
}

// -------------------- API calls --------------------
async function apiEmrMeta() {
  const resp = await API.get("/emr/meta")
  return unwrapOk(resp)
}

async function apiTemplatesList({ dept_code, record_type_code, q, limit = 20, status = "PUBLISHED" }) {
  if (!dept_code || !record_type_code) return { items: [], total: 0 }

  const resp = await API.get("/emr/templates", {
    params: {
      dept_code,
      record_type_code,
      status,
      q: q || undefined,
      limit,
    },
  })

  const data = unwrapOk(resp)
  if (Array.isArray(data)) return { items: data, total: data.length }

  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data?.items) ? data.data.items : []
  const total =
    Number.isFinite(Number(data?.total))
      ? Number(data.total)
      : Number.isFinite(Number(data?.count))
        ? Number(data.count)
        : items.length

  return { items, total }
}

async function apiTemplateGet(templateId) {
  const id = Number(templateId || 0)
  if (!id) return null
  const resp = await API.get(`/emr/templates/${id}`)
  return unwrapOk(resp)
}

async function apiCreateDraft(payload) {
  const resp = await API.post("/emr/records/draft", payload)
  return unwrapOk(resp)
}

async function apiSignRecord(recordId, sign_note) {
  const resp = await API.post(`/emr/records/${Number(recordId)}/sign`, { sign_note: sign_note || "" })
  return unwrapOk(resp)
}

async function apiRecordGet(recordId) {
  const resp = await API.get(`/emr/records/${Number(recordId)}`)
  return unwrapOk(resp)
}

async function apiUpdateDraft(recordId, payload) {
  const resp = await API.put(`/emr/records/${Number(recordId)}`, payload)
  return unwrapOk(resp)
}

export function pickRecordId(res) {
  return res?.data?.data?.record_id ?? res?.data?.data?.id ?? res?.data?.record_id ?? res?.data?.id ?? res?.data?.record?.id ?? null
}

async function apiEncounters(patientId, limit = 200) {
  const resp = await API.get(`/emr/patients/${patientId}/encounters`, { params: { limit } })
  return unwrapOk(resp)
}

async function apiPatientSummary(patientId) {
  const pid = Number(patientId || 0)
  if (!pid) return null

  const urls = [`/patients/${pid}`]

  for (const url of urls) {
    try {
      const resp = await API.get(url)
      const data = unwrapOk(resp)
      if (data) return data
    } catch (e) {
      const st = e?.response?.status
      if (st === 404 || st === 405) continue
    }
  }
  return null
}

// --- mappers ---
function mapUnifiedVisit(v) {
  if (!v) return null
  const encounter_type = v.encounter_type || v.encType || v.type || v.encounterType || ""
  const encounter_id = v.encounter_id || v.encounterId || v.encId || v.id || ""
  const encounter_code = v.encounter_code || v.encounterCode

  const dept_code = v.dept_code || v.deptCode || v.department_code || v.departmentCode || v.dept || ""
  const dept_name = v.dept_name || v.deptName || v.department_name || v.departmentName || v.department || dept_code || "—"
  const doctor = v.doctor_name || v.doctorName || v.consultant || v.doctor || "—"
  const when = v.when || v.start_at || v.encounter_at || v.created_at || v.date || new Date().toISOString()
  const status = v.status || v.state || "—"

  return {
    id: String(v.id || `${encounter_type}-${encounter_id}`),
    encounter_code,
    encounter_type: String(encounter_type || ""),
    encounter_id,
    dept_code: String(dept_code || ""),
    dept_name: String(dept_name || ""),
    doctor: String(doctor || "—"),
    when,
    status,
  }
}

async function fetchVisitsAuto(patientId) {
  const pid = Number(patientId || 0)
  if (!pid) return []

  const data = await apiEncounters(pid, 200)
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : []
  const mapped = items.map(mapUnifiedVisit).filter(Boolean)
  mapped.sort((a, b) => new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime())

  const seen = new Set()
  const uniq = []
  for (const v of mapped) {
    const k = `${String(v.encounter_type || "")}::${String(v.encounter_id ?? "")}`
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(v)
  }
  return uniq
}

// -------------------- Fullscreen dialog wrapper --------------------
export function EmrCreateRecordDialog({
  open,
  onOpenChange,
  patient,
  defaultDeptCode,
  onSaved,
  mode = "create",
  recordId = null,
  onUpdated,
}) {
  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0",
          "!w-[100dvw] !h-[100dvh] !max-w-none !max-h-none",
          "!flex !flex-col !gap-0 !p-0",
          "rounded-none border-0 bg-white/70 backdrop-blur-xl",
          "overflow-hidden"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>New EMR Record</DialogTitle>
          <DialogDescription>Create or edit an EMR record</DialogDescription>
        </DialogHeader>

        <div className="flex h-full min-h-0 flex-col">
          <div className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/75 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-900">New EMR Record</div>
                <div className="text-xs text-slate-500">Choose visit → type → template → save draft / sign</div>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => onOpenChange?.(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain", "pb-[calc(96px+env(safe-area-inset-bottom))]")}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <EmrCreateRecordFlow
              patient={patient}
              defaultDeptCode={defaultDeptCode}
              onClose={() => onOpenChange?.(false)}
              onSaved={onSaved}
              onUpdated={onUpdated}
              mode={mode}
              recordId={recordId}
              fullscreen
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// -------------------- Dynamic section editor (OUTSIDE: no state reset) --------------------
function safeStr(v, fallback = "") {
  if (v === null || v === undefined) return fallback
  const s = String(v)
  return s.trim().length ? s : fallback
}

const PREVIEW_NONE = "__none__"

function layoutCols(layout) {
  const L = String(layout || "STACK").toUpperCase()
  if (L === "GRID_3") return 3
  if (L === "GRID_4") return 4
  if (L === "GRID_2") return 2
  return 1 // STACK/default
}

function gridColsClass(cols) {
  // mobile-first: single column; expand on md+
  if (cols <= 1) return "grid-cols-1"
  if (cols === 2) return "grid-cols-1 md:grid-cols-2"
  if (cols === 3) return "grid-cols-1 md:grid-cols-3"
  return "grid-cols-1 md:grid-cols-4"
}


function colSpanClass(width, cols) {
  const w = String(width || "HALF").toUpperCase()
  const max = Math.max(1, cols)

  // for STACK, always full
  if (max === 1) return "col-span-1"

  if (w === "FULL") return `md:col-span-${max}`
  if (w === "HALF") return `md:col-span-${Math.max(1, Math.ceil(max / 2))}`
  if (w === "THIRD") return `md:col-span-${Math.max(1, Math.ceil(max / 3))}`
  if (w === "QUARTER") return `md:col-span-${Math.max(1, Math.ceil(max / 4))}`

  // numeric support
  const n = Number(width)
  if (Number.isFinite(n) && n > 0) return `md:col-span-${Math.min(max, Math.floor(n))}`

  return `md:col-span-${Math.max(1, Math.ceil(max / 2))}`
}

function itemReactKey(item, idx, prefix = "") {
  const k = itemKeyOf(item, "")
  return `${prefix}${k || "item"}:${idx}`
}

function coerceBool(v) {
  if (v === true || v === false) return v
  if (v === 1 || v === "1" || v === "true") return true
  if (v === 0 || v === "0" || v === "false") return false
  return !!v
}

function asArray(v) {
  return Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]
}

function normalizeOptions(opts) {
  const arr = Array.isArray(opts) ? opts : []
  return arr
    .filter(Boolean)
    .map((o) => {
      if (typeof o === "string") return { value: o, label: o }
      return { value: safeStr(o?.value, ""), label: safeStr(o?.label ?? o?.value, "") }
    })
    .filter((o) => o.value !== "")
}

function resolveScopedValue(fieldKey, scopeData, sectionRoot) {
  // Prefer within same scope (e.g., inside group), fallback to section root
  if (scopeData && typeof scopeData === "object" && Object.prototype.hasOwnProperty.call(scopeData, fieldKey)) {
    return scopeData[fieldKey]
  }
  if (sectionRoot && typeof sectionRoot === "object" && Object.prototype.hasOwnProperty.call(sectionRoot, fieldKey)) {
    return sectionRoot[fieldKey]
  }
  return undefined
}





// function SignaturePad({ value, onChange }) {
//   const ref = useRef(null)
//   const drawing = useRef(false)

//   useEffect(() => {
//     const canvas = ref.current
//     if (!canvas) return
//     const ctx = canvas.getContext("2d")
//     if (!ctx) return
//     ctx.clearRect(0, 0, canvas.width, canvas.height)
//     const dataUrl = value?.data_url || value
//     if (typeof dataUrl === "string" && dataUrl.startsWith("data:image")) {
//       const img = new Image()
//       img.onload = () => {
//         ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
//       }
//       img.src = dataUrl
//     }
//   }, [value])

//   function pos(e) {
//     const canvas = ref.current
//     const rect = canvas.getBoundingClientRect()
//     const clientX = e.touches ? e.touches[0].clientX : e.clientX
//     const clientY = e.touches ? e.touches[0].clientY : e.clientY
//     return { x: clientX - rect.left, y: clientY - rect.top }
//   }

//   function start(e) {
//     const canvas = ref.current
//     const ctx = canvas.getContext("2d")
//     if (!ctx) return
//     drawing.current = true
//     const p = pos(e)
//     ctx.beginPath()
//     ctx.moveTo(p.x, p.y)
//   }

//   function move(e) {
//     if (!drawing.current) return
//     const canvas = ref.current
//     const ctx = canvas.getContext("2d")
//     if (!ctx) return
//     const p = pos(e)
//     ctx.lineTo(p.x, p.y)
//     ctx.lineWidth = 2
//     ctx.lineCap = "round"
//     ctx.strokeStyle = "#0f172a"
//     ctx.stroke()
//   }

//   function end() {
//     if (!drawing.current) return
//     drawing.current = false
//     const canvas = ref.current
//     const data_url = canvas.toDataURL("image/png")
//     onChange?.({ data_url })
//   }

//   function clear() {
//     const canvas = ref.current
//     const ctx = canvas.getContext("2d")
//     ctx.clearRect(0, 0, canvas.width, canvas.height)
//     onChange?.("")
//   }

//   return (
//     <div className="rounded-2xl border border-slate-200 bg-white p-2">
//       <canvas
//         ref={ref}
//         width={560}
//         height={180}
//         className="h-[160px] w-full rounded-xl bg-slate-50 touch-none"
//         onMouseDown={start}
//         onMouseMove={move}
//         onMouseUp={end}
//         onMouseLeave={end}
//         onTouchStart={(e) => {
//           e.preventDefault()
//           start(e)
//         }}
//         onTouchMove={(e) => {
//           e.preventDefault()
//           move(e)
//         }}
//         onTouchEnd={(e) => {
//           e.preventDefault()
//           end()
//         }}
//       />
//       <div className="mt-2 flex justify-end">
//         <Button variant="outline" className="rounded-2xl" type="button" onClick={clear}>
//           Clear
//         </Button>
//       </div>
//     </div>
//   )
// }

// ==============================
// Helpers: nested patch + reading
// ==============================

function pathToString(path) {
  return Array.isArray(path) ? path.filter(Boolean).join(".") : String(path || "")
}

function getIn(obj, path) {
  let cur = obj
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined
    cur = cur[k]
  }
  return cur
}

function setIn(obj, path, value) {
  const out = { ...(obj || {}) }
  let cur = out
  for (let i = 0; i < path.length; i++) {
    const k = path[i]
    const last = i === path.length - 1
    if (last) {
      cur[k] = value
    } else {
      const next = cur[k]
      cur[k] = next && typeof next === "object" && !Array.isArray(next) ? { ...next } : {}
      cur = cur[k]
    }
  }
  return out
}


// Backward compatible value resolver:
// 1) nested (group.key.field)
// 2) dot-string key "group.key.field"
// 3) flat fallback "field"
function getFieldValue(secData, basePath, fieldKey) {
  const fullPath = [...(basePath || []), fieldKey].filter(Boolean)
  const dot = pathToString(fullPath)

  const nested = getIn(secData, fullPath)
  if (nested !== undefined) return nested

  if (secData && typeof secData === "object" && dot && secData[dot] !== undefined) return secData[dot]

  if (secData && typeof secData === "object" && fieldKey && secData[fieldKey] !== undefined) return secData[fieldKey]

  return undefined
}

// Flatten values for rules/visibility:
// adds:
// - leaf key: "cement_used"
// - dot key: "cement_details.antibiotic_name"
// - section dot: "COUNTS.sponge_count.initial_count"
function flattenAny(obj, out = {}, prefix = "") {
  if (!obj || typeof obj !== "object") return out

  if (Array.isArray(obj)) {
    // arrays are treated as values; do not deep-flatten into rules
    out[prefix] = obj
    return out
  }

  for (const [k, v] of Object.entries(obj)) {
    const nextPrefix = prefix ? `${prefix}.${k}` : k

    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenAny(v, out, nextPrefix)
    } else {
      // dot key
      out[nextPrefix] = v
      // leaf key (only set if not present to avoid overwriting duplicates)
      if (!(k in out)) out[k] = v
    }
  }
  return out
}



// ---------- helpers for width + mobile + table/json + files ----------

function resolveItemWidth(item, secLayout) {
  const explicit = String(item?.ui?.width || "").trim().toUpperCase()
  if (explicit && explicit !== "AUTO") return explicit

  const lay = String(secLayout || "STACK").toUpperCase()
  if (lay === "STACK") return "FULL"

  const t = String(item?.type || "text").toLowerCase()
  if (t === "group") return "FULL"
  if (["textarea", "table", "signature", "file", "image"].includes(t)) return "FULL"
  return "HALF"
}

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(`(max-width:${breakpointPx}px)`)
    const update = () => setIsMobile(!!mql.matches)
    update()
    if (mql.addEventListener) mql.addEventListener("change", update)
    else mql.addListener(update)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", update)
      else mql.removeListener(update)
    }
  }, [breakpointPx])
  return isMobile
}


function tryParseJsonArray(v) {
  if (!v || typeof v !== "string") return null
  try {
    const parsed = JSON.parse(v)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function formatBytes(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num <= 0) return ""
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let v = num
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const rounded = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10
  return `${rounded} ${units[i]}`
}

function normalizeFileValue(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") return [value]
  if (value) return [{ id: String(value), name: String(value) }]
  return []
}

function fileMetaFromFile(f) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    id,
    name: f?.name || "file",
    type: f?.type || "",
    size: f?.size || 0,
    last_modified: f?.lastModified || 0,
    __file: f, // keep for upload step later
  }
}

// ==============================
// Table Cell Control (per column)
// ==============================

function TableCellControl({ col, value, onChange }) {
  const t = String(col?.type || "text").toLowerCase()
  const opts = Array.isArray(col?.options) ? col.options : []

  if (t === "number") {
    const external = value === null || value === undefined ? "" : String(value)
    const [draft, setDraft] = React.useState(external)
    React.useEffect(() => setDraft(external), [external])

    return (
      <Input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = String(draft || "").trim()
          if (v === "") return onChange?.("")
          const n = Number(v)
          if (Number.isFinite(n)) return onChange?.(n)
          onChange?.(v)
        }}
        className="h-10 rounded-xl"
      />
    )
  }

  if (t === "select") {
    const v = safeStr(value, "") || PREVIEW_NONE
    return (
      <Select value={v} onValueChange={(vv) => onChange?.(vv === PREVIEW_NONE ? "" : vv)}>
        <SelectTrigger className="h-10 rounded-xl">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PREVIEW_NONE}>Select…</SelectItem>
          {opts.map((o) => (
            <SelectItem key={String(o.value)} value={String(o.value)}>
              {String(o.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (t === "boolean") {
    return (
      <div className="flex h-10 items-center justify-end rounded-xl border border-slate-200 bg-white px-3">
        <Switch checked={coerceBool(value)} onCheckedChange={(v) => onChange?.(!!v)} />
      </div>
    )
  }

  if (t === "date" || t === "time" || t === "datetime") {
    const inputType = t === "datetime" ? "datetime-local" : t
    return (
      <Input
        type={inputType}
        value={safeStr(value, "")}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-10 rounded-xl"
      />
    )
  }

  return (
    <Input
      value={safeStr(value, "")}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-10 rounded-xl"
    />
  )
}


// -----------------------------
// Controls
// -----------------------------
function PreviewControl({ item, value, onChange, sectionRoot, scopeData }) {
  const type = String(item?.type || "text").toLowerCase()
  const placeholder = safeStr(item?.placeholder || item?.ui?.placeholder || "", "")

  // options can come from multiple places
  const opts = normalizeOptions(item?.options || item?.ui?.options || item?.meta?.options || [])

  if (type === "textarea") {
    return (
      <Textarea
        value={safeStr(value, "")}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || "Type here…"}
        className="min-h-[110px] rounded-2xl"
      />
    )
  }

  if (type === "number") {
    const v = value === "" || value === null || value === undefined ? "" : Number(value)
    return (
      <Input
        type="number"
        value={Number.isFinite(v) ? v : ""}
        onChange={(e) => onChange?.(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={placeholder}
        className="h-11 rounded-2xl"
      />
    )
  }

  if (type === "date" || type === "time" || type === "datetime") {
    const inputType = type === "datetime" ? "datetime-local" : type
    return (
      <Input
        type={inputType}
        value={safeStr(value, "")}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-11 rounded-2xl"
      />
    )
  }

  if (type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-sm text-slate-700">{safeStr(item?.meta?.true_label, "Yes")}</div>
        <Switch checked={coerceBool(value)} onCheckedChange={(v) => onChange?.(!!v)} />
      </div>
    )
  }

  if (type === "select" || type === "radio") {
    const v = safeStr(value, "") || PREVIEW_NONE
    return (
      <Select value={v} onValueChange={(vv) => onChange?.(vv === PREVIEW_NONE ? "" : vv)}>
        <SelectTrigger className="h-11 rounded-2xl">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PREVIEW_NONE}>Select…</SelectItem>
          {opts.map((o) => (
            <SelectItem key={String(o.value)} value={String(o.value)}>
              {String(o.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (type === "multiselect") {
    const arr = asArray(value).map(String)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {opts.map((o) => {
            const active = arr.includes(String(o.value))
            return (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => {
                  const next = active
                    ? arr.filter((x) => x !== String(o.value))
                    : [...arr, String(o.value)]
                  onChange?.(next)
                }}
                className={cn(
                  "rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition",
                  active
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {String(o.label)}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (type === "chips") {
    return (
      <Input
        value={safeStr(value, "")}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || "Enter values separated by commas"}
        className="h-11 rounded-2xl"
      />
    )
  }

  // ✅ FIX #1: Table columns live in item.table.columns in your JSON
  if (type === "table") {
    const tableMeta = item?.table || item?.meta?.table || {}
    const cols = Array.isArray(tableMeta?.columns) ? tableMeta.columns : []
    const allowAdd = tableMeta?.allow_add_row !== false
    const allowDel = tableMeta?.allow_delete_row !== false
    const minRows = Number(tableMeta?.min_rows || 0)
    const maxRowsRaw = Number(tableMeta?.max_rows || 0)
    const maxRows = maxRowsRaw > 0 ? maxRowsRaw : Infinity

    if (!cols.length) {
      // safer fallback (still allows saving)
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-sm font-semibold text-amber-900">Table field has no columns</div>
          <div className="mt-1 text-xs text-amber-800">
            Configure columns in the template. Temporary fallback: store JSON below.
          </div>
          <Textarea
            value={safeStr(value ? JSON.stringify(value, null, 2) : "", "")}
            onChange={(e) => {
              try {
                const parsed = e.target.value ? JSON.parse(e.target.value) : []
                onChange?.(parsed)
              } catch {
                onChange?.(e.target.value)
              }
            }}
            className="mt-2 min-h-[140px] rounded-2xl"
            placeholder='e.g. [{"colA":"..."}]'
          />
        </div>
      )
    }

    return (
      <TableField
        columns={cols}
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
        allowAdd={allowAdd}
        allowDel={allowDel}
        minRows={minRows}
        maxRows={maxRows}
      />
    )
  }

  if (type === "signature") return <SignaturePad value={value} onChange={onChange} />

  if (type === "file" || type === "image") {
    const meta = value && typeof value === "object" ? value : value ? { name: String(value) } : null
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{meta?.name ? meta.name : "No file selected"}</div>
            {meta?.type ? <div className="mt-0.5 text-xs text-slate-500">{meta.type}</div> : null}
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept={type === "image" ? "image/*" : undefined}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files && e.target.files[0]
                if (!f) return
                onChange?.({ name: f.name, type: f.type, size: f.size, last_modified: f.lastModified })
              }}
            />
            <span className="inline-flex h-9 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Choose
            </span>
          </label>
        </div>
      </div>
    )
  }

  return (
    <Input
      value={safeStr(value, "")}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-2xl"
    />
  )
}


// -----------------------------
// TableField (less cramped + better UX)
// -----------------------------
function TableField({ columns, value, onChange, allowAdd, allowDel, minRows, maxRows }) {
  const rows = Array.isArray(value) ? value : []

  const canAdd = allowAdd && rows.length < maxRows
  const canDel = allowDel && rows.length > Math.max(0, minRows)

  const addRow = () => {
    if (!canAdd) return
    onChange?.([...(rows || []), {}])
  }

  const removeRow = () => {
    if (!canDel) return
    onChange?.(rows.slice(0, -1))
  }

  const updateCell = (ridx, colKey, nextVal) => {
    const nextRows = [...rows]
    const nextRow = { ...(nextRows[ridx] || {}) }
    nextRow[colKey] = nextVal
    nextRows[ridx] = nextRow
    onChange?.(nextRows)
  }

  // Empty state (optional tables look cleaner)
  if (!rows.length && minRows === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">No rows</div>
          <Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={addRow} disabled={!canAdd}>
            Add first row
          </Button>
        </div>
        <div className="mt-1 text-xs text-slate-500">Add a row to start entering data.</div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* header actions */}
      <div className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
        <div className="text-xs font-semibold text-slate-600">
          {rows.length} row(s)
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-8 rounded-2xl" onClick={addRow} disabled={!canAdd}>
            Add row
          </Button>
          <Button type="button" variant="outline" className="h-8 rounded-2xl" onClick={removeRow} disabled={!canDel}>
            Remove row
          </Button>
        </div>
      </div>

      {/* responsive table */}
      <div className="max-w-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-600">
                  {safeStr(c?.label || c?.key || `Col ${i + 1}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : [{}]).map((row, ridx) => (
              <tr key={ridx} className="border-t">
                {columns.map((c, cidx) => {
                  const k = safeStr(c?.key, `c${cidx}`)
                  const cellVal = row?.[k] ?? ""
                  const cType = safeStr(c?.type, "text").toLowerCase()
                  const cOpts = normalizeOptions(c?.options || [])

                  return (
                    <td key={cidx} className="px-3 py-2 align-top">
                      {cType === "select" ? (
                        <Select
                          value={safeStr(cellVal, "") || PREVIEW_NONE}
                          onValueChange={(vv) => updateCell(ridx, k, vv === PREVIEW_NONE ? "" : vv)}
                        >
                          <SelectTrigger className="h-10 min-w-[140px] rounded-xl">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PREVIEW_NONE}>Select…</SelectItem>
                            {cOpts.map((o) => (
                              <SelectItem key={String(o.value)} value={String(o.value)}>
                                {String(o.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={cType === "number" ? "number" : "text"}
                          value={cellVal === null || cellVal === undefined ? "" : String(cellVal)}
                          onChange={(e) => {
                            const v = cType === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value
                            updateCell(ridx, k, v)
                          }}
                          className="h-10 min-w-[140px] rounded-xl"
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -----------------------------
// Field renderer (path-safe)
// -----------------------------
const PreviewField = memo(function PreviewField({
  item,
  cols,
  showHidden,
  secKey,
  sectionRoot,
  scopeData,
  fieldPathPrefix,
  onPatch,
}) {
  const key = itemKeyOf(item, "")
  const label = safeStr(item?.label || item?.title || item?.name || key, key)
  const required = !!item?.required
  const ui = item?.ui || {}
  const width = ui?.width || "HALF"
  const help = item?.help_text || item?.help || item?.meta?.help || ui?.help || ""

  if (!key) return null
  if (!isVisible(item, showHidden, scopeData, sectionRoot)) return null

  // IMPORTANT:
  // value is stored at: sectionRoot[fieldPathPrefix...][key]
  // e.g. COUNTS.sponge_count.initial_count  (no collision)
  const fullPath = [...(fieldPathPrefix || []), key]
  const val =
    getIn(sectionRoot, fullPath) ??
    // backward-compat fallback: old flat storage at section root
    (Object.prototype.hasOwnProperty.call(sectionRoot || {}, key) ? sectionRoot[key] : undefined)

  return (
    <div className={cn("space-y-1.5", colSpanClass(width, cols))}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700">
          {label} {required ? <span className="text-rose-600">*</span> : null}
        </div>
        {ui?.tag ? (
          <Badge variant="outline" className="rounded-xl text-[10px]">
            {String(ui.tag)}
          </Badge>
        ) : null}
      </div>

      <PreviewControl
        item={item}
        value={val}
        sectionRoot={sectionRoot}
        scopeData={scopeData}
        onChange={(next) => onPatch?.(secKey, fullPath, next)}
      />

      {help ? <div className="text-xs text-slate-400">{String(help)}</div> : null}
    </div>
  )
})


// -----------------------------
// Main Editor
// -----------------------------
export function TemplateSectionsEditor({ schema, value, onChange, tone }) {
  const s = ensureTemplateSchemaShape(schema)
  const sections = Array.isArray(s.sections) ? s.sections : []
  const [showHidden, setShowHidden] = useState(false)

  // data shape: { [sectionKey]: { ...fields OR groups... } }
  const secData = value && typeof value === "object" ? value : {}

  const onPatch = useCallback(
    (secKey, fieldPath, nextVal) => {
      onChange?.((prev) => {
        const out = { ...(prev || {}) }
        const sk = safeStr(secKey, "section")
        const currentSec = out[sk] && typeof out[sk] === "object" ? out[sk] : {}
        out[sk] = setIn(currentSec, fieldPath, nextVal)
        return out
      })
    },
    [onChange]
  )

  if (!sections.length) {
    return (
      <Alert className="rounded-2xl">
        <AlertTitle>No sections</AlertTitle>
        <AlertDescription>This template has no sections configured.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Compact top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-xl">
            {sections.length} section(s)
          </Badge>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Switch checked={showHidden} onCheckedChange={(v) => setShowHidden(!!v)} />
            <div className="text-xs font-semibold text-slate-700">Show hidden fields</div>
          </div>
        </div>
      </div>

      {sections.map((sec, sidx) => {
        const secKey = sectionKeyOf(sec, sidx)
        const cols = layoutCols(sec?.layout || "STACK")
        const items = normalizeSectionItems(sec?.items || [])
        const dataForSec = secData?.[secKey] && typeof secData?.[secKey] === "object" ? secData?.[secKey] : {}

        return (
          <Card key={secKey} className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    {safeStr(sec?.label || sec?.title || sec?.name || secKey, secKey)}
                  </CardTitle>
                  {sec?.description ? (
                    <CardDescription className="text-xs">{String(sec.description)}</CardDescription>
                  ) : null}
                </div>
                <Badge className={cn("rounded-xl", tone?.chip)}>{String(secKey)}</Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className={cn("grid gap-3", gridColsClass(cols))}>
                {items.map((item, idx) => {
                  const t = String(item?.type || "text").toLowerCase()

                  // GROUP: store as nested object under group key
                  if (t === "group") {
                    const groupKey = itemKeyOf(item, `group_${idx}`)
                    const groupLabel = safeStr(item?.label || item?.title || item?.name || groupKey, "Group")
                    const kids = normalizeSectionItems(item?.items || item?.group?.items || [])
                    const groupData = (getIn(dataForSec, [groupKey]) && typeof getIn(dataForSec, [groupKey]) === "object")
                      ? getIn(dataForSec, [groupKey])
                      : {}

                    // group visibility based on current scope = section root (because group is at section root)
                    if (!isVisible(item, showHidden, dataForSec, dataForSec)) return null

                    const innerCols = layoutCols(item?.group?.layout || "GRID_2")

                    return (
                      <div
                        key={itemReactKey(item, idx, `${secKey}:g:`)}
                        className={cn(
                          "rounded-2xl border border-slate-200 bg-slate-50/60 p-3",
                          colSpanClass(item?.ui?.width || "FULL", cols)
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">{groupLabel}</div>
                          {item?.ui?.tag ? (
                            <Badge variant="outline" className="rounded-xl text-[10px]">
                              {String(item.ui.tag)}
                            </Badge>
                          ) : null}
                        </div>

                        <div className={cn("grid gap-3", gridColsClass(innerCols))}>
                          {kids.map((kid, kidx) => (
                            <PreviewField
                              key={itemReactKey(kid, kidx, `${secKey}:k:`)}
                              item={kid}
                              cols={innerCols}
                              showHidden={showHidden}
                              secKey={secKey}
                              sectionRoot={dataForSec}
                              scopeData={groupData}
                              fieldPathPrefix={[groupKey]}
                              onPatch={onPatch}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <PreviewField
                      key={itemReactKey(item, idx, `${secKey}:i:`)}
                      item={item}
                      cols={cols}
                      showHidden={showHidden}
                      secKey={secKey}
                      sectionRoot={dataForSec}
                      scopeData={dataForSec}
                      fieldPathPrefix={[]}
                      onPatch={onPatch}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}


// -------------------- Print helpers/components --------------------
function formatPrintValue(item, value) {
  const type = String(item?.type || "text").toLowerCase()
  if (value === null || value === undefined || value === "") return "—"
  if (type === "boolean") return coerceBool(value) ? safeStr(item?.meta?.true_label, "Yes") : safeStr(item?.meta?.false_label, "No")
  if (type === "multiselect") {
    const arr = asArray(value).map(String).filter(Boolean)
    return arr.length ? arr.join(", ") : "—"
  }
  if (type === "chips") {
    if (Array.isArray(value)) return value.map(String).join(", ")
    return safeStr(value, "—")
  }
  if (type === "table") return value
  if (type === "signature") {
    if (typeof value === "string" && value.trim()) return "Signed"
    if (value?.data_url) return value
    return "—"
  }
  if (type === "file" || type === "image") {
    if (typeof value === "string") return value
    if (value?.name) return value.name
    return "—"
  }
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function PrintValue({ item, value }) {
  const type = String(item?.type || "text").toLowerCase()
  const v = formatPrintValue(item, value)

  if (type === "table") {
    const cols = Array.isArray(item?.columns) ? item.columns : Array.isArray(item?.meta?.columns) ? item.meta.columns : []
    const rows = Array.isArray(value) ? value : []
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="max-w-full overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {cols.map((c, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600">
                    {safeStr(c?.label || c?.key || `Col ${i + 1}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows.length ? rows : [{}]).map((row, ridx) => (
                <tr key={ridx} className="border-t">
                  {cols.map((c, cidx) => {
                    const k = String(c?.key || `c${cidx}`)
                    return (
                      <td key={cidx} className="px-3 py-2 text-slate-900">
                        {safeStr(row?.[k], "—")}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (type === "signature") {
    const url = value?.data_url
    return (
      <div className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-3 py-2">
        {url ? <img src={url} alt="Signature" className="h-20 w-auto" /> : <span className="text-sm text-slate-500">{String(v)}</span>}
      </div>
    )
  }

  const isBig = type === "textarea"
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900", isBig ? "min-h-[96px] whitespace-pre-wrap" : "min-h-[44px]")}>
      {typeof v === "string" ? v : safeStr(v, "—")}
    </div>
  )
}

function PrintField({ item, cols, includeHidden, secKey, secData, tone, scopeData, fieldPathPrefix = [] }) {
  const key = itemKeyOf(item, "")
  const label = item?.label || item?.title || item?.name || key
  const required = !!item?.required
  const ui = item?.ui || {}
  const width = ui?.width || "HALF"
  const help = item?.help || item?.meta?.help || ui?.help || ""

  if (!key) return null
  if (!isVisible(item, !!includeHidden, scopeData || {}, secData || {})) return null

  const val = getFieldValue(secData || {}, fieldPathPrefix || [], key)

  return (
    <div className={cn("space-y-1.5", colSpanClass(width, cols))}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700">
          {String(label)} {required ? <span className="text-rose-600">*</span> : null}
        </div>
        {ui?.tag ? (
          <Badge variant="outline" className="rounded-xl text-[10px]">
            {String(ui.tag)}
          </Badge>
        ) : null}
      </div>

      <PrintValue item={item} value={val} />
      {help ? <div className="text-xs text-slate-400">{String(help)}</div> : null}
    </div>
  )
}


function PrintDocument({ patient, visit, dept, recordType, template, title, note, schema, data, includeHidden, tone }) {
  const s = ensureTemplateSchemaShape(schema)
  const sections = Array.isArray(s.sections) ? s.sections : []
  const secData = data && typeof data === "object" ? data : {}
  const values = useMemo(() => flattenSectionData(secData), [secData])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-900">{(title || "").trim() || "Clinical Record"}</div>
            {note?.trim() ? <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{note.trim()}</div> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge variant="outline" className="rounded-xl">Dept: {dept?.name || dept?.code || "—"}</Badge>
              <Badge variant="outline" className="rounded-xl">Type: {recordType?.label || recordType?.code || "—"}</Badge>
              <Badge variant="outline" className="rounded-xl">Template: {template?.name || "—"}</Badge>
              {visit?.encounter_type ? (
                <Badge variant="outline" className="rounded-xl">Visit: {visit.encounter_type} · {visit.encounter_code || visit.encounter_id || "—"}</Badge>
              ) : (
                <Badge variant="outline" className="rounded-xl">Visit: Unlinked</Badge>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="text-xs font-semibold text-slate-500">Patient</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{patient?.name || "—"}</div>
            <div className="mt-0.5 text-xs text-slate-600">UHID: {patient?.uhid || "—"}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div>
                <div className="text-[10px] text-slate-500">Gender</div>
                <div className="font-semibold text-slate-900">{patient?.gender || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Age</div>
                <div className="font-semibold text-slate-900">
                  {patient?.age !== undefined && patient?.age !== null && String(patient.age) !== "" ? `${patient.age}` : "—"}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-slate-500">Phone</div>
                <div className="font-semibold text-slate-900">{patient?.phone || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn("mt-4 h-1.5 w-full rounded-2xl bg-gradient-to-r", tone?.bar || "from-slate-200 to-slate-100")} />
      </div>

      {sections.length ? (
        <div className="space-y-6">
          {sections.map((sec, sidx) => {
            const secKey = sectionKeyOf(sec, sidx)
            const cols = layoutCols(sec?.layout || "STACK")
            const items = normalizeSectionItems(sec?.items || [])
            const dataForSec = secData?.[secKey] || {}

            return (
              <Card key={secKey} className="rounded-3xl border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{safeStr(sec?.label || sec?.title || sec?.name || secKey, secKey)}</CardTitle>
                      {sec?.description ? <CardDescription className="text-xs">{String(sec.description)}</CardDescription> : null}
                    </div>
                    <Badge className={cn("rounded-xl", tone?.chip)}>{String(secKey)}</Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className={cn("grid gap-3", gridColsClass(cols))}>
                    {items.map((item, idx) => {
                      const t = String(item?.type || "text").toLowerCase()
                      if (t === "group") {
                        const groupKey = itemKeyOf(item, `group_${idx}`)
                        const groupLabel = safeStr(item?.label || item?.title || item?.name, "Group")
                        const kids = normalizeSectionItems(item?.items || item?.group?.items || [])
                        const groupData = (getIn(dataForSec, [groupKey]) && typeof getIn(dataForSec, [groupKey]) === "object") ? getIn(dataForSec, [groupKey]) : {}
                        const innerCols = layoutCols(item?.group?.layout || "GRID_2")
                        const secScope = flattenAny(dataForSec, {}, "")
                        const groupScope = { ...secScope, ...(groupData || {}) }

                        return (
                          <div
                            key={itemReactKey(item, idx, `${secKey}:pg:`)}
                            className={cn("rounded-2xl border border-slate-200 bg-slate-50/60 p-3", colSpanClass(item?.ui?.width || "FULL", cols))}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900">{groupLabel}</div>
                              {item?.ui?.tag ? (
                                <Badge variant="outline" className="rounded-xl text-[10px]">
                                  {String(item.ui.tag)}
                                </Badge>
                              ) : null}
                            </div>

                            <div className={cn("grid gap-3", gridColsClass(innerCols))}>
                              {kids.map((kid, kidx) => (
                                <PrintField
                                  key={itemReactKey(kid, kidx, `${secKey}:pk:`)}
                                  item={kid}
                                  cols={innerCols}
                                  includeHidden={includeHidden}
                                  secKey={secKey}
                                  secData={dataForSec}
                                  tone={tone}
                                  scopeData={groupScope}
                                  fieldPathPrefix={[groupKey]}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <PrintField
                          key={itemReactKey(item, idx, `${secKey}:pi:`)}
                          item={item}
                          cols={cols}
                          values={values}
                          includeHidden={includeHidden}
                          secKey={secKey}
                          secData={dataForSec}
                          tone={tone}
                        />
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Alert className="rounded-2xl">
          <AlertTitle>No sections</AlertTitle>
          <AlertDescription>This template has no sections configured.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function PrintPreviewDialog({
  open,
  onOpenChange,
  tone,
  title,
  dept,
  recordType,
  template,
  patient,
  visit,
  schema,
  data,
  includeHidden,
  setIncludeHidden,
  onPrint,
}) {
  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl rounded-3xl border-slate-200 bg-white p-0 shadow-xl">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base">Print Preview</DialogTitle>
          <DialogDescription className="sr-only">Preview the record before printing</DialogDescription>
        </DialogHeader>


        <div className="px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{title?.trim() ? title.trim() : "Untitled Record"}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Badge variant="outline" className="rounded-xl">{dept?.name || dept?.code || "—"}</Badge>
                <Badge variant="outline" className="rounded-xl">{recordType?.label || recordType?.code || "—"}</Badge>
                <Badge variant="outline" className="rounded-xl">{template?.name || "—"}</Badge>
                <Badge variant="outline" className="rounded-xl">
                  Patient: {patient?.name || "—"} ({patient?.uhid || "—"})
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                <Switch checked={!!includeHidden} onCheckedChange={(v) => setIncludeHidden?.(!!v)} />
                <div className="text-xs font-semibold text-slate-700">Include hidden</div>
              </div>

              <Button variant="outline" className="h-10 rounded-2xl" onClick={() => onOpenChange?.(false)}>
                Close
              </Button>

              <Button className={cn("h-10 rounded-2xl", tone?.btn)} onClick={onPrint} disabled={!template}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            </div>
          </div>

          <div className="mt-4 max-h-[68vh] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-slate-50/40 p-4">
            <PrintDocument
              patient={patient}
              visit={visit}
              dept={dept}
              recordType={recordType}
              template={template}
              title={title}
              note={""}
              schema={schema}
              data={data}
              includeHidden={includeHidden}
              tone={tone}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PrintOverlay({ open, onClose, tone, patient, visit, dept, recordType, template, title, note, schema, data, includeHidden }) {
  if (!open) return null
  return (
    <div id="emr-print-root" className="fixed inset-0 z-[9999] bg-white">
      <div className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Printing…</div>
          <div className="text-xs text-slate-500">Close this overlay after printing if it stays open.</div>
        </div>
        <Button variant="outline" className="h-10 rounded-2xl" onClick={onClose}>
          <X className="mr-2 h-4 w-4" /> Close
        </Button>
      </div>

      <div className="px-6 py-6">
        <PrintDocument
          patient={patient}
          visit={visit}
          dept={dept}
          recordType={recordType}
          template={template}
          title={title}
          note={note}
          schema={schema}
          data={data}
          includeHidden={includeHidden}
          tone={tone}
        />
      </div>
    </div>
  )
}

// -------------------- Main flow --------------------
export default function EmrCreateRecordFlow({
  patient,
  defaultDeptCode,
  onClose,
  onSaved,
  onUpdated,
  mode = "create",
  recordId = null,
  fullscreen = false,
}) {
  const isMobile = useIsMobile(1024)
  const p = useMemo(() => normalizePatient(patient), [patient])

  // ✅ Patient details resolve (FIX: do not use patientEff before declaration)
  const [patientResolved, setPatientResolved] = useState(p)
  const [patientLoading, setPatientLoading] = useState(false)

  useEffect(() => {
    setPatientResolved(p || null)
  }, [p?.id])

  const patientEff = patientResolved || p // ✅ defined BEFORE effects that use it

  useEffect(() => {
    let alive = true
    const pid = asMaybeInt(p?.id)
    if (!pid) return

    setPatientLoading(true)
      ; (async () => {
        try {
          const data = await apiPatientSummary(pid)
          if (!alive) return
          if (data) {
            const np = normalizePatient(data)
            setPatientResolved((prev) => normalizePatient({ ...(prev || {}), ...(np || {}) }))
          }
        } catch {
          // ignore; fallback to provided patient
        } finally {
          if (alive) setPatientLoading(false)
        }
      })()

    return () => {
      alive = false
    }
  }, [p?.id])

  // ✅ Print
  const [printOpen, setPrintOpen] = useState(false)
  const [printIncludeHidden, setPrintIncludeHidden] = useState(false)
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => {
    const onAfter = () => setPrintMode(false)
    window.addEventListener?.("afterprint", onAfter)
    return () => window.removeEventListener?.("afterprint", onAfter)
  }, [])

  const [step, setStep] = useState(0)

  // meta
  const [metaLoading, setMetaLoading] = useState(true)
  const [departments, setDepartments] = useState([])
  const [recordTypes, setRecordTypes] = useState([])
  const [metaErr, setMetaErr] = useState("")

  // visits
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [visits, setVisits] = useState([])
  const [visitQ, setVisitQ] = useState("")
  const [visit, setVisit] = useState(null)

  // selections
  const [dept, setDept] = useState(null)
  const [recordType, setRecordType] = useState(null)
  const [template, setTemplate] = useState(null)

  // templates
  const [tplQ, setTplQ] = useState("")
  const [tplLoading, setTplLoading] = useState(false)
  const [tplErr, setTplErr] = useState("")
  const [tplStatus, setTplStatus] = useState("PUBLISHED")
  const [templatesResp, setTemplatesResp] = useState({ items: [], total: 0 })

  // review
  const [title, setTitle] = useState("")
  const [confidential, setConfidential] = useState(false)
  const [note, setNote] = useState("")
  const [attachments, setAttachments] = useState([])

  // actions
  const [saving, setSaving] = useState(false)

  // form data
  const [sectionData, setSectionData] = useState({})

  // edit mode
  const isEdit = String(mode || "create").toLowerCase() === "edit"
  const [editingId] = useState(asMaybeInt(recordId))
  const [editLoading, setEditLoading] = useState(false)
  const [editErr, setEditErr] = useState("")

  const deptCode = dept?.code || defaultDeptCode || "COMMON"
  const tone = deptTone(deptCode)

  const sectionsBlueprint = useMemo(
    () => normalizeTemplateBlueprint(template),
    [template?.id, template?.updated_at, template?.schema_json, template?.schema]
  )

  useEffect(() => {
    if (!template?.id) {
      setSectionData({})
      return
    }
    setSectionData((prev) => initDataFromBlueprint(sectionsBlueprint, prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, template?.schema_json, template?.schema])

  // ensure full template schema if list payload missing it
  useEffect(() => {
    let mounted = true
      ; (async () => {
        const tid = asMaybeInt(template?.id)
        if (!tid) return
        const hasSchema =
          !!template?.schema_json ||
          (template?.schema && typeof template.schema === "object" && Array.isArray(template.schema.sections))
        if (hasSchema) return

        try {
          const data = await apiTemplateGet(tid)
          const tpl = data?.template || data?.data?.template || data
          if (!mounted || !tpl) return
          setTemplate((prev) => {
            if (!prev) return prev
            if (String(prev.id) !== String(tid)) return prev
            return { ...prev, ...tpl }
          })
        } catch {
          // ignore
        }
      })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id])

  // load meta once
  useEffect(() => {
    let mounted = true
      ; (async () => {
        setMetaLoading(true)
        setMetaErr("")
        try {
          const m = await apiEmrMeta()
          if (!mounted) return

          const deps = Array.isArray(m?.departments) ? m.departments : []
          const rts = Array.isArray(m?.record_types) ? m.record_types : []

          const hasCommon = deps.some((d) => String(d.code).toUpperCase() === "COMMON")
          const deps2 = hasCommon ? deps : [{ code: "COMMON", name: "Common (All)" }, ...deps]

          setDepartments(deps2)
          setRecordTypes(rts)

          const d0 =
            deps2.find((d) => String(d.code).toUpperCase() === String(defaultDeptCode || "").toUpperCase()) ||
            deps2.find((d) => String(d.code).toUpperCase() === "COMMON") ||
            deps2[0] ||
            null
          setDept(d0)
        } catch (e) {
          if (!mounted) return
          setMetaErr(errMsg(e))

          const deps2 = [
            { code: "COMMON", name: "Common (All)" },
            { code: "OBGYN", name: "OBGYN" },
            { code: "GENERAL_MEDICINE", name: "General Medicine" },
          ]
          const rts2 = [
            { code: "OPD_NOTE", label: "OPD Consultation", category: "Clinical" },
            { code: "PROGRESS_NOTE", label: "Daily Progress", category: "IPD" },
            { code: "PRESCRIPTION", label: "Prescription", category: "Pharmacy" },
            { code: "LAB_RESULT", label: "Lab Result", category: "Diagnostics" },
            { code: "RADIOLOGY_REPORT", label: "Radiology Report", category: "Diagnostics" },
            { code: "CONSENT", label: "Consent", category: "Legal" },
            { code: "DISCHARGE_SUMMARY", label: "Discharge Summary", category: "IPD" },
            { code: "EXTERNAL_DOCUMENT", label: "External Document", category: "Docs" },
          ]
          setDepartments(deps2)
          setRecordTypes(rts2)
          setDept(deps2[0])
        } finally {
          if (mounted) setMetaLoading(false)
        }
      })()

    return () => {
      mounted = false
    }
  }, [defaultDeptCode])

  // load record when editing
  useEffect(() => {
    let mounted = true
      ; (async () => {
        if (!isEdit) return
        const rid = asMaybeInt(editingId)
        if (!rid) return
        if (metaLoading) return

        setEditLoading(true)
        setEditErr("")
        try {
          const res = await apiRecordGet(rid)
          const rec = res?.record || res?.data?.record || res?.data || null
          if (!mounted || !rec) return

          setTitle(String(rec.title || ""))
          setNote(rec.note || "")
          setConfidential(!!rec.confidential)

          const d0 =
            departments.find((d) => String(d.code).toUpperCase() === String(rec.dept_code || "").toUpperCase()) ||
            departments.find((d) => String(d.code).toUpperCase() === "COMMON") ||
            departments[0] ||
            null
          if (d0) setDept(d0)

          const rt0 = recordTypes.find((t) => String(t.code).toUpperCase() === String(rec.record_type_code || "").toUpperCase()) || null
          if (rt0) setRecordType(rt0)

          // visit context best-effort
          const encType = String(rec.encounter_type || "")
          const encId = rec.encounter_id
          if (encType && encId != null) {
            const match = (visits || []).find(
              (v) => String(v.encounter_type || "") === encType && String(v.encounter_id ?? "") === String(encId ?? "")
            )
            if (match) setVisit(match)
          }

          const tSections = Array.isArray(rec.template_sections) ? rec.template_sections : []
          setTemplate(
            rec.template_id
              ? { id: rec.template_id, name: `Template #${rec.template_id}`, sections: tSections }
              : tSections.length
                ? { id: null, name: "Template", sections: tSections }
                : null
          )

          const content = rec.content || {}
          const data = content?.data && typeof content.data === "object" ? content.data : {}
          setSectionData((prev) => ({ ...(prev || {}), ...(data || {}) }))

          setStep(3)
        } catch (e) {
          if (!mounted) return
          setEditErr(errMsg(e))
        } finally {
          if (mounted) setEditLoading(false)
        }
      })()
    return () => {
      mounted = false
    }
  }, [isEdit, editingId, metaLoading, departments, recordTypes, visits])

  // load visits when patient changes (FIX: use resolved patient id)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        const pid = asMaybeInt(patientEff?.id)
        if (!pid) {
          setVisits([])
          setVisit(null)
          return
        }

        setVisitsLoading(true)
        try {
          const items = await fetchVisitsAuto(pid)
          if (!mounted) return

          const unlinked = {
            id: "UNLINKED",
            encounter_type: "",
            encounter_id: "",
            dept_code: dept?.code || defaultDeptCode || "COMMON",
            dept_name: dept?.name || "Common (All)",
            doctor: "—",
            when: new Date().toISOString(),
            status: "Unlinked / General",
          }

          setVisits([unlinked, ...items])
          setVisit(unlinked)
        } catch (e) {
          if (!mounted) return
          const unlinked = {
            id: "UNLINKED",
            encounter_type: "",
            encounter_id: "",
            dept_code: dept?.code || defaultDeptCode || "COMMON",
            dept_name: dept?.name || "Common (All)",
            doctor: "—",
            when: new Date().toISOString(),
            status: "Unlinked / General",
          }
          setVisits([unlinked])
          setVisit(unlinked)
          toast.error(errMsg(e))
        } finally {
          if (mounted) setVisitsLoading(false)
        }
      })()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientEff?.id])

  // sync dept from visit
  useEffect(() => {
    if (!visit?.dept_code || !departments.length) return
    const code = String(visit.dept_code || "").toUpperCase()
    const found = departments.find((d) => String(d.code).toUpperCase() === code)
    if (found) setDept(found)
  }, [visit?.dept_code, departments])

  // auto title from template + record type
  useEffect(() => {
    if (!template) return
    const rt = recordType?.label ? ` · ${recordType.label}` : ""
    setTitle(`${template.name || "Template"}${rt}`)
  }, [template?.id, recordType?.code])

  // fetch templates
  useEffect(() => {
    const shouldLoad = step >= 2 && !!dept?.code && !!recordType?.code
    if (!shouldLoad) return

    let mounted = true
    const t = setTimeout(async () => {
      setTplLoading(true)
      setTplErr("")
      try {
        const resp = await apiTemplatesList({
          dept_code: dept.code,
          record_type_code: recordType.code,
          q: tplQ,
          limit: 20,
          status: tplStatus,
        })
        if (!mounted) return
        setTemplatesResp(resp || { items: [], total: 0 })
      } catch (e) {
        if (!mounted) return
        setTemplatesResp({ items: [], total: 0 })
        setTplErr(errMsg(e))
      } finally {
        if (mounted) setTplLoading(false)
      }
    }, 250)

    return () => {
      mounted = false
      clearTimeout(t)
    }
  }, [dept?.code, recordType?.code, tplQ, tplStatus, step])

  const filteredVisits = useMemo(() => {
    const q = (visitQ || "").trim().toLowerCase()
    if (!q) return visits
    return (visits || []).filter((v) =>
      `${v.encounter_id} ${v.encounter_type} ${v.dept_name} ${v.doctor} ${v.status}`.toLowerCase().includes(q)
    )
  }, [visits, visitQ])

  const templates = useMemo(() => {
    const items = Array.isArray(templatesResp?.items) ? templatesResp.items : []
    return [...items].sort(
      (a, b) => Number(!!b.is_premium) - Number(!!a.is_premium) || String(a.name || "").localeCompare(String(b.name || ""))
    )
  }, [templatesResp])

  const suggested = useMemo(() => templates.slice(0, 10), [templates])
  const missingRequired = useMemo(() => findMissingRequired(sectionsBlueprint, sectionData), [sectionsBlueprint, sectionData])

  function canNext() {
    if (step === 0) return true
    if (step === 1) return !!recordType
    if (step === 2) return !!template
    if (step === 3) {
      const okTitle = (title || "").trim().length >= 3
      const okRequired = missingRequired.length === 0
      return !!recordType && !!template && okTitle && okRequired
    }
    return false
  }

  function next() {
    if (!canNext()) return toast.error("Please complete this step to continue")
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function resetAll() {
    setStep(0)
    setVisit(visits?.[0] || null)
    setRecordType(null)

    const d0 =
      departments.find((d) => String(d.code).toUpperCase() === String(defaultDeptCode || "").toUpperCase()) ||
      departments.find((d) => String(d.code).toUpperCase() === "COMMON") ||
      departments[0] ||
      null
    setDept(d0)

    setTemplate(null)
    setTitle("")
    setConfidential(false)
    setNote("")
    setAttachments([])
    setTplQ("")
    setVisitQ("")
    setSectionData({})
  }

  function buildDraftPayload({ draft_stage }) {
    const isUnlinked = visit?.id === "UNLINKED" || !visit
    const encounter_type = isUnlinked ? null : String(visit?.encounter_type || "") || null
    const encounter_id = isUnlinked ? null : (asMaybeInt(visit?.encounter_id) ?? visit?.encounter_id ?? null)

    return {
      patient_id: asMaybeInt(patientEff?.id),
      dept_code: dept?.code || "COMMON",
      record_type_code: recordType?.code || null,
      encounter_type,
      encounter_id,
      template_id: asMaybeInt(template?.id),
      title: (title || "").trim(),
      note: (note || "").trim(),
      confidential: !!confidential,
      content: {
        template: {
          id: template?.id ?? null,
          name: template?.name ?? null,
          schema_version: sectionsBlueprint?.schema_version || 1,
          sections: Array.isArray(sectionsBlueprint?.sections)
            ? sectionsBlueprint.sections
            : Array.isArray(template?.sections)
              ? template.sections
              : [],
        },
        data: sectionData,
        ui: { attachments: attachments || [] },
      },
      draft_stage: draft_stage || "INCOMPLETE",
    }
  }

  function buildUpdatePayload({ draft_stage }) {
    return {
      title: (title || "").trim(),
      note: (note || "").trim() || null,
      confidential: !!confidential,
      content: {
        template: {
          id: template?.id ?? null,
          name: template?.name ?? null,
          schema_version: sectionsBlueprint?.schema_version || 1,
          sections: Array.isArray(sectionsBlueprint?.sections)
            ? sectionsBlueprint.sections
            : Array.isArray(template?.sections)
              ? template.sections
              : [],
        },
        data: sectionData,
        ui: { attachments: attachments || [] },
      },
      draft_stage: draft_stage || undefined,
    }
  }

  function pickApiErrorPayload(e) {
    return e?.response?.data || e?.data || null
  }

  function locToField(loc) {
    if (!Array.isArray(loc)) return "field"
    const last = loc[loc.length - 1]
    return String(last || "field")
  }

  const FIELD_LABEL = {
    patient_id: "Patient",
    encounter_type: "Encounter Type",
    encounter_id: "Encounter ID",
    dept_code: "Department",
    record_type_code: "Record Type",
    title: "Title",
    content: "Content",
    draft_stage: "Draft Stage",
  }

  function extractValidationMessages(e) {
    const data = pickApiErrorPayload(e)
    const details = data?.error?.details || data?.details || data?.error?.detail || data?.detail || null

    if (Array.isArray(details)) {
      return details.map((d) => {
        const field = FIELD_LABEL[locToField(d.loc)] || locToField(d.loc)
        const msg = d.msg || "Invalid value"
        return `${field}: ${msg}`
      })
    }

    if (typeof data?.detail === "string") return [data.detail]
    if (typeof data?.msg === "string") return [data.msg]
    if (typeof data?.message === "string") return [data.message]
    return []
  }

  function toastValidationErrors(e, fallback = "Please fix highlighted errors") {
    const msgs = extractValidationMessages(e)
    if (!msgs.length) {
      toast.error(errMsg(e, fallback))
      return false
    }
    toast.error(`Validation failed (${msgs.length})`)
    msgs.slice(0, 6).forEach((m) => toast.error(m))
    if (msgs.length > 6) toast.error(`+ ${msgs.length - 6} more…`)
    return true
  }

  // ✅ FIX: Unlinked visits should NOT require encounter_type/encounter_id
  function validateDraftPayload(payload) {
    const missing = []
    const bad = []

    if (!payload.patient_id) missing.push("Patient")
    if (!payload.dept_code) missing.push("Department")
    if (!payload.record_type_code) missing.push("Record Type")

    // encounter optional (visit can be UNLINKED)
    const hasEncounter = !!payload.encounter_type && payload.encounter_id !== null && payload.encounter_id !== undefined && String(payload.encounter_id).trim() !== ""
    if (payload.encounter_type || payload.encounter_id) {
      // if one provided, ensure both consistent
      if (!hasEncounter) bad.push("Encounter (type + id must be both valid)")
    }

    if (!payload.title || String(payload.title).trim().length < 3) bad.push("Title (min 3 chars)")

    if (missing.length) return `Missing: ${missing.join(", ")}`
    if (bad.length) return `Invalid: ${bad.join(", ")}`
    return null
  }

  async function saveDraft() {
    if (!canNext() && !isEdit) return toast.error("Fill required fields before saving")
    if (!patientEff?.id && !isEdit) return toast.error("Patient not selected")

    setSaving(true)
    try {
      if (isEdit) {
        const rid = asMaybeInt(editingId)
        if (!rid) return toast.error("Missing record id for edit")
        const payload = buildUpdatePayload({ draft_stage: "INCOMPLETE" })
        console.log(payload, "buildUpdatePayload");

        if (!payload.title || payload.title.trim().length < 3) return toast.error("Title min 3 chars")
        const updated = await apiUpdateDraft(rid, payload)
        toast.success("Draft updated")
        onUpdated?.({ ...updated, record_id: rid })
        onSaved?.({ ...updated, record_id: rid })
      } else {
        const payload = buildDraftPayload({ draft_stage: "INCOMPLETE" })
        console.log(payload, "buildDraftPayload");

        const created = await apiCreateDraft(payload)
        toast.success("Draft saved")
        onSaved?.(created)
      }
    } catch (e) {
      if (e?.response?.status === 422) {
        const shown = toastValidationErrors(e)
        if (shown) return
      }
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  async function saveAndSign() {
    if (!canNext() && !isEdit) return toast.error("Fill required fields before signing")
    if (!patientEff?.id && !isEdit) return toast.error("Patient not selected")

    setSaving(true)
    try {
      if (isEdit) {
        const rid = asMaybeInt(editingId)
        if (!rid) return toast.error("Missing record id for edit")
        const payload = buildUpdatePayload({ draft_stage: "READY" })
        if (!payload.title || payload.title.trim().length < 3) {
          toast.error("Title min 3 chars")
          return
        }
        console.log(payload, "buildUpdatePayload 344");

        await apiUpdateDraft(rid, payload)
        await apiSignRecord(rid, "")

        toast.success("Updated & Signed")
        onUpdated?.({ record_id: rid, updated: true, signed: true })
        onSaved?.({ record_id: rid, updated: true, signed: true })
        resetAll()
        onClose?.()
      } else {
        const payload = buildDraftPayload({ draft_stage: "READY" })
        const vErr = validateDraftPayload(payload)
        if (vErr) {
          toast.error(vErr)
          return
        }
        console.log(payload, "buildDraftPayload765655");

        const created = await apiCreateDraft(payload)
        const recordId2 = created?.record_id ?? created?.id ?? created?.record?.id ?? created?.data?.record_id ?? null
        if (!recordId2) {
          toast.error("Draft created, but record_id missing from response")
          return
        }

        await apiSignRecord(recordId2, "")
        toast.success("Saved & Signed")
        onSaved?.({ ...created, record_id: recordId2, signed: true })
        resetAll()
        onClose?.()
      }
    } catch (e) {
      if (e?.response?.status === 422) {
        const shown = toastValidationErrors(e)
        if (shown) return
      }
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  function startPrint() {
    setPrintOpen(false)
    setPrintMode(true)
    setTimeout(() => {
      try {
        window.print?.()
      } catch {
        /* noop */
      }
    }, 80)
  }

  function addFakeAttachment() {
    const n = attachments.length + 1
    setAttachments((a) => [...a, { name: `Attachment_${n}.pdf` }])
  }

  const leftSummary = (
    <SelectionSummary
      patient={patientEff}
      visit={visit}
      recordType={recordType}
      dept={dept}
      template={template}
      confidential={confidential}
    />
  )

  // -------------------- Render --------------------
  return (
    <div className="min-h-full w-full bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60">
      {/* Print CSS: only print our print root */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #emr-print-root, #emr-print-root * { visibility: visible !important; }
          #emr-print-root { position: fixed !important; inset: 0 !important; overflow: visible !important; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm; }
        }
      `}</style>

      {/* Print Preview Dialog (FIX: moved from PatientMiniCard into parent) */}
      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        tone={tone}
        title={title}
        dept={dept}
        recordType={recordType}
        template={template}
        patient={patientEff}
        visit={visit}
        schema={sectionsBlueprint}
        data={sectionData}
        includeHidden={printIncludeHidden}
        setIncludeHidden={setPrintIncludeHidden}
        onPrint={startPrint}
      />

      {/* Print-only overlay */}
      <PrintOverlay
        open={printMode}
        onClose={() => setPrintMode(false)}
        tone={tone}
        patient={patientEff}
        visit={visit}
        dept={dept}
        recordType={recordType}
        template={template}
        title={title}
        note={note}
        schema={sectionsBlueprint}
        data={sectionData}
        includeHidden={printIncludeHidden}
      />

      <div
        className={cn(
          "mx-auto w-full max-w-[1400px]",
          "grid grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[360px_1fr]",
          fullscreen ? "pb-6" : ""
        )}
      >
        {/* Left */}
        <div className="space-y-4">
          <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create Record</CardTitle>
              <div className="text-xs text-slate-500">Meta + Templates loaded from API · safe error handling</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <PatientMiniCard patient={patientEff} loading={patientLoading} onOpenPrint={() => setPrintOpen(true)} />

              <Stepper step={step} setStep={setStep} isEdit={isEdit} />

              {metaLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                  Loading departments & record types…
                </div>
              ) : metaErr ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Meta load warning: {metaErr}
                </div>
              ) : null}

              {isEdit && editLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                  Loading record…
                </div>
              ) : isEdit && editErr ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                  {editErr}
                </div>
              ) : null}

              <Separator />
              {leftSummary}
              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-2xl" onClick={resetAll}>
                  <X className="mr-2 h-4 w-4" /> Reset
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    toast("Templates: /emr/templates · Draft: /emr/records/draft · Encounters: /emr/patients/{id}/encounters")
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> API
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="hidden lg:block">
            <Card className="rounded-3xl border-slate-200 bg-white/80 shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Live Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniPreview
                  deptCode={dept?.code}
                  deptName={dept?.name}
                  recordType={recordType}
                  template={template}
                  title={title}
                  note={note}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right */}
        <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
          <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">{STEPS[step].title}</CardTitle>
                <div className="text-xs text-slate-500">{STEPS[step].desc}</div>
              </div>

              <div className="flex items-center gap-2">
                {step > 0 ? (
                  <Button variant="outline" className="rounded-2xl" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                ) : (
                  <Button variant="outline" className="rounded-2xl" onClick={() => onClose?.()}>
                    <X className="mr-2 h-4 w-4" /> Close
                  </Button>
                )}

                {step < 3 ? (
                  <Button className={cn("rounded-2xl", tone.btn)} onClick={next} disabled={!canNext()}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      type="button"
                      onClick={() => setPrintOpen(true)}
                      disabled={!template || saving}
                    >
                      <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>

                    <Button variant="outline" className="rounded-2xl" onClick={saveDraft} disabled={!canNext() || saving}>
                      <PenLine className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save Draft"}
                    </Button>
                    <Button className={cn("rounded-2xl", tone.btn)} onClick={saveAndSign} disabled={!canNext() || saving}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save & Sign"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <AnimatePresence mode="wait">
              {/* Step 0 - Visit */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-xs text-slate-600">
                      Pick an encounter for linking (optional). Default: Unlinked / General.
                    </div>

                    <div className="flex w-full gap-2 md:w-[380px]">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input
                          value={visitQ}
                          onChange={(e) => setVisitQ(e.target.value)}
                          placeholder="Search visits (OP/IP/Dept/Doctor)…"
                          className="h-10 rounded-2xl pl-9"
                        />
                      </div>

                      <Button
                        variant="outline"
                        className="h-10 rounded-2xl"
                        onClick={async () => {
                          const pid = asMaybeInt(patientEff?.id)
                          if (!pid) return toast.error("Patient not selected")
                          setVisitsLoading(true)
                          try {
                            const items = await fetchVisitsAuto(pid)
                            const unlinked = {
                              id: "UNLINKED",
                              encounter_type: "",
                              encounter_id: "",
                              dept_code: dept?.code || defaultDeptCode || "COMMON",
                              dept_name: dept?.name || "Common (All)",
                              doctor: "—",
                              when: new Date().toISOString(),
                              status: "Unlinked / General",
                            }
                            setVisits([unlinked, ...items])
                            setVisit((v) => v || unlinked)
                          } catch (e) {
                            toast.error(errMsg(e))
                          } finally {
                            setVisitsLoading(false)
                          }
                        }}
                        disabled={visitsLoading}
                      >
                        <RefreshCcw className={cn("mr-2 h-4 w-4", visitsLoading ? "animate-spin" : "")} />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {visitsLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-700">
                      Loading visits…
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {filteredVisits.map((v) => (
                        <VisitCard key={v.id} visit={v} active={visit?.id === v.id} onClick={() => setVisit(v)} />
                      ))}
                    </div>
                  )}

                  {!filteredVisits.length && !visitsLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                      <div className="text-sm font-semibold text-slate-800">No visits found</div>
                      <div className="mt-1 text-xs text-slate-500">Try clearing search or keep Unlinked.</div>
                    </div>
                  ) : null}
                </motion.div>
              )}

              {/* Step 1 - Record type */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-xl", tone.chip)}>
                      <Building2 className="mr-1 h-3.5 w-3.5" />
                      {dept?.name || "—"}
                    </Badge>

                    {visit?.encounter_type ? (
                      <Badge variant="outline" className="rounded-xl">
                        <Layers className="mr-1 h-3.5 w-3.5" />
                        {visit.encounter_type} · {visit.encounter_id || "—"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-xl">
                        <Layers className="mr-1 h-3.5 w-3.5" />
                        Unlinked
                      </Badge>
                    )}

                    <Badge variant="outline" className="rounded-xl">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Record types from API
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {(recordTypes || []).map((rt) => (
                      <RecordTypeCard key={rt.code} type={rt} active={recordType?.code === rt.code} tone={tone} onClick={() => setRecordType(rt)} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2 - Template */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-3xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold text-slate-700">Department</div>
                        <select
                          value={dept?.code || ""}
                          onChange={(e) => {
                            const code = e.target.value
                            const found = departments.find((d) => d.code === code) || null
                            setDept(found)
                            setTemplate(null)
                          }}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                        >
                          {(departments || []).map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.name}
                            </option>
                          ))}
                        </select>

                        <div className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-3">
                          <div className="text-xs font-semibold text-slate-700">Template Status</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {["PUBLISHED", "DRAFT", "ARCHIVED"].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setTplStatus(s)}
                                className={cn(
                                  "rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition",
                                  tplStatus === s
                                    ? "bg-slate-900 text-white ring-slate-900"
                                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Backend filters templates by dept_code + record_type_code.
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input value={tplQ} onChange={(e) => setTplQ(e.target.value)} placeholder="Search templates…" className="h-10 rounded-2xl pl-9" />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className={cn("rounded-xl", tone.chip)}>
                          <Building2 className="mr-1 h-3.5 w-3.5" />
                          {dept?.name || "—"}
                        </Badge>
                        {recordType ? (
                          <Badge variant="outline" className="rounded-xl">
                            <ClipboardList className="mr-1 h-3.5 w-3.5" />
                            {recordType.label}
                          </Badge>
                        ) : null}
                      </div>

                      {tplErr ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{tplErr}</div> : null}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Suggested</div>
                            <div className="text-xs text-slate-500">{tplLoading ? "Loading…" : `${templatesResp?.total || 0} template(s)`}</div>
                          </div>
                          <Badge variant="outline" className="rounded-xl">
                            {tplStatus}
                          </Badge>
                        </div>

                        {tplLoading ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-700">
                            Loading templates…
                          </div>
                        ) : suggested.length ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {suggested.map((t) => (
                              <TemplateCard key={t.id} tpl={t} active={template?.id === t.id} onClick={() => setTemplate(t)} tone={tone} />
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                            <div className="text-sm font-semibold text-slate-800">No templates found</div>
                            <div className="mt-1 text-xs text-slate-500">Try changing dept/status or clear search.</div>
                          </div>
                        )}
                      </div>

                      {templates.length > 10 ? (
                        <div className="rounded-3xl border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">All Matching Templates</div>
                              <div className="text-xs text-slate-500">{templates.length} template(s)</div>
                            </div>
                            <Badge variant="outline" className="rounded-xl">
                              Browse
                            </Badge>
                          </div>

                          <div className="max-h-[340px] overflow-auto pr-1">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {templates.map((t) => (
                                <TemplateCard key={t.id} tpl={t} active={template?.id === t.id} onClick={() => setTemplate(t)} tone={tone} />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3 - Review */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Clinical Form</div>
                            <div className="text-xs text-slate-500">Fields are generated from template sections</div>
                          </div>

                          <Badge variant="outline" className="rounded-xl">
                            {calcFilledCount(sectionsBlueprint, sectionData).filled}/{calcFilledCount(sectionsBlueprint, sectionData).total} filled
                          </Badge>
                        </div>

                        {missingRequired.length ? (
                          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4" />
                            <div className="min-w-0">
                              <div className="font-semibold">Missing required fields</div>
                              <div className="mt-1 line-clamp-2">
                                {missingRequired
                                  .slice(0, 3)
                                  .map((x) => `${x.sectionTitle}: ${x.fieldLabel}`)
                                  .join(" · ")}
                                {missingRequired.length > 3 ? ` · +${missingRequired.length - 3} more` : ""}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <Separator className="my-4" />

                        <TemplateSectionsEditor tone={tone} schema={sectionsBlueprint} value={sectionData} onChange={setSectionData} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Card className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
                        <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Preview</CardTitle>
                          <div className="text-xs text-slate-500">Template sections & snapshot</div>
                        </CardHeader>
                        <CardContent>
                          <MiniPreview
                            deptCode={dept?.code}
                            deptName={dept?.name}
                            recordType={recordType}
                            template={template}
                            title={title}
                            note={note}
                          />
                        </CardContent>
                      </Card>

                      <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Attachments</CardTitle>
                          <div className="text-xs text-slate-500">UI only (stored inside content)</div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={addFakeAttachment}>
                              <Paperclip className="mr-2 h-4 w-4" />
                              Add Attachment
                            </Button>
                            <Badge variant="outline" className="rounded-xl">
                              {attachments.length} file(s)
                            </Badge>
                          </div>

                          {attachments.length ? (
                            <div className="space-y-2">
                              {attachments.map((a, idx) => (
                                <div
                                  key={`${a?.name || "att"}-${idx}`}
                                  className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                                >
                                  <div className="min-w-0 truncate text-sm font-medium text-slate-800">{a.name}</div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-2xl"
                                    onClick={() => setAttachments((x) => x.filter((_, i) => i !== idx))}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                              <div className="text-sm font-semibold text-slate-800">No attachments</div>
                              <div className="mt-1 text-xs text-slate-500">Upload integration can be added later.</div>
                            </div>
                          )}

                          {isMobile ? (
                            <div className="mt-3 rounded-3xl border border-slate-200 bg-white/85 p-3 shadow-sm backdrop-blur">
                              <div className="text-xs font-semibold text-slate-700">Mobile Actions</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="outline" className="rounded-2xl" onClick={saveDraft} disabled={!canNext() || saving}>
                                  <PenLine className="mr-2 h-4 w-4" /> Draft
                                </Button>
                                <Button className={cn("rounded-2xl", tone.btn)} onClick={saveAndSign} disabled={!canNext() || saving}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Sign
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                  <Sparkles className="h-5 w-5 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Workflow Tip</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Fastest: select <span className="font-medium text-slate-700">Type</span> → choose{" "}
                    <span className="font-medium text-slate-700">Template</span> → save draft. Visit linking is optional.
                  </div>
                </div>
              </div>
              {isEdit ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Editing draft:</span> Visit / Type / Template are locked. You can update Title, Note, Confidential, and Content, then Save Draft or Save & Sign.
                </div>
              ) : null}
            </div>

            {step === 3 && (title || "").trim().length < 3 ? (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Title is required (min 3 characters)
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// -------------------- Small UI pieces --------------------
function Stepper({ step, setStep, isEdit }) {
  return (
    <div className="space-y-2">
      {STEPS.map((s, idx) => {
        const active = idx === step
        const done = idx < step
        return (
          <button
            key={s.key}
            type="button"
            disabled={!!isEdit && idx < 3}
            onClick={() => {
              if (isEdit && idx < 3) return
              setStep(idx)
            }}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition",
              active ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:bg-white"
            )}
          >
            <div
              className={cn(
                "grid h-9 w-9 place-items-center rounded-2xl ring-1",
                done
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : active
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-slate-50 text-slate-700 ring-slate-200"
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-semibold">{idx + 1}</span>}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{s.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{s.desc}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function PatientMiniCard({ patient, loading, onOpenPrint }) {
  const p = patient || null
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">Patient</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">{loading ? "Loading…" : p?.name || "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Badge variant="secondary" className="rounded-xl">
              UHID: {p?.uhid || "—"}
            </Badge>
            {p?.gender ? (
              <Badge variant="outline" className="rounded-xl">
                {String(p.gender)}
              </Badge>
            ) : null}
            {p?.age !== null && p?.age !== undefined && String(p.age) !== "" ? (
              <Badge variant="outline" className="rounded-xl">
                {String(p.age)}y
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              <div className="text-[10px] text-slate-500">Phone</div>
              <div className="truncate font-semibold text-slate-900">{p?.phone || "—"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              <div className="text-[10px] text-slate-500">Blood</div>
              <div className="truncate font-semibold text-slate-900">{p?.blood || "—"}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {p?.id ? (
            <Badge className="rounded-xl bg-slate-900 text-white">#{p.id}</Badge>
          ) : (
            <Badge variant="outline" className="rounded-xl">
              —
            </Badge>
          )}
          {p?.lastVisit ? (
            <div className="text-[11px] text-slate-500">
              Last: <span className="font-semibold text-slate-700">{fmtDate(p.lastVisit)}</span>
            </div>
          ) : null}

          <Button variant="outline" className="h-9 rounded-2xl" onClick={onOpenPrint}>
            <Printer className="mr-2 h-4 w-4" /> Preview
          </Button>
        </div>
      </div>
    </div>
  )
}

function SelectionSummary({ patient, visit, recordType, dept, template, confidential }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-700">Current Selection</div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="space-y-2 text-xs text-slate-700">
          <Row label="Patient" value={patient ? `${patient.name} (${patient.uhid || "—"})` : "—"} />
          <Row label="Visit" value={visit?.encounter_type ? `${visit.encounter_type} · ${visit.encounter_code || visit.encounter_id || "—"}` : "Unlinked / General"} />
          <Row label="Department" value={dept?.name || "—"} />
          <Row label="Type" value={recordType ? recordType.label : "—"} />
          <Row label="Template" value={template ? template.name : "—"} />
          <Row label="Confidential" value={confidential ? "Yes" : "No"} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-slate-500">{label}</div>
      <div className="max-w-[70%] truncate text-right font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function VisitCard({ visit, active, onClick }) {
  const tone = deptTone(visit.dept_code || visit.dept_name)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
      <div className={cn("p-4", active ? tone.glow : "")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("rounded-xl", tone.chip)}>
                <Building2 className="mr-1 h-3.5 w-3.5" />
                {visit.dept_name || visit.dept_code || "—"}
              </Badge>

              <Badge variant="outline" className="rounded-xl">
                <Layers className="mr-1 h-3.5 w-3.5" />
                {visit.encounter_type ? `${visit.encounter_type} · ${visit.encounter_code || visit.encounter_id || "—"}` : "Unlinked"}
              </Badge>
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-900">{visit.status || "—"}</div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {fmtDate(visit.when)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" /> {fmtTime(visit.when)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="h-3.5 w-3.5" /> {visit.doctor || "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge className={cn("rounded-xl", active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700")}>
              {active ? "Selected" : "Select"}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  )
}

function RecordTypeCard({ type, active, tone, onClick }) {
  const Icon = recordIcon(type.code)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("grid h-11 w-11 place-items-center rounded-3xl ring-1 ring-slate-200", active ? "bg-slate-900 text-white ring-slate-900" : "bg-slate-50 text-slate-700")}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{type.label}</div>
            <div className="mt-1 text-xs text-slate-500">Code: {type.code}</div>
            <div className="mt-2">
              <Badge variant="outline" className="rounded-xl">
                {type.category || "Record"}
              </Badge>
            </div>
          </div>
        </div>

        {active ? (
          <Badge className={cn("rounded-xl", tone.chip)}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Selected
          </Badge>
        ) : null}
      </div>
    </button>
  )
}

function TemplateCard({ tpl, active, onClick, tone }) {
  const isPremium = !!tpl.is_premium
  const secLabels = normalizeSectionsArray(tpl.sections)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-3xl border bg-white p-3 text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{tpl.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" /> {secLabels.length} sections
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {fmtDate(tpl.updated_at)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isPremium ? (
            <Badge className="rounded-xl bg-slate-900 text-white">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-xl">
              Standard
            </Badge>
          )}
          {active ? (
            <Badge className={cn("rounded-xl", tone.chip)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Picked
            </Badge>
          ) : null}
        </div>
      </div>

      {secLabels.length ? <div className="mt-3 line-clamp-2 text-xs text-slate-600">{secLabels.join(" · ")}</div> : null}
    </button>
  )
}

function MiniPreview({ deptCode, deptName, recordType, template, title, note }) {
  const tone = deptTone(deptCode)
  const secLabels = normalizeSectionsArray(template?.sections)
  return (
    <div className={cn("rounded-3xl border border-slate-200 bg-white p-4", tone.glow)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("rounded-xl", tone.chip)}>
          <Building2 className="mr-1 h-3.5 w-3.5" />
          {deptName || deptCode || "—"}
        </Badge>

        {recordType ? (
          <Badge variant="outline" className="rounded-xl">
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            {recordType.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-xl">
            Type —
          </Badge>
        )}

        {template?.is_premium ? (
          <Badge className="rounded-xl bg-slate-900 text-white">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Premium
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 text-sm font-semibold text-slate-900">{title?.trim() ? title : "Untitled Record"}</div>
      <div className="mt-1 text-xs text-slate-500">{template ? template.name : "No template selected"}</div>

      <Separator className="my-3" />

      <div className="text-xs font-semibold text-slate-700">Sections</div>
      {secLabels.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {secLabels.slice(0, 8).map((s) => (
            <span key={s} className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {s}
            </span>
          ))}
          {secLabels.length > 8 ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              +{secLabels.length - 8} more
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-500">—</div>
      )}

      {note?.trim() ? (
        <>
          <Separator className="my-3" />
          <div className="text-xs font-semibold text-slate-700">Note</div>
          <div className="mt-1 line-clamp-3 text-xs text-slate-600">{note}</div>
        </>
      ) : null}
    </div>
  )
}
