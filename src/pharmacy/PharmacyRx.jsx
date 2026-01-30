// FILE: src/pages/PharmacyRx.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import {
  listPharmacyPrescriptions,
  createPharmacyPrescription,
  getPharmacyPrescription,
} from "../api/pharmacyRx"

import { getPatientById } from "../api/patients"
import { getDoctorlist } from "../api/billing"
import { searchItemBatches } from "../api/inventory"

// ✅ your new billing patient APIs
import {
  billingSearchPatients,
  billingListPatientEncounters,
} from "../api/billings"

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
  Barcode,
  Wand2,
} from "lucide-react"
import { formatIST } from "@/ipd/components/timeZONE"

/* ----------------------------- constants ----------------------------- */

const MANUAL_TYPES = ["OP", "IP", "OT", "COUNTER"]

const RX_TYPES = [
  { value: "OP", label: "OPD" },
  { value: "IP", label: "IPD" },
  { value: "OT", label: "OT" },
  { value: "COUNTER", label: "Counter" },
]

const PRIORITIES = [
  { value: "ROUTINE", label: "Routine" },
  { value: "STAT", label: "STAT / Urgent" },
  { value: "PRN", label: "PRN / As needed" },
]

// Simple presets (recommended for “quick add”)
const SIMPLE_FREQ_PRESETS = [
  { label: "OD", value: "OD" },
  { label: "BD", value: "BD" },
  { label: "TID", value: "TID" },
  { label: "QID", value: "QID" },
  { label: "HS", value: "HS" },
  { label: "1-0-1-0", value: "1-0-1-0" },
  { label: "1-0-1-1", value: "1-0-1-1" },
  { label: "1-1-1-1", value: "1-1-1-1" },
]

const ROUTE_PRESETS = ["PO", "IV", "IM", "SC", "PR", "INH", "TOP"]

/* ----------------------------- helpers ----------------------------- */

function todayDateTimeLocal() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function safeStr(x) {
  return (x ?? "").toString()
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

function toInt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== "") return v
  }
  return fallback
}

/* -------------------- type normalize (OPD/IPD <-> OP/IP) -------------------- */

function fromBackendType(t) {
  const x = safeStr(t).toUpperCase()
  if (x === "OPD") return "OP"
  if (x === "IPD") return "IP"
  return x
}

function toBackendType(t) {
  const x = safeStr(t).toUpperCase()
  if (x === "OP") return "OPD"
  if (x === "IP") return "IPD"
  return x
}

/* --------------------------- dosage auto-qty --------------------------- */

const normalizeFreq = (v = "") =>
  String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")

const parseFrequencyToPerDay = (freq = "") => {
  const f = normalizeFreq(freq)
  if (/^\d+(?:-\d+){1,3}$/.test(f)) {
    return f.split("-").reduce((sum, x) => sum + (Number(x) || 0), 0)
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
  M: { label: "M" },
  A: { label: "A" },
  E: { label: "E" },
  N: { label: "N" },
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
    BD: { M: 1, A: 0, E: 0, N: 1 },
    TID: { M: 1, A: 1, E: 1, N: 0 },
    QID: { M: 1, A: 1, E: 1, N: 1 },
    HS: { M: 0, A: 0, E: 0, N: 1 },
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

  const perDayFromSlot = line?.dose_slots ? perDayFromSlots(line.dose_slots) : 0
  const perDay = perDayFromSlot > 0 ? perDayFromSlot : parseFrequencyToPerDay(line?.frequency || "")
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

/* --------------------------- patient helpers --------------------------- */

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

/* --------------------------- encounters helpers --------------------------- */

function normalizeEncounterItems(data, type) {
  if (!data) return []
  if (Array.isArray(data)) return data

  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.rows)) return data.rows
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.encounters)) return data.encounters

  // sometimes keyed by type
  const t = safeStr(type).toUpperCase()
  if (t === "OP" && Array.isArray(data.op)) return data.op
  if (t === "IP" && Array.isArray(data.ip)) return data.ip
  if (t === "OT" && Array.isArray(data.ot)) return data.ot

  return []
}

function getEncounterId(e) {
  return (
    e?.encounter_id ||
    e?.id ||
    e?.visit_id ||
    e?.admission_id ||
    e?.ot_case_id ||
    null
  )
}

function getEncounterLabel(e, type) {
  const t = safeStr(type).toUpperCase()
  if (!e) return "—"

  if (t === "OP") {
    const no = pick(e, ["visit_no", "visitNo", "opd_no", "opdNo"], "")
    const dt = pick(e, ["visit_date", "date", "created_at", "start_at", "visit_at", "appointment_date", "encounter_at"], "")
    const dept = pick(e, ["department_name", "department", "dept"], "")
    
    console.log('Encounter data:', e, 'Date field:', dt) // Debug log
    
    // Format date as DD-MM-YYYY for better readability
    const formatDateForVisit = (dateStr) => {
      if (!dateStr) return ""
      try {
        const d = new Date(dateStr)
        if (Number.isNaN(d.getTime())) return ""
        return d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric'
        })
      } catch {
        return ""
      }
    }
    
    const visitNumber = no || `#${getEncounterId(e)}`
    const formattedDate = formatDateForVisit(dt)
    const visitLabel = formattedDate ? `Visit ${visitNumber} - ${formattedDate}` : `Visit ${visitNumber}`
    
    return [visitLabel, dept].filter(Boolean).join(" • ")
  }

  if (t === "IP") {
    const no = pick(e, ["admission_no", "admissionNo", "ipd_no", "ipdNo"], "")
    const ward = pick(e, ["ward_name", "ward", "room"], "")
    const dt = pick(e, ["admitted_at", "date", "created_at", "start_at"], "")
    return [no || `Admission #${getEncounterId(e)}`, ward, dt ? fmtDT(dt) : ""].filter(Boolean).join(" • ")
  }

  if (t === "OT") {
    const no = pick(e, ["case_no", "caseNo", "ot_case_no", "otCaseNo"], "")
    const proc = pick(e, ["procedure_name", "procedure", "surgery"], "")
    const dt = pick(e, ["scheduled_at", "date", "created_at", "start_at"], "")
    return [no || `OT Case #${getEncounterId(e)}`, proc, dt ? fmtDT(dt) : ""].filter(Boolean).join(" • ")
  }

  return String(getEncounterId(e) || "—")
}

/* --------------------------- UI blocks --------------------------- */

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

/* --------------------------- barcode scanner hook --------------------------- */
/**
 * Barcode scanners usually "type" very fast then press Enter.
 * This hook collects keys; when Enter happens, it emits the buffer.
 */
function useBarcodeScanner({ enabled, onScan }) {
  const bufRef = useRef("")
  const lastTsRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const now = Date.now()
      const delta = now - (lastTsRef.current || 0)
      lastTsRef.current = now

      // If gap is large, reset buffer
      if (delta > 80) bufRef.current = ""

      if (e.key === "Enter") {
        const code = (bufRef.current || "").trim()
        bufRef.current = ""
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = null

        if (code.length >= 4) onScan?.(code)
        return
      }

      // ignore non-printables
      if (e.key.length !== 1) return

      bufRef.current += e.key

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        bufRef.current = ""
        timerRef.current = null
      }, 250)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, onScan])
}

/* -------------------------------- component ------------------------------- */

const makeEmptyHeader = () => ({
  type: "OP",
  priority: "ROUTINE",
  datetime: todayDateTimeLocal(),

  patient: null,
  doctorId: "",

  // ✅ encounter selection (required except COUNTER)
  encounterId: "",
  encounterObj: null,

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
  const [newType, setNewType] = useState("OP")

  // Form
  const [header, setHeader] = useState(makeEmptyHeader)
  const [lines, setLines] = useState([])
  const [currentLine, setCurrentLine] = useState(makeEmptyLine)
  const [submitting, setSubmitting] = useState(false)

  // ✅ encounters
  const [encounters, setEncounters] = useState([])
  const [encLoading, setEncLoading] = useState(false)

  // Patient search (billing API)
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

  // ✅ quick add UX
  const [simpleAddMode, setSimpleAddMode] = useState(true)
  const [scanEnabled, setScanEnabled] = useState(true)
  const lastScanRef = useRef("")

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

  // ✅ barcode scan => auto search medicine
  useBarcodeScanner({
    enabled: scanEnabled && tab === "new",
    onScan: (code) => {
      lastScanRef.current = code
      setMedQuery(code)
      setShowMedDropdown(true)
      toast.success(`Scanned: ${code}`)
      setTimeout(() => medInputRef.current?.focus?.(), 50)
    },
  })

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
      if (rxTypeFilter !== "ALL") params.type = toBackendType(rxTypeFilter)
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

  /* ----------------------------- patient search (billing API) --------------------------- */
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

          const data = await billingSearchPatients({ q, limit: 15 })
          const items =
            (Array.isArray(data) ? data : null) ||
            data?.items ||
            data?.rows ||
            data?.results ||
            []

          if (cancelled) return
          setPatientResults(Array.isArray(items) ? items : [])
          setShowPatientDropdown(true)
        } catch (e) {
          if (!cancelled) setPatientResults([])
        } finally {
          if (!cancelled) setPatientSearching(false)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [debouncedPatientQuery])

  async function handleSelectPatient(p) {
    setHeader((prev) => ({
      ...prev,
      patient: p,
      encounterId: "",
      encounterObj: null,
    }))
    setPatientQuery(getPatientDisplay(p))
    setShowPatientDropdown(false)

    const full = await hydratePatientById(p?.id, { silent: false })
    if (full) {
      setHeader((prev) => ({
        ...prev,
        patient: full,
        encounterId: "",
        encounterObj: null,
      }))
      setPatientQuery(getPatientDisplay(full))
    }
  }

  function clearPatient() {
    setHeader((p) => ({
      ...p,
      patient: null,
      encounterId: "",
      encounterObj: null,
    }))
    setPatientQuery("")
    setPatientResults([])
    setEncounters([])
    setShowPatientDropdown(false)
  }

  /* ----------------------------- encounters fetch ----------------------------- */
  useEffect(() => {
    const type = safeStr(header.type).toUpperCase()
    const isCounter = type === "COUNTER"
    const pid = header.patient?.id

    setEncounters([])
    setHeader((p) => ({ ...p, encounterId: "", encounterObj: null }))

    if (isCounter || !pid) return
    if (!MANUAL_TYPES.includes(type)) return
    console.log(type, "type");

    let cancelled = false
      ; (async () => {
        try {
          setEncLoading(true)
          // ✅ filter by type (OP/IP/OT)
          const data = await billingListPatientEncounters(pid, { encounter_type: type, limit: 100 })
          console.log(data.items, "check data");

          const items = normalizeEncounterItems(data, type)

          // try {
          //             const data = await billingListPatientEncounters(pid, { encounter_type: t, limit: 100 }, { signal: ac.signal })
          //             setEncounters(data?.items ?? [])
          //         } catch (e) {
          //             if (!isCanceledError(e)) toast.error(e?.message || "Failed to load encounters")
          //         } finally {
          //             setELoading(false)
          //         }
          //     }

          if (cancelled) return
          setEncounters(items)

          // If only one encounter, auto-select
          if (items.length === 1) {
            const e = items[0]
            const eid = getEncounterId(e)
            if (eid) {
              setHeader((p) => ({ ...p, encounterId: String(eid), encounterObj: e }))
            }
          }
        } catch {
          if (!cancelled) setEncounters([])
        } finally {
          if (!cancelled) setEncLoading(false)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [header.patient?.id, header.type])

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
            limit: 100,
            type: "drug",
            only_in_stock: true,
            exclude_expired: true,
            active_only: true,
          })

          if (cancelled) return
          const payload = res?.data?.data ?? res?.data
          const rows = payload?.items ?? payload ?? []
          const arr = Array.isArray(rows) ? rows : []
          setMedResults(arr)
          setShowMedDropdown(true)

          // ✅ if barcode scan produced exactly 1 match => auto select
          if (lastScanRef.current && lastScanRef.current === q && arr.length === 1) {
            handleSelectMedicine(arr[0])
            lastScanRef.current = ""
          }
        } finally {
          if (!cancelled) setMedSearching(false)
        }
      })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // default schedule for quick add
      if (perDayFromSlots(next.dose_slots) <= 0) {
        next.dose_slots = { M: 1, A: 0, E: 0, N: 1 } // BD style
      }

      return applyAuto(next)
    })

    setMedQuery(row.name || "")
    setShowMedDropdown(false)
    
    // Auto-select batch if only one available
    if (row.auto_selected && row.batch_count === 1) {
      toast.success(`Auto-selected batch: ${row.batch_no}`, {
        description: `Only one batch available for ${row.name}`
      })
    }
  }

  /* ----------------------------- form helpers ----------------------------- */
  function resetForm(keepType = true) {
    setHeader((prev) => ({
      ...makeEmptyHeader(),
      type: keepType ? prev.type : "OP",
      datetime: todayDateTimeLocal(),
      doctorId: prev.doctorId || "",
    }))
    setLines([])
    setCurrentLine(makeEmptyLine())
    setPatientQuery("")
    setPatientResults([])
    setEncounters([])
    setMedQuery("")
    setMedResults([])
    setShowPatientDropdown(false)
    setShowMedDropdown(false)
  }

  function startNewRx(initialType) {
    const t = initialType || newType || "OP"
    setHeader((prev) => ({
      ...makeEmptyHeader(),
      type: t,
      datetime: todayDateTimeLocal(),
      doctorId: prev.doctorId || localStorage.getItem("pharmacy.lastDoctorId") || "",
    }))
    setLines([])
    setCurrentLine(makeEmptyLine())
    setPatientQuery("")
    setEncounters([])
    setSelectedRx(null)
    setSelectedPatient(null)
    setTab("new")

    setTimeout(() => {
      medInputRef.current?.focus?.()
    }, 60)
  }

  function handleAddLine() {
    const itemId = toInt(currentLine.item_id ?? currentLine.item?.item_id ?? currentLine.item?.id)
    if (!itemId) {
      toast.error("Please select the medicine from dropdown / scan barcode.")
      return
    }

    const days = toInt(currentLine.duration_days)
    if (!days || days <= 0) {
      toast.error("Enter valid Days")
      return
    }

    const perDay = perDayFromSlots(currentLine.dose_slots)
    if (!perDay || perDay <= 0) {
      toast.error("Pick a frequency (OD/BD/TID...)")
      return
    }

    const computed = applyAuto(currentLine)
    const qty = Number(computed.total_qty || 0)
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Auto quantity failed. Check Days + Frequency.")
      return
    }

    const available = Number(computed.available_qty ?? computed.item?.available_qty ?? 0)
    if (Number.isFinite(available) && available > 0 && qty > available) {
      toast.error(`Qty exceeds available stock (Available: ${available})`)
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
      toast.success(`Merged: ${newLine.item_name} (${prevQty} → ${mergedQty})`)
    } else {
      setLines((prev) => [...prev, newLine])
    }

    // ✅ smoother UX: keep last schedule + days for next drug (less clicks)
    const keepSlots = currentLine.dose_slots
    const keepDays = currentLine.duration_days
    const keepRoute = currentLine.route
    const keepDose = currentLine.dose
    const keepInstr = currentLine.instructions

    setCurrentLine((prev) => applyAuto({
      ...makeEmptyLine(),
      dose_slots: keepSlots,
      duration_days: keepDays,
      route: keepRoute,
      dose: keepDose,
      instructions: keepInstr,
    }))

    setMedQuery("")
    setShowMedDropdown(false)
    setTimeout(() => medInputRef.current?.focus?.(), 50)
  }

  function handleRemoveLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmitRx() {
    const type = safeStr(header.type).toUpperCase()
    const isCounter = type === "COUNTER"

    if (!isCounter && !header.patient) return toast.error("Select a patient")
    if (!isCounter && !header.doctorId) return toast.error("Select a doctor")

    // ✅ encounter required for OP/IP/OT (if patient chosen)
    if (!isCounter) {
      if (encLoading) return toast.error("Encounters are loading…")
      if (!encounters.length) return toast.error("No encounters found. Create Visit/Admission/OT case first.")
      if (!header.encounterId) return toast.error("Select the encounter (Visit/Admission/OT Case)")
    }

    if (!lines.length) return toast.error("Add at least one medicine")

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const itemId = toInt(l.item_id ?? l.item?.item_id ?? l.item?.id)
      if (!itemId) return toast.error(`Line ${i + 1}: Invalid item_id`)
      const qty = Number(l.total_qty || calcAutoQty(l) || 0)
      if (!qty || qty <= 0) return toast.error(`Line ${i + 1}: Invalid qty`)
    }

    const encId = toInt(header.encounterId)

    // Map encounter into correct field expected by backend
    const visit_id = type === "OP" ? encId : null
    const ipd_admission_id = type === "IP" ? encId : null
    const ot_case_id = type === "OT" ? encId : null

    const payload = {
      type: toBackendType(type),
      priority: header.priority,
      rx_datetime: header.datetime,

      patient_id: isCounter ? null : toInt(header.patient?.id),
      doctor_user_id: header.doctorId ? toInt(header.doctorId) : null,

      visit_id,
      ipd_admission_id,
      ot_case_id,

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
                      <span>Queue + Quick Rx entry (NABH-friendly).</span>
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
                        </CardHeader>

                        <CardContent className="pt-0">
                          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white/60 backdrop-blur">
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
                                        const type = fromBackendType(row.type || row.rx_type || "OPD")
                                        const createdStr = formatIST(row.created_at || row.rx_datetime || row.bill_date)

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
                                                    {RX_TYPES.find((x) => x.value === type)?.label || type}
                                                  </Badge>
                                                  {doctorName && (
                                                    <span className="text-[11px] text-slate-600 flex items-center gap-1">
                                                      <Stethoscope className="w-3 h-3" />
                                                      {doctorName}
                                                    </span>
                                                  )}
                                                </div>
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
                                {RX_TYPES.find((x) => x.value === header.type)?.label || header.type}
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

                            {/* ✅ Encounter select (OP/IP/OT) */}
                            {header.type !== "COUNTER" && (
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600">
                                  {header.type === "OP"
                                    ? "OPD Encounter / Visit"
                                    : header.type === "IP"
                                      ? "IPD Admission"
                                      : "OT Case"}
                                  <span className="text-[10px] text-slate-400"> (required)</span>
                                </Label>

                                <Select
                                  value={header.encounterId || ""}
                                  onValueChange={(val) => {
                                    const e = encounters.find((x) => String(getEncounterId(x)) === String(val)) || null
                                    setHeader((p) => ({ ...p, encounterId: val, encounterObj: e }))
                                  }}
                                  disabled={!header.patient || encLoading}
                                >
                                  <SelectTrigger className="w-full bg-white/70 backdrop-blur border-slate-500 rounded-full h-10 text-sm">
                                    <SelectValue
                                      placeholder={
                                        !header.patient
                                          ? "Select patient first"
                                          : encLoading
                                            ? "Loading encounters..."
                                            : encounters.length
                                              ? "Select encounter..."
                                              : "No encounters found"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {encLoading && (
                                      <SelectItem value="__loading" disabled>
                                        Loading...
                                      </SelectItem>
                                    )}
                                    {!encLoading && !encounters.length && (
                                      <SelectItem value="__none" disabled>
                                        No encounters found (create visit/admission/case first)
                                      </SelectItem>
                                    )}
                                    {!encLoading &&
                                      encounters.map((e) => {
                                        console.log(e, "qwertyuiop");

                                        const id = getEncounterId(e)
                                        return (
                                          <SelectItem key={id} value={String(id)}>
                                            {getEncounterLabel(e, header.type)}
                                          </SelectItem>
                                        )
                                      })}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <Label className="text-xs text-slate-600 flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" />
                                Consultant / Prescriber {header.type === "COUNTER" ? "(optional)" : "(required)"}
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
                                  Flow:
                                </span>
                                <span>Patient → Encounter → Medicines → Save</span>
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

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className={[
                                  "px-3 py-2 rounded-full text-xs border backdrop-blur shadow-sm",
                                  scanEnabled
                                    ? "bg-emerald-50/70 text-emerald-700 border-emerald-200"
                                    : "bg-white/70 text-slate-700 border-slate-500",
                                ].join(" ")}
                                onClick={() => setScanEnabled((v) => !v)}
                                title="Barcode scanner mode (type fast + Enter)"
                              >
                                <Barcode className="w-3.5 h-3.5 inline mr-1" />
                                Scan
                              </button>

                              <button
                                type="button"
                                className={[
                                  "px-3 py-2 rounded-full text-xs border backdrop-blur shadow-sm",
                                  simpleAddMode
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white/70 text-slate-700 border-slate-500",
                                ].join(" ")}
                                onClick={() => setSimpleAddMode((v) => !v)}
                                title="Toggle simplified line builder"
                              >
                                <Wand2 className="w-3.5 h-3.5 inline mr-1" />
                                {simpleAddMode ? "Simple" : "Advanced"}
                              </button>

                              <div className="text-[11px] text-slate-500">
                                {lines.length ? `${lines.length} lines` : "No lines yet"}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-3">
                            {/* Quick Add Builder */}
                            <div className="border border-slate-500/70 rounded-2xl p-3 bg-white/60 backdrop-blur">
                              <div className="grid lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-3">
                                <div className="space-y-2">
                                  {/* Medicine search */}
                                  <div className="space-y-1 relative" ref={medDropRef}>
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[11px] text-slate-600">
                                        Medicine{" "}
                                        <span className="text-[10px] text-slate-400">(search or scan)</span>
                                      </Label>

                                      <span className="text-[10px] text-slate-500">
                                        Auto qty:{" "}
                                        <span className="font-medium">{calcAutoQty(currentLine) || "—"}</span>
                                      </span>
                                    </div>

                                    <div className="relative">
                                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                      <Input
                                        ref={medInputRef}
                                        value={medQuery}
                                        onChange={(e) => {
                                          lastScanRef.current = ""
                                          setMedQuery(e.target.value)
                                          setShowMedDropdown(true)
                                        }}
                                        placeholder="Drug name / brand / barcode..."
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
                                            <div className="px-3 py-2 text-slate-500">Searching medicines...</div>
                                          )}

                                          {!medSearching && !medResults.length && (
                                            <div className="px-3 py-2 text-slate-500">No items found</div>
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
                                                    <span className="text-[10px] text-slate-500">{it.code}</span>
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

                                                  <Badge variant="outline" className="text-[10px] border-slate-500">
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
                                                  
                                                  {it.auto_selected && (
                                                    <Badge
                                                      variant="outline"
                                                      className="text-[10px] border-blue-200 text-blue-700 bg-blue-50"
                                                    >
                                                      ✓ Auto-select
                                                    </Badge>
                                                  )}
                                                </div>
                                              </button>
                                            ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  {/* ✅ SIMPLE MODE: Presets + Days (minimal clicks) */}
                                  {simpleAddMode ? (
                                    <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-3 space-y-3">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-slate-600">
                                            Frequency <span className="text-[10px] text-slate-400">(required)</span>
                                          </Label>
                                          <div className="flex flex-wrap gap-1.5">
                                            {SIMPLE_FREQ_PRESETS.map((f) => {
                                              const selected =
                                                slotsToFrequency(currentLine.dose_slots || emptySlots()) ===
                                                slotsToFrequency(frequencyToSlots(f.value))
                                              return (
                                                <button
                                                  key={f.value}
                                                  type="button"
                                                  onClick={() => {
                                                    setCurrentLine((prev) =>
                                                      applyAuto({
                                                        ...prev,
                                                        dose_slots: frequencyToSlots(f.value),
                                                      })
                                                    )
                                                  }}
                                                  className={[
                                                    "px-3 py-1 rounded-full text-[11px] border shadow-sm transition",
                                                    selected
                                                      ? "bg-slate-900 text-white border-slate-900"
                                                      : "bg-white/70 text-slate-700 border-slate-500 backdrop-blur",
                                                  ].join(" ")}
                                                >
                                                  {f.label}
                                                </button>
                                              )
                                            })}
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-slate-600">
                                            Days <span className="text-[10px] text-slate-400">(required)</span>
                                          </Label>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-10 w-10 rounded-full border-slate-500 bg-white/70"
                                              onClick={() => {
                                                const cur = Number(currentLine.duration_days || 0) || 0
                                                const next = Math.max(0, cur - 1)
                                                setCurrentLine((p) => applyAuto({ ...p, duration_days: String(next || "") }))
                                              }}
                                            >
                                              −
                                            </Button>
                                            <Input
                                              value={currentLine.duration_days}
                                              onChange={(e) =>
                                                setCurrentLine((p) => applyAuto({ ...p, duration_days: e.target.value }))
                                              }
                                              placeholder="e.g. 5"
                                              className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full text-center"
                                            />
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-10 w-10 rounded-full border-slate-500 bg-white/70"
                                              onClick={() => {
                                                const cur = Number(currentLine.duration_days || 0) || 0
                                                const next = cur + 1
                                                setCurrentLine((p) => applyAuto({ ...p, duration_days: String(next) }))
                                              }}
                                            >
                                              +
                                            </Button>
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-slate-600">
                                            Total Qty <span className="text-[10px] text-slate-400">(auto)</span>
                                          </Label>
                                          <div className="h-10 rounded-full border border-slate-500 bg-white/70 backdrop-blur px-3 flex items-center justify-between">
                                            <div className="text-sm font-semibold text-slate-900">
                                              {calcAutoQty(currentLine) || "—"}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                              {parseFrequencyToPerDay(currentLine.frequency) ? `${parseFrequencyToPerDay(currentLine.frequency)}/day` : "Pick freq"}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-slate-600">Route</Label>
                                          <Select
                                            value={currentLine.route || "PO"}
                                            onValueChange={(val) => setCurrentLine((p) => ({ ...p, route: val }))}
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
                                            Instructions <span className="text-[10px] text-slate-400">(optional)</span>
                                          </Label>
                                          <Input
                                            value={currentLine.instructions}
                                            onChange={(e) => setCurrentLine((p) => ({ ...p, instructions: e.target.value }))}
                                            placeholder="After food, morning & night..."
                                            className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                          />
                                        </div>
                                      </div>

                                      {/* Stock hint */}
                                      {(() => {
                                        const autoQty = Number(calcAutoQty(currentLine) || 0)
                                        const avail = Number(currentLine.available_qty ?? currentLine.item?.available_qty ?? 0)
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
                                            {exceeds ? <span className="ml-2 font-medium">(Qty exceeds stock)</span> : null}
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  ) : (
                                    // Advanced: M/A/E/N (your old style, still available)
                                    <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-3 space-y-3">
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <Label className="text-[11px] text-slate-600">Dosage schedule (M/A/E/N)</Label>
                                          <div className="text-[10px] text-slate-500">
                                            Stored as:{" "}
                                            <span className="font-medium">
                                              {slotsToFrequency(currentLine.dose_slots || emptySlots())}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {SLOT_KEYS.map((k) => (
                                            <label
                                              key={k}
                                              className={[
                                                "h-10 rounded-full border px-3 flex items-center gap-2 cursor-pointer select-none",
                                                "bg-white/70 backdrop-blur",
                                                currentLine.dose_slots?.[k] ? "border-slate-900" : "border-slate-500",
                                              ].join(" ")}
                                            >
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-slate-900"
                                                checked={!!currentLine.dose_slots?.[k]}
                                                onChange={() => {
                                                  setCurrentLine((prev) => {
                                                    const nextSlots = { ...(prev.dose_slots || emptySlots()) }
                                                    nextSlots[k] = nextSlots[k] ? 0 : 1
                                                    return applyAuto({ ...prev, dose_slots: nextSlots })
                                                  })
                                                }}
                                              />
                                              <span className="text-sm text-slate-700">{SLOT_META[k].label}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-slate-600">Days</Label>
                                          <Input
                                            value={currentLine.duration_days}
                                            onChange={(e) => setCurrentLine((p) => applyAuto({ ...p, duration_days: e.target.value }))}
                                            className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-slate-600">Dose (optional)</Label>
                                          <Input
                                            value={currentLine.dose}
                                            onChange={(e) => setCurrentLine((p) => ({ ...p, dose: e.target.value }))}
                                            className="h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-slate-600">Auto Qty</Label>
                                          <div className="h-10 rounded-full border border-slate-500 bg-white/70 backdrop-blur px-3 flex items-center justify-between">
                                            <div className="text-sm font-semibold text-slate-900">
                                              {calcAutoQty(currentLine) || "—"}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col justify-between gap-2">
                                  <div className="text-[11px] text-slate-500">
                                    <p className="leading-relaxed">
                                      ✅ Minimal steps: <b>Medicine → Frequency → Days → Add</b>
                                      <br />
                                      Qty is auto-calculated & validated with stock.
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
                                            ? "Pick frequency + days"
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
                              <ScrollArea className="max-h-[340px]">
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[760px] text-[12px]">
                                    <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur">
                                      <tr className="text-[11px] text-slate-500">
                                        <th className="text-left px-3 py-2 font-medium">#</th>
                                        <th className="text-left px-3 py-2 font-medium">Medicine</th>
                                        <th className="text-left px-3 py-2 font-medium">Freq / Days</th>
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
                                                {l.item?.name || l.item_name || "Unnamed medicine"}
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
                                                {l.frequency || slotsToFrequency(l.dose_slots)} •{" "}
                                                {l.duration_days ? `${l.duration_days} days` : "—"}
                                              </span>
                                              {l.instructions && (
                                                <span className="text-[11px] text-slate-500">{l.instructions}</span>
                                              )}
                                            </div>
                                          </td>

                                          <td className="px-3 py-2 align-top text-[12px] text-slate-700">
                                            {l.route || "—"}
                                          </td>

                                          <td className="px-3 py-2 align-top text-right text-[12px] text-slate-700 font-semibold">
                                            {l.total_qty || calcAutoQty(l) || "—"}
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

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 px-2 text-sm text-slate-500 justify-start"
                                onClick={() => {
                                  resetForm(true)
                                  setTab("list")
                                }}
                              >
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to queue
                              </Button>

                              <div className="flex items-center gap-2 justify-end">
                                <div className="text-[11px] text-slate-500 hidden md:block">
                                  Patient:{" "}
                                  <span className="font-medium text-slate-700">
                                    {header.patient ? getPatientDisplay(header.patient) : header.type === "COUNTER" ? "Counter" : "—"}
                                  </span>
                                  <span className="mx-2 text-slate-300">|</span>
                                  Lines: <span className="font-medium text-slate-700">{lines.length}</span>
                                </div>

                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-10 px-5 rounded-full shadow-sm"
                                  onClick={handleSubmitRx}
                                  disabled={submitting}
                                >
                                  {submitting ? (
                                    "Saving..."
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

                    {/* DETAIL TAB */}
                    <TabsContent value="detail" className="mt-4">
                      {!selectedRx ? (
                        <GlassCard>
                          <CardContent className="py-10 text-center text-sm text-slate-500">
                            Select a prescription from the queue to view details.
                          </CardContent>
                        </GlassCard>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)]">
                          <GlassCard>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-slate-500" />
                                Prescription #{selectedRx.rx_number || selectedRx.id}
                                <StatusPill status={selectedRx.status || "PENDING"} />
                              </CardTitle>

                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span>
                                  Type:{" "}
                                  <Badge variant="outline" className="px-2 py-0.5">
                                    {RX_TYPES.find((x) => x.value === fromBackendType(selectedRx.type || selectedRx.rx_type))?.label ||
                                      fromBackendType(selectedRx.type || selectedRx.rx_type)}
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
                                  onClick={() => setTab("list")}
                                >
                                  <ArrowLeft className="w-4 h-4 mr-2" />
                                  Back
                                </Button>

                                <Button
                                  className="rounded-full"
                                  onClick={() => {
                                    const t = fromBackendType(selectedRx.type || selectedRx.rx_type || "OPD")
                                    startNewRx(t)

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
                                <ScrollArea className="max-h-[520px]">
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] text-[12px]">
                                      <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur">
                                        <tr className="text-[11px] text-slate-500">
                                          <th className="text-left px-3 py-2 font-medium">#</th>
                                          <th className="text-left px-3 py-2 font-medium">Medicine</th>
                                          <th className="text-left px-3 py-2 font-medium">Freq / Days</th>
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
                                          const itemName = pick(l, ["item_name", "medicine_name", "name"], "")
                                          const strength = pick(l, ["strength", "item_strength"], "")
                                          const route = pick(l, ["route", "route_code"], "")
                                          const freq = pick(l, ["frequency", "frequency_code", "freq"], "")
                                          const days = pick(l, ["duration_days", "days", "duration"], "")
                                          const qty = pick(l, ["total_qty", "requested_qty", "qty"], "")

                                          return (
                                            <tr key={l.id || idx} className="border-t border-slate-100">
                                              <td className="px-3 py-2 align-top text-slate-500">{idx + 1}</td>
                                              <td className="px-3 py-2 align-top">
                                                <div className="flex flex-col">
                                                  <span className="text-[12px] font-semibold text-slate-900">
                                                    {itemName || "Unnamed medicine"}
                                                  </span>
                                                  {strength ? (
                                                    <span className="text-[11px] text-slate-500">{strength}</span>
                                                  ) : null}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 align-top text-[12px] text-slate-700">
                                                {freq || "—"} • {days ? `${days} days` : "—"}
                                              </td>
                                              <td className="px-3 py-2 align-top text-[12px] text-slate-700">
                                                {route || "—"}
                                              </td>
                                              <td className="px-3 py-2 align-top text-right text-[12px] text-slate-700 font-semibold">
                                                {qty || "—"}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </ScrollArea>
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
