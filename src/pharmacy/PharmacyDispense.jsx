// FILE: src/pages/PharmacyDispense.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

import API from '../api/client' // ✅ add this

import {
  listDispenseQueue,
  getPharmacyPrescription,
  dispensePharmacyPrescription,
  openPharmacyPrescriptionPdfInNewTab,
} from '../api/pharmacyRx'
import { listInventoryLocations } from '../api/inventory'
import { getPatientById } from '../api/patients'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import {
  Pill,
  ClipboardList,
  Search,
  User,
  Stethoscope,
  Clock3,
  CheckCircle2,
  Filter,
  MapPin,
  RefreshCcw,
  FileText,
  ArrowRight,
  X,
  Wand2,
  Layers, // ✅ icon for batch
} from 'lucide-react'

const RX_TYPES = [
  { value: 'ALL', label: 'All types' },
  { value: 'OPD', label: 'OPD' },
  { value: 'IPD', label: 'IPD' },
  { value: 'OT', label: 'OT' },
  { value: 'COUNTER', label: 'Counter' },
]

const ALL_LOC = 'ALL_LOC'

const TIMING_LABEL = {
  BF: 'Before food',
  AF: 'After food',
  AC: 'Before food',
  PC: 'After food',
  HS: 'Bedtime',
}

function safeUpper(x) {
  return String(x || '').toUpperCase()
}

function formatDateTime(x) {
  if (!x) return '—'
  const s = String(x)
  if (s.includes('T')) return s.slice(0, 16).replace('T', ' ')
  return s.length > 16 ? s.slice(0, 16) : s
}

function formatDateOnly(x) {
  if (!x) return '—'
  const s = String(x)
  return s.includes('T') ? s.slice(0, 10) : s
}

function num(x, def = 0) {
  const n = Number(x)
  return Number.isFinite(n) ? n : def
}

function unwrapApiData(res) {
  if (!res) return null
  const d = res?.data
  if (!d) return null
  return d?.data ?? d
}

function getPatientId(obj) {
  return obj?.patient_id || obj?.patientId || obj?.patient?.id || obj?.patient?.patient_id || null
}

function getPatientName(obj) {
  const p = obj?.patient
  const nameFromPatientObj =
    p?.full_name ||
    p?.name ||
    [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()

  const name =
    obj?.patient_name ||
    obj?.patient_full_name ||
    obj?.patient_display ||
    obj?.patientName ||
    obj?.patient_fullName ||
    nameFromPatientObj ||
    [obj?.patient_first_name, obj?.patient_last_name].filter(Boolean).join(' ').trim()

  if (name) return name
  const pid = getPatientId(obj)
  if (pid) return `Patient #${pid}`
  return '—'
}

function getPatientUhid(obj) {
  const p = obj?.patient
  return (
    obj?.patient_uhid ||
    obj?.uhid ||
    obj?.patientUhid ||
    p?.uhid ||
    p?.patient_uid ||
    p?.mrn ||
    ''
  )
}

// ✅ FIX: never return object
function getDoctorName(obj) {
  console.log(obj,);

  const d = obj?.doctor
  if (typeof obj?.doctor_name === 'string' && obj.doctor_name.trim()) return obj.doctor_name
  if (typeof obj?.doctor_display === 'string' && obj.doctor_display.trim()) return obj.doctor_display
  if (typeof obj?.doctorName === 'string' && obj.doctorName.trim()) return obj.doctorName

  if (d && typeof d === 'object') {
    return d.full_name || d.name || d.display_name || ''
  }
  if (typeof d === 'string') return d
  return ''
}

function getRxNo(obj) {
  return obj?.rx_number || obj?.prescription_number || obj?.prescriptionNumber || `RX-${obj?.id}`
}

function getRxType(obj) {
  return obj?.type || obj?.rx_type || obj?.rxType || 'OPD'
}

function getLineId(l) {
  return l?.id ?? l?.line_id ?? l?.rx_line_id ?? l?.prescription_line_id ?? null
}

function getFreqCode(l) {
  const f =
    l?.frequency_code ??
    l?.frequencyCode ??
    l?.frequency ??
    l?.freq ??
    l?.frequency_obj?.code ??
    l?.frequency_obj?.name ??
    l?.frequency?.code ??
    l?.frequency?.name ??
    ''
  return String(f || '').trim()
}

function getDoseText(l) {
  return l?.dose_text ?? l?.doseText ?? l?.dose ?? ''
}

function computeRequestedAndRemaining(l) {
  const requested = num(l.requested_qty ?? l.total_qty ?? l.qty ?? l.quantity ?? 0, 0)
  const dispensed = num(l.dispensed_qty ?? 0, 0)
  const remaining = Math.max(requested - dispensed, 0)
  return { requested, dispensed, remaining }
}

function suggestedQtyFromFreq(line) {
  const d = num(line?.duration_days || line?.durationDays || 0, 0)
  const raw = getFreqCode(line)
  const tpd = num(line?.times_per_day ?? line?.timesPerDay ?? 0, 0)

  if (!d) return ''

  if (/^\d+\-\d+\-\d+$/.test(raw)) {
    const parts = raw.split('-').map((x) => num(x || 0, 0))
    const perDay = parts.reduce((a, b) => a + b, 0)
    if (!perDay) return ''
    return perDay * d
  }

  const f = raw.toUpperCase()
  if (['OD', 'QD', 'DAILY'].includes(f)) return 1 * d
  if (['BD', 'BID', 'TWICE'].includes(f)) return 2 * d
  if (['TDS', 'TID', 'THRICE'].includes(f)) return 3 * d
  if (f === 'HS') return 1 * d
  if (['SOS', 'PRN'].includes(f)) return ''
  if (f === 'STAT') return 1

  if (tpd > 0) return tpd * d
  return ''
}

function parseMAN(freq, timesPerDay) {
  const f = String(freq || '').trim().toUpperCase()

  if (/^\d+\-\d+\-\d+$/.test(f)) {
    const [m, a, n] = f.split('-').map((x) => num(x, 0))
    return { m, a, n, note: '' }
  }

  if (['OD', 'QD', 'DAILY'].includes(f)) return { m: 1, a: 0, n: 0, note: '' }
  if (['BD', 'BID', 'TWICE'].includes(f)) return { m: 1, a: 0, n: 1, note: '' }
  if (['TDS', 'TID', 'THRICE'].includes(f)) return { m: 1, a: 1, n: 1, note: '' }
  if (f === 'HS') return { m: 0, a: 0, n: 1, note: 'HS' }
  if (['SOS', 'PRN'].includes(f)) return { m: 0, a: 0, n: 0, note: 'PRN / SOS' }
  if (f === 'STAT') return { m: 1, a: 0, n: 0, note: 'STAT' }

  const tpd = num(timesPerDay, 0)
  if (tpd === 1) return { m: 1, a: 0, n: 0, note: '' }
  if (tpd === 2) return { m: 1, a: 0, n: 1, note: '' }
  if (tpd === 3) return { m: 1, a: 1, n: 1, note: '' }
  if (tpd > 3) return { m: 1, a: 1, n: 1, note: `${tpd} times/day` }

  return { m: 0, a: 0, n: 0, note: '' }
}

function parseTimingTokens(timing) {
  const t = String(timing || '').trim().toUpperCase()
  if (!t) return []
  return t.split(/[/,|\s-]+/).filter(Boolean)
}

function mapTimingToSlots(m, a, n, timing) {
  const tks = parseTimingTokens(timing)
  const out = { M: '', A: '', N: '' }
  if (!tks.length) return out
  if (tks.length === 1) return { M: tks[0], A: tks[0], N: tks[0] }

  const slots = []
  if (m > 0) slots.push('M')
  if (a > 0) slots.push('A')
  if (n > 0) slots.push('N')

  slots.forEach((slot, idx) => {
    out[slot] = tks[idx] || tks[tks.length - 1] || ''
  })
  return out
}

function durationText(l) {
  const d = num(l?.duration_days ?? l?.durationDays, 0)
  if (d > 0) return `${d} day${d === 1 ? '' : 's'}`
  if (l?.duration) return String(l.duration)
  return '—'
}

function StatusPillSmall({ status }) {
  const s = safeUpper(status)
  let label = s || '—'
  let cls = 'bg-slate-50 text-slate-700 border border-slate-500'

  if (s === 'PENDING' || s === 'NEW' || s === 'DRAFT' || s === 'ISSUED') {
    label = s === 'DRAFT' ? 'Draft' : 'Pending'
    cls = 'bg-amber-50 text-amber-700 border border-amber-200'
  } else if (s === 'PARTIAL' || s === 'PARTIALLY_DISPENSED') {
    label = 'Partial'
    cls = 'bg-blue-50 text-blue-700 border border-blue-200'
  } else if (s === 'DISPENSED' || s === 'COMPLETED') {
    label = 'Dispensed'
    cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  } else if (s === 'CANCELLED') {
    label = 'Cancelled'
    cls = 'bg-rose-50 text-rose-700 border border-rose-200'
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] rounded-full ${cls}`}>
      {label}
    </span>
  )
}

function LineInstruction({ line }) {
  const dose = getDoseText(line)
  const freq = getFreqCode(line)
  const tpd = line?.times_per_day ?? line?.timesPerDay
  const { m, a, n, note } = parseMAN(freq, tpd)
  const timingSlots = mapTimingToSlots(m, a, n, line?.timing)

  const hasMAN = (m || a || n) > 0
  const fallbackFreq =
    freq
      ? String(freq)
      : (Number.isFinite(Number(tpd)) && Number(tpd) > 0 ? `${tpd} times/day` : '—')

  const manText = hasMAN
    ? `M ${m}${timingSlots.M ? ` (${timingSlots.M})` : ''} • A ${a}${timingSlots.A ? ` (${timingSlots.A})` : ''} • N ${n}${timingSlots.N ? ` (${timingSlots.N})` : ''}`
    : fallbackFreq

  const dur = durationText(line)

  const extras = []
  if (line?.route) extras.push(line.route)
  if (line?.timing) {
    const tks = parseTimingTokens(line.timing)
    const pretty = tks.map((x) => `${x}${TIMING_LABEL[x] ? `=${TIMING_LABEL[x]}` : ''}`).join(', ')
    extras.push(pretty)
  }
  if (note) extras.push(note)
  if (line?.instructions) extras.push(line.instructions)

  return (
    <div className="flex flex-col">
      <span className="text-slate-800">{[dose, manText, dur].filter(Boolean).join(' • ')}</span>
      {!!extras.length && <span className="text-[10px] text-slate-500">{extras.join(' • ')}</span>}
    </div>
  )
}

function LineCardMobile({ line, idx, onChangeQty, onChangeBatch, batchOptions }) {

  const med = line?.item_name || line?.medicine_name || 'Unnamed medicine'
  const strength = line?.item_strength || line?.strength || ''
  const remaining = num(line?.remaining_calc, 0)

  const options = batchOptions || []
  const batchLabel = line?.batch_no ? `${line.batch_no} • ${formatDateOnly(line.expiry_date)}` : 'Select batch'
  // ✅ Get availability from selected batch in options
  const selectedBatch = options.find(b => String(b.batch_id) === String(line?.batch_id))
  const avail = selectedBatch ? num(selectedBatch.available_qty, 0) : (options.length === 1 ? num(options[0].available_qty, 0) : num(line?.batch_available_qty, NaN))

  return (
    <div className="rounded-2xl border border-slate-500 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-500">#{idx + 1}</div>
          <div className="font-medium text-slate-900 truncate">{med}</div>
          {!!strength && <div className="text-[10px] text-slate-500">{strength}</div>}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">Remaining</div>
          <div className="text-[11px] font-semibold text-slate-800">
            {Number.isFinite(remaining) ? remaining : '—'}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-700">
        <LineInstruction line={line} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-500 bg-white px-3 py-2">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Layers className="h-3 w-3" /> Batch
          </div>

          {options.length === 1 ? (
            <div className="mt-1 h-8 bg-slate-50 border border-slate-300 rounded-full px-3 flex items-center text-[11px] text-slate-700">
              {options[0].batch_no}
            </div>
          ) : (
            <Select
              value={line?.batch_id ? String(line.batch_id) : ''}
              onValueChange={(v) => onChangeBatch(idx, v)}
            >
              <SelectTrigger className="mt-1 h-8 text-[11px] bg-white border-slate-500 rounded-full">
                <SelectValue placeholder={batchLabel} />
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 ? (
                  <SelectItem value="__none" disabled>No batches</SelectItem>
                ) : (
                  options.map((b) => (
                    <SelectItem key={b.batch_id} value={String(b.batch_id)}>
                      {b.batch_no}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          <div className="mt-1 text-[10px] text-slate-500">
            Available: <span className="font-medium text-slate-700">{Number.isFinite(avail) ? avail : '—'}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-500 bg-white px-3 py-2">
          <div className="text-[10px] text-slate-500">Dispense</div>
          <Input
            type="number"
            min="0"
            value={line?.dispense_qty ?? ''}
            onChange={(e) => onChangeQty(idx, e.target.value)}
            className="mt-1 h-8 text-[11px] text-right bg-white border-slate-500 rounded-full"
          />
        </div>
      </div>
    </div>
  )
}

export default function PharmacyDispense() {
  const [tab, setTab] = useState('queue')

  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [search, setSearch] = useState('')

  const [queueLoading, setQueueLoading] = useState(false)
  const [queue, setQueue] = useState([])

  const [rxLoading, setRxLoading] = useState(false)
  const [selectedRx, setSelectedRx] = useState(null)
  const [dispenseLines, setDispenseLines] = useState([])
  const [dispensing, setDispensing] = useState(false)

  const [locations, setLocations] = useState([])
  const [queueLocationId, setQueueLocationId] = useState(ALL_LOC)
  const [dispenseLocationId, setDispenseLocationId] = useState('')

  const [previewOpen, setPreviewOpen] = useState(false)

  // ✅ patient cache
  const patientCacheRef = useRef({})

  // ✅ batch options cache: key = `${locId}-${itemId}`
  const batchCacheRef = useRef({})

  const loadPatient = useCallback(async (patientId) => {
    const id = Number(patientId || 0)
    if (!id) return null
    if (patientCacheRef.current[id]) return patientCacheRef.current[id]

    try {
      const res = await getPatientById(id)
      const data = unwrapApiData(res)
      const p = data?.patient ?? data ?? null
      if (p) patientCacheRef.current[id] = p
      return p
    } catch (e) {
      console.error('loadPatient error', e)
      return null
    }
  }, [])

  const hydrateQueuePatients = useCallback(async (rows) => {
    try {
      const list = Array.isArray(rows) ? rows : []
      const need = list
        .filter((r) => !r?.patient && getPatientId(r))
        .map((r) => Number(getPatientId(r)))
        .filter(Boolean)

      const unique = [...new Set(need)].slice(0, 15)
      if (!unique.length) return list

      for (const pid of unique) {
        // eslint-disable-next-line no-await-in-loop
        await loadPatient(pid)
      }

      return list.map((r) => {
        if (r?.patient) return r
        const pid = Number(getPatientId(r) || 0)
        if (!pid) return r
        const p = patientCacheRef.current[pid]
        return p ? { ...r, patient: p, patient_id: pid } : r
      })
    } catch (e) {
      console.error('hydrateQueuePatients error', e)
      return rows
    }
  }, [loadPatient])

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await listInventoryLocations()
          const items = unwrapApiData(res) || []
          if (!mounted) return
          setLocations(items)
          if (!queueLocationId) setQueueLocationId(ALL_LOC)
        } catch {
          // handled by interceptor
        }
      })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const locationLabel = useCallback((val) => {
    if (!locations?.length) return 'No locations'
    if (!val || val === ALL_LOC) return 'All / Not linked'
    const id = Number(val)
    const loc = locations.find((l) => l.id === id)
    return loc?.name || loc?.code || `Location #${id}`
  }, [locations])

  const currentQueueLocationName = useMemo(() => locationLabel(queueLocationId), [queueLocationId, locationLabel])
  const currentDispenseLocationName = useMemo(() => (dispenseLocationId ? locationLabel(dispenseLocationId) : 'Not selected'), [dispenseLocationId, locationLabel])

  const fetchQueue = useCallback(async () => {
    try {
      setQueueLoading(true)
      const params = {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        limit: 100,
      }
      if (search.trim()) params.q = search.trim()
      if (queueLocationId && queueLocationId !== ALL_LOC) params.location_id = Number(queueLocationId)

      const res = await listDispenseQueue(params)
      const rows = unwrapApiData(res) || []
      const hydrated = await hydrateQueuePatients(rows)
      setQueue(hydrated || [])
    } finally {
      setQueueLoading(false)
    }
  }, [statusFilter, typeFilter, search, queueLocationId, hydrateQueuePatients])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  // ✅ load batch picks
  const fetchBatchPicks = useCallback(async (locId, itemId, forceRefresh = false) => {
    const L = Number(locId || 0)
    const I = Number(itemId || 0)
    if (!L || !I) return []

    const key = `${L}-${I}`
    if (!forceRefresh && batchCacheRef.current[key]) return batchCacheRef.current[key]

    try {
      const res = await API.get('/pharmacy/batch-picks', { params: { location_id: L, item_id: I } })
      const rows = unwrapApiData(res) || res?.data || []
      const list = Array.isArray(rows) ? rows : []
      batchCacheRef.current[key] = list
      return list
    } catch (e) {
      console.error('fetchBatchPicks error', e)
      return []
    }
  }, [])

  async function handleSelectRx(row, { openPreview = true } = {}) {
    try {
      setRxLoading(true)

      const res = await getPharmacyPrescription(row.id)
      let data = unwrapApiData(res) || row

      const pid = getPatientId(data) || getPatientId(row)
      if (!data.patient && pid) {
        const patient = await loadPatient(pid)
        if (patient) data = { ...data, patient, patient_id: pid }
      }

      setSelectedRx(data)

      if (!dispenseLocationId) {
        const rxLoc = data?.location_id
        setDispenseLocationId(rxLoc ? String(rxLoc) : '')
      }

      const rawLines = data?.lines || data?.items || []
      const lines = rawLines.map((l) => {
        const { requested, remaining } = computeRequestedAndRemaining(l)
        const estimate = suggestedQtyFromFreq(l)

        const defaultQty =
          remaining > 0 ? remaining : (requested > 0 ? requested : (estimate !== '' ? estimate : ''))

        return {
          ...l,
          id: getLineId(l) ?? l?.id,
          requested_qty: requested,
          remaining_calc: remaining,
          dispense_qty: defaultQty !== '' && Number(defaultQty) > 0 ? String(defaultQty) : '',

          // ✅ batch fields from backend
          item_id: l?.item_id ?? l?.itemId,
          batch_id: l?.batch_id ?? null,
          batch_no: l?.batch_no ?? null,
          expiry_date: l?.expiry_date ?? null,
          batch_available_qty: l?.batch_current_qty ?? null,
        }
      })

      setDispenseLines(lines)
      if (openPreview) setPreviewOpen(true)
    } catch (e) {
      console.error('Select Rx error', e)
      toast.error('Failed to open prescription')
    } finally {
      setRxLoading(false)
    }
  }

  function handleChangeDispenseQty(idx, value) {
    const v = value === '' ? '' : String(value)
    setDispenseLines((prev) => prev.map((l, i) => (i === idx ? { ...l, dispense_qty: v } : l)))
  }

  // ✅ change batch
  const handleChangeBatch = useCallback((idx, batchIdStr) => {
    const bid = batchIdStr && batchIdStr !== '__none' ? Number(batchIdStr) : null

    setDispenseLines((prev) => {
      const list = prev || []
      const line = list[idx]
      if (!line) return list

      const locId = Number(dispenseLocationId || 0)
      const itemId = Number(line.item_id || 0)
      const key = `${locId}-${itemId}`
      const options = batchCacheRef.current[key] || []
      const sel = options.find((b) => Number(b.batch_id) === Number(bid))

      return list.map((l, i) => {
        if (i !== idx) return l
        return {
          ...l,
          batch_id: bid,
          batch_no: sel?.batch_no ?? l.batch_no,
          expiry_date: sel?.expiry_date ?? l.expiry_date,
          batch_available_qty: sel?.available_qty ?? l.batch_available_qty,
        }
      })
    })
  }, [dispenseLocationId])

  function fillAllToRemaining() {
    setDispenseLines((prev) =>
      (prev || []).map((l) => {
        const rem = num(l?.remaining_calc, 0)
        const requested = num(l?.requested_qty, 0)
        const v = rem > 0 ? rem : requested
        return { ...l, dispense_qty: v > 0 ? String(v) : '' }
      })
    )
  }

  function clearAllDispenseQty() {
    setDispenseLines((prev) => (prev || []).map((l) => ({ ...l, dispense_qty: '' })))
  }

  // ✅ prefetch batches for selected Rx
  useEffect(() => {
    let alive = true
      ; (async () => {
        const locId = Number(dispenseLocationId || 0)
        if (!selectedRx || !locId) return

        const lines = dispenseLines || []
        const uniqueItems = [...new Set(lines.map((l) => Number(l.item_id || 0)).filter(Boolean))]

        for (const itemId of uniqueItems) {
          // eslint-disable-next-line no-await-in-loop
          await fetchBatchPicks(locId, itemId)
          if (!alive) return
        }

        // Auto-select single batches
        setDispenseLines((prev) => {
          return (prev || []).map((line) => {
            if (line.batch_no) return line // Already has batch selected
            
            const itemId = Number(line.item_id || 0)
            if (!itemId) return line
            
            const key = `${locId}-${itemId}`
            const options = batchCacheRef.current[key] || []
            
            if (options.length === 1) {
              const batch = options[0]
              return {
                ...line,
                batch_id: batch.batch_id,
                batch_no: batch.batch_no,
                expiry_date: batch.expiry_date,
                batch_available_qty: batch.available_qty,
              }
            }
            
            return line
          })
        })
      })()

    return () => { alive = false }
  }, [selectedRx, dispenseLocationId, fetchBatchPicks, dispenseLines])

  async function handleDispense() {
    if (!selectedRx) return

    const effectiveLocationId = dispenseLocationId ? Number(dispenseLocationId) : null
    if (!effectiveLocationId) {
      toast.error('Select Dispense Location before confirming.')
      return
    }

    const validLines = (dispenseLines || []).filter((l) => num(l?.dispense_qty || 0, 0) > 0)
    if (!validLines.length) {
      toast.error('Enter quantity to dispense for at least one line')
      return
    }

    const bad = validLines.find((l) => !getLineId(l))
    if (bad) {
      toast.error('Some lines are missing line_id (cannot dispense). Refresh Rx and try again.')
      console.error('Bad line (missing id):', bad)
      return
    }

    // ✅ refresh batch data and validate
    try {
      setDispensing(true)
      
      for (const line of validLines) {
        const batchNo = line?.batch_no
        if (!batchNo) {
          toast.error(`Select batch for: ${line.item_name || line.medicine_name || 'a medicine'}`)
          return
        }
        
        const itemId = Number(line.item_id || 0)
        // Refresh batch data
        const freshBatches = await fetchBatchPicks(effectiveLocationId, itemId, true)
        const batchExists = freshBatches.find(b => b.batch_no === batchNo)
        
        if (!batchExists) {
          toast.error(`Batch no longer available for ${line.item_name || line.medicine_name}. Please select a different batch.`)
          return
        }
      }

      const payload = {
        lines: validLines.map((l) => ({
          line_id: Number(getLineId(l)),
          dispense_qty: num(l?.dispense_qty || 0, 0),
          batch_id: l?.batch_no || null, // Send batch_no instead of batch_id
        })),
        location_id: effectiveLocationId,
        create_sale: true,
        context_type: safeUpper(getRxType(selectedRx)),
      }

      await dispensePharmacyPrescription(selectedRx.id, payload)
      toast.success('Dispense recorded')

      await fetchQueue()
      setPreviewOpen(false)
      setSelectedRx(null)
      setDispenseLines([])
      setTab('queue')
    } catch (e) {
      console.error('Dispense error', e)
      const detail = e?.response?.data?.detail
      if (typeof detail === 'string') toast.error(detail)
      else if (detail?.message) toast.error(detail.message)
      else toast.error('Dispense failed')
    } finally {
      setDispensing(false)
    }
  }

  const selectedLines = useMemo(() => dispenseLines || [], [dispenseLines])

  // ✅ batch options per line
  const batchOptionsForLine = useCallback((line) => {
    const locId = Number(dispenseLocationId || 0)
    const itemId = Number(line?.item_id || 0)
    if (!locId || !itemId) return []
    const key = `${locId}-${itemId}`
    return batchCacheRef.current[key] || []
  }, [dispenseLocationId])

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="rounded-3xl border border-slate-500 bg-white shadow-sm p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-white border border-slate-500 shadow-sm flex items-center justify-center">
                <Pill className="h-4 w-4 text-slate-700" />
              </div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                Pharmacy Dispense
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Queue → Preview → Dispense (Batch + Expiry + Available Qty).
            </p>
          </div>

          {/* Locations */}
          <div className="grid gap-2 md:grid-cols-2 md:items-end">
            <div className="rounded-2xl border border-slate-500 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-[11px] text-slate-500">Queue location</div>
                    <div className="text-[11px] font-medium text-slate-800">{currentQueueLocationName}</div>
                  </div>
                </div>

                <Select value={queueLocationId} onValueChange={(v) => setQueueLocationId(v || ALL_LOC)}>
                  <SelectTrigger className="w-[190px] bg-white border-slate-500 rounded-full h-8 text-[11px]">
                    <SelectValue placeholder="Queue location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_LOC}>All / Not linked</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name || loc.code || `Location #${loc.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-500 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-[11px] text-slate-500">Dispense location</div>
                    <div className="text-[11px] font-medium text-slate-800">{currentDispenseLocationName}</div>
                  </div>
                </div>

                <Select value={dispenseLocationId || ''} onValueChange={(v) => setDispenseLocationId(v || '')}>
                  <SelectTrigger className="w-[190px] bg-white border-slate-500 rounded-full h-8 text-[11px]">
                    <SelectValue placeholder="Select dispense location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name || loc.code || `Location #${loc.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-full border-slate-500" onClick={fetchQueue}>
                <RefreshCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-full bg-white border border-slate-500 p-1">
          <TabsTrigger value="queue" className="rounded-full">Dispense Queue</TabsTrigger>
          <TabsTrigger value="dispense" disabled={!selectedRx} className="rounded-full">Dispense</TabsTrigger>
        </TabsList>

        {/* QUEUE TAB */}
        <TabsContent value="queue" className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.75fr)]">
            {/* Queue */}
            <Card className="border-slate-500 rounded-3xl shadow-sm overflow-hidden bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-slate-500" />
                      Prescriptions
                      <Badge variant="outline" className="rounded-full text-[10px] border-slate-500">
                        {queueLoading ? '...' : queue.length}
                      </Badge>
                    </CardTitle>
                    <div className="text-[11px] text-slate-500">
                      Filtered by: <span className="font-medium text-slate-700">{currentQueueLocationName}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-slate-500"
                    onClick={fetchQueue}
                    title="Refresh"
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') fetchQueue() }}
                        placeholder="Search UHID / patient / Rx no..."
                        className="pl-9 h-9 text-xs bg-white border-slate-500 rounded-full"
                      />
                    </div>
                    <Button variant="outline" className="h-9 rounded-full text-xs border-slate-500" onClick={fetchQueue}>
                      Search
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[140px] bg-white border-slate-500 rounded-full h-8 text-[11px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RX_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[160px] bg-white border-slate-500 rounded-full h-8 text-[11px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending only</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                        <SelectItem value="DISPENSED">Dispensed</SelectItem>
                        <SelectItem value="ALL">All status</SelectItem>
                      </SelectContent>
                    </Select>

                    <Badge variant="outline" className="border-slate-500 text-[10px] px-2 py-1 rounded-full">
                      Dispense at: <span className="ml-1 text-slate-700 font-medium">{currentDispenseLocationName}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="border border-slate-500 rounded-2xl overflow-hidden bg-white">
                  <ScrollArea className="max-h-[520px]">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/80 sticky top-0 z-10">
                        <tr className="text-[11px] text-slate-500">
                          <th className="text-left px-3 py-2 font-medium">Rx</th>
                          <th className="text-left px-3 py-2 font-medium">Patient</th>
                          <th className="text-left px-3 py-2 font-medium">Type / Doctor</th>
                          <th className="text-left px-3 py-2 font-medium">Items</th>
                          <th className="text-left px-3 py-2 font-medium">Time</th>
                          <th className="text-right px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {queueLoading && (
                          <>
                            <tr><td colSpan={6} className="px-3 py-3"><Skeleton className="h-10 w-full rounded-xl" /></td></tr>
                            <tr><td colSpan={6} className="px-3 py-3"><Skeleton className="h-10 w-full rounded-xl" /></td></tr>
                          </>
                        )}

                        {!queueLoading && !queue.length && (
                          <tr>
                            <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-slate-500">
                              No prescriptions found.
                            </td>
                          </tr>
                        )}

                        {!queueLoading && queue.map((row) => {
                          const status = safeUpper(row.status || 'PENDING')
                          const createdAt = row.created_at || row.rx_datetime || row.bill_date || null
                          const createdStr = formatDateTime(createdAt)

                          const patientName = getPatientName(row)
                          const patientUhid = getPatientUhid(row)
                          const doctorName = getDoctorName(row)

                          const itemsCount = row.items?.length || row.lines?.length || row.item_count || '—'

                          return (
                            <tr
                              key={row.id}
                              className="border-t border-slate-500 hover:bg-slate-50 cursor-pointer"
                              onClick={() => handleSelectRx(row, { openPreview: true })}
                            >
                              <td className="px-3 py-2 align-middle">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium text-slate-900">{getRxNo(row)}</span>
                                  {!!patientUhid && <span className="text-[10px] text-slate-500">UHID: {patientUhid}</span>}
                                </div>
                              </td>

                              <td className="px-3 py-2 align-middle">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-2xl bg-white border border-slate-500 flex items-center justify-center">
                                    <User className="w-4 h-4 text-slate-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[11px] text-slate-900 truncate">{patientName}</div>
                                    {!!patientUhid && <div className="text-[10px] text-slate-500 truncate">{patientUhid}</div>}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-2 align-middle">
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="border-slate-500 text-[10px] px-2 py-0.5 rounded-full w-max">
                                    {getRxType(row)}
                                  </Badge>
                                  {!!doctorName && (
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                      <Stethoscope className="w-3 h-3" />
                                      {doctorName}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-3 py-2 align-middle text-[11px] text-slate-700">{itemsCount}</td>

                              <td className="px-3 py-2 align-middle text-[11px] text-slate-700">
                                <div className="flex items-center gap-1">
                                  <Clock3 className="w-3 h-3 text-slate-400" />
                                  <span>{createdStr}</span>
                                </div>
                              </td>

                              <td className="px-3 py-2 align-middle text-right">
                                <StatusPillSmall status={status} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            {/* Selected Rx panel */}
            <Card className="border-slate-500 rounded-3xl shadow-sm overflow-hidden bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Pill className="w-4 h-4 text-slate-500" />
                  Selected Prescription
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {!selectedRx ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    Select a prescription from the queue to preview.
                  </div>
                ) : rxLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="rounded-2xl border border-slate-500 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{getPatientName(selectedRx)}</div>
                          <div className="text-[11px] text-slate-500">
                            UHID: {getPatientUhid(selectedRx) || '—'}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-slate-500 shrink-0">
                          <div>Rx: {getRxNo(selectedRx)}</div>
                          <div>Type: {getRxType(selectedRx)}</div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-[11px] text-slate-500">
                          Items:{' '}
                          <span className="font-medium text-slate-700">
                            {(selectedRx.lines || selectedRx.items || []).length || 0}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Doctor:{' '}
                          <span className="font-medium text-slate-700">
                            {getDoctorName(selectedRx) || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" className="h-9 rounded-full gap-1" onClick={() => setPreviewOpen(true)}>
                        <ArrowRight className="h-4 w-4" />
                        Preview
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-full gap-1 border-slate-500"
                        onClick={() => selectedRx?.id && openPharmacyPrescriptionPdfInNewTab(selectedRx.id)}
                      >
                        <FileText className="h-4 w-4" />
                        Rx PDF
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-full border-slate-500"
                        onClick={() => {
                          setTab('dispense')
                          setPreviewOpen(false)
                        }}
                      >
                        Open Dispense
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 rounded-full"
                        onClick={() => {
                          setSelectedRx(null)
                          setDispenseLines([])
                          setPreviewOpen(false)
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Dialog */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="sm:max-w-5xl w-[calc(100vw-22px)] rounded-3xl bg-white border-slate-500 max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-2xl bg-white border border-slate-500 shadow-sm flex items-center justify-center">
                      <Pill className="h-4 w-4 text-slate-700" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Prescription Preview</div>
                      <div className="text-[11px] text-slate-500">
                        {selectedRx ? `${getRxNo(selectedRx)} • ${getRxType(selectedRx)}` : ''}
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setPreviewOpen(false)} title="Close">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>

              {!selectedRx ? (
                <div className="py-10 text-center text-sm text-slate-500">No prescription selected.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-500 bg-white p-3">
                      <div className="text-[11px] text-slate-500">Patient</div>
                      <div className="mt-1 font-semibold text-slate-900">{getPatientName(selectedRx)}</div>
                      <div className="text-[11px] text-slate-500">UHID: {getPatientUhid(selectedRx) || '—'}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-500 bg-white p-3">
                      <div className="text-[11px] text-slate-500">Doctor</div>
                      <div className="mt-1 font-semibold text-slate-900">{getDoctorName(selectedRx) || '—'}</div>
                      <div className="text-[11px] text-slate-500">
                        Created: {formatDateTime(selectedRx.created_at || selectedRx.rx_datetime)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-500 bg-white p-3">
                      <div className="text-[11px] text-slate-500">Dispense location</div>
                      <div className="mt-1 font-semibold text-slate-900">{currentDispenseLocationName}</div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-500 bg-white overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <span>Medicines</span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-8 rounded-full border-slate-500 text-xs" onClick={fillAllToRemaining}>
                          <Wand2 className="h-4 w-4 mr-1" />
                          Fill remaining
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-full border-slate-500 text-xs" onClick={clearAllDispenseQty}>
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 space-y-2 md:hidden">
                      {selectedLines.length === 0 ? (
                        <div className="py-6 text-center text-slate-500 text-sm">No lines found.</div>
                      ) : (
                        selectedLines.map((l, idx) => (
                          <LineCardMobile
                            key={getLineId(l) || idx}
                            line={l}
                            idx={idx}
                            onChangeQty={handleChangeDispenseQty}
                            onChangeBatch={handleChangeBatch}
                            batchOptions={batchOptionsForLine(l)}
                          />
                        ))
                      )}
                    </div>

                    <div className="hidden md:block max-h-[460px] overflow-auto">
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr className="text-slate-500">
                            <th className="text-left px-3 py-2 font-medium">#</th>
                            <th className="text-left px-3 py-2 font-medium">Medicine</th>
                            <th className="text-left px-3 py-2 font-medium">Instructions</th>
                            <th className="text-left px-3 py-2 font-medium">Batch</th>
                            <th className="text-left px-3 py-2 font-medium">Expiry</th>
                            <th className="text-left px-3 py-2 font-medium">Available</th>
                            <th className="text-right px-3 py-2 font-medium">Dispense</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLines.length === 0 ? (
                            <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No lines found.</td></tr>
                          ) : (
                            selectedLines.map((l, idx) => {
                              const opts = batchOptionsForLine(l)
                              // ✅ Get availability from selected batch in options
                              const selectedBatch = opts.find(b => String(b.batch_id) === String(l.batch_id))
                              const avail = selectedBatch ? num(selectedBatch.available_qty, 0) : (opts.length === 1 ? num(opts[0].available_qty, 0) : num(l.batch_available_qty, NaN))

                              return (
                                <tr key={getLineId(l) || idx} className="border-t border-slate-500">
                                  <td className="px-3 py-2 align-top text-slate-500">{idx + 1}</td>

                                  <td className="px-3 py-2 align-top">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-slate-900">{l.item_name || l.medicine_name || 'Unnamed medicine'}</span>
                                      {(l.item_strength || l.strength) && <span className="text-[10px] text-slate-500">{l.item_strength || l.strength}</span>}
                                    </div>
                                  </td>

                                  <td className="px-3 py-2 align-top text-slate-700"><LineInstruction line={l} /></td>

                                  <td className="px-3 py-2 align-top">
                                    {opts.length === 1 ? (
                                      <div className="h-8 w-[120px] bg-slate-50 border border-slate-300 rounded-full px-3 flex items-center text-[11px] text-slate-700">
                                        {opts[0].batch_no}
                                      </div>
                                    ) : (
                                      <Select
                                        value={l?.batch_id ? String(l.batch_id) : ''}
                                        onValueChange={(v) => handleChangeBatch(idx, v)}
                                      >
                                        <SelectTrigger className="h-8 w-[120px] bg-white border-slate-500 rounded-full text-[11px]">
                                          <SelectValue placeholder={l?.batch_no ? l.batch_no : 'Select batch'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {opts.length === 0 ? (
                                            <SelectItem value="__none" disabled>No batches</SelectItem>
                                          ) : (
                                            opts.map((b) => (
                                              <SelectItem key={b.batch_id} value={String(b.batch_id)}>
                                                {b.batch_no}
                                              </SelectItem>
                                            ))
                                          )}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </td>

                                  <td className="px-3 py-2 align-top text-slate-700">
                                    {formatDateOnly(l.expiry_date)}
                                  </td>

                                  <td className="px-3 py-2 align-top text-slate-700">
                                    {Number.isFinite(avail) ? avail : '—'}
                                  </td>

                                  <td className="px-3 py-2 align-top text-right">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={l.dispense_qty ?? ''}
                                      onChange={(e) => handleChangeDispenseQty(idx, e.target.value)}
                                      className="h-8 w-24 ml-auto text-[11px] text-right bg-white border-slate-500 rounded-full"
                                    />
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" className="h-9 rounded-full border-slate-500" onClick={() => openPharmacyPrescriptionPdfInNewTab(selectedRx.id)}>
                      <FileText className="h-4 w-4 mr-1" />
                      Rx PDF
                    </Button>
                    <Button className="h-9 rounded-full" onClick={() => { setTab('dispense'); setPreviewOpen(false) }}>
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Go to Dispense
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* DISPENSE TAB */}
        <TabsContent value="dispense">
          {!selectedRx ? (
            <Card className="border-slate-500 rounded-3xl shadow-sm bg-white">
              <CardContent className="py-10 text-center text-sm text-slate-500">
                Select a prescription from the queue first.
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-500 rounded-3xl shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Dispense Medicines
                  </CardTitle>

                  <div className="text-[11px] text-slate-500">
                    Rx: <span className="font-medium text-slate-700">{getRxNo(selectedRx)}</span> •
                    Type: <span className="font-medium text-slate-700">{getRxType(selectedRx)}</span> •
                    Patient: <span className="font-medium text-slate-700">{getPatientName(selectedRx)}</span>
                    <br />
                    Queue filter: <span className="font-medium text-slate-700">{currentQueueLocationName}</span> •
                    Dispense at: <span className="font-medium text-slate-700">{currentDispenseLocationName}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9 px-4 rounded-full border-slate-500" onClick={() => openPharmacyPrescriptionPdfInNewTab(selectedRx.id)}>
                    <FileText className="w-4 h-4 mr-1" />
                    Rx PDF
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 px-4 rounded-full border-slate-500" onClick={fillAllToRemaining}>
                    <Wand2 className="w-4 h-4 mr-1" />
                    Fill remaining
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 px-4 rounded-full border-slate-500" onClick={clearAllDispenseQty}>
                    Clear
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full" onClick={() => setTab('queue')}>
                    Back
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* mobile cards already appear in Preview dialog; in dispense tab we keep desktop table visible */}
                <div className="text-[11px] text-slate-500">
                  Tip: Make sure every line has a <span className="font-medium text-slate-700">Batch</span> selected.
                </div>

                <div className="sticky bottom-0 bg-white border border-slate-500 rounded-2xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    Dispense at:{' '}
                    <span className="font-medium text-slate-700">{currentDispenseLocationName}</span>
                    {!dispenseLocationId ? <span className="ml-2 text-amber-700">• Select location to continue</span> : null}
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button size="sm" variant="outline" className="h-9 rounded-full border-slate-500" onClick={() => setPreviewOpen(true)}>
                      Preview
                    </Button>

                    <Button size="sm" className="h-9 rounded-full px-4" onClick={handleDispense} disabled={dispensing}>
                      {dispensing ? 'Dispensing...' : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Confirm Dispense
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
