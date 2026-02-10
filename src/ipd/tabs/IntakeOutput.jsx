// FILE: src/ipd/tabs/IntakeOutput.jsx
import { useEffect, useMemo, useState } from 'react'
import { listIO, addIO } from '../../api/ipd'
import PermGate from '../../components/PermGate'
import { formatIST } from '../components/timeZONE'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Droplets,
  ArrowDownCircle,
  ArrowUpCircle,
  Waves,
  ClipboardList,
  Clock,
  RefreshCw,
  Plus,
  AlertTriangle,
} from 'lucide-react'

const cn = (...xs) => xs.filter(Boolean).join(' ')

const n0 = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const fmtMl = (v) => {
  const x = Number(v || 0)
  return x === 0 ? '—' : `${x} ml`
}

const fmtNet = (v) => {
  const x = Number(v || 0)
  if (x === 0) return '0 ml'
  const sign = x > 0 ? '+' : ''
  return `${sign}${x} ml`
}

const getShift = (dateStr) => {
  if (!dateStr) return 'Night'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Night'
  const h = d.getHours()
  if (h >= 6 && h < 14) return 'Morning'
  if (h >= 14 && h < 22) return 'Evening'
  return 'Night'
}

// prefers split fields, falls back to old intake_ml/urine_ml if present
const rowIntakeTotal = (r) => {
  const oral = n0(r?.intake_oral_ml)
  const iv = n0(r?.intake_iv_ml)
  const blood = n0(r?.intake_blood_ml)
  const split = oral + iv + blood
  if (split > 0) return split
  return n0(r?.intake_ml)
}

const rowUrineTotal = (r) => {
  const foley = n0(r?.urine_foley_ml)
  const voided = n0(r?.urine_voided_ml)
  const split = foley + voided
  if (split > 0) return split
  return n0(r?.urine_ml)
}

const rowOutputTotal = (r) => rowUrineTotal(r) + n0(r?.drains_ml)

function Chip({ icon: Icon, label, value, tone = 'slate' }) {
  const toneCls =
    tone === 'sky'
      ? 'bg-sky-50 text-sky-800 ring-sky-100'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-800 ring-rose-100'
      : 'bg-slate-50 text-slate-800 ring-slate-100'

  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] ring-1', toneCls)}>
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="font-medium">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function MetricTile({ title, value, icon: Icon, tone = 'slate' }) {
  const toneCls =
    tone === 'sky'
      ? 'text-sky-700'
      : tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'rose'
      ? 'text-rose-700'
      : 'text-slate-700'

  return (
    <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-slate-500">{title}</div>
        <Icon className={cn('h-4 w-4', toneCls)} />
      </div>
      <div className={cn('mt-1 text-lg font-semibold', toneCls)}>{value}</div>
    </div>
  )
}

function HistoryCard({ r }) {
  const oral = n0(r.intake_oral_ml)
  const iv = n0(r.intake_iv_ml)
  const blood = n0(r.intake_blood_ml)
  const intake = rowIntakeTotal(r)

  const foley = n0(r.urine_foley_ml)
  const voided = n0(r.urine_voided_ml)
  const urine = rowUrineTotal(r)

  const drains = n0(r.drains_ml)
  const output = rowOutputTotal(r)
  const net = intake - output
  const shift = getShift(r.recorded_at)

  return (
    <div className="group rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] text-slate-700 ring-1 ring-slate-100">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          {r?.recorded_at ? formatIST(r.recorded_at) : '—'}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-100">
            {shift}
          </span>

          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1',
              net >= 0 ? 'bg-sky-50 text-sky-800 ring-sky-100' : 'bg-rose-50 text-rose-800 ring-rose-100',
            )}
          >
            Net {fmtNet(net)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MetricTile title="Total Intake" value={fmtMl(intake)} icon={ArrowDownCircle} tone="sky" />
        <MetricTile title="Total Output" value={fmtMl(output)} icon={ArrowUpCircle} tone="emerald" />
        <MetricTile title="Urine (Total)" value={fmtMl(urine)} icon={Droplets} tone="emerald" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip icon={ArrowDownCircle} label="Oral" value={fmtMl(oral)} tone="sky" />
        <Chip icon={ArrowDownCircle} label="IV" value={fmtMl(iv)} tone="sky" />
        <Chip icon={ArrowDownCircle} label="Blood" value={fmtMl(blood)} tone="sky" />

        <Chip icon={Droplets} label="Foley" value={fmtMl(foley)} tone="emerald" />
        <Chip icon={Droplets} label="Voided" value={fmtMl(voided)} tone="emerald" />
        <Chip icon={Waves} label="Drains" value={fmtMl(drains)} tone="emerald" />

        <Chip
          icon={ClipboardList}
          label="Stools"
          value={r?.stools_count ? String(r.stools_count) : '—'}
          tone="slate"
        />
      </div>

      {r?.remarks ? (
        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700 ring-1 ring-slate-100">
          <span className="font-semibold text-slate-900">Remarks:</span> {r.remarks}
        </div>
      ) : null}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="h-8 w-48 rounded-2xl bg-slate-100" />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="h-20 rounded-3xl bg-slate-100" />
        <div className="h-20 rounded-3xl bg-slate-100" />
        <div className="h-20 rounded-3xl bg-slate-100" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-slate-100" />
        ))}
      </div>
    </div>
  )
}

export default function IntakeOutput({ admissionId }) {
  const [tab, setTab] = useState('history')
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    recorded_at: '',
    intake_oral_ml: '',
    intake_iv_ml: '',
    intake_blood_ml: '',
    urine_foley_ml: '',
    urine_voided_ml: '',
    drains_ml: '',
    stools_count: '',
    remarks: '',
  })

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const load = async () => {
    if (!admissionId) return
    setErr('')
    setLoading(true)
    try {
      const { data } = await listIO(admissionId)
      const sorted = (data || []).slice().sort((a, b) => new Date(b.recorded_at || 0) - new Date(a.recorded_at || 0))
      setRows(sorted)
    } catch (e) {
      console.error('I/O load error:', e)
      setErr(e?.response?.data?.detail || 'Failed to load intake / output')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  // Live totals for current form
  const formTotals = useMemo(() => {
    const intake = n0(form.intake_oral_ml) + n0(form.intake_iv_ml) + n0(form.intake_blood_ml)
    const urine = n0(form.urine_foley_ml) + n0(form.urine_voided_ml)
    const output = urine + n0(form.drains_ml)
    return { intake, urine, output, net: intake - output }
  }, [form])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')

    const hasAnyValue =
      form.intake_oral_ml ||
      form.intake_iv_ml ||
      form.intake_blood_ml ||
      form.urine_foley_ml ||
      form.urine_voided_ml ||
      form.drains_ml ||
      form.stools_count

    if (!hasAnyValue) {
      setErr('Enter at least one value (Intake / Urine / Drains / Stools).')
      return
    }

    try {
      setSaving(true)

      const payload = {
        recorded_at: form.recorded_at ? new Date(form.recorded_at).toISOString() : undefined,

        intake_oral_ml: n0(form.intake_oral_ml),
        intake_iv_ml: n0(form.intake_iv_ml),
        intake_blood_ml: n0(form.intake_blood_ml),

        urine_foley_ml: n0(form.urine_foley_ml),
        urine_voided_ml: n0(form.urine_voided_ml),

        drains_ml: n0(form.drains_ml),
        stools_count: n0(form.stools_count),
        remarks: form.remarks || '',

        // Optional compatibility totals (remove if backend rejects unknown fields)
        intake_ml: formTotals.intake,
        urine_ml: formTotals.urine,
      }

      await addIO(admissionId, payload)

      setForm({
        recorded_at: '',
        intake_oral_ml: '',
        intake_iv_ml: '',
        intake_blood_ml: '',
        urine_foley_ml: '',
        urine_voided_ml: '',
        drains_ml: '',
        stools_count: '',
        remarks: '',
      })

      await load()
      setTab('history')
    } catch (e1) {
      console.error('I/O save error:', e1)
      setErr(e1?.response?.data?.detail || 'Failed to add intake / output')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Compact header row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {/* <div className="text-sm font-semibold text-slate-900">Intake / Output</div> */}
          {/* <div className="text-[12px] text-slate-500">Time shown in IST • split intake/output</div> */}
        </div>

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

          <div className="hidden sm:flex items-center gap-2">
            <Chip icon={ArrowDownCircle} label="Intake" value={`${formTotals.intake} ml`} tone="sky" />
            <Chip icon={ArrowUpCircle} label="Output" value={`${formTotals.output} ml`} tone="emerald" />
            <Chip icon={Waves} label="Net" value={fmtNet(formTotals.net)} tone={formTotals.net >= 0 ? 'sky' : 'rose'} />
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm ring-1 ring-rose-100">
          {err}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-1.5">
          <TabsTrigger
            value="history"
            className="shrink-0 rounded-2xl px-3 py-2 text-[12px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-600 data-[state=active]:to-violet-600 data-[state=active]:text-white"
          >
            I/O history
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{rows?.length || 0}</span>
          </TabsTrigger>

          <TabsTrigger
            value="record"
            className="shrink-0 rounded-2xl px-3 py-2 text-[12px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-600 data-[state=active]:to-violet-600 data-[state=active]:text-white"
          >
            Record Intake / Output
          </TabsTrigger>
        </TabsList>

        {/* HISTORY: card design on ALL screens */}
        <TabsContent value="history" className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

            {!loading && (!rows || rows.length === 0) && (
              <div className="sm:col-span-2 lg:col-span-3 2xl:col-span-4 rounded-3xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-100">
                No intake / output entries yet.
              </div>
            )}

            {!loading && rows?.map((r) => <HistoryCard key={r.id} r={r} />)}
          </div>
        </TabsContent>

        {/* RECORD */}
        <TabsContent value="record" className="mt-3">
            <PermGate anyOf={['ipd.io.create', 'ipd.io.update', 'ipd.nursing']}>
            <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100 md:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Record Intake / Output</div>
                  <div className="text-[12px] text-slate-500">Totals update automatically (Intake, Output, Net)</div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Chip icon={ArrowDownCircle} label="Intake" value={`${formTotals.intake} ml`} tone="sky" />
                  <Chip icon={ArrowUpCircle} label="Output" value={`${formTotals.output} ml`} tone="emerald" />
                  <Chip
                    icon={Waves}
                    label="Net"
                    value={fmtNet(formTotals.net)}
                    tone={formTotals.net >= 0 ? 'sky' : 'rose'}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    className="h-10 w-full rounded-2xl bg-slate-50 px-3 text-xs text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                    value={form.recorded_at}
                    onChange={(e) => updateField('recorded_at', e.target.value)}
                  />
                  <div className="mt-1 text-[11px] text-slate-400">Leave blank to use current time.</div>
                </div>

                {/* Intake */}
                <div className="lg:col-span-9 rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Intake (ml)</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Oral</label>
                      <input
                        type="number"
                        min="0"
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                        placeholder="Water / Feed"
                        value={form.intake_oral_ml}
                        onChange={(e) => updateField('intake_oral_ml', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">IV</label>
                      <input
                        type="number"
                        min="0"
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                        placeholder="NS / RL"
                        value={form.intake_iv_ml}
                        onChange={(e) => updateField('intake_iv_ml', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Blood</label>
                      <input
                        type="number"
                        min="0"
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                        placeholder="PRBC / FFP"
                        value={form.intake_blood_ml}
                        onChange={(e) => updateField('intake_blood_ml', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Output */}
                <div className="lg:col-span-12 rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Output</div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Urine – Foley (ml)</label>
                      <input
                        type="number"
                        min="0"
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-400"
                        placeholder="Catheter"
                        value={form.urine_foley_ml}
                        onChange={(e) => updateField('urine_foley_ml', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Urine – Voided (ml)</label>
                      <input
                        type="number"
                        min="0"
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-400"
                        placeholder="Measured void"
                        value={form.urine_voided_ml}
                        onChange={(e) => updateField('urine_voided_ml', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Drains (ml)</label>
                      <input
                        type="number"
                        min="0"
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-400"
                        placeholder="ICD / Wound"
                        value={form.drains_ml}
                        onChange={(e) => updateField('drains_ml', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Stools (count)</label>
                      <input
                        type="number"
                        min="0"
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-400"
                        placeholder="0"
                        value={form.stools_count}
                        onChange={(e) => updateField('stools_count', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Remarks</label>
                      <input
                        className="h-10 w-full rounded-2xl bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-400"
                        placeholder="Eg: RL 500ml, Urine via Foley, ICD drain…"
                        value={form.remarks}
                        onChange={(e) => updateField('remarks', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {err ? (
                  <div className="inline-flex items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>{err}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">Tip: record every shift for best 24-hr balance tracking.</div>
                )}

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
                  {saving ? 'Saving…' : 'Save entry'}
                </button>
              </div>
            </form>
          </PermGate>
        </TabsContent>
      </Tabs>
    </div>
  )
}
