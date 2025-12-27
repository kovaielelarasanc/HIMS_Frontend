import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Plus, AlertTriangle } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

import ClinicalRecordWorkspace from './ui/ClinicalRecordWorkspace'
import { SectionCard, TimelineCard, StickyActionBar, EditReasonDialog, AuditRow } from './ui/SharedPieces'
import { fmtIST, toIso } from './ui/utils'

import {
  listTransfusions,
  createTransfusion,
  updateTransfusion,
  addTransfusionVital,
  markTransfusionReaction,
} from '../../api/ipdNursing'

const draftKey = (admissionId, module) => `nabh:draft:${module}:${admissionId}`

const Field = ({ label, children, hint }) => (
  <div>
    <div className="text-xs font-medium text-zinc-700 mb-1">{label}</div>
    {children}
    {hint ? <div className="text-[11px] text-zinc-500 mt-1">{hint}</div> : null}
  </div>
)

const ToggleRow = ({ label, checked, onCheckedChange }) => (
  <div className="h-10 rounded-xl border bg-white px-3 flex items-center justify-between">
    <div className="text-sm text-zinc-700">{label}</div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
)

const EmptyState = ({ text = 'No records yet' }) => (
  <div className="rounded-2xl border bg-white p-6 text-center">
    <div className="text-sm font-medium text-zinc-900">{text}</div>
    <div className="text-xs text-zinc-500 mt-1">Create your first entry using the form.</div>
  </div>
)

// ------------------------------
// Safe parsing + normalization
// ------------------------------
function safeJson(v, fallback) {
  if (v == null) return fallback
  if (typeof v === 'object') return v
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return fallback
    try {
      return JSON.parse(s)
    } catch {
      return fallback
    }
  }
  return fallback
}

function splitBP(bpStr) {
  const s = String(bpStr || '').trim()
  if (!s) return { bp_sys: '', bp_dia: '' }
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!m) return { bp_sys: '', bp_dia: '' }
  return { bp_sys: m[1], bp_dia: m[2] }
}

function normalizeVitals(v) {
  const obj = safeJson(v, {}) || {}
  const pulse = obj.pulse ?? ''
  const temp = obj.temp ?? ''
  const rr = obj.rr ?? ''
  const spo2 = obj.spo2 ?? ''

  // accept either:
  // - bp: "120/80"
  // - bp_sys + bp_dia
  const fromBp = splitBP(obj.bp)
  const bp_sys = obj.bp_sys ?? fromBp.bp_sys ?? ''
  const bp_dia = obj.bp_dia ?? fromBp.bp_dia ?? ''
  const bp = bp_sys && bp_dia ? `${bp_sys}/${bp_dia}` : (obj.bp ?? '')

  return {
    bp_sys,
    bp_dia,
    bp, // keep for backward compatibility in history
    pulse,
    temp,
    rr,
    spo2,
    notes: obj.notes ?? '',
  }
}

function vitalsForPayload(v) {
  const vv = normalizeVitals(v)
  // Keep both bp + sys/dia so old + new code both work
  return {
    bp: vv.bp || (vv.bp_sys && vv.bp_dia ? `${vv.bp_sys}/${vv.bp_dia}` : ''),
    bp_sys: vv.bp_sys,
    bp_dia: vv.bp_dia,
    pulse: vv.pulse,
    temp: vv.temp,
    rr: vv.rr,
    spo2: vv.spo2,
    notes: vv.notes || '',
  }
}

function normalizeRow(r) {
  const pre = normalizeVitals(r?.pre_vitals)
  const post = normalizeVitals(r?.post_vitals)

  const mv = safeJson(r?.monitoring_vitals, [])
  const monitoring_vitals = Array.isArray(mv)
    ? mv.filter(Boolean).map((p) => {
        const point = typeof p === 'object' ? p : safeJson(p, {})
        return {
          at: point?.at || point?.time || null,
          ...normalizeVitals(point),
        }
      })
    : []

  return {
    ...r,
    pre_vitals: pre,
    post_vitals: post,
    monitoring_vitals,
  }
}

// ------------------------------
// Vitals Grid (separate inputs)
// ------------------------------
function VitalsGrid({ value, onChange, title = 'Vitals' }) {
  const v = normalizeVitals(value)

  const set = (patch) => onChange?.({ ...v, ...patch })

  return (
    <SectionCard title={title} subtitle="Separate fields — stored as an object.">
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="BP (Sys)">
          <Input
            className="h-10 rounded-xl"
            inputMode="numeric"
            value={v.bp_sys}
            onChange={(e) => {
              const bp_sys = e.target.value
              const bp = bp_sys && v.bp_dia ? `${bp_sys}/${v.bp_dia}` : v.bp
              set({ bp_sys, bp })
            }}
            placeholder="120"
          />
        </Field>

        <Field label="BP (Dia)">
          <Input
            className="h-10 rounded-xl"
            inputMode="numeric"
            value={v.bp_dia}
            onChange={(e) => {
              const bp_dia = e.target.value
              const bp = v.bp_sys && bp_dia ? `${v.bp_sys}/${bp_dia}` : v.bp
              set({ bp_dia, bp })
            }}
            placeholder="80"
          />
        </Field>

        <Field label="Pulse">
          <Input
            className="h-10 rounded-xl"
            inputMode="numeric"
            value={v.pulse}
            onChange={(e) => set({ pulse: e.target.value })}
            placeholder="80"
          />
        </Field>

        <Field label="Temp (°C)">
          <Input
            className="h-10 rounded-xl"
            inputMode="decimal"
            value={v.temp}
            onChange={(e) => set({ temp: e.target.value })}
            placeholder="37.0"
          />
        </Field>

        <Field label="SpO₂ (%)">
          <Input
            className="h-10 rounded-xl"
            inputMode="numeric"
            value={v.spo2}
            onChange={(e) => set({ spo2: e.target.value })}
            placeholder="98"
          />
        </Field>

        <Field label="RR" hint="Respiratory rate">
          <Input
            className="h-10 rounded-xl"
            inputMode="numeric"
            value={v.rr}
            onChange={(e) => set({ rr: e.target.value })}
            placeholder="18"
          />
        </Field>

        <div className="md:col-span-4">
          <Field label="Notes (optional)">
            <Input
              className="h-10 rounded-xl"
              value={v.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Stable / chills / mild fever..."
            />
          </Field>
        </div>
      </div>
    </SectionCard>
  )
}

// ===================================================================
// COMPONENT
// ===================================================================
export default function TransfusionModule({ admissionId, chips, alerts, canWrite, canEdit, canReaction }) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const [editReasonOpen, setEditReasonOpen] = useState(false)
  const pendingUpdateRef = useRef(null)

  const empty = {
    component_type: '',
    bag_number: '',
    start_time: '',
    end_time: '',
    pre_vitals: normalizeVitals({}),
    post_vitals: normalizeVitals({}),
    reaction_occurred: false,
    reaction_notes: '',
  }
  const [form, setForm] = useState(empty)

  const load = async () => {
    try {
      const data = await listTransfusions(admissionId)
      const arr = Array.isArray(data) ? data : []
      setRows(arr.map(normalizeRow))
    } catch (e) {
      toast.error(e?.message || 'Failed to load transfusions')
    }
  }

  useEffect(() => {
    if (!admissionId) return
    load()

    // draft restore
    const d = localStorage.getItem(draftKey(admissionId, 'transfusion'))
    if (d) {
      try {
        const parsed = JSON.parse(d)
        setForm({
          ...empty,
          ...parsed,
          pre_vitals: normalizeVitals(parsed?.pre_vitals),
          post_vitals: normalizeVitals(parsed?.post_vitals),
        })
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(admissionId, 'transfusion'), JSON.stringify(form))
    }, 900)
    return () => clearTimeout(t)
  }, [form, admissionId])

  const submit = async () => {
    setSubmitting(true)
    try {
      const payload = {
        component_type: form.component_type,
        bag_number: form.bag_number,
        start_time: form.start_time ? toIso(form.start_time) : undefined,
        end_time: form.end_time ? toIso(form.end_time) : null,

        // ✅ OBJECT (not JSON string)
        pre_vitals: vitalsForPayload(form.pre_vitals),
        post_vitals: vitalsForPayload(form.post_vitals),

        reaction_occurred: !!form.reaction_occurred,
        reaction_notes: form.reaction_notes,
      }

      await createTransfusion(admissionId, payload)

      toast.success('Transfusion saved')
      localStorage.removeItem(draftKey(admissionId, 'transfusion'))
      setForm(empty)
      await load()
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const requestEdit = (row) => {
    pendingUpdateRef.current = async (reason) => {
      try {
        await updateTransfusion(row.id, { ...row, edit_reason: reason })
        toast.success('Updated')
        await load()
      } catch (e) {
        toast.error(e?.message || 'Update failed')
      }
    }
    setEditReasonOpen(true)
  }

  const quickVitals = async (row) => {
    try {
      // ✅ send a complete point (prevents undefined reads)
      const point = {
        at: new Date().toISOString(),
        bp: row?.post_vitals?.bp || row?.pre_vitals?.bp || '120/80',
        bp_sys: row?.post_vitals?.bp_sys || row?.pre_vitals?.bp_sys || '120',
        bp_dia: row?.post_vitals?.bp_dia || row?.pre_vitals?.bp_dia || '80',
        pulse: row?.post_vitals?.pulse || '80',
        temp: row?.post_vitals?.temp || '37.0',
        rr: row?.post_vitals?.rr || '18',
        spo2: row?.post_vitals?.spo2 || '98',
        notes: 'Stable',
      }

      await addTransfusionVital(row.id, { point })
      toast.success('Vitals logged')
      await load()
    } catch (e) {
      toast.error(e?.message || 'Failed to log vitals')
    }
  }

  const flagReaction = async (row) => {
    if (!canReaction) return
    if (!window.confirm('Flag transfusion reaction? This is audit-logged.')) return
    try {
      await markTransfusionReaction(row.id, {
        occurred: true,
        symptoms: ['Fever'],
        notes: 'Flagged from UI',
        at: new Date().toISOString(),
      })
      toast.error('Reaction flagged')
      await load()
    } catch (e) {
      toast.error(e?.message || 'Failed to flag reaction')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  return (
    <>
      <ClinicalRecordWorkspace
        title="Blood Transfusion"
        subtitle="Unit details + vitals + reaction flagging for patient safety."
        patientChips={chips}
        alertsChips={
          alerts?.transfusion_needs_monitoring
            ? [{ label: 'Transfusion monitoring due', className: 'rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100' }]
            : []
        }
        canWrite={canWrite}
        permissionHint="Need ipd.nursing (or ipd.manage) to create transfusion records."
        search={search}
        setSearch={setSearch}
        form={
          <div className="space-y-4">
            <SectionCard title="Unit details" subtitle="Enter component and bag number correctly.">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Component type">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.component_type}
                    onChange={(e) => setForm({ ...form, component_type: e.target.value })}
                    placeholder="e.g., PRBC / FFP / Platelets"
                  />
                </Field>

                <Field label="Bag number">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.bag_number}
                    onChange={(e) => setForm({ ...form, bag_number: e.target.value })}
                    placeholder="Unit/Bag ID"
                  />
                </Field>

                <Field label="Start time">
                  <Input
                    type="datetime-local"
                    className="h-10 rounded-xl"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </Field>

                <Field label="End time (optional)">
                  <Input
                    type="datetime-local"
                    className="h-10 rounded-xl"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </Field>
              </div>
            </SectionCard>

            {/* ✅ Separate inputs → object */}
            <VitalsGrid
              title="Vitals (Pre)"
              value={form.pre_vitals}
              onChange={(v) => setForm({ ...form, pre_vitals: normalizeVitals(v) })}
            />

            <VitalsGrid
              title="Vitals (Post)"
              value={form.post_vitals}
              onChange={(v) => setForm({ ...form, post_vitals: normalizeVitals(v) })}
            />

            <SectionCard title="Reaction" subtitle="Flag reaction with notes (audit).">
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  label="Reaction occurred"
                  checked={!!form.reaction_occurred}
                  onCheckedChange={(v) => setForm({ ...form, reaction_occurred: v })}
                />
                <div />

                <div className="md:col-span-2">
                  <Field label="Reaction notes">
                    <Textarea
                      className="min-h-[92px] rounded-xl"
                      value={form.reaction_notes}
                      onChange={(e) => setForm({ ...form, reaction_notes: e.target.value })}
                      placeholder="Symptoms/actions taken…"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2 hidden md:flex justify-end gap-2">
                  <Button className="rounded-xl" disabled={!canWrite || submitting} onClick={submit}>
                    {submitting ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        }
        history={
          <div className="space-y-3">
            {filtered.length === 0 ? <EmptyState /> : null}

            {filtered.map((r) => {
              const pre = normalizeVitals(r.pre_vitals)
              const post = normalizeVitals(r.post_vitals)
              const points = Array.isArray(r.monitoring_vitals) ? r.monitoring_vitals.filter(Boolean) : []

              return (
                <TimelineCard
                  key={r.id}
                  title={`${r.component_type || 'Transfusion'} • ${r.bag_number || '—'}`}
                  subtitle={`${fmtIST(r.start_time)} → ${r.end_time ? fmtIST(r.end_time) : '—'}`}
                  status={r.reaction_occurred ? 'reaction' : 'completed'}
                  metaLeft={<span>By: {r.created_by_id ?? r.notified_to ?? '—'}</span>}
                  metaRight={
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-zinc-700 hover:underline inline-flex items-center gap-1"
                        onClick={() => quickVitals(r)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Vitals
                      </button>

                      {canReaction ? (
                        <button
                          type="button"
                          className="text-xs text-rose-700 hover:underline inline-flex items-center gap-1"
                          onClick={() => flagReaction(r)}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Reaction
                        </button>
                      ) : null}
                    </span>
                  }
                  canEdit={canEdit}
                  onEdit={() => requestEdit(r)}
                  audit={
                    <AuditRow
                      createdAt={r.created_at || r.start_time}
                      createdBy={r.created_by_id}
                      updatedAt={r.updated_at}
                      updatedBy={r.updated_by_id}
                      editReason={r.edit_reason}
                    />
                  }
                >
                  {/* ✅ Readable summary (no JSON dump) */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-2">Pre vitals</div>
                      <div className="text-sm text-zinc-700">
                        BP: {pre.bp || '—'} • Pulse: {pre.pulse || '—'} • Temp: {pre.temp || '—'} • RR: {pre.rr || '—'} • SpO₂: {pre.spo2 || '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-2">Post vitals</div>
                      <div className="text-sm text-zinc-700">
                        BP: {post.bp || '—'} • Pulse: {post.pulse || '—'} • Temp: {post.temp || '—'} • RR: {post.rr || '—'} • SpO₂: {post.spo2 || '—'}
                      </div>
                    </div>
                  </div>

                  {/* ✅ Monitoring points (safe map) */}
                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] font-semibold text-zinc-600">Monitoring</div>
                    {points.length === 0 ? (
                      <div className="text-xs text-zinc-500">No monitoring vitals logged.</div>
                    ) : (
                      points.map((p, idx) => {
                        const pv = normalizeVitals(p)
                        return (
                          <div key={idx} className="rounded-2xl border bg-white px-3 py-2 text-xs text-zinc-700">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{p?.at ? fmtIST(p.at) : '—'}</span>
                              <span className="text-zinc-500">{pv.notes || ''}</span>
                            </div>
                            <div className="mt-1">
                              BP: {pv.bp || '—'} • Pulse: {pv.pulse || '—'} • Temp: {pv.temp || '—'} • RR: {pv.rr || '—'} • SpO₂: {pv.spo2 || '—'}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </TimelineCard>
              )
            })}
          </div>
        }
      />

      <StickyActionBar
        canWrite={canWrite}
        onDraft={() => {
          localStorage.setItem(draftKey(admissionId, 'transfusion'), JSON.stringify(form))
          toast.success('Draft saved')
        }}
        onSubmit={submit}
        submitting={submitting}
      />

      <EditReasonDialog
        open={editReasonOpen}
        setOpen={setEditReasonOpen}
        title="Update transfusion"
        onConfirm={(reason) => {
          setEditReasonOpen(false)
          pendingUpdateRef.current?.(reason)
        }}
      />
    </>
  )
}
