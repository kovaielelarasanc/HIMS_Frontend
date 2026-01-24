// FILE: frontend/src/emr/EmrTemplateLibrary.jsx
import React, { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Search,
  Filter,
  X,
  Building2,
  ClipboardList,
  Sparkles,
  FileText,
  Globe,
  EyeOff,
  History,
  Copy,
  Pencil,
  Trash2,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ✅ FIX: correct relative path (EmrTemplateLibrary is in /emr)
import TemplateEditorDialog from "../templates/TemplateEditorDialog"

import {
  apiListTemplates,
  apiCreateTemplate,
  apiCreateTemplateVersion,
  apiGetTemplate,
  apiPublishTemplate,
} from "@/api/emrTemplates"

// -------------------------------
// Constants / Helpers
// -------------------------------
const FALLBACK_DEPARTMENTS = [
  "COMMON",
  "ANAESTHESIOLOGY",
  "CARDIOLOGY",
  "DERMATOLOGY",
  "ENT",
  "GENERAL_MEDICINE",
  "GENERAL_SURGERY",
  "ICU",
  "NEUROLOGY",
  "OBGYN",
  "ORTHOPEDICS",
  "PAEDIATRICS",
  "PATHOLOGY_LAB",
  "PSYCHIATRY",
  "UROLOGY",
]

const FALLBACK_RECORD_TYPES = [
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
const DEFAULT_PAGE_SIZE = 20

const LS_SAVED_SEARCHES_KEY = "emr_template_library_saved_searches_v1"

const DEFAULT_FILTERS = Object.freeze({
  q: "",
  dept: "ALL",
  type: "ALL",
  status: "ALL",
  onlyPremium: false,
  sort: "UPDATED_AT", // UPDATED_AT | NAME | DEPT | TYPE | VERSION
  dir: "DESC", // ASC | DESC
})

function makeId() {
  try {
    return globalThis?.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`
  }
}

function loadSavedSearches() {
  try {
    if (typeof window === "undefined") return []
    const raw = window.localStorage.getItem(LS_SAVED_SEARCHES_KEY)
    const arr = raw ? JSON.parse(raw) : []
    const safe = Array.isArray(arr) ? arr : []
    return safe
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: String(x.id || ""),
        name: String(x.name || ""),
        created_at: x.created_at || null,
        filters: x.filters && typeof x.filters === "object" ? x.filters : {},
      }))
      .filter((x) => x.id && x.name)
      .slice(0, 50)
  } catch {
    return []
  }
}

function persistSavedSearches(arr) {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(LS_SAVED_SEARCHES_KEY, JSON.stringify(arr.slice(0, 50)))
  } catch {
    // ignore storage failures
  }
}

function upper(v) {
  return String(v ?? "").toUpperCase()
}
function safeStr(v) {
  return v == null ? "" : String(v)
}
function safeTrim(v) {
  return String(v ?? "").trim()
}
function fmtDate(d) {
  try {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  } catch {
    return String(d || "")
  }
}
function prettyJson(v) {
  try {
    if (v == null) return "{\n}"
    if (typeof v === "string") return v
    return JSON.stringify(v, null, 2)
  } catch {
    return safeStr(v)
  }
}

/** Convert schema string -> object (for backend) */
function parseSchemaJson(schemaText) {
  if (schemaText == null) return {}
  if (typeof schemaText === "object") return schemaText
  const raw = String(schemaText || "").trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

function sectionLabel(x) {
  if (!x) return ""
  if (typeof x === "string") return x.trim()
  if (typeof x === "object") {
    return safeTrim(x.title ?? x.label ?? x.name ?? x.key ?? x.code ?? x.value ?? "")
  }
  return safeTrim(String(x))
}

function normalizeSections(v) {
  if (Array.isArray(v)) return v.map(sectionLabel).filter(Boolean)
  if (typeof v === "string") {
    return v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return []
}

function apiErrorMessage(err, fallback = "Something went wrong") {
  if (err?.message) return String(err.message)
  const msg =
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.response?.data?.error?.msg ||
    err?.response?.data?.error ||
    fallback
  if (Array.isArray(msg)) return msg.join(", ")
  if (typeof msg === "object") return JSON.stringify(msg)
  return String(msg)
}

/**
 * ✅ Medical-professional tones (subtle, clinical)
 */
function deptTone(deptRaw) {
  const d = (deptRaw || "").toUpperCase()
  const map = {
    OBGYN: {
      bar: "from-fuchsia-600/55 via-rose-500/25 to-white",
      chip: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
      glow: "shadow-[0_22px_70px_-45px_rgba(244,63,94,0.35)]",
      btn: "bg-rose-600 hover:bg-rose-700",
      dot: "bg-rose-500",
    },
    CARDIOLOGY: {
      bar: "from-red-600/55 via-amber-500/20 to-white",
      chip: "bg-red-50 text-red-800 ring-1 ring-red-200",
      glow: "shadow-[0_22px_70px_-45px_rgba(239,68,68,0.30)]",
      btn: "bg-red-600 hover:bg-red-700",
      dot: "bg-red-500",
    },
    ICU: {
      bar: "from-indigo-700/55 via-sky-500/20 to-white",
      chip: "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200",
      glow: "shadow-[0_22px_70px_-45px_rgba(99,102,241,0.30)]",
      btn: "bg-indigo-700 hover:bg-indigo-800",
      dot: "bg-indigo-500",
    },
    ORTHOPEDICS: {
      bar: "from-emerald-700/55 via-teal-500/20 to-white",
      chip: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
      glow: "shadow-[0_22px_70px_-45px_rgba(16,185,129,0.30)]",
      btn: "bg-emerald-700 hover:bg-emerald-800",
      dot: "bg-emerald-500",
    },
    PATHOLOGY_LAB: {
      bar: "from-amber-700/55 via-yellow-500/20 to-white",
      chip: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
      glow: "shadow-[0_22px_70px_-45px_rgba(245,158,11,0.30)]",
      btn: "bg-amber-700 hover:bg-amber-800",
      dot: "bg-amber-500",
    },
    GENERAL_MEDICINE: {
      bar: "from-sky-700/55 via-cyan-500/18 to-white",
      chip: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
      glow: "shadow-[0_22px_70px_-45px_rgba(14,165,233,0.25)]",
      btn: "bg-sky-700 hover:bg-sky-800",
      dot: "bg-sky-500",
    },
  }
  return (
    map[d] || {
      bar: "from-slate-700/45 via-slate-400/18 to-white",
      chip: "bg-slate-50 text-slate-800 ring-1 ring-slate-200",
      glow: "shadow-[0_22px_70px_-45px_rgba(100,116,139,0.22)]",
      btn: "bg-slate-900 hover:bg-slate-800",
      dot: "bg-slate-500",
    }
  )
}

function typeLabel(key, recordTypes) {
  return recordTypes.find((r) => r.key === key)?.label || key
}

function useIsMobile(breakpointPx = 1024) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const on = () => setIsMobile(mq.matches)
    on()
    mq.addEventListener?.("change", on)
    return () => mq.removeEventListener?.("change", on)
  }, [breakpointPx])
  return isMobile
}

function useDebouncedValue(value, delayMs = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return v
}

// -------------------------------
// Data Normalizers
// -------------------------------
function pickListPayload(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, page_size: data.length }
  }
  const items = data?.items || data?.rows || data?.templates || data?.data || []
  const total = Number(data?.total ?? data?.count ?? items.length ?? 0)
  const page = Number(data?.page ?? data?.page_index ?? 1)
  const page_size = Number(data?.page_size ?? data?.limit ?? data?.per_page ?? items.length ?? DEFAULT_PAGE_SIZE)
  const stats = data?.stats || data?.counts || null
  const meta = data?.meta || data?.filters || null
  return { items, total, page, page_size, stats, meta }
}

function normalizeVersion(v) {
  const vv = Number(v?.v ?? v?.version ?? v?.version_no ?? 1) || 1
  const status = upper(v?.status ?? v?.doc_status ?? "DRAFT")
  return {
    id: v?.id ?? `${vv}`,
    v: vv,
    status: status || "DRAFT",
    note: v?.note ?? v?.remarks ?? v?.changelog ?? "",
    updated_at: v?.updated_at ?? v?.created_at ?? null,
    updated_by: v?.updated_by ?? v?.created_by ?? "—",
    dept: v?.dept ?? v?.department ?? v?.dept_code ?? null,
    type: v?.type ?? v?.record_type ?? v?.record_type_code ?? null,
    name: v?.name ?? null,
    description: v?.description ?? null,
    premium: v?.premium ?? v?.is_premium ?? null,
    is_default: v?.is_default ?? null,
    restricted: v?.restricted ?? v?.is_restricted ?? null,
    sections: v?.sections ?? null,
    schema_json: v?.schema_json ?? v?.schema ?? null,
  }
}

function normalizeTemplate(x) {
  const deptCode = upper(x?.dept_code ?? x?.dept ?? x?.department ?? "COMMON")
  const typeCode = upper(x?.record_type_code ?? x?.type ?? x?.record_type ?? "OPD_NOTE")

  const statusRaw =
    x?.status ??
    (x?.published === true ? "PUBLISHED" : null) ??
    (x?.is_published === true ? "PUBLISHED" : null) ??
    (x?.is_archived === true ? "ARCHIVED" : "DRAFT")

  const status = upper(statusRaw) || "DRAFT"
  const version = Number(x?.version ?? x?.current_version ?? x?.published_version ?? 1) || 1

  const schemaRaw = x?.schema_json ?? x?.schema ?? x?.schemaJson
  const schemaText = prettyJson(schemaRaw)

  return {
    id: x?.id,
    dept: deptCode,
    dept_code: deptCode,
    type: typeCode,
    record_type_code: typeCode,

    name: x?.name ?? x?.title ?? "",
    description: x?.description ?? "",

    premium: !!(x?.premium ?? x?.is_premium),
    is_default: !!(x?.is_default ?? x?.default),
    restricted: !!(x?.restricted ?? x?.is_restricted),

    status,
    version,

    updated_at: x?.updated_at ?? x?.modified_at ?? x?.updatedAt ?? null,
    updated_by: x?.updated_by ?? x?.modified_by ?? x?.updatedBy ?? "—",

    sections: normalizeSections(x?.sections),
    schema_json: schemaText,

    versions: Array.isArray(x?.versions) ? x.versions.map(normalizeVersion) : [],
  }
}

// -------------------------------
// Main Page Component
// -------------------------------
export default function EmrTemplateLibrary() {
  const isMobile = useIsMobile(1024)
  const [view, setView] = useState("list") // list | dept

  const [templates, setTemplates] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [serverStats, setServerStats] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loadingList, setLoadingList] = useState(false)

  const [detailById, setDetailById] = useState(() => new Map())
  const [loadingDetailId, setLoadingDetailId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const [savedSearches, setSavedSearches] = useState(() => loadSavedSearches())
  const [savedId, setSavedId] = useState("")

  const [openSaveSearch, setOpenSaveSearch] = useState(false)
  const [saveName, setSaveName] = useState("")

  const [f, setF] = useState(DEFAULT_FILTERS)
  const debouncedQ = useDebouncedValue(f.q, 350)

  const [openEditor, setOpenEditor] = useState(false)
  const [editId, setEditId] = useState(null)

  const [openVersions, setOpenVersions] = useState(false)
  const [versionsForId, setVersionsForId] = useState(null)

  const [mutating, setMutating] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  // keep savedId valid (prevents UI weirdness after delete / storage reset)
  useEffect(() => {
    if (!savedId) return
    if (!savedSearches.some((x) => x.id === savedId)) setSavedId("")
  }, [savedId, savedSearches])

  function applySavedSearch(id) {
    const s = savedSearches.find((x) => x.id === id)
    if (!s) return
    const nextFilters = { ...DEFAULT_FILTERS, ...(s.filters || {}) }
    setPage(1)
    setF((prev) => ({
      ...prev,
      ...nextFilters,
      q: nextFilters.q ?? "",
      sort: nextFilters.sort ?? prev.sort ?? DEFAULT_FILTERS.sort,
      dir: nextFilters.dir ?? prev.dir ?? DEFAULT_FILTERS.dir,
    }))
  }

  function deleteSavedSearch(id) {
    const next = savedSearches.filter((x) => x.id !== id)
    setSavedSearches(next)
    persistSavedSearches(next)
    if (savedId === id) setSavedId("")
    toast.success("Saved search removed")
  }

  function saveCurrentSearch(name) {
    const clean = safeTrim(name)
    if (!clean) return toast.error("Enter a name for this saved search")

    const item = {
      id: makeId(),
      name: clean,
      created_at: new Date().toISOString(),
      filters: {
        q: safeTrim(f.q),
        dept: f.dept,
        type: f.type,
        status: f.status,
        onlyPremium: !!f.onlyPremium,
        sort: f.sort,
        dir: f.dir,
      },
    }

    const next = [item, ...savedSearches].slice(0, 50)
    setSavedSearches(next)
    persistSavedSearches(next)
    setSavedId(item.id)
    toast.success("Saved search created")
  }

  const departments = useMemo(() => {
    const d = meta?.departments || meta?.department_list || meta?.filters?.departments
    if (Array.isArray(d) && d.length) {
      if (typeof d[0] === "object") return d.map((x) => upper(x.code ?? x.value ?? x.key)).filter(Boolean)
      return d.map((x) => upper(x))
    }
    return FALLBACK_DEPARTMENTS
  }, [meta])

  const recordTypes = useMemo(() => {
    const t = meta?.record_types || meta?.template_types || meta?.filters?.record_types
    if (Array.isArray(t) && t.length) {
      if (typeof t[0] === "string") return t.map((k) => ({ key: upper(k), label: k }))
      return t.map((x) => ({
        key: upper(x?.key ?? x?.code ?? x?.value),
        label: x?.label ?? x?.name ?? x?.key ?? x?.code,
      }))
    }
    return FALLBACK_RECORD_TYPES
  }, [meta])

  const selected = useMemo(() => {
    if (!selectedId) return null
    const cached = detailById.get(selectedId)
    if (cached) return cached
    return templates.find((t) => t.id === selectedId) || null
  }, [detailById, selectedId, templates])

  useEffect(() => {
    if (!selectedId && templates?.length) setSelectedId(templates[0].id)
    if (selectedId && templates?.length && !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0]?.id || null)
    }
  }, [templates, selectedId])

  // fetch list
  useEffect(() => {
    const ac = new AbortController()
    const run = async () => {
      setLoadingList(true)
      try {
        const params = { page, limit: pageSize }
        const q = safeTrim(debouncedQ)
        if (q) params.q = q
        if (f.dept !== "ALL") {
          params.dept = f.dept // backward compat
          params.dept_code = f.dept // ✅ canonical
        }
        if (f.type !== "ALL") {
          params.type = f.type // backward compat
          params.record_type_code = f.type // ✅ canonical
        }
        if (f.status !== "ALL") params.status = f.status
        if (f.onlyPremium) params.premium = true

        const data = await apiListTemplates(params, ac.signal)
        const payload = pickListPayload(data)
        const rows = (payload?.items || []).map(normalizeTemplate).filter((x) => x?.id != null)

        setTemplates(rows)
        setTotal(payload?.total ?? rows?.length ?? 0)
        setServerStats(payload?.stats || null)
        setMeta(payload?.meta || null)
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return
        toast.error(apiErrorMessage(err, "Failed to load templates"))
        setTemplates([])
        setTotal(0)
        setServerStats(null)
      } finally {
        setLoadingList(false)
      }
    }

    run()
    return () => ac.abort()
  }, [debouncedQ, f.dept, f.type, f.status, f.onlyPremium, page, pageSize, reloadNonce])

  // fetch detail when selection changes
  useEffect(() => {
    if (!selectedId) return
    const cached = detailById.get(selectedId)
    if (cached?.schema_json && Array.isArray(cached?.versions) && cached.versions.length) return

    const ac = new AbortController()
    const run = async () => {
      setLoadingDetailId(selectedId)
      try {
        const data = await apiGetTemplate(selectedId, ac.signal)
        const t = normalizeTemplate(data)
        setDetailById((prev) => {
          const next = new Map(prev)
          next.set(selectedId, t)
          return next
        })
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return
        toast.error(apiErrorMessage(err, "Failed to load template details"))
      } finally {
        setLoadingDetailId(null)
      }
    }

    run()
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const stats = useMemo(() => {
    if (serverStats) {
      const totalCount = Number(serverStats.total ?? total ?? 0) || 0
      const pub = Number(serverStats.published ?? serverStats.pub ?? 0) || 0
      const draft = Number(serverStats.draft ?? 0) || 0
      const arch = Number(serverStats.archived ?? serverStats.arch ?? 0) || 0
      return { total: totalCount, pub, draft, arch }
    }
    const totalCount = templates.length
    const pub = templates.filter((t) => t.status === "PUBLISHED").length
    const draft = templates.filter((t) => t.status === "DRAFT").length
    const arch = templates.filter((t) => t.status === "ARCHIVED").length
    return { total: totalCount, pub, draft, arch }
  }, [serverStats, total, templates])

  const filteredForUI = useMemo(() => {
    const dir = f.dir === "ASC" ? 1 : -1
    const pr = (x) => (x.status === "PUBLISHED" ? 0 : x.status === "DRAFT" ? 1 : 2)

    const dtVal = (x) => {
      const t = x?.updated_at ? new Date(x.updated_at).getTime() : 0
      return Number.isFinite(t) ? t : 0
    }

    const cmpStr = (a, b) => safeStr(a).localeCompare(safeStr(b))

    return [...(templates || [])].sort((a, b) => {
      // Always keep clinical priority: Published → Draft → Archived
      const p = pr(a) - pr(b)
      if (p) return p

      let s = 0
      switch (f.sort) {
        case "NAME":
          s = cmpStr(a.name, b.name)
          break
        case "DEPT":
          s = cmpStr(a.dept, b.dept)
          break
        case "TYPE":
          s = cmpStr(a.type, b.type)
          break
        case "VERSION":
          s = Number(a.version || 0) - Number(b.version || 0)
          break
        case "UPDATED_AT":
        default:
          s = dtVal(a) - dtVal(b)
          break
      }

      if (s) return s * dir
      return cmpStr(a.name, b.name)
    })
  }, [templates, f.sort, f.dir])

  const grouped = useMemo(() => {
    const m = new Map()
    for (const t of filteredForUI) {
      const k = t.dept || "UNKNOWN"
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(t)
    }
    return Array.from(m.entries()).sort((a, b) => safeStr(a[0]).localeCompare(safeStr(b[0])))
  }, [filteredForUI])

  function refreshList() {
    setReloadNonce((n) => n + 1)
  }

  async function ensureDetail(id) {
    if (!id) return null
    const cached = detailById.get(id)
    if (cached?.schema_json) return cached

    try {
      setLoadingDetailId(id)
      const data = await apiGetTemplate(id)
      const t = normalizeTemplate(data)
      setDetailById((prev) => {
        const next = new Map(prev)
        next.set(id, t)
        return next
      })
      return t
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load template"))
      return null
    } finally {
      setLoadingDetailId(null)
    }
  }

  function openCreate() {
    setEditId(null)
    setOpenEditor(true)
  }

  // ✅ FIX: Load detail FIRST, then open (prevents “create-mode flicker”)
  async function openEdit(id) {
    if (!id) return
    await ensureDetail(id)
    setEditId(id)
    setOpenEditor(true)
  }

  async function openVersionHistory(id) {
    if (!id) return
    await ensureDetail(id)
    setVersionsForId(id)
    setOpenVersions(true)
  }

  /** Publish/unpublish */
  async function togglePublish(id) {
    if (!id) return
    const t = detailById.get(id) || templates.find((x) => x.id === id)
    if (!t) return

    if (t.status === "ARCHIVED") return toast.error("Archived templates cannot be published")

    const nextPublish = t.status !== "PUBLISHED"

    setMutating(true)
    try {
      await apiPublishTemplate(id, { publish: nextPublish })
      toast.success(nextPublish ? "Published" : "Unpublished")
      refreshList()

      const data = await apiGetTemplate(id)
      const nt = normalizeTemplate(data)
      setDetailById((prev) => {
        const next = new Map(prev)
        next.set(id, nt)
        return next
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to publish/unpublish"))
    } finally {
      setMutating(false)
    }
  }

  async function archiveTemplate(id) {
    if (!id) return
    const t = (await ensureDetail(id)) || templates.find((x) => x.id === id)
    if (!t) return

    setMutating(true)
    try {
      await apiCreateTemplateVersion(id, {
        dept_code: t.dept_code ?? t.dept,
        record_type_code: t.record_type_code ?? t.type,
        name: t.name,
        description: t.description || "",
        premium: !!t.premium,
        is_default: !!t.is_default,
        restricted: !!t.restricted,
        publish: false,
        status: "ARCHIVED",
        changelog: "Archived",
        sections: t.sections || [],
        schema_json: parseSchemaJson(t.schema_json || "{\n}"),
        keep_same_version: false,
      })

      toast.success("Template archived")
      refreshList()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to archive template"))
    } finally {
      setMutating(false)
    }
  }

  async function duplicateTemplate(id) {
    if (!id) return
    const t = (await ensureDetail(id)) || templates.find((x) => x.id === id)
    if (!t) return

    setMutating(true)
    try {
      const data = await apiCreateTemplate({
        dept_code: t.dept_code ?? t.dept,
        record_type_code: t.record_type_code ?? t.type,
        name: `${t.name} (Copy)`,
        description: t.description || "",
        premium: !!t.premium,
        is_default: false,
        restricted: !!t.restricted,
        publish: false,
        sections: t.sections || [],
        schema_json: parseSchemaJson(t.schema_json || "{\n}"),
        changelog: "Copied from existing template",
      })

      const created = normalizeTemplate(data)
      toast.success("Template duplicated")
      refreshList()
      if (created?.id) setSelectedId(created.id)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to duplicate template"))
    } finally {
      setMutating(false)
    }
  }

  async function restoreVersion(templateId, versionNumber) {
    if (!templateId || !versionNumber) return
    const t = (await ensureDetail(templateId)) || templates.find((x) => x.id === templateId)
    if (!t) return

    const v = (t.versions || []).find((x) => Number(x.v) === Number(versionNumber)) || null

    setMutating(true)
    try {
      await apiCreateTemplateVersion(templateId, {
        dept_code: upper(v?.dept ?? t.dept),
        record_type_code: upper(v?.type ?? t.type),
        name: v?.name ?? t.name,
        description: v?.description ?? t.description ?? "",
        premium: v?.premium ?? t.premium ?? false,
        is_default: v?.is_default ?? t.is_default ?? false,
        restricted: v?.restricted ?? t.restricted ?? false,
        sections: normalizeSections(v?.sections ?? t.sections ?? []),
        schema_json: parseSchemaJson(prettyJson(v?.schema_json ?? t.schema_json ?? "{\n}")),
        publish: false,
        status: "DRAFT",
        changelog: `Restored from v${versionNumber}`,
        restore_from_version: Number(versionNumber),
        keep_same_version: false,
      })

      toast.success(`Restored as new draft from v${versionNumber}`)
      refreshList()
      await ensureDetail(templateId)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to restore version"))
    } finally {
      setMutating(false)
    }
  }

  /**
   * ✅ Editor Save (CREATE / UPDATE / NEW_VERSION)
   */
  async function onEditorSave(payload, mode) {
    setMutating(true)
    try {
      const schemaObj = parseSchemaJson(payload.schema_json || "{\n}")

      const base = {
        dept_code: upper(payload.dept),
        record_type_code: upper(payload.type),

        name: payload.name,
        description: payload.description || "",

        premium: !!payload.premium,
        is_default: !!payload.is_default,
        restricted: !!payload.restricted,

        sections: payload.sections || [],
        schema_json: schemaObj,

        publish: !!payload.publish,
        status: payload.publish ? "PUBLISHED" : "DRAFT",

        changelog: safeTrim(payload.changelog || "") || undefined,
      }

      if (mode === "CREATE") {
        const data = await apiCreateTemplate(base)
        const created = normalizeTemplate(data)
        toast.success("Template created")
        setOpenEditor(false)
        refreshList()
        if (created?.id) setSelectedId(created.id)
        return
      }

      const id = payload.id
      if (!id) throw new Error("Missing template id")

      await apiCreateTemplateVersion(id, {
        ...base,
        keep_same_version: mode === "UPDATE",
      })

      if (payload.publish) {
        try {
          await apiPublishTemplate(id, { publish: true })
        } catch {
          // ignore
        }
      }

      toast.success(mode === "UPDATE" ? "Template updated" : "New version created")
      setOpenEditor(false)
      refreshList()
      await ensureDetail(id)
    } catch (err) {
      const msg = String(err?.message || "")
      if (msg.includes("Unexpected token") || msg.toLowerCase().includes("json")) {
        toast.error("Schema JSON is invalid. Please fix JSON syntax before saving.")
      } else {
        toast.error(apiErrorMessage(err, "Save failed"))
      }
    } finally {
      setMutating(false)
    }
  }

  const totalPages = useMemo(() => {
    const t = Number(total || 0)
    const ps = Number(pageSize || DEFAULT_PAGE_SIZE)
    return ps > 0 ? Math.max(1, Math.ceil(t / ps)) : 1
  }, [total, pageSize])

  return (
    <div className="w-full">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                  <FileText className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">Template Library</div>
                  <div className="text-xs text-slate-500">Clinical templates · versioning · publish control</div>
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

              <Button variant="outline" className="rounded-2xl" disabled={loadingList} onClick={() => refreshList()}>
                <RefreshCcw className={cn("mr-2 h-4 w-4", loadingList ? "animate-spin" : "")} />
                Refresh
              </Button>

              <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={openCreate} disabled={mutating}>
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
        <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <div className="relative w-full md:max-w-[420px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={f.q}
                    onChange={(e) => (setPage(1), setF((p) => ({ ...p, q: e.target.value })))}
                    placeholder="Search templates (name, dept, type)…"
                    className="h-10 rounded-2xl pl-9"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={f.dept}
                    onChange={(e) => (setPage(1), setF((p) => ({ ...p, dept: e.target.value })))}
                    className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <select
                    value={f.type}
                    onChange={(e) => (setPage(1), setF((p) => ({ ...p, type: e.target.value })))}
                    className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                  >
                    <option value="ALL">All Record Types</option>
                    {recordTypes.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={f.status}
                    onChange={(e) => (setPage(1), setF((p) => ({ ...p, status: e.target.value })))}
                    className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s === "ALL" ? "All Status" : s}
                      </option>
                    ))}
                  </select>

                  {/* Saved Searches */}
                  <select
                    value={savedId}
                    onChange={(e) => {
                      const id = e.target.value
                      setSavedId(id)
                      if (id) applySavedSearch(id)
                    }}
                    className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                  >
                    <option value="">Saved searches…</option>
                    {savedSearches.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    className="h-10 rounded-2xl"
                    onClick={() => {
                      setSaveName("")
                      setOpenSaveSearch(true)
                    }}
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    Save Search
                  </Button>

                  <Button variant="outline" className="h-10 rounded-2xl" disabled={!savedId} onClick={() => savedId && deleteSavedSearch(savedId)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Saved
                  </Button>

                  {/* Sort */}
                  <select
                    value={f.sort}
                    onChange={(e) => (setPage(1), setF((p) => ({ ...p, sort: e.target.value })))}
                    className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                  >
                    <option value="UPDATED_AT">Sort: Updated</option>
                    <option value="NAME">Sort: Name</option>
                    <option value="DEPT">Sort: Department</option>
                    <option value="TYPE">Sort: Type</option>
                    <option value="VERSION">Sort: Version</option>
                  </select>

                  <Button
                    variant="outline"
                    className="h-10 rounded-2xl"
                    onClick={() => (setPage(1), setF((p) => ({ ...p, dir: p.dir === "ASC" ? "DESC" : "ASC" })))}
                  >
                    {f.dir === "ASC" ? "Asc" : "Desc"}
                  </Button>

                  {/* Presets */}
                  <Button variant="outline" className="h-10 rounded-2xl" onClick={() => (setPage(1), setF((p) => ({ ...p, status: "PUBLISHED" })))}>
                    Published
                  </Button>
                  <Button variant="outline" className="h-10 rounded-2xl" onClick={() => (setPage(1), setF((p) => ({ ...p, status: "DRAFT" })))}>
                    Draft
                  </Button>

                  <Button
                    variant={f.onlyPremium ? "default" : "outline"}
                    className={cn("h-10 rounded-2xl", f.onlyPremium ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
                    onClick={() => (setPage(1), setF((p) => ({ ...p, onlyPremium: !p.onlyPremium })))}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Premium
                  </Button>

                  <Button
                    variant="outline"
                    className="h-10 rounded-2xl"
                    onClick={() => {
                      setSavedId("")
                      setF(DEFAULT_FILTERS)
                      setPage(1)
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Reset
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Showing <span className="font-semibold text-slate-800">{filteredForUI.length}</span> row(s)
                </div>

                <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <span>Page size</span>
                  <select
                    value={pageSize}
                    onChange={(e) => (setPage(1), setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE))}
                    className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none"
                  >
                    {[10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Paging */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                Total <span className="font-semibold text-slate-800">{total}</span> · Page{" "}
                <span className="font-semibold text-slate-800">{page}</span> /{" "}
                <span className="font-semibold text-slate-800">{totalPages}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-9 rounded-2xl"
                  disabled={page <= 1 || loadingList}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-2xl"
                  disabled={page >= totalPages || loadingList}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
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
              onArchive={archiveTemplate}
              onVersions={openVersionHistory}
              isMobile={isMobile}
              recordTypes={recordTypes}
              busy={mutating}
              loading={loadingList}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
              <TemplatesList
                rows={filteredForUI}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onEdit={openEdit}
                onPublish={togglePublish}
                onDuplicate={duplicateTemplate}
                onArchive={archiveTemplate}
                onVersions={openVersionHistory}
                isMobile={isMobile}
                recordTypes={recordTypes}
                busy={mutating}
                loading={loadingList}
              />

              <div className="hidden xl:block">
                <PreviewPane
                  tpl={selected}
                  recordTypes={recordTypes}
                  loading={!!loadingDetailId && loadingDetailId === selectedId}
                  onEdit={() => selected && openEdit(selected.id)}
                  onPublish={() => selected && togglePublish(selected.id)}
                  onDuplicate={() => selected && duplicateTemplate(selected.id)}
                  onArchive={() => selected && archiveTemplate(selected.id)}
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
        template={editId ? detailById.get(editId) || templates.find((t) => t.id === editId) : null}
        onSave={onEditorSave}
      />

      {/* Versions Dialog */}
      <VersionsDialog
        open={openVersions}
        onOpenChange={setOpenVersions}
        template={versionsForId ? detailById.get(versionsForId) || templates.find((t) => t.id === versionsForId) : null}
        onRestore={(v) => versionsForId && restoreVersion(versionsForId, v)}
      />

      {/* Save Search Dialog */}
      <Dialog open={openSaveSearch} onOpenChange={setOpenSaveSearch}>
        <DialogContent className="max-w-[520px] rounded-3xl border-slate-200 bg-white/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Save current search</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-xs text-slate-500">Saves: query, dept, type, status, premium, sort.</div>

            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Eg: Cardiology OPD Published"
              className="h-10 rounded-2xl"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => setOpenSaveSearch(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  saveCurrentSearch(saveName)
                  setOpenSaveSearch(false)
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// -------------------------------
// Department Grid View
// -------------------------------
function DepartmentGrid({ groups, selectedId, onSelect, onEdit, onPublish, onDuplicate, onArchive, onVersions, isMobile, recordTypes, busy, loading }) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
        <div className="text-sm font-semibold text-slate-800">Loading templates…</div>
        <div className="mt-1 text-xs text-slate-500">Please wait</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map(([dept, rows]) => {
        const tone = deptTone(dept)
        const pub = rows.filter((r) => r.status === "PUBLISHED").length
        const draft = rows.filter((r) => r.status === "DRAFT").length

        return (
          <Card key={dept} className={cn("rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
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
                    recordTypes={recordTypes}
                    busy={busy}
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
function TemplatesList({ rows, selectedId, onSelect, onEdit, onPublish, onDuplicate, onArchive, onVersions, isMobile, recordTypes, busy, loading }) {
  if (loading) {
    return (
      <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
        <CardContent className="p-10 text-center">
          <div className="text-sm font-semibold text-slate-800">Loading templates…</div>
          <div className="mt-1 text-xs text-slate-500">Fetching live data</div>
        </CardContent>
      </Card>
    )
  }

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
            recordTypes={recordTypes}
            busy={busy}
          />
        ))}
        {!rows.length ? <Empty /> : null}
      </div>
    )
  }

  return (
    <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
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
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(t.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelect(t.id)}
                    className={cn(
                      "grid grid-cols-[1.3fr_1fr_1fr_0.8fr_0.6fr_1fr] items-center gap-2 px-3 py-3 text-left transition cursor-pointer",
                      active ? "bg-white ring-1 ring-slate-200" : "bg-white/70 hover:bg-white"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
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
                        <span className="truncate">{typeLabel(t.type, recordTypes)}</span>
                      </Badge>
                    </div>

                    <div>
                      <StatusPill status={t.status} />
                    </div>

                    <div className="text-sm font-semibold text-slate-900">v{t.version}</div>

                    <div className="flex justify-end gap-2">
                      <IconBtn title="Edit" disabled={busy} onClick={(e) => (e.stopPropagation(), onEdit(t.id))}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>

                      <IconBtn title="Versions" disabled={busy} onClick={(e) => (e.stopPropagation(), onVersions(t.id))}>
                        <History className="h-4 w-4" />
                      </IconBtn>

                      <IconBtn
                        title={t.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        disabled={busy}
                        onClick={(e) => (e.stopPropagation(), onPublish(t.id))}
                      >
                        {t.status === "PUBLISHED" ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                      </IconBtn>

                      <IconBtn title="Duplicate" disabled={busy} onClick={(e) => (e.stopPropagation(), onDuplicate(t.id))}>
                        <Copy className="h-4 w-4" />
                      </IconBtn>

                      <IconBtn title="Archive" disabled={busy} onClick={(e) => (e.stopPropagation(), onArchive(t.id))}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </div>
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
// ✅ FIX: wrapper is NOT a button (prevents nested button breakage)
// -------------------------------
function TemplateTile({ tpl, active, onClick, onEdit, onPublish, onDuplicate, onArchive, onVersions, compact, recordTypes, busy }) {
  const tone = deptTone(tpl.dept)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition cursor-pointer",
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
                {typeLabel(tpl.type, recordTypes)}
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

        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" className="h-9 rounded-2xl" disabled={busy} onClick={() => onEdit()}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" className="h-9 rounded-2xl" disabled={busy} onClick={() => onVersions()}>
            <History className="mr-2 h-4 w-4" /> Versions
          </Button>
          <Button
            className={cn("h-9 rounded-2xl", tpl.status === "PUBLISHED" ? "bg-slate-900 text-white hover:bg-slate-800" : tone.btn)}
            disabled={busy}
            onClick={() => onPublish()}
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

          <Button variant="outline" className="h-9 rounded-2xl" disabled={busy} onClick={() => onDuplicate()}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </Button>

          <Button variant="outline" className="h-9 rounded-2xl" disabled={busy} onClick={() => onArchive()}>
            <Trash2 className="mr-2 h-4 w-4" /> Archive
          </Button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------
// Preview Pane
// -------------------------------
function PreviewPane({ tpl, recordTypes, loading, onEdit, onPublish, onDuplicate, onArchive, onVersions }) {
  if (!tpl) {
    return (
      <Card className="rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
        <CardContent className="p-8 text-center">
          <div className="text-sm font-semibold text-slate-800">Select a template</div>
          <div className="mt-1 text-xs text-slate-500">Preview appears here</div>
        </CardContent>
      </Card>
    )
  }

  const tone = deptTone(tpl.dept)

  return (
    <Card className={cn("rounded-3xl border-slate-200 bg-white/90 shadow-sm backdrop-blur", tone.glow)}>
      <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{tpl.name}</CardTitle>
            <div className="mt-1 text-xs text-slate-500">
              {tpl.dept} · {typeLabel(tpl.type, recordTypes)} · v{tpl.version} · Updated {fmtDate(tpl.updated_at)}
            </div>
          </div>
          <StatusPill status={tpl.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
            <div className="text-sm font-semibold text-slate-800">Loading details…</div>
            <div className="mt-1 text-xs text-slate-500">Fetching schema and versions</div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("rounded-xl", tone.chip)}>
            <Building2 className="mr-1 h-3.5 w-3.5" />
            {tpl.dept}
          </Badge>
          <Badge variant="outline" className="rounded-xl">
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            {typeLabel(tpl.type, recordTypes)}
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
          <div className="text-xs font-semibold text-slate-700">Template Schema</div>
          <pre className="mt-2 max-h-[260px] overflow-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200">
            {tpl.schema_json || "{\n}"}
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
// Versions Dialog
// -------------------------------
function VersionsDialog({ open, onOpenChange, template, onRestore }) {
  if (!template) {
    return (
      <Dialog open={!!open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[700px] rounded-3xl border-slate-200 bg-white/90 backdrop-blur-xl">
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
      <DialogContent className="w-[95vw] max-w-[820px] rounded-3xl border-slate-200 bg-white/90 p-0 backdrop-blur-xl overflow-hidden">
        <div className={cn("h-2 w-full bg-gradient-to-r", tone.bar)} />

        <div className="px-4 pt-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900">Version History</div>
              <div className="mt-1 text-xs text-slate-500">
                {template.name} · {template.dept} · {template.type}
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
                    <Button variant="outline" className="h-9 rounded-2xl" onClick={() => onRestore?.(v.v)}>
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

        <div className="border-t border-slate-200 bg-white/75 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="text-xs text-slate-500">
            Restore creates a <span className="font-semibold text-slate-700">new Draft version</span>.
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
