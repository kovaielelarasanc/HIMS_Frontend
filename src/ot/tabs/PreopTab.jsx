// FILE: frontend/src/ot/tabs/PreopTab.jsx
import React, { useEffect, useState } from 'react'
import {
    getPreOpChecklist,
    createPreOpChecklist,
    updatePreOpChecklist,
} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import { ClipboardCheck } from 'lucide-react'

// ----------------- CONFIG -----------------

const CHECKLIST_ITEMS = [
    // These are the paper-form rows; some will be mapped to backend fields,
    // others are only UI for now.
    { key: 'allergy', label: 'Allergy' },
    { key: 'consent_form_signed', label: 'Consent form signed' },               // -> consent_checked
    { key: 'written_high_risk_signed', label: 'Written high risk form signed' },
    { key: 'identity_bands_checked', label: 'Identity bands checked' },        // -> patient_identity_confirmed
    { key: 'npo', label: 'Nill per mouth (NPO)' },                             // comment <- fasting_status
    { key: 'pre_medication_given', label: 'Pre-medication given' },
    { key: 'test_dose_given', label: 'Test dose given' },
    { key: 'bowel_preparation', label: 'Bowel preparation' },
    { key: 'bladder_empty_time', label: 'Bladder empty time' },
    { key: 'serology_results', label: 'Serology results' },
    { key: 'blood_grouping', label: 'Blood grouping' },
    { key: 'blood_reservation', label: 'Blood reservation' },                  // -> blood_products_arranged
    {
        key: 'patient_files_with_records',
        label: 'Patient IP/OP files, ECG / X-ray with old records',
    },                                                                         // -> investigations_checked
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

// --- NEW: hydrate based on your REAL backend structure ----
const hydrateForm = (incoming) => {
    const base = DEFAULT_FORM()
    if (!incoming || typeof incoming !== 'object') return base

    const form = { ...base }

    // 1) Use checklist from backend if present (all rows, both columns)
    if (incoming.checklist && typeof incoming.checklist === 'object') {
        form.checklist = {
            ...base.checklist,
            ...incoming.checklist,
        }
    }

    // 2) Map summary booleans into checklist (fallback / sync)
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

    // 3) Comments from text fields
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

    // 4) Investigations / vitals / extras
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

            // IMPORTANT: getPreOpChecklist should return plain JSON (not axios response)
            const rec = await getPreOpChecklist(caseId)
            console.log('[PreOp] loaded record', rec)

            if (!rec) {
                setRecord(null)
                setForm(DEFAULT_FORM())
                return
            }

            // For now, backend shape IS the payload
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
                // 🔹 full checklist JSON (all rows, both columns, comments)
                checklist: form.checklist,

                // 🔹 investigations & vitals
                investigations: { ...form.investigations },
                vitals: { ...form.vitals },

                // 🔹 extras
                shave_completed: form.shave_completed,
                nurse_signature: form.nurse_signature || null,

                // 🔹 summary flags (kept for reporting / filters)
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

                completed: false, // you can wire this to a "Mark completed" toggle later
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

    // ===== JSX below unchanged (your nice UI) =====
    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                        Pre-operative checklist
                    </span>
                </div>
                {lastStamp && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last saved: {new Date(lastStamp).toLocaleString()}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">
                    Loading pre-op data...
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            {/* TABLE */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Item</th>
                            <th className="px-3 py-2 text-center">
                                Handing over nurse
                            </th>
                            <th className="px-3 py-2 text-center">
                                Receiving nurse
                            </th>
                            <th className="px-3 py-2 text-left">Comments</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CHECKLIST_ITEMS.map((item, idx) => {
                            const row = form.checklist[item.key]
                            const zebra =
                                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                            return (
                                <tr key={item.key} className={zebra}>
                                    <td className="px-3 py-1.5 text-slate-800">
                                        {item.label}
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
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
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
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
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <input
                                            type="text"
                                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Investigations & Vitals */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* investigations */}
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
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
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                </div>

                {/* vitals */}
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
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
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={form.vitals[key]}
                                disabled={!canEdit}
                                onChange={(e) =>
                                    handleVitalChange(key, e.target.value)
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Shave + Signature */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700">
                        Shave completed
                    </div>
                    <div className="flex gap-3 text-xs">
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
                        (Body diagram marking can be handled in PDF / print
                        layout.)
                    </p>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Signature with name (nurse)
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                        Save Pre-op checklist
                    </button>
                </div>
            )}
        </form>
    )
}

export default PreopTab
