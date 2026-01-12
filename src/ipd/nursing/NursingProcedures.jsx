// FILE: frontend/src/ipd/nursing/NursingProcedures.jsx

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  Plus,
  RefreshCcw,
  AlertTriangle,
  Droplets,
  Shield,
  Bandage,
  HeartPulse,
  Hand,
  X,
} from 'lucide-react'

import { useCanAny } from '../../hooks/useCan'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

import ClinicalRecordWorkspace from './ui/ClinicalRecordWorkspace'
import { SectionCard, TimelineCard, StickyActionBar, EditReasonDialog, AuditRow } from './ui/SharedPieces'
import { fmtIST, toIso, toLocalInput, toIntOrNull, userLabel } from './ui/utils'

import {
  getNursingAlerts,
  listDressing,
  createDressing,
  updateDressing,

  listIcuFlow,
  createIcuFlow,
  updateIcuFlow,

  listIsolation,
  createIsolation,
  updateIsolation,
  stopIsolation,

  listRestraints,
  createRestraint,
  updateRestraint,
  stopRestraint,
  addRestraintMonitor,
} from '../../api/ipdNursing'

import TransfusionModule from './TransfusionModule'
import { formatIST } from '../components/timeZONE'

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

const pick = (obj, keys) => {
  const out = {}
  keys.forEach((k) => {
    if (obj?.[k] !== undefined) out[k] = obj[k]
  })
  return out
}

export default function NursingProcedures({
  admissionId,
  embedded = true,
  admissionLabel = 'Admission',
  patientLabel = 'Patient',
  bedLabel = 'Ward/Bed',
}) {
  const canView = useCanAny(['ipd.view', 'ipd.manage', 'ipd.nursing', 'ipd.doctor'])

  const canDressingWrite = useCanAny(['ipd.dressing.create', 'ipd.nursing.create', 'ipd.manage'])
  const canDressingEdit = useCanAny(['ipd.dressing.update', 'ipd.manage'])

  const canIcuWrite = useCanAny(['ipd.icu.create', 'ipd.nursing.create', 'ipd.doctor', 'ipd.manage'])
  const canIcuEdit = useCanAny(['ipd.icu.update', 'ipd.manage'])

  const canIsolationWrite = useCanAny(['ipd.isolation.create', 'ipd.doctor', 'ipd.manage'])
  const canIsolationEdit = useCanAny(['ipd.isolation.update', 'ipd.manage'])
  const canIsolationStop = useCanAny(['ipd.isolation.stop', 'ipd.doctor', 'ipd.manage'])

  const canRestraintWrite = useCanAny(['ipd.restraints.create', 'ipd.doctor', 'ipd.manage'])
  const canRestraintEdit = useCanAny(['ipd.restraints.update', 'ipd.manage'])
  const canRestraintStop = useCanAny(['ipd.restraints.stop', 'ipd.doctor', 'ipd.manage'])
  const canRestraintMonitor = useCanAny(['ipd.restraints.monitor', 'ipd.nursing.create', 'ipd.manage'])

  const canTransfusionWrite = useCanAny(['ipd.transfusion.create', 'ipd.nursing.create', 'ipd.manage'])
  const canTransfusionEdit = useCanAny(['ipd.transfusion.update', 'ipd.manage'])
  const canTransfusionReaction = useCanAny(['ipd.transfusion.reaction', 'ipd.transfusion.update', 'ipd.doctor', 'ipd.manage'])

  const [alerts, setAlerts] = useState(null)

  const loadAlerts = async () => {
    try {
      const data = await getNursingAlerts(admissionId)
      setAlerts(data)
    } catch {
      // ignore if endpoint not available
    }
  }

  useEffect(() => {
    if (!admissionId) return
    loadAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  if (!canView) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-rose-700">Access denied.</div>
  }

  const outerClass = embedded ? 'p-0 bg-transparent' : 'bg-[#F7F6F3] p-4 md:p-6'

  return (
    <div className={outerClass}>
      <Tabs defaultValue="dressing" className="w-full">
        <div className="mb-4 flex items-center justify-between gap-3">
          <TabsList className="rounded-2xl bg-white border shadow-sm p-1">
            <TabsTrigger className="rounded-xl" value="dressing">
              <Bandage className="h-4 w-4 mr-2" /> Dressing
            </TabsTrigger>
            <TabsTrigger className="rounded-xl" value="icu">
              <HeartPulse className="h-4 w-4 mr-2" /> ICU Flow
            </TabsTrigger>
            <TabsTrigger className="rounded-xl" value="isolation">
              <Shield className="h-4 w-4 mr-2" /> Isolation
            </TabsTrigger>
            <TabsTrigger className="rounded-xl" value="restraint">
              <Hand className="h-4 w-4 mr-2" /> Restraint
            </TabsTrigger>
            <TabsTrigger className="rounded-xl" value="transfusion">
              <Droplets className="h-4 w-4 mr-2" /> Transfusion
            </TabsTrigger>
          </TabsList>

          <Button variant="outline" className="rounded-xl" onClick={loadAlerts}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <TabsContent value="dressing" className="mt-0">
          <DressingModule
            admissionId={admissionId}
            chips={[admissionLabel, patientLabel, bedLabel]}
            alerts={alerts}
            canWrite={canDressingWrite}
            canEdit={canDressingEdit}
          />
        </TabsContent>

        <TabsContent value="icu" className="mt-0">
          <IcuModule
            admissionId={admissionId}
            chips={[admissionLabel, patientLabel, bedLabel]}
            alerts={alerts}
            canWrite={canIcuWrite}
            canEdit={canIcuEdit}
          />
        </TabsContent>

        <TabsContent value="isolation" className="mt-0">
          <IsolationModule
            admissionId={admissionId}
            chips={[admissionLabel, patientLabel, bedLabel]}
            alerts={alerts}
            canWrite={canIsolationWrite}
            canEdit={canIsolationEdit}
            canStop={canIsolationStop}
          />
        </TabsContent>

        <TabsContent value="restraint" className="mt-0">
          <RestraintModule
            admissionId={admissionId}
            chips={[admissionLabel, patientLabel, bedLabel]}
            alerts={alerts}
            canWrite={canRestraintWrite}
            canEdit={canRestraintEdit}
            canStop={canRestraintStop}
            canMonitor={canRestraintMonitor}
          />
        </TabsContent>

        <TabsContent value="transfusion" className="mt-0">
          <TransfusionModule
            admissionId={admissionId}
            chips={[admissionLabel, patientLabel, bedLabel]}
            alerts={alerts}
            canWrite={canTransfusionWrite}
            canEdit={canTransfusionEdit}
            canReaction={canTransfusionReaction}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* =====================================================================================
   DRESSING (matches backend: performed_at, asepsis, assessment, procedure)
===================================================================================== */
function DressingModule({ admissionId, chips, alerts, canWrite, canEdit }) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState(null)

  const [editReasonOpen, setEditReasonOpen] = useState(false)
  const pendingUpdateRef = useRef(null)

  const empty = {
    performed_at: '',
    wound_site: '',
    dressing_type: '',
    indication: '',
    findings: '',
    pain_score: '',
    patient_response: '',
    asepsis: {
      hand_hygiene: true,
      sterile_gloves: true,
      sterile_field: true,
      mask: false,
    },
    next_dressing_due: '',
  }

  const [form, setForm] = useState(empty)

  const alertsChips = useMemo(() => {
    const out = []
    if (alerts?.dressing_overdue) {
      out.push({
        label: 'Dressing overdue',
        className: 'rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100',
      })
    }
    if (alerts?.dressing_next_due_at) {
      out.push({
        label: `Next due: ${fmtIST(alerts.dressing_next_due_at)}`,
        className: 'rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100',
      })
    }
    return out
  }, [alerts])

  const load = async () => {
    setLoading(true)
    try {
      const data = await listDressing(admissionId)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load dressing')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!admissionId) return
    load()
    const d = localStorage.getItem(draftKey(admissionId, 'dressing'))
    if (d) {
      try {
        setForm(JSON.parse(d))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(admissionId, 'dressing'), JSON.stringify(form))
    }, 900)
    return () => clearTimeout(t)
  }, [form, admissionId])

  const mapPayload = () => ({
    performed_at: form.performed_at ? toIso(form.performed_at) : undefined,
    wound_site: form.wound_site || '',
    dressing_type: form.dressing_type || '',
    indication: form.indication || '',
    // IMPORTANT: keep objects (backend expects models)
    assessment: { notes: form.findings || '' },
    procedure: { notes: '' },
    asepsis: form.asepsis || {},
    pain_score: toIntOrNull(form.pain_score),
    patient_response: form.patient_response || '',
    findings: form.findings || '',
    next_dressing_due: form.next_dressing_due ? toIso(form.next_dressing_due) : null,
  })

  const createOrUpdate = async () => {
    if (!canWrite && !editingId) return

    // update requires edit reason
    if (editingId) {
      pendingUpdateRef.current = async (reason) => {
        try {
          await updateDressing(editingId, { ...mapPayload(), edit_reason: reason })
          toast.success('Updated')
          setEditingId(null)
          localStorage.removeItem(draftKey(admissionId, 'dressing'))
          setForm(empty)
          await load()
        } catch (e) {
          toast.error(e?.message || 'Update failed')
        }
      }
      setEditReasonOpen(true)
      return
    }

    setSubmitting(true)
    try {
      await createDressing(admissionId, mapPayload())
      toast.success('Dressing saved')
      localStorage.removeItem(draftKey(admissionId, 'dressing'))
      setForm(empty)
      await load()
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setForm({
      ...empty,
      performed_at: toLocalInput(row.performed_at || row.created_at),
      wound_site: row.wound_site || '',
      dressing_type: row.dressing_type || '',
      indication: row.indication || '',
      findings: row.findings || '',
      pain_score: row.pain_score ?? '',
      patient_response: row.patient_response || '',
      asepsis: row.asepsis || empty.asepsis,
      next_dressing_due: toLocalInput(row.next_dressing_due),
    })
    toast.message('Editing record')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(empty)
    toast.message('Edit cancelled')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  return (
    <>
      <ClinicalRecordWorkspace
        title="Dressing"
        subtitle="Wound care entry with asepsis checklist and audit-ready history."
        patientChips={chips}
        alertsChips={alertsChips}
        canWrite={canWrite}
        permissionHint="Need ipd.dressing.create / ipd.nursing.create (or ipd.manage) to add."
        search={search}
        setSearch={setSearch}
        form={
          <div className="space-y-4">
            <SectionCard
              title={editingId ? 'Edit dressing record' : 'New dressing record'}
              subtitle="Short, structured clinical entry."
              right={
                editingId ? (
                  <Button variant="outline" className="rounded-xl" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" /> Cancel edit
                  </Button>
                ) : null
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Performed at">
                  <div className="relative">
                    <CalendarClock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="datetime-local"
                      className="h-10 rounded-xl pl-9"
                      value={form.performed_at}
                      onChange={(e) => setForm({ ...form, performed_at: e.target.value })}
                    />
                  </div>
                </Field>

                <Field label="Next dressing due" hint="Used for reminders and nursing planning.">
                  <div className="relative">
                    <CalendarClock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="datetime-local"
                      className="h-10 rounded-xl pl-9"
                      value={form.next_dressing_due}
                      onChange={(e) => setForm({ ...form, next_dressing_due: e.target.value })}
                    />
                  </div>
                </Field>

                <Field label="Wound site *">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.wound_site}
                    onChange={(e) => setForm({ ...form, wound_site: e.target.value })}
                    placeholder="e.g., Right leg"
                  />
                </Field>

                <Field label="Dressing type">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.dressing_type}
                    onChange={(e) => setForm({ ...form, dressing_type: e.target.value })}
                    placeholder="e.g., Sterile gauze"
                  />
                </Field>

                <Field label="Indication">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.indication}
                    onChange={(e) => setForm({ ...form, indication: e.target.value })}
                    placeholder="e.g., Post-op wound"
                  />
                </Field>

                <Field label="Pain score (0–10)">
                  <Input
                    className="h-10 rounded-xl"
                    inputMode="numeric"
                    value={form.pain_score}
                    onChange={(e) => setForm({ ...form, pain_score: e.target.value })}
                    placeholder="0–10"
                  />
                </Field>

                <Field label="Patient response">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.patient_response}
                    onChange={(e) => setForm({ ...form, patient_response: e.target.value })}
                    placeholder="e.g., Tolerated well"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Findings / notes">
                    <Textarea
                      className="min-h-[92px] rounded-xl"
                      value={form.findings}
                      onChange={(e) => setForm({ ...form, findings: e.target.value })}
                      placeholder="Exudate, odor, infection signs…"
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Asepsis checklist" subtitle="Visible in audit (do not hide).">
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  label="Hand hygiene"
                  checked={form.asepsis.hand_hygiene}
                  onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, hand_hygiene: v } })}
                />
                <ToggleRow
                  label="Sterile gloves"
                  checked={form.asepsis.sterile_gloves}
                  onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, sterile_gloves: v } })}
                />
                <ToggleRow
                  label="Sterile field"
                  checked={form.asepsis.sterile_field}
                  onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, sterile_field: v } })}
                />
                <ToggleRow
                  label="Mask"
                  checked={form.asepsis.mask}
                  onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, mask: v } })}
                />
              </div>

              <div className="mt-3 hidden md:flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    localStorage.setItem(draftKey(admissionId, 'dressing'), JSON.stringify(form))
                    toast.success('Draft saved')
                  }}
                >
                  Save draft
                </Button>
                <Button className="rounded-xl" disabled={submitting || (!canWrite && !editingId)} onClick={createOrUpdate}>
                  {submitting ? 'Saving…' : editingId ? 'Update' : 'Save'}
                </Button>
              </div>
            </SectionCard>
          </div>
        }
        history={
          <div className="space-y-3">
            {!loading && filtered.length === 0 ? <EmptyState /> : null}

            {filtered.map((r) => (
              <TimelineCard
                key={r.id}
                title={r.wound_site || 'Dressing'}
                subtitle={`${r.dressing_type || '—'} • ${fmtIST(r.performed_at || r.created_at)}`}
                status="done"
                metaLeft={<span>By: {userLabel(r.performed_by, r.performed_by_id)}</span>}
                metaRight={
                  r.next_dressing_due ? (
                    <span className="text-amber-700">Next: {fmtIST(r.next_dressing_due)}</span>
                  ) : (
                    <span />
                  )
                }
                canEdit={canEdit}
                onEdit={() => startEdit(r)}
                audit={
                  <AuditRow
                    createdAt={fmtIST(r.created_at) || fmtIST(r.performed_at)}
                    createdBy={userLabel(r.performed_by, r.performed_by_id)}
                    updatedAt={r.updated_at}
                    updatedBy={userLabel(r.updated_by, r.updated_by_id)}
                    editReason={r.edit_reason}
                  />
                }
              >
                <div className="text-sm text-zinc-700 whitespace-pre-wrap">{r.findings || '—'}</div>
              </TimelineCard>
            ))}
          </div>
        }
      />

      <StickyActionBar
        canWrite={canWrite || !!editingId}
        onDraft={() => {
          localStorage.setItem(draftKey(admissionId, 'dressing'), JSON.stringify(form))
          toast.success('Draft saved')
        }}
        onSubmit={createOrUpdate}
        submitting={submitting}
        submitLabel={editingId ? 'Update' : 'Save'}
      />

      <EditReasonDialog
        open={editReasonOpen}
        setOpen={setEditReasonOpen}
        title="Update dressing record"
        onConfirm={(reason) => {
          setEditReasonOpen(false)
          pendingUpdateRef.current?.(reason)
        }}
      />
    </>
  )
}

/* =====================================================================================
   ICU FLOW (matches backend: recorded_at, vitals, ventilator, infusions(list))
===================================================================================== */
function IcuModule({ admissionId, chips, alerts, canWrite, canEdit }) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editReasonOpen, setEditReasonOpen] = useState(false)
  const pendingUpdateRef = useRef(null)

  const empty = {
    recorded_at: '',
    shift: 'morning',
    vitals: { bp: '', pulse: '', temp: '', rr: '', spo2: '' },
    ventilator: { mode: '', fio2: '', peep: '' },
    infusions_text: '',
    gcs_score: '',
    urine_output_ml: '',
    notes: '',
  }
  const [form, setForm] = useState(empty)

  const load = async () => {
    try {
      const data = await listIcuFlow(admissionId)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load ICU flow')
    }
  }

  useEffect(() => {
    if (!admissionId) return
    load()

    const d = localStorage.getItem(draftKey(admissionId, 'icu'))
    if (d) {
      try {
        setForm(JSON.parse(d))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(admissionId, 'icu'), JSON.stringify(form))
    }, 900)
    return () => clearTimeout(t)
  }, [form, admissionId])

  const mapPayload = () => {
    const txt = (form.infusions_text || '').trim()
    const infusions = txt ? [{ text: txt }] : []

    return {
      recorded_at: form.recorded_at ? toIso(form.recorded_at) : undefined,
      shift: form.shift || null,
      vitals: form.vitals || {},
      ventilator: form.ventilator || {},
      infusions,
      gcs_score: toIntOrNull(form.gcs_score),
      urine_output_ml: toIntOrNull(form.urine_output_ml),
      notes: form.notes || '',
    }
  }

  const createOrUpdate = async () => {
    if (editingId) {
      pendingUpdateRef.current = async (reason) => {
        try {
          await updateIcuFlow(editingId, { ...mapPayload(), edit_reason: reason })
          toast.success('Updated')
          setEditingId(null)
          localStorage.removeItem(draftKey(admissionId, 'icu'))
          setForm(empty)
          await load()
        } catch (e) {
          toast.error(e?.message || 'Update failed')
        }
      }
      setEditReasonOpen(true)
      return
    }

    setSubmitting(true)
    try {
      await createIcuFlow(admissionId, mapPayload())
      toast.success('ICU flow saved')
      localStorage.removeItem(draftKey(admissionId, 'icu'))
      setForm(empty)
      await load()
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (row) => {
    const infTxt = Array.isArray(row?.infusions)
      ? row.infusions.map((x) => x?.text || '').filter(Boolean).join(', ')
      : ''

    setEditingId(row.id)
    setForm({
      ...empty,
      recorded_at: toLocalInput(row.recorded_at || row.created_at),
      shift: row.shift || 'morning',
      vitals: row.vitals || empty.vitals,
      ventilator: row.ventilator || empty.ventilator,
      infusions_text: infTxt,
      gcs_score: row.gcs_score ?? '',
      urine_output_ml: row.urine_output_ml ?? '',
      notes: row.notes || '',
    })
    toast.message('Editing ICU entry')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(empty)
    toast.message('Edit cancelled')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  return (
    <>
      <ClinicalRecordWorkspace
        title="ICU Flow Sheet"
        subtitle="Vitals + ventilator + infusions with time-stamped entries."
        patientChips={chips}
        alertsChips={
          alerts?.icu_chart_overdue
            ? [{ label: 'ICU chart overdue', className: 'rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100' }]
            : []
        }
        canWrite={canWrite}
        permissionHint="Need ipd.icu.create (or ipd.manage) to add ICU flow."
        search={search}
        setSearch={setSearch}
        form={
          <div className="space-y-4">
            <SectionCard
              title={editingId ? 'Edit ICU flow entry' : 'New ICU flow entry'}
              subtitle="Fast entry for rounds and ICU monitoring."
              right={
                editingId ? (
                  <Button variant="outline" className="rounded-xl" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" /> Cancel edit
                  </Button>
                ) : null
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Recorded at">
                  <div className="relative">
                    <CalendarClock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="datetime-local"
                      className="h-10 rounded-xl pl-9"
                      value={form.recorded_at}
                      onChange={(e) => setForm({ ...form, recorded_at: e.target.value })}
                    />
                  </div>
                </Field>

                <Field label="Shift">
                  <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Vitals" subtitle="BP / Pulse / Temp / RR / SpO₂">
              <div className="grid gap-3 md:grid-cols-3">
                {['bp', 'pulse', 'temp', 'rr', 'spo2'].map((k) => (
                  <Field key={k} label={k.toUpperCase()}>
                    <Input
                      className="h-10 rounded-xl"
                      value={form.vitals[k]}
                      onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, [k]: e.target.value } })}
                      placeholder={k === 'bp' ? '120/80' : ''}
                    />
                  </Field>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Ventilator" subtitle="Only fill if applicable.">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Mode">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.ventilator.mode}
                    onChange={(e) => setForm({ ...form, ventilator: { ...form.ventilator, mode: e.target.value } })}
                  />
                </Field>
                <Field label="FiO₂ (%)">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.ventilator.fio2}
                    onChange={(e) => setForm({ ...form, ventilator: { ...form.ventilator, fio2: e.target.value } })}
                  />
                </Field>
                <Field label="PEEP">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.ventilator.peep}
                    onChange={(e) => setForm({ ...form, ventilator: { ...form.ventilator, peep: e.target.value } })}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Infusions & Notes" subtitle="For quick clinical context.">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Infusions (text)">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.infusions_text}
                    onChange={(e) => setForm({ ...form, infusions_text: e.target.value })}
                    placeholder="e.g., Noradrenaline 2 ml/hr"
                  />
                </Field>

                <Field label="GCS / Urine Output">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      className="h-10 rounded-xl"
                      value={form.gcs_score}
                      onChange={(e) => setForm({ ...form, gcs_score: e.target.value })}
                      placeholder="GCS"
                    />
                    <Input
                      className="h-10 rounded-xl"
                      value={form.urine_output_ml}
                      onChange={(e) => setForm({ ...form, urine_output_ml: e.target.value })}
                      placeholder="UO (ml)"
                    />
                  </div>
                </Field>

                <div className="md:col-span-2">
                  <Field label="Notes">
                    <Textarea
                      className="min-h-[92px] rounded-xl"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="md:col-span-2 hidden md:flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      localStorage.setItem(draftKey(admissionId, 'icu'), JSON.stringify(form))
                      toast.success('Draft saved')
                    }}
                  >
                    Save draft
                  </Button>
                  <Button
                    className="rounded-xl"
                    disabled={submitting || (!canWrite && !editingId)}
                    onClick={createOrUpdate}
                  >
                    {submitting ? 'Saving…' : editingId ? 'Update' : 'Save'}
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
              const vit = r?.vitals || {}
              const vent = r?.ventilator || {}
              const infTxt = Array.isArray(r?.infusions)
                ? r.infusions.map((x) => x?.text || '').filter(Boolean).join(', ')
                : ''

              return (
                <TimelineCard
                  key={r.id}
                  title={`ICU Flow • ${fmtIST(r.recorded_at)}`}
                  subtitle={`Shift: ${r.shift || '—'}`}
                  status="done"
                  metaLeft={<span>By: {userLabel(r.recorded_by, r.recorded_by_id)}</span>}
                  metaRight={<span />}
                  canEdit={canEdit}
                  onEdit={() => startEdit(r)}
                  audit={
                    <AuditRow
                      createdAt={r.created_at || formatIST(r.recorded_at)}
                      createdBy={userLabel(r.recorded_by, r.recorded_by_id)}
                      updatedAt={fmtIST(r.updated_at)}
                      updatedBy={userLabel(r.updated_by, r.updated_by_id)}
                      editReason={r.edit_reason}
                    />
                  }
                >
                  <div className="grid gap-2 text-sm text-zinc-700">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {['bp', 'pulse', 'temp', 'rr', 'spo2'].map((k) => (
                        <div key={k} className="rounded-xl border bg-white px-3 py-2">
                          <div className="text-[11px] text-zinc-500">{k.toUpperCase()}</div>
                          <div className="font-medium">{vit?.[k] || '—'}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <div className="text-[11px] text-zinc-500">Mode</div>
                        <div className="font-medium">{vent?.mode || '—'}</div>
                      </div>
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <div className="text-[11px] text-zinc-500">FiO₂</div>
                        <div className="font-medium">{vent?.fio2 || '—'}</div>
                      </div>
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <div className="text-[11px] text-zinc-500">PEEP</div>
                        <div className="font-medium">{vent?.peep || '—'}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-zinc-50 p-3">
                      <div>
                        <span className="font-medium">Infusions:</span> {infTxt || '—'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3">
                        <div>
                          <span className="font-medium">GCS:</span> {r?.gcs_score ?? '—'}
                        </div>
                        <div>
                          <span className="font-medium">Urine:</span> {r?.urine_output_ml ?? '—'} ml
                        </div>
                      </div>
                    </div>

                    {r?.notes ? (
                      <div className="whitespace-pre-wrap rounded-xl border bg-white p-3">{r.notes}</div>
                    ) : null}
                  </div>
                </TimelineCard>
              )
            })}
          </div>
        }
      />

      <StickyActionBar
        canWrite={canWrite || !!editingId}
        onDraft={() => {
          localStorage.setItem(draftKey(admissionId, 'icu'), JSON.stringify(form))
          toast.success('Draft saved')
        }}
        onSubmit={createOrUpdate}
        submitting={submitting}
        submitLabel={editingId ? 'Update' : 'Save'}
      />

      <EditReasonDialog
        open={editReasonOpen}
        setOpen={setEditReasonOpen}
        title="Update ICU flow entry"
        onConfirm={(reason) => {
          setEditReasonOpen(false)
          pendingUpdateRef.current?.(reason)
        }}
      />
    </>
  )
}

/* =====================================================================================
   ISOLATION (matches backend: precaution_type, measures(dict), started_at, review_due_at)
===================================================================================== */
function IsolationModule({ admissionId, chips, alerts, canWrite, canEdit, canStop }) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editReasonOpen, setEditReasonOpen] = useState(false)
  const pendingUpdateRef = useRef(null)

  const empty = {
    precaution_type: 'contact',
    indication: '',
    started_at: '',
    ended_at: '',
    review_due_at: '',
    measures_ui: {
      ppe: { gloves: true, gown: false, mask: false, n95: false, face_shield: false },
      signage: true,
      dedicated_equipment: true,
      visitor_restriction: false,
      hand_hygiene: true,
      cleaning_protocol: true,
      waste_disposal: true,
      room: '',
      notes: '',
    },
  }

  const [form, setForm] = useState(empty)

  const load = async () => {
    try {
      const data = await listIsolation(admissionId)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load isolation')
    }
  }

  useEffect(() => {
    if (!admissionId) return
    load()

    const d = localStorage.getItem(draftKey(admissionId, 'isolation'))
    if (d) {
      try {
        const parsed = JSON.parse(d)
        setForm({
          ...empty,
          ...parsed,
          measures_ui: parsed.measures_ui ? parsed.measures_ui : empty.measures_ui,
        })
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(admissionId, 'isolation'), JSON.stringify(form))
    }, 900)
    return () => clearTimeout(t)
  }, [form, admissionId])

  const buildMeasuresDict = (ui) => {
    const out = {
      ppe: ui.ppe || {},
      signage: !!ui.signage,
      dedicated_equipment: !!ui.dedicated_equipment,
      visitor_restriction: !!ui.visitor_restriction,
      hand_hygiene: !!ui.hand_hygiene,
      cleaning_protocol: !!ui.cleaning_protocol,
      waste_disposal: !!ui.waste_disposal,
    }
    if ((ui.room || '').trim()) out.room = ui.room.trim()
    if ((ui.notes || '').trim()) out.notes = ui.notes.trim()
    return out
  }

  const mapPayload = () => ({
    precaution_type: form.precaution_type,
    indication: form.indication || '',
    measures: buildMeasuresDict(form.measures_ui),
    review_due_at: form.review_due_at ? toIso(form.review_due_at) : null,
    started_at: form.started_at ? toIso(form.started_at) : undefined,
    ended_at: form.ended_at ? toIso(form.ended_at) : null,
  })

  const createOrUpdate = async () => {
    if (editingId) {
      pendingUpdateRef.current = async (reason) => {
        try {
          await updateIsolation(editingId, { ...mapPayload(), edit_reason: reason })
          toast.success('Updated')
          setEditingId(null)
          localStorage.removeItem(draftKey(admissionId, 'isolation'))
          setForm(empty)
          await load()
        } catch (e) {
          toast.error(e?.message || 'Update failed')
        }
      }
      setEditReasonOpen(true)
      return
    }

    setSubmitting(true)
    try {
      await createIsolation(admissionId, mapPayload())
      toast.success('Isolation saved')
      localStorage.removeItem(draftKey(admissionId, 'isolation'))
      setForm(empty)
      await load()
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setForm({
      ...empty,
      precaution_type: row.precaution_type || 'contact',
      indication: row.indication || '',
      started_at: toLocalInput(row.started_at),
      ended_at: toLocalInput(row.ended_at),
      review_due_at: toLocalInput(row.review_due_at),
      measures_ui: row.measures?.ppe
        ? {
            ...empty.measures_ui,
            ...row.measures,
            ppe: { ...empty.measures_ui.ppe, ...(row.measures?.ppe || {}) },
          }
        : empty.measures_ui,
    })
    toast.message('Editing isolation')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(empty)
    toast.message('Edit cancelled')
  }

  const doStop = async (row) => {
    if (!canStop) return
    if (!window.confirm('Stop isolation? This is audit-logged.')) return
    try {
      await stopIsolation(row.id, {
        stop_reason: 'Stopped from UI',
        stopped_at: new Date().toISOString(),
      })
      toast.success('Stopped')
      await load()
    } catch (e) {
      toast.error(e?.message || 'Stop failed')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const formatMeasures = (m) => {
    if (!m) return '—'
    if (typeof m === 'string') return m

    const ppe = m.ppe ? Object.entries(m.ppe).filter(([, v]) => !!v).map(([k]) => k.replaceAll('_', ' ')) : []
    const lines = [
      `PPE: ${ppe.length ? ppe.join(', ') : '—'}`,
      `Signage: ${m.signage ? 'Yes' : 'No'}`,
      `Dedicated equipment: ${m.dedicated_equipment ? 'Yes' : 'No'}`,
      `Visitor restriction: ${m.visitor_restriction ? 'Yes' : 'No'}`,
      `Hand hygiene: ${m.hand_hygiene ? 'Strict' : '—'}`,
      `Cleaning protocol: ${m.cleaning_protocol ? 'Enhanced' : '—'}`,
      `Waste disposal: ${m.waste_disposal ? 'As per protocol' : '—'}`,
      m.room ? `Room/Bed: ${m.room}` : null,
      m.notes ? `Notes: ${m.notes}` : null,
    ].filter(Boolean)

    return lines.join('\n')
  }

  return (
    <>
      <ClinicalRecordWorkspace
        title="Isolation Precaution"
        subtitle="Checklist + indication. Audit-friendly and easy for staff."
        patientChips={chips}
        alertsChips={
          alerts?.isolation_review_overdue
            ? [{ label: 'Isolation review overdue', className: 'rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100' }]
            : []
        }
        canWrite={canWrite}
        permissionHint="Need ipd.isolation.create (or ipd.manage) to add isolation."
        search={search}
        setSearch={setSearch}
        form={
          <div className="space-y-4">
            <SectionCard
              title={editingId ? 'Edit isolation' : 'New isolation'}
              subtitle="Pick type, indication, dates, and checklist."
              right={
                editingId ? (
                  <Button variant="outline" className="rounded-xl" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" /> Cancel edit
                  </Button>
                ) : null
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Precaution type">
                  <Select
                    value={form.precaution_type}
                    onValueChange={(v) => setForm({ ...form, precaution_type: v })}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">Contact</SelectItem>
                      <SelectItem value="droplet">Droplet</SelectItem>
                      <SelectItem value="airborne">Airborne</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Review due (optional)">
                  <Input
                    type="datetime-local"
                    className="h-10 rounded-xl"
                    value={form.review_due_at}
                    onChange={(e) => setForm({ ...form, review_due_at: e.target.value })}
                  />
                </Field>

                <Field label="Start date/time">
                  <Input
                    type="datetime-local"
                    className="h-10 rounded-xl"
                    value={form.started_at}
                    onChange={(e) => setForm({ ...form, started_at: e.target.value })}
                  />
                </Field>

                <Field label="End date/time (optional)">
                  <Input
                    type="datetime-local"
                    className="h-10 rounded-xl"
                    value={form.ended_at}
                    onChange={(e) => setForm({ ...form, ended_at: e.target.value })}
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Indication *">
                    <Input
                      className="h-10 rounded-xl"
                      value={form.indication}
                      onChange={(e) => setForm({ ...form, indication: e.target.value })}
                      placeholder="e.g., Suspected TB / Influenza / MRSA"
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Precaution checklist" subtitle="Auto-saved and stored as structured measures.">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-800 mb-2">PPE</div>
                  <div className="grid gap-2">
                    {[
                      ['gloves', 'Gloves'],
                      ['gown', 'Gown'],
                      ['mask', 'Mask'],
                      ['n95', 'N95'],
                      ['face_shield', 'Face shield'],
                    ].map(([k, label]) => (
                      <ToggleRow
                        key={k}
                        label={label}
                        checked={!!form.measures_ui.ppe[k]}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            measures_ui: {
                              ...form.measures_ui,
                              ppe: { ...form.measures_ui.ppe, [k]: v },
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-800 mb-2">General</div>
                  <div className="grid gap-2">
                    <ToggleRow
                      label="Signage outside room"
                      checked={!!form.measures_ui.signage}
                      onCheckedChange={(v) => setForm({ ...form, measures_ui: { ...form.measures_ui, signage: v } })}
                    />
                    <ToggleRow
                      label="Dedicated equipment"
                      checked={!!form.measures_ui.dedicated_equipment}
                      onCheckedChange={(v) =>
                        setForm({ ...form, measures_ui: { ...form.measures_ui, dedicated_equipment: v } })
                      }
                    />
                    <ToggleRow
                      label="Visitor restriction"
                      checked={!!form.measures_ui.visitor_restriction}
                      onCheckedChange={(v) =>
                        setForm({ ...form, measures_ui: { ...form.measures_ui, visitor_restriction: v } })
                      }
                    />
                    <ToggleRow
                      label="Strict hand hygiene"
                      checked={!!form.measures_ui.hand_hygiene}
                      onCheckedChange={(v) => setForm({ ...form, measures_ui: { ...form.measures_ui, hand_hygiene: v } })}
                    />
                    <ToggleRow
                      label="Enhanced cleaning protocol"
                      checked={!!form.measures_ui.cleaning_protocol}
                      onCheckedChange={(v) =>
                        setForm({ ...form, measures_ui: { ...form.measures_ui, cleaning_protocol: v } })
                      }
                    />
                    <ToggleRow
                      label="Waste disposal as per protocol"
                      checked={!!form.measures_ui.waste_disposal}
                      onCheckedChange={(v) =>
                        setForm({ ...form, measures_ui: { ...form.measures_ui, waste_disposal: v } })
                      }
                    />
                  </div>
                </div>

                <Field label="Room/Bed (optional)">
                  <Input
                    className="h-10 rounded-xl"
                    value={form.measures_ui.room}
                    onChange={(e) => setForm({ ...form, measures_ui: { ...form.measures_ui, room: e.target.value } })}
                    placeholder="e.g., ICU-3 / Ward B / Bed 12"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Extra notes (optional)">
                    <Textarea
                      className="min-h-[92px] rounded-xl"
                      value={form.measures_ui.notes}
                      onChange={(e) => setForm({ ...form, measures_ui: { ...form.measures_ui, notes: e.target.value } })}
                      placeholder="Any special instructions for staff…"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2 hidden md:flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      localStorage.setItem(draftKey(admissionId, 'isolation'), JSON.stringify(form))
                      toast.success('Draft saved')
                    }}
                  >
                    Save draft
                  </Button>
                  <Button className="rounded-xl" disabled={submitting || (!canWrite && !editingId)} onClick={createOrUpdate}>
                    {submitting ? 'Saving…' : editingId ? 'Update' : 'Save'}
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        }
        history={
          <div className="space-y-3">
            {filtered.length === 0 ? <EmptyState /> : null}
            {filtered.map((r) => (
              <TimelineCard
                key={r.id}
                title={`${r.precaution_type || 'Isolation'} • ${r.indication || ''}`.trim()}
                subtitle={`${fmtIST(r.started_at)} → ${r.ended_at ? fmtIST(r.ended_at) : '—'}`}
                status={r.status || 'active'}
                metaLeft={<span>By: {userLabel(r.ordered_by, r.ordered_by_id)}</span>}
                metaRight={
                  r.status === 'active' && canStop ? (
                    <button
                      type="button"
                      className="text-xs text-rose-700 hover:underline inline-flex items-center gap-1"
                      onClick={() => doStop(r)}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Stop
                    </button>
                  ) : (
                    <span />
                  )
                }
                canEdit={canEdit}
                onEdit={() => startEdit(r)}
                audit={
                  <AuditRow
                    createdAt={r.created_at || r.started_at}
                    createdBy={userLabel(r.ordered_by, r.ordered_by_id)}
                    updatedAt={r.updated_at}
                    updatedBy={userLabel(r.updated_by, r.updated_by_id)}
                    editReason={r.edit_reason}
                  />
                }
              >
                <div className="text-sm text-zinc-700 whitespace-pre-wrap">{formatMeasures(r.measures)}</div>
              </TimelineCard>
            ))}
          </div>
        }
      />

      <StickyActionBar
        canWrite={canWrite || !!editingId}
        onDraft={() => {
          localStorage.setItem(draftKey(admissionId, 'isolation'), JSON.stringify(form))
          toast.success('Draft saved')
        }}
        onSubmit={createOrUpdate}
        submitting={submitting}
        submitLabel={editingId ? 'Update' : 'Save'}
      />

      <EditReasonDialog
        open={editReasonOpen}
        setOpen={setEditReasonOpen}
        title="Update isolation"
        onConfirm={(reason) => {
          setEditReasonOpen(false)
          pendingUpdateRef.current?.(reason)
        }}
      />
    </>
  )
}

/* =====================================================================================
   RESTRAINT (matches backend: restraint_type, device, site, reason, started_at, ended_at...)
===================================================================================== */
function RestraintModule({ admissionId, chips, alerts, canWrite, canEdit, canStop, canMonitor }) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editReasonOpen, setEditReasonOpen] = useState(false)
  const pendingUpdateRef = useRef(null)

  const empty = {
    restraint_type: 'physical',
    device: '',
    site: '',
    reason: '',
    alternatives_tried: '',
    started_at: '',
    ended_at: '',
    valid_till: '',
    consent_taken: false,
    consent_doc_ref: '',
  }
  const [form, setForm] = useState(empty)

  const load = async () => {
    try {
      const data = await listRestraints(admissionId)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load restraints')
    }
  }

  useEffect(() => {
    if (!admissionId) return
    load()

    const d = localStorage.getItem(draftKey(admissionId, 'restraint'))
    if (d) {
      try {
        setForm(JSON.parse(d))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(admissionId, 'restraint'), JSON.stringify(form))
    }, 900)
    return () => clearTimeout(t)
  }, [form, admissionId])

  const mapPayload = () => ({
    restraint_type: form.restraint_type,
    device: form.device || '',
    site: form.site || '',
    reason: form.reason || '',
    alternatives_tried: form.alternatives_tried || '',
    started_at: form.started_at ? toIso(form.started_at) : undefined,
    ended_at: form.ended_at ? toIso(form.ended_at) : null,
    valid_till: form.valid_till ? toIso(form.valid_till) : null,
    consent_taken: !!form.consent_taken,
    consent_doc_ref: form.consent_doc_ref || '',
  })

  const createOrUpdate = async () => {
    if (editingId) {
      pendingUpdateRef.current = async (reason) => {
        try {
          await updateRestraint(editingId, { ...mapPayload(), edit_reason: reason })
          toast.success('Updated')
          setEditingId(null)
          localStorage.removeItem(draftKey(admissionId, 'restraint'))
          setForm(empty)
          await load()
        } catch (e) {
          toast.error(e?.message || 'Update failed')
        }
      }
      setEditReasonOpen(true)
      return
    }

    setSubmitting(true)
    try {
      await createRestraint(admissionId, mapPayload())
      toast.success('Restraint saved')
      localStorage.removeItem(draftKey(admissionId, 'restraint'))
      setForm(empty)
      await load()
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setForm({
      ...empty,
      restraint_type: row.restraint_type || 'physical',
      device: row.device || '',
      site: row.site || '',
      reason: row.reason || '',
      alternatives_tried: row.alternatives_tried || '',
      started_at: toLocalInput(row.started_at),
      ended_at: toLocalInput(row.ended_at),
      valid_till: toLocalInput(row.valid_till),
      consent_taken: !!row.consent_taken,
      consent_doc_ref: row.consent_doc_ref || '',
    })
    toast.message('Editing restraint')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(empty)
    toast.message('Edit cancelled')
  }

  const doStop = async (row) => {
    if (!canStop) return
    if (!window.confirm('Stop restraint? This is audit-logged.')) return
    try {
      await stopRestraint(row.id, {
        stop_reason: 'Stopped from UI',
        stopped_at: new Date().toISOString(),
      })
      toast.success('Stopped')
      await load()
    } catch (e) {
      toast.error(e?.message || 'Stop failed')
    }
  }

  const quickMonitor = async (row) => {
    if (!canMonitor) return
    try {
      await addRestraintMonitor(row.id, {
        point: {
          at: new Date().toISOString(),
          circulation_ok: true,
          skin_ok: true,
          comfort_ok: true,
          notes: 'OK',
        },
      })
      toast.success('Monitoring logged')
      await load()
    } catch (e) {
      toast.error(e?.message || 'Monitor failed')
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
        title="Restraint Record"
        subtitle="Doctor order + monitoring log (audit-friendly)."
        patientChips={chips}
        alertsChips={
          alerts?.restraint_monitor_overdue
            ? [{ label: 'Restraint monitoring due', className: 'rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100' }]
            : []
        }
        canWrite={canWrite}
        permissionHint="Doctor/Admin can create restraints. Nursing can monitor."
        search={search}
        setSearch={setSearch}
        form={
          <div className="space-y-4">
            <SectionCard
              title={editingId ? 'Edit restraint' : 'New restraint'}
              subtitle="Clear reason + time window + consent."
              right={
                editingId ? (
                  <Button variant="outline" className="rounded-xl" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" /> Cancel edit
                  </Button>
                ) : null
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Restraint type">
                  <Select value={form.restraint_type} onValueChange={(v) => setForm({ ...form, restraint_type: v })}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="chemical">Chemical</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Device">
                  <Input className="h-10 rounded-xl" value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} placeholder="e.g., Soft wrist restraint" />
                </Field>

                <Field label="Site">
                  <Input className="h-10 rounded-xl" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="e.g., Both wrists" />
                </Field>

                <Field label="Valid till (optional)">
                  <Input type="datetime-local" className="h-10 rounded-xl" value={form.valid_till} onChange={(e) => setForm({ ...form, valid_till: e.target.value })} />
                </Field>

                <Field label="Started at">
                  <Input type="datetime-local" className="h-10 rounded-xl" value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} />
                </Field>

                <Field label="Ended at (optional)">
                  <Input type="datetime-local" className="h-10 rounded-xl" value={form.ended_at} onChange={(e) => setForm({ ...form, ended_at: e.target.value })} />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Reason *">
                    <Input className="h-10 rounded-xl" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g., Prevent self-extubation" />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Alternatives tried">
                    <Textarea className="min-h-[80px] rounded-xl" value={form.alternatives_tried} onChange={(e) => setForm({ ...form, alternatives_tried: e.target.value })} />
                  </Field>
                </div>

                <Field label="Consent taken">
                  <div className="h-10 rounded-xl border bg-white px-3 flex items-center justify-between">
                    <div className="text-sm text-zinc-700">{form.consent_taken ? 'Yes' : 'No'}</div>
                    <Switch checked={!!form.consent_taken} onCheckedChange={(v) => setForm({ ...form, consent_taken: v })} />
                  </div>
                </Field>

                <Field label="Consent doc ref">
                  <Input className="h-10 rounded-xl" value={form.consent_doc_ref} onChange={(e) => setForm({ ...form, consent_doc_ref: e.target.value })} placeholder="Optional" />
                </Field>

                <div className="md:col-span-2 hidden md:flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      localStorage.setItem(draftKey(admissionId, 'restraint'), JSON.stringify(form))
                      toast.success('Draft saved')
                    }}
                  >
                    Save draft
                  </Button>
                  <Button className="rounded-xl" disabled={submitting || (!canWrite && !editingId)} onClick={createOrUpdate}>
                    {submitting ? 'Saving…' : editingId ? 'Update' : 'Save'}
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
              const log = Array.isArray(r?.monitoring_log) ? r.monitoring_log : []
              const last = log.length ? log[log.length - 1] : null

              return (
                <TimelineCard
                  key={r.id}
                  title={`${r.restraint_type || 'Restraint'} • ${fmtIST(r.started_at)}`}
                  subtitle={r.reason || '—'}
                  status={r.status || (r.ended_at ? 'stopped' : 'active')}
                  metaLeft={<span>Doctor: {userLabel(r.ordered_by, r.ordered_by_id)}</span>}
                  metaRight={
                    <span className="inline-flex items-center gap-2">
                      {r.status === 'active' && canMonitor ? (
                        <button
                          type="button"
                          className="text-xs text-zinc-700 hover:underline inline-flex items-center gap-1"
                          onClick={() => quickMonitor(r)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Monitor
                        </button>
                      ) : null}

                      {r.status === 'active' && canStop ? (
                        <button
                          type="button"
                          className="text-xs text-rose-700 hover:underline inline-flex items-center gap-1"
                          onClick={() => doStop(r)}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Stop
                        </button>
                      ) : null}
                    </span>
                  }
                  canEdit={canEdit}
                  onEdit={() => startEdit(r)}
                  audit={
                    <AuditRow
                      createdAt={r.created_at || r.started_at}
                      createdBy={userLabel(r.ordered_by, r.ordered_by_id)}
                      updatedAt={r.updated_at}
                      updatedBy={userLabel(r.updated_by, r.updated_by_id)}
                      editReason={r.edit_reason}
                    />
                  }
                >
                  <div className="grid gap-2 text-sm text-zinc-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <div className="text-[11px] text-zinc-500">Device</div>
                        <div className="font-medium">{r.device || '—'}</div>
                      </div>
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <div className="text-[11px] text-zinc-500">Site</div>
                        <div className="font-medium">{r.site || '—'}</div>
                      </div>
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <div className="text-[11px] text-zinc-500">Valid till</div>
                        <div className="font-medium">{r.valid_till ? fmtIST(r.valid_till) : '—'}</div>
                      </div>
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <div className="text-[11px] text-zinc-500">Consent</div>
                        <div className="font-medium">{r.consent_taken ? 'Taken' : '—'}</div>
                      </div>
                    </div>

                    {r.alternatives_tried ? (
                      <div className="rounded-xl border bg-zinc-50 p-3 whitespace-pre-wrap">
                        <span className="font-medium">Alternatives tried:</span> {r.alternatives_tried}
                      </div>
                    ) : null}

                    <div className="rounded-xl border bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-zinc-800">Monitoring log</div>
                        <div className="text-[11px] text-zinc-500">{log.length} entries</div>
                      </div>

                      {last ? (
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="rounded-lg border bg-zinc-50 px-3 py-2">
                            <div className="text-[11px] text-zinc-500">Last checked</div>
                            <div className="font-medium">{last?.at ? fmtIST(last.at) : '—'}</div>
                          </div>
                          <div className="rounded-lg border bg-zinc-50 px-3 py-2">
                            <div className="text-[11px] text-zinc-500">Circulation</div>
                            <div className="font-medium">{last?.circulation_ok ? 'OK' : '—'}</div>
                          </div>
                          <div className="rounded-lg border bg-zinc-50 px-3 py-2">
                            <div className="text-[11px] text-zinc-500">Skin</div>
                            <div className="font-medium">{last?.skin_ok ? 'OK' : '—'}</div>
                          </div>
                          <div className="rounded-lg border bg-zinc-50 px-3 py-2">
                            <div className="text-[11px] text-zinc-500">Comfort</div>
                            <div className="font-medium">{last?.comfort_ok ? 'OK' : '—'}</div>
                          </div>
                          {last?.notes ? (
                            <div className="md:col-span-4 mt-1 text-sm text-zinc-700 whitespace-pre-wrap">
                              <span className="font-medium">Notes:</span> {last.notes}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-zinc-600">No monitoring entries yet.</div>
                      )}
                    </div>

                    {r.stop_reason ? (
                      <div className="rounded-xl border bg-rose-50 p-3 whitespace-pre-wrap text-rose-800">
                        <span className="font-medium">Stop reason:</span> {r.stop_reason}
                      </div>
                    ) : null}
                  </div>
                </TimelineCard>
              )
            })}
          </div>
        }
      />

      <StickyActionBar
        canWrite={canWrite || !!editingId}
        onDraft={() => {
          localStorage.setItem(draftKey(admissionId, 'restraint'), JSON.stringify(form))
          toast.success('Draft saved')
        }}
        onSubmit={createOrUpdate}
        submitting={submitting}
        submitLabel={editingId ? 'Update' : 'Save'}
      />

      <EditReasonDialog
        open={editReasonOpen}
        setOpen={setEditReasonOpen}
        title="Update restraint"
        onConfirm={(reason) => {
          setEditReasonOpen(false)
          pendingUpdateRef.current?.(reason)
        }}
      />
    </>
  )
}
