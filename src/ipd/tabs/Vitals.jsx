// FILE: src/ipd/tabs/Vitals.jsx
import { useEffect, useMemo, useState } from 'react'
import { listVitals, createVital } from '../../api/ipd'
import { useCan } from '../../hooks/useCan'
import { formatIST } from '../components/timeZONE'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Activity,
  Droplets,
  HeartPulse,
  RefreshCw,
  Thermometer,
  Wind,
  Clock,
  Plus,
  AlertTriangle,
} from 'lucide-react'

const cn = (...xs) => xs.filter(Boolean).join(' ')

const fmtBP = (s, d) => {
  const a = [s, d].filter((x) => x !== null && x !== undefined && x !== '')
  return a.length ? a.join('/') : '—'
}

const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] text-slate-700 ring-1 ring-slate-100">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <span className="font-medium">{label}:</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function VitalCard({ v }) {
  return (
    <div className="group rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[11px] text-slate-700 ring-1 ring-slate-100">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          {formatIST(v.recorded_at)}
        </div>

        <div className="text-[11px] text-slate-400">#{v.id}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatPill icon={Activity} label="BP" value={fmtBP(v.bp_systolic, v.bp_diastolic)} />
        <StatPill icon={Thermometer} label="Temp" value={`${v.temp_c ?? '—'} °C`} />
        <StatPill icon={Wind} label="RR" value={`${v.rr ?? '—'} /min`} />
        <StatPill icon={Droplets} label="SpO₂" value={`${v.spo2 ?? '—'} %`} />
        <StatPill icon={HeartPulse} label="Pulse" value={`${v.pulse ?? '—'} /min`} />
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="h-8 w-40 rounded-2xl bg-slate-100" />
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="h-8 w-28 rounded-full bg-slate-100" />
        <div className="h-8 w-28 rounded-full bg-slate-100" />
        <div className="h-8 w-28 rounded-full bg-slate-100" />
        <div className="h-8 w-28 rounded-full bg-slate-100" />
        <div className="h-8 w-28 rounded-full bg-slate-100" />
      </div>
    </div>
  )
}

export default function Vitals({ admissionId, canWrite }) {
  const permCanWrite = useCan('ipd.nursing')
  const canPost = typeof canWrite === 'boolean' ? canWrite : permCanWrite

  const [tab, setTab] = useState('history')
  const [items, setItems] = useState([])
  const [form, setForm] = useState({
    recorded_at: '',
    bp_systolic: '',
    bp_diastolic: '',
    temp_c: '',
    rr: '',
    spo2: '',
    pulse: '',
  })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const lastVital = useMemo(() => (items?.length ? items[0] : null), [items])

  const load = async () => {
    if (!admissionId) return
    setLoading(true)
    setErr('')
    try {
      const { data } = await listVitals(admissionId)
      const vitals = Array.isArray(data) ? data : []
      vitals.sort((a, b) => new Date(b.recorded_at || 0) - new Date(a.recorded_at || 0))
      setItems(vitals)
    } catch (e) {
      console.error('Vitals load error:', e)
      setErr(e?.response?.data?.detail || 'Failed to load vitals')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')

    const hasAnyValue =
      form.recorded_at ||
      form.bp_systolic ||
      form.bp_diastolic ||
      form.temp_c ||
      form.rr ||
      form.spo2 ||
      form.pulse

    if (!hasAnyValue) {
      setErr('Please enter at least one vital value before saving.')
      return
    }

    try {
      setSaving(true)
      const payload = {
        recorded_at: form.recorded_at ? new Date(form.recorded_at).toISOString() : undefined,
        bp_systolic: toNum(form.bp_systolic),
        bp_diastolic: toNum(form.bp_diastolic),
        temp_c: toNum(form.temp_c),
        rr: toNum(form.rr),
        spo2: toNum(form.spo2),
        pulse: toNum(form.pulse),
      }
      await createVital(admissionId, payload)

      setForm({
        recorded_at: '',
        bp_systolic: '',
        bp_diastolic: '',
        temp_c: '',
        rr: '',
        spo2: '',
        pulse: '',
      })

      await load()
      setTab('history') // ✅ jump to history after save
    } catch (e1) {
      console.error('Vitals save error:', e1)
      setErr(e1?.response?.data?.detail || 'Failed to save vitals')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Small top row (compact, not space heavy) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Vitals</div>
          <div className="text-[12px] text-slate-500">Time shown in IST • card-based history</div>
        </div> */}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50',
              loading && 'opacity-60',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>

          {lastVital && (
            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-700 ring-1 ring-slate-100">
              <span className="text-slate-500">Last:</span>{' '}
              <span className="font-semibold text-slate-900">{formatIST(lastVital.recorded_at)}</span>
            </div>
          )}

          {!canPost && (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
              <AlertTriangle className="h-4 w-4" />
              View only
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm ring-1 ring-rose-100">
          {err}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        {/* Compact tabs (mobile friendly) */}
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-1.5">
          <TabsTrigger
            value="history"
            className="shrink-0 rounded-2xl px-3 py-2 text-[12px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-600 data-[state=active]:to-violet-600 data-[state=active]:text-white"
          >
            Vitals history
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {items?.length || 0}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="record"
            disabled={!canPost}
            className="shrink-0 rounded-2xl px-3 py-2 text-[12px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-600 data-[state=active]:to-violet-600 data-[state=active]:text-white disabled:opacity-50"
          >
            Record new vitals
          </TabsTrigger>
        </TabsList>

        {/* HISTORY (cards on ALL screens) */}
        <TabsContent value="history" className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

            {!loading && (!items || items.length === 0) && (
              <div className="sm:col-span-2 lg:col-span-3 2xl:col-span-4 rounded-3xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-100">
                No vitals recorded yet.
              </div>
            )}

            {!loading && items?.map((v) => <VitalCard key={v.id} v={v} />)}
          </div>
        </TabsContent>

        {/* RECORD */}
        <TabsContent value="record" className="mt-3">
          {!canPost ? (
            <div className="rounded-3xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
              View only. You don’t have permission to record vitals.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100 md:p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Record new vitals</div>
                  <div className="text-[12px] text-slate-500">
                    Fields are optional — enter what is measured
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto',
                  )}
                >
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border border-white border-t-transparent" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-6">
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Recorded at</label>
                  <input
                    type="datetime-local"
                    className="h-10 w-full rounded-2xl bg-slate-50 px-3 text-xs text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    value={form.recorded_at}
                    onChange={(e) => updateField('recorded_at', e.target.value)}
                  />
                  <div className="mt-1 text-[11px] text-slate-400">
                    Leave blank to use current time.
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">BP (Systolic)</label>
                  <input
                    type="number"
                    className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    placeholder="mmHg"
                    value={form.bp_systolic}
                    onChange={(e) => updateField('bp_systolic', e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">BP (Diastolic)</label>
                  <input
                    type="number"
                    className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    placeholder="mmHg"
                    value={form.bp_diastolic}
                    onChange={(e) => updateField('bp_diastolic', e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    placeholder="°C"
                    value={form.temp_c}
                    onChange={(e) => updateField('temp_c', e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">RR (/min)</label>
                  <input
                    type="number"
                    className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    placeholder="/min"
                    value={form.rr}
                    onChange={(e) => updateField('rr', e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">SpO₂ (%)</label>
                  <input
                    type="number"
                    className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    placeholder="%"
                    value={form.spo2}
                    onChange={(e) => updateField('spo2', e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Pulse (/min)</label>
                  <input
                    type="number"
                    className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    placeholder="/min"
                    value={form.pulse}
                    onChange={(e) => updateField('pulse', e.target.value)}
                  />
                </div>
              </div>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
