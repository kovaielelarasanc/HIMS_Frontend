// FILE: frontend/src/ot/tabs/SafetyTab.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react'

import { getSafetyChecklist, updateSafetyChecklist } from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import { formatIST } from '@/ipd/components/timeZONE'

// ---------- helpers ----------
function safeDate(value) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d
}
function toTimeInput(value) {
    if (!value) return ''
    if (/^\d{2}:\d{2}$/.test(value)) return value
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(11, 16)
    return ''
}
function nowHHMM() {
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
}

// ---------- defaults (must match backend schema keys) ----------
const DEFAULT_SIGN_IN = {
    identity_site_procedure_consent_confirmed: false,
    site_marked: '', // 'yes' | 'no' | 'na' | ''
    machine_and_medication_check_complete: false,
    known_allergy: '', // 'yes' | 'no' | ''
    difficult_airway_or_aspiration_risk: '', // 'yes' | 'no' | ''
    blood_loss_risk_gt500ml_or_7mlkg: '', // 'yes' | 'no' | 'na' | ''
    equipment_assistance_available: false,
    iv_central_access_and_fluids_planned: false,
}

const DEFAULT_TIME_OUT = {
    team_members_introduced: false,
    patient_name_procedure_incision_site_confirmed: false,
    antibiotic_prophylaxis_given: '', // 'yes' | 'no' | 'na' | ''
    surgeon_critical_steps: '',
    surgeon_case_duration_estimate: '',
    surgeon_anticipated_blood_loss: '',
    anaesthetist_patient_specific_concerns: '',
    sterility_confirmed: false,
    equipment_issues_or_concerns: false,
    essential_imaging_displayed: '', // 'yes' | 'no' | 'na' | ''
}

const DEFAULT_SIGN_OUT = {
    procedure_name_confirmed: false,
    counts_complete: false,
    specimens_labelled_correctly: false,
    equipment_problems_to_be_addressed: '',
    key_concerns_for_recovery_and_management: '',
}

const DEFAULT_FORM = () => ({
    sign_in_done: false,
    sign_in_time: '',
    time_out_done: false,
    time_out_time: '',
    sign_out_done: false,
    sign_out_time: '',
    sign_in: { ...DEFAULT_SIGN_IN },
    time_out: { ...DEFAULT_TIME_OUT },
    sign_out: { ...DEFAULT_SIGN_OUT },
})

function hydrateForm(s) {
    const base = DEFAULT_FORM()
    if (!s) return base
    return {
        sign_in_done: !!s.sign_in_done,
        sign_in_time: toTimeInput(s.sign_in_time),
        time_out_done: !!s.time_out_done,
        time_out_time: toTimeInput(s.time_out_time),
        sign_out_done: !!s.sign_out_done,
        sign_out_time: toTimeInput(s.sign_out_time),
        sign_in: { ...DEFAULT_SIGN_IN, ...(s.sign_in || {}) },
        time_out: { ...DEFAULT_TIME_OUT, ...(s.time_out || {}) },
        sign_out: { ...DEFAULT_SIGN_OUT, ...(s.sign_out || {}) },
    }
}

export default function SafetyTab({ caseId }) {
    // ✅ match backend perms in your router
    const canView = useCan('ot.safety.view') || useCan('ot.cases.view') || useCan('ipd.view')
    const canEdit = useCan('ot.safety.manage') || useCan('ot.cases.update') || useCan('ipd.doctor')

    const [data, setData] = useState(null)
    const [form, setForm] = useState(() => DEFAULT_FORM())
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const load = async () => {
        if (!canView || !caseId) return
        try {
            setLoading(true)
            setError(null)

            // ✅ returns null when 404 (not created yet)
            const s = await getSafetyChecklist(caseId)
            setData(s)
            setForm(hydrateForm(s))
        } catch (e) {
            console.error(e)
            setError(e?.response?.data?.detail || 'Failed to load safety checklist')
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

    const progress = useMemo(() => {
        const doneCount = [form.sign_in_done, form.time_out_done, form.sign_out_done].filter(Boolean).length
        return { done: doneCount, total: 3 }
    }, [form.sign_in_done, form.time_out_done, form.sign_out_done])

    const setPhaseField = (phase, field, value) => {
        setForm((prev) => ({ ...prev, [phase]: { ...prev[phase], [field]: value } }))
    }

    const toggleDone = (doneField, timeField) => (checked) => {
        setForm((prev) => {
            const next = { ...prev, [doneField]: checked }
            if (checked && !prev[timeField]) next[timeField] = nowHHMM()
            return next
        })
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

            // ✅ Always PUT (backend will create if missing)
            const saved = await updateSafetyChecklist(caseId, payload)
            setData(saved)
            setForm(hydrateForm(saved))
            toast.success('Safety checklist saved')
        } catch (e) {
            console.error(e)
            setError(e?.response?.data?.detail || e?.message || 'Failed to save safety checklist')
        } finally {
            setSaving(false)
        }
    }

    const lastStamp = data?.updated_at || data?.created_at

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-3 shadow-[0_18px_50px_rgba(2,6,23,0.08)] backdrop-blur-xl md:p-4"
        >
            {/* Apple Header */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-start justify-between gap-3"
            >
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900 md:text-base">
                                WHO Surgical Safety Checklist
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                Progress: {progress.done}/{progress.total}
                            </span>
                            {lastStamp ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Updated: {formatIST(lastStamp)}
                                </span>
                            ) : null}
                        </div>
                        <div className="mt-0.5 text-[12px] text-slate-500">
                            Sign-in · Time-out · Sign-out (fast + clean workflow)
                        </div>
                    </div>
                </div>

                {!canEdit ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        View only — no edit permission
                    </div>
                ) : null}
            </motion.div>

            {/* Error */}
            {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                </div>
            ) : null}

            {/* Loading */}
            {loading ? (
                <div className="space-y-2">
                    <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />
                </div>
            ) : (
                <>
                    {/* Phase Top Cards */}
                    <div className="grid gap-3 md:grid-cols-3">
                        <PhaseCard
                            title="Sign-in"
                            subtitle="Before induction"
                            done={!!form.sign_in_done}
                            time={form.sign_in_time}
                            disabled={!canEdit}
                            onDoneChange={toggleDone('sign_in_done', 'sign_in_time')}
                            onTimeChange={(v) => setForm((p) => ({ ...p, sign_in_time: v }))}
                        />
                        <PhaseCard
                            title="Time-out"
                            subtitle="Before incision"
                            done={!!form.time_out_done}
                            time={form.time_out_time}
                            disabled={!canEdit}
                            onDoneChange={toggleDone('time_out_done', 'time_out_time')}
                            onTimeChange={(v) => setForm((p) => ({ ...p, time_out_time: v }))}
                        />
                        <PhaseCard
                            title="Sign-out"
                            subtitle="Before leaving OT"
                            done={!!form.sign_out_done}
                            time={form.sign_out_time}
                            disabled={!canEdit}
                            onDoneChange={toggleDone('sign_out_done', 'sign_out_time')}
                            onTimeChange={(v) => setForm((p) => ({ ...p, sign_out_time: v }))}
                        />
                    </div>

                    {/* SIGN IN */}
                    <Section title="Sign-in">
                        <div className="grid gap-3 md:grid-cols-2">
                            <ToggleRow
                                label="Identity / site / procedure / consent confirmed"
                                checked={!!form.sign_in.identity_site_procedure_consent_confirmed}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('sign_in', 'identity_site_procedure_consent_confirmed', v)}
                            />
                            <ToggleRow
                                label="Machine & medication check complete"
                                checked={!!form.sign_in.machine_and_medication_check_complete}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('sign_in', 'machine_and_medication_check_complete', v)}
                            />
                            <SelectPills
                                label="Site marked"
                                value={form.sign_in.site_marked || ''}
                                disabled={!canEdit}
                                options={[
                                    { value: '', label: '—' },
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'no', label: 'No' },
                                    { value: 'na', label: 'N/A' },
                                ]}
                                onChange={(v) => setPhaseField('sign_in', 'site_marked', v)}
                            />
                            <SelectPills
                                label="Known allergy"
                                value={form.sign_in.known_allergy || ''}
                                disabled={!canEdit}
                                options={[
                                    { value: '', label: '—' },
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'no', label: 'No' },
                                ]}
                                onChange={(v) => setPhaseField('sign_in', 'known_allergy', v)}
                            />
                            <SelectPills
                                label="Difficult airway / aspiration risk"
                                value={form.sign_in.difficult_airway_or_aspiration_risk || ''}
                                disabled={!canEdit}
                                options={[
                                    { value: '', label: '—' },
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'no', label: 'No' },
                                ]}
                                onChange={(v) => setPhaseField('sign_in', 'difficult_airway_or_aspiration_risk', v)}
                            />
                            <SelectPills
                                label="Blood loss risk > 500 ml / 7 ml/kg"
                                value={form.sign_in.blood_loss_risk_gt500ml_or_7mlkg || ''}
                                disabled={!canEdit}
                                options={[
                                    { value: '', label: '—' },
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'no', label: 'No' },
                                    { value: 'na', label: 'N/A' },
                                ]}
                                onChange={(v) => setPhaseField('sign_in', 'blood_loss_risk_gt500ml_or_7mlkg', v)}
                            />
                            <ToggleRow
                                label="Equipment / assistance available"
                                checked={!!form.sign_in.equipment_assistance_available}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('sign_in', 'equipment_assistance_available', v)}
                            />
                            <ToggleRow
                                label="IV / central access & fluids planned"
                                checked={!!form.sign_in.iv_central_access_and_fluids_planned}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('sign_in', 'iv_central_access_and_fluids_planned', v)}
                            />
                        </div>
                    </Section>

                    {/* TIME OUT */}
                    <Section title="Time-out">
                        <div className="grid gap-3 md:grid-cols-2">
                            <ToggleRow
                                label="Team members introduced"
                                checked={!!form.time_out.team_members_introduced}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('time_out', 'team_members_introduced', v)}
                            />
                            <ToggleRow
                                label="Patient name / procedure / incision site confirmed"
                                checked={!!form.time_out.patient_name_procedure_incision_site_confirmed}
                                disabled={!canEdit}
                                onChange={(v) =>
                                    setPhaseField('time_out', 'patient_name_procedure_incision_site_confirmed', v)
                                }
                            />
                            <SelectPills
                                label="Antibiotic prophylaxis given"
                                value={form.time_out.antibiotic_prophylaxis_given || ''}
                                disabled={!canEdit}
                                options={[
                                    { value: '', label: '—' },
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'no', label: 'No' },
                                    { value: 'na', label: 'N/A' },
                                ]}
                                onChange={(v) => setPhaseField('time_out', 'antibiotic_prophylaxis_given', v)}
                            />
                            <SelectPills
                                label="Essential imaging displayed"
                                value={form.time_out.essential_imaging_displayed || ''}
                                disabled={!canEdit}
                                options={[
                                    { value: '', label: '—' },
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'no', label: 'No' },
                                    { value: 'na', label: 'N/A' },
                                ]}
                                onChange={(v) => setPhaseField('time_out', 'essential_imaging_displayed', v)}
                            />
                            <TextArea
                                label="Surgeon – critical steps"
                                value={form.time_out.surgeon_critical_steps}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('time_out', 'surgeon_critical_steps', v)}
                            />
                            <TextArea
                                label="Surgeon – duration estimate"
                                value={form.time_out.surgeon_case_duration_estimate}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('time_out', 'surgeon_case_duration_estimate', v)}
                            />
                            <TextArea
                                label="Surgeon – anticipated blood loss"
                                value={form.time_out.surgeon_anticipated_blood_loss}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('time_out', 'surgeon_anticipated_blood_loss', v)}
                            />
                            <TextArea
                                label="Anaesthetist – patient concerns"
                                value={form.time_out.anaesthetist_patient_specific_concerns}
                                disabled={!canEdit}
                                onChange={(v) =>
                                    setPhaseField('time_out', 'anaesthetist_patient_specific_concerns', v)
                                }
                            />
                            <ToggleRow
                                label="Sterility confirmed"
                                checked={!!form.time_out.sterility_confirmed}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('time_out', 'sterility_confirmed', v)}
                            />
                            <ToggleRow
                                label="Equipment issues / concerns"
                                checked={!!form.time_out.equipment_issues_or_concerns}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('time_out', 'equipment_issues_or_concerns', v)}
                            />
                        </div>
                    </Section>

                    {/* SIGN OUT */}
                    <Section title="Sign-out">
                        <div className="grid gap-3 md:grid-cols-2">
                            <ToggleRow
                                label="Procedure name confirmed"
                                checked={!!form.sign_out.procedure_name_confirmed}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('sign_out', 'procedure_name_confirmed', v)}
                            />
                            <ToggleRow
                                label="Counts complete"
                                checked={!!form.sign_out.counts_complete}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('sign_out', 'counts_complete', v)}
                            />
                            <ToggleRow
                                label="Specimens labelled correctly"
                                checked={!!form.sign_out.specimens_labelled_correctly}
                                disabled={!canEdit}
                                onChange={(v) => setPhaseField('sign_out', 'specimens_labelled_correctly', v)}
                            />
                            <TextArea
                                label="Equipment problems to be addressed"
                                value={form.sign_out.equipment_problems_to_be_addressed}
                                disabled={!canEdit}
                                onChange={(v) =>
                                    setPhaseField('sign_out', 'equipment_problems_to_be_addressed', v)
                                }
                            />
                            <TextArea
                                label="Key concerns for recovery & management"
                                value={form.sign_out.key_concerns_for_recovery_and_management}
                                disabled={!canEdit}
                                onChange={(v) =>
                                    setPhaseField('sign_out', 'key_concerns_for_recovery_and_management', v)
                                }
                            />
                        </div>
                    </Section>

                    {/* Save */}
                    {canEdit ? (
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? (
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-b-transparent" />
                                ) : (
                                    <Clock3 className="h-4 w-4 opacity-80" />
                                )}
                                Save safety checklist
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </form>
    )
}

/* ----------------- UI Helpers ----------------- */

function PhaseCard({ title, subtitle, done, time, onDoneChange, onTimeChange, disabled }) {
    return (
        <div
            className={
                'rounded-3xl border p-3 shadow-sm ' +
                (done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/60')
            }
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {title}
                    </div>
                    <div className="text-[12px] text-slate-600">{subtitle}</div>
                </div>

                <label className="inline-flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        checked={!!done}
                        disabled={disabled}
                        onChange={(e) => onDoneChange(e.target.checked)}
                    />
                    <span className="text-[11px] font-semibold text-slate-700">Done</span>
                </label>
            </div>

            <div className="mt-2">
                <div className="text-[11px] font-semibold text-slate-700">Time</div>
                <input
                    type="time"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                    value={time || ''}
                    disabled={disabled}
                    onChange={(e) => onTimeChange(e.target.value)}
                />
            </div>
        </div>
    )
}

function Section({ title, children }) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {title}
            </div>
            {children}
        </div>
    )
}

function ToggleRow({ label, checked, onChange, disabled }) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
            <span className="font-medium text-slate-800">{label}</span>
            <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                checked={!!checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
        </label>
    )
}

function SelectPills({ label, value, options, onChange, disabled }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-slate-700">{label}</div>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const active = (value || '') === opt.value
                    return (
                        <button
                            key={opt.value || 'empty'}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(opt.value)}
                            className={
                                'rounded-full px-3 py-1 text-[11px] font-semibold transition ' +
                                (active
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200') +
                                ' disabled:cursor-not-allowed disabled:opacity-60'
                            }
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function TextArea({ label, value, onChange, disabled, rows = 2 }) {
    return (
        <label className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <textarea
                rows={rows}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                placeholder="—"
            />
        </label>
    )
}
