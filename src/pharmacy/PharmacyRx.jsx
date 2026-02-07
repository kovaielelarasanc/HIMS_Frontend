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
  ArrowRight,
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
  Trash2,
} from "lucide-react"
import { formatIST } from "@/ipd/components/timeZONE"

/* ----------------------------- constants ----------------------------- */

const MANUAL_TYPES = ["OP", "IP", "OT", "COUNTER"]

const RX_TYPES = [
  { value: "OP", label: "OPD" },
  { value: "IP", label: "IPD" },
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
    const dt = pick(e, ["admitted_at", "admission_date", "admitted_date", "date", "created_at", "start_at", "encounter_at"], "")
    
    console.log('IPD Encounter data:', e, 'Date field:', dt) // Debug log
    
    // Format date as DD-MM-YYYY for better readability
    const formatDateForAdmission = (dateStr) => {
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
    
    const admissionNumber = no || `#${getEncounterId(e)}`
    const formattedDate = formatDateForAdmission(dt)
    const admissionLabel = formattedDate ? `Admission ${admissionNumber} - ${formattedDate}` : `Admission ${admissionNumber}`
    
    return [admissionLabel, ward].filter(Boolean).join(" • ")
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
        value="newprescription"
        className="rounded-full px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
      >
        New Prescription
      </TabsTrigger>
      <TabsTrigger
        value="list"
        className="rounded-full px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
      >
        Queue
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
  const [tab, setTab] = useState("newprescription") // 'list' | 'newprescription' | 'detail'

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
  const [defaultMedicines, setDefaultMedicines] = useState([])

  // ✅ quick add UX
  const [simpleAddMode, setSimpleAddMode] = useState(true)
  const [scanEnabled, setScanEnabled] = useState(true)
  const lastScanRef = useRef("")
  const [defaultMedicinesLoaded, setDefaultMedicinesLoaded] = useState(false)

  // Refs
  const patientDropRef = useRef(null)
  const medDropRef = useRef(null)
  const medInputRef = useRef(null)
  const listSearchRef = useRef(null)
  const patientInputRef = useRef(null)
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
    enabled: scanEnabled && tab === "newprescription",
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
  }, [rxTypeFilter, statusFilter, debouncedSearch, newType])

  useEffect(() => {
    if (tab !== "list") return
    if (!autoRefresh) return
    const t = setInterval(() => fetchRxList(true), 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, autoRefresh, rxTypeFilter, statusFilter, debouncedSearch, newType])

  async function fetchRxList(silent = false) {
    try {
      if (!silent) setListLoading(true)
      const params = {}
      // Use newType as primary filter, fallback to rxTypeFilter
      const typeFilter = newType !== "OP" ? newType : (rxTypeFilter !== "ALL" ? rxTypeFilter : null)
      if (typeFilter) params.type = toBackendType(typeFilter)
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
  async function loadDefaultMedicines() {
    try {
      setMedSearching(true)
      const res = await searchItemBatches({
        location_id: pharmacyLocationId,
        q: "", // Empty query to get default items
        limit: 10,
        type: "drug",
        only_in_stock: true,
        exclude_expired: true,
        active_only: true,
      })

      const payload = res?.data?.data ?? res?.data
      const rows = payload?.items ?? payload ?? []
      const arr = Array.isArray(rows) ? rows : []
      setDefaultMedicines(arr)
      setMedResults(arr)
      setDefaultMedicinesLoaded(true)
    } catch {
      setDefaultMedicines([])
      setMedResults([])
    } finally {
      setMedSearching(false)
    }
  }

  // Load default medicines when tab opens
  useEffect(() => {
    if (tab === "newprescription" && !defaultMedicinesLoaded) {
      loadDefaultMedicines()
    }
  }, [tab, defaultMedicinesLoaded, pharmacyLocationId])

  useEffect(() => {
    const q = debouncedMedQuery?.trim()
    if (!q || q.length < 2) {
      // Show default medicines when no search query
      setMedResults(defaultMedicines)
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
  }, [debouncedMedQuery, pharmacyLocationId, defaultMedicines])

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

  function handleDirectAddMedicine(row) {
    const itemId = toInt(row?.item_id ?? row?.id)
    const batchId = toInt(row?.batch_id)

    if (!itemId) {
      toast.error("Invalid item selected (missing item_id).")
      return
    }

    const newLine = {
      item: row,
      item_id: itemId,
      item_name: row.name || "",
      strength: row.strength || row.form || "",
      route: "PO",
      batch_id: batchId || null,
      batch_no: row.batch_no || "",
      expiry_date: row.expiry_date || null,
      available_qty: row.available_qty ?? "",
      dose_slots: { M: 1, A: 0, E: 0, N: 1 },
      duration_days: "0",
      dose: "",
      instructions: "",
      is_prn: false,
      is_stat: false,
    }

    const computed = applyAuto(newLine)
    
    if (!computed.total_qty) {
      const autoQty = calcAutoQty(computed)
      computed.total_qty = autoQty
      computed.requested_qty = autoQty
    }

    const qty = Number(computed.total_qty || 0)
    const available = Number(computed.available_qty ?? row.available_qty ?? 0)
    
    if (Number.isFinite(available) && available > 0 && qty > available) {
      toast.error(`Qty exceeds available stock (Available: ${available})`)
      return
    }
    
    const key = `${itemId}::${batchId || ""}`
    const idx = lines.findIndex((l) => {
      const li = toInt(l.item_id ?? l.item?.item_id ?? l.item?.id)
      const lb = toInt(l.batch_id ?? l.item?.batch_id)
      return `${li}::${lb || ""}` === key
    })

    if (idx >= 0) {
      toast.info("Medicine already added.")
      return
    }

    setLines((prev) => [...prev, computed])
    toast.success(`Added ${row.name}`)
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
    setTab("newprescription")

    setTimeout(() => {
      patientInputRef.current?.focus?.()
    }, 60)
  }

  function handleAddLine() {
    const itemId = toInt(currentLine.item_id ?? currentLine.item?.item_id ?? currentLine.item?.id)
    if (!itemId) {
      toast.error("Please select the medicine from dropdown / scan barcode.")
      return
    }

    const newLine = {
      ...currentLine,
      item_id: itemId,
      // Set defaults if not filled
      duration_days: currentLine.duration_days || "5",
      dose_slots: currentLine.dose_slots || { M: 1, A: 0, E: 0, N: 1 },
      frequency: currentLine.frequency || slotsToFrequency({ M: 1, A: 0, E: 0, N: 1 }),
      route: currentLine.route || "PO",
    }

    const computed = applyAuto(newLine)
    
    // Ensure total_qty is set
    if (!computed.total_qty) {
      const autoQty = calcAutoQty(computed)
      computed.total_qty = autoQty
      computed.requested_qty = autoQty
    }
    
    const batchId = toInt(computed.batch_id ?? computed.item?.batch_id)
    const key = `${itemId}::${batchId || ""}`

    const idx = lines.findIndex((l) => {
      const li = toInt(l.item_id ?? l.item?.item_id ?? l.item?.id)
      const lb = toInt(l.batch_id ?? l.item?.batch_id)
      return `${li}::${lb || ""}` === key
    })

    if (idx >= 0) {
      toast.info("Medicine already added. Edit it in the table on the right.")
      return
    }

    setLines((prev) => [...prev, computed])
    
    // Reset current line but keep search
    setCurrentLine(makeEmptyLine())
    setMedQuery("")
    setTimeout(() => medInputRef.current?.focus?.(), 50)
  }

  function handleRemoveLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmitRx() {
    const type = safeStr(header.type).toUpperCase()
    const isCounter = type === "COUNTER"

    if (!header.patient) return toast.error("Select a patient")
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

      patient_id: toInt(header.patient?.id),
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
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
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
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-2xl border border-slate-500 bg-white/70 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Total</div>
                        <div className="text-sm font-bold text-slate-900">{queueStats.total}</div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-amber-700 font-bold">Pending</div>
                        <div className="text-sm font-bold text-amber-900">{queueStats.pending}</div>
                      </div>
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-blue-700 font-bold">Partial</div>
                        <div className="text-sm font-bold text-blue-900">{queueStats.partial}</div>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 backdrop-blur px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-bold">Done</div>
                        <div className="text-sm font-bold text-emerald-900">{queueStats.disp}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2 rounded-full border border-slate-500 bg-white/70 backdrop-blur px-3 py-2 shadow-sm">
                      <Sparkles className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-600 font-bold">Queue</span>
                      <Badge variant="outline" className="text-[11px] font-bold">
                        {queueStats.total}
                      </Badge>
                    </div>

                    <Select value={newType} onValueChange={(value) => {
                      setNewType(value)
                      setRxTypeFilter(value) // Sync with queue filter
                      startNewRx(value)
                    }}>
                      <SelectTrigger className="w-full sm:w-[170px] bg-slate-900 text-white backdrop-blur border-slate-900 rounded-full font-bold">
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
                    <TabsContent value="newprescription" className="mt-4">
                      <div className="space-y-4">
                        {/* Prescription Details Card */}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                              {/* Patient picker */}
                              <div className="space-y-1.5 relative" ref={patientDropRef}>
                                <Label className="text-xs text-slate-600 flex items-center gap-1.5 h-10">
                                  <User className="w-3 h-3" />
                                  Patient
                                </Label>

                                <div className="relative">
                                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                  <Input
                                    ref={patientInputRef}
                                    value={patientQuery}
                                    onChange={(e) => {
                                      setPatientQuery(e.target.value)
                                      setShowPatientDropdown(true)
                                    }}
                                    placeholder="Search..."
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

                              {/* Encounter select (OP/IP/OT) */}
                              {header.type !== "COUNTER" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-slate-600 h-10 flex items-center">
                                    {header.type === "OP" ? "Visit" : header.type === "IP" ? "Admission" : "OT Case"}
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
                                              ? "Loading..."
                                              : encounters.length
                                                ? "Select..."
                                                : "No encounters"
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
                                          No encounters found
                                        </SelectItem>
                                      )}
                                      {!encLoading &&
                                        encounters.map((e) => {
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
                                <Label className="text-xs text-slate-600 flex items-center gap-1 h-10">
                                  <Stethoscope className="w-3 h-3" />
                                  Consultant
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
                                <Label className="text-xs text-slate-600 h-10 flex items-center">Date & Time</Label>
                                <Input
                                  type="datetime-local"
                                  value={header.datetime}
                                  onChange={(e) => setHeader((prev) => ({ ...prev, datetime: e.target.value }))}
                                  className="h-10 text-xs bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600 h-10 flex items-center">Priority</Label>
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

                            {header.patient && header.type !== "COUNTER" ? (
                              <PatientSummaryCard patient={header.patient} loading={patientHydrating} />
                            ) : null}

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

                        {/* Medicines Card */}
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
                            <div className="grid lg:grid-cols-2 gap-4">
                              {/* Left: Medicine Form */}
                              <div className="space-y-3">
                                {/* Quick Add Builder */}
                                <div className="border border-slate-500/70 rounded-2xl p-3 bg-white/60 backdrop-blur">
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
                                          }}
                                          placeholder="Drug name / brand / barcode..."
                                          className="pl-9 h-10 text-sm bg-white/70 backdrop-blur border-slate-500 rounded-full"
                                        />
                                      </div>
                                    </div>

                                    {/* Available medicines list - always visible */}
                                    <div className="border border-slate-200 rounded-2xl bg-white/70 backdrop-blur p-3">
                                      <div className="text-[11px] text-slate-600 mb-2 font-medium flex items-center justify-between">
                                        <span>Available Medicines:</span>
                                        {medSearching && <span className="text-slate-400">Searching...</span>}
                                      </div>
                                      <div className="grid gap-2 max-h-48 overflow-auto">
                                        {!medSearching && medResults.length === 0 && (
                                          <div className="text-center py-4 text-xs text-slate-500">
                                            {medQuery.trim() ? "No medicines found" : "Start typing to search medicines"}
                                          </div>
                                        )}
                                        {medResults.map((it) => (
                                            <div
                                              key={it.id}
                                              className="w-full p-2 hover:bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-2"
                                            >
                                              <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center gap-2">
                                                  <span className="font-medium text-slate-900 text-xs">
                                                    {it.name || it.item_name}
                                                  </span>
                                                  {it.code && (
                                                    <span className="text-[9px] text-slate-500">{it.code}</span>
                                                  )}
                                                </div>

                                                <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2 mt-1">
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
                                              </div>
                                              <Button
                                                type="button"
                                                size="sm"
                                                className="h-8 px-3 rounded-full text-xs flex-shrink-0"
                                                onClick={() => handleDirectAddMedicine(it)}
                                              >
                                                <Plus className="w-3 h-3 mr-1" />
                                                Add
                                              </Button>
                                            </div>
                                          ))}
                                      </div>
                                    </div>

                                  </div>
                                </div>

                                <div className="text-[11px] text-slate-500">
                                  <p className="leading-relaxed">
                                    ✅ Quick workflow: <b>Search Medicine → Add Item → Fill details in table</b>
                                    <br />
                                    Edit frequency, days, route & instructions directly in the table on the right.
                                  </p>
                                </div>
                              </div>

                              {/* Right: Lines Table */}
                              <div className="space-y-3">
                                <div className="border rounded-2xl overflow-hidden bg-white">
                                  <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-slate-900">Selected ({lines.length})</div>
                                  </div>
                                  <div className="max-h-[500px] overflow-y-auto">
                                    <div className="overflow-x-auto">
                                      <table className="w-full min-w-[860px] text-sm">
                                        <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                          <tr className="text-left">
                                            <th className="p-2">#</th>
                                            <th className="p-2">Medicine</th>
                                            {simpleAddMode ? (
                                              <>
                                                <th className="p-2 w-[120px]">Frequency</th>
                                                <th className="p-2 w-[90px]">Days</th>
                                              </>
                                            ) : (
                                              <>
                                                <th className="p-2 w-[180px]">M-A-E-N</th>
                                                <th className="p-2 w-[90px]">Days</th>
                                                <th className="p-2 w-[100px]">Dose</th>
                                              </>
                                            )}
                                            <th className="p-2 w-[100px]">Route</th>
                                            <th className="p-2 w-[80px] text-right">Qty</th>
                                            <th className="p-2 w-[220px]">Instructions</th>
                                            <th className="p-2 w-[50px]"></th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y bg-white">
                                          {!lines.length && (
                                            <tr>
                                              <td colSpan={simpleAddMode ? 8 : 9} className="p-3 text-center text-sm text-slate-500">
                                                No lines added. Select medicines from the left and click "Add Item".
                                              </td>
                                            </tr>
                                          )}

                                          {lines.map((l, idx) => (
                                            <tr key={`${l.item_id || l.item?.id || idx}-${idx}`}>
                                              <td className="p-2 align-middle text-slate-500">{idx + 1}</td>
                                              <td className="p-2 align-middle">
                                                <div className="font-medium text-slate-900">
                                                  {l.item?.name || l.item_name || "Unnamed medicine"}
                                                </div>
                                                {(l.strength || l.item?.strength) && (
                                                  <div className="text-xs text-slate-500">
                                                    {l.strength || l.item?.strength}
                                                  </div>
                                                )}
                                                {(l.batch_no || l.item?.batch_no) && (
                                                  <div className="text-xs text-slate-500">
                                                    Batch: {l.batch_no || l.item?.batch_no}
                                                  </div>
                                                )}
                                              </td>

                                              {simpleAddMode ? (
                                                <>
                                                  <td className="p-2 align-middle">
                                                    <Select
                                                      value={slotsToFrequency(l.dose_slots || emptySlots())}
                                                      onValueChange={(val) => {
                                                        setLines((prev) =>
                                                          prev.map((x, i) => {
                                                            if (i !== idx) return x
                                                            const updated = applyAuto({ ...x, dose_slots: frequencyToSlots(val) })
                                                            const qty = Number(updated.total_qty || 0)
                                                            const available = Number(x.available_qty ?? x.item?.available_qty ?? 0)
                                                            if (Number.isFinite(available) && available > 0 && qty > available) {
                                                              toast.error(`Qty exceeds available stock (Available: ${available})`)
                                                              return x
                                                            }
                                                            return updated
                                                          })
                                                        )
                                                      }}
                                                    >
                                                      <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                                                        <SelectValue>
                                                          {(() => {
                                                            const freq = slotsToFrequency(l.dose_slots || emptySlots())
                                                            const preset = SIMPLE_FREQ_PRESETS.find(f => f.value === freq || slotsToFrequency(frequencyToSlots(f.value)) === freq)
                                                            return preset ? preset.label : freq
                                                          })()}
                                                        </SelectValue>
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {SIMPLE_FREQ_PRESETS.map((f) => (
                                                          <SelectItem key={f.value} value={f.value}>
                                                            {f.label}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </td>
                                                  <td className="p-2 align-middle">
                                                    <Input
                                                      value={l.duration_days || ""}
                                                      onChange={(e) =>
                                                        setLines((prev) =>
                                                          prev.map((x, i) => {
                                                            if (i !== idx) return x
                                                            const updated = applyAuto({ ...x, duration_days: e.target.value })
                                                            const qty = Number(updated.total_qty || 0)
                                                            const available = Number(x.available_qty ?? x.item?.available_qty ?? 0)
                                                            if (Number.isFinite(available) && available > 0 && qty > available) {
                                                              toast.error(`Qty exceeds available stock (Available: ${available})`)
                                                              return x
                                                            }
                                                            return updated
                                                          })
                                                        )
                                                      }
                                                      placeholder="Days"
                                                    />
                                                  </td>
                                                </>
                                              ) : (
                                                <>
                                                  <td className="p-2 align-middle">
                                                    <div className="flex items-center gap-1">
                                                      {SLOT_KEYS.map((k) => (
                                                        <Input
                                                          key={k}
                                                          value={l.dose_slots?.[k] ?? 0}
                                                          onChange={(e) => {
                                                            const val = Math.max(0, Math.min(9, Number(e.target.value) || 0))
                                                            setLines((prev) =>
                                                              prev.map((x, i) => {
                                                                if (i !== idx) return x
                                                                const updated = applyAuto({
                                                                  ...x,
                                                                  dose_slots: { ...(x.dose_slots || emptySlots()), [k]: val },
                                                                })
                                                                const qty = Number(updated.total_qty || 0)
                                                                const available = Number(x.available_qty ?? x.item?.available_qty ?? 0)
                                                                if (Number.isFinite(available) && available > 0 && qty > available) {
                                                                  toast.error(`Qty exceeds available stock (Available: ${available})`)
                                                                  return x
                                                                }
                                                                return updated
                                                              })
                                                            )
                                                          }}
                                                          placeholder={k}
                                                          className="w-10 text-center"
                                                          maxLength={1}
                                                        />
                                                      ))}
                                                    </div>
                                                  </td>
                                                  <td className="p-2 align-middle">
                                                    <Input
                                                      value={l.duration_days || ""}
                                                      onChange={(e) =>
                                                        setLines((prev) =>
                                                          prev.map((x, i) => {
                                                            if (i !== idx) return x
                                                            const updated = applyAuto({ ...x, duration_days: e.target.value })
                                                            const qty = Number(updated.total_qty || 0)
                                                            const available = Number(x.available_qty ?? x.item?.available_qty ?? 0)
                                                            if (Number.isFinite(available) && available > 0 && qty > available) {
                                                              toast.error(`Qty exceeds available stock (Available: ${available})`)
                                                              return x
                                                            }
                                                            return updated
                                                          })
                                                        )
                                                      }
                                                      placeholder="Days"
                                                    />
                                                  </td>
                                                  <td className="p-2 align-middle">
                                                    <Input
                                                      value={l.dose || ""}
                                                      onChange={(e) =>
                                                        setLines((prev) =>
                                                          prev.map((x, i) => (i === idx ? { ...x, dose: e.target.value } : x))
                                                        )
                                                      }
                                                      placeholder="Dose"
                                                    />
                                                  </td>
                                                </>
                                              )}

                                              <td className="p-2 align-middle">
                                                <Select
                                                  value={l.route || "PO"}
                                                  onValueChange={(val) =>
                                                    setLines((prev) =>
                                                      prev.map((x, i) => (i === idx ? { ...x, route: val } : x))
                                                    )
                                                  }
                                                >
                                                  <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {ROUTE_PRESETS.map((r) => (
                                                      <SelectItem key={r} value={r}>
                                                        {r}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </td>

                                              <td className="p-2 align-middle text-right font-semibold">
                                                {l.total_qty || calcAutoQty(l) || "—"}
                                              </td>

                                              <td className="p-2 align-middle">
                                                <Input
                                                  value={l.instructions || ""}
                                                  onChange={(e) =>
                                                    setLines((prev) =>
                                                      prev.map((x, i) =>
                                                        i === idx ? { ...x, instructions: e.target.value } : x
                                                      )
                                                    )
                                                  }
                                                  placeholder="Instructions"
                                                />
                                              </td>

                                              <td className="p-2 align-middle">
                                                <Button
                                                  variant="ghost"
                                                  onClick={() => handleRemoveLine(idx)}
                                                  title="Remove"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </Button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 -mx-6 px-6 py-3 mt-4 z-20">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                                  <ArrowRight className="w-4 h-4 mr-1" />
                                  Next to queue
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
