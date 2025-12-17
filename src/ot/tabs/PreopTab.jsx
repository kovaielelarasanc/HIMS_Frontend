// FILE: frontend/src/ot/tabs/PreopTab.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    getPreOpChecklist,
    createPreOpChecklist,
    updatePreOpChecklist,
} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import { ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ----------------- CONFIG -----------------

const CHECKLIST_ITEMS = [
    { key: 'allergy', label: 'Allergy' },
    { key: 'consent_form_signed', label: 'Consent form signed' },
    { key: 'written_high_risk_signed', label: 'Written high risk form signed' },
    { key: 'identity_bands_checked', label: 'Identity bands checked' },
    { key: 'npo', label: 'Nill per mouth (NPO)' },
    { key: 'pre_medication_given', label: 'Pre-medication given' },
    { key: 'test_dose_given', label: 'Test dose given' },
    { key: 'bowel_preparation', label: 'Bowel preparation' },
    { key: 'bladder_empty_time', label: 'Bladder empty time' },
    { key: 'serology_results', label: 'Serology results' },
    { key: 'blood_grouping', label: 'Blood grouping' },
    { key: 'blood_reservation', label: 'Blood reservation' },
    {
        key: 'patient_files_with_records',
        label: 'Patient IP/OP files, ECG / X-ray with old records',
    },
    { key: 'pre_anaesthetic_evaluation', label: 'Pre-anaesthetic evaluation' },
    {
        key: 'jewellery_nailpolish_removed',
        label: 'Jewellery, nail polish, make-up removed',
    },
    {
        key: 'prosthesis_dentures_wig_contactlens_removed',
        label: 'Prosthesis / dentures / wig / contact lens removed',
    },
    { key: 'sterile_preparation_done', label: 'Sterile preparation done' },
]

const DEFAULT_FORM = () => ({
    checklist: CHECKLIST_ITEMS.reduce((acc, item) => {
        acc[item.key] = { handover: false, receiving: false, comments: '' }
        return acc
    }, {}),
    investigations: {
        hb: '',
        platelet: '',
        urea: '',
        creatinine: '',
        potassium: '',
        rbs: '',
        other: '',
    },
    vitals: {
        temp: '',
        pulse: '',
        resp: '',
        bp: '',
        spo2: '',
        height: '',
        weight: '',
    },
    shave_completed: null, // 'yes' | 'no' | null
    nurse_signature: '',
})

// --- hydrate from backend ----
const hydrateForm = (incoming) => {
    const base = DEFAULT_FORM()
    if (!incoming || typeof incoming !== 'object') return base

    const form = { ...base }

    // 1) checklist from backend if present
    if (incoming.checklist && typeof incoming.checklist === 'object') {
        form.checklist = { ...base.checklist, ...incoming.checklist }
    }

    // 2) summary booleans into checklist
    if ('patient_identity_confirmed' in incoming) {
        form.checklist.identity_bands_checked = {
            ...form.checklist.identity_bands_checked,
            handover: !!incoming.patient_identity_confirmed,
        }
    }
    if ('consent_checked' in incoming) {
        form.checklist.consent_form_signed = {
            ...form.checklist.consent_form_signed,
            handover: !!incoming.consent_checked,
        }
    }
    if ('investigations_checked' in incoming) {
        form.checklist.patient_files_with_records = {
            ...form.checklist.patient_files_with_records,
            handover: !!incoming.investigations_checked,
        }
    }
    if ('blood_products_arranged' in incoming) {
        form.checklist.blood_reservation = {
            ...form.checklist.blood_reservation,
            handover: !!incoming.blood_products_arranged,
        }
    }
    if ('implants_available' in incoming) {
        form.checklist.prosthesis_dentures_wig_contactlens_removed = {
            ...form.checklist.prosthesis_dentures_wig_contactlens_removed,
            handover: !!incoming.implants_available,
        }
    }
    if ('site_marked' in incoming) {
        form.checklist.pre_anaesthetic_evaluation = {
            ...form.checklist.pre_anaesthetic_evaluation,
            handover: !!incoming.site_marked,
        }
    }

    // 3) comments mapping
    if (incoming.fasting_status) {
        form.checklist.npo = {
            ...form.checklist.npo,
            comments: incoming.fasting_status,
        }
    }
    if (incoming.device_checks) {
        form.checklist.pre_anaesthetic_evaluation = {
            ...form.checklist.pre_anaesthetic_evaluation,
            comments: incoming.device_checks,
        }
    }
    if (incoming.notes) {
        form.checklist.sterile_preparation_done = {
            ...form.checklist.sterile_preparation_done,
            comments: incoming.notes,
        }
    }

    // 4) investigations / vitals / extras
    if (incoming.investigations) {
        form.investigations = { ...base.investigations, ...incoming.investigations }
    }
    if (incoming.vitals) {
        form.vitals = { ...base.vitals, ...incoming.vitals }
    }
    if ('shave_completed' in incoming) {
        form.shave_completed = incoming.shave_completed
    }
    if ('nurse_signature' in incoming) {
        form.nurse_signature = incoming.nurse_signature || ''
    }

    return form
}

// ----------------- COMPONENT -----------------

function PreopTab({ caseId }) {
    const canView =
        useCan('ot.preop_checklist.view') || useCan('ot.cases.view') || useCan('ipd.view')

    const canEdit =
        useCan('ot.preop_checklist.update') ||
        useCan('ot.preop_checklist.create') ||
        useCan('ot.cases.update') ||
        useCan('ipd.doctor')

    const [record, setRecord] = useState(null)
    const [form, setForm] = useState(() => DEFAULT_FORM())
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)

            const raw = await getPreOpChecklist(caseId)
            const rec = raw?.data ?? raw

            if (!rec) {
                setRecord(null)
                setForm(DEFAULT_FORM())
                return
            }

            setRecord(rec)
            setForm(hydrateForm(rec))
        } catch (err) {
            if (err?.response?.status === 404) {
                setRecord(null)
                setForm(DEFAULT_FORM())
            } else {
                console.error('Failed to load Pre-op checklist', err)
                setError('Failed to load Pre-op checklist')
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
                You do not have permission to view pre-operative checklists.
            </div>
        )
    }

    const handleChecklistChange = (key, field, value) => {
        setForm((prev) => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                [key]: {
                    ...prev.checklist[key],
                    [field]: value,
                },
            },
        }))
    }

    const handleInvestigationChange = (field, value) => {
        setForm((prev) => ({
            ...prev,
            investigations: { ...prev.investigations, [field]: value },
        }))
    }

    const handleVitalChange = (field, value) => {
        setForm((prev) => ({
            ...prev,
            vitals: { ...prev.vitals, [field]: value },
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)

        try {
            const payload = {
                checklist: form.checklist,
                investigations: { ...form.investigations },
                vitals: { ...form.vitals },
                shave_completed: form.shave_completed,
                nurse_signature: form.nurse_signature || null,

                // mapped summary fields used by backend
                patient_identity_confirmed: !!form.checklist.identity_bands_checked.handover,
                consent_checked: !!form.checklist.consent_form_signed.handover,
                investigations_checked: !!form.checklist.patient_files_with_records.handover,
                blood_products_arranged: !!form.checklist.blood_reservation.handover,
                implants_available:
                    !!form.checklist.prosthesis_dentures_wig_contactlens_removed.handover,
                site_marked: !!form.checklist.pre_anaesthetic_evaluation.handover,
                fasting_status: form.checklist.npo.comments || null,
                device_checks: form.checklist.pre_anaesthetic_evaluation.comments || null,
                notes: form.checklist.sterile_preparation_done.comments || null,

                completed: false,
            }

            if (record) await updatePreOpChecklist(caseId, payload)
            else await createPreOpChecklist(caseId, payload)

            await load()
        } catch (err) {
            console.error('Failed to save Pre-op checklist', err)
            const msg =
                err?.response?.data?.detail || err?.message || 'Failed to save Pre-op checklist'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const lastStamp = record?.completed_at || record?.updated_at || record?.created_at

    const progress = useMemo(() => {
        const total = CHECKLIST_ITEMS.length
        let h = 0
        let r = 0
        for (const it of CHECKLIST_ITEMS) {
            const row = form.checklist?.[it.key] || {}
            if (row.handover) h += 1
            if (row.receiving) r += 1
        }
        return { total, h, r }
    }, [form.checklist])

    // ----------------- UI -----------------
    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-3xl border border-slate-500 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
        >
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-start justify-between gap-2"
            >
                <div className="flex items-start gap-2 text-sky-800">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                        <ClipboardCheck className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold md:text-base">Pre-operative checklist</span>
                        <span className="text-[11px] text-slate-500">
                            Checklist · Investigations · Vitals · Body shave · Signature
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        Handover: <span className="font-semibold">{progress.h}</span>/{progress.total}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        Receiving: <span className="font-semibold">{progress.r}</span>/{progress.total}
                    </span>
                    {lastStamp ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Last saved: {new Date(lastStamp).toLocaleString()}
                        </span>
                    ) : null}
                </div>
            </motion.div>

            {/* Loading */}
            {loading && (
                <div className="space-y-2">
                    <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                    <span>{error}</span>
                </div>
            )}

            {!loading && (
                <>
                    {/* =======================
              CHECKLIST (aligned)
              ======================= */}
                    <SectionCard
                        title="Checklist"
                        subtitle="Aligned handover & receiving with comments (desktop table, mobile cards)."
                    >
                        {/* Desktop header row */}
                        <div className="hidden md:grid md:grid-cols-[minmax(260px,1fr)_120px_120px_minmax(260px,1fr)] md:gap-3 md:rounded-2xl md:border md:border-slate-500 md:bg-white md:px-3 md:py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Item
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Handover
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Receiving
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Comments
                            </div>
                        </div>

                        <AnimatePresence initial={false}>
                            {CHECKLIST_ITEMS.map((item, idx) => {
                                const row = form.checklist[item.key]
                                const active = !!row?.handover || !!row?.receiving || !!row?.comments

                                return (
                                    <motion.div
                                        key={item.key}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.14, delay: idx * 0.006 }}
                                        className={
                                            'rounded-2xl border px-3 py-3 ' +
                                            (active ? 'border-sky-200 bg-sky-50/60' : 'border-slate-500 bg-slate-50/50')
                                        }
                                    >
                                        {/* Desktop aligned grid */}
                                        <div className="hidden md:grid md:grid-cols-[minmax(260px,1fr)_120px_120px_minmax(260px,1fr)] md:items-center md:gap-3">
                                            <div className="text-[13px] font-semibold text-slate-900">
                                                {item.label}
                                            </div>

                                            <div className="flex items-center">
                                                <CheckToggle
                                                    label="Handover"
                                                    checked={!!row.handover}
                                                    disabled={!canEdit}
                                                    onChange={(v) => handleChecklistChange(item.key, 'handover', v)}
                                                />
                                            </div>

                                            <div className="flex items-center">
                                                <CheckToggle
                                                    label="Receiving"
                                                    checked={!!row.receiving}
                                                    disabled={!canEdit}
                                                    onChange={(v) => handleChecklistChange(item.key, 'receiving', v)}
                                                />
                                            </div>

                                            <div>
                                                <InlineInput
                                                    value={row.comments || ''}
                                                    disabled={!canEdit}
                                                    placeholder="Comments / remarks"
                                                    onChange={(v) => handleChecklistChange(item.key, 'comments', v)}
                                                />
                                            </div>
                                        </div>

                                        {/* Mobile (stacked, still clean) */}
                                        <div className="md:hidden">
                                            <div className="text-[13px] font-semibold text-slate-900">
                                                {item.label}
                                            </div>

                                            <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                                        checked={!!row.handover}
                                                        disabled={!canEdit}
                                                        onChange={(e) =>
                                                            handleChecklistChange(item.key, 'handover', e.target.checked)
                                                        }
                                                    />
                                                    <span className="font-medium text-slate-700">Handover</span>
                                                </label>

                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                                        checked={!!row.receiving}
                                                        disabled={!canEdit}
                                                        onChange={(e) =>
                                                            handleChecklistChange(item.key, 'receiving', e.target.checked)
                                                        }
                                                    />
                                                    <span className="font-medium text-slate-700">Receiving</span>
                                                </label>
                                            </div>

                                            <div className="mt-2">
                                                <InlineInput
                                                    value={row.comments || ''}
                                                    disabled={!canEdit}
                                                    placeholder="Comments / remarks"
                                                    onChange={(v) => handleChecklistChange(item.key, 'comments', v)}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </SectionCard>

                    {/* =======================
              INVESTIGATIONS + VITALS
              ======================= */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <SectionCard title="Investigations" subtitle="Enter latest lab values (as available).">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <MiniField
                                    label="HB"
                                    value={form.investigations.hb}
                                    disabled={!canEdit}
                                    onChange={(v) => handleInvestigationChange('hb', v)}
                                />
                                <MiniField
                                    label="Platelet"
                                    value={form.investigations.platelet}
                                    disabled={!canEdit}
                                    onChange={(v) => handleInvestigationChange('platelet', v)}
                                />
                                <MiniField
                                    label="Urea"
                                    value={form.investigations.urea}
                                    disabled={!canEdit}
                                    onChange={(v) => handleInvestigationChange('urea', v)}
                                />
                                <MiniField
                                    label="Creatinine"
                                    value={form.investigations.creatinine}
                                    disabled={!canEdit}
                                    onChange={(v) => handleInvestigationChange('creatinine', v)}
                                />
                                <MiniField
                                    label="Potassium"
                                    value={form.investigations.potassium}
                                    disabled={!canEdit}
                                    onChange={(v) => handleInvestigationChange('potassium', v)}
                                />
                                <MiniField
                                    label="RBS"
                                    value={form.investigations.rbs}
                                    disabled={!canEdit}
                                    onChange={(v) => handleInvestigationChange('rbs', v)}
                                />
                                <div className="sm:col-span-2">
                                    <MiniField
                                        label="Other"
                                        value={form.investigations.other}
                                        disabled={!canEdit}
                                        onChange={(v) => handleInvestigationChange('other', v)}
                                    />
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Vitals" subtitle="Pre-op vitals summary (as recorded).">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <MiniField
                                    label="Temp"
                                    value={form.vitals.temp}
                                    disabled={!canEdit}
                                    onChange={(v) => handleVitalChange('temp', v)}
                                />
                                <MiniField
                                    label="Pulse"
                                    value={form.vitals.pulse}
                                    disabled={!canEdit}
                                    onChange={(v) => handleVitalChange('pulse', v)}
                                />
                                <MiniField
                                    label="Resp"
                                    value={form.vitals.resp}
                                    disabled={!canEdit}
                                    onChange={(v) => handleVitalChange('resp', v)}
                                />
                                <MiniField
                                    label="BP"
                                    value={form.vitals.bp}
                                    disabled={!canEdit}
                                    onChange={(v) => handleVitalChange('bp', v)}
                                />
                                <MiniField
                                    label="SpO₂"
                                    value={form.vitals.spo2}
                                    disabled={!canEdit}
                                    onChange={(v) => handleVitalChange('spo2', v)}
                                />
                                <MiniField
                                    label="Height"
                                    value={form.vitals.height}
                                    disabled={!canEdit}
                                    onChange={(v) => handleVitalChange('height', v)}
                                />
                                <MiniField
                                    label="Weight"
                                    value={form.vitals.weight}
                                    disabled={!canEdit}
                                    onChange={(v) => handleVitalChange('weight', v)}
                                />
                            </div>
                        </SectionCard>
                    </div>

                    {/* =======================
              SHAVE + SIGNATURE
              ======================= */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <SectionCard
                            title="Body shave"
                            subtitle="Record shave completion status (for site preparation)."
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <PillChoice
                                    active={form.shave_completed === 'yes'}
                                    disabled={!canEdit}
                                    onClick={() => setForm((p) => ({ ...p, shave_completed: 'yes' }))}
                                >
                                    Yes
                                </PillChoice>
                                <PillChoice
                                    active={form.shave_completed === 'no'}
                                    disabled={!canEdit}
                                    onClick={() => setForm((p) => ({ ...p, shave_completed: 'no' }))}
                                >
                                    No
                                </PillChoice>
                                <PillChoice
                                    active={form.shave_completed === null}
                                    disabled={!canEdit}
                                    onClick={() => setForm((p) => ({ ...p, shave_completed: null }))}
                                >
                                    Not recorded
                                </PillChoice>
                            </div>

                            <p className="mt-2 text-[11px] text-slate-500">
                                (Body diagram marking can be handled at PDF / print level.)
                            </p>
                        </SectionCard>

                        <SectionCard
                            title="Nurse signature"
                            subtitle="Signature with name (handover / receiving nurse)."
                        >
                            <MiniField
                                label="Name & signature"
                                value={form.nurse_signature}
                                disabled={!canEdit}
                                placeholder="Enter nurse name / signature"
                                onChange={(v) => setForm((p) => ({ ...p, nurse_signature: v }))}
                            />
                        </SectionCard>
                    </div>

                    {/* Save button */}
                    {canEdit && (
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-600 bg-sky-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving && (
                                    <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                                )}
                                Save Pre-op checklist
                            </button>
                        </div>
                    )}
                </>
            )}
        </form>
    )
}

export default PreopTab

// ----------------- UI HELPERS -----------------

function SectionCard({ title, subtitle, children }) {
    return (
        <div className="rounded-3xl border border-slate-500 bg-slate-50/60 p-3 md:p-4">
            <div className="mb-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {title}
                </div>
                {subtitle ? <div className="text-[12px] text-slate-600">{subtitle}</div> : null}
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    )
}

function InlineInput({ value, onChange, placeholder, disabled }) {
    return (
        <input
            type="text"
            className="w-full rounded-2xl border border-slate-500 bg-white px-3 py-2 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            value={value ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
        />
    )
}

function MiniField({ label, value, onChange, placeholder, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="text"
                className="h-10 w-full rounded-2xl border border-slate-500 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function CheckToggle({ checked, onChange, disabled }) {
    return (
        <label className="inline-flex items-center gap-2">
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

function PillChoice({ active, onClick, disabled, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={
                'rounded-full px-3 py-1.5 text-[12px] font-semibold transition ' +
                (active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100') +
                ' disabled:cursor-not-allowed disabled:opacity-60'
            }
        >
            {children}
        </button>
    )
}
