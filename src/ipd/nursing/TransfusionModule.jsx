// FILE: src/ipd/nursing/TransfusionModule.jsx

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, AlertTriangle, X, Pencil } from 'lucide-react'

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
  const temp = obj.temp ?? obj.temp_c ?? ''
  const rr = obj.rr ?? ''
  const spo2 = obj.spo2 ?? ''

  const fromBp = splitBP(obj.bp)
  const bp_sys = obj.bp_sys ?? obj.bp_systolic ?? fromBp.bp_sys ?? ''
  const bp_dia = obj.bp_dia ?? obj.bp_diastolic ?? fromBp.bp_dia ?? ''
  const bp = bp_sys && bp_dia ? `${bp_sys}/${bp_dia}` : (obj.bp ?? '')

  return {
    bp_sys,
    bp_dia,
    bp,
    pulse,
    temp,
    rr,
    spo2,
    notes: obj.notes ?? '',
  }
}

function vitalsForPayload(v) {
  const vv = normalizeVitals(v)
  return {
    bp: vv.bp || (vv.bp_sys && vv.bp_dia ? `${vv.bp_sys}/${vv.bp_dia}` : ''),
    bp_sys: vv.bp_sys ? Number(vv.bp_sys) : undefined,
    bp_dia: vv.bp_dia ? Number(vv.bp_dia) : undefined,
    bp_systolic: vv.bp_sys ? Number(vv.bp_sys) : undefined,     // compatibility
    bp_diastolic: vv.bp_dia ? Number(vv.bp_dia) : undefined,     // compatibility
    pulse: vv.pulse ? Number(vv.pulse) : undefined,
    temp: vv.temp ? Number(vv.temp) : undefined,
    temp_c: vv.temp ? Number(vv.temp) : undefined,
    rr: vv.rr ? Number(vv.rr) : undefined,
    spo2: vv.spo2 ? Number(vv.spo2) : undefined,
    notes: vv.notes || '',
  }
}

function dtLocalValue(v) {
  if (!v) return ''
  const s = String(v)
  return s.length >= 16 ? s.slice(0, 16) : s
}

function displayUser(u, fallbackId) {
  if (u?.name) return u.name
  if (fallbackId) return `User #${fallbackId}`
  return '—'
}

// ------------------------------
// Vitals Grid
// ------------------------------
function VitalsGrid({ value, onChange, title = 'Vitals' }) {
  const v = normalizeVitals(value)
  const set = (patch) => onChange?.({ ...v, ...patch })

  return (
    <SectionCard title={title} subtitle="Separate fields (safe) — stored in JSON.">
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

  // edit mode
  const [editingId, setEditingId] = useState(null)

  const [editReasonOpen, setEditReasonOpen] = useState(false)
  const pendingUpdateRef = useRef(null)

  const freshEmpty = () => ({
    component_type: '',
    bag_number: '',
    start_time: '',
    end_time: '',
    pre_vitals: normalizeVitals({}),
    post_vitals: normalizeVitals({}),
    reaction_occurred: false,
    reaction_notes: '',
  })

  const [form, setForm] = useState(freshEmpty())

  const normalizeRow = (r) => {
    const unit = safeJson(r?.unit, {}) || {}
    const admin = safeJson(r?.administration, {}) || {}
    const baseline = safeJson(r?.baseline_vitals, {}) || {}
    const endVitals = safeJson(admin?.end_vitals, {}) || {}

    const mv = safeJson(r?.monitoring_vitals, [])
    const monitoring_vitals = Array.isArray(mv)
      ? mv.filter(Boolean).map((p) => {
        const point = typeof p === 'object' ? p : safeJson(p, {})
        return {
          at: point?.at || point?.time || null,
          ...normalizeVitals(point),
          notes: point?.notes ?? '',
        }
      })
      : []

    const reaction = safeJson(r?.reaction, {}) || {}

    return {
      ...r,
      unit,
      administration: admin,
      baseline_vitals: baseline,
      monitoring_vitals,

      // UI-friendly mirrors:
      component_type: unit?.component_type ?? '',
      bag_number: unit?.bag_number ?? '',
      start_time: admin?.start_time ?? null,
      end_time: admin?.end_time ?? null,
      pre_vitals: normalizeVitals(baseline),
      post_vitals: normalizeVitals(endVitals),
      reaction_occurred: !!reaction?.occurred,
      reaction_notes: reaction?.notes ?? '',
    }
  }

  const load = async () => {
    try {
      const data = await listTransfusions(admissionId)
      const arr = Array.isArray(data) ? data : (data?.items || data?.results || [])
      setRows(arr.map(normalizeRow))
    } catch (e) {
      toast.error(e?.message || 'Failed to load transfusions')
    }
  }

  useEffect(() => {
    if (!admissionId) return
    load()

    const d = localStorage.getItem(draftKey(admissionId, 'transfusion'))
    if (d) {
      try {
        const parsed = JSON.parse(d)
        setForm({
          ...freshEmpty(),
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

  const clearEdit = () => {
    setEditingId(null)
    setForm(freshEmpty())
    localStorage.removeItem(draftKey(admissionId, 'transfusion'))
  }

  const buildCreatePayload = () => ({
    unit: {
      component_type: form.component_type,
      bag_number: form.bag_number,
    },
    administration: {
      start_time: form.start_time ? toIso(form.start_time) : undefined,
      end_time: form.end_time ? toIso(form.end_time) : null,
      // ✅ store “post” vitals inside administration JSON (no DB migration needed)
      end_vitals: vitalsForPayload(form.post_vitals),
    },
    baseline_vitals: vitalsForPayload(form.pre_vitals),
    reaction: form.reaction_occurred
      ? { occurred: true, notes: form.reaction_notes || '' }
      : {},
  })

  const buildUpdatePayload = (reason) => ({
    edit_reason: reason,
    unit: {
      component_type: form.component_type,
      bag_number: form.bag_number,
    },
    administration: {
      start_time: form.start_time ? toIso(form.start_time) : undefined,
      end_time: form.end_time ? toIso(form.end_time) : null,
      end_vitals: vitalsForPayload(form.post_vitals),
    },
    baseline_vitals: vitalsForPayload(form.pre_vitals),
  })

  const submitCreate = async () => {
    setSubmitting(true)
    try {
      await createTransfusion(admissionId, buildCreatePayload())
      toast.success('Transfusion saved')
      clearEdit()
      await load()
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const requestUpdate = () => {
    pendingUpdateRef.current = async (reason) => {
      try {
        await updateTransfusion(editingId, buildUpdatePayload(reason))
        toast.success('Updated')
        clearEdit()
        await load()
      } catch (e) {
        toast.error(e?.message || 'Update failed')
      }
    }
    setEditReasonOpen(true)
  }

  const startEditFromRow = (r) => {
    if (!canEdit) return
    setEditingId(r.id)
    setForm({
      component_type: r.component_type || '',
      bag_number: r.bag_number || '',
      start_time: dtLocalValue(r.start_time || r?.administration?.start_time),
      end_time: dtLocalValue(r.end_time || r?.administration?.end_time),
      pre_vitals: normalizeVitals(r.pre_vitals || r?.baseline_vitals),
      post_vitals: normalizeVitals(r.post_vitals || r?.administration?.end_vitals),
      reaction_occurred: !!(r?.reaction?.occurred),
      reaction_notes: r?.reaction?.notes || '',
    })
    toast.message('Edit mode enabled — update values and click “Update”.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const quickVitals = async (row) => {
    try {
      const pre = normalizeVitals(row.pre_vitals || row?.baseline_vitals)
      const point = {
        at: new Date().toISOString(),
        bp: pre.bp || '120/80',
        bp_sys: pre.bp_sys ? Number(pre.bp_sys) : 120,
        bp_dia: pre.bp_dia ? Number(pre.bp_dia) : 80,
        pulse: pre.pulse ? Number(pre.pulse) : 80,
        temp: pre.temp ? Number(pre.temp) : 37.0,
        rr: pre.rr ? Number(pre.rr) : 18,
        spo2: pre.spo2 ? Number(pre.spo2) : 98,
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
        started_at: new Date().toISOString(), // ✅ backend expects started_at
        symptoms: ['Fever'],
        actions_taken: 'Flagged from UI',
        notes: 'Flagged from UI',
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
        subtitle="Unit details + baseline/monitoring vitals + reaction flagging (NABH patient safety)."
        patientChips={chips}
        alertsChips={
          alerts?.transfusion_needs_monitoring
            ? [{ label: 'Transfusion monitoring due', className: 'rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100' }]
            : []
        }
        canWrite={canWrite}
        permissionHint="Need ipd.transfusion.create or ipd.nursing.create (or ipd.manage)."
        search={search}
        setSearch={setSearch}
        form={
          <div className="space-y-4">
            {/* ✅ clear edit banner */}
            {editingId ? (
              <div className="rounded-2xl border bg-amber-50 p-3 flex items-center justify-between">
                <div className="text-sm text-amber-900 flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Editing record #{editingId}
                </div>
                <Button variant="outline" className="rounded-xl" onClick={clearEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel edit
                </Button>
              </div>
            ) : null}

            <SectionCard title="Unit details" subtitle="Component + bag number must match blood bank label.">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Component type">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.component_type}
                    onChange={(e) => setForm({ ...form, component_type: e.target.value })}
                    placeholder="PRBC / FFP / Platelets"
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

            <VitalsGrid
              title="Baseline vitals (Pre)"
              value={form.pre_vitals}
              onChange={(v) => setForm({ ...form, pre_vitals: normalizeVitals(v) })}
            />

            <VitalsGrid
              title="Completion vitals (Post)"
              value={form.post_vitals}
              onChange={(v) => setForm({ ...form, post_vitals: normalizeVitals(v) })}
            />

            <SectionCard title="Reaction (optional)" subtitle="Use only when reaction occurred. Otherwise keep off.">
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
                  {!editingId ? (
                    <Button className="rounded-xl" disabled={!canWrite || submitting} onClick={submitCreate}>
                      {submitting ? 'Saving…' : 'Save'}
                    </Button>
                  ) : (
                    <Button className="rounded-xl" disabled={!canEdit || submitting} onClick={requestUpdate}>
                      {submitting ? 'Updating…' : 'Update'}
                    </Button>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>
        }
        history={
          <div className="space-y-3">
            {filtered.length === 0 ? <EmptyState /> : null}

            {filtered.map((r) => {
              const pre = normalizeVitals(r.pre_vitals || r?.baseline_vitals)
              const post = normalizeVitals(r.post_vitals || r?.administration?.end_vitals)
              const points = Array.isArray(r.monitoring_vitals) ? r.monitoring_vitals.filter(Boolean) : []

              const createdByName = displayUser(r.created_by, r.created_by_id)
              const updatedByName = displayUser(r.updated_by, r.updated_by_id)

              return (
                <TimelineCard
                  key={r.id}
                  title={`${r.component_type || 'Transfusion'} • ${r.bag_number || '—'}`}
                  subtitle={`${r.start_time ? fmtIST(r.start_time) : '—'} → ${r.end_time ? fmtIST(r.end_time) : '—'}`}
                  status={r.reaction_occurred ? 'reaction' : r.status || 'completed'}
                  metaLeft={
                    <span className="text-zinc-700">
                      Created by: <span className="font-medium">{createdByName}</span>
                      {r.created_at ? <span className="text-zinc-500"> • {fmtIST(r.created_at)}</span> : null}
                    </span>
                  }
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
                  onEdit={() => startEditFromRow(r)}
                  audit={
                    <AuditRow
                      createdAt={r.created_at || r.start_time}
                      createdBy={createdByName}
                      updatedAt={r.updated_at}
                      updatedBy={r.updated_at ? updatedByName : null}
                      editReason={r.edit_reason}
                    />
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-2">Baseline vitals (Pre)</div>
                      <div className="text-sm text-zinc-700">
                        BP: {pre.bp || '—'} • Pulse: {pre.pulse || '—'} • Temp: {pre.temp || '—'} • RR: {pre.rr || '—'} • SpO₂: {pre.spo2 || '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-[11px] font-semibold text-zinc-600 mb-2">Completion vitals (Post)</div>
                      <div className="text-sm text-zinc-700">
                        BP: {post.bp || '—'} • Pulse: {post.pulse || '—'} • Temp: {post.temp || '—'} • RR: {post.rr || '—'} • SpO₂: {post.spo2 || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] font-semibold text-zinc-600">Monitoring points</div>
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
        onSubmit={() => {
          if (editingId) requestUpdate()
          else submitCreate()
        }}
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
