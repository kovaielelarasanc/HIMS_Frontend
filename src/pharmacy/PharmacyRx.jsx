// FILE: src/pages/PharmacyRx.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import {
  listPharmacyPrescriptions,
  createPharmacyPrescription,
  getPharmacyPrescription,
} from "../api/pharmacyRx"

import { listPatients, getPatientById } from "../api/patients"
import { getDoctorlist } from "../api/billing"
import { searchItemBatches } from "../api/inventory"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  Pill,
  ClipboardList,
  User,
  Search,
  Plus,
  ArrowLeft,
  Filter,
  Clock3,
  Stethoscope,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Phone,
  Calendar,
  BadgeCheck,
  IdCard,
  MapPin,
} from "lucide-react"

/* ----------------------------- helpers ----------------------------- */

function todayDateTimeLocal() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function fmtDT(x) {
  if (!x) return "—"
  try {
    const s = String(x)
    return s.replace("T", " ").slice(0, 16)
  } catch {
    return "—"
  }
}

function safeStr(x) {
  return (x ?? "").toString()
}

function fmtDateShort(x) {
  if (!x) return "—"
  try {
    const d = new Date(x)
    if (Number.isNaN(d.getTime())) return String(x)
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" })
  } catch {
    return "—"
  }
}

function fmtQty(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return safeStr(v) || "0"
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function isExpired(expiry) {
  if (!expiry) return false
  const d = new Date(expiry)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  d.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return d < today
}

function useDebouncedValue(value, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      const el = ref?.current
      if (!el) return
      if (el.contains(event.target)) return
      handler?.(event)
    }
    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)
    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [ref, handler])
}

const normalizeFreq = (v = "") =>
  String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== "") return v
  }
  return fallback
}

const parseFrequencyToPerDay = (freq = "") => {
  const f = normalizeFreq(freq)
  // allow 2..4 segments: 1-0-1 or 1-0-1-0
  if (/^\d+(?:-\d+){1,3}$/.test(f)) {
    return f
      .split("-")
      .reduce((sum, x) => sum + (Number(x) || 0), 0)
  }
  if (["OD", "QD", "ONCE", "HS", "QHS"].includes(f)) return 1
  if (["BD", "BID"].includes(f)) return 2
  if (["TID", "TDS"].includes(f)) return 3
  if (["QID", "QDS"].includes(f)) return 4
  return 0
}

const parseDoseMultiplier = (dose = "") => {
  const m = String(dose || "").match(/(\d+(\.\d+)?)/)
  const n = m ? Number(m[1]) : 1
  return Number.isFinite(n) && n > 0 ? n : 1
}

const SLOT_KEYS = ["M", "A", "E", "N"]
const SLOT_META = {
  M: { label: "Morning" },
  A: { label: "Afternoon" },
  E: { label: "Evening" },
  N: { label: "Night" },
}

function emptySlots() {
  return { M: 0, A: 0, E: 0, N: 0 }
}

function clampInt(v, min, max) {
  const n = Math.trunc(Number(v))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

function slotsToFrequency(slots) {
  const s = slots || emptySlots()
  return SLOT_KEYS.map((k) => clampInt(s[k] ?? 0, 0, 9)).join("-")
}

function frequencyToSlots(freq) {
  const f = safeStr(freq).trim().toUpperCase()
  const s = emptySlots()

  const preset = {
    OD: { M: 1, A: 0, E: 0, N: 0 },
    QD: { M: 1, A: 0, E: 0, N: 0 },
    ONCE: { M: 1, A: 0, E: 0, N: 0 },

    BD: { M: 1, A: 0, E: 0, N: 1 },
    BID: { M: 1, A: 0, E: 0, N: 1 },

    TID: { M: 1, A: 1, E: 1, N: 0 },
    TDS: { M: 1, A: 1, E: 1, N: 0 },

    QID: { M: 1, A: 1, E: 1, N: 1 },
    QDS: { M: 1, A: 1, E: 1, N: 1 },

    HS: { M: 0, A: 0, E: 0, N: 1 },
    QHS: { M: 0, A: 0, E: 0, N: 1 },
  }

  if (preset[f]) return { ...s, ...preset[f] }

  if (f.includes("-")) {
    const parts = f.split("-").map((x) => clampInt(x || 0, 0, 9))
    s.M = parts[0] ?? 0
    s.A = parts[1] ?? 0
    s.E = parts[2] ?? 0
    s.N = parts[3] ?? 0
    return s
  }

  return s
}

function perDayFromSlots(slots) {
  const s = slots || emptySlots()
  return SLOT_KEYS.reduce((sum, k) => sum + (Number(s[k]) || 0), 0)
}

const calcAutoQty = (line) => {
  const days = Number(line?.duration_days || 0)
  if (!Number.isFinite(days) || days <= 0) return ""

  const slots = line?.dose_slots
  const perDayFromSlot = slots ? perDayFromSlots(slots) : 0

  const perDay =
    perDayFromSlot > 0
      ? perDayFromSlot
      : parseFrequencyToPerDay(line?.frequency || "")

  if (!perDay) return ""

  const doseMul = parseDoseMultiplier(line?.dose || "")
  return String(Math.round(perDay * days * doseMul))
}

function applyAuto(line) {
  const next = { ...line }
  next.frequency = slotsToFrequency(next.dose_slots || emptySlots())
  const qty = calcAutoQty(next)
  next.total_qty = qty
  next.requested_qty = qty
  return next
}

function toInt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function getPatientDisplay(p) {
  if (!p) return "—"
  const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.name || ""
  const uhid = p.uhid ? `UHID: ${p.uhid}` : ""
  const phone = p.phone ? `Ph: ${p.phone}` : ""
  return [name, uhid, phone].filter(Boolean).join(" • ")
}

function getPatientName(p) {
  if (!p) return "—"
  return (
    `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
    p.name ||
    `Patient #${p.id || ""}` ||
    "—"
  )
}

function getPatientAgeGender(p) {
  if (!p) return ""
  const a = pick(p, ["age", "age_years"], "")
  const g = pick(p, ["gender", "sex"], "")
  return [a ? `${a}y` : "", g].filter(Boolean).join(" • ")
}

function normalizeLine(l) {
  const itemName = pick(l, ["item_name", "medicine_name", "name", "itemName"], "")
  const strength = pick(l, ["strength", "item_strength", "itemStrength"], "")
  const dose = pick(l, ["dose", "dosage", "dose_text", "doseText"], "")

  const frequency = pick(
    l,
    ["frequency", "frequency_code", "freq", "dosage_frequency", "frequency_text", "freq_code"],
    ""
  )

  const duration_days = pick(l, ["duration_days", "days", "duration", "duration_day"], "")
  const route = pick(l, ["route", "route_code", "administration_route"], "")
  const instructions = pick(l, ["instructions", "sig", "remarks", "instruction"], "")
  const qty = pick(l, ["total_qty", "requested_qty", "qty", "quantity"], "")

  return {
    itemName,
    strength,
    dose,
    frequency,
    duration_days,
    route,
    instructions,
    qty,
    dispensed_qty: pick(l, ["dispensed_qty", "dispensedQty"], ""),
    remaining_qty: pick(l, ["remaining_qty", "remainingQty"], ""),
  }
}

/* ------------------------------ constants ------------------------------ */

const RX_TYPES = [
  { value: "OPD", label: "OPD" },
  { value: "IPD", label: "IPD" },
  { value: "OT", label: "OT" },
  { value: "COUNTER", label: "Counter" },
]

const PRIORITIES = [
  { value: "ROUTINE", label: "Routine" },
  { value: "STAT", label: "STAT / Urgent" },
  { value: "PRN", label: "PRN / As needed" },
]

const FREQ_PRESETS = [
  { label: "OD", value: "OD" },
  { label: "BD", value: "BD" },
  { label: "TID", value: "TID" },
  { label: "QID", value: "QID" },
  { label: "1-0-0-0", value: "1-0-0-0" },
  { label: "1-0-0-1", value: "1-0-0-1" },
  { label: "1-1-0-1", value: "1-1-0-1" },
  { label: "1-1-1-1", value: "1-1-1-1" },
  { label: "0-0-0-1", value: "0-0-0-1" },
  { label: "0-1-0-0", value: "0-1-0-0" },
]

const ROUTE_PRESETS = ["PO", "IV", "IM", "SC", "PR", "INH", "TOP"]

const makeEmptyHeader = () => ({
  type: "OPD",
  priority: "ROUTINE",
  datetime: todayDateTimeLocal(),
  patient: null,
  doctorId: "",
  visitNo: "",
  admissionNo: "",
  otCaseNo: "",
  notes: "",
})

const makeEmptyLine = () => ({
  item: null,
  item_id: null,
  item_name: "",
  strength: "",
  route: "PO",
  dose_slots: { M: 0, A: 0, E: 0, N: 0 },
  frequency: "",
  duration_days: "",
  total_qty: "",
  requested_qty: "",
  dose: "",
  instructions: "",
  is_prn: false,
  is_stat: false,

  batch_id: null,
  batch_no: "",
  expiry_date: null,
  available_qty: "",
})

/* ------------------------------ UI helpers ------------------------------ */

function GlassCard({ className = "", children }) {
  return (
    <Card
      className={[
        "rounded-3xl border border-slate-500/70",
        "bg-white/70 backdrop-blur-xl",
        "shadow-[0_12px_30px_rgba(0,0,0,0.06)]",
        "ring-1 ring-black/[0.03]",
        className,
      ].join(" ")}
    >
      {children}
    </Card>
  )
}

function SegmentedTabs() {
  return (
    <TabsList className="w-full sm:w-auto rounded-full bg-white/70 backdrop-blur border border-slate-500 p-1 shadow-sm">
      <TabsTrigger
        value="list"
        className="rounded-full px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
      >
        Queue
      </TabsTrigger>
      <TabsTrigger
        value="new"
        className="rounded-full px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
      >
        New
      </TabsTrigger>
      <TabsTrigger
        value="detail"
        className="rounded-full px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
      >
        Selected
      </TabsTrigger>
    </TabsList>
  )
}

function StatusPill({ status }) {
  const s = (status || "").toUpperCase()
  let label = s || "PENDING"
  let cls = "bg-white/70 text-slate-700 border border-slate-500"

  if (s === "PENDING" || s === "NEW") {
    label = "Pending"
    cls = "bg-amber-50/80 text-amber-700 border border-amber-200"
  } else if (s === "PARTIAL") {
    label = "Partial"
    cls = "bg-blue-50/80 text-blue-700 border border-blue-200"
  } else if (s === "DISPENSED" || s === "COMPLETED") {
    label = "Dispensed"
    cls = "bg-emerald-50/80 text-emerald-700 border border-emerald-200"
  } else if (s === "CANCELLED") {
    label = "Cancelled"
    cls = "bg-rose-50/80 text-rose-700 border border-rose-200"
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-full ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {label}
    </span>
  )
}

function PatientSummaryCard({ patient, loading }) {
  const name = getPatientName(patient)
  const uhid = pick(patient, ["uhid", "patient_uhid"], "—")
  const phone = pick(patient, ["phone", "mobile", "contact"], "—")
  const gender = pick(patient, ["gender", "sex"], "")
  const age = pick(patient, ["age", "age_years"], "")
  const dob = pick(patient, ["dob", "date_of_birth"], "")
  const blood = pick(patient, ["blood_group", "bloodGroup"], "")
  const address = pick(patient, ["address", "current_address", "full_address"], "")
  const city = pick(patient, ["city"], "")
  const state = pick(patient, ["state"], "")
  const pin = pick(patient, ["pincode", "pin"], "")
  const addrLine = [address, city, state, pin].filter(Boolean).join(", ")

  return (
    <div className="rounded-3xl border border-slate-500 bg-white/70 backdrop-blur p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {loading ? "Loading patient..." : name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {loading ? "—" : [age ? `${age}y` : "", gender].filter(Boolean).join(" • ") || "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <IdCard className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700">UHID:</span> {uhid}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700">Phone:</span> {phone}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700">DOB:</span> {dob || "—"}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <BadgeCheck className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700">Blood:</span> {blood || "—"}
            </div>
          </div>

          {addrLine ? (
            <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-medium text-slate-700">Address:</span> {addrLine}
              </div>
            </div>
          ) : null}
        </div>

        <Badge variant="outline" className="rounded-full text-[11px] border-slate-500">
          Patient
        </Badge>
      </div>
    </div>
  )
}

// supports payloads like: array OR {items:[]} OR {data:{items:[]}}
function unwrapList(res) {
  const d = res?.data?.data ?? res?.data
  if (!d) return []
  if (Array.isArray(d)) return d
  if (Array.isArray(d.items)) return d.items
  if (Array.isArray(d.rows)) return d.rows
  if (Array.isArray(d.results)) return d.results
  return []
}

/* -------------------------------- component ------------------------------- */

export default function PharmacyRx() {
  const [tab, setTab] = useState("list") // 'list' | 'new' | 'detail'

  // Queue/List
  const [rxTypeFilter, setRxTypeFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 350)
  const [listLoading, setListLoading] = useState(false)
  const [rxList, setRxList] = useState([])
  const [selectedRx, setSelectedRx] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // New Rx type picker
  const [newType, setNewType] = useState("OPD")

  // Form
  const [header, setHeader] = useState(makeEmptyHeader)
  const [lines, setLines] = useState([])
  const [currentLine, setCurrentLine] = useState(makeEmptyLine)
  const [submitting, setSubmitting] = useState(false)

  // Patient search
  const [patientQuery, setPatientQuery] = useState("")
  const debouncedPatientQuery = useDebouncedValue(patientQuery, 250)
  const [patientResults, setPatientResults] = useState([])
  const [patientSearching, setPatientSearching] = useState(false)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [patientHydrating, setPatientHydrating] = useState(false)

  // Detail patient (hydrated)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedPatientLoading, setSelectedPatientLoading] = useState(false)

  // Masters
  const [doctors, setDoctors] = useState([])
  const [mastersLoading, setMastersLoading] = useState(false)

  // Medicine search
  const [medQuery, setMedQuery] = useState("")
  const debouncedMedQuery = useDebouncedValue(medQuery, 220)
  const [medResults, setMedResults] = useState([])
  const [medSearching, setMedSearching] = useState(false)
  const [showMedDropdown, setShowMedDropdown] = useState(false)

  // Refs
  const patientDropRef = useRef(null)
  const medDropRef = useRef(null)
  const medInputRef = useRef(null)
  const listSearchRef = useRef(null)

  const patientCacheRef = useRef(new Map())

  const [pharmacyLocationId, setPharmacyLocationId] = useState(() => {
    const v = Number(localStorage.getItem("pharmacy.locationId") || "")
    return Number.isFinite(v) && v > 0 ? v : 1
  })

  useEffect(() => {
    if (pharmacyLocationId)
      localStorage.setItem("pharmacy.locationId", String(pharmacyLocationId))
  }, [pharmacyLocationId])

  useOnClickOutside(patientDropRef, () => setShowPatientDropdown(false))
  useOnClickOutside(medDropRef, () => setShowMedDropdown(false))

  async function hydratePatientById(id, { silent = false } = {}) {
    if (!id) return null
    const key = String(id)
    if (patientCacheRef.current.has(key)) return patientCacheRef.current.get(key)

    try {
      if (!silent) setPatientHydrating(true)
      const res = await getPatientById(id)
      const full = res?.data?.data ?? res?.data ?? null
      if (full) patientCacheRef.current.set(key, full)
      return full
    } catch {
      return null
    } finally {
      if (!silent) setPatientHydrating(false)
    }
  }

  /* ----------------------------- masters load ----------------------------- */
  useEffect(() => {
    ; (async () => {
      try {
        setMastersLoading(true)
        const res = await getDoctorlist()
        const d = res?.data?.data ?? res?.data ?? {}
        const docs = d?.doctors ?? d ?? []
        setDoctors(Array.isArray(docs) ? docs : [])

        const last = localStorage.getItem("pharmacy.lastDoctorId")
        if (last) setHeader((p) => ({ ...p, doctorId: p.doctorId || last }))
      } finally {
        setMastersLoading(false)
      }
    })()
  }, [])

  /* ----------------------------- list fetching ---------------------------- */
  useEffect(() => {
    fetchRxList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxTypeFilter, statusFilter, debouncedSearch])

  useEffect(() => {
    if (tab !== "list") return
    if (!autoRefresh) return
    const t = setInterval(() => fetchRxList(true), 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, autoRefresh, rxTypeFilter, statusFilter, debouncedSearch])

  async function fetchRxList(silent = false) {
    try {
      if (!silent) setListLoading(true)
      const params = {}
      if (rxTypeFilter !== "ALL") params.type = rxTypeFilter
      if (statusFilter !== "ALL") params.status = statusFilter
      if (debouncedSearch?.trim()) params.q = debouncedSearch.trim()
      params.limit = 100

      const res = await listPharmacyPrescriptions(params)
      setRxList(unwrapList(res))
    } catch {
      // toast via interceptor
    } finally {
      if (!silent) setListLoading(false)
    }
  }

  /* ----------------------------- patient search --------------------------- */
  useEffect(() => {
    const q = debouncedPatientQuery?.trim()
    if (!q || q.length < 2) {
      setPatientResults([])
      return
    }

    let cancelled = false
      ; (async () => {
        try {
          setPatientSearching(true)

          let res
          try {
            res = await listPatients(q)
          } catch {
            res = await listPatients({ q })
          }

          if (cancelled) return
          const payload = res?.data?.data ?? res?.data
          const items = payload?.items ?? payload ?? []
          setPatientResults(Array.isArray(items) ? items : [])
          setShowPatientDropdown(true)
        } finally {
          if (!cancelled) setPatientSearching(false)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [debouncedPatientQuery])

  async function handleSelectPatient(p) {
    setHeader((prev) => ({ ...prev, patient: p }))
    setPatientQuery(getPatientDisplay(p))
    setShowPatientDropdown(false)

    const full = await hydratePatientById(p?.id, { silent: false })
    if (full) {
      setHeader((prev) => ({ ...prev, patient: full }))
      setPatientQuery(getPatientDisplay(full))
    }
  }

  function clearPatient() {
    setHeader((p) => ({ ...p, patient: null }))
    setPatientQuery("")
    setPatientResults([])
    setShowPatientDropdown(false)
  }

  /* ----------------------------- medicine search -------------------------- */
  useEffect(() => {
    const q = debouncedMedQuery?.trim()
    if (!q || q.length < 2) {
      setMedResults([])
      return
    }

    let cancelled = false
      ; (async () => {
        try {
          setMedSearching(true)
          const res = await searchItemBatches({
            location_id: pharmacyLocationId,
            q,
            limit: 15,
            type: "drug",
            only_in_stock: true,
            exclude_expired: true,
            active_only: true,
          })

          if (cancelled) return
          const payload = res?.data?.data ?? res?.data
          const rows = payload?.items ?? payload ?? []
          setMedResults(Array.isArray(rows) ? rows : [])
          setShowMedDropdown(true)
        } finally {
          if (!cancelled) setMedSearching(false)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [debouncedMedQuery, pharmacyLocationId])

  function handleSelectMedicine(row) {
    const itemId = toInt(row?.item_id ?? row?.id)
    const batchId = toInt(row?.batch_id)

    if (!itemId) {
      toast.error("Invalid item selected (missing item_id).")
      return
    }

    setCurrentLine((prev) => {
      const next = {
        ...prev,
        item: row,
        item_id: itemId,
        item_name: row.name || prev.item_name || "",
        strength: row.strength || row.form || prev.strength || "",
        route: prev.route || "PO",
        batch_id: batchId || prev.batch_id || null,
        batch_no: row.batch_no || prev.batch_no || "",
        expiry_date: row.expiry_date || prev.expiry_date || null,
        available_qty: row.available_qty ?? prev.available_qty ?? "",
      }

      const hasAny = perDayFromSlots(next.dose_slots) > 0
      if (!hasAny) next.dose_slots = { M: 1, A: 0, E: 0, N: 1 }

      return applyAuto(next)
    })

    setMedQuery(row.name || "")
    setShowMedDropdown(false)
  }

  /* ----------------------------- form helpers ----------------------------- */
  function resetForm(keepType = true) {
    setHeader((prev) => ({
      ...makeEmptyHeader(),
      type: keepType ? prev.type : "OPD",
      datetime: todayDateTimeLocal(),
      doctorId: prev.doctorId || "",
    }))
    setLines([])
    setCurrentLine(makeEmptyLine())
    setPatientQuery("")
    setPatientResults([])
    setMedQuery("")
    setMedResults([])
    setShowPatientDropdown(false)
    setShowMedDropdown(false)
  }

  function startNewRx(initialType) {
    const t = initialType || newType || "OPD"
    setHeader((prev) => ({
      ...makeEmptyHeader(),
      type: t,
      datetime: todayDateTimeLocal(),
      doctorId: prev.doctorId || localStorage.getItem("pharmacy.lastDoctorId") || "",
    }))
    setLines([])
    setCurrentLine(makeEmptyLine())
    setPatientQuery("")
    setSelectedRx(null)
    setSelectedPatient(null)
    setTab("new")

    setTimeout(() => {
      medInputRef.current?.focus?.()
    }, 50)
  }

  function handleAddLine() {
    const itemId = toInt(currentLine.item_id ?? currentLine.item?.item_id ?? currentLine.item?.id)
    if (!itemId) {
      toast.error("Please select the medicine from dropdown.")
      return
    }

    const days = toInt(currentLine.duration_days)
    const perDay = perDayFromSlots(currentLine.dose_slots)
    if (!days || days <= 0) {
      toast.error("Enter valid Days")
      return
    }
    if (!perDay || perDay <= 0) {
      toast.error("Select dosage schedule (checkboxes)")
      return
    }

    const computed = applyAuto(currentLine)
    const qty = Number(computed.total_qty || 0)
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Auto quantity failed. Check Days + Schedule.")
      return
    }

    const available = Number(computed.available_qty ?? computed.item?.available_qty ?? 0)
    if (Number.isFinite(available) && available > 0 && qty > available) {
      toast.error(`Qty exceeds available stock for this batch (Available: ${available})`)
      return
    }

    const newLine = {
      ...computed,
      item_id: itemId,
      duration_days: String(days),
    }

    const batchId = toInt(newLine.batch_id ?? newLine.item?.batch_id)
    const key = `${itemId}::${batchId || ""}`

    const idx = lines.findIndex((l) => {
      const li = toInt(l.item_id ?? l.item?.item_id ?? l.item?.id)
      const lb = toInt(l.batch_id ?? l.item?.batch_id)
      return `${li}::${lb || ""}` === key
    })

    if (idx >= 0) {
      const prev = lines[idx]
      const prevQty = Number(prev.total_qty || 0) || 0
      const mergedQty = prevQty + qty

      const prevAvail = Number(prev.available_qty ?? 0)
      if (Number.isFinite(prevAvail) && prevAvail > 0 && mergedQty > prevAvail) {
        toast.error(`Merged qty exceeds available stock (Available: ${prevAvail})`)
        return
      }

      const merged = {
        ...prev,
        ...newLine,
        total_qty: String(mergedQty),
        requested_qty: String(mergedQty),
      }

      setLines((arr) => arr.map((x, i) => (i === idx ? merged : x)))
      toast.success(`Merged duplicate batch: ${newLine.item_name} (${prevQty} → ${mergedQty})`)
    } else {
      setLines((prev) => [...prev, newLine])
    }

    setCurrentLine(makeEmptyLine())
    setMedQuery("")
    setShowMedDropdown(false)
    setTimeout(() => medInputRef.current?.focus?.(), 50)
  }

  function handleRemoveLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmitRx() {
    const isCounter = header.type === "COUNTER"

    if (!isCounter && !header.patient) return toast.error("Select a patient")
    if (!isCounter && !header.doctorId) return toast.error("Select a doctor")
    if (!lines.length) return toast.error("Add at least one medicine")

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const itemId = toInt(l.item_id ?? l.item?.item_id ?? l.item?.id)
      if (!itemId) return toast.error(`Line ${i + 1}: Invalid item_id`)
      const qty = Number(l.total_qty || calcAutoQty(l) || 0)
      if (!qty || qty <= 0) return toast.error(`Line ${i + 1}: Invalid qty`)
    }

    const payload = {
      type: header.type,
      priority: header.priority,
      rx_datetime: header.datetime,
      patient_id: toInt(header.patient?.id),
      doctor_user_id: toInt(header.doctorId),
      visit_id: header.type === "OPD" ? header.visitNo || null : null,
      ipd_admission_id: header.type === "IPD" ? header.admissionNo || null : null,
      ot_case_id: header.type === "OT" ? header.otCaseNo || null : null,
      notes: header.notes || "",
      lines: lines.map((l) => {
        const itemId = toInt(l.item_id ?? l.item?.item_id ?? l.item?.id)
        const line = applyAuto(l)
        const qty = Number(line.total_qty || 0)

        return {
          item_id: itemId,
          item_name: line.item?.name || line.item_name || "",
          strength: line.strength || null,
          route: line.route || null,
          frequency_code: slotsToFrequency(line.dose_slots),
          duration_days: toInt(line.duration_days),
          requested_qty: qty,
          total_qty: qty,
          dose_text: line.dose || null,
          instructions: line.instructions || null,
          is_prn: !!line.is_prn,
          is_stat: !!line.is_stat,
        }
      }),
    }

    try {
      setSubmitting(true)
      if (header.doctorId) localStorage.setItem("pharmacy.lastDoctorId", header.doctorId)

      const res = await createPharmacyPrescription(payload)
      const created = res?.data?.data ?? res?.data
      toast.success("Prescription created & sent to Pharmacy")

      resetForm(true)
      setTab("list")
      fetchRxList()
      if (created) setSelectedRx(created)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOpenRx(row) {
    try {
      const res = await getPharmacyPrescription(row.id)
      const data = res?.data?.data ?? res?.data ?? row
      setSelectedRx(data)
      setTab("detail")
    } catch {
      // toast via interceptor
    }
  }

  /* hydrate selected patient in detail */
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        if (!selectedRx) {
          setSelectedPatient(null)
          return
        }

        const embedded = selectedRx.patient
        const pid = selectedRx.patient_id || selectedRx.patientId || embedded?.id || null

        if (embedded && (embedded.uhid || embedded.phone || embedded.gender || embedded.age)) {
          setSelectedPatient(embedded)
          return
        }

        if (!pid) {
          setSelectedPatient(embedded || null)
          return
        }

        try {
          setSelectedPatientLoading(true)
          const full = await hydratePatientById(pid, { silent: true })
          if (cancelled) return
          setSelectedPatient(full || embedded || null)
        } finally {
          if (!cancelled) setSelectedPatientLoading(false)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [selectedRx])

  const selectedRxLines = useMemo(() => {
    if (!selectedRx) return []
    return selectedRx.lines || selectedRx.items || []
  }, [selectedRx])

  const queueStats = useMemo(() => {
    const total = rxList.length
    const pending = rxList.filter((r) => ["PENDING", "NEW"].includes(safeStr(r.status).toUpperCase())).length
    const partial = rxList.filter((r) => safeStr(r.status).toUpperCase() === "PARTIAL").length
    const disp = rxList.filter((r) => ["DISPENSED", "COMPLETED"].includes(safeStr(r.status).toUpperCase())).length
    return { total, pending, partial, disp }
  }, [rxList])

  /* hotkeys */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setTab("list")
        setTimeout(() => listSearchRef.current?.focus?.(), 50)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault()
        startNewRx(newType)
      }
      if (e.key === "Escape") {
        setShowPatientDropdown(false)
        setShowMedDropdown(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newType])

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="relative w-full">
      {/* premium background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-slate-200/40 blur-3xl" />
        <div className="absolute top-36 right-10 h-52 w-52 rounded-full bg-slate-100 blur-2xl" />
      </div>

      <div className="relative p-3 sm:p-4 md:p-6">
        <div className="mx-auto w-full max-w-[1440px] space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-slate-50" />
              <div className="relative p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
                      Pharmacy Rx
                    </h1>
                    <div className="text-sm text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                      <span>Fast queue + quick Rx entry for daily pharmacy ops.</span>
                      <span className="text-[11px] text-slate-400">
                        Tips: <span className="font-medium">Ctrl+K</span> search •{" "}
                        <span className="font-medium">Ctrl+N</span> new Rx
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-2xl border border-slate-500 bg-white/70 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Total</div>
                        <div className="text-sm font-semibold text-slate-900">{queueStats.total}</div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-amber-700">Pending</div>
                        <div className="text-sm font-semibold text-amber-900">{queueStats.pending}</div>
                      </div>
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-blue-700">Partial</div>
                        <div className="text-sm font-semibold text-blue-900">{queueStats.partial}</div>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-emerald-700">Done</div>
                        <div className="text-sm font-semibold text-emerald-900">{queueStats.disp}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2 rounded-full border border-slate-500 bg-white/70 backdrop-blur px-3 py-2 shadow-sm">
                      <Sparkles className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-600">Queue</span>
                      <Badge variant="outline" className="text-[11px]">
                        {queueStats.total}
                      </Badge>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] text-amber-700">Pending {queueStats.pending}</span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] text-blue-700">Partial {queueStats.partial}</span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] text-emerald-700">Done {queueStats.disp}</span>
                    </div>

                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger className="w-full sm:w-[170px] bg-white/70 backdrop-blur border-slate-500 rounded-full">
                        <SelectValue placeholder="New Rx Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RX_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button className="rounded-full shadow-sm" onClick={() => startNewRx(newType)}>
                      <Plus className="w-4 h-4 mr-2" />
                      New Prescription
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Tabs value={tab} onValueChange={setTab} className="w-full">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <SegmentedTabs />

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAutoRefresh((v) => !v)}
                          className={[
                            "px-3 py-2 rounded-full text-xs border backdrop-blur shadow-sm",
                            autoRefresh
                              ? "bg-emerald-50/70 text-emerald-700 border-emerald-200"
                              : "bg-white/70 text-slate-700 border-slate-500",
                          ].join(" ")}
                          title="Auto-refresh queue"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Auto refresh
                        </button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-full border-slate-500 bg-white/70 backdrop-blur"
                          onClick={() => fetchRxList()}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {/* LIST TAB */}
                    <TabsContent value="list" className="mt-4 space-y-3">
                      <GlassCard>
                        <CardHeader className="pb-3">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs uppercase tracking-wide text-slate-500">Type</span>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setRxTypeFilter("ALL")}
                                    className={[
                                      "px-3 py-1.5 rounded-full text-xs border transition shadow-sm backdrop-blur",
                                      rxTypeFilter === "ALL"
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white/70 text-slate-700 border-slate-500",
                                    ].join(" ")}
                                  >
                                    All
                                  </button>
                                  {RX_TYPES.map((t) => (
                                    <button
                                      key={t.value}
                                      type="button"
                                      onClick={() => setRxTypeFilter(t.value)}
                                      className={[
                                        "px-3 py-1.5 rounded-full text-xs border flex items-center gap-1.5 transition shadow-sm backdrop-blur",
                                        rxTypeFilter === t.value
                                          ? "bg-slate-900 text-white border-slate-900"
                                          : "bg-white/70 text-slate-700 border-slate-500",
                                      ].join(" ")}
                                    >
                                      <Pill className="w-3 h-3" />
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 w-full lg:w-auto">
                                <div className="relative flex-1 lg:w-[420px]">
                                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                  <Input
                                    ref={listSearchRef}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search UHID / name / Rx no..."
                                    className="pl-9 h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                  />
                                </div>

                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                  <SelectTrigger className="w-[150px] bg-white/70 backdrop-blur border-slate-500 rounded-full text-xs h-10">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">All status</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="PARTIAL">Partial</SelectItem>
                                    <SelectItem value="DISPENSED">Dispensed</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="rounded-full border-slate-500 bg-white/70 backdrop-blur h-10 w-10"
                                  onClick={() => fetchRxList()}
                                  title="Apply filters"
                                >
                                  <Filter className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                          <div className="hidden md:block border border-slate-100 rounded-2xl overflow-hidden bg-white/60 backdrop-blur">
                            <div className="max-h-[560px] overflow-auto">
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                  <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur">
                                    <tr className="text-xs text-slate-500">
                                      <th className="text-left px-3 py-3 font-medium">Rx No</th>
                                      <th className="text-left px-3 py-3 font-medium">Patient</th>
                                      <th className="text-left px-3 py-3 font-medium">Type / Doctor</th>
                                      <th className="text-left px-3 py-3 font-medium">Created</th>
                                      <th className="text-left px-3 py-3 font-medium">Status</th>
                                      <th className="text-right px-3 py-3 font-medium">Actions</th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {listLoading && (
                                      <tr>
                                        <td colSpan={6} className="px-3 py-10 text-center text-xs text-slate-500">
                                          Loading prescriptions...
                                        </td>
                                      </tr>
                                    )}

                                    {!listLoading && !rxList.length && (
                                      <tr>
                                        <td colSpan={6} className="px-3 py-12 text-center text-xs text-slate-500">
                                          No prescriptions found for the selected filters.
                                        </td>
                                      </tr>
                                    )}

                                    {!listLoading &&
                                      rxList.map((row) => {
                                        const status = (row.status || "").toUpperCase() || "PENDING"
                                        const type = row.type || row.rx_type || "OPD"
                                        const createdStr = fmtDT(row.created_at || row.rx_datetime || row.bill_date)

                                        const patientName =
                                          row.patient_name ||
                                          `${row.patient?.first_name || ""} ${row.patient?.last_name || ""}`.trim() ||
                                          row.patient?.name ||
                                          row.patient_uhid ||
                                          "—"

                                        const doctorName = row.doctor_name || row.doctor || row.doctor_display || ""

                                        return (
                                          <tr
                                            key={row.id}
                                            className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors"
                                          >
                                            <td className="px-3 py-3 align-middle">
                                              <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-slate-900">
                                                  {row.rx_number || `RX-${row.id}`}
                                                </span>
                                                {(row.patient_uhid || row.uhid) && (
                                                  <span className="text-[11px] text-slate-500">
                                                    UHID: {row.patient_uhid || row.uhid}
                                                  </span>
                                                )}
                                              </div>
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                              <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-medium text-slate-700">
                                                  <User className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                  <div className="text-xs text-slate-900 font-medium">{patientName}</div>
                                                  {(row.patient_uhid || row.uhid) && (
                                                    <div className="text-[11px] text-slate-500">
                                                      {row.patient_uhid || row.uhid}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                              <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                  <Badge variant="outline" className="border-slate-500 text-[11px] px-2 py-0.5">
                                                    {type}
                                                  </Badge>
                                                  {doctorName && (
                                                    <span className="text-[11px] text-slate-600 flex items-center gap-1">
                                                      <Stethoscope className="w-3 h-3" />
                                                      {doctorName}
                                                    </span>
                                                  )}
                                                </div>
                                                {row.context_label && (
                                                  <span className="text-[11px] text-slate-500">{row.context_label}</span>
                                                )}
                                              </div>
                                            </td>

                                            <td className="px-3 py-3 align-middle text-xs text-slate-700">
                                              <div className="flex items-center gap-1">
                                                <Clock3 className="w-3 h-3 text-slate-400" />
                                                <span>{createdStr}</span>
                                              </div>
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                              <StatusPill status={status} />
                                            </td>

                                            <td className="px-3 py-3 align-middle text-right">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-3 text-xs rounded-full border-slate-500 bg-white"
                                                onClick={() => handleOpenRx(row)}
                                              >
                                                <ClipboardList className="w-3.5 h-3.5 mr-1" />
                                                View
                                              </Button>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          {/* Mobile list */}
                          <div className="md:hidden space-y-2">
                            {listLoading ? (
                              <div className="rounded-2xl border border-slate-500 bg-white/70 backdrop-blur p-4 text-xs text-slate-500">
                                Loading prescriptions...
                              </div>
                            ) : !rxList.length ? (
                              <div className="rounded-2xl border border-slate-500 bg-white/70 backdrop-blur p-4 text-xs text-slate-500">
                                No prescriptions found for the selected filters.
                              </div>
                            ) : (
                              rxList.map((row) => {
                                const status = (row.status || "").toUpperCase() || "PENDING"
                                const type = row.type || row.rx_type || "OPD"
                                const createdStr = fmtDT(row.created_at || row.rx_datetime || row.bill_date)
                                const doctorName = row.doctor_name || row.doctor || row.doctor_display || ""
                                const patientName =
                                  row.patient_name ||
                                  `${row.patient?.first_name || ""} ${row.patient?.last_name || ""}`.trim() ||
                                  row.patient?.name ||
                                  row.patient_uhid ||
                                  "—"

                                return (
                                  <button
                                    key={row.id}
                                    type="button"
                                    onClick={() => handleOpenRx(row)}
                                    className="w-full text-left rounded-3xl border border-slate-500 bg-white/70 backdrop-blur p-4 shadow-sm active:scale-[0.99] transition"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-slate-900 truncate">
                                          {row.rx_number || `RX-${row.id}`}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">
                                          {patientName}{" "}
                                          {(row.patient_uhid || row.uhid) ? `• ${row.patient_uhid || row.uhid}` : ""}
                                        </div>
                                      </div>
                                      <StatusPill status={status} />
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                      <Badge variant="outline" className="border-slate-500 text-[11px]">
                                        {type}
                                      </Badge>
                                      {doctorName ? (
                                        <span className="inline-flex items-center gap-1">
                                          <Stethoscope className="w-3 h-3 text-slate-400" />
                                          {doctorName}
                                        </span>
                                      ) : null}
                                      <span className="inline-flex items-center gap-1">
                                        <Clock3 className="w-3 h-3 text-slate-400" />
                                        {createdStr}
                                      </span>
                                    </div>

                                    <div className="mt-3">
                                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1.5 text-xs">
                                        <ClipboardList className="w-4 h-4" />
                                        Open
                                      </div>
                                    </div>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </CardContent>
                      </GlassCard>
                    </TabsContent>

                    {/* NEW TAB */}
                    <TabsContent value="new" className="mt-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
                        {/* LEFT */}
                        <GlassCard>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                              <Pill className="w-4 h-4 text-slate-500" />
                              Prescription Details
                              <Badge variant="outline" className="ml-1 text-[11px]">
                                {header.type}
                              </Badge>
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600">Prescription Type</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {RX_TYPES.map((t) => (
                                    <button
                                      key={t.value}
                                      type="button"
                                      onClick={() => setHeader((prev) => ({ ...prev, type: t.value }))}
                                      className={[
                                        "px-3 py-1.5 rounded-full text-xs border flex items-center gap-1.5 transition shadow-sm",
                                        header.type === t.value
                                          ? "bg-slate-900 text-white border-slate-900"
                                          : "bg-white/70 text-slate-700 border-slate-500 backdrop-blur",
                                      ].join(" ")}
                                    >
                                      <Pill className="w-3 h-3" />
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600">Priority</Label>
                                <Select
                                  value={header.priority}
                                  onValueChange={(val) => setHeader((prev) => ({ ...prev, priority: val }))}
                                >
                                  <SelectTrigger className="w-full bg-white/70 backdrop-blur border-slate-500 rounded-full h-10 text-xs">
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRIORITIES.map((p) => (
                                      <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-slate-600">Date &amp; Time</Label>
                              <Input
                                type="datetime-local"
                                value={header.datetime}
                                onChange={(e) => setHeader((prev) => ({ ...prev, datetime: e.target.value }))}
                                className="h-10 text-xs bg-white/70 backdrop-blur border-slate-500 rounded-full"
                              />
                            </div>

                            {/* Patient picker */}
                            <div className="space-y-1.5 relative" ref={patientDropRef}>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600 flex items-center gap-1.5">
                                  <User className="w-3 h-3" />
                                  Patient (UHID / name / phone)
                                </Label>

                                <div className="flex items-center gap-2">
                                  {patientHydrating && (
                                    <span className="text-[11px] text-slate-500">Loading full patient…</span>
                                  )}
                                  {header.patient && (
                                    <button
                                      type="button"
                                      onClick={clearPatient}
                                      className="text-[11px] text-slate-500 hover:text-slate-900"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <Input
                                  value={patientQuery}
                                  onChange={(e) => {
                                    setPatientQuery(e.target.value)
                                    setShowPatientDropdown(true)
                                  }}
                                  placeholder={header.type === "COUNTER" ? "Optional for counter sale" : "Search patient..."}
                                  className="pl-9 h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                />
                              </div>

                              <AnimatePresence>
                                {showPatientDropdown && (patientResults.length > 0 || patientSearching) && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    className="absolute z-30 mt-2 w-full bg-white/80 backdrop-blur border border-slate-500 rounded-2xl shadow-xl max-h-60 overflow-auto text-xs"
                                  >
                                    {patientSearching && <div className="px-3 py-2 text-slate-500">Searching...</div>}

                                    {!patientSearching && !patientResults.length && (
                                      <div className="px-3 py-2 text-slate-500">No patients found</div>
                                    )}

                                    {!patientSearching &&
                                      patientResults.map((p) => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => handleSelectPatient(p)}
                                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                        >
                                          <div className="flex justify-between items-center gap-2">
                                            <span className="font-medium text-slate-900">{getPatientName(p)}</span>
                                            {p.uhid && <span className="text-[10px] text-slate-500">UHID: {p.uhid}</span>}
                                          </div>
                                          <div className="text-[11px] text-slate-500">
                                            {getPatientAgeGender(p) ? `${getPatientAgeGender(p)} • ` : ""}
                                            {p.phone || ""}
                                          </div>
                                        </button>
                                      ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {header.patient && header.type !== "COUNTER" ? (
                              <PatientSummaryCard patient={header.patient} loading={patientHydrating} />
                            ) : null}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {header.type === "OPD" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-slate-600">OPD Visit No (optional)</Label>
                                  <Input
                                    value={header.visitNo}
                                    onChange={(e) => setHeader((prev) => ({ ...prev, visitNo: e.target.value }))}
                                    placeholder="e.g., OPD-2025-0001"
                                    className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                  />
                                </div>
                              )}

                              {header.type === "IPD" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-slate-600">Admission No</Label>
                                  <Input
                                    value={header.admissionNo}
                                    onChange={(e) => setHeader((prev) => ({ ...prev, admissionNo: e.target.value }))}
                                    placeholder="IPD admission number"
                                    className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                  />
                                </div>
                              )}

                              {header.type === "OT" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-slate-600">OT Case No</Label>
                                  <Input
                                    value={header.otCaseNo}
                                    onChange={(e) => setHeader((prev) => ({ ...prev, otCaseNo: e.target.value }))}
                                    placeholder="OT / procedure case ID"
                                    className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                  />
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600 flex items-center gap-1">
                                  <Stethoscope className="w-3 h-3" />
                                  Consultant / Prescriber {header.type === "COUNTER" ? "(optional)" : ""}
                                </Label>
                                <Select
                                  value={header.doctorId || ""}
                                  onValueChange={(val) => setHeader((prev) => ({ ...prev, doctorId: val }))}
                                >
                                  <SelectTrigger className="w-full bg-white/70 backdrop-blur border-slate-500 rounded-full h-10 text-sm">
                                    <SelectValue placeholder="Select doctor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {mastersLoading && (
                                      <SelectItem value="__loading" disabled>
                                        Loading...
                                      </SelectItem>
                                    )}
                                    {!mastersLoading && (!doctors || !doctors.length) && (
                                      <SelectItem value="__none" disabled>
                                        No doctors configured
                                      </SelectItem>
                                    )}
                                    {!mastersLoading &&
                                      doctors?.map((d) => (
                                        <SelectItem key={d.id} value={String(d.id)}>
                                          {d.name || d.full_name || d.email}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-slate-600">Notes / instructions to pharmacist (optional)</Label>
                              <Textarea
                                value={header.notes}
                                onChange={(e) => setHeader((prev) => ({ ...prev, notes: e.target.value }))}
                                rows={3}
                                className="text-sm bg-white/70 backdrop-blur border-slate-500 resize-none rounded-2xl"
                                placeholder="Eg: Allergic to penicillin, avoid NSAIDs, taper after 5 days..."
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-full border-slate-500 bg-white/70 backdrop-blur"
                                onClick={() => resetForm(true)}
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Reset
                              </Button>

                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Automation:
                                </span>
                                <span>Debounced search • Auto qty • Merge duplicates</span>
                              </div>
                            </div>
                          </CardContent>
                        </GlassCard>

                        {/* RIGHT (Medicines) */}
                        <GlassCard>
                          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-slate-500" />
                              <CardTitle className="text-sm font-semibold">
                                Medicines &amp; Instructions
                              </CardTitle>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {lines.length ? `${lines.length} lines` : 'No lines added yet'}
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-3">
                            <div className="border border-slate-500/70 rounded-2xl p-3 bg-white/60 backdrop-blur">
                              <div className="grid lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-3">
                                <div className="space-y-2">
                                  {/* Medicine search */}
                                  <div className="space-y-1 relative" ref={medDropRef}>
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[11px] text-slate-600">
                                        Medicine{" "}
                                        <span className="text-[10px] text-slate-400">
                                          (linked to Inventory)
                                        </span>
                                      </Label>

                                      <span className="text-[10px] text-slate-500">
                                        Auto qty:{" "}
                                        <span className="font-medium">
                                          {calcAutoQty(currentLine) || "—"}
                                        </span>
                                      </span>
                                    </div>

                                    <div className="relative">
                                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                      <Input
                                        ref={medInputRef}
                                        value={medQuery}
                                        onChange={(e) => {
                                          setMedQuery(e.target.value)
                                          setShowMedDropdown(true)
                                        }}
                                        placeholder="Search drug name, brand, generic..."
                                        className="pl-9 h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                      />
                                    </div>

                                    <AnimatePresence>
                                      {showMedDropdown && (medResults.length > 0 || medSearching) && (
                                        <motion.div
                                          initial={{ opacity: 0, y: -6 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -6 }}
                                          className="absolute z-30 mt-2 w-full bg-white/85 backdrop-blur border border-slate-500 rounded-2xl shadow-xl max-h-60 overflow-auto text-xs"
                                        >
                                          {medSearching && (
                                            <div className="px-3 py-2 text-slate-500">
                                              Searching medicines...
                                            </div>
                                          )}

                                          {!medSearching && !medResults.length && (
                                            <div className="px-3 py-2 text-slate-500">
                                              No items found
                                            </div>
                                          )}

                                          {!medSearching &&
                                            medResults.map((it) => (
                                              <button
                                                key={it.id}
                                                type="button"
                                                onClick={() => handleSelectMedicine(it)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                              >
                                                <div className="flex justify-between items-center gap-2">
                                                  <span className="font-medium text-slate-900">
                                                    {it.name || it.item_name}
                                                  </span>
                                                  {it.code && (
                                                    <span className="text-[10px] text-slate-500">
                                                      {it.code}
                                                    </span>
                                                  )}
                                                </div>

                                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                                                  <span>{it.strength || it.form || ""}</span>

                                                  <Badge
                                                    variant="outline"
                                                    className={[
                                                      "text-[10px]",
                                                      isExpired(it.expiry_date)
                                                        ? "border-rose-200 text-rose-700"
                                                        : "border-slate-500",
                                                    ].join(" ")}
                                                  >
                                                    Exp: {fmtDateShort(it.expiry_date)}
                                                  </Badge>

                                                  <Badge
                                                    variant="outline"
                                                    className="text-[10px] border-slate-500"
                                                  >
                                                    Batch: {it.batch_no || "—"}
                                                  </Badge>

                                                  <Badge
                                                    variant="outline"
                                                    className={[
                                                      "text-[10px]",
                                                      Number(it.available_qty) <= 0
                                                        ? "border-rose-200 text-rose-700"
                                                        : "border-emerald-200 text-emerald-700",
                                                    ].join(" ")}
                                                  >
                                                    Qty: {fmtQty(it.available_qty)}
                                                  </Badge>
                                                </div>
                                              </button>
                                            ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  {/* ✅ Super user-friendly dosage planner (checkbox frequency) */}
                                  <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-3 space-y-3">
                                    {/* Optional Dose (keep minimal) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <div className="space-y-1 sm:col-span-1">
                                        <Label className="text-[11px] text-slate-600">
                                          Dose <span className="text-[10px] text-slate-400">(optional)</span>
                                        </Label>
                                        <Input
                                          value={currentLine.dose}
                                          onChange={(e) =>
                                            setCurrentLine((prev) => ({
                                              ...prev,
                                              dose: e.target.value,
                                            }))
                                          }
                                          placeholder="e.g. 1 tab"
                                          className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                        />
                                      </div>

                                      <div className="space-y-1 sm:col-span-1">
                                        <Label className="text-[11px] text-slate-600">
                                          Days <span className="text-[10px] text-slate-400">(required)</span>
                                        </Label>
                                        <Input
                                          value={currentLine.duration_days}
                                          onChange={(e) =>
                                            setCurrentLine((prev) => applyAuto({ ...prev, duration_days: e.target.value, _qtyTouched: false }))
                                          }

                                          placeholder="e.g. 5"
                                          className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                        />
                                      </div>

                                      <div className="space-y-1 sm:col-span-1">
                                        <Label className="text-[11px] text-slate-600">
                                          Total Qty <span className="text-[10px] text-slate-400">(auto)</span>
                                        </Label>

                                        {(() => {
                                          const autoQty = calcAutoQty(currentLine)
                                          const perDay = parseFrequencyToPerDay(currentLine.frequency)
                                          const days = Number(currentLine.duration_days || 0) || 0
                                          const avail = Number(
                                            currentLine.available_qty ?? currentLine.item?.available_qty ?? 0
                                          )
                                          const exceeds =
                                            Number(autoQty || 0) > 0 &&
                                            Number.isFinite(avail) &&
                                            avail > 0 &&
                                            Number(autoQty || 0) > avail

                                          return (
                                            <div
                                              className={[
                                                "h-10 rounded-full border px-3 flex items-center justify-between",
                                                "bg-white/70 backdrop-blur",
                                                exceeds
                                                  ? "border-rose-200"
                                                  : "border-slate-500",
                                              ].join(" ")}
                                            >
                                              <div className="text-sm font-semibold text-slate-900">
                                                {autoQty || "—"}
                                              </div>
                                              <div className="text-[11px] text-slate-500">
                                                {perDay ? `${perDay}/day` : "Pick frequency"}{" "}
                                                {days ? `× ${days}d` : ""}
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>

                                    {/* Frequency selection (checkboxes) */}
                                    {/* ✅ Dosage schedule (M/A/E/N) — this drives frequency_code correctly */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <Label className="text-[11px] text-slate-600">
                                          Dosage schedule (M / A / E / N)
                                        </Label>

                                        <div className="text-[10px] text-slate-500">
                                          Stored as:{" "}
                                          <span className="font-medium">
                                            {slotsToFrequency(currentLine.dose_slots || emptySlots())}
                                          </span>
                                        </div>
                                      </div>

                                      {(() => {
                                        const slots = currentLine.dose_slots || emptySlots()

                                        const toggleSlot = (key) => {
                                          setCurrentLine((prev) => {
                                            const nextSlots = { ...(prev.dose_slots || emptySlots()) }
                                            nextSlots[key] = nextSlots[key] ? 0 : 1
                                            return applyAuto({ ...prev, dose_slots: nextSlots, _qtyTouched: false })
                                          })
                                        }

                                        const setPreset = (value) => {
                                          setCurrentLine((prev) => {
                                            const nextSlots = frequencyToSlots(value) // OD/BD/TID/QID or 1-1-1-1 etc.
                                            return applyAuto({ ...prev, dose_slots: nextSlots, _qtyTouched: false })
                                          })
                                        }

                                        const clearAll = () => {
                                          setCurrentLine((prev) => {
                                            const next = { ...prev, dose_slots: emptySlots(), _qtyTouched: false }
                                            // applyAuto will make qty blank because perDay becomes 0
                                            const out = applyAuto(next)
                                            out.total_qty = ""
                                            out.requested_qty = ""
                                            return out
                                          })
                                        }

                                        return (
                                          <>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                              {SLOT_KEYS.map((k) => (
                                                <label
                                                  key={k}
                                                  className={[
                                                    "h-10 rounded-full border px-3 flex items-center gap-2 cursor-pointer select-none",
                                                    "bg-white/70 backdrop-blur",
                                                    slots?.[k] ? "border-slate-900" : "border-slate-500",
                                                  ].join(" ")}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    className="h-4 w-4 accent-slate-900"
                                                    checked={!!slots?.[k]}
                                                    onChange={() => toggleSlot(k)}
                                                  />
                                                  <span className="text-sm text-slate-700">{SLOT_META[k].label}</span>
                                                </label>
                                              ))}
                                            </div>

                                            {/* Quick presets */}
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                              {FREQ_PRESETS.map((f) => (
                                                <button
                                                  key={f.value}
                                                  type="button"
                                                  onClick={() => setPreset(f.value)}
                                                  className={[
                                                    "px-3 py-1 rounded-full text-[11px] border shadow-sm transition",
                                                    slotsToFrequency(currentLine.dose_slots || emptySlots()) ===
                                                      slotsToFrequency(frequencyToSlots(f.value))
                                                      ? "bg-slate-900 text-white border-slate-900"
                                                      : "bg-white/70 text-slate-700 border-slate-500 backdrop-blur",
                                                  ].join(" ")}
                                                >
                                                  {f.label}
                                                </button>
                                              ))}

                                              <button
                                                type="button"
                                                onClick={clearAll}
                                                className="px-3 py-1 rounded-full text-[11px] border shadow-sm transition bg-white/70 text-slate-600 border-slate-500"
                                              >
                                                Clear
                                              </button>
                                            </div>
                                          </>
                                        )
                                      })()}
                                    </div>


                                    {/* Route + Strength auto */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-600">Route</Label>
                                        <Select
                                          value={currentLine.route || "PO"}
                                          onValueChange={(val) =>
                                            setCurrentLine((prev) => ({
                                              ...prev,
                                              route: val,
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full">
                                            <SelectValue placeholder="Route" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {ROUTE_PRESETS.map((r) => (
                                              <SelectItem key={r} value={r}>
                                                {r}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-600">
                                          Strength <span className="text-[10px] text-slate-400">(auto)</span>
                                        </Label>
                                        <Input
                                          value={currentLine.strength}
                                          onChange={(e) =>
                                            setCurrentLine((prev) => ({
                                              ...prev,
                                              strength: e.target.value,
                                            }))
                                          }
                                          placeholder="Auto-filled if available"
                                          className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-slate-600">
                                        Instructions to patient <span className="text-[10px] text-slate-400">(optional)</span>
                                      </Label>
                                      <Input
                                        value={currentLine.instructions}
                                        onChange={(e) =>
                                          setCurrentLine((prev) => ({
                                            ...prev,
                                            instructions: e.target.value,
                                          }))
                                        }
                                        placeholder="After food, morning & night, etc."
                                        className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                      />
                                    </div>

                                    {/* Stock hint */}
                                    {(() => {
                                      const autoQty = Number(calcAutoQty(currentLine) || 0)
                                      const avail = Number(
                                        currentLine.available_qty ?? currentLine.item?.available_qty ?? 0
                                      )
                                      const hasAvail = Number.isFinite(avail) && avail > 0
                                      const exceeds = hasAvail && autoQty > avail
                                      if (!currentLine.batch_id && !currentLine.item?.batch_id) return null

                                      return (
                                        <div
                                          className={[
                                            "rounded-2xl border px-3 py-2 text-[11px]",
                                            exceeds
                                              ? "border-rose-200 bg-rose-50/70 text-rose-700"
                                              : "border-slate-200 bg-slate-50/70 text-slate-600",
                                          ].join(" ")}
                                        >
                                          Batch:{" "}
                                          <span className="font-medium">
                                            {currentLine.batch_no || currentLine.item?.batch_no || "—"}
                                          </span>{" "}
                                          • Exp:{" "}
                                          <span className="font-medium">
                                            {fmtDateShort(currentLine.expiry_date || currentLine.item?.expiry_date)}
                                          </span>{" "}
                                          • Available:{" "}
                                          <span className="font-medium">
                                            {fmtQty(currentLine.available_qty ?? currentLine.item?.available_qty)}
                                          </span>
                                          {exceeds ? (
                                            <span className="ml-2 font-medium">
                                              (Qty exceeds stock)
                                            </span>
                                          ) : null}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </div>

                                <div className="flex flex-col justify-between gap-2">
                                  <div className="text-[11px] text-slate-500">
                                    <p className="leading-relaxed">
                                      ✅ User only selects medicine + checks frequency + enters days.
                                      <br />
                                      Qty is calculated automatically and validated against available stock.
                                    </p>
                                  </div>

                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-10 px-4 rounded-full shadow-sm"
                                      onClick={handleAddLine}
                                      disabled={!currentLine.item || !calcAutoQty(currentLine)}
                                      title={
                                        !currentLine.item
                                          ? "Select a medicine"
                                          : !calcAutoQty(currentLine)
                                            ? "Select frequency + days"
                                            : "Add line"
                                      }
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Add line
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Lines list */}
                            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white/60 backdrop-blur">
                              <div className="hidden md:block">
                                <ScrollArea className="max-h-[340px]">
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] text-[12px]">
                                      <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur">
                                        <tr className="text-[11px] text-slate-500">
                                          <th className="text-left px-3 py-2 font-medium">#</th>
                                          <th className="text-left px-3 py-2 font-medium">Medicine</th>
                                          <th className="text-left px-3 py-2 font-medium">Dose / Freq / Days</th>
                                          <th className="text-left px-3 py-2 font-medium">Route</th>
                                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                                          <th className="text-right px-3 py-2 font-medium">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {!lines.length && (
                                          <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-[11px] text-slate-500">
                                              No lines added. Use the panel above to add medicines.
                                            </td>
                                          </tr>
                                        )}

                                        {lines.map((l, idx) => (
                                          <tr key={`${l.item_id || l.item?.id || idx}-${idx}`} className="border-t border-slate-100">
                                            <td className="px-3 py-2 align-top text-slate-500">{idx + 1}</td>
                                            <td className="px-3 py-2 align-top">
                                              <div className="flex flex-col">
                                                <span className="text-[12px] font-semibold text-slate-900">
                                                  {l.item?.name || l.item_name || 'Unnamed medicine'}
                                                </span>
                                                {(l.strength || l.item?.strength) && (
                                                  <span className="text-[11px] text-slate-500">
                                                    {l.strength || l.item?.strength}
                                                  </span>
                                                )}
                                              </div>
                                            </td>

                                            <td className="px-3 py-2 align-top text-[12px] text-slate-700">
                                              <div className="flex flex-col">
                                                <span>
                                                  {l.dose || '—'} • {l.frequency || '—'} • {l.duration_days ? `${l.duration_days} days` : '—'}
                                                </span>
                                                {l.instructions && (
                                                  <span className="text-[11px] text-slate-500">{l.instructions}</span>
                                                )}
                                              </div>
                                            </td>

                                            <td className="px-3 py-2 align-top text-[12px] text-slate-700">
                                              {l.route || '—'}
                                            </td>

                                            <td className="px-3 py-2 align-top text-right text-[12px] text-slate-700 font-semibold">
                                              {l.total_qty || calcAutoQty(l) || '—'}
                                            </td>

                                            <td className="px-3 py-2 align-top text-right">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-[11px] text-slate-500 hover:text-red-600"
                                                onClick={() => handleRemoveLine(idx)}
                                              >
                                                Remove
                                              </Button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </ScrollArea>
                              </div>

                              <div className="md:hidden p-3 space-y-2">
                                {!lines.length ? (
                                  <div className="text-center text-xs text-slate-500 py-6">
                                    No lines added. Use the panel above to add medicines.
                                  </div>
                                ) : (
                                  lines.map((l, idx) => (
                                    <div key={`${l.item_id || l.item?.id || idx}-${idx}`} className="rounded-2xl border border-slate-500 bg-white/70 backdrop-blur p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold text-slate-900 truncate">
                                            {l.item?.name || l.item_name || 'Unnamed medicine'}
                                          </div>
                                          <div className="text-xs text-slate-500 truncate">
                                            {(l.strength || l.item?.strength) ? (l.strength || l.item?.strength) : ''}
                                          </div>
                                        </div>
                                        <div className="text-xs font-semibold text-slate-900">
                                          Qty {l.total_qty || calcAutoQty(l) || '—'}
                                        </div>
                                      </div>

                                      <div className="mt-2 text-xs text-slate-700">
                                        {l.dose || '—'} • {l.frequency || '—'} • {l.duration_days ? `${l.duration_days} days` : '—'} • {l.route || '—'}
                                      </div>
                                      {l.instructions ? (
                                        <div className="mt-1 text-xs text-slate-500">{l.instructions}</div>
                                      ) : null}

                                      <div className="mt-3 flex justify-end">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 rounded-full border-slate-500 bg-white"
                                          onClick={() => handleRemoveLine(idx)}
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 px-2 text-sm text-slate-500 justify-start"
                                onClick={() => {
                                  resetForm(true)
                                  setTab('list')
                                }}
                              >
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to queue
                              </Button>

                              <div className="flex items-center gap-2 justify-end">
                                <div className="text-[11px] text-slate-500 hidden md:block">
                                  Patient:{' '}
                                  <span className="font-medium text-slate-700">
                                    {header.patient ? getPatientDisplay(header.patient) : header.type === 'COUNTER' ? 'Counter' : '—'}
                                  </span>
                                  <span className="mx-2 text-slate-300">|</span>
                                  Lines:{' '}
                                  <span className="font-medium text-slate-700">{lines.length}</span>
                                </div>

                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-10 px-5 rounded-full shadow-sm"
                                  onClick={handleSubmitRx}
                                  disabled={submitting}
                                >
                                  {submitting ? (
                                    'Saving...'
                                  ) : (
                                    <>
                                      <ClipboardList className="w-4 h-4 mr-1" />
                                      Save &amp; Send
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </GlassCard>
                      </div>
                    </TabsContent>

                    {/* ------------------------------ DETAIL TAB ----------------------------- */}
                    <TabsContent value="detail" className="mt-4">
                      {!selectedRx ? (
                        <GlassCard>
                          <CardContent className="py-10 text-center text-sm text-slate-500">
                            Select a prescription from the queue to view details.
                          </CardContent>
                        </GlassCard>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)]">
                          {/* LEFT: patient + rx meta */}
                          <GlassCard>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-slate-500" />
                                Prescription #{selectedRx.rx_number || selectedRx.id}
                                <StatusPill status={selectedRx.status || 'PENDING'} />
                              </CardTitle>

                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span>
                                  Type:{' '}
                                  <Badge variant="outline" className="px-2 py-0.5">
                                    {selectedRx.type || selectedRx.rx_type || 'OPD'}
                                  </Badge>
                                </span>
                                {selectedRx.priority && <span>Priority: {selectedRx.priority}</span>}
                                {(selectedRx.doctor_name || selectedRx.doctor_display) && (
                                  <span className="flex items-center gap-1">
                                    <Stethoscope className="w-3 h-3" />
                                    {selectedRx.doctor_name || selectedRx.doctor_display}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock3 className="w-3 h-3" />
                                  {fmtDT(selectedRx.created_at || selectedRx.rx_datetime)}
                                </span>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-3">
                              <PatientSummaryCard
                                patient={selectedPatient || selectedRx.patient || null}
                                loading={selectedPatientLoading}
                              />

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="rounded-full border-slate-500 bg-white/70 backdrop-blur"
                                  onClick={() => {
                                    setTab('list')
                                  }}
                                >
                                  <ArrowLeft className="w-4 h-4 mr-2" />
                                  Back
                                </Button>

                                <Button
                                  className="rounded-full"
                                  onClick={() => {
                                    // quick clone to new
                                    const t = selectedRx.type || selectedRx.rx_type || 'OPD'
                                    startNewRx(t)
                                    // try to prefill patient if available
                                    const pid =
                                      selectedRx.patient_id ||
                                      selectedRx.patientId ||
                                      selectedRx.patient?.id ||
                                      null
                                    if (pid) {
                                      ; (async () => {
                                        const full = await hydratePatientById(pid, { silent: true })
                                        if (full) {
                                          setHeader((prev) => ({ ...prev, patient: full }))
                                          setPatientQuery(getPatientDisplay(full))
                                        }
                                      })()
                                    }
                                  }}
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Copy as New
                                </Button>
                              </div>
                            </CardContent>
                          </GlassCard>

                          {/* RIGHT: medicines */}
                          <GlassCard>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-semibold">
                                Medicines
                                <Badge variant="outline" className="ml-2 text-[11px]">
                                  {selectedRxLines.length}
                                </Badge>
                              </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-3">
                              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white/60 backdrop-blur">
                                <div className="hidden md:block">
                                  <ScrollArea className="max-h-[520px]">
                                    <div className="overflow-x-auto">
                                      <table className="w-full min-w-[760px] text-[12px]">
                                        <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur">
                                          <tr className="text-[11px] text-slate-500">
                                            <th className="text-left px-3 py-2 font-medium">#</th>
                                            <th className="text-left px-3 py-2 font-medium">Medicine</th>
                                            <th className="text-left px-3 py-2 font-medium">Dose / Freq / Days</th>
                                            <th className="text-left px-3 py-2 font-medium">Route</th>
                                            <th className="text-right px-3 py-2 font-medium">Qty</th>
                                          </tr>
                                        </thead>

                                        <tbody>
                                          {!selectedRxLines.length && (
                                            <tr>
                                              <td colSpan={5} className="px-3 py-8 text-center text-[11px] text-slate-500">
                                                No lines found for this prescription.
                                              </td>
                                            </tr>
                                          )}

                                          {selectedRxLines.map((l, idx) => {
                                            const n = normalizeLine(l)
                                            return (
                                              <tr key={l.id || idx} className="border-t border-slate-100">
                                                <td className="px-3 py-2 align-top text-slate-500">{idx + 1}</td>
                                                <td className="px-3 py-2 align-top">
                                                  <div className="flex flex-col">
                                                    <span className="text-[12px] font-semibold text-slate-900">
                                                      {n.itemName || 'Unnamed medicine'}
                                                    </span>
                                                    {n.strength ? (
                                                      <span className="text-[11px] text-slate-500">{n.strength}</span>
                                                    ) : null}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 align-top text-[12px] text-slate-700">
                                                  <div className="flex flex-col">
                                                    <span>
                                                      {n.dose || '—'} • {n.frequency || '—'} •{' '}
                                                      {n.duration_days ? `${n.duration_days} days` : '—'}
                                                    </span>
                                                    {n.instructions ? (
                                                      <span className="text-[11px] text-slate-500">{n.instructions}</span>
                                                    ) : null}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 align-top text-[12px] text-slate-700">
                                                  {n.route || '—'}
                                                </td>
                                                <td className="px-3 py-2 align-top text-right text-[12px] text-slate-700 font-semibold">
                                                  {n.qty || calcAutoQty({ frequency: n.frequency, duration_days: n.duration_days }) || '—'}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </ScrollArea>
                                </div>

                                <div className="md:hidden p-3 space-y-2">
                                  {!selectedRxLines.length ? (
                                    <div className="text-center text-xs text-slate-500 py-6">
                                      No lines found for this prescription.
                                    </div>
                                  ) : (
                                    selectedRxLines.map((l, idx) => {
                                      const n = normalizeLine(l)
                                      return (
                                        <div key={l.id || idx} className="rounded-2xl border border-slate-500 bg-white/70 backdrop-blur p-3">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="text-sm font-semibold text-slate-900 truncate">
                                                {n.itemName || 'Unnamed medicine'}
                                              </div>
                                              <div className="text-xs text-slate-500 truncate">
                                                {n.strength || ''}
                                              </div>
                                            </div>
                                            <div className="text-xs font-semibold text-slate-900">
                                              Qty {n.qty || calcAutoQty({ frequency: n.frequency, duration_days: n.duration_days }) || '—'}
                                            </div>
                                          </div>

                                          <div className="mt-2 text-xs text-slate-700">
                                            {n.dose || '—'} • {n.frequency || '—'} • {n.duration_days ? `${n.duration_days} days` : '—'} • {n.route || '—'}
                                          </div>
                                          {n.instructions ? (
                                            <div className="mt-1 text-xs text-slate-500">{n.instructions}</div>
                                          ) : null}
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </GlassCard>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )

}
