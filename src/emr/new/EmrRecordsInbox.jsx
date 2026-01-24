// FILE: frontend/src/emr/EmrRecordsInbox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Search,
  RefreshCcw,
  Filter,
  X,
  ClipboardList,
  PenLine,
  ShieldCheck,
  TestTube2,
  ScanLine,
  Clock3,
  Calendar,
  Building2,
  Layers,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Dot,
  ChevronRight,
  User,
  FileText,
  Paperclip,
  Lock,
  Check,
  ListChecks,
  Undo2,
  LayoutGrid,
  Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"


import {
  emrMetaGet,
  emrInboxList,
  emrInboxListMany,
  emrInboxAck,
  emrRecordGet,
  emrSignRecord,
  errMsg,
  toId,
} from "@/api/emrApi"

/**
 * BACKEND BUCKETS (VALID):
 * - pending_signature
 * - drafts_to_complete
 * - new_lab_results
 * - new_radiology_reports
 */

const TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING_SIGN", label: "Pending Signature" },
  { key: "DRAFTS", label: "Drafts to Complete" },
  { key: "RESULTS", label: "New Results" },
]

const PRIORITIES = ["ALL", "NORMAL", "HIGH", "URGENT"]
const SORTS = [
  { key: "UPDATED_DESC", label: "Latest Updated" },
  { key: "PRIORITY_DESC", label: "Priority" },
]

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

function useDebouncedValue(value, delayMs = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return v
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
function dateKey(updated_at) {
  try {
    const x = new Date(updated_at)
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startX = new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diffDays = Math.round((startToday - startX) / (24 * 60 * 60 * 1000))
    if (diffDays === 0) return "TODAY"
    if (diffDays === 1) return "YESTERDAY"
    return "OLDER"
  } catch {
    return "OLDER"
  }
}

function kindMeta(kind) {
  if (kind === "PENDING_SIGN")
    return { label: "Pending Signature", icon: ShieldCheck, chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" }
  if (kind === "DRAFT")
    return { label: "Draft", icon: PenLine, chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" }
  if (kind === "RESULT_LAB")
    return { label: "Lab Result", icon: TestTube2, chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" }
  if (kind === "RESULT_RAD")
    return { label: "Radiology Result", icon: ScanLine, chip: "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200" }
  return { label: "Item", icon: ClipboardList, chip: "bg-slate-50 text-slate-700 ring-1 ring-slate-200" }
}

function safeUpper(v) {
  return String(v || "").trim().toUpperCase()
}

function normalizePatient(patient_id, cacheObj) {
  const pid = toId(patient_id)
  const cached = cacheObj?.get?.(Number(pid))
  if (cached) return cached
  return {
    id: pid ? Number(pid) : null,
    name: pid ? `Patient #${pid}` : "Patient",
    uhid: pid ? String(pid) : "—",
    age: null,
    gender: null,
    phone: null,
  }
}

function makePreviewFromRecord(rec) {
  const sections = Array.isArray(rec?.template_sections) ? rec.template_sections : []
  const summary = []

  if (typeof rec?.note === "string" && rec.note.trim()) {
    summary.push(rec.note.trim().slice(0, 180))
  }
  if (rec?.content && typeof rec.content === "object") {
    const keys = Object.keys(rec.content).slice(0, 6)
    for (const k of keys) {
      const v = rec.content[k]
      if (v === null || v === undefined) continue
      if (typeof v === "string" && v.trim()) summary.push(`${k}: ${v.trim().slice(0, 60)}`)
      else if (typeof v === "number" || typeof v === "boolean") summary.push(`${k}: ${String(v)}`)
    }
  }
  return { summary: summary.slice(0, 8), sections: sections.slice(0, 50) }
}

function pickPriorityFromRecord(rec) {
  const p = rec?.priority || rec?.urgency || rec?.severity || null
  const up = safeUpper(p)
  if (up === "URGENT" || up === "HIGH" || up === "NORMAL") return up
  return "NORMAL"
}

async function runPool(items, limit, fn) {
  const q = [...items]
  const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (q.length) {
      const it = q.shift()
      try {
        // eslint-disable-next-line no-await-in-loop
        await fn(it)
      } catch {
        // ignore, fn handles
      }
    }
  })
  await Promise.all(workers)
}

export default function EmrRecordsInbox() {
  const isMobile = useIsMobile(1024)

  const [tab, setTab] = useState("ALL")
  const [q, setQ] = useState("")
  const qDebounced = useDebouncedValue(q, 350)

  const [deptCode, setDeptCode] = useState("ALL")
  const [priority, setPriority] = useState("ALL")
  const [sort, setSort] = useState("UPDATED_DESC")
  const [grouping, setGrouping] = useState(true)

  const [page, setPage] = useState(1)
  const [pageSize] = useState(80)

  const [meta, setMeta] = useState({ departments: [] })
  const deptMap = useMemo(() => {
    const m = new Map()
    for (const d of meta?.departments || []) m.set(String(d.code), String(d.name || d.code))
    return m
  }, [meta])

  const deptOptions = useMemo(() => {
    const list = meta?.departments || []
    return [{ code: "ALL", name: "All Departments" }, ...list.map((d) => ({ code: String(d.code), name: String(d.name || d.code) }))]
  }, [meta])

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [activeId, setActiveId] = useState(null)
  const active = useMemo(() => rows.find((r) => r.uid === activeId) || null, [rows, activeId])

  const [selected, setSelected] = useState(() => new Set())
  const selectedCount = selected.size

  const [busyIds, setBusyIds] = useState(() => new Set())

  const recordCacheRef = useRef(new Map())   // record_id -> record
  const patientCacheRef = useRef(new Map())  // patient_id -> patient (if you later add patient endpoint)

  const tone = deptTone(active?.dept || (deptCode !== "ALL" ? deptMap.get(deptCode) : "General Medicine"))

  const counts = useMemo(() => {
    const all = rows.length
    const pending = rows.filter((r) => r.kind === "PENDING_SIGN").length
    const drafts = rows.filter((r) => r.kind === "DRAFT").length
    const results = rows.filter((r) => r.kind === "RESULT_LAB" || r.kind === "RESULT_RAD").length
    const urgent = rows.filter((r) => r.priority === "URGENT").length
    return { all, pending, drafts, results, urgent }
  }, [rows])

  const filtered = useMemo(() => {
    const qq = (qDebounced || "").trim().toLowerCase()
    let x = [...rows]

    if (deptCode !== "ALL") x = x.filter((r) => String(r.dept_code || "") === String(deptCode))
    if (priority !== "ALL") x = x.filter((r) => (r.priority || "NORMAL") === priority)

    if (qq) {
      x = x.filter((r) => {
        const hay = `${r.uid} ${r.title} ${r.dept} ${r.kind} ${r.patient?.name} ${r.patient?.uhid} ${r.visit?.type} ${r.visit?.id}`.toLowerCase()
        return hay.includes(qq)
      })
    }

    const prRank = { URGENT: 3, HIGH: 2, NORMAL: 1 }
    const ts = (d) => (d ? new Date(d).getTime() : 0)
    if (sort === "UPDATED_DESC") x.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
    if (sort === "PRIORITY_DESC") x.sort((a, b) => (prRank[b.priority] || 0) - (prRank[a.priority] || 0))

    return x
  }, [rows, deptCode, priority, sort, qDebounced])

  const grouped = useMemo(() => {
    if (!grouping) return { ALL: filtered }
    const out = { TODAY: [], YESTERDAY: [], OLDER: [] }
    for (const it of filtered) out[dateKey(it.updated_at)].push(it)
    return out
  }, [filtered, grouping])

  useEffect(() => {
    if (!activeId && filtered[0]?.uid) setActiveId(filtered[0].uid)
    if (activeId && !filtered.some((r) => r.uid === activeId) && filtered[0]?.uid) setActiveId(filtered[0].uid)
  }, [filtered, activeId])

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set()
      const allowed = new Set(filtered.map((x) => x.uid))
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id)
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((x) => x.uid).join("|")])

  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  useEffect(() => {
    if (!isMobile) setMobilePreviewOpen(false)
  }, [isMobile])

  const selectedItems = useMemo(() => filtered.filter((x) => selected.has(x.uid)), [filtered, selected])
  const canBulkSign = useMemo(() => selectedItems.some((x) => x.kind === "PENDING_SIGN" && x.record_id), [selectedItems])
  const canBulkAck = useMemo(() => selectedItems.some((x) => (x.kind === "RESULT_LAB" || x.kind === "RESULT_RAD") && x.inbox_id), [selectedItems])

  function clearFilters() {
    setQ("")
    setDeptCode("ALL")
    setPriority("ALL")
    setSort("UPDATED_DESC")
    toast.success("Filters cleared")
  }

  function toggleSelect(uid) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((x) => next.add(x.uid))
      return next
    })
    toast.success("Selected all visible items")
  }

  function clearSelection() {
    setSelected(new Set())
    toast.success("Selection cleared")
  }

  function setBusy(uid, on) {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(uid)
      else next.delete(uid)
      return next
    })
  }

  function makeRowFromInboxItem(it) {
    if (it?.kind === "RECORD") {
      const rid = toId(it.record_id)
      const pid = toId(it.patient_id)
      const stage = safeUpper(it.draft_stage)

      const kind = stage === "READY" ? "PENDING_SIGN" : "DRAFT"
      const dc = String(it.dept_code || "")
      const deptName = deptMap.get(dc) || dc || "General Medicine"

      return {
        uid: `REC:${rid}`,
        kind,
        record_id: rid ? Number(rid) : null,
        inbox_id: null,

        dept_code: dc || null,
        dept: deptName,
        title: it.title || "Record",
        patient_id: pid ? Number(pid) : null,
        patient: normalizePatient(pid, patientCacheRef.current),

        visit: { type: it.encounter_type || "—", id: it.encounter_id || "—", doctor: "—" },

        priority: "NORMAL",
        updated_at: it.updated_at || null,

        flags: { confidential: false, abnormal: false, attachments: 0 },
        preview: { summary: [], sections: [] },

        _raw: it,
      }
    }

    if (it?.kind === "RESULT") {
      const iid = toId(it.inbox_id)
      const pid = toId(it.patient_id)
      const src = safeUpper(it.source) // LAB / RIS

      const kind = src === "LAB" ? "RESULT_LAB" : "RESULT_RAD"
      const deptName = kind === "RESULT_LAB" ? "Pathology/Lab" : "Radiology"

      const payload = it.payload || {}
      const abnormal =
        payload?.abnormal === true ||
        payload?.is_abnormal === true ||
        payload?.flag_abnormal === true ||
        safeUpper(payload?.flag) === "ABNORMAL"

      const attachments = Number(payload?.attachments || payload?.attachment_count || 0) || 0

      return {
        uid: `RES:${iid}`,
        kind,
        record_id: null,
        inbox_id: iid ? Number(iid) : null,

        dept_code: null,
        dept: deptName,
        title: it.title || (kind === "RESULT_LAB" ? "Lab Result" : "Radiology Result"),
        patient_id: pid ? Number(pid) : null,
        patient: normalizePatient(pid, patientCacheRef.current),

        visit: { type: it.encounter_type || "—", id: it.encounter_id || "—", doctor: "—" },

        priority: abnormal ? "HIGH" : "NORMAL",
        updated_at: it.created_at || null,

        flags: { confidential: false, abnormal: !!abnormal, attachments },
        preview: {
          summary: buildKeySummary(payload),
          sections: buildKeySections(payload),
        },

        _raw: it,
      }
    }

    return null
  }

  function buildKeySummary(payload) {
    if (!payload || typeof payload !== "object") return []
    const out = []
    const keys = Object.keys(payload).slice(0, 8)
    for (const k of keys) {
      const v = payload[k]
      if (v === null || v === undefined) continue
      if (typeof v === "string" && v.trim()) out.push(`${k}: ${v.trim().slice(0, 60)}`)
      else if (typeof v === "number" || typeof v === "boolean") out.push(`${k}: ${String(v)}`)
    }
    return out.slice(0, 8)
  }

  function buildKeySections(payload) {
    if (!payload || typeof payload !== "object") return []
    const s = payload?.sections
    if (Array.isArray(s)) return s.map((x) => String(x)).slice(0, 30)
    return Object.keys(payload).slice(0, 20)
  }

  async function hydrateRecordIfNeeded(record_id) {
    const rid = toId(record_id)
    if (!rid) return
    const key = Number(rid)
    if (recordCacheRef.current.has(key)) return

    try {
      const rec = await emrRecordGet(key)
      recordCacheRef.current.set(key, rec)

      setRows((prev) =>
        prev.map((r) => {
          if (r.record_id !== key) return r

          const dc = String(rec?.dept_code || r.dept_code || "")
          const deptName = deptMap.get(dc) || r.dept || dc || "General Medicine"

          const stage = safeUpper(rec?.draft_stage)
          const newKind = stage === "READY" ? "PENDING_SIGN" : "DRAFT"

          const preview = makePreviewFromRecord(rec)
          const pr = pickPriorityFromRecord(rec)

          return {
            ...r,
            kind: newKind,
            dept_code: dc || r.dept_code,
            dept: deptName,
            title: rec?.title || r.title,
            priority: pr || r.priority,
            updated_at: rec?.updated_at || r.updated_at,
            flags: { ...r.flags, confidential: !!(rec?.confidential ?? rec?.is_confidential ?? false) },
            preview: {
              summary: preview.summary.length ? preview.summary : r.preview?.summary || [],
              sections: preview.sections.length ? preview.sections : r.preview?.sections || [],
            },
            visit: {
              type: safeUpper(rec?.encounter_type) || r.visit?.type || "—",
              id: rec?.encounter_id != null ? String(rec.encounter_id) : r.visit?.id || "—",
              doctor: r.visit?.doctor || "—",
            },
          }
        })
      )
    } catch {
      // non-fatal
    }
  }

  async function fetchMeta() {
    try {
      const data = await emrMetaGet()
      setMeta({ departments: Array.isArray(data?.departments) ? data.departments : [] })
    } catch (e) {
      toast.error(errMsg(e, "Failed to load EMR meta"))
    }
  }

  function bucketsForTab(t) {
    if (t === "PENDING_SIGN") return ["pending_signature"]
    if (t === "DRAFTS") return ["drafts_to_complete"]
    if (t === "RESULTS") return ["new_lab_results", "new_radiology_reports"]
    // ALL:
    return ["pending_signature", "drafts_to_complete", "new_lab_results", "new_radiology_reports"]
  }

  async function fetchInbox({ showToast = false } = {}) {
    setLoading(true)
    try {
      const buckets = bucketsForTab(tab)

      // Use multi-fetch for tabs with multiple buckets (ALL, RESULTS)
      const data =
        buckets.length === 1
          ? await emrInboxList({ bucket: buckets[0], q: qDebounced, page, page_size: Math.min(pageSize, 100) })
          : await emrInboxListMany({ buckets, q: qDebounced, page, page_size: Math.min(pageSize, 100) })

      const items = Array.isArray(data?.items) ? data.items : []
      const mapped = items.map(makeRowFromInboxItem).filter(Boolean)

      // Sort merged lists by updated_at desc by default (UI sort can reorder later)
      mapped.sort((a, b) => (new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()))

      setRows(mapped)

      if (mapped[0]?.uid) setActiveId((prev) => prev || mapped[0].uid)
      if (showToast) toast.success("Inbox refreshed")

      // Hydrate top record details for better preview
      const topRecordIds = mapped.filter((r) => r.record_id).slice(0, 20).map((r) => r.record_id)
      await runPool(topRecordIds, 6, hydrateRecordIfNeeded)
    } catch (e) {
      toast.error(errMsg(e, "Failed to load inbox"))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPage(1)
  }, [tab, qDebounced])

  useEffect(() => {
    fetchInbox()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, page])

  useEffect(() => {
    if (!active) return
    if (active.record_id) hydrateRecordIfNeeded(active.record_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  async function refresh() {
    await fetchInbox({ showToast: true })
  }

  async function signOne(item) {
    if (!item?.record_id) return toast.error("Invalid record selected")
    const uid = item.uid
    setBusy(uid, true)
    try {
      await emrSignRecord(item.record_id, "")
      toast.success("Signed successfully")
      setRows((prev) => prev.filter((r) => r.uid !== uid))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(uid)
        return next
      })
    } catch (e) {
      toast.error(errMsg(e, "Sign failed"))
    } finally {
      setBusy(uid, false)
    }
  }

  async function ackOne(item) {
    if (!item?.inbox_id) return toast.error("Invalid inbox result selected")
    const uid = item.uid
    setBusy(uid, true)
    try {
      await emrInboxAck(item.inbox_id)
      toast.success("Acknowledged")
      setRows((prev) => prev.filter((r) => r.uid !== uid))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(uid)
        return next
      })
    } catch (e) {
      toast.error(errMsg(e, "Acknowledge failed"))
    } finally {
      setBusy(uid, false)
    }
  }

  async function bulkSignSelected() {
    if (!canBulkSign) return toast.error("No pending signature items selected")
    const targets = selectedItems.filter((x) => x.kind === "PENDING_SIGN" && x.record_id)
    toast.message(`Signing ${targets.length} item(s)...`)
    for (const it of targets) {
      // eslint-disable-next-line no-await-in-loop
      await signOne(it)
    }
  }

  async function bulkAckSelected() {
    if (!canBulkAck) return toast.error("No results selected to acknowledge")
    const targets = selectedItems.filter((x) => (x.kind === "RESULT_LAB" || x.kind === "RESULT_RAD") && x.inbox_id)
    toast.message(`Acknowledging ${targets.length} result(s)...`)
    for (const it of targets) {
      // eslint-disable-next-line no-await-in-loop
      await ackOne(it)
    }
  }

  function doAction(action, item) {
    if (!item) return
    if (action === "OPEN") return toast("Open (wire route later)")
    if (action === "SIGN") return signOne(item)
    if (action === "CONTINUE") return toast("Continue draft (wire editor later)")
    if (action === "ACK_RESULT") return ackOne(item)
  }

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={cn("h-2.5 w-2.5 rounded-full bg-gradient-to-r", tone.bar)} />
                <div className="text-[15px] font-semibold text-slate-900">Records Inbox</div>
                <Badge variant="outline" className="rounded-xl">Daily Work Queue</Badge>
                {loading ? (
                  <Badge className="rounded-xl bg-slate-900 text-white">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Loading
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-slate-500">Pending signature · drafts · lab/radiology results</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={refresh} disabled={loading}>
                <RefreshCcw className={cn("mr-2 h-4 w-4", loading ? "animate-spin" : "")} /> Refresh
              </Button>
            </div>
          </div>

          {/* KPI */}
          <div className="mt-3 flex flex-wrap gap-2">
            <KpiPill label="All" value={counts.all} icon={ClipboardList} tone="bg-slate-50 text-slate-700 ring-slate-200" />
            <KpiPill label="Pending" value={counts.pending} icon={ShieldCheck} tone="bg-indigo-50 text-indigo-700 ring-indigo-200" />
            <KpiPill label="Drafts" value={counts.drafts} icon={PenLine} tone="bg-amber-50 text-amber-800 ring-amber-200" />
            <KpiPill label="Results" value={counts.results} icon={TestTube2} tone="bg-emerald-50 text-emerald-700 ring-emerald-200" />
            <KpiPill label="Urgent" value={counts.urgent} icon={AlertTriangle} tone="bg-rose-50 text-rose-700 ring-rose-200" />
          </div>

          {/* Filters */}
          <div className="mt-3 rounded-3xl border border-slate-200 bg-white/80 p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_220px_170px_170px_160px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title/note… (max 80 chars)"
                  className="h-10 rounded-2xl pl-9"
                />
              </div>

              <select
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
              >
                {deptOptions.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>Priority: {p}</option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>Sort: {s.label}</option>
                ))}
              </select>

              <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Filter className="h-4 w-4 text-slate-600" />
                  Group
                </div>
                <button
                  type="button"
                  onClick={() => setGrouping((s) => !s)}
                  className={cn(
                    "h-8 rounded-2xl px-3 text-xs font-semibold ring-1 transition",
                    grouping ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                  )}
                >
                  {grouping ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3">
            <Tabs value={tab} onValueChange={setTab}>
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsList className="w-max min-w-full justify-start gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                  {TABS.map((t) => (
                    <TabsTrigger key={t.key} value={t.key} className="whitespace-nowrap rounded-xl">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 md:px-6">
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[460px_1fr]">
          {/* List */}
          <Card className="min-h-0 rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
            <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Queue</CardTitle>
                  <div className="mt-1 text-xs text-slate-500">Select items to preview or bulk sign/ack.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-xl">{filtered.length} item(s)</Badge>
                  <button
                    type="button"
                    onClick={() => setGrouping((s) => !s)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-2xl px-3 text-xs font-semibold ring-1 transition",
                      grouping ? "bg-slate-900 text-white ring-slate-900 hover:bg-slate-800" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    )}
                    title="Toggle grouping"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    {grouping ? "Grouped" : "Flat"}
                  </button>
                </div>
              </div>

              {/* Bulk actions */}
              <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-xl bg-slate-900 text-white">
                      <ListChecks className="mr-1 h-3.5 w-3.5" />
                      Selected: {selectedCount}
                    </Badge>
                    <Button variant="outline" className="h-9 rounded-2xl" onClick={selectAllVisible} disabled={!filtered.length}>
                      Select All
                    </Button>
                    <Button variant="outline" className="h-9 rounded-2xl" onClick={clearSelection} disabled={!selectedCount}>
                      <Undo2 className="mr-2 h-4 w-4" /> Clear
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-9 rounded-2xl"
                      onClick={bulkAckSelected}
                      disabled={!selectedCount || !canBulkAck}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Ack Results
                    </Button>
                    <Button
                      className={cn("h-9 rounded-2xl", tone.btn)}
                      onClick={bulkSignSelected}
                      disabled={!selectedCount || !canBulkSign}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Sign Selected
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="min-h-0">
              <div className="max-h-[calc(100dvh-430px)] min-h-[280px] overflow-y-auto pr-1 lg:max-h-[calc(100dvh-380px)]">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading inbox…
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Fetching real-time items.</div>
                  </div>
                ) : grouping ? (
                  <div className="space-y-4">
                    <GroupBlock
                      title="Today"
                      subtitle="Updated today"
                      rows={grouped.TODAY || []}
                      selected={selected}
                      onToggle={toggleSelect}
                      activeId={activeId}
                      onOpen={(id) => {
                        setActiveId(id)
                        if (isMobile) setMobilePreviewOpen(true)
                      }}
                      busyIds={busyIds}
                    />
                    <GroupBlock
                      title="Yesterday"
                      subtitle="Updated yesterday"
                      rows={grouped.YESTERDAY || []}
                      selected={selected}
                      onToggle={toggleSelect}
                      activeId={activeId}
                      onOpen={(id) => {
                        setActiveId(id)
                        if (isMobile) setMobilePreviewOpen(true)
                      }}
                      busyIds={busyIds}
                    />
                    <GroupBlock
                      title="Older"
                      subtitle="Updated earlier"
                      rows={grouped.OLDER || []}
                      selected={selected}
                      onToggle={toggleSelect}
                      activeId={activeId}
                      onOpen={(id) => {
                        setActiveId(id)
                        if (isMobile) setMobilePreviewOpen(true)
                      }}
                      busyIds={busyIds}
                    />

                    {!filtered.length ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                        <div className="text-sm font-semibold text-slate-800">No items found</div>
                        <div className="mt-1 text-xs text-slate-500">Try clearing search/filters.</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((it) => (
                      <QueueItemCard
                        key={it.uid}
                        item={it}
                        active={it.uid === activeId}
                        selected={selected.has(it.uid)}
                        onToggle={() => toggleSelect(it.uid)}
                        onClick={() => {
                          setActiveId(it.uid)
                          if (isMobile) setMobilePreviewOpen(true)
                        }}
                        busy={busyIds.has(it.uid)}
                      />
                    ))}
                    {!filtered.length ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                        <div className="text-sm font-semibold text-slate-800">No items found</div>
                        <div className="mt-1 text-xs text-slate-500">Try clearing search/filters.</div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview desktop */}
          <div className="hidden min-h-0 lg:block">
            <PreviewPane item={active} onAction={doAction} busyIds={busyIds} />
          </div>
        </div>
      </div>

      {/* Mobile preview dialog */}
      <Dialog open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
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
                <DialogTitle className="text-base">Inbox Preview</DialogTitle>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => setMobilePreviewOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <PreviewPane item={active} onAction={doAction} compact busyIds={busyIds} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ---------- UI pieces ---------- */

function KpiPill({ label, value, icon: Icon, tone }) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ring-1", tone)}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="ml-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-slate-900 ring-1 ring-slate-200">
        {value}
      </span>
    </div>
  )
}

function PriorityBadge({ priority }) {
  const p = (priority || "NORMAL").toUpperCase()
  if (p === "URGENT") return <Badge className="rounded-xl bg-rose-600 text-white">URGENT</Badge>
  if (p === "HIGH") return <Badge className="rounded-xl bg-amber-500 text-white">HIGH</Badge>
  return (
    <Badge variant="outline" className="rounded-xl">
      NORMAL
    </Badge>
  )
}

function SelectCheck({ checked, onToggle, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle?.()
      }}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-2xl ring-1 transition",
        disabled ? "opacity-60" : "",
        checked ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
      )}
      aria-pressed={checked}
    >
      {checked ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
    </button>
  )
}

function GroupBlock({ title, subtitle, rows, selected, onToggle, activeId, onOpen, busyIds }) {
  if (!rows?.length) return null
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
        <Badge variant="outline" className="rounded-xl">
          {rows.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {rows.map((it) => (
          <QueueItemCard
            key={it.uid}
            item={it}
            active={it.uid === activeId}
            selected={selected.has(it.uid)}
            onToggle={() => onToggle(it.uid)}
            onClick={() => onOpen(it.uid)}
            busy={busyIds?.has(it.uid)}
          />
        ))}
      </div>
    </div>
  )
}

function QueueItemCard({ item, active, selected, onToggle, onClick, busy }) {
  const tone = deptTone(item.dept)
  const meta = kindMeta(item.kind)
  const Icon = meta.icon
  const abnormal = !!item.flags?.abnormal

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300",
        abnormal ? "ring-1 ring-amber-200" : "",
        busy ? "opacity-70" : ""
      )}
    >
      <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
      <div className={cn("p-4", active ? tone.glow : "")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <SelectCheck checked={!!selected} onToggle={onToggle} disabled={busy} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("rounded-xl", tone.chip)}>
                  <Building2 className="mr-1 h-3.5 w-3.5" />
                  {item.dept}
                </Badge>

                <Badge className={cn("rounded-xl", meta.chip)}>
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  {meta.label}
                </Badge>

                {item.flags?.confidential ? (
                  <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                    <Lock className="mr-1 h-3.5 w-3.5" /> Confidential
                  </Badge>
                ) : null}

                {abnormal ? (
                  <Badge className="rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Abnormal
                  </Badge>
                ) : null}
              </div>

              <div className="mt-2 truncate text-sm font-semibold text-slate-900">{item.title}</div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> {item.patient?.name} ({item.patient?.uhid})
                </span>
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> {item.visit?.type} · {item.visit?.id}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {fmtDate(item.updated_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" /> {fmtTime(item.updated_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <PriorityBadge priority={item.priority} />
            {item.flags?.attachments ? (
              <Badge variant="outline" className="rounded-xl">
                <Paperclip className="mr-1 h-3.5 w-3.5" />
                {item.flags.attachments}
              </Badge>
            ) : null}
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
              <ChevronRight className="h-4 w-4 text-slate-700" />
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

function PreviewPane({ item, onAction, compact = false, busyIds }) {
  const tone = deptTone(item?.dept || "General Medicine")
  const meta = item ? kindMeta(item.kind) : null
  const Icon = meta?.icon || FileText
  const isBusy = item ? busyIds?.has(item.uid) : false

  const actions = useMemo(() => {
    if (!item) return []
    if (item.kind === "PENDING_SIGN")
      return [
        { key: "OPEN", label: "Open", icon: FileText, variant: "outline" },
        { key: "SIGN", label: "Sign", icon: CheckCircle2, primary: true },
      ]
    if (item.kind === "DRAFT") return [{ key: "CONTINUE", label: "Continue Draft", icon: PenLine, primary: true }]
    if (item.kind === "RESULT_LAB" || item.kind === "RESULT_RAD")
      return [
        { key: "OPEN", label: "Open Report", icon: FileText, variant: "outline" },
        { key: "ACK_RESULT", label: "Acknowledge", icon: CheckCircle2, primary: true },
      ]
    return [{ key: "OPEN", label: "Open", icon: FileText, primary: true }]
  }, [item])

  return (
    <Card className={cn("min-h-0 rounded-3xl border-slate-200 bg-white/85 shadow-sm backdrop-blur", tone.glow)}>
      <div className={cn("h-2 w-full rounded-t-3xl bg-gradient-to-r", tone.bar)} />
      <CardHeader className={cn("pb-2", compact ? "px-0" : "")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Preview</CardTitle>
            <div className="mt-1 text-xs text-slate-500">Details + quick actions</div>
          </div>

          {item ? (
            <Badge className={cn("rounded-xl", meta?.chip)}>
              <Icon className="mr-1 h-3.5 w-3.5" /> {meta?.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-xl">
              No Selection
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn("min-h-0", compact ? "px-0" : "")}>
        <AnimatePresence mode="wait">
          {!item ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center"
            >
              <div className="text-sm font-semibold text-slate-800">Select an inbox item</div>
              <div className="mt-1 text-xs text-slate-500">Preview, sign, complete drafts, or review results.</div>
            </motion.div>
          ) : (
            <motion.div
              key={item.uid}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("rounded-xl", tone.chip)}>
                  <Building2 className="mr-1 h-3.5 w-3.5" /> {item.dept}
                </Badge>
                <Badge variant="outline" className="rounded-xl">
                  <Layers className="mr-1 h-3.5 w-3.5" /> {item.visit?.type} · {item.visit?.id}
                </Badge>
                <PriorityBadge priority={item.priority} />
                {item.flags?.confidential ? (
                  <Badge className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                    <Lock className="mr-1 h-3.5 w-3.5" /> Confidential
                  </Badge>
                ) : null}
                {item.flags?.abnormal ? (
                  <Badge className="rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Abnormal
                  </Badge>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Updated {fmtDate(item.updated_at)} · {fmtTime(item.updated_at)}
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <InfoRow label="Patient" value={`${item.patient?.name} (${item.patient?.uhid})`} icon={User} />
                  <InfoRow label="Age/Gender" value={`${item.patient?.age || "—"} / ${item.patient?.gender || "—"}`} icon={ClipboardList} />
                  <InfoRow label="Type" value={item.visit?.type || "—"} icon={Layers} />
                  <InfoRow label="Encounter" value={item.visit?.id || "—"} icon={FileText} />
                </div>

                {(item.preview?.summary || []).length ? (
                  <>
                    <Separator className="my-4" />
                    <div className="text-xs font-semibold text-slate-700">Quick Summary</div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {item.preview.summary.slice(0, 8).map((x, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Dot className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span className="min-w-0">{x}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {(item.preview?.sections || []).length ? (
                  <>
                    <Separator className="my-4" />
                    <div className="text-xs font-semibold text-slate-700">Sections</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.preview.sections.slice(0, 12).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-700">Actions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {actions.map((a) => {
                    const AIcon = a.icon || FileText
                    const primary = !!a.primary
                    return (
                      <Button
                        key={a.key}
                        variant={primary ? "default" : a.variant || "outline"}
                        className={cn("rounded-2xl", primary ? tone.btn : "")}
                        onClick={() => onAction?.(a.key, item)}
                        disabled={isBusy}
                      >
                        <AIcon className="mr-2 h-4 w-4" />
                        {a.label}
                      </Button>
                    )
                  })}
                </div>

                {isBusy ? (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value, icon: Icon }) {
  const I = Icon || FileText
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
        <I className="h-5 w-5 text-slate-700" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  )
}
