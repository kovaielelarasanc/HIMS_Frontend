// FILE: frontend/src/ipd/nursing/NursingProcedures.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Plus, RefreshCcw, AlertTriangle, Droplets, Shield, Bandage, HeartPulse, Hand } from 'lucide-react'

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
import { fmtIST, toIso } from './ui/utils'

import {
    getNursingAlerts,
    listDressing, createDressing, updateDressing,
    listIcuFlow, createIcuFlow, updateIcuFlow,
    listIsolation, createIsolation, updateIsolation, stopIsolation,
    listRestraints, createRestraint, updateRestraint, stopRestraint, addRestraintMonitor,

} from '../../api/ipdNursing'
import TransfusionModule from './TransfusionModule'

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

export default function NursingProcedures({
    admissionId,
    embedded = true,                 // fits inside your AdmissionDetail card
    admissionLabel = 'Admission',
    patientLabel = 'Patient',
    bedLabel = 'Ward/Bed',
}) {
    const canView = useCanAny(['ipd.view', 'ipd.manage', 'ipd.nursing', 'ipd.doctor'])

    // coarse perms + fine perms (future-ready)
    const canDressingWrite = useCanAny(['ipd.dressing.create', 'ipd.nursing', 'ipd.manage'])
    const canDressingEdit = useCanAny(['ipd.dressing.update', 'ipd.nursing', 'ipd.manage'])

    const canIcuWrite = useCanAny(['ipd.icu.create', 'ipd.nursing', 'ipd.doctor', 'ipd.manage'])
    const canIcuEdit = useCanAny(['ipd.icu.update', 'ipd.nursing', 'ipd.doctor', 'ipd.manage'])

    const canIsolationWrite = useCanAny(['ipd.isolation.create', 'ipd.doctor', 'ipd.manage'])
    const canIsolationEdit = useCanAny(['ipd.isolation.update', 'ipd.doctor', 'ipd.manage'])
    const canIsolationStop = useCanAny(['ipd.isolation.stop', 'ipd.doctor', 'ipd.manage'])

    const canRestraintWrite = useCanAny(['ipd.restraints.create', 'ipd.doctor', 'ipd.manage'])
    const canRestraintEdit = useCanAny(['ipd.restraints.update', 'ipd.doctor', 'ipd.manage'])
    const canRestraintStop = useCanAny(['ipd.restraints.stop', 'ipd.doctor', 'ipd.manage'])
    const canRestraintMonitor = useCanAny(['ipd.restraints.monitor', 'ipd.nursing', 'ipd.manage'])

    const canTransfusionWrite = useCanAny(['ipd.transfusion.create', 'ipd.nursing', 'ipd.manage'])
    const canTransfusionEdit = useCanAny(['ipd.transfusion.update', 'ipd.nursing', 'ipd.manage'])
    const canTransfusionReaction = useCanAny(['ipd.transfusion.reaction', 'ipd.nursing', 'ipd.doctor', 'ipd.manage'])

    const [alerts, setAlerts] = useState(null)
    const loadAlerts = async () => {
        try {
            const data = await getNursingAlerts(admissionId)
            setAlerts(data)
        } catch {
            // ok if endpoint not present
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
                        <TabsTrigger className="rounded-xl" value="dressing"><Bandage className="h-4 w-4 mr-2" /> Dressing</TabsTrigger>
                        <TabsTrigger className="rounded-xl" value="icu"><HeartPulse className="h-4 w-4 mr-2" /> ICU Flow</TabsTrigger>
                        <TabsTrigger className="rounded-xl" value="isolation"><Shield className="h-4 w-4 mr-2" /> Isolation</TabsTrigger>
                        <TabsTrigger className="rounded-xl" value="restraint"><Hand className="h-4 w-4 mr-2" /> Restraint</TabsTrigger>
                        <TabsTrigger className="rounded-xl" value="transfusion"><Droplets className="h-4 w-4 mr-2" /> Transfusion</TabsTrigger>
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
   DRESSING
===================================================================================== */
function DressingModule({ admissionId, chips, alerts, canWrite, canEdit }) {
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [editReasonOpen, setEditReasonOpen] = useState(false)
    const pendingUpdateRef = useRef(null)

    const empty = {
        wound_site: '',
        dressing_type: '',
        indication: '',
        date_time: '',
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
        if (alerts?.dressing_overdue) out.push({ label: 'Dressing overdue', className: 'rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100' })
        if (alerts?.dressing_next_due_at) out.push({ label: `Next due: ${fmtIST(alerts.dressing_next_due_at)}`, className: 'rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100' })
        return out
    }, [alerts])

    const load = async () => {
        setLoading(true)
        try {
            const data = await listDressing(admissionId)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!admissionId) return
        load()
        const d = localStorage.getItem(draftKey(admissionId, 'dressing'))
        if (d) {
            try { setForm(JSON.parse(d)) } catch { }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    useEffect(() => {
        const t = setTimeout(() => localStorage.setItem(draftKey(admissionId, 'dressing'), JSON.stringify(form)), 900)
        return () => clearTimeout(t)
    }, [form, admissionId])

    const submit = async () => {
        setSubmitting(true)
        try {
            const payload = {
                wound_site: form.wound_site,
                dressing_type: form.dressing_type,
                indication: form.indication,
                date_time: form.date_time ? toIso(form.date_time) : undefined,
                findings: form.findings,
                next_dressing_due: form.next_dressing_due ? toIso(form.next_dressing_due) : null,
                meta: {
                    pain_score: form.pain_score ? Number(form.pain_score) : null,
                    patient_response: form.patient_response || '',
                    asepsis: form.asepsis,
                },
            }
            await createDressing(admissionId, payload)
            toast.success('Dressing saved')
            localStorage.removeItem(draftKey(admissionId, 'dressing'))
            setForm(empty)
            await load()
        } catch (e) {
            toast.error(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const requestEdit = (row) => {
        // Use row fields if available
        pendingUpdateRef.current = async (reason) => {
            try {
                await updateDressing(row.id, { ...row, edit_reason: reason })
                toast.success('Updated')
                await load()
            } catch (e) {
                toast.error(e.message)
            }
        }
        setEditReasonOpen(true)
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
                permissionHint="Need ipd.nursing (or ipd.manage) to add dressing records."
                search={search}
                setSearch={setSearch}
                form={
                    <div className="space-y-4">
                        <SectionCard title="Wound & Procedure" subtitle="Short, structured clinical entry.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Wound site *">
                                    <Input className="h-10 rounded-xl" value={form.wound_site} onChange={(e) => setForm({ ...form, wound_site: e.target.value })} placeholder="e.g., Right leg" />
                                </Field>
                                <Field label="Dressing type">
                                    <Input className="h-10 rounded-xl" value={form.dressing_type} onChange={(e) => setForm({ ...form, dressing_type: e.target.value })} placeholder="e.g., Sterile gauze" />
                                </Field>
                                <Field label="Indication">
                                    <Input className="h-10 rounded-xl" value={form.indication} onChange={(e) => setForm({ ...form, indication: e.target.value })} placeholder="e.g., Post-op wound" />
                                </Field>
                                <Field label="Date & time">
                                    <div className="relative">
                                        <CalendarClock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <Input type="datetime-local" className="h-10 rounded-xl pl-9" value={form.date_time} onChange={(e) => setForm({ ...form, date_time: e.target.value })} />
                                    </div>
                                </Field>
                            </div>
                        </SectionCard>

                        <SectionCard title="Asepsis checklist" subtitle="Visible in audit (do not hide).">
                            <div className="grid gap-3 md:grid-cols-2">
                                <ToggleRow label="Hand hygiene" checked={form.asepsis.hand_hygiene} onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, hand_hygiene: v } })} />
                                <ToggleRow label="Sterile gloves" checked={form.asepsis.sterile_gloves} onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, sterile_gloves: v } })} />
                                <ToggleRow label="Sterile field" checked={form.asepsis.sterile_field} onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, sterile_field: v } })} />
                                <ToggleRow label="Mask" checked={form.asepsis.mask} onCheckedChange={(v) => setForm({ ...form, asepsis: { ...form.asepsis, mask: v } })} />
                            </div>
                        </SectionCard>

                        <SectionCard title="Notes & Plan" subtitle="Keep it brief and legible for rounds.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Pain score (0–10)">
                                    <Input className="h-10 rounded-xl" inputMode="numeric" value={form.pain_score} onChange={(e) => setForm({ ...form, pain_score: e.target.value })} placeholder="0–10" />
                                </Field>
                                <Field label="Patient response">
                                    <Input className="h-10 rounded-xl" value={form.patient_response} onChange={(e) => setForm({ ...form, patient_response: e.target.value })} placeholder="e.g., Tolerated well" />
                                </Field>
                                <Field label="Next dressing due" hint="Used for reminders and nursing planning.">
                                    <div className="relative">
                                        <CalendarClock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <Input type="datetime-local" className="h-10 rounded-xl pl-9" value={form.next_dressing_due} onChange={(e) => setForm({ ...form, next_dressing_due: e.target.value })} />
                                    </div>
                                </Field>
                                <div className="md:col-span-2">
                                    <Field label="Findings / notes">
                                        <Textarea className="min-h-[92px] rounded-xl" value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} placeholder="Exudate, odor, infection signs…" />
                                    </Field>
                                </div>

                                <div className="md:col-span-2 hidden md:flex justify-end gap-2">
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
                        {!loading && filtered.length === 0 ? <EmptyState /> : null}
                        {filtered.map((r) => (
                            <TimelineCard
                                key={r.id}
                                title={r.wound_site || 'Dressing'}
                                subtitle={`${r.dressing_type || '—'} • ${fmtIST(r.date_time || r.created_at)}`}
                                status="Completed"
                                metaLeft={<span>By: {r.done_by ?? r.created_by_id ?? '—'}</span>}
                                metaRight={r.next_dressing_due ? <span className="text-amber-700">Next: {fmtIST(r.next_dressing_due)}</span> : <span />}
                                canEdit={canEdit}
                                onEdit={() => requestEdit(r)}
                                audit={
                                    <AuditRow
                                        createdAt={r.created_at || r.date_time}
                                        createdBy={r.done_by || r.created_by_id}
                                        updatedAt={r.updated_at}
                                        updatedBy={r.updated_by_id}
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
                canWrite={canWrite}
                onDraft={() => {
                    localStorage.setItem(draftKey(admissionId, 'dressing'), JSON.stringify(form))
                    toast.success('Draft saved')
                }}
                onSubmit={submit}
                submitting={submitting}
                submitLabel="Save"
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
   ICU FLOW (clean + practical NABH-grade fields)
===================================================================================== */
function IcuModule({ admissionId, chips, alerts, canWrite, canEdit }) {
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState([])
    const [submitting, setSubmitting] = useState(false)

    const [editReasonOpen, setEditReasonOpen] = useState(false)
    const pendingUpdateRef = useRef(null)

    const empty = {
        recorded_at: '',
        shift: 'morning',
        vitals: { bp: '', pulse: '', temp: '', rr: '', spo2: '' },
        ventilator: { mode: '', fio2: '', peep: '' },
        infusions: '',
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
            toast.error(e.message)
        }
    }

    useEffect(() => {
        if (!admissionId) return
        load()
        const d = localStorage.getItem(draftKey(admissionId, 'icu'))
        if (d) {
            try { setForm(JSON.parse(d)) } catch { }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    useEffect(() => {
        const t = setTimeout(() => localStorage.setItem(draftKey(admissionId, 'icu'), JSON.stringify(form)), 900)
        return () => clearTimeout(t)
    }, [form, admissionId])

    const submit = async () => {
        setSubmitting(true)
        try {
            // keep UI as-is: infusions is a single string input
            // backend expects list of dicts -> convert string to [{ text: "..." }]
            const infusionsList =
                (form.infusions || '').trim()
                    ? [{ text: (form.infusions || '').trim() }]
                    : []

            const payload = {
                recorded_at: form.recorded_at ? toIso(form.recorded_at) : undefined,

                // ✅ backend expects these keys
                shift: form.shift || null,
                vitals: form.vitals || {},
                ventilator: form.ventilator || {},
                infusions: infusionsList,

                // ✅ avoid NaN
                gcs_score: toIntOrNull(form.gcs_score),
                urine_output_ml: toIntOrNull(form.urine_output_ml),

                notes: form.notes || '',
            }

            console.log(payload, "payload")
            await createIcuFlow(admissionId, payload)

            toast.success('ICU flow saved')
            localStorage.removeItem(draftKey(admissionId, 'icu'))
            setForm(empty)
            await load()
        } catch (e) {
            toast.error(e.message)
        } finally {
            setSubmitting(false)
        }
    }


    const requestEdit = (row) => {
        pendingUpdateRef.current = async (reason) => {
            try {
                await updateIcuFlow(row.id, { ...row, edit_reason: reason })
                toast.success('Updated')
                await load()
            } catch (e) {
                toast.error(e.message)
            }
        }
        setEditReasonOpen(true)
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    }, [rows, search])

    const toIntOrNull = (v) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }

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
                permissionHint="Need ipd.nursing/ipd.doctor (or ipd.manage) to add ICU flow."
                search={search}
                setSearch={setSearch}
                form={
                    <div className="space-y-4">
                        <SectionCard title="Time & Shift" subtitle="Fast entry for rounds and ICU monitoring.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Recorded at">
                                    <div className="relative">
                                        <CalendarClock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <Input type="datetime-local" className="h-10 rounded-xl pl-9" value={form.recorded_at} onChange={(e) => setForm({ ...form, recorded_at: e.target.value })} />
                                    </div>
                                </Field>
                                <Field label="Shift">
                                    <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                                        <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
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
                                    <Input className="h-10 rounded-xl" value={form.ventilator.mode} onChange={(e) => setForm({ ...form, ventilator: { ...form.ventilator, mode: e.target.value } })} />
                                </Field>
                                <Field label="FiO₂ (%)">
                                    <Input className="h-10 rounded-xl" value={form.ventilator.fio2} onChange={(e) => setForm({ ...form, ventilator: { ...form.ventilator, fio2: e.target.value } })} />
                                </Field>
                                <Field label="PEEP">
                                    <Input className="h-10 rounded-xl" value={form.ventilator.peep} onChange={(e) => setForm({ ...form, ventilator: { ...form.ventilator, peep: e.target.value } })} />
                                </Field>
                            </div>
                        </SectionCard>

                        <SectionCard title="Infusions & Notes" subtitle="For quick clinical context.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Infusions">
                                    <Input className="h-10 rounded-xl" value={form.infusions} onChange={(e) => setForm({ ...form, infusions: e.target.value })} placeholder="e.g., Noradrenaline 2 ml/hr" />
                                </Field>
                                <Field label="GCS / Urine Output">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input className="h-10 rounded-xl" value={form.gcs_score} onChange={(e) => setForm({ ...form, gcs_score: e.target.value })} placeholder="GCS" />
                                        <Input className="h-10 rounded-xl" value={form.urine_output_ml} onChange={(e) => setForm({ ...form, urine_output_ml: e.target.value })} placeholder="UO (ml)" />
                                    </div>
                                </Field>
                                <div className="md:col-span-2">
                                    <Field label="Notes">
                                        <Textarea className="min-h-[92px] rounded-xl" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                                    </Field>
                                </div>

                                <div className="md:col-span-2 hidden md:flex justify-end gap-2">
                                    <Button variant="outline" className="rounded-xl" onClick={() => toast.success('Draft auto-saved')}>
                                        Draft
                                    </Button>
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
                        {filtered.map((r) => (
                            <TimelineCard
                                key={r.id}
                                title={`ICU Flow • ${fmtIST(r.recorded_at)}`}
                                subtitle="Time-stamped ICU monitoring"
                                status="Completed"
                                metaLeft={<span>By: {r.recorded_by ?? '—'}</span>}
                                metaRight={<span />}
                                canEdit={canEdit}
                                onEdit={() => requestEdit(r)}
                                audit={
                                    <AuditRow
                                        createdAt={r.created_at || r.recorded_at}
                                        createdBy={r.recorded_by}
                                        updatedAt={r.updated_at}
                                        updatedBy={r.updated_by_id}
                                        editReason={r.edit_reason}
                                    />
                                }
                            >
                                <pre className="text-xs text-zinc-700 whitespace-pre-wrap">{JSON.stringify(r, null, 2)}</pre>
                            </TimelineCard>
                        ))}
                    </div>
                }
            />

            <StickyActionBar
                canWrite={canWrite}
                onDraft={() => {
                    localStorage.setItem(draftKey(admissionId, 'icu'), JSON.stringify(form))
                    toast.success('Draft saved')
                }}
                onSubmit={submit}
                submitting={submitting}
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
   ISOLATION
===================================================================================== */
function IsolationModule({ admissionId, chips, alerts, canWrite, canEdit, canStop }) {
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState([])
    const [submitting, setSubmitting] = useState(false)

    const [editReasonOpen, setEditReasonOpen] = useState(false)
    const pendingUpdateRef = useRef(null)

    // helper: build measures DICT for backend
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

    // ✅ friendly measures structure
    const empty = {
        indication: '',
        precaution: 'contact',
        start_date: '',
        end_date: '',
        status: 'active',

        // NEW: user-friendly measures
        measures_ui: {
            ppe: { gloves: true, gown: false, mask: false, n95: false, face_shield: false },
            signage: true,
            dedicated_equipment: true,
            visitor_restriction: false,
            hand_hygiene: true,
            cleaning_protocol: true,
            waste_disposal: true,
            room: '',
            review_due_at: '',
            notes: '',
        },
    }

    const [form, setForm] = useState(empty)

    const load = async () => {
        try {
            const data = await listIsolation(admissionId)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e.message)
        }
    }

    // helper: build readable measures string for backend
    const buildMeasuresText = (ui) => {
        const ppe = []
        if (ui.ppe?.gloves) ppe.push('Gloves')
        if (ui.ppe?.gown) ppe.push('Gown')
        if (ui.ppe?.mask) ppe.push('Mask')
        if (ui.ppe?.n95) ppe.push('N95')
        if (ui.ppe?.face_shield) ppe.push('Face shield')

        const lines = [
            `PPE: ${ppe.length ? ppe.join(', ') : '—'}`,
            `Signage: ${ui.signage ? 'Yes' : 'No'}`,
            `Dedicated equipment: ${ui.dedicated_equipment ? 'Yes' : 'No'}`,
            `Visitor restriction: ${ui.visitor_restriction ? 'Yes' : 'No'}`,
            `Hand hygiene: ${ui.hand_hygiene ? 'Strict' : '—'}`,
            `Cleaning protocol: ${ui.cleaning_protocol ? 'Enhanced' : '—'}`,
            `Waste disposal: ${ui.waste_disposal ? 'As per protocol' : '—'}`,
            ui.room ? `Room/Bed: ${ui.room}` : null,
            ui.review_due_at ? `Review due: ${fmtIST(toIso(ui.review_due_at))}` : null,
            ui.notes ? `Notes: ${ui.notes}` : null,
        ].filter(Boolean)

        return lines.join('\n')
    }

    useEffect(() => {
        if (!admissionId) return
        load()

        const d = localStorage.getItem(draftKey(admissionId, 'isolation'))
        if (d) {
            try {
                const parsed = JSON.parse(d)

                // ✅ if old data exists with measures string, keep it but show default checklist UI
                setForm({
                    ...empty,
                    ...parsed,
                    measures_ui: parsed.measures_ui ? parsed.measures_ui : empty.measures_ui,
                })
            } catch { }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    useEffect(() => {
        const t = setTimeout(
            () => localStorage.setItem(draftKey(admissionId, 'isolation'), JSON.stringify(form)),
            900,
        )
        return () => clearTimeout(t)
    }, [form, admissionId])

    const submit = async () => {
        setSubmitting(true)
        try {
            const payload = {
                precaution_type: form.precaution,                 // ✅ backend key
                indication: form.indication || null,

                started_at: form.start_date ? toIso(form.start_date) : undefined,  // ✅ backend key
                ended_at: form.end_date ? toIso(form.end_date) : null,             // ✅ backend key

                measures: buildMeasuresDict(form.measures_ui),    // ✅ must be DICT
                review_due_at: form.measures_ui.review_due_at
                    ? toIso(form.measures_ui.review_due_at)
                    : null,
            }

            await createIsolation(admissionId, payload)

            toast.success('Isolation saved')
            localStorage.removeItem(draftKey(admissionId, 'isolation'))
            setForm(empty)
            await load()
        } catch (e) {
            toast.error(e.message)
        } finally {
            setSubmitting(false)
        }
    }


    const requestEdit = (row) => {
        pendingUpdateRef.current = async (reason) => {
            try {
                await updateIsolation(row.id, { ...row, edit_reason: reason })
                toast.success('Updated')
                await load()
            } catch (e) {
                toast.error(e.message)
            }
        }
        setEditReasonOpen(true)
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
            toast.error(e.message)
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    }, [rows, search])

    const formatMeasures = (m) => {
        if (!m) return '—'
        if (typeof m === 'string') return m // backward compatible old rows

        const ppe = m.ppe
            ? Object.entries(m.ppe).filter(([, v]) => !!v).map(([k]) => k.replaceAll('_', ' '))
            : []

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
                subtitle="Simple checklist + clear indication. Audit-friendly and easy for nurses/doctors."
                patientChips={chips}
                alertsChips={
                    alerts?.isolation_review_overdue
                        ? [{ label: 'Isolation review overdue', className: 'rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100' }]
                        : []
                }
                canWrite={canWrite}
                permissionHint="Doctor/Admin can create isolation precautions."
                search={search}
                setSearch={setSearch}
                form={
                    <div className="space-y-4">
                        <SectionCard title="Isolation details" subtitle="Pick precaution type and enter clinical indication.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Precaution type">
                                    <Select value={form.precaution} onValueChange={(v) => setForm({ ...form, precaution: v })}>
                                        <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="contact">Contact</SelectItem>
                                            <SelectItem value="droplet">Droplet</SelectItem>
                                            <SelectItem value="airborne">Airborne</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Status">
                                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                                        <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="stopped">Stopped</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Start date/time">
                                    <Input type="datetime-local" className="h-10 rounded-xl" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                                </Field>

                                <Field label="End date/time (optional)">
                                    <Input type="datetime-local" className="h-10 rounded-xl" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
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

                        {/* ✅ NEW: measures UI */}
                        <SectionCard title="Precaution checklist" subtitle="Easy-to-understand steps (auto-formats to “measures”).">
                            <div className="grid gap-3 md:grid-cols-2">
                                {/* PPE */}
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

                                {/* General steps */}
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
                                            onCheckedChange={(v) => setForm({ ...form, measures_ui: { ...form.measures_ui, dedicated_equipment: v } })}
                                        />
                                        <ToggleRow
                                            label="Visitor restriction"
                                            checked={!!form.measures_ui.visitor_restriction}
                                            onCheckedChange={(v) => setForm({ ...form, measures_ui: { ...form.measures_ui, visitor_restriction: v } })}
                                        />
                                        <ToggleRow
                                            label="Strict hand hygiene"
                                            checked={!!form.measures_ui.hand_hygiene}
                                            onCheckedChange={(v) => setForm({ ...form, measures_ui: { ...form.measures_ui, hand_hygiene: v } })}
                                        />
                                        <ToggleRow
                                            label="Enhanced cleaning protocol"
                                            checked={!!form.measures_ui.cleaning_protocol}
                                            onCheckedChange={(v) => setForm({ ...form, measures_ui: { ...form.measures_ui, cleaning_protocol: v } })}
                                        />
                                        <ToggleRow
                                            label="Waste disposal as per protocol"
                                            checked={!!form.measures_ui.waste_disposal}
                                            onCheckedChange={(v) => setForm({ ...form, measures_ui: { ...form.measures_ui, waste_disposal: v } })}
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

                                <Field label="Review due (optional)" hint="Helps for reminders & infection control review.">
                                    <Input
                                        type="datetime-local"
                                        className="h-10 rounded-xl"
                                        value={form.measures_ui.review_due_at}
                                        onChange={(e) => setForm({ ...form, measures_ui: { ...form.measures_ui, review_due_at: e.target.value } })}
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
                        {filtered.map((r) => (
                            <TimelineCard
                                key={r.id}
                                title={`${(r.precaution_type || r.indication || 'Isolation').toString()}`}
                                subtitle={`${fmtIST(r.started_at)} → ${r.ended_at ? fmtIST(r.ended_at) : '—'}`}
                                status={r.status || 'active'}
                                metaLeft={<span>By: {r.created_by_id ?? '—'}</span>}
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
                                onEdit={() => requestEdit(r)}
                                audit={
                                    <AuditRow
                                        createdAt={r.created_at || r.start_date}
                                        createdBy={r.created_by_id}
                                        updatedAt={r.updated_at}
                                        updatedBy={r.updated_by_id}
                                        editReason={r.edit_reason}
                                    />
                                }
                            >
                                {/* ✅ history: show readable measures */}
                                <div className="text-sm text-zinc-700 whitespace-pre-wrap">
                                    {formatMeasures(r.measures)}
                                </div>
                            </TimelineCard>
                        ))}
                    </div>
                }
            />

            <StickyActionBar
                canWrite={canWrite}
                onDraft={() => {
                    localStorage.setItem(draftKey(admissionId, 'isolation'), JSON.stringify(form))
                    toast.success('Draft saved')
                }}
                onSubmit={submit}
                submitting={submitting}
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
   RESTRAINT
===================================================================================== */
function RestraintModule({ admissionId, chips, alerts, canWrite, canEdit, canStop, canMonitor }) {
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState([])
    const [submitting, setSubmitting] = useState(false)

    const [editReasonOpen, setEditReasonOpen] = useState(false)
    const pendingUpdateRef = useRef(null)

    const empty = {
        type: 'physical',
        reason: '',
        start_time: '',
        end_time: '',
        monitoring_notes: '',
    }
    const [form, setForm] = useState(empty)

    const load = async () => {
        try {
            const data = await listRestraints(admissionId)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            toast.error(e.message)
        }
    }

    useEffect(() => {
        if (!admissionId) return
        load()
        const d = localStorage.getItem(draftKey(admissionId, 'restraint'))
        if (d) {
            try { setForm(JSON.parse(d)) } catch { }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    useEffect(() => {
        const t = setTimeout(() => localStorage.setItem(draftKey(admissionId, 'restraint'), JSON.stringify(form)), 900)
        return () => clearTimeout(t)
    }, [form, admissionId])

    const submit = async () => {
        setSubmitting(true)
        try {
            const payload = {
                type: form.type,
                reason: form.reason,
                start_time: form.start_time ? toIso(form.start_time) : undefined,
                end_time: form.end_time ? toIso(form.end_time) : null,
                monitoring_notes: form.monitoring_notes,
            }
            await createRestraint(admissionId, payload)
            toast.success('Restraint saved')
            localStorage.removeItem(draftKey(admissionId, 'restraint'))
            setForm(empty)
            await load()
        } catch (e) {
            toast.error(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const requestEdit = (row) => {
        pendingUpdateRef.current = async (reason) => {
            try {
                await updateRestraint(row.id, { ...row, edit_reason: reason })
                toast.success('Updated')
                await load()
            } catch (e) {
                toast.error(e.message)
            }
        }
        setEditReasonOpen(true)
    }

    const doStop = async (row) => {
        if (!canStop) return
        if (!window.confirm('Stop restraint? This is audit-logged.')) return
        try {
            await stopRestraint(row.id, { stop_reason: 'Stopped from UI', stopped_at: new Date().toISOString() })
            toast.success('Stopped')
            await load()
        } catch (e) {
            toast.error(e.message)
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
            toast.error(e.message)
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
                subtitle="Doctor order + monitoring readiness (audit-friendly)."
                patientChips={chips}
                alertsChips={
                    alerts?.restraint_monitor_overdue
                        ? [{ label: 'Restraint monitoring due', className: 'rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100' }]
                        : []
                }
                canWrite={canWrite}
                permissionHint="Doctor/Admin can create restraint orders. Nursing can monitor."
                search={search}
                setSearch={setSearch}
                form={
                    <div className="space-y-4">
                        <SectionCard title="Order details" subtitle="Restraints require clear reason and time window.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Type">
                                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                                        <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="physical">Physical</SelectItem>
                                            <SelectItem value="chemical">Chemical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Start time">
                                    <Input type="datetime-local" className="h-10 rounded-xl" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                                </Field>

                                <Field label="End time (optional)">
                                    <Input type="datetime-local" className="h-10 rounded-xl" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                                </Field>

                                <div className="md:col-span-2">
                                    <Field label="Reason *">
                                        <Input className="h-10 rounded-xl" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g., Prevent self-extubation" />
                                    </Field>
                                </div>

                                <div className="md:col-span-2">
                                    <Field label="Monitoring notes">
                                        <Textarea className="min-h-[92px] rounded-xl" value={form.monitoring_notes} onChange={(e) => setForm({ ...form, monitoring_notes: e.target.value })} />
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
                        {filtered.map((r) => (
                            <TimelineCard
                                key={r.id}
                                title={`${r.type || 'Restraint'} • ${fmtIST(r.start_time)}`}
                                subtitle={r.reason || '—'}
                                status={r.end_time ? 'stopped' : 'active'}
                                metaLeft={<span>Doctor: {r.doctor_order_id ?? '—'}</span>}
                                metaRight={
                                    <span className="inline-flex items-center gap-2">
                                        {r.end_time ? null : canMonitor ? (
                                            <button
                                                type="button"
                                                className="text-xs text-zinc-700 hover:underline inline-flex items-center gap-1"
                                                onClick={() => quickMonitor(r)}
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Monitor
                                            </button>
                                        ) : null}
                                        {!r.end_time && canStop ? (
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
                                onEdit={() => requestEdit(r)}
                                audit={
                                    <AuditRow
                                        createdAt={r.created_at || r.start_time}
                                        createdBy={r.doctor_order_id}
                                        updatedAt={r.updated_at}
                                        updatedBy={r.updated_by_id}
                                        editReason={r.edit_reason}
                                    />
                                }
                            >
                                <pre className="text-xs text-zinc-700 whitespace-pre-wrap">{JSON.stringify(r, null, 2)}</pre>
                            </TimelineCard>
                        ))}
                    </div>
                }
            />

            <StickyActionBar
                canWrite={canWrite}
                onDraft={() => {
                    localStorage.setItem(draftKey(admissionId, 'restraint'), JSON.stringify(form))
                    toast.success('Draft saved')
                }}
                onSubmit={submit}
                submitting={submitting}
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

/* =====================================================================================
   TRANSFUSION
===================================================================================== */
