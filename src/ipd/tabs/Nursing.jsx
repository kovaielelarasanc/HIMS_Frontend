
// FILE: src/ipd/tabs/Nursing.jsx
import { useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react'

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

export default function Nursing({ admissionId, canWrite }) {
    // Permissions
    const canCreateFromPerm = useCan('ipd.nursing.create')
    const canPost = (canWrite ?? true) && canCreateFromPerm

    const [notes, setNotes] = useState([])
    const [latestVitals, setLatestVitals] = useState(null)

    const [form, setForm] = useState({
        entry_time: '',
        note_type: 'routine',            // 👈 NEW
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

    // ---------- Helpers ----------
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

    const formatDateTime = (dt) => {
        if (!dt) return '—'
        const d = new Date(dt)
        if (Number.isNaN(d.getTime())) return '—'
        return d.toLocaleString()
    }

    const hasVitals = useMemo(
        () => !!(latestVitals && (latestVitals.bp_systolic || latestVitals.temp_c || latestVitals.pulse)),
        [latestVitals],
    )

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
                setError(
                    notesRes.reason?.response?.data?.detail ||
                    'Failed to load nursing notes',
                )
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
    }, [admissionId])

    // ---------- Submit ----------
    const handleChange = (field) => (e) => {
        const value =
            e.target.type === 'checkbox' ? e.target.checked : e.target.value
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            const payload = {
                entry_time: form.entry_time
                    ? new Date(form.entry_time).toISOString()
                    : undefined,
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
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700">
                    Incident
                </span>
            )
        }
        if (type === 'shift_handover') {
            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                    Shift Handover
                </span>
            )
        }
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                Routine
            </span>
        )
    }

    // ---------- UI ----------
    return (
        <div className="space-y-4">
            {/* Permission banner */}
            {!canPost && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <div>
                        <div className="font-semibold">View-only access</div>
                        <div>You don’t have permission to add nursing notes.</div>
                    </div>
                </div>
            )}

            {/* Latest Vitals Snapshot */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <HeartPulse className="h-4 w-4 text-slate-700" />
                        <span className="text-sm font-semibold text-slate-800">
                            Latest Vitals Snapshot
                        </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span>
                            {latestVitals?.recorded_at
                                ? formatDateTime(latestVitals.recorded_at)
                                : 'No recent vitals'}
                        </span>
                    </div>
                </div>

                {hasVitals ? (
                    <div className="grid gap-2 text-xs md:grid-cols-5">
                        <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm">
                            <Activity className="h-3.5 w-3.5 text-slate-700" />
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                    BP
                                </div>
                                <div className="font-semibold text-slate-800">
                                    {latestVitals.bp_systolic ?? '—'}/
                                    {latestVitals.bp_diastolic ?? '—'} mmHg
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm">
                            <Thermometer className="h-3.5 w-3.5 text-slate-700" />
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                    Temp
                                </div>
                                <div className="font-semibold text-slate-800">
                                    {latestVitals.temp_c ?? '—'} °C
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm">
                            <Wind className="h-3.5 w-3.5 text-slate-700" />
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                    RR
                                </div>
                                <div className="font-semibold text-slate-800">
                                    {latestVitals.rr ?? '—'}/min
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm">
                            <Droplets className="h-3.5 w-3.5 text-slate-700" />
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                    SpO₂
                                </div>
                                <div className="font-semibold text-slate-800">
                                    {latestVitals.spo2 ?? '—'} %
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm">
                            <Activity className="h-3.5 w-3.5 text-slate-700" />
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                    Pulse
                                </div>
                                <div className="font-semibold text-slate-800">
                                    {latestVitals.pulse ?? '—'}/min
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                        No vitals recorded yet for this admission. Vitals should be entered
                        in the Vitals tab – nursing notes will automatically link to the
                        latest record.
                    </div>
                )}
            </div>

            {/* Add Note Form */}
            {canPost && (
                <form
                    onSubmit={handleSubmit}
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"
                >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-slate-700" />
                            <h3 className="text-sm font-semibold text-slate-800">
                                Add Nursing Note
                            </h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            {/* Note type */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">
                                    Note type
                                </label>
                                <select
                                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
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

                            <label className="flex items-center gap-1">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 rounded border-slate-300"
                                    checked={form.is_icu}
                                    onChange={handleChange('is_icu')}
                                />
                                <span>ICU note</span>
                            </label>
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Entry time
                            </label>
                            <input
                                type="datetime-local"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                value={form.entry_time}
                                onChange={handleChange('entry_time')}
                            />
                            <p className="text-[10px] text-slate-400">
                                Leave blank to use current date &amp; time.
                            </p>
                        </div>

                        {/* Patient condition dropdown */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Patient condition
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
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

                        {/* Wound status dropdown */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Wound status
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
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

                        {/* Oxygen support dropdown */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Oxygen support
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
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

                        {/* Urine output – free text */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Urine output
                            </label>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                placeholder="E.g. 200 ml clear in last 4 hrs; catheter in situ"
                                value={form.urine_output}
                                onChange={handleChange('urine_output')}
                            />
                        </div>

                        {/* Drains / Tubes dropdown */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Drains / Tubes
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
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

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Pain score
                            </label>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                placeholder="E.g. 3/10 on VAS"
                                value={form.pain_score}
                                onChange={handleChange('pain_score')}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Shift
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                value={form.shift}
                                onChange={handleChange('shift')}
                            >
                                <option value="">Select shift</option>
                                <option value="Morning">Morning</option>
                                <option value="Evening">Evening</option>
                                <option value="Night">Night</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Significant events
                            </label>
                            <textarea
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                rows={2}
                                placeholder="Shifting, fall, vomiting, seizure, desaturation, transfusion…"
                                value={form.significant_events}
                                onChange={handleChange('significant_events')}
                            />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Nursing interventions
                            </label>
                            <textarea
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                rows={2}
                                placeholder="Medications given, oxygen started, IV fluids, dressing, catheter care…"
                                value={form.nursing_interventions}
                                onChange={handleChange('nursing_interventions')}
                            />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Patient response / progress
                            </label>
                            <textarea
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                rows={2}
                                placeholder="Improved / no change / worsened, tolerance to interventions…"
                                value={form.response_progress}
                                onChange={handleChange('response_progress')}
                            />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Handover note
                            </label>
                            <textarea
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                rows={2}
                                placeholder="What next nurse must watch / continue…"
                                value={form.handover_note}
                                onChange={handleChange('handover_note')}
                            />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-medium text-slate-600">
                                Other findings
                            </label>
                            <textarea
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                rows={2}
                                placeholder="Any other clinical observations…"
                                value={form.other_findings}
                                onChange={handleChange('other_findings')}
                            />
                        </div>
                    </div>

                    {/* Shift handover specific block */}
                    {isShiftHandover && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 md:p-4">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Shift Handover Details
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Vital signs summary
                                    </label>
                                    <textarea
                                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        rows={2}
                                        placeholder="E.g. Vitals stable, BP 120/80, HR 80/min, SpO₂ 98% on room air…"
                                        value={form.vital_signs_summary}
                                        onChange={handleChange('vital_signs_summary')}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Today’s procedures
                                    </label>
                                    <textarea
                                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        rows={2}
                                        placeholder="Dressings, transfusions, physiotherapy, procedures done this shift…"
                                        value={form.todays_procedures}
                                        onChange={handleChange('todays_procedures')}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Current condition
                                    </label>
                                    <textarea
                                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        rows={2}
                                        placeholder="Short summary: stable / critical / pain level / oxygen support…"
                                        value={form.current_condition}
                                        onChange={handleChange('current_condition')}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Recent changes
                                    </label>
                                    <textarea
                                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        rows={2}
                                        placeholder="New symptoms, change in vitals, changes in orders this shift…"
                                        value={form.recent_changes}
                                        onChange={handleChange('recent_changes')}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Ongoing treatment
                                    </label>
                                    <textarea
                                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        rows={2}
                                        placeholder="IV fluids, antibiotics, oxygen therapy, infusions…"
                                        value={form.ongoing_treatment}
                                        onChange={handleChange('ongoing_treatment')}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        To be watched next shift
                                    </label>
                                    <textarea
                                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        rows={2}
                                        placeholder="Risks, observations, next dose timings, lab results to follow up…"
                                        value={form.watch_next_shift}
                                        onChange={handleChange('watch_next_shift')}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-2">
                        {error && (
                            <div className="text-xs text-rose-600">
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="ml-auto inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                        >
                            {submitting ? 'Saving…' : 'Add Nursing Note'}
                        </button>
                    </div>
                </form>
            )}

            {/* Notes list */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 md:px-4">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-slate-700" />
                        <span className="text-sm font-semibold text-slate-800">
                            Recent Nursing Notes
                        </span>
                    </div>
                    {loading && (
                        <span className="text-xs text-slate-500">Loading…</span>
                    )}
                </div>

                {!loading && (!notes || notes.length === 0) && (
                    <div className="px-3 py-4 text-sm text-slate-500 md:px-4">
                        No nursing notes recorded yet.
                    </div>
                )}

                {!loading && notes && notes.length > 0 && (
                    <div className="divide-y divide-slate-100">
                        {notes.map((n) => (
                            <div
                                key={n.id}
                                className="px-3 py-3 text-xs text-slate-800 md:px-4"
                            >
                                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                            <Clock className="h-3 w-3" />
                                            {formatDateTime(n.entry_time)}
                                        </span>
                                        {renderNoteTypeBadge(n)}
                                        {n.shift && (
                                            <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                                                {n.shift}
                                            </span>
                                        )}
                                        {n.is_icu && (
                                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700">
                                                ICU
                                            </span>
                                        )}
                                    </div>
                                    {n.nurse && (
                                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                            <User className="h-3 w-3" />
                                            <span>{n.nurse.full_name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Vitals summary for this note (if linked) */}
                                {n.vitals && (
                                    <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5">
                                            <Activity className="h-3 w-3" />
                                            BP:{' '}
                                            {n.vitals.bp_systolic ?? '—'}/
                                            {n.vitals.bp_diastolic ?? '—'}
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5">
                                            <Thermometer className="h-3 w-3" />
                                            Temp: {n.vitals.temp_c ?? '—'} °C
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5">
                                            <Activity className="h-3 w-3" />
                                            Pulse: {n.vitals.pulse ?? '—'}/min
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5">
                                            <Droplets className="h-3 w-3" />
                                            SpO₂: {n.vitals.spo2 ?? '—'} %
                                        </span>
                                    </div>
                                )}

                                <div className="space-y-0.5">
                                    {n.patient_condition && (
                                        <div>
                                            <span className="font-semibold">Condition: </span>
                                            <span>{n.patient_condition}</span>
                                        </div>
                                    )}
                                    {n.wound_status && (
                                        <div>
                                            <span className="font-semibold">Wound: </span>
                                            <span>{n.wound_status}</span>
                                        </div>
                                    )}
                                    {n.oxygen_support && (
                                        <div>
                                            <span className="font-semibold">Oxygen: </span>
                                            <span>{n.oxygen_support}</span>
                                        </div>
                                    )}
                                    {n.urine_output && (
                                        <div>
                                            <span className="font-semibold">Urine: </span>
                                            <span>{n.urine_output}</span>
                                        </div>
                                    )}
                                    {n.drains_tubes && (
                                        <div>
                                            <span className="font-semibold">Drains/Tubes: </span>
                                            <span>{n.drains_tubes}</span>
                                        </div>
                                    )}
                                    {n.pain_score && (
                                        <div>
                                            <span className="font-semibold">Pain: </span>
                                            <span>{n.pain_score}</span>
                                        </div>
                                    )}
                                    {n.significant_events && (
                                        <div>
                                            <span className="font-semibold">Events: </span>
                                            <span>{n.significant_events}</span>
                                        </div>
                                    )}
                                    {n.nursing_interventions && (
                                        <div>
                                            <span className="font-semibold">Interventions: </span>
                                            <span>{n.nursing_interventions}</span>
                                        </div>
                                    )}
                                    {n.response_progress && (
                                        <div>
                                            <span className="font-semibold">Response: </span>
                                            <span>{n.response_progress}</span>
                                        </div>
                                    )}
                                    {n.handover_note && (
                                        <div>
                                            <span className="font-semibold">Handover: </span>
                                            <span>{n.handover_note}</span>
                                        </div>
                                    )}
                                    {n.other_findings && (
                                        <div>
                                            <span className="font-semibold">Other: </span>
                                            <span>{n.other_findings}</span>
                                        </div>
                                    )}

                                    {/* Shift handover details display */}
                                    {n.note_type === 'shift_handover' && (
                                        <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/60 p-2 space-y-0.5">
                                            {n.vital_signs_summary && (
                                                <div>
                                                    <span className="font-semibold">Vital signs summary: </span>
                                                    <span>{n.vital_signs_summary}</span>
                                                </div>
                                            )}
                                            {n.todays_procedures && (
                                                <div>
                                                    <span className="font-semibold">Today’s procedures: </span>
                                                    <span>{n.todays_procedures}</span>
                                                </div>
                                            )}
                                            {n.current_condition && (
                                                <div>
                                                    <span className="font-semibold">Current condition: </span>
                                                    <span>{n.current_condition}</span>
                                                </div>
                                            )}
                                            {n.recent_changes && (
                                                <div>
                                                    <span className="font-semibold">Recent changes: </span>
                                                    <span>{n.recent_changes}</span>
                                                </div>
                                            )}
                                            {n.ongoing_treatment && (
                                                <div>
                                                    <span className="font-semibold">Ongoing treatment: </span>
                                                    <span>{n.ongoing_treatment}</span>
                                                </div>
                                            )}
                                            {n.watch_next_shift && (
                                                <div>
                                                    <span className="font-semibold">To be watched next shift: </span>
                                                    <span>{n.watch_next_shift}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && !canPost && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                    {error}
                </div>
            )}
        </div>
    )
}
