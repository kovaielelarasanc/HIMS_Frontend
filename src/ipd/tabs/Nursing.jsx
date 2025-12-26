// FILE: src/ipd/tabs/Nursing.jsx
import { useEffect, useMemo, useState } from 'react'
import { listNursingNotes, addNursingNote, getLatestVitals } from '../../api/ipd'
import { useCan } from '../../hooks/usePerm'
import {
    Activity,
    HeartPulse,
    Thermometer,
    Wind,
    Droplets,
    Clock,
    User,
    AlertTriangle,
    ClipboardList,
    Plus,
    RotateCw,
} from 'lucide-react'
import { formatIST } from '../components/timeZONE'

import {
    Tabs as UITabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 🔹 Dropdown master lists
const PATIENT_CONDITION_OPTIONS = [
    'Conscious, oriented, stable',
    'Conscious, disoriented',
    'Drowsy but arousable',
    'Unconscious',
    'Restless / agitated',
    'Breathless / tachypnoeic',
    'Post-op stable',
    'Critical, on ventilator',
]

const WOUND_STATUS_OPTIONS = [
    'Dressing clean, dry, intact',
    'Dressing slightly soaked',
    'Dressing soaked – change required',
    'Oozing serous discharge',
    'Oozing blood',
    'Redness / swelling around wound',
    'Signs of infection – pus / foul smell',
]

const OXYGEN_SUPPORT_OPTIONS = [
    'Room air',
    'Nasal cannula 2 L/min',
    'Nasal cannula 4 L/min',
    'Simple face mask 5 L/min',
    'NRBM 10 L/min',
    'HFNC',
    'BiPAP',
    'Ventilator – pressure mode',
    'Ventilator – volume mode',
]

const DRAINS_TUBES_OPTIONS = [
    'None',
    'Foley catheter in situ',
    'Ryle’s tube in situ',
    'Intercostal drain (ICD) in situ',
    'Wound drain in situ',
    'Central line in situ',
    'Multiple drains / tubes present',
]

// 🔹 Note type (routine / incident / shift handover)
const NOTE_TYPE_OPTIONS = [
    { value: 'routine', label: 'Routine note' },
    { value: 'incident', label: 'Incident note' },
    { value: 'shift_handover', label: 'Shift handover note' },
]

const cn = (...xs) => xs.filter(Boolean).join(' ')

const SoftCard = ({ className = '', children }) => (
    <div
        className={cn(
            'rounded-3xl bg-white/80 shadow-sm ring-1 ring-slate-200/60 backdrop-blur transition-all hover:shadow-md',
            className,
        )}
    >
        {children}
    </div>
)

export default function Nursing({ admissionId, canWrite }) {
    // Permissions
    const canCreateFromPerm = useCan('ipd.nursing.create')
    const canPost = (canWrite ?? true) && !!canCreateFromPerm

    const [tab, setTab] = useState('recent') // recent | add
    const [notes, setNotes] = useState([])
    const [latestVitals, setLatestVitals] = useState(null)

    const [form, setForm] = useState({
        entry_time: '',
        note_type: 'routine',
        patient_condition: '',
        wound_status: '',
        oxygen_support: '',
        urine_output: '',
        drains_tubes: '',
        pain_score: '',
        other_findings: '',
        significant_events: '',
        nursing_interventions: '',
        response_progress: '',
        handover_note: '',
        shift: '',
        is_icu: false,

        // Shift handover specific fields
        vital_signs_summary: '',
        todays_procedures: '',
        current_condition: '',
        recent_changes: '',
        ongoing_treatment: '',
        watch_next_shift: '',
    })

    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const isShiftHandover = form.note_type === 'shift_handover'

    const hasVitals = useMemo(() => {
        return !!(
            latestVitals &&
            (latestVitals.bp_systolic ||
                latestVitals.temp_c ||
                latestVitals.pulse ||
                latestVitals.spo2 ||
                latestVitals.rr)
        )
    }, [latestVitals])

    const resetForm = () =>
        setForm({
            entry_time: '',
            note_type: 'routine',
            patient_condition: '',
            wound_status: '',
            oxygen_support: '',
            urine_output: '',
            drains_tubes: '',
            pain_score: '',
            other_findings: '',
            significant_events: '',
            nursing_interventions: '',
            response_progress: '',
            handover_note: '',
            shift: '',
            is_icu: false,

            vital_signs_summary: '',
            todays_procedures: '',
            current_condition: '',
            recent_changes: '',
            ongoing_treatment: '',
            watch_next_shift: '',
        })

    // ---------- Load data ----------
    const load = async () => {
        if (!admissionId) return
        setLoading(true)
        setError('')
        try {
            const [notesRes, vitalsRes] = await Promise.allSettled([
                listNursingNotes(admissionId),
                getLatestVitals(admissionId),
            ])

            if (notesRes.status === 'fulfilled') {
                setNotes(notesRes.value.data || [])
            } else {
                setError(notesRes.reason?.response?.data?.detail || 'Failed to load nursing notes')
            }

            if (vitalsRes.status === 'fulfilled') {
                setLatestVitals(vitalsRes.value.data || null)
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    // ---------- Submit ----------
    const handleChange = (field) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canPost) return
        setError('')
        setSubmitting(true)
        try {
            const payload = {
                entry_time: form.entry_time ? new Date(form.entry_time).toISOString() : undefined,
                note_type: form.note_type || 'routine',
                patient_condition: form.patient_condition || '',
                wound_status: form.wound_status || '',
                oxygen_support: form.oxygen_support || '',
                urine_output: form.urine_output || '',
                drains_tubes: form.drains_tubes || '',
                pain_score: form.pain_score || '',
                other_findings: form.other_findings || '',
                significant_events: form.significant_events || '',
                nursing_interventions: form.nursing_interventions || '',
                response_progress: form.response_progress || '',
                handover_note: form.handover_note || '',
                shift: form.shift || null,
                is_icu: !!form.is_icu,

                // Shift handover-specific content
                vital_signs_summary: form.vital_signs_summary || '',
                todays_procedures: form.todays_procedures || '',
                current_condition: form.current_condition || '',
                recent_changes: form.recent_changes || '',
                ongoing_treatment: form.ongoing_treatment || '',
                watch_next_shift: form.watch_next_shift || '',

                // Auto-link latest vitals if present
                linked_vital_id: latestVitals?.id || undefined,
            }

            await addNursingNote(admissionId, payload)
            resetForm()
            await load()
            setTab('recent')
        } catch (e1) {
            setError(e1?.response?.data?.detail || 'Failed to save nursing note')
        } finally {
            setSubmitting(false)
        }
    }

    const renderNoteTypeBadge = (note) => {
        const type = note.note_type || 'routine'
        if (type === 'incident') {
            return (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                    Incident
                </span>
            )
        }
        if (type === 'shift_handover') {
            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Shift Handover
                </span>
            )
        }
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Routine
            </span>
        )
    }

    if (!admissionId) {
        return (
            <div className="rounded-3xl bg-white/80 p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200/60">
                Select an admission to view nursing notes.
            </div>
        )
    }

    // ---------- UI ----------
    return (
        <div className="space-y-4">
            {/* Top strip: actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ClipboardList className="h-4 w-4 text-slate-700" />
                    Nursing
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-2xl bg-white/80 shadow-sm"
                        onClick={load}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RotateCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    </Button>

                    <Button
                        type="button"
                        className="h-9 rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        onClick={() => setTab('add')}
                        disabled={!canPost}
                        title={!canPost ? 'No permission to add notes' : 'Add nursing note'}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Note
                    </Button>
                </div>
            </div>

            {/* Permission banner */}
            {!canPost && (
                <div className="flex items-start gap-2 rounded-3xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200/60">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <div className="font-semibold">View-only access</div>
                        <div>You don’t have permission to add nursing notes.</div>
                    </div>
                </div>
            )}

            {/* Latest Vitals Snapshot (premium, compact, responsive) */}
            <SoftCard className="p-3 md:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-sm">
                            <HeartPulse className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">Latest Vitals Snapshot</div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                                Auto-linked to nursing note (when available)
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                            {latestVitals?.recorded_at ? formatIST(latestVitals.recorded_at) : 'No recent vitals'}
                        </span>
                    </div>
                </div>

                {hasVitals ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                            <Activity className="h-4 w-4 text-slate-700" />
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">BP</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {latestVitals.bp_systolic ?? '—'}/{latestVitals.bp_diastolic ?? '—'} mmHg
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                            <Thermometer className="h-4 w-4 text-slate-700" />
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">Temp</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {latestVitals.temp_c ?? '—'} °C
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                            <Wind className="h-4 w-4 text-slate-700" />
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">RR</div>
                                <div className="text-sm font-semibold text-slate-900">{latestVitals.rr ?? '—'}/min</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                            <Droplets className="h-4 w-4 text-slate-700" />
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">SpO₂</div>
                                <div className="text-sm font-semibold text-slate-900">{latestVitals.spo2 ?? '—'} %</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                            <Activity className="h-4 w-4 text-slate-700" />
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">Pulse</div>
                                <div className="text-sm font-semibold text-slate-900">{latestVitals.pulse ?? '—'}/min</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-600 ring-1 ring-slate-200/60">
                        No vitals recorded yet for this admission. Enter vitals in the Vitals tab — nursing notes
                        will automatically link to the latest record.
                    </div>
                )}
            </SoftCard>

            {/* Tabs: Recent + Add */}
            <SoftCard className="p-3 md:p-4">
                <UITabs value={tab} onValueChange={setTab} className="w-full">
                    <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-1.5 sm:p-2">
                        {/* Recent */}
                        <TabsTrigger
                            value="recent"
                            className={cn(
                                'shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-[12px]',
                                'data-[state=active]:bg-slate-900 data-[state=active]:text-white',
                            )}
                        >
                            <ClipboardList className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sm:hidden">Recent</span>
                            <span className="hidden sm:inline">Recent Nursing Notes</span>

                            {!!notes?.length && (
                                <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                                    {notes.length}
                                </span>
                            )}
                        </TabsTrigger>

                        {/* Add */}
                        <TabsTrigger
                            value="add"
                            disabled={!canPost}
                            className={cn(
                                'shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-[12px]',
                                'data-[state=active]:bg-slate-900 data-[state=active]:text-white',
                                'disabled:opacity-50',
                            )}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sm:hidden">Add</span>
                            <span className="hidden sm:inline">Add Nursing Note</span>
                        </TabsTrigger>
                    </TabsList>


                    {/* RECENT NOTES */}
                    <TabsContent value="recent" className="mt-3">
                        {/* Error */}
                        {error && (
                            <div className="mb-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200/60">
                                {error}
                            </div>
                        )}

                        {/* Loading skeleton */}
                        {loading && (
                            <div className="grid gap-2 md:grid-cols-2">
                                {[1, 2, 3, 4].map((k) => (
                                    <div
                                        key={k}
                                        className="h-28 animate-pulse rounded-3xl bg-slate-100 ring-1 ring-slate-200/60"
                                    />
                                ))}
                            </div>
                        )}

                        {!loading && (!notes || notes.length === 0) && (
                            <div className="rounded-3xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/60">
                                No nursing notes recorded yet.
                            </div>
                        )}

                        {!loading && notes && notes.length > 0 && (
                            <div className="grid gap-3 md:grid-cols-2">
                                {notes.map((n) => (
                                    <div
                                        key={n.id}
                                        className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/60 transition hover:shadow-md md:p-4"
                                    >
                                        {/* Header row */}
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                                    <Clock className="h-3 w-3" />
                                                    {formatIST(n.entry_time)}
                                                </span>
                                                {renderNoteTypeBadge(n)}
                                                {n.shift ? (
                                                    <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                                                        {n.shift}
                                                    </span>
                                                ) : null}
                                                {n.is_icu ? (
                                                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                                                        ICU
                                                    </span>
                                                ) : null}
                                            </div>

                                            {n.nurse ? (
                                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                                    <User className="h-3 w-3" />
                                                    <span className="max-w-[180px] truncate">{n.nurse.full_name}</span>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Vitals chips */}
                                        {n.vitals ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                                    <Activity className="h-3 w-3" />
                                                    BP {n.vitals.bp_systolic ?? '—'}/{n.vitals.bp_diastolic ?? '—'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                                    <Thermometer className="h-3 w-3" />
                                                    Temp {n.vitals.temp_c ?? '—'}°C
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                                    <Activity className="h-3 w-3" />
                                                    Pulse {n.vitals.pulse ?? '—'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                                    <Droplets className="h-3 w-3" />
                                                    SpO₂ {n.vitals.spo2 ?? '—'}%
                                                </span>
                                            </div>
                                        ) : null}

                                        {/* Content (compact, responsive grid) */}
                                        <div className="mt-3 grid gap-2 text-xs text-slate-800 sm:grid-cols-2">
                                            {n.patient_condition ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Condition
                                                    </div>
                                                    <div className="mt-0.5">{n.patient_condition}</div>
                                                </div>
                                            ) : null}

                                            {n.oxygen_support ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Oxygen
                                                    </div>
                                                    <div className="mt-0.5">{n.oxygen_support}</div>
                                                </div>
                                            ) : null}

                                            {n.wound_status ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Wound
                                                    </div>
                                                    <div className="mt-0.5">{n.wound_status}</div>
                                                </div>
                                            ) : null}

                                            {n.drains_tubes ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Drains/Tubes
                                                    </div>
                                                    <div className="mt-0.5">{n.drains_tubes}</div>
                                                </div>
                                            ) : null}

                                            {n.urine_output ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2 sm:col-span-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Urine
                                                    </div>
                                                    <div className="mt-0.5">{n.urine_output}</div>
                                                </div>
                                            ) : null}

                                            {n.pain_score ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Pain
                                                    </div>
                                                    <div className="mt-0.5">{n.pain_score}</div>
                                                </div>
                                            ) : null}

                                            {n.significant_events ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2 sm:col-span-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Events
                                                    </div>
                                                    <div className="mt-0.5">{n.significant_events}</div>
                                                </div>
                                            ) : null}

                                            {n.nursing_interventions ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2 sm:col-span-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Interventions
                                                    </div>
                                                    <div className="mt-0.5">{n.nursing_interventions}</div>
                                                </div>
                                            ) : null}

                                            {n.response_progress ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2 sm:col-span-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Response
                                                    </div>
                                                    <div className="mt-0.5">{n.response_progress}</div>
                                                </div>
                                            ) : null}

                                            {n.handover_note ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2 sm:col-span-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Handover
                                                    </div>
                                                    <div className="mt-0.5">{n.handover_note}</div>
                                                </div>
                                            ) : null}

                                            {n.other_findings ? (
                                                <div className="rounded-2xl bg-slate-50 px-3 py-2 sm:col-span-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Other
                                                    </div>
                                                    <div className="mt-0.5">{n.other_findings}</div>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Shift handover details */}
                                        {n.note_type === 'shift_handover' && (
                                            <div className="mt-3 rounded-3xl bg-amber-50/60 p-3 ring-1 ring-amber-200/60">
                                                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                                    Shift handover details
                                                </div>
                                                <div className="grid gap-2 text-xs text-slate-800 sm:grid-cols-2">
                                                    {n.vital_signs_summary ? (
                                                        <div className="rounded-2xl bg-white/70 px-3 py-2 sm:col-span-2">
                                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                Vital signs summary
                                                            </div>
                                                            <div className="mt-0.5">{n.vital_signs_summary}</div>
                                                        </div>
                                                    ) : null}
                                                    {n.todays_procedures ? (
                                                        <div className="rounded-2xl bg-white/70 px-3 py-2">
                                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                Today’s procedures
                                                            </div>
                                                            <div className="mt-0.5">{n.todays_procedures}</div>
                                                        </div>
                                                    ) : null}
                                                    {n.current_condition ? (
                                                        <div className="rounded-2xl bg-white/70 px-3 py-2">
                                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                Current condition
                                                            </div>
                                                            <div className="mt-0.5">{n.current_condition}</div>
                                                        </div>
                                                    ) : null}
                                                    {n.recent_changes ? (
                                                        <div className="rounded-2xl bg-white/70 px-3 py-2">
                                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                Recent changes
                                                            </div>
                                                            <div className="mt-0.5">{n.recent_changes}</div>
                                                        </div>
                                                    ) : null}
                                                    {n.ongoing_treatment ? (
                                                        <div className="rounded-2xl bg-white/70 px-3 py-2">
                                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                Ongoing treatment
                                                            </div>
                                                            <div className="mt-0.5">{n.ongoing_treatment}</div>
                                                        </div>
                                                    ) : null}
                                                    {n.watch_next_shift ? (
                                                        <div className="rounded-2xl bg-white/70 px-3 py-2">
                                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                Watch next shift
                                                            </div>
                                                            <div className="mt-0.5">{n.watch_next_shift}</div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ADD NOTE */}
                    <TabsContent value="add" className="mt-3">
                        {!canPost ? (
                            <div className="rounded-3xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/60">
                                You don’t have permission to add nursing notes.
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {/* Header row */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-sm">
                                            <ClipboardList className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">Add Nursing Note</div>
                                            <div className="text-[11px] text-slate-500">IST time format • Touch-friendly</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                                            Linked vitals: {latestVitals?.id ? 'Yes' : 'No'}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Form sections */}
                                <div className="grid gap-3 lg:grid-cols-2">
                                    {/* Basics */}
                                    <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200/60 md:p-4">
                                        <div className="mb-3 text-[12px] font-semibold text-slate-900">Basics</div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-600">Note type</label>
                                                <select
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                    value={form.note_type}
                                                    onChange={handleChange('note_type')}
                                                >
                                                    {NOTE_TYPE_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-600">Shift</label>
                                                <select
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                    value={form.shift}
                                                    onChange={handleChange('shift')}
                                                >
                                                    <option value="">Select shift</option>
                                                    <option value="Morning">Morning</option>
                                                    <option value="Evening">Evening</option>
                                                    <option value="Night">Night</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1 sm:col-span-2">
                                                <label className="text-[11px] font-medium text-slate-600">Entry time</label>
                                                <Input
                                                    type="datetime-local"
                                                    value={form.entry_time}
                                                    onChange={handleChange('entry_time')}
                                                    className="h-10 rounded-2xl bg-white shadow-sm"
                                                />
                                                <div className="text-[10px] text-slate-500">
                                                    Leave blank to use current date &amp; time.
                                                </div>
                                            </div>

                                            <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm ring-1 ring-slate-200/60 sm:col-span-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300"
                                                    checked={form.is_icu}
                                                    onChange={handleChange('is_icu')}
                                                />
                                                ICU note
                                            </label>
                                        </div>
                                    </div>

                                    {/* Clinical */}
                                    <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200/60 md:p-4">
                                        <div className="mb-3 text-[12px] font-semibold text-slate-900">Clinical</div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-600">Patient condition</label>
                                                <select
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                    value={form.patient_condition}
                                                    onChange={handleChange('patient_condition')}
                                                >
                                                    <option value="">Select condition</option>
                                                    {PATIENT_CONDITION_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-600">Wound status</label>
                                                <select
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                    value={form.wound_status}
                                                    onChange={handleChange('wound_status')}
                                                >
                                                    <option value="">Select wound status</option>
                                                    {WOUND_STATUS_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-600">Oxygen support</label>
                                                <select
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                    value={form.oxygen_support}
                                                    onChange={handleChange('oxygen_support')}
                                                >
                                                    <option value="">Select oxygen support</option>
                                                    {OXYGEN_SUPPORT_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-600">Drains / Tubes</label>
                                                <select
                                                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                    value={form.drains_tubes}
                                                    onChange={handleChange('drains_tubes')}
                                                >
                                                    <option value="">Select drains / tubes</option>
                                                    {DRAINS_TUBES_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1 sm:col-span-2">
                                                <label className="text-[11px] font-medium text-slate-600">Urine output</label>
                                                <Input
                                                    value={form.urine_output}
                                                    onChange={handleChange('urine_output')}
                                                    placeholder="E.g. 200 ml clear in last 4 hrs; catheter in situ"
                                                    className="h-10 rounded-2xl bg-white shadow-sm"
                                                />
                                            </div>

                                            <div className="space-y-1 sm:col-span-2">
                                                <label className="text-[11px] font-medium text-slate-600">Pain score</label>
                                                <Input
                                                    value={form.pain_score}
                                                    onChange={handleChange('pain_score')}
                                                    placeholder="E.g. 3/10 on VAS"
                                                    className="h-10 rounded-2xl bg-white shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Narrative */}
                                <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200/60 md:p-4">
                                    <div className="mb-3 text-[12px] font-semibold text-slate-900">Narrative</div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-600">Significant events</label>
                                            <textarea
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                rows={3}
                                                placeholder="Shifting, fall, vomiting, seizure, desaturation, transfusion…"
                                                value={form.significant_events}
                                                onChange={handleChange('significant_events')}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-600">Nursing interventions</label>
                                            <textarea
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                rows={3}
                                                placeholder="Medications given, oxygen started, IV fluids, dressing, catheter care…"
                                                value={form.nursing_interventions}
                                                onChange={handleChange('nursing_interventions')}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-600">Patient response / progress</label>
                                            <textarea
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                rows={3}
                                                placeholder="Improved / no change / worsened…"
                                                value={form.response_progress}
                                                onChange={handleChange('response_progress')}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-600">Handover note</label>
                                            <textarea
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                rows={3}
                                                placeholder="What next nurse must watch / continue…"
                                                value={form.handover_note}
                                                onChange={handleChange('handover_note')}
                                            />
                                        </div>

                                        <div className="space-y-1 lg:col-span-2">
                                            <label className="text-[11px] font-medium text-slate-600">Other findings</label>
                                            <textarea
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                                                rows={3}
                                                placeholder="Any other clinical observations…"
                                                value={form.other_findings}
                                                onChange={handleChange('other_findings')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Shift handover specific block */}
                                {isShiftHandover && (
                                    <div className="rounded-3xl bg-amber-50/60 p-3 ring-1 ring-amber-200/60 md:p-4">
                                        <div className="mb-3 text-[12px] font-semibold text-amber-800">
                                            Shift Handover Details
                                        </div>

                                        <div className="grid gap-3 lg:grid-cols-2">
                                            <div className="space-y-1 lg:col-span-2">
                                                <label className="text-[11px] font-medium text-slate-700">Vital signs summary</label>
                                                <textarea
                                                    className="w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                                    rows={3}
                                                    placeholder="Vitals stable, BP 120/80, HR 80/min, SpO₂ 98%…"
                                                    value={form.vital_signs_summary}
                                                    onChange={handleChange('vital_signs_summary')}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-700">Today’s procedures</label>
                                                <textarea
                                                    className="w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                                    rows={3}
                                                    value={form.todays_procedures}
                                                    onChange={handleChange('todays_procedures')}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-700">Current condition</label>
                                                <textarea
                                                    className="w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                                    rows={3}
                                                    value={form.current_condition}
                                                    onChange={handleChange('current_condition')}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-700">Recent changes</label>
                                                <textarea
                                                    className="w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                                    rows={3}
                                                    value={form.recent_changes}
                                                    onChange={handleChange('recent_changes')}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-700">Ongoing treatment</label>
                                                <textarea
                                                    className="w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                                    rows={3}
                                                    value={form.ongoing_treatment}
                                                    onChange={handleChange('ongoing_treatment')}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-medium text-slate-700">To be watched next shift</label>
                                                <textarea
                                                    className="w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                                    rows={3}
                                                    value={form.watch_next_shift}
                                                    onChange={handleChange('watch_next_shift')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {error ? (
                                        <div className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200/60">
                                            {error}
                                        </div>
                                    ) : null}

                                    <div className="ml-auto flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 rounded-2xl bg-white/80 shadow-sm"
                                            onClick={resetForm}
                                            disabled={submitting}
                                        >
                                            Reset
                                        </Button>

                                        <Button
                                            type="submit"
                                            className="h-10 rounded-2xl bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Saving…' : 'Save Note'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </TabsContent>
                </UITabs>
            </SoftCard>

            {/* (Optional) small helper note */}
            <div className="text-[11px] text-slate-500">
                Notes are stored with audit trail. Time shown in IST.
            </div>
        </div>
    )
}
