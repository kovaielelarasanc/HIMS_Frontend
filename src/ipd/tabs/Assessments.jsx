// FILE: src/ipd/tabs/Assessments.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  listPainAssessments,
  addPainAssessment,
  listFallRiskAssessments,
  addFallRiskAssessment,
  listPressureUlcerAssessments,
  addPressureUlcerAssessment,
  listNutritionAssessments,
  addNutritionAssessment,
} from '../../api/ipd'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  Bandage,
  ShieldAlert,
  UtensilsCrossed,
  Clock,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { formatIST } from '../components/timeZONE'

const cn = (...xs) => xs.filter(Boolean).join(' ')
const toIsoSecs = (v) => (!v ? null : v.length === 16 ? `${v}:00` : v)

const inputBase =
  'h-10 w-full rounded-2xl bg-white px-3 text-xs text-slate-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-400'
const selectBase =
  'h-10 w-full rounded-2xl bg-white px-3 text-xs text-slate-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-400'
const textareaBase =
  'w-full rounded-2xl bg-white px-3 py-2 text-xs text-slate-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-400'
const pillActive =
  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-600 data-[state=active]:to-violet-600 data-[state=active]:text-white'

function ToneBadge({ children, tone = 'slate' }) {
  const cls =
    tone === 'rose'
      ? 'bg-rose-50 text-rose-800 ring-rose-100'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800 ring-amber-100'
        : tone === 'emerald'
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
          : tone === 'sky'
            ? 'bg-sky-50 text-sky-800 ring-sky-100'
            : 'bg-slate-50 text-slate-800 ring-slate-100'

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1', cls)}>
      {children}
    </span>
  )
}

function InfoChip({ icon: Icon, label, value }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] text-slate-700 ring-1 ring-slate-100">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <span className="font-medium text-slate-600">{label}:</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function EmptyState({ title, desc }) {
  return (
    <div className="rounded-3xl bg-slate-50 px-4 py-10 text-center ring-1 ring-slate-100">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-[12px] text-slate-500">{desc}</div>
    </div>
  )
}

function SectionShell({
  title,
  icon: Icon,
  accent = 'sky',
  canWrite,
  viewMode,
  setViewMode,
  summary,
  record,
  history,
  count = 0,
}) {
  const accentRing =
    accent === 'rose'
      ? 'ring-rose-100'
      : accent === 'amber'
        ? 'ring-amber-100'
        : accent === 'emerald'
          ? 'ring-emerald-100'
          : 'ring-sky-100'

  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm',
              accent === 'rose'
                ? 'from-rose-500 to-fuchsia-500'
                : accent === 'amber'
                  ? 'from-amber-500 to-orange-500'
                  : accent === 'emerald'
                    ? 'from-emerald-500 to-teal-500'
                    : 'from-sky-500 to-violet-500',
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="text-[12px] text-slate-500">Time shown in IST</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ToneBadge tone="slate">{count} records</ToneBadge>

          {/* Mobile: small toggle pills */}
          <div className="lg:hidden">
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList className={cn('h-auto gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1', accentRing)}>
                <TabsTrigger
                  value="history"
                  className={cn('shrink-0 rounded-2xl px-3 py-2 text-[12px]', pillActive)}
                >
                  History
                </TabsTrigger>
                <TabsTrigger
                  value="record"
                  disabled={!canWrite}
                  className={cn('shrink-0 rounded-2xl px-3 py-2 text-[12px]', pillActive)}
                >
                  Record
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className={cn('rounded-3xl bg-slate-50 p-3 ring-1', accentRing)}>{summary}</div>

      {/* Desktop: 2-column layout. Mobile uses the viewMode tabs */}
      <div className={cn(canWrite ? 'lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-3' : '')}>
        {canWrite ? (
          <div className={cn('hidden lg:block')}>
            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">{record}</div>
          </div>
        ) : null}

        <div className={cn('hidden lg:block')}>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">{history}</div>
        </div>

        {/* Mobile content */}
        <div className="lg:hidden">
          {viewMode === 'record' ? (
            canWrite ? (
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">{record}</div>
            ) : (
              <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-semibold">View-only access</div>
                    <div className="text-[12px]">You don’t have permission to record this assessment.</div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">{history}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryCards({ rows, renderCard }) {
  if (!rows?.length) {
    return <EmptyState title="No records yet" desc="Add the first assessment to start tracking trends." />
  }
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(renderCard)}</div>
}

export default function AssessmentsTab({ admissionId, canWrite }) {
  const [active, setActive] = useState('pain')
  const [viewMode, setViewMode] = useState('history') // mobile only (record/history)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [painRows, setPainRows] = useState([])
  const [fallRows, setFallRows] = useState([])
  const [pressureRows, setPressureRows] = useState([])
  const [nutritionRows, setNutritionRows] = useState([])

  const [painForm, setPainForm] = useState({
    recorded_at: '',
    scale_type: '',
    score: '',
    location: '',
    character: '',
    intervention: '',
    post_intervention_score: '',
  })

  const [fallForm, setFallForm] = useState({
    recorded_at: '',
    tool: '',
    score: '',
    risk_level: '',
    precautions: '',
  })

  const [pressureForm, setPressureForm] = useState({
    recorded_at: '',
    tool: '',
    score: '',
    risk_level: '',
    existing_ulcer: false,
    site: '',
    stage: '',
    management_plan: '',
  })

  const [nutritionForm, setNutritionForm] = useState({
    recorded_at: '',
    bmi: '',
    weight_kg: '',
    height_cm: '',
    screening_tool: '',
    score: '',
    risk_level: '',
    dietician_referral: false,
  })

  const sortDesc = (arr) =>
    (Array.isArray(arr) ? arr : []).slice().sort((a, b) => new Date(b.recorded_at || 0) - new Date(a.recorded_at || 0))

  const loadAll = async () => {
    if (!admissionId) return
    setLoading(true)
    setError('')
    try {
      const [p, f, pr, n] = await Promise.all([
        listPainAssessments(admissionId),
        listFallRiskAssessments(admissionId),
        listPressureUlcerAssessments(admissionId),
        listNutritionAssessments(admissionId),
      ])
      setPainRows(sortDesc(p.data || []))
      setFallRows(sortDesc(f.data || []))
      setPressureRows(sortDesc(pr.data || []))
      setNutritionRows(sortDesc(n.data || []))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load assessments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  useEffect(() => {
    setViewMode('history') // reset mobile view when switching sections
  }, [active])

  const painLast = painRows?.[0] || null
  const fallLast = fallRows?.[0] || null
  const pressureLast = pressureRows?.[0] || null
  const nutritionLast = nutritionRows?.[0] || null

  const submitPain = async (e) => {
    e.preventDefault()
    if (!canWrite || !admissionId) return
    setError('')
    try {
      const payload = {
        recorded_at: toIsoSecs(painForm.recorded_at),
        scale_type: painForm.scale_type || '',
        score: painForm.score !== '' ? Number(painForm.score) : null,
        location: painForm.location || '',
        character: painForm.character || '',
        intervention: painForm.intervention || '',
        post_intervention_score: painForm.post_intervention_score !== '' ? Number(painForm.post_intervention_score) : null,
      }
      await addPainAssessment(admissionId, payload)
      setPainForm({
        recorded_at: '',
        scale_type: '',
        score: '',
        location: '',
        character: '',
        intervention: '',
        post_intervention_score: '',
      })
      await loadAll()
      setViewMode('history')
    } catch (e1) {
      setError(e1?.response?.data?.detail || 'Failed to add pain assessment')
    }
  }

  const submitFall = async (e) => {
    e.preventDefault()
    if (!canWrite || !admissionId) return
    setError('')
    try {
      const payload = {
        recorded_at: toIsoSecs(fallForm.recorded_at),
        tool: fallForm.tool || '',
        score: fallForm.score !== '' ? Number(fallForm.score) : null,
        risk_level: fallForm.risk_level || '',
        precautions: fallForm.precautions || '',
      }
      await addFallRiskAssessment(admissionId, payload)
      setFallForm({ recorded_at: '', tool: '', score: '', risk_level: '', precautions: '' })
      await loadAll()
      setViewMode('history')
    } catch (e1) {
      setError(e1?.response?.data?.detail || 'Failed to add fall risk assessment')
    }
  }

  const submitPressure = async (e) => {
    e.preventDefault()
    if (!canWrite || !admissionId) return
    setError('')
    try {
      const payload = {
        recorded_at: toIsoSecs(pressureForm.recorded_at),
        tool: pressureForm.tool || '',
        score: pressureForm.score !== '' ? Number(pressureForm.score) : null,
        risk_level: pressureForm.risk_level || '',
        existing_ulcer: Boolean(pressureForm.existing_ulcer),
        site: pressureForm.site || '',
        stage: pressureForm.stage || '',
        management_plan: pressureForm.management_plan || '',
      }
      await addPressureUlcerAssessment(admissionId, payload)
      setPressureForm({
        recorded_at: '',
        tool: '',
        score: '',
        risk_level: '',
        existing_ulcer: false,
        site: '',
        stage: '',
        management_plan: '',
      })
      await loadAll()
      setViewMode('history')
    } catch (e1) {
      setError(e1?.response?.data?.detail || 'Failed to add pressure-ulcer assessment')
    }
  }

  const submitNutrition = async (e) => {
    e.preventDefault()
    if (!canWrite || !admissionId) return
    setError('')
    try {
      const payload = {
        recorded_at: toIsoSecs(nutritionForm.recorded_at),
        bmi: nutritionForm.bmi !== '' ? Number(nutritionForm.bmi) : null,
        weight_kg: nutritionForm.weight_kg !== '' ? Number(nutritionForm.weight_kg) : null,
        height_cm: nutritionForm.height_cm !== '' ? Number(nutritionForm.height_cm) : null,
        screening_tool: nutritionForm.screening_tool || '',
        score: nutritionForm.score !== '' ? Number(nutritionForm.score) : null,
        risk_level: nutritionForm.risk_level || '',
        dietician_referral: Boolean(nutritionForm.dietician_referral),
      }
      await addNutritionAssessment(admissionId, payload)
      setNutritionForm({
        recorded_at: '',
        bmi: '',
        weight_kg: '',
        height_cm: '',
        screening_tool: '',
        score: '',
        risk_level: '',
        dietician_referral: false,
      })
      await loadAll()
      setViewMode('history')
    } catch (e1) {
      setError(e1?.response?.data?.detail || 'Failed to add nutrition assessment')
    }
  }

  const sections = useMemo(
    () => [
      { key: 'pain', label: 'Pain', icon: Activity },
      { key: 'fall', label: 'Fall Risk', icon: ShieldAlert },
      { key: 'pressure', label: 'Pressure Ulcer', icon: Bandage },
      { key: 'nutrition', label: 'Nutrition', icon: UtensilsCrossed },
    ],
    [],
  )

  return (
    <div className="space-y-3">
      {/* Top row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Clinical Assessments</div>
          <div className="text-[12px] text-slate-500">Fast record + clear history (Nutryah-premium, responsive)</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50',
              loading && 'opacity-60',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Sync
          </button>

          {canWrite ? (
            <ToneBadge tone="emerald">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Editable
            </ToneBadge>
          ) : (
            <ToneBadge tone="amber">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              View only
            </ToneBadge>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm ring-1 ring-rose-100">
          {error}
        </div>
      )}

      {/* Main section tabs (compact + scrollable on mobile) */}
      <div className="rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-100">
        <div className="flex gap-2 overflow-x-auto p-1">
          {sections.map((t) => {
            const isActive = active === t.key
            const Icon = t.icon
            const count =
              t.key === 'pain'
                ? painRows.length
                : t.key === 'fall'
                  ? fallRows.length
                  : t.key === 'pressure'
                    ? pressureRows.length
                    : nutritionRows.length

            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={cn(
                  'shrink-0 rounded-2xl px-3 py-2 text-left text-[12px] ring-1 transition',
                  isActive
                    ? 'bg-gradient-to-r from-sky-600 to-violet-600 text-white ring-sky-200'
                    : 'bg-slate-50 text-slate-800 ring-slate-100 hover:bg-slate-100',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-semibold">{t.label}</span>
                  <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px]', isActive ? 'bg-white/20' : 'bg-white')}>
                    {count}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {loading && <div className="text-[12px] text-slate-500">Loading assessments…</div>}

      {/* PAIN */}
      {active === 'pain' && (
        <SectionShell
          title="Pain Assessment"
          icon={Activity}
          accent="sky"
          canWrite={!!canWrite}
          viewMode={viewMode}
          setViewMode={setViewMode}
          count={painRows.length}
          summary={
            <div className="flex flex-wrap items-center gap-2">
              <InfoChip icon={Clock} label="Last" value={painLast?.recorded_at ? formatIST(painLast.recorded_at) : '—'} />
              <ToneBadge tone="sky">Score {painLast?.score ?? '—'}</ToneBadge>
              <ToneBadge tone="slate">{painLast?.scale_type || 'Scale —'}</ToneBadge>
              <div className="text-[12px] text-slate-500">
                {painLast?.location ? `Location: ${painLast.location}` : 'No recent pain location'}
              </div>
            </div>
          }
          record={
            <form onSubmit={submitPain} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Record pain</div>
                <span className="text-[11px] text-slate-500">Quick entry</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Recorded at</label>
                  <input
                    type="datetime-local"
                    className={inputBase}
                    value={painForm.recorded_at}
                    onChange={(e) => setPainForm((s) => ({ ...s, recorded_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Scale</label>
                  <input
                    className={inputBase}
                    placeholder="NRS / VAS / Wong-Baker"
                    value={painForm.scale_type}
                    onChange={(e) => setPainForm((s) => ({ ...s, scale_type: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Score (0–10)</label>
                  <input
                    className={inputBase}
                    type="number"
                    min="0"
                    max="10"
                    value={painForm.score}
                    onChange={(e) => setPainForm((s) => ({ ...s, score: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Post score (0–10)</label>
                  <input
                    className={inputBase}
                    type="number"
                    min="0"
                    max="10"
                    value={painForm.post_intervention_score}
                    onChange={(e) => setPainForm((s) => ({ ...s, post_intervention_score: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Location</label>
                  <input
                    className={inputBase}
                    placeholder="Site"
                    value={painForm.location}
                    onChange={(e) => setPainForm((s) => ({ ...s, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Character</label>
                  <input
                    className={inputBase}
                    placeholder="Sharp / dull / throbbing"
                    value={painForm.character}
                    onChange={(e) => setPainForm((s) => ({ ...s, character: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Intervention / remarks</label>
                <textarea
                  className={cn(textareaBase, 'min-h-[84px]')}
                  placeholder="Analgesic given, position change, ice pack…"
                  value={painForm.intervention}
                  onChange={(e) => setPainForm((s) => ({ ...s, intervention: e.target.value }))}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  <Plus className="h-4 w-4" />
                  Save pain
                </button>
              </div>
            </form>
          }
          history={
            <HistoryCards
              rows={painRows}
              renderCard={(r) => (
                <div
                  key={r.id}
                  className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <InfoChip icon={Clock} label="When" value={r.recorded_at ? formatIST(r.recorded_at) : '—'} />
                    <ToneBadge tone="sky">Score {r.score ?? '—'}</ToneBadge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToneBadge tone="slate">{r.scale_type || 'Scale —'}</ToneBadge>
                    {r.location ? <ToneBadge tone="slate">Loc: {r.location}</ToneBadge> : null}
                    {r.character ? <ToneBadge tone="slate">Char: {r.character}</ToneBadge> : null}
                    {r.post_intervention_score != null ? (
                      <ToneBadge tone="emerald">Post: {r.post_intervention_score}</ToneBadge>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700 ring-1 ring-slate-100">
                    <span className="font-semibold text-slate-900">Intervention:</span> {r.intervention || '—'}
                  </div>
                </div>
              )}
            />
          }
        />
      )}

      {/* FALL */}
      {active === 'fall' && (
        <SectionShell
          title="Fall Risk Assessment"
          icon={ShieldAlert}
          accent="amber"
          canWrite={!!canWrite}
          viewMode={viewMode}
          setViewMode={setViewMode}
          count={fallRows.length}
          summary={
            <div className="flex flex-wrap items-center gap-2">
              <InfoChip icon={Clock} label="Last" value={fallLast?.recorded_at ? formatIST(fallLast.recorded_at) : '—'} />
              <ToneBadge tone="amber">Risk {fallLast?.risk_level || '—'}</ToneBadge>
              <ToneBadge tone="slate">Score {fallLast?.score ?? '—'}</ToneBadge>
              <div className="text-[12px] text-slate-500">{fallLast?.tool ? `Tool: ${fallLast.tool}` : 'No tool selected'}</div>
            </div>
          }
          record={
            <form onSubmit={submitFall} className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Record fall risk</div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Recorded at</label>
                  <input
                    type="datetime-local"
                    className={inputBase}
                    value={fallForm.recorded_at}
                    onChange={(e) => setFallForm((s) => ({ ...s, recorded_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Tool</label>
                  <input
                    className={inputBase}
                    placeholder="Morse / Hendrich…"
                    value={fallForm.tool}
                    onChange={(e) => setFallForm((s) => ({ ...s, tool: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Score</label>
                  <input
                    type="number"
                    className={inputBase}
                    value={fallForm.score}
                    onChange={(e) => setFallForm((s) => ({ ...s, score: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Risk level</label>
                  <select
                    className={selectBase}
                    value={fallForm.risk_level}
                    onChange={(e) => setFallForm((s) => ({ ...s, risk_level: e.target.value }))}
                  >
                    <option value="">Select</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Precautions</label>
                <textarea
                  className={cn(textareaBase, 'min-h-[84px]')}
                  placeholder="Bed rails, assistance, call bell, non-slip…"
                  value={fallForm.precautions}
                  onChange={(e) => setFallForm((s) => ({ ...s, precautions: e.target.value }))}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  <Plus className="h-4 w-4" />
                  Save fall risk
                </button>
              </div>
            </form>
          }
          history={
            <HistoryCards
              rows={fallRows}
              renderCard={(r) => (
                <div
                  key={r.id}
                  className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <InfoChip icon={Clock} label="When" value={r.recorded_at ? formatIST(r.recorded_at) : '—'} />
                    <ToneBadge tone="amber">{r.risk_level ? `Risk ${r.risk_level}` : 'Risk —'}</ToneBadge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToneBadge tone="slate">{r.tool || 'Tool —'}</ToneBadge>
                    <ToneBadge tone="slate">Score {r.score ?? '—'}</ToneBadge>
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700 ring-1 ring-slate-100">
                    <span className="font-semibold text-slate-900">Precautions:</span> {r.precautions || '—'}
                  </div>
                </div>
              )}
            />
          }
        />
      )}

      {/* PRESSURE */}
      {active === 'pressure' && (
        <SectionShell
          title="Pressure Ulcer Assessment"
          icon={Bandage}
          accent="rose"
          canWrite={!!canWrite}
          viewMode={viewMode}
          setViewMode={setViewMode}
          count={pressureRows.length}
          summary={
            <div className="flex flex-wrap items-center gap-2">
              <InfoChip
                icon={Clock}
                label="Last"
                value={pressureLast?.recorded_at ? formatIST(pressureLast.recorded_at) : '—'}
              />
              <ToneBadge tone="rose">{pressureLast?.risk_level ? `Risk ${pressureLast.risk_level}` : 'Risk —'}</ToneBadge>
              <ToneBadge tone="slate">Score {pressureLast?.score ?? '—'}</ToneBadge>
              <ToneBadge tone={pressureLast?.existing_ulcer ? 'rose' : 'slate'}>
                {pressureLast?.existing_ulcer ? 'Existing ulcer' : 'No ulcer'}
              </ToneBadge>
              <div className="text-[12px] text-slate-500">
                {pressureLast?.site ? `Site: ${pressureLast.site}` : 'Site —'}
                {pressureLast?.stage ? ` • Stage: ${pressureLast.stage}` : ''}
              </div>
            </div>
          }
          record={
            <form onSubmit={submitPressure} className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Record pressure ulcer risk</div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Recorded at</label>
                  <input
                    type="datetime-local"
                    className={inputBase}
                    value={pressureForm.recorded_at}
                    onChange={(e) => setPressureForm((s) => ({ ...s, recorded_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Tool</label>
                  <input
                    className={inputBase}
                    placeholder="Braden…"
                    value={pressureForm.tool}
                    onChange={(e) => setPressureForm((s) => ({ ...s, tool: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Score</label>
                  <input
                    type="number"
                    className={inputBase}
                    value={pressureForm.score}
                    onChange={(e) => setPressureForm((s) => ({ ...s, score: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Risk level</label>
                  <select
                    className={selectBase}
                    value={pressureForm.risk_level}
                    onChange={(e) => setPressureForm((s) => ({ ...s, risk_level: e.target.value }))}
                  >
                    <option value="">Select</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={!!pressureForm.existing_ulcer}
                      onChange={(e) => setPressureForm((s) => ({ ...s, existing_ulcer: e.target.checked }))}
                    />
                    Existing ulcer
                  </label>

                  <div className="flex gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Site</label>
                      <input
                        className={cn(inputBase, 'h-9')}
                        value={pressureForm.site}
                        onChange={(e) => setPressureForm((s) => ({ ...s, site: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Stage</label>
                      <input
                        className={cn(inputBase, 'h-9')}
                        placeholder="I–IV"
                        value={pressureForm.stage}
                        onChange={(e) => setPressureForm((s) => ({ ...s, stage: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Management plan</label>
                <textarea
                  className={cn(textareaBase, 'min-h-[84px]')}
                  placeholder="Repositioning, air mattress, dressing plan…"
                  value={pressureForm.management_plan}
                  onChange={(e) => setPressureForm((s) => ({ ...s, management_plan: e.target.value }))}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  <Plus className="h-4 w-4" />
                  Save pressure
                </button>
              </div>
            </form>
          }
          history={
            <HistoryCards
              rows={pressureRows}
              renderCard={(r) => (
                <div
                  key={r.id}
                  className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <InfoChip icon={Clock} label="When" value={r.recorded_at ? formatIST(r.recorded_at) : '—'} />
                    <ToneBadge tone="rose">{r.risk_level ? `Risk ${r.risk_level}` : 'Risk —'}</ToneBadge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToneBadge tone="slate">{r.tool || 'Tool —'}</ToneBadge>
                    <ToneBadge tone="slate">Score {r.score ?? '—'}</ToneBadge>
                    {r.existing_ulcer ? <ToneBadge tone="rose">Existing</ToneBadge> : <ToneBadge tone="emerald">No ulcer</ToneBadge>}
                    {r.site ? <ToneBadge tone="slate">Site {r.site}</ToneBadge> : null}
                    {r.stage ? <ToneBadge tone="slate">Stage {r.stage}</ToneBadge> : null}
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700 ring-1 ring-slate-100">
                    <span className="font-semibold text-slate-900">Plan:</span> {r.management_plan || '—'}
                  </div>
                </div>
              )}
            />
          }
        />
      )}

      {/* NUTRITION */}
      {active === 'nutrition' && (
        <SectionShell
          title="Nutrition Assessment"
          icon={UtensilsCrossed}
          accent="emerald"
          canWrite={!!canWrite}
          viewMode={viewMode}
          setViewMode={setViewMode}
          count={nutritionRows.length}
          summary={
            <div className="flex flex-wrap items-center gap-2">
              <InfoChip
                icon={Clock}
                label="Last"
                value={nutritionLast?.recorded_at ? formatIST(nutritionLast.recorded_at) : '—'}
              />
              <ToneBadge tone="emerald">{nutritionLast?.risk_level ? `Risk ${nutritionLast.risk_level}` : 'Risk —'}</ToneBadge>
              <ToneBadge tone="slate">BMI {nutritionLast?.bmi ?? '—'}</ToneBadge>
              <ToneBadge tone={nutritionLast?.dietician_referral ? 'amber' : 'slate'}>
                {nutritionLast?.dietician_referral ? 'Dietician referral' : 'No referral'}
              </ToneBadge>
              <div className="text-[12px] text-slate-500">
                {nutritionLast?.screening_tool ? `Tool: ${nutritionLast.screening_tool}` : 'Screening tool —'}
              </div>
            </div>
          }
          record={
            <form onSubmit={submitNutrition} className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Record nutrition</div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Recorded at</label>
                  <input
                    type="datetime-local"
                    className={inputBase}
                    value={nutritionForm.recorded_at}
                    onChange={(e) => setNutritionForm((s) => ({ ...s, recorded_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Screening tool</label>
                  <input
                    className={inputBase}
                    placeholder="MUST / NRS 2002…"
                    value={nutritionForm.screening_tool}
                    onChange={(e) => setNutritionForm((s) => ({ ...s, screening_tool: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">BMI</label>
                  <input
                    type="number"
                    step="0.1"
                    className={inputBase}
                    value={nutritionForm.bmi}
                    onChange={(e) => setNutritionForm((s) => ({ ...s, bmi: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Score</label>
                  <input
                    type="number"
                    className={inputBase}
                    value={nutritionForm.score}
                    onChange={(e) => setNutritionForm((s) => ({ ...s, score: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className={inputBase}
                    value={nutritionForm.weight_kg}
                    onChange={(e) => setNutritionForm((s) => ({ ...s, weight_kg: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    className={inputBase}
                    value={nutritionForm.height_cm}
                    onChange={(e) => setNutritionForm((s) => ({ ...s, height_cm: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Risk level</label>
                  <select
                    className={selectBase}
                    value={nutritionForm.risk_level}
                    onChange={(e) => setNutritionForm((s) => ({ ...s, risk_level: e.target.value }))}
                  >
                    <option value="">Select</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-slate-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={!!nutritionForm.dietician_referral}
                      onChange={(e) => setNutritionForm((s) => ({ ...s, dietician_referral: e.target.checked }))}
                    />
                    Dietician referral
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  <Plus className="h-4 w-4" />
                  Save nutrition
                </button>
              </div>
            </form>
          }
          history={
            <HistoryCards
              rows={nutritionRows}
              renderCard={(r) => (
                <div
                  key={r.id}
                  className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <InfoChip icon={Clock} label="When" value={r.recorded_at ? formatIST(r.recorded_at) : '—'} />
                    <ToneBadge tone="emerald">{r.risk_level ? `Risk ${r.risk_level}` : 'Risk —'}</ToneBadge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToneBadge tone="slate">BMI {r.bmi ?? '—'}</ToneBadge>
                    <ToneBadge tone="slate">
                      Wt {r.weight_kg != null ? `${r.weight_kg}kg` : '—'} / Ht {r.height_cm != null ? `${r.height_cm}cm` : '—'}
                    </ToneBadge>
                    <ToneBadge tone="slate">{r.screening_tool || 'Tool —'}</ToneBadge>
                    <ToneBadge tone="slate">Score {r.score ?? '—'}</ToneBadge>
                    {r.dietician_referral ? <ToneBadge tone="amber">Referral</ToneBadge> : <ToneBadge tone="emerald">No referral</ToneBadge>}
                  </div>
                </div>
              )}
            />
          }
        />
      )}
    </div>
  )
}
