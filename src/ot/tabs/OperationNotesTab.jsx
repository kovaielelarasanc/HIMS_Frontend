// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {

    getOperationNote,
    createOperationNote,
    updateOperationNote,

} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import {

    FileText,


} from 'lucide-react'


function safeDate(value) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d
}

function formatDate(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function formatTime(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatDateTime(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return `${formatDate(value)} · ${formatTime(value)}`
}

function joinNonEmpty(...parts) {
    return parts.filter(Boolean).join(' · ')
}

function buildPatientName(patient) {
    if (!patient) return '—'
    const prefix = patient.prefix || patient.title
    const first = patient.first_name || patient.given_name
    const last = patient.last_name || patient.family_name

    const full = [prefix, first, last].filter(Boolean).join(' ')
    return full || patient.full_name || patient.display_name || '—'
}

function buildAgeSex(patient) {
    if (!patient) return null

    const sex =
        patient.sex ||
        patient.gender ||
        patient.sex_label ||
        null

    let agePart =
        patient.age_display ||
        patient.age ||
        null

    if (!agePart && (patient.age_years != null || patient.age_months != null)) {
        const y = patient.age_years
        const m = patient.age_months
        if (y != null && m != null) agePart = `${y}y ${m}m`
        else if (y != null) agePart = `${y}y`
        else if (m != null) agePart = `${m}m`
    }

    if (!agePart && patient.dob) {
        const dob = safeDate(patient.dob)
        if (dob) {
            const now = new Date()
            let years = now.getFullYear() - dob.getFullYear()
            const m = now.getMonth() - dob.getMonth()
            if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
                years--
            }
            agePart = `${years}y`
        }
    }

    if (agePart && sex) return `${agePart} / ${sex}`
    if (agePart) return agePart
    if (sex) return sex
    return null
}
// simple helper
function toTimeInput(value) {
    if (!value) return ''

    // 1) Already in "HH:MM" from backend
    if (/^\d{2}:\d{2}$/.test(value)) {
        return value
    }

    // 2) If backend sends full ISO datetime "2025-12-06T11:14:00"
    const d = new Date(value)
    if (!isNaN(d.getTime())) {
        // returns "HH:MM"
        return d.toISOString().slice(11, 16)
    }

    // 3) Fallback – unknown format
    return ''
}


function OperationNotesTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.operation_notes.view')
    const canEdit = useCan('ot.operation_notes.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        diagnosis_pre: '',
        diagnosis_post: '',
        procedure_performed: '',
        findings: '',
        steps: '',
        complications: '',
        drains: '',
        blood_loss_ml: '',
        post_op_orders: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getOperationNote(caseId)
            if (res.data) {
                const n = res.data
                setData(n)
                setForm({
                    diagnosis_pre: n.preop_diagnosis || '',
                    diagnosis_post: n.postop_diagnosis || '',
                    procedure_performed: n.indication || '',
                    findings: n.findings || '',
                    steps: n.procedure_steps || '',
                    complications: n.complications || '',
                    drains: n.drains_details || '',
                    blood_loss_ml: n.blood_loss_ml ?? '',
                    post_op_orders: n.postop_instructions || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load Operation note', err)
                setError('Failed to load Operation note')
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
                You do not have permission to view Operation notes.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return

        setSaving(true)
        setError(null)
        try {
            const payload = {
                // backend uses current user if this is null / absent
                surgeon_user_id: null,
                preop_diagnosis: form.diagnosis_pre || null,
                postop_diagnosis: form.diagnosis_post || null,
                indication: form.procedure_performed || null,
                findings: form.findings || null,
                procedure_steps: form.steps || null,
                blood_loss_ml:
                    form.blood_loss_ml === '' ? null : Number(form.blood_loss_ml),
                complications: form.complications || null,
                drains_details: form.drains || null,
                postop_instructions: form.post_op_orders || null,
            }
            if (data) {
                await updateOperationNote(caseId, payload)
            } else {
                await createOperationNote(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save Operation note', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save Operation note'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-semibold">Operation notes</span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading Operation notes...</div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Pre-op diagnosis
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.diagnosis_pre}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('diagnosis_pre', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Post-op diagnosis
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.diagnosis_post}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('diagnosis_post', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    Procedure performed / indication
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    value={form.procedure_performed}
                    disabled={!canEdit}
                    onChange={(e) =>
                        handleChange('procedure_performed', e.target.value)
                    }
                />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Findings
                    </label>
                    <textarea
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.findings}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('findings', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Steps / technique
                    </label>
                    <textarea
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.steps}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('steps', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Complications
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.complications}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('complications', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Drains / tubes
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.drains}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('drains', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Approx. blood loss (ml)
                    </label>
                    <input
                        type="number"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.blood_loss_ml}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('blood_loss_ml', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    Immediate post-op orders
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    value={form.post_op_orders}
                    disabled={!canEdit}
                    onChange={(e) =>
                        handleChange('post_op_orders', e.target.value)
                    }
                />
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
                        Save Operation note
                    </button>
                </div>
            )}
        </form>
    )
}

export default (OperationNotesTab)