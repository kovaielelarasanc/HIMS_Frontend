// FILE: frontend/src/ot/tabs/PreopTab.jsx
import React, { useEffect, useState } from 'react'
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
    {
        key: 'pre_anaesthetic_evaluation',
        label: 'Pre-anaesthetic evaluation',
    },
    {
        key: 'jewellery_nailpolish_removed',
        label: 'Jewellery, nail polish, make-up removed',
    },
    {
        key: 'prosthesis_dentures_wig_contactlens_removed',
        label: 'Prosthesis / dentures / wig / contact lens removed',
    },
    {
        key: 'sterile_preparation_done',
        label: 'Sterile preparation done',
    },
]

const DEFAULT_FORM = () => ({
    checklist: CHECKLIST_ITEMS.reduce((acc, item) => {
        acc[item.key] = {
            handover: false,
            receiving: false,
            comments: '',
        }
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
    shave_completed: null,
    nurse_signature: '',
})

// --- hydrate from backend ----
const hydrateForm = (incoming) => {
    const base = DEFAULT_FORM()
    if (!incoming || typeof incoming !== 'object') return base

    const form = { ...base }

    // 1) checklist from backend if present
    if (incoming.checklist && typeof incoming.checklist === 'object') {
        form.checklist = {
            ...base.checklist,
            ...incoming.checklist,
        }
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
        form.investigations = {
            ...base.investigations,
            ...incoming.investigations,
        }
    }
    if (incoming.vitals) {
        form.vitals = {
            ...base.vitals,
            ...incoming.vitals,
        }
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
        useCan('ot.cases.view') || useCan('ot.preop_checklist.view')
    const canEdit =
        useCan('ot.preop_checklist.update') ||
        useCan('ot.preop_checklist.create') ||
        useCan('ot.cases.update')

    const [record, setRecord] = useState(null)
    const [form, setForm] = useState(DEFAULT_FORM)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)

            const rec = await getPreOpChecklist(caseId)
            console.log('[PreOp] loaded record', rec)

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
            investigations: {
                ...prev.investigations,
                [field]: value,
            },
        }))
    }

    const handleVitalChange = (field, value) => {
        setForm((prev) => ({
            ...prev,
            vitals: {
                ...prev.vitals,
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
                checklist: form.checklist,
                investigations: { ...form.investigations },
                vitals: { ...form.vitals },
                shave_completed: form.shave_completed,
                nurse_signature: form.nurse_signature || null,

                patient_identity_confirmed:
                    !!form.checklist.identity_bands_checked.handover,
                consent_checked:
                    !!form.checklist.consent_form_signed.handover,
                investigations_checked:
                    !!form.checklist.patient_files_with_records.handover,
                blood_products_arranged:
                    !!form.checklist.blood_reservation.handover,
                implants_available:
                    !!form.checklist
                        .prosthesis_dentures_wig_contactlens_removed.handover,
                site_marked:
                    !!form.checklist.pre_anaesthetic_evaluation.handover,
                fasting_status: form.checklist.npo.comments || null,
                device_checks:
                    form.checklist.pre_anaesthetic_evaluation.comments || null,
                notes:
                    form.checklist.sterile_preparation_done.comments || null,

                completed: false,
            }

            if (record) {
                await updatePreOpChecklist(caseId, payload)
            } else {
                await createPreOpChecklist(caseId, payload)
            }

            await load()
        } catch (err) {
            console.error('Failed to save Pre-op checklist', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save Pre-op checklist'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const lastStamp =
        record?.completed_at || record?.updated_at || record?.created_at

    // ----------------- UI (Card based, mobile friendly) -----------------
    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
        >
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-2"
            >
                <div className="flex items-center gap-2 text-sky-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                        <ClipboardCheck className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold md:text-base">
                            Pre-operative checklist
                        </span>
                        <span className="text-[11px] text-slate-500">
                            Aligns with OT pre-op safety form (handover & receiving).
                        </span>
                    </div>
                </div>
                {lastStamp && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Last saved: {new Date(lastStamp).toLocaleString()}
                    </span>
                )}
            </motion.div>

            {/* Loading state */}
            {loading && (
                <div className="space-y-2">
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Checklist cards */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Checklist items</span>
                    <span className="hidden gap-4 md:flex">
                        <span>Handover</span>
                        <span>Receiving</span>
                    </span>
                </div>

                <AnimatePresence initial={false}>
                    {CHECKLIST_ITEMS.map((item, idx) => {
                        const row = form.checklist[item.key]
                        const isChecked = row.handover || row.receiving
                        return (
                            <motion.div
                                key={item.key}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.16, delay: idx * 0.01 }}
                                className={`rounded-2xl border px-3 py-2.5 text-xs md:px-3.5 md:py-3 ${isChecked
                                        ? 'border-sky-200 bg-sky-50/80'
                                        : 'border-slate-200 bg-slate-50/60'
                                    }`}
                            >
                                {/* Item + toggles */}
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div className="flex-1">
                                        <div className="text-[13px] font-semibold text-slate-900">
                                            {item.label}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-[11px] md:gap-4">
                                        {/* Handover */}
                                        <label className="inline-flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                                checked={!!row.handover}
                                                disabled={!canEdit}
                                                onChange={(e) =>
                                                    handleChecklistChange(
                                                        item.key,
                                                        'handover',
                                                        e.target.checked,
                                                    )
                                                }
                                            />
                                            <span className="font-medium text-slate-700">
                                                Handover
                                            </span>
                                        </label>

                                        {/* Receiving */}
                                        <label className="inline-flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                                checked={!!row.receiving}
                                                disabled={!canEdit}
                                                onChange={(e) =>
                                                    handleChecklistChange(
                                                        item.key,
                                                        'receiving',
                                                        e.target.checked,
                                                    )
                                                }
                                            />
                                            <span className="font-medium text-slate-700">
                                                Receiving
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Comments */}
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        placeholder="Comments / remarks"
                                        value={row.comments || ''}
                                        disabled={!canEdit}
                                        onChange={(e) =>
                                            handleChecklistChange(
                                                item.key,
                                                'comments',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* Investigations & Vitals – cards */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Investigations */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Investigations
                    </div>
                    {[
                        ['hb', 'HB'],
                        ['platelet', 'Platelet'],
                        ['urea', 'Urea'],
                        ['creatinine', 'Creatinine'],
                        ['potassium', 'Potassium'],
                        ['rbs', 'RBS'],
                        ['other', 'Others'],
                    ].map(([key, label]) => (
                        <div key={key} className="flex items-center gap-2">
                            <span className="w-24 text-[11px] font-medium text-slate-700">
                                {label} :
                            </span>
                            <input
                                type="text"
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={form.investigations[key]}
                                disabled={!canEdit}
                                onChange={(e) =>
                                    handleInvestigationChange(
                                        key,
                                        e.target.value,
                                    )
                                }
                            />
                        </div>
                    ))}
                </motion.div>

                {/* Vitals */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Vitals
                    </div>
                    {[
                        ['temp', 'Temp'],
                        ['pulse', 'Pulse'],
                        ['resp', 'Resp'],
                        ['bp', 'BP'],
                        ['spo2', 'SpO₂'],
                        ['height', 'Height'],
                        ['weight', 'Weight'],
                    ].map(([key, label]) => (
                        <div key={key} className="flex items-center gap-2">
                            <span className="w-24 text-[11px] font-medium text-slate-700">
                                {label} :
                            </span>
                            <input
                                type="text"
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={form.vitals[key]}
                                disabled={!canEdit}
                                onChange={(e) =>
                                    handleVitalChange(key, e.target.value)
                                }
                            />
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Shave + Signature */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Shave */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                >
                    <div className="text-xs font-semibold text-slate-700">
                        Shave completed
                    </div>
                    <div className="flex gap-4 text-xs">
                        <label className="inline-flex items-center gap-1.5">
                            <input
                                type="radio"
                                className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={form.shave_completed === 'yes'}
                                disabled={!canEdit}
                                onChange={() =>
                                    setForm((prev) => ({
                                        ...prev,
                                        shave_completed: 'yes',
                                    }))
                                }
                            />
                            <span>Yes</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5">
                            <input
                                type="radio"
                                className="h-3.5 w-3.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={form.shave_completed === 'no'}
                                disabled={!canEdit}
                                onChange={() =>
                                    setForm((prev) => ({
                                        ...prev,
                                        shave_completed: 'no',
                                    }))
                                }
                            />
                            <span>No</span>
                        </label>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        (Body diagram marking can be handled at PDF / print level.)
                    </p>
                </motion.div>

                {/* Signature */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                >
                    <label className="text-xs font-semibold text-slate-700">
                        Signature with name (nurse)
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Name & signature"
                        value={form.nurse_signature}
                        disabled={!canEdit}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                nurse_signature: e.target.value,
                            }))
                        }
                    />
                </motion.div>
            </div>

            {/* Save button */}
            {canEdit && (
                <div className="flex justify-end pt-1">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                        )}
                        Save Pre-op checklist
                    </button>
                </div>
            )}
        </form>
    )
}

export default PreopTab
