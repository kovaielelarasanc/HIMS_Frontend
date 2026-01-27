// FILE: frontend/src/emr/EmrCreateRecordFlow.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react"
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
  RefreshCcw,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import API from "@/api/client"

/**
 * ✅ IMPORTANT FIX (422 issues):
 * For axios, DO NOT do: API.post(url, { body: payload })
 * Instead do:           API.post(url, payload)
 * Same for preview endpoints.
 */

// -------------------- helpers (API unwrap + errors) --------------------
function unwrapOk(resp) {
  const d = resp?.data
  // supports: {status:true,data:...} or plain data
  if (d && typeof d === "object" && "status" in d) {
    if (d.status) return d.data
    const msg = d?.error?.msg || d?.msg || "Request failed"
    throw new Error(msg)
  }
  return d
}

function errMsg(e) {
  const r = e?.response?.data
  if (typeof r === "string") return r
  if (r?.detail) return typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail)
  if (r?.error?.msg) return r.error.msg
  if (r?.msg) return r.msg
  return e?.message || "Something went wrong"
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

// -------------------- schema helpers (MOVED OUTSIDE: avoids remount/reset) --------------------
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

function normalizeTemplateBlueprint(template) {
  // supports:
  // 1) template.sections: ["Vitals", "HPI"]
  // 2) template.sections: [{key,title,fields:[...]}]
  // 3) template.schema.sections (optional future)
  const raw = template?.schema?.sections || template?.section_defs || template?.sections || []
  if (!Array.isArray(raw)) return []

  // string sections → default single textarea field
  if (raw.length && raw.every((x) => typeof x === "string")) {
    return raw
      .map((title, idx) => {
        const key = slugKey(title) || `section_${idx + 1}`
        return {
          key,
          title: String(title),
          description: "",
          fields: [
            {
              key: "notes",
              label: "Notes",
              type: "textarea",
              required: false,
              placeholder: `Enter ${title}…`,
              rows: 4,
            },
          ],
        }
      })
      .filter(Boolean)
  }

  // object sections
  return raw
    .map((s, idx) => {
      const title = s?.title || s?.name || s?.label || `Section ${idx + 1}`
      const key = s?.key || s?.code || slugKey(title) || `section_${idx + 1}`
      const fieldsRaw = Array.isArray(s?.fields) ? s.fields : []

      const fields =
        fieldsRaw.length > 0
          ? fieldsRaw.map((f, j) => ({
            key: f?.key || f?.code || slugKey(f?.label || `field_${j + 1}`) || `field_${j + 1}`,
            label: f?.label || f?.name || `Field ${j + 1}`,
            type: String(f?.type || "textarea").toLowerCase(),
            required: !!f?.required,
            placeholder: f?.placeholder || "",
            options: Array.isArray(f?.options) ? f.options : [],
            rows: Number(f?.rows || 4),
            min: f?.min,
            max: f?.max,
            help: f?.help || "",
            default: f?.default,
            multiple: !!f?.multiple,
          }))
          : [
            {
              key: "notes",
              label: "Notes",
              type: "textarea",
              required: false,
              placeholder: `Enter ${title}…`,
              rows: 4,
            },
          ]

      return {
        key,
        title: String(title),
        description: String(s?.description || ""),
        fields,
      }
    })
    .filter(Boolean)
}

function initDataFromBlueprint(blueprint, prev) {
  const next = { ...(prev || {}) }
  for (const sec of blueprint || []) {
    const sk = sec?.key
    if (!sk) continue
    if (!next[sk] || typeof next[sk] !== "object") next[sk] = {}
    for (const f of sec.fields || []) {
      const fk = f?.key
      if (!fk) continue
      if (next[sk][fk] === undefined) {
        if (f?.default !== undefined) next[sk][fk] = f.default
        else if (f?.type === "checkbox") next[sk][fk] = false
        else if (f?.type === "multiselect") next[sk][fk] = []
        else next[sk][fk] = ""
      }
    }
  }
  return next
}

function findMissingRequired(blueprint, data) {
  const miss = []
  for (const sec of blueprint || []) {
    const sk = sec?.key
    const secTitle = sec?.title || sk
    const secData = (data && sk && data[sk]) || {}
    for (const f of sec.fields || []) {
      if (!f?.required) continue
      const fk = f?.key
      const val = fk ? secData?.[fk] : undefined
      const empty =
        val === null ||
        val === undefined ||
        (typeof val === "string" && !val.trim()) ||
        (Array.isArray(val) && val.length === 0)
      if (empty) {
        miss.push({
          sectionKey: sk,
          sectionTitle: secTitle,
          fieldKey: fk,
          fieldLabel: f?.label || fk,
        })
      }
    }
  }
  return miss
}

function calcFilledCount(blueprint, data) {
  let total = 0
  let filled = 0
  for (const sec of blueprint || []) {
    const sk = sec?.key
    const secData = (data && sk && data[sk]) || {}
    for (const f of sec.fields || []) {
      total += 1
      const fk = f?.key
      const val = fk ? secData?.[fk] : undefined
      const isFilled =
        (typeof val === "string" && val.trim().length > 0) ||
        (typeof val === "number" && Number.isFinite(val)) ||
        typeof val === "boolean" ||
        (Array.isArray(val) && val.length > 0)
      if (isFilled) filled += 1
    }
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

  // normalize response shapes: array OR {items,total} OR {data:{items,total}}
  if (Array.isArray(data)) return { items: data, total: data.length }
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data?.items) ? data.data.items : []
  const total =
    Number.isFinite(Number(data?.total)) ? Number(data.total) : Number.isFinite(Number(data?.count)) ? Number(data.count) : items.length
  return { items, total }
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

// robust extractor for your ok() wrapper
export function pickRecordId(res) {
  return (
    res?.data?.data?.record_id ??
    res?.data?.data?.id ??
    res?.data?.record_id ??
    res?.data?.id ??
    res?.data?.record?.id ??
    null
  )
}
/**
 * ✅ Preferred encounters endpoint:
 * GET /emr/patients/{patient_id}/encounters?limit=
 */
async function apiEncounters(patientId, limit = 200) {
  const resp = await API.get(`/emr/patients/${patientId}/encounters`, { params: { limit } })
  return unwrapOk(resp)
}

// --- mappers (resilient; adapt as needed) ---
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

/**
 * ✅ Encounters auto fetch:
 * 1) /emr/patients/{id}/encounters
 */
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
export function EmrCreateRecordDialog({ open, onOpenChange, patient, defaultDeptCode, onSaved, mode = "create", recordId = null, onUpdated }) {
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

          <div className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain", "pb-[calc(96px+env(safe-area-inset-bottom))]")} style={{ WebkitOverflowScrolling: "touch" }}>
            <EmrCreateRecordFlow patient={patient} defaultDeptCode={defaultDeptCode} onClose={() => onOpenChange?.(false)} onSaved={onSaved} onUpdated={onUpdated} mode={mode} recordId={recordId} fullscreen />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// -------------------- Dynamic section editor (OUTSIDE: no state reset) --------------------
function TemplateSectionsEditor({ blueprint, value, onChange, tone }) {
  const [openKey, setOpenKey] = useState(() => (blueprint?.[0]?.key ? blueprint[0].key : null))

  useEffect(() => {
    if (blueprint?.[0]?.key) setOpenKey(blueprint[0].key)
  }, [blueprint?.[0]?.key])

  const setField = useCallback(
    (secKey, fieldKey, v) => {
      onChange?.((prev) => {
        const next = { ...(prev || {}) }
        next[secKey] = { ...(next[secKey] || {}) }
        next[secKey][fieldKey] = v
        return next
      })
    },
    [onChange]
  )

  if (!Array.isArray(blueprint) || !blueprint.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
        <div className="text-sm font-semibold text-slate-800">No sections</div>
        <div className="mt-1 text-xs text-slate-500">This template has no sections configured.</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Quick jump chips */}
      <div className="flex flex-wrap gap-2">
        {blueprint.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setOpenKey(s.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
              openKey === s.key
                ? cn("text-white ring-slate-900", tone?.btn || "bg-slate-900")
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {blueprint.map((sec) => {
          const active = openKey === sec.key
          const secData = (value && value[sec.key]) || {}
          const counts = calcFilledCount([sec], { [sec.key]: secData })

          return (
            <div key={sec.key} className={cn("rounded-3xl border bg-white", active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200")}>
              <button
                type="button"
                onClick={() => setOpenKey((k) => (k === sec.key ? null : sec.key))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{sec.title}</div>
                    <Badge variant="outline" className="rounded-xl">
                      {counts.filled}/{counts.total}
                    </Badge>
                  </div>
                  {sec.description ? <div className="mt-1 text-xs text-slate-500">{sec.description}</div> : null}
                </div>

                <div className={cn("rounded-2xl px-3 py-1 text-xs font-semibold", active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700")}>
                  {active ? "Open" : "Open"}
                </div>
              </button>

              {active ? (
                <div className="px-4 pb-4">
                  <Separator className="mb-4" />

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(sec.fields || []).map((f) => (
                      <FieldRenderer key={`${sec.key}:${f.key}`} field={f} value={secData?.[f.key]} onChange={(v) => setField(sec.key, f.key, v)} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FieldRenderer({ field, value, onChange }) {
  const t = String(field?.type || "textarea").toLowerCase()
  const label = field?.label || field?.key || "Field"
  const required = !!field?.required
  const placeholder = field?.placeholder || ""

  const Head = (
    <div className="mb-1 flex items-center gap-2">
      <div className="text-xs font-semibold text-slate-700">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </div>
      {field?.help ? <span className="text-xs text-slate-400">• {field.help}</span> : null}
    </div>
  )

  if (t === "text") {
    return (
      <div>
        {Head}
        <Input value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} className="h-10 rounded-2xl" />
      </div>
    )
  }

  if (t === "number") {
    return (
      <div>
        {Head}
        <Input
          type="number"
          value={value ?? ""}
          min={field?.min}
          max={field?.max}
          onChange={(e) => onChange?.(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={placeholder}
          className="h-10 rounded-2xl"
        />
      </div>
    )
  }

  if (t === "date") {
    return (
      <div>
        {Head}
        <Input type="date" value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className="h-10 rounded-2xl" />
      </div>
    )
  }

  if (t === "time") {
    return (
      <div>
        {Head}
        <Input type="time" value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className="h-10 rounded-2xl" />
      </div>
    )
  }

  if (t === "checkbox") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {label} {required ? <span className="text-rose-600">*</span> : null}
          </div>
          {field?.help ? <div className="mt-0.5 text-xs text-slate-500">{field.help}</div> : null}
        </div>

        <button
          type="button"
          onClick={() => onChange?.(!value)}
          className={cn(
            "h-9 rounded-2xl px-3 text-xs font-semibold ring-1 transition",
            value ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
          )}
        >
          {value ? "Yes" : "No"}
        </button>
      </div>
    )
  }

  if (t === "select") {
    const opts = Array.isArray(field?.options) ? field.options : []
    return (
      <div>
        {Head}
        <select
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
        >
          <option value="">Select…</option>
          {opts.map((o, idx) => {
            const val = typeof o === "string" ? o : o?.value
            const lab = typeof o === "string" ? o : o?.label || o?.value
            return (
              <option key={`${val}-${idx}`} value={val}>
                {lab}
              </option>
            )
          })}
        </select>
      </div>
    )
  }

  if (t === "multiselect") {
    const opts = Array.isArray(field?.options) ? field.options : []
    const arr = Array.isArray(value) ? value : []
    return (
      <div>
        {Head}
        <select
          multiple
          value={arr}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((x) => x.value)
            onChange?.(selected)
          }}
          className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
        >
          {opts.map((o, idx) => {
            const val = typeof o === "string" ? o : o?.value
            const lab = typeof o === "string" ? o : o?.label || o?.value
            return (
              <option key={`${val}-${idx}`} value={val}>
                {lab}
              </option>
            )
          })}
        </select>
        <div className="mt-1 text-xs text-slate-500">Hold Ctrl/⌘ to select multiple</div>
      </div>
    )
  }

  // default textarea
  return (
    <div className="md:col-span-2">
      {Head}
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        rows={Number(field?.rows || 4)}
        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-300"
        placeholder={placeholder || "Type here…"}
      />
    </div>
  )
}

// -------------------- Main flow --------------------
export default function EmrCreateRecordFlow({ patient, defaultDeptCode, onClose, onSaved, onUpdated, mode = "create", recordId = null, fullscreen = false }) {
  const isMobile = useIsMobile(1024)
  const p = useMemo(() => normalizePatient(patient), [patient])

  const [step, setStep] = useState(0)

  // meta
  const [metaLoading, setMetaLoading] = useState(true)
  const [departments, setDepartments] = useState([]) // [{code,name}]
  const [recordTypes, setRecordTypes] = useState([]) // [{code,label,category}]
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

  // ✅ section form data
  const [sectionData, setSectionData] = useState({})


  // -------------------- edit mode --------------------
  const isEdit = String(mode || "create").toLowerCase() === "edit"
  const [editingId, setEditingId] = useState(asMaybeInt(recordId))
  const [editLoading, setEditLoading] = useState(false)
  const [editErr, setEditErr] = useState("")


  const deptCode = dept?.code || defaultDeptCode || "COMMON"
  const tone = deptTone(deptCode)

  const sectionsBlueprint = useMemo(() => normalizeTemplateBlueprint(template), [template?.id, template?.updated_at])

  useEffect(() => {
    if (!template?.id) {
      setSectionData({})
      return
    }
    setSectionData((prev) => initDataFromBlueprint(sectionsBlueprint, prev))
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

          // fallback
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

  // load record when editing (after meta is ready)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        if (!isEdit) return
        const rid = asMaybeInt(editingId)
        if (!rid) return

        // wait for meta to load so we can map dept/recordType
        if (metaLoading) return

        setEditLoading(true)
        setEditErr("")
        try {
          const res = await apiRecordGet(rid)
          const rec = res?.record || res?.data?.record || res?.data || null
          if (!mounted || !rec) return

          // lock the context (backend update allows only draft fields)
          // we still *display* the same flow, but disable context controls.
          setTitle(String(rec.title || ""))
          setNote(rec.note || "")
          setConfidential(!!rec.confidential)

          // dept + record type
          const d0 =
            departments.find((d) => String(d.code).toUpperCase() === String(rec.dept_code || "").toUpperCase()) ||
            departments.find((d) => String(d.code).toUpperCase() === "COMMON") ||
            departments[0] ||
            null
          if (d0) setDept(d0)

          const rt0 =
            recordTypes.find((t) => String(t.code).toUpperCase() === String(rec.record_type_code || "").toUpperCase()) || null
          if (rt0) setRecordType(rt0)

          // visit context (best-effort)
          const encType = String(rec.encounter_type || "")
          const encId = rec.encounter_id
          if (encType && encId != null) {
            const match = (visits || []).find(
              (v) => String(v.encounter_type || "") === encType && String(v.encounter_id ?? "") === String(encId ?? "")
            )
            if (match) setVisit(match)
          }

          // template + sections (record_get provides template_sections as string[])
          const tSections = Array.isArray(rec.template_sections) ? rec.template_sections : []
          setTemplate(
            rec.template_id
              ? {
                id: rec.template_id,
                name: rec.title ? `Template #${rec.template_id}` : `Template #${rec.template_id}`,
                sections: tSections,
              }
              : tSections.length
                ? { id: null, name: "Template", sections: tSections }
                : null
          )

          // content
          const content = rec.content || {}
          const data = content?.data && typeof content.data === "object" ? content.data : {}
          setSectionData((prev) => ({ ...(prev || {}), ...(data || {}) }))

          // jump to review so it feels like "Edit record" (but user can still go back)
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

  // load visits when patient changes
  useEffect(() => {
    let mounted = true
      ; (async () => {
        if (!p?.id) {
          setVisits([])
          setVisit(null)
          return
        }

        setVisitsLoading(true)
        try {
          const items = await fetchVisitsAuto(p?.id)
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
  }, [p?.id])

  // if visit has dept_code, sync dept (nice UX)
  useEffect(() => {
    if (!visit?.dept_code || !departments.length) return
    const code = String(visit.dept_code || "").toUpperCase()
    const found = departments.find((d) => String(d.code).toUpperCase() === code)
    if (found) setDept(found)
  }, [visit?.dept_code, departments])

  // auto title from template + record type label
  useEffect(() => {
    if (!template) return
    const rt = recordType?.label ? ` · ${recordType.label}` : ""
    setTitle(`${template.name || "Template"}${rt}`)
  }, [template?.id, recordType?.code]) // ✅ fixed deps

  // fetch templates when dept/type/q changes (only on template/review)
  useEffect(() => {
    const shouldLoad = step >= 2 && !!dept?.code && !!recordType?.code
    if (!shouldLoad) return

    let mounted = true
    const t = setTimeout(async () => {
      setTplLoading(true)
      setTplErr("")
      try {
        // ✅ FIX: send dept_code, not dept
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
      patient_id: asMaybeInt(p?.id),
      dept_code: dept?.code || "COMMON",
      record_type_code: recordType?.code || null,

      encounter_type,
      encounter_id,

      template_id: asMaybeInt(template?.id),
      title: (title || "").trim(),
      note: (note || "").trim(),
      confidential: !!confidential,

      // ✅ backend expects JSON object (not string)
      content: {
        template: {
          id: template?.id ?? null,
          name: template?.name ?? null,
          sections: Array.isArray(template?.sections) ? template.sections : [],
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
          sections: Array.isArray(template?.sections) ? template.sections : [],
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

  // Convert ("body","encounter_id") -> "encounter_id"
  function locToField(loc) {
    if (!Array.isArray(loc)) return "field"
    const last = loc[loc.length - 1]
    return String(last || "field")
  }

  // Human labels (optional)
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

  // Extract 422 validation messages from your backend format
  function extractValidationMessages(e) {
    const data = pickApiErrorPayload(e)
    const details = data?.error?.details || data?.details || data?.error?.detail || data?.detail || null

    // FastAPI default: {"detail":[{loc,msg,type}]}
    if (Array.isArray(details)) {
      return details.map((d) => {
        const field = FIELD_LABEL[locToField(d.loc)] || locToField(d.loc)
        const msg = d.msg || "Invalid value"
        return `${field}: ${msg}`
      })
    }

    // Sometimes backend returns {"detail": "message"}
    if (typeof data?.detail === "string") return [data.detail]
    if (typeof data?.msg === "string") return [data.msg]
    if (typeof data?.message === "string") return [data.message]

    return []
  }

  // Show field-by-field toast for validation errors
  function toastValidationErrors(e, fallback = "Please fix highlighted errors") {
    const msgs = extractValidationMessages(e)
    if (!msgs.length) {
      toast.error(errMsg(e, fallback))
      return false
    }

    // First toast summary
    toast.error(`Validation failed (${msgs.length})`)

    // Then show each message (limit to avoid spam)
    msgs.slice(0, 6).forEach((m) => toast.error(m))
    if (msgs.length > 6) toast.error(`+ ${msgs.length - 6} more…`)

    return true
  }

  function validateDraftPayload(payload) {
    console.log(payload, "123456789");

    const missing = []
    const bad = []

    if (!payload.patient_id) missing.push("Patient")
    if (!payload.encounter_type) missing.push("Encounter Type")
    if (!payload.encounter_id || !String(payload.encounter_id).trim()) missing.push("Encounter ID")
    if (!payload.dept_code) missing.push("Department")
    if (!payload.record_type_code) missing.push("Record Type")
    if (!payload.title || String(payload.title).trim().length < 3) bad.push("Title (min 3 chars)")

    if (missing.length) return `Missing: ${missing.join(", ")}`
    if (bad.length) return `Invalid: ${bad.join(", ")}`
    return null
  }


  async function saveDraft() {
    if (!canNext() && !isEdit) return toast.error("Fill required fields before saving")
    if (!p?.id && !isEdit) return toast.error("Patient not selected")

    setSaving(true)
    try {
      if (isEdit) {
        const rid = asMaybeInt(editingId)
        if (!rid) return toast.error("Missing record id for edit")
        const payload = buildUpdatePayload({ draft_stage: "INCOMPLETE" })
        if (!payload.title || payload.title.trim().length < 3) return toast.error("Title min 3 chars")
        const updated = await apiUpdateDraft(rid, payload)
        toast.success("Draft updated")
        onUpdated?.({ ...updated, record_id: rid })
        onSaved?.({ ...updated, record_id: rid }) // backward compat
      } else {
        const payload = buildDraftPayload({ draft_stage: "INCOMPLETE" })
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
    if (!p?.id && !isEdit) return toast.error("Patient not selected")

    setSaving(true)
    try {
      if (isEdit) {
        const rid = asMaybeInt(editingId)
        if (!rid) return toast.error("Missing record id for edit")
        const payload = buildUpdatePayload({ draft_stage: "READY" })

        // basic pre-validation
        if (!payload.title || payload.title.trim().length < 3) {
          toast.error("Title min 3 chars")
          return
        }

        await apiUpdateDraft(rid, payload)

        // optional: sign after update
        await apiSignRecord(rid, "")

        toast.success("Updated & Signed")
        onUpdated?.({ record_id: rid, updated: true, signed: true })
        onSaved?.({ record_id: rid, updated: true, signed: true })
        resetAll()
        onClose?.()
      } else {
        const payload = buildDraftPayload({ draft_stage: "READY" })

        // ✅ Pre-validation (frontend)
        const vErr = validateDraftPayload(payload)
        if (vErr) {
          toast.error(vErr)
          return
        }

        const created = await apiCreateDraft(payload)

        // ✅ Fix: backend returns record_id (NOT id)
        const recordId =
          created?.record_id ??
          created?.id ??
          created?.record?.id ??
          created?.data?.record_id ??
          null

        if (!recordId) {
          toast.error("Draft created, but record_id missing from response")
          return
        }

        await apiSignRecord(recordId, "")

        toast.success("Saved & Signed")
        onSaved?.({ ...created, record_id: recordId, signed: true })
        resetAll()
        onClose?.()
      }
    } catch (e) {
      // ✅ If backend validation fails (422), show field errors
      if (e?.response?.status === 422) {
        const shown = toastValidationErrors(e)
        if (shown) return
      }

      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }


function addFakeAttachment() {
    const n = attachments.length + 1
    setAttachments((a) => [...a, { name: `Attachment_${n}.pdf` }])
  }

  const leftSummary = (
    <SelectionSummary patient={p} visit={visit} recordType={recordType} dept={dept} template={template} confidential={confidential} />
  )

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60">
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
              <Stepper step={step} setStep={setStep} isEdit={isEdit} />

              {metaLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">Loading departments & record types…</div>
              ) : metaErr ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Meta load warning: {metaErr}</div>
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
                <MiniPreview deptCode={dept?.code} deptName={dept?.name} recordType={recordType} template={template} title={title} note={note} />
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
                    <div className="text-xs text-slate-600">Pick an encounter for linking (optional). Default: Unlinked / General.</div>

                    <div className="flex w-full gap-2 md:w-[380px]">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input value={visitQ} onChange={(e) => setVisitQ(e.target.value)} placeholder="Search visits (OP/IP/Dept/Doctor)…" className="h-10 rounded-2xl pl-9" />
                      </div>

                      <Button
                        variant="outline"
                        className="h-10 rounded-2xl"
                        onClick={async () => {
                          if (!p?.id) return toast.error("Patient not selected")
                          setVisitsLoading(true)
                          try {
                            const items = await fetchVisitsAuto(p?.id)
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
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-700">Loading visits…</div>
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
                                  tplStatus === s ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">Backend filters templates by dept_code + record_type_code.</div>
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
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-700">Loading templates…</div>
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
                      {/* Template Sections Form */}
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

                        <TemplateSectionsEditor tone={tone} blueprint={sectionsBlueprint} value={sectionData} onChange={setSectionData} />
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
                          <MiniPreview deptCode={dept?.code} deptName={dept?.name} recordType={recordType} template={template} title={title} note={note} />
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
                                <div key={idx} className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                                  <div className="min-w-0 truncate text-sm font-medium text-slate-800">{a.name}</div>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" onClick={() => setAttachments((x) => x.filter((_, i) => i !== idx))}>
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
            onClick={() => { if (isEdit && idx < 3) return; setStep(idx) }}
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
            <Badge className={cn("rounded-xl", active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700")}>{active ? "Selected" : "Select"}</Badge>
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
