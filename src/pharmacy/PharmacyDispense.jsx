// FILE: src/pages/PharmacyDispense.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'

import {
  listDispenseQueue,
  getPharmacyPrescription,
  dispensePharmacyPrescription,
} from '../api/pharmacyRx'
import { openPharmacyBillPdfInNewTab } from '../api/pharmacyBilling'
import { listInventoryLocations } from '../api/inventory'

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
} from 'lucide-react'

const RX_TYPES = [
  { value: 'ALL', label: 'All types' },
  { value: 'OPD', label: 'OPD' },
  { value: 'IPD', label: 'IPD' },
  { value: 'OT', label: 'OT' },
  { value: 'COUNTER', label: 'Counter' },
]

// special value for "All / Not linked" location
const ALL_LOCATION_VALUE = 'ALL_LOC'

function safeUpper(x) {
  return String(x || '').toUpperCase()
}

function formatDateTime(x) {
  if (!x) return '—'
  const s = String(x)
  // handles ISO: 2025-12-13T10:22:00
  if (s.includes('T')) return s.slice(0, 16).replace('T', ' ')
  return s.length > 16 ? s.slice(0, 16) : s
}

// ---- helper: compute suggested / remaining qty from line ----
function computeRemainingQty(l) {
  const requested = Number(l.requested_qty ?? l.total_qty ?? l.qty ?? l.quantity ?? 0)
  const alreadyDispensed = Number(l.dispensed_qty ?? 0)
  const remaining = Math.max(requested - alreadyDispensed, 0)
  return { requested, remaining }
}

// ---- helper: back-calculate total qty from frequency x days if needed ----
function suggestedQtyFromFreq(l) {
  const d = Number(l.duration_days || 0)
  const freqRaw = (l.frequency_code || l.frequency || '').trim()
  if (!d || !freqRaw) return ''

  // support "1-0-1" etc.
  const parts = freqRaw.split('-').map((x) => Number(x || 0))
  const perDay = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  if (!perDay) return ''
  return perDay * d
}

export default function PharmacyDispense() {
  const [tab, setTab] = useState('queue')

  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [queueLoading, setQueueLoading] = useState(false)
  const [queue, setQueue] = useState([])

  const [selectedRx, setSelectedRx] = useState(null)
  const [dispenseLines, setDispenseLines] = useState([])
  const [dispensing, setDispensing] = useState(false)

  // ------ Pharmacy locations ------
  const [locations, setLocations] = useState([])
  // store as string id or ALL_LOCATION_VALUE
  const [selectedLocationId, setSelectedLocationId] = useState(ALL_LOCATION_VALUE)

  // Load pharmacy locations once
  useEffect(() => {
    let mounted = true
    async function fetchLocations() {
      try {
        const res = await listInventoryLocations()
        const items = res?.data || []
        if (!mounted) return
        setLocations(items)
        if (!selectedLocationId) setSelectedLocationId(ALL_LOCATION_VALUE)
      } catch (e) {
        // handled globally by axios interceptor
      }
    }
    fetchLocations()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchQueue = useCallback(async () => {
    try {
      setQueueLoading(true)

      const params = {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        limit: 100,
      }

      if (search.trim()) params.q = search.trim()

      // IMPORTANT:
      // If "All / Not linked" is selected, DO NOT send location_id.
      // Backend returns all prescriptions including ones with location_id = NULL.
      if (selectedLocationId && selectedLocationId !== ALL_LOCATION_VALUE) {
        params.location_id = Number(selectedLocationId)
      }

      const res = await listDispenseQueue(params)
      setQueue(res?.data || [])
    } catch (e) {
      // handled globally
    } finally {
      setQueueLoading(false)
    }
  }, [statusFilter, typeFilter, search, selectedLocationId])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  async function handleSelectRx(row) {
    try {
      const res = await getPharmacyPrescription(row.id)
      const data = res?.data || row
      setSelectedRx(data)

      const lines = (data.lines || data.items || []).map((l) => {
        const { requested, remaining } = computeRemainingQty(l)
        const suggested = remaining || suggestedQtyFromFreq(l) || requested || 0
        return {
          ...l,
          requested_qty: requested,
          remaining_qty: suggested,
          // default dispense qty = remaining
          dispense_qty: suggested ? String(suggested) : '',
        }
      })

      setDispenseLines(lines)
      setTab('dispense')
    } catch (e) {
      // handled globally
    }
  }

  function handleChangeDispenseQty(idx, value) {
    // allow empty, avoid NaN jumping
    const v = value === '' ? '' : String(value)
    setDispenseLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, dispense_qty: v } : l))
    )
  }

  function fillAllToRemaining() {
    setDispenseLines((prev) =>
      (prev || []).map((l) => {
        const rem = Number(l.remaining_qty ?? 0)
        const fallback = Number(l.requested_qty ?? 0)
        const v = rem || fallback || 0
        return { ...l, dispense_qty: v ? String(v) : '' }
      })
    )
  }

  function clearAllDispenseQty() {
    setDispenseLines((prev) => (prev || []).map((l) => ({ ...l, dispense_qty: '' })))
  }

  async function handleDispense() {
    if (!selectedRx) return

    const validLines = (dispenseLines || []).filter((l) => Number(l.dispense_qty || 0) > 0)
    if (!validLines.length) {
      toast.error('Enter quantity to dispense for at least one line')
      return
    }

    // Determine effective location:
    // - If dropdown has a concrete location, use that
    // - Else fall back to Rx.location_id (if set)
    let effectiveLocationId = selectedRx.location_id || null
    if (selectedLocationId && selectedLocationId !== ALL_LOCATION_VALUE) {
      effectiveLocationId = Number(selectedLocationId)
    }

    if (!effectiveLocationId) {
      toast.error('Select a pharmacy location before dispensing.')
      return
    }

    const payload = {
      lines: validLines.map((l) => ({
        line_id: l.id, // backend should accept this
        dispense_qty: Number(l.dispense_qty || 0),
      })),
      location_id: effectiveLocationId,
      create_sale: true,
      context_type: safeUpper(selectedRx.type || selectedRx.rx_type || 'OPD'),
    }

    try {
      setDispensing(true)
      const res = await dispensePharmacyPrescription(selectedRx.id, payload)
      const data = res?.data || {}

      const saleId =
        data.sale_id || data.sale?.id || data.pharmacy_sale?.id || data.saleId || null

      toast.success(saleId ? 'Medicines dispensed and bill created' : 'Dispense recorded')

      // open PDF if saleId returned
      if (saleId) {
        try {
          openPharmacyBillPdfInNewTab(saleId)
        } catch (e) {
          // even if pdf fails, dispense is ok
        }
      }

      await fetchQueue()
      setSelectedRx(null)
      setDispenseLines([])
      setTab('queue')
    } catch (e) {
      // interceptor shows toast; keep console for dev
      // eslint-disable-next-line no-console
      console.error('Dispense error', e)
    } finally {
      setDispensing(false)
    }
  }

  const selectedLines = useMemo(() => dispenseLines || [], [dispenseLines])

  const currentLocationName = useMemo(() => {
    if (!locations?.length) return 'No locations configured'
    if (!selectedLocationId || selectedLocationId === ALL_LOCATION_VALUE) return 'All / Not linked'
    const locId = Number(selectedLocationId)
    const loc = locations.find((l) => l.id === locId)
    if (!loc) return `Location #${locId}`
    return loc.name || loc.code || `Location #${loc.id}`
  }, [locations, selectedLocationId])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md: להבין md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Pharmacy Dispense</h1>
          <p className="text-sm text-slate-500">
            Convert prescriptions to pharmacy sales with FEFO-linked inventory and billing.
          </p>
        </div>

        {/* Location selector */}
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-4 h-4 text-slate-500" />
          <span className="text-slate-500">Location</span>
          <Select
            value={selectedLocationId}
            onValueChange={(val) => setSelectedLocationId(val || ALL_LOCATION_VALUE)}
          >
            <SelectTrigger className="w-[220px] bg-white border-slate-200 rounded-full h-8 text-[11px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {/* SAFE: value is non-empty, fixes the Radix Select empty value error */}
              <SelectItem value={ALL_LOCATION_VALUE}>All / Not linked</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={String(loc.id)}>
                  {loc.name || loc.code || `Location #${loc.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-slate-200"
            onClick={fetchQueue}
            title="Refresh queue"
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="queue">Dispense Queue</TabsTrigger>
          <TabsTrigger value="dispense" disabled={!selectedRx}>
            Selected Rx
          </TabsTrigger>
        </TabsList>

        {/* QUEUE TAB */}
        <TabsContent value="queue" className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)]">
            <Card className="border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-slate-500" />
                      Prescriptions
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-slate-200"
                      onClick={fetchQueue}
                      title="Filters / Refresh"
                    >
                      <Filter className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') fetchQueue()
                          }}
                          placeholder="Search UHID / patient / Rx no..."
                          className="pl-8 h-9 text-xs bg-white border-slate-200 rounded-full"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="h-9 rounded-full text-xs border-slate-200"
                        onClick={fetchQueue}
                      >
                        Search
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-full h-8 text-[11px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {RX_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-full h-8 text-[11px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending only</SelectItem>
                          <SelectItem value="PARTIAL">Partial</SelectItem>
                          <SelectItem value="DISPENSED">Dispensed</SelectItem>
                          <SelectItem value="ALL">All status</SelectItem>
                        </SelectContent>
                      </Select>

                      <Badge variant="outline" className="border-slate-200 text-[10px] px-2 py-1 rounded-full">
                        Queue: <span className="ml-1 text-slate-700 font-medium">{currentLocationName}</span>
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                  <ScrollArea className="max-h-[460px]">
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
                          <tr>
                            <td colSpan={6} className="px-3 py-5 text-center text-[11px] text-slate-500">
                              Loading queue...
                            </td>
                          </tr>
                        )}

                        {!queueLoading && !queue.length && (
                          <tr>
                            <td colSpan={6} className="px-3 py-5 text-center text-[11px] text-slate-500">
                              No prescriptions found.
                            </td>
                          </tr>
                        )}

                        {!queueLoading &&
                          queue.map((row) => {
                            const type = row.type || row.rx_type || 'OPD'
                            const status = safeUpper(row.status || 'PENDING')
                            const createdAt = row.created_at || row.rx_datetime || row.bill_date || null
                            const createdStr = formatDateTime(createdAt)

                            const patientName =
                              row.patient_name ||
                              row.patient_full_name ||
                              row.patient_display ||
                              (row.patient
                                ? `${row.patient.first_name || ''} ${row.patient.last_name || ''}`.trim()
                                : '') ||
                              row.patient ||
                              '—'

                            const patientUhid = row.patient_uhid || row.uhid || row.patient?.uhid || ''

                            const doctorName = row.doctor_name || row.doctor || row.doctor_display || ''

                            const itemsCount = row.items?.length || row.lines?.length || row.item_count || '—'

                            return (
                              <tr
                                key={row.id}
                                className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer"
                                onClick={() => handleSelectRx(row)}
                              >
                                <td className="px-3 py-2 align-middle">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-medium text-slate-900">
                                      {row.rx_number || row.prescription_number || `RX-${row.id}`}
                                    </span>
                                    {patientUhid && (
                                      <span className="text-[10px] text-slate-500">UHID: {patientUhid}</span>
                                    )}
                                  </div>
                                </td>

                                <td className="px-3 py-2 align-middle">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] text-slate-700">
                                      <User className="w-3 h-3" />
                                    </div>
                                    <div>
                                      <div className="text-[11px] text-slate-900">{patientName}</div>
                                      {patientUhid && <div className="text-[10px] text-slate-500">{patientUhid}</div>}
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-2 align-middle">
                                  <div className="flex flex-col gap-1">
                                    <Badge
                                      variant="outline"
                                      className="border-slate-200 text-[10px] px-1.5 py-0.5 w-max"
                                    >
                                      {type}
                                    </Badge>
                                    {doctorName && (
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

            {/* Side panel short detail of selected Rx */}
            <Card className="border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Pill className="w-4 h-4 text-slate-500" />
                  Selected Prescription
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {!selectedRx ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Click a prescription from the queue to start dispensing.
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {(() => {
                      const patientName =
                        selectedRx.patient_name ||
                        selectedRx.patient_full_name ||
                        selectedRx.patient_display ||
                        (selectedRx.patient
                          ? `${selectedRx.patient.first_name || ''} ${selectedRx.patient.last_name || ''}`.trim()
                          : '') ||
                        '—'
                      const patientUhid =
                        selectedRx.patient_uhid || selectedRx.uhid || selectedRx.patient?.uhid || '—'

                      const rxNo =
                        selectedRx.rx_number || selectedRx.prescription_number || `RX-${selectedRx.id}`

                      const itemsLen = (selectedRx.lines || selectedRx.items || []).length || 0

                      return (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium text-slate-900">{patientName}</div>
                              <div className="text-[11px] text-slate-500">UHID: {patientUhid}</div>
                            </div>
                            <div className="text-right text-[11px] text-slate-500">
                              Rx No: {rxNo}
                              <br />
                              Type: {selectedRx.type || selectedRx.rx_type || 'OPD'}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500">Items: {itemsLen}</div>

                          <div className="text-[11px] text-slate-500">
                            Queue filter:{' '}
                            <span className="font-medium text-slate-700">{currentLocationName}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 rounded-full text-[11px]"
                              onClick={() => setTab('dispense')}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Open for dispensing
                            </Button>

                            {selectedRx.sale_id ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 rounded-full text-[11px]"
                                onClick={() => openPharmacyBillPdfInNewTab(selectedRx.sale_id)}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                View bill
                              </Button>
                            ) : null}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DISPENSE TAB */}
        <TabsContent value="dispense">
          {!selectedRx ? (
            <Card className="border-slate-200 rounded-2xl shadow-sm">
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Select a prescription from the queue to dispense.
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Dispense Medicines
                  </CardTitle>

                  <div className="text-[11px] text-slate-500">
                    Rx:{' '}
                    {selectedRx.rx_number ||
                      selectedRx.prescription_number ||
                      `RX-${selectedRx.id}`}{' '}
                    • {selectedRx.type || selectedRx.rx_type || 'OPD'} •{' '}
                    {selectedRx.patient_name ||
                      selectedRx.patient_full_name ||
                      selectedRx.patient_display ||
                      (selectedRx.patient
                        ? `${selectedRx.patient.first_name || ''} ${selectedRx.patient.last_name || ''}`.trim()
                        : '') ||
                      '—'}
                    <br />
                    Queue filter:{' '}
                    <span className="font-medium text-slate-700">{currentLocationName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-full text-[11px]"
                    onClick={fillAllToRemaining}
                  >
                    Fill remaining
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-full text-[11px]"
                    onClick={clearAllDispenseQty}
                  >
                    Clear
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-[11px]" onClick={() => setTab('queue')}>
                    Back to queue
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                  <ScrollArea className="max-h-[420px]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50/80 sticky top-0 z-10">
                        <tr className="text-[11px] text-slate-500">
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">Medicine</th>
                          <th className="text-left px-3 py-2 font-medium">Instructions</th>
                          <th className="text-left px-3 py-2 font-medium">Prescribed</th>
                          <th className="text-left px-3 py-2 font-medium">Remaining</th>
                          <th className="text-right px-3 py-2 font-medium">Dispense</th>
                        </tr>
                      </thead>

                      <tbody>
                        {!selectedLines.length && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 text-center text-[11px] text-slate-500">
                              No lines found in this prescription.
                            </td>
                          </tr>
                        )}

                        {selectedLines.map((l, idx) => {
                          const dose = l.dose_text || l.dose || ''
                          const freq =
                            l.frequency_code ||
                            l.frequency ||
                            (Number.isFinite(l.times_per_day) ? `${l.times_per_day} times/day` : '')
                          const duration = l.duration_days ? `${l.duration_days} days` : l.duration || ''
                          const primaryInstr = [dose, freq, duration].filter(Boolean).join(' • ') || '—'

                          const secondaryInstr = [l.route, l.timing, l.instructions]
                            .filter(Boolean)
                            .join(' • ')

                          const prescribedQty =
                            l.requested_qty ??
                            l.total_qty ??
                            l.qty ??
                            l.quantity ??
                            suggestedQtyFromFreq(l) ??
                            '—'

                          const remainingQty = Number(l.remaining_qty ?? 0)

                          return (
                            <tr key={l.id || idx} className="border-t border-slate-100">
                              <td className="px-3 py-2 align-top text-slate-500">{idx + 1}</td>

                              <td className="px-3 py-2 align-top">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium text-slate-900">
                                    {l.item_name || l.medicine_name || 'Unnamed medicine'}
                                  </span>
                                  {(l.item_strength || l.strength) && (
                                    <span className="text-[10px] text-slate-500">
                                      {l.item_strength || l.strength}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                <div className="flex flex-col">
                                  <span>{primaryInstr}</span>
                                  {secondaryInstr && (
                                    <span className="text-[10px] text-slate-500">{secondaryInstr}</span>
                                  )}
                                </div>
                              </td>

                              <td className="px-3 py-2 align-top text-[11px] text-slate-700">{prescribedQty}</td>

                              <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                {Number.isFinite(remainingQty) ? remainingQty : '—'}
                              </td>

                              <td className="px-3 py-2 align-top text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  value={l.dispense_qty ?? ''}
                                  onChange={(e) => handleChangeDispenseQty(idx, e.target.value)}
                                  className="h-8 w-24 ml-auto text-[11px] text-right bg-white border-slate-200 rounded-full"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pt-1">
                  <div className="text-[11px] text-slate-500">
                    Only lines with a positive “Dispense” quantity will be processed.
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 rounded-full"
                      onClick={() => {
                        const rxSaleId = selectedRx?.sale_id
                        if (!rxSaleId) return toast.error('No bill found for this Rx yet.')
                        openPharmacyBillPdfInNewTab(rxSaleId)
                      }}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      View bill
                    </Button>

                    <Button
                      size="sm"
                      className="h-9 px-4 rounded-full"
                      onClick={handleDispense}
                      disabled={dispensing}
                    >
                      {dispensing ? (
                        'Dispensing...'
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Confirm Dispense &amp; Generate Bill
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

function StatusPillSmall({ status }) {
  const s = safeUpper(status)
  let label = s || '—'
  let cls = 'bg-slate-50 text-slate-700 border border-slate-200'

  if (s === 'PENDING' || s === 'NEW' || s === 'DRAFT') {
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
