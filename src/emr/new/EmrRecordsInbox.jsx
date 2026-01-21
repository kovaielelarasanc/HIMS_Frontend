// FILE: frontend/src/emr/EmrRecordsInbox.jsx
import React, { useEffect, useMemo, useState } from "react"
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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * ✅ EMR Records Inbox (Daily Work Queue) — UI Only (Error-free + Responsive)
 * - Tabs: All / Pending Signature / Drafts / Results
 * - Search + Filters (Dept, Priority, Mine, Sort)
 * - Smart grouping: Today / Yesterday / Older (based on updated_at)
 * - Multi-select + Bulk actions:
 *    - Sign Selected (pending signature)
 *    - Acknowledge Selected (results)
 *    - Clear selection / Select all
 * - Left list + Right preview (desktop)
 * - Mobile: preview opens in full-screen dialog with scroll
 *
 * Backend later:
 * - GET /emr/inbox?tab=&q=&dept=&priority=&mine=&sort=
 * - POST /emr/records/{id}/sign
 * - POST /emr/results/{id}/ack
 */

const TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING_SIGN", label: "Pending Signature" },
  { key: "DRAFTS", label: "Drafts to Complete" },
  { key: "RESULTS", label: "New Results" },
]

const DEPARTMENTS = [
  "ALL",
  "Common (All)",
  "General Medicine",
  "General Surgery",
  "OBGYN",
  "Cardiology",
  "Orthopedics",
  "ICU",
  "Pathology/Lab",
  "Radiology",
]

const PRIORITIES = ["ALL", "NORMAL", "HIGH", "URGENT"]
const SORTS = [
  { key: "UPDATED_DESC", label: "Latest Updated" },
  { key: "DUE_ASC", label: "Due Soon" },
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
function minutesFromNow(d) {
  try {
    const ms = new Date(d).getTime() - Date.now()
    return Math.round(ms / 60000)
  } catch {
    return null
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

function buildDemoInbox() {
  return [
    {
      id: "REC-OP-00021",
      kind: "PENDING_SIGN",
      dept: "OBGYN",
      title: "OBGYN OPD Note · LMP/EDD Review",
      patient: { name: "Pavithra S", uhid: "NH-000001", age: 26, gender: "F", phone: "9600457842" },
      visit: { type: "OP", id: "OP-2026-00122", doctor: "Dr. K. Priya" },
      assigned_to: "You",
      priority: "HIGH",
      due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      flags: { confidential: false, abnormal: false, attachments: 1 },
      preview: {
        summary: ["Chief Complaint: Lower abdominal pain", "Assessment: Early pregnancy follow-up", "Plan: USG + labs"],
        sections: ["Chief Complaint", "History", "Exam", "Assessment", "Plan"],
      },
    },
    {
      id: "REC-IP-00008",
      kind: "DRAFT",
      dept: "ICU",
      title: "ICU Progress Note (Draft)",
      patient: { name: "Ramesh K", uhid: "NH-000124", age: 58, gender: "M" },
      visit: { type: "IP", id: "IP-2026-00033", doctor: "Dr. A. Selvam" },
      assigned_to: "You",
      priority: "URGENT",
      due_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      flags: { confidential: true, abnormal: false, attachments: 0 },
      preview: {
        summary: ["Ventilator: SIMV", "ABG: Pending", "Infusions: Noradrenaline", "Plan: Titrate + repeat ABG"],
        sections: ["Ventilator", "ABG", "Infusions", "Plan"],
      },
    },
    {
      id: "RES-LAB-90331",
      kind: "RESULT_LAB",
      dept: "Pathology/Lab",
      title: "CBC Result · Alert",
      patient: { name: "Sathya V", uhid: "NH-000342", age: 39, gender: "F" },
      visit: { type: "OP", id: "OP-2026-00118", doctor: "Dr. R. Kumar" },
      assigned_to: "Team",
      priority: "HIGH",
      due_at: null,
      updated_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      flags: { confidential: false, abnormal: true, attachments: 1 },
      preview: {
        summary: ["Hb: 8.4 (Low)", "WBC: 14,200 (High)", "Platelets: 1.1L (Low)"],
        sections: ["Hb", "WBC", "Platelets"],
      },
    },
    {
      id: "RES-RAD-11802",
      kind: "RESULT_RAD",
      dept: "Radiology",
      title: "USG Abdomen · Report Ready",
      patient: { name: "Naveen P", uhid: "NH-000415", age: 44, gender: "M" },
      visit: { type: "ER", id: "ER-2026-00009", doctor: "Dr. M. Vignesh" },
      assigned_to: "You",
      priority: "NORMAL",
      due_at: null,
      updated_at: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      flags: { confidential: false, abnormal: false, attachments: 1 },
      preview: {
        summary: ["Impression: No acute abnormality", "Advice: Clinical correlation"],
        sections: ["Findings", "Impression", "Advice"],
      },
    },
    {
      id: "REC-OP-00019",
      kind: "PENDING_SIGN",
      dept: "Cardiology",
      title: "Cardiology OPD Note · Chest Pain",
      patient: { name: "Lakshmi R", uhid: "NH-000088", age: 47, gender: "F" },
      visit: { type: "OP", id: "OP-2026-00117", doctor: "Dr. S. Prakash" },
      assigned_to: "Team",
      priority: "NORMAL",
      due_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // yesterday
      flags: { confidential: false, abnormal: false, attachments: 0 },
      preview: {
        summary: ["ECG: Sinus rhythm", "Assessment: Rule out ACS", "Plan: Troponin + Echo"],
        sections: ["Symptoms", "Risk Factors", "ECG", "Plan"],
      },
    },
    {
      id: "RES-LAB-90011",
      kind: "RESULT_LAB",
      dept: "Pathology/Lab",
      title: "RFT · Result Ready",
      patient: { name: "Prakash S", uhid: "NH-000022", age: 51, gender: "M" },
      visit: { type: "OP", id: "OP-2026-00105", doctor: "Dr. A. Vasanth" },
      assigned_to: "You",
      priority: "NORMAL",
      due_at: null,
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // older
      flags: { confidential: false, abnormal: false, attachments: 1 },
      preview: { summary: ["Creatinine: 1.1", "Urea: 28", "eGFR: 78"], sections: ["Urea", "Creatinine", "eGFR"] },
    },
  ]
}

export default function EmrRecordsInbox() {
  const isMobile = useIsMobile(1024)

  const [tab, setTab] = useState("ALL")
  const [q, setQ] = useState("")
  const [dept, setDept] = useState("ALL")
  const [priority, setPriority] = useState("ALL")
  const [mine, setMine] = useState(true)
  const [sort, setSort] = useState("UPDATED_DESC")
  const [grouping, setGrouping] = useState(true)

  const [rows, setRows] = useState(() => buildDemoInbox())

  const [activeId, setActiveId] = useState(rows?.[0]?.id || null)
  const active = useMemo(() => rows.find((r) => r.id === activeId) || null, [rows, activeId])

  // Multi-select state
  const [selected, setSelected] = useState(() => new Set())
  const selectedCount = selected.size

  const tone = deptTone(active?.dept || (dept !== "ALL" ? dept : "General Medicine"))

  const counts = useMemo(() => {
    const all = rows.length
    const pending = rows.filter((r) => r.kind === "PENDING_SIGN").length
    const drafts = rows.filter((r) => r.kind === "DRAFT").length
    const results = rows.filter((r) => r.kind === "RESULT_LAB" || r.kind === "RESULT_RAD").length
    const urgent = rows.filter((r) => r.priority === "URGENT").length
    return { all, pending, drafts, results, urgent }
  }, [rows])

  const filtered = useMemo(() => {
    const qq = (q || "").trim().toLowerCase()
    let x = [...rows]

    if (tab !== "ALL") {
      if (tab === "PENDING_SIGN") x = x.filter((r) => r.kind === "PENDING_SIGN")
      if (tab === "DRAFTS") x = x.filter((r) => r.kind === "DRAFT")
      if (tab === "RESULTS") x = x.filter((r) => r.kind === "RESULT_LAB" || r.kind === "RESULT_RAD")
    }
    if (dept !== "ALL") x = x.filter((r) => (r.dept || "").toUpperCase() === dept.toUpperCase())
    if (priority !== "ALL") x = x.filter((r) => (r.priority || "NORMAL") === priority)
    if (mine) x = x.filter((r) => (r.assigned_to || "").toUpperCase() === "YOU")

    if (qq) {
      x = x.filter((r) => {
        const hay = `${r.id} ${r.title} ${r.dept} ${r.kind} ${r.patient?.name} ${r.patient?.uhid} ${r.visit?.id} ${r.visit?.doctor}`.toLowerCase()
        return hay.includes(qq)
      })
    }

    const prRank = { URGENT: 3, HIGH: 2, NORMAL: 1 }
    const ts = (d) => (d ? new Date(d).getTime() : 0)

    if (sort === "UPDATED_DESC") x.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
    if (sort === "DUE_ASC") x.sort((a, b) => ts(a.due_at) - ts(b.due_at))
    if (sort === "PRIORITY_DESC") x.sort((a, b) => (prRank[b.priority] || 0) - (prRank[a.priority] || 0))

    return x
  }, [rows, tab, q, dept, priority, mine, sort])

  // Grouped list
  const grouped = useMemo(() => {
    if (!grouping) return { ALL: filtered }
    const out = { TODAY: [], YESTERDAY: [], OLDER: [] }
    for (const it of filtered) out[dateKey(it.updated_at)].push(it)
    return out
  }, [filtered, grouping])

  // Keep activeId valid
  useEffect(() => {
    if (!activeId && filtered[0]?.id) setActiveId(filtered[0].id)
    if (activeId && !filtered.some((r) => r.id === activeId) && filtered[0]?.id) setActiveId(filtered[0].id)
  }, [filtered, activeId])

  // Clear selection if items disappear
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set()
      const allowed = new Set(filtered.map((x) => x.id))
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id)
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((x) => x.id).join("|")])

  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  useEffect(() => {
    if (!isMobile) setMobilePreviewOpen(false)
  }, [isMobile])

  const selectedItems = useMemo(() => filtered.filter((x) => selected.has(x.id)), [filtered, selected])
  const canBulkSign = useMemo(() => selectedItems.some((x) => x.kind === "PENDING_SIGN"), [selectedItems])
  const canBulkAck = useMemo(() => selectedItems.some((x) => x.kind === "RESULT_LAB" || x.kind === "RESULT_RAD"), [selectedItems])

  function clearFilters() {
    setQ("")
    setDept("ALL")
    setPriority("ALL")
    setMine(true)
    setSort("UPDATED_DESC")
    toast.success("Filters cleared")
  }

  function refresh() {
    toast.success("Inbox refreshed (UI only)")
    setRows((p) => [...p])
  }

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
      filtered.forEach((x) => next.add(x.id))
      return next
    })
    toast.success("Selected all visible items")
  }

  function clearSelection() {
    setSelected(new Set())
    toast.success("Selection cleared")
  }

  function bulkSignSelected() {
    if (!canBulkSign) return toast.error("No pending signature items selected")
    const ids = selectedItems.filter((x) => x.kind === "PENDING_SIGN").map((x) => x.id)
    // UI-only: remove them from queue
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    toast.success(`Signed ${ids.length} record(s) (UI only)`)
  }

  function bulkAckSelected() {
    if (!canBulkAck) return toast.error("No results selected to acknowledge")
    const ids = selectedItems
      .filter((x) => x.kind === "RESULT_LAB" || x.kind === "RESULT_RAD")
      .map((x) => x.id)
    // UI-only: remove them from queue
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    toast.success(`Acknowledged ${ids.length} result(s) (UI only)`)
  }

  function doAction(action, item) {
    if (!item) return
    if (action === "OPEN") toast("Open item (wire route later)")
    if (action === "SIGN") {
      toast.success("Signed successfully (UI only)")
      setRows((prev) => prev.filter((r) => r.id !== item.id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
    if (action === "CONTINUE") toast("Continue draft (wire editor later)")
    if (action === "ACK_RESULT") {
      toast.success("Result acknowledged (UI only)")
      setRows((prev) => prev.filter((r) => r.id !== item.id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-indigo-50/60 via-white to-rose-50/60">
      {/* Sticky page header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={cn("h-2.5 w-2.5 rounded-full bg-gradient-to-r", tone.bar)} />
                <div className="text-[15px] font-semibold text-slate-900">Records Inbox</div>
                <Badge variant="outline" className="rounded-xl">
                  Daily Work Queue
                </Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Pending signature · drafts to complete · new lab/radiology results
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={refresh}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>

          {/* KPI pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            <KpiPill label="All" value={counts.all} icon={ClipboardList} tone="bg-slate-50 text-slate-700 ring-slate-200" />
            <KpiPill label="Pending" value={counts.pending} icon={ShieldCheck} tone="bg-indigo-50 text-indigo-700 ring-indigo-200" />
            <KpiPill label="Drafts" value={counts.drafts} icon={PenLine} tone="bg-amber-50 text-amber-800 ring-amber-200" />
            <KpiPill label="Results" value={counts.results} icon={TestTube2} tone="bg-emerald-50 text-emerald-700 ring-emerald-200" />
            <KpiPill label="Urgent" value={counts.urgent} icon={AlertTriangle} tone="bg-rose-50 text-rose-700 ring-rose-200" />
          </div>

          {/* Filters bar */}
          <div className="mt-3 rounded-3xl border border-slate-200 bg-white/80 p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_180px_160px_150px_140px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search patient / UHID / record / visit / doctor…"
                  className="h-10 rounded-2xl pl-9"
                />
              </div>

              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    Priority: {p}
                  </option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    Sort: {s.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Filter className="h-4 w-4 text-slate-600" />
                  Mine
                </div>
                <button
                  type="button"
                  onClick={() => setMine((s) => !s)}
                  className={cn(
                    "h-8 rounded-2xl px-3 text-xs font-semibold ring-1 transition",
                    mine ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                  )}
                >
                  {mine ? "ON" : "OFF"}
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

      {/* Body: split list + preview (scroll-safe) */}
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
                  <Badge variant="outline" className="rounded-xl">
                    {filtered.length} item(s)
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setGrouping((s) => !s)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-2xl px-3 text-xs font-semibold ring-1 transition",
                      grouping
                        ? "bg-slate-900 text-white ring-slate-900 hover:bg-slate-800"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
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
                      title="Acknowledge selected results"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Ack Results
                    </Button>
                    <Button
                      className={cn("h-9 rounded-2xl", tone.btn)}
                      onClick={bulkSignSelected}
                      disabled={!selectedCount || !canBulkSign}
                      title="Sign selected pending records"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Sign Selected
                    </Button>
                  </div>
                </div>

                {!selectedCount ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Tip: select multiple items to quickly sign/ack in one shot.
                  </div>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="min-h-0">
              <div className="max-h-[calc(100dvh-430px)] min-h-[280px] overflow-y-auto pr-1 lg:max-h-[calc(100dvh-380px)]">
                {grouping ? (
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
                        key={it.id}
                        item={it}
                        active={it.id === activeId}
                        selected={selected.has(it.id)}
                        onToggle={() => toggleSelect(it.id)}
                        onClick={() => {
                          setActiveId(it.id)
                          if (isMobile) setMobilePreviewOpen(true)
                        }}
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

          {/* Preview (desktop) */}
          <div className="hidden min-h-0 lg:block">
            <PreviewPane item={active} onAction={doAction} />
          </div>
        </div>
      </div>

      {/* Mobile preview dialog (full screen + scroll safe) */}
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
              <PreviewPane item={active} onAction={doAction} compact />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** ---------- UI pieces ---------- */

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

function SelectCheck({ checked, onToggle, title }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle?.()
      }}
      title={title || (checked ? "Unselect" : "Select")}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-2xl ring-1 transition",
        checked ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
      )}
      aria-pressed={checked}
    >
      {checked ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
    </button>
  )
}

function GroupBlock({ title, subtitle, rows, selected, onToggle, activeId, onOpen }) {
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
            key={it.id}
            item={it}
            active={it.id === activeId}
            selected={selected.has(it.id)}
            onToggle={() => onToggle(it.id)}
            onClick={() => onOpen(it.id)}
          />
        ))}
      </div>
    </div>
  )
}

function QueueItemCard({ item, active, selected, onToggle, onClick }) {
  const tone = deptTone(item.dept)
  const meta = kindMeta(item.kind)
  const Icon = meta.icon

  const dueMin = item.due_at ? minutesFromNow(item.due_at) : null
  const dueText =
    dueMin == null
      ? null
      : dueMin <= 0
        ? "Due now"
        : dueMin < 60
          ? `Due in ${dueMin} min`
          : `Due in ${Math.round(dueMin / 60)} hr`

  const abnormal = !!item.flags?.abnormal

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition",
        active ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300",
        abnormal ? "ring-1 ring-amber-200" : ""
      )}
    >
      <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.bar)} />
      <div className={cn("p-4", active ? tone.glow : "")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <SelectCheck checked={!!selected} onToggle={onToggle} />
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
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" /> {item.visit?.doctor}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {fmtDate(item.updated_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" /> {fmtTime(item.updated_at)}
                </span>
                {dueText ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 ring-1",
                      dueMin != null && dueMin <= 30
                        ? "bg-rose-50 text-rose-700 ring-rose-200"
                        : "bg-slate-50 text-slate-700 ring-slate-200"
                    )}
                  >
                    <Dot className="h-4 w-4" />
                    {dueText}
                  </span>
                ) : null}
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

function PreviewPane({ item, onAction, compact = false }) {
  const tone = deptTone(item?.dept || "General Medicine")
  const meta = item ? kindMeta(item.kind) : null
  const Icon = meta?.icon || FileText

  const actions = useMemo(() => {
    if (!item) return []
    if (item.kind === "PENDING_SIGN")
      return [
        { key: "OPEN", label: "Open", icon: FileText, variant: "outline" },
        { key: "SIGN", label: "Sign", icon: CheckCircle2, primary: true },
      ]
    if (item.kind === "DRAFT")
      return [{ key: "CONTINUE", label: "Continue Draft", icon: PenLine, primary: true }]
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
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Header chips */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("rounded-xl", tone.chip)}>
                  <Building2 className="mr-1 h-3.5 w-3.5" /> {item.dept}
                </Badge>
                <Badge variant="outline" className="rounded-xl">
                  <Layers className="mr-1 h-3.5 w-3.5" /> {item.visit?.type} · {item.visit?.id}
                </Badge>
                <Badge variant="outline" className="rounded-xl">
                  <Stethoscope className="mr-1 h-3.5 w-3.5" /> {item.visit?.doctor}
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
                  <InfoRow label="Assigned" value={item.assigned_to || "—"} icon={ShieldCheck} />
                  <InfoRow
                    label="Due"
                    value={item.due_at ? `${fmtDate(item.due_at)} · ${fmtTime(item.due_at)}` : "—"}
                    icon={Clock3}
                  />
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
                      {item.preview.sections.length > 12 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          +{item.preview.sections.length - 12} more
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>

              {/* Actions */}
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
                      >
                        <AIcon className="mr-2 h-4 w-4" />
                        {a.label}
                      </Button>
                    )
                  })}
                </div>

                {item.kind === "PENDING_SIGN" ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                    <ShieldCheck className="h-4 w-4" />
                    Signing will lock the record and create an audit trail (backend later).
                  </div>
                ) : null}

                {item.kind === "DRAFT" ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <PenLine className="h-4 w-4" />
                    Complete required fields before signing.
                  </div>
                ) : null}

                {(item.kind === "RESULT_LAB" || item.kind === "RESULT_RAD") && item.flags?.abnormal ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                    <AlertTriangle className="h-4 w-4" />
                    Abnormal result flagged. Review and acknowledge.
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
