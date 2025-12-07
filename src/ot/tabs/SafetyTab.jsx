// FILE: frontend/src/ot/tabs/SafetyTab.jsx
import { useEffect, useState } from 'react'
import {
    getSafetyChecklist,
    createSafetyChecklist,
    updateSafetyChecklist,
} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import { ShieldCheck } from 'lucide-react'

// ---------- helpers for timestamps in badge ----------

function safeDate(value) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d
}

function formatDateTime(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function toTimeInput(value) {
    if (!value) return ''
    if (/^\d{2}:\d{2}$/.test(value)) return value

    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(11, 16)
    }
    return ''
}

// ---------- default phase objects ----------

const DEFAULT_SIGN_IN = {
    identity_site_procedure_consent_confirmed: false,
    site_marked: '', // 'yes' | 'no' | 'na'
    machine_and_medication_check_complete: false,
    known_allergy: '', // 'yes' | 'no'
    difficult_airway_or_aspiration_risk: '',
    blood_loss_risk_gt500ml_or_7mlkg: '',
    equipment_assistance_available: false,
    iv_central_access_and_fluids_planned: false,
}

const DEFAULT_TIME_OUT = {
    team_members_introduced: false,
    patient_name_procedure_incision_site_confirmed: false,
    antibiotic_prophylaxis_given: '', // 'yes' | 'no' | 'na'
    surgeon_critical_steps: '',
    surgeon_case_duration_estimate: '',
    surgeon_anticipated_blood_loss: '',
    anaesthetist_patient_specific_concerns: '',
    sterility_confirmed: false,
    equipment_issues_or_concerns: false,
    essential_imaging_displayed: '', // 'yes' | 'no' | 'na'
}

const DEFAULT_SIGN_OUT = {
    procedure_name_confirmed: false,
    counts_complete: false,
    specimens_labelled_correctly: false,
    equipment_problems_to_be_addressed: '',
    key_concerns_for_recovery_and_management: '',
}

const DEFAULT_FORM = {
    sign_in_done: false,
    sign_in_time: '',
    time_out_done: false,
    time_out_time: '',
    sign_out_done: false,
    sign_out_time: '',
    sign_in: DEFAULT_SIGN_IN,
    time_out: DEFAULT_TIME_OUT,
    sign_out: DEFAULT_SIGN_OUT,
}

function SafetyTab({ caseId }) {
    const canView = useCan('ot.cases.view') || useCan('ot.safety.view')
    const canEdit = useCan('ot.safety.manage') || useCan('ot.cases.update')

    const [data, setData] = useState(null)
    const [form, setForm] = useState(DEFAULT_FORM)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getSafetyChecklist(caseId)
            const s = res.data
            if (!s) {
                setData(null)
                setForm(DEFAULT_FORM)
                return
            }

            setData(s)
            setForm({
                sign_in_done: !!s.sign_in_done,
                sign_in_time: toTimeInput(s.sign_in_time),
                time_out_done: !!s.time_out_done,
                time_out_time: toTimeInput(s.time_out_time),
                sign_out_done: !!s.sign_out_done,
                sign_out_time: toTimeInput(s.sign_out_time),
                sign_in: { ...DEFAULT_SIGN_IN, ...(s.sign_in || {}) },
                time_out: { ...DEFAULT_TIME_OUT, ...(s.time_out || {}) },
                sign_out: { ...DEFAULT_SIGN_OUT, ...(s.sign_out || {}) },
            })
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
                setForm(DEFAULT_FORM)
            } else {
                console.error('Failed to load Surgical Safety checklist', err)
                setError('Failed to load Surgical Safety checklist')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view Surgical Safety Checklist.
            </div>
        )
    }

    const setField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const setPhaseField = (phase, field, value) => {
        setForm((prev) => ({
            ...prev,
            [phase]: {
                ...prev[phase],
                [field]: value,
            },
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)
        try {
            const payload = {
                sign_in_done: !!form.sign_in_done,
                sign_in_time: form.sign_in_time || null,
                time_out_done: !!form.time_out_done,
                time_out_time: form.time_out_time || null,
                sign_out_done: !!form.sign_out_done,
                sign_out_time: form.sign_out_time || null,
                sign_in: form.sign_in,
                time_out: form.time_out,
                sign_out: form.sign_out,
            }

            if (data) {
                await updateSafetyChecklist(caseId, payload)
            } else {
                await createSafetyChecklist(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save Surgical Safety checklist', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save Surgical Safety checklist'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const lastStamp = data?.updated_at || data?.created_at

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border bg-white px-4 py-3"
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                        WHO Surgical Safety Checklist
                    </span>
                </div>
                {lastStamp && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {formatDateTime(lastStamp)}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">
                    Loading Surgical Safety data...
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            {/* Phase completion + time row */}
            <div className="grid gap-3 md:grid-cols-3">
                {/* Sign-in */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Sign in (before induction)
                    </div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!form.sign_in_done}
                            disabled={!canEdit}
                            onChange={(e) => setField('sign_in_done', e.target.checked)}
                        />
                        <span>Checklist completed</span>
                    </label>
                    <div className="mt-2 space-y-1">
                        <label className="text-[11px] text-slate-600">Time</label>
                        <input
                            type="time"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.sign_in_time}
                            disabled={!canEdit}
                            onChange={(e) => setField('sign_in_time', e.target.value)}
                        />
                    </div>
                </div>

                {/* Time-out */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Time out (before skin incision)
                    </div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!form.time_out_done}
                            disabled={!canEdit}
                            onChange={(e) => setField('time_out_done', e.target.checked)}
                        />
                        <span>Checklist completed</span>
                    </label>
                    <div className="mt-2 space-y-1">
                        <label className="text-[11px] text-slate-600">Time</label>
                        <input
                            type="time"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.time_out_time}
                            disabled={!canEdit}
                            onChange={(e) => setField('time_out_time', e.target.value)}
                        />
                    </div>
                </div>

                {/* Sign-out */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Sign out (before patient leaves OT)
                    </div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!form.sign_out_done}
                            disabled={!canEdit}
                            onChange={(e) => setField('sign_out_done', e.target.checked)}
                        />
                        <span>Checklist completed</span>
                    </label>
                    <div className="mt-2 space-y-1">
                        <label className="text-[11px] text-slate-600">Time</label>
                        <input
                            type="time"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.sign_out_time}
                            disabled={!canEdit}
                            onChange={(e) => setField('sign_out_time', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* BEFORE INDUCTION (Sign-in details) */}
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Before induction of anaesthesia
                </div>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={form.sign_in.identity_site_procedure_consent_confirmed}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_in',
                                'identity_site_procedure_consent_confirmed',
                                e.target.checked,
                            )
                        }
                    />
                    <span>Patient confirmed identity, site, procedure and consent</span>
                </label>

                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[11px] text-slate-700">Is the site marked?</span>
                    {['yes', 'no', 'na'].map((v) => (
                        <label key={v} className="inline-flex items-center gap-1.5">
                            <input
                                type="radio"
                                className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={form.sign_in.site_marked === v}
                                disabled={!canEdit}
                                onChange={() =>
                                    setPhaseField('sign_in', 'site_marked', v)
                                }
                            />
                            <span className="capitalize text-[11px]">
                                {v === 'na' ? 'Not applicable' : v}
                            </span>
                        </label>
                    ))}
                </div>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={
                            form.sign_in.machine_and_medication_check_complete
                        }
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_in',
                                'machine_and_medication_check_complete',
                                e.target.checked,
                            )
                        }
                    />
                    <span>Anaesthesia machine and medication check complete</span>
                </label>

                <div className="flex flex-wrap gap-4">
                    <span className="text-[11px] text-slate-700">
                        Does the patient have a known allergy?
                    </span>
                    {['yes', 'no'].map((v) => (
                        <label key={v} className="inline-flex items-center gap-1.5">
                            <input
                                type="radio"
                                className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={form.sign_in.known_allergy === v}
                                disabled={!canEdit}
                                onChange={() =>
                                    setPhaseField('sign_in', 'known_allergy', v)
                                }
                            />
                            <span className="capitalize text-[11px]">{v}</span>
                        </label>
                    ))}
                </div>

                <div className="flex flex-wrap gap-4">
                    <span className="text-[11px] text-slate-700">
                        Difficult airway or aspiration risk?
                    </span>
                    {['yes', 'no'].map((v) => (
                        <label key={v} className="inline-flex items-center gap-1.5">
                            <input
                                type="radio"
                                className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={form.sign_in.difficult_airway_or_aspiration_risk === v}
                                disabled={!canEdit}
                                onChange={() =>
                                    setPhaseField(
                                        'sign_in',
                                        'difficult_airway_or_aspiration_risk',
                                        v,
                                    )
                                }
                            />
                            <span className="capitalize text-[11px]">{v}</span>
                        </label>
                    ))}
                </div>

                <div className="flex flex-wrap gap-4">
                    <span className="text-[11px] text-slate-700">
                        Risk of &gt; 500 ml blood loss (7 ml/kg in children)?
                    </span>
                    {['yes', 'no'].map((v) => (
                        <label key={v} className="inline-flex items-center gap-1.5">
                            <input
                                type="radio"
                                className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={form.sign_in.blood_loss_risk_gt500ml_or_7mlkg === v}
                                disabled={!canEdit}
                                onChange={() =>
                                    setPhaseField(
                                        'sign_in',
                                        'blood_loss_risk_gt500ml_or_7mlkg',
                                        v,
                                    )
                                }
                            />
                            <span className="capitalize text-[11px]">{v}</span>
                        </label>
                    ))}
                </div>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={form.sign_in.equipment_assistance_available}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_in',
                                'equipment_assistance_available',
                                e.target.checked,
                            )
                        }
                    />
                    <span>Yes, and equipment / assistance available</span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={form.sign_in.iv_central_access_and_fluids_planned}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_in',
                                'iv_central_access_and_fluids_planned',
                                e.target.checked,
                            )
                        }
                    />
                    <span>Yes, and two IV / central access and fluids planned</span>
                </label>
            </div>

            {/* BEFORE SKIN INCISION (Time-out details) */}
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Before skin incision
                </div>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={form.time_out.team_members_introduced}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'time_out',
                                'team_members_introduced',
                                e.target.checked,
                            )
                        }
                    />
                    <span>
                        All team members (nurse, anaesthetist, surgeon) have introduced
                        themselves by name and role
                    </span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={
                            form.time_out
                                .patient_name_procedure_incision_site_confirmed
                        }
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'time_out',
                                'patient_name_procedure_incision_site_confirmed',
                                e.target.checked,
                            )
                        }
                    />
                    <span>
                        Patient name, procedure, and incision site confirmed aloud
                    </span>
                </label>

                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[11px] text-slate-700">
                        Has antibiotic prophylaxis been given in last 60 minutes?
                    </span>
                    {['yes', 'no', 'na'].map((v) => (
                        <label key={v} className="inline-flex items-center gap-1.5">
                            <input
                                type="radio"
                                className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={form.time_out.antibiotic_prophylaxis_given === v}
                                disabled={!canEdit}
                                onChange={() =>
                                    setPhaseField(
                                        'time_out',
                                        'antibiotic_prophylaxis_given',
                                        v,
                                    )
                                }
                            />
                            <span className="capitalize text-[11px]">
                                {v === 'na' ? 'Not applicable' : v}
                            </span>
                        </label>
                    ))}
                </div>

                {/* To surgeon */}
                <div className="mt-1 grid gap-2 md:grid-cols-3">
                    <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-700">
                            To Surgeon – critical or non-routine steps
                        </span>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.time_out.surgeon_critical_steps}
                            disabled={!canEdit}
                            onChange={(e) =>
                                setPhaseField(
                                    'time_out',
                                    'surgeon_critical_steps',
                                    e.target.value,
                                )
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-700">
                            To Surgeon – expected case duration
                        </span>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.time_out.surgeon_case_duration_estimate}
                            disabled={!canEdit}
                            onChange={(e) =>
                                setPhaseField(
                                    'time_out',
                                    'surgeon_case_duration_estimate',
                                    e.target.value,
                                )
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-700">
                            To Surgeon – anticipated blood loss
                        </span>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={form.time_out.surgeon_anticipated_blood_loss}
                            disabled={!canEdit}
                            onChange={(e) =>
                                setPhaseField(
                                    'time_out',
                                    'surgeon_anticipated_blood_loss',
                                    e.target.value,
                                )
                            }
                        />
                    </div>
                </div>

                {/* To anaesthetist */}
                <div className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-700">
                        To Anaesthetist – patient-specific concerns
                    </span>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.time_out.anaesthetist_patient_specific_concerns}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'time_out',
                                'anaesthetist_patient_specific_concerns',
                                e.target.value,
                            )
                        }
                    />
                </div>

                {/* To nursing team */}
                <div className="grid gap-2 md:grid-cols-3">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={form.time_out.sterility_confirmed}
                            disabled={!canEdit}
                            onChange={(e) =>
                                setPhaseField(
                                    'time_out',
                                    'sterility_confirmed',
                                    e.target.checked,
                                )
                            }
                        />
                        <span>Sterility (including indicators) confirmed</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={form.time_out.equipment_issues_or_concerns}
                            disabled={!canEdit}
                            onChange={(e) =>
                                setPhaseField(
                                    'time_out',
                                    'equipment_issues_or_concerns',
                                    e.target.checked,
                                )
                            }
                        />
                        <span>Any equipment issues or concerns</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[11px] text-slate-700">
                            Essential imaging displayed?
                        </span>
                        {['yes', 'no', 'na'].map((v) => (
                            <label
                                key={v}
                                className="inline-flex items-center gap-1.5"
                            >
                                <input
                                    type="radio"
                                    className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                    checked={
                                        form.time_out.essential_imaging_displayed === v
                                    }
                                    disabled={!canEdit}
                                    onChange={() =>
                                        setPhaseField(
                                            'time_out',
                                            'essential_imaging_displayed',
                                            v,
                                        )
                                    }
                                />
                                <span className="capitalize text-[11px]">
                                    {v === 'na' ? 'Not applicable' : v}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* BEFORE PATIENT LEAVES OT (Sign-out details) */}
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Before patient leaves operating room
                </div>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={form.sign_out.procedure_name_confirmed}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_out',
                                'procedure_name_confirmed',
                                e.target.checked,
                            )
                        }
                    />
                    <span>Nurse verbally confirms the name of the procedure</span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={form.sign_out.counts_complete}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_out',
                                'counts_complete',
                                e.target.checked,
                            )
                        }
                    />
                    <span>
                        Completion of instrument, sponge and needle counts
                    </span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={form.sign_out.specimens_labelled_correctly}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_out',
                                'specimens_labelled_correctly',
                                e.target.checked,
                            )
                        }
                    />
                    <span>
                        Specimen labelling / read specimen labels aloud (including
                        patient name)
                    </span>
                </label>

                <div className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-700">
                        Whether there are any equipment problems to be addressed
                    </span>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={
                            form.sign_out.equipment_problems_to_be_addressed || ''
                        }
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_out',
                                'equipment_problems_to_be_addressed',
                                e.target.value,
                            )
                        }
                    />
                </div>

                <div className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-700">
                        To Surgeon, Anaesthetist and Nurse – key concerns for recovery
                        and management of this patient
                    </span>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={
                            form.sign_out
                                .key_concerns_for_recovery_and_management || ''
                        }
                        disabled={!canEdit}
                        onChange={(e) =>
                            setPhaseField(
                                'sign_out',
                                'key_concerns_for_recovery_and_management',
                                e.target.value,
                            )
                        }
                    />
                </div>
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save Safety checklist
                    </button>
                </div>
            )}
        </form>
    )
}

export default SafetyTab
