// FILE: frontend/src/ot/tabs/OperationNotesTab.jsx
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useCan } from '../../hooks/useCan'
import {
    getOperationNote,
    createOperationNote,
    updateOperationNote,
} from '../../api/ot'
import { formatIST } from '@/ipd/components/timeZONE'

// ---------- helpers ----------
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

// ===========================
//   OPERATION NOTES TAB
// ===========================
function OperationNotesTab({ caseId }) {
    // ✅ must match init_db:
    // ("ot.operation_notes", ["view","create","update"])
    const canView = useCan('ot.cases.view') || useCan('ot.operation_notes.view') || useCan('ipd.view')
    const canCreate = useCan('ot.operation_notes.create') || useCan('ipd.doctor') || useCan('ipd.nursing')
    const canUpdate = useCan('ot.operation_notes.update') || useCan('ipd.doctor') || useCan('ipd.nursing')
    const canEdit = canCreate || canUpdate

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

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

    const lastStamp = data?.updated_at || data?.created_at

    const banner = useMemo(() => {
        if (error) {
            return (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )
        }
        if (success) {
            return (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{success}</span>
                </div>
            )
        }
        return null
    }, [error, success])

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            setSuccess(null)

            const res = await getOperationNote(caseId)
            const n = res?.data

            if (n) {
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
                setData(null) // no note yet
            } else {
                console.error('Failed to load Operation note', err)
                setError(err?.response?.data?.detail || 'Failed to load Operation note.')
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

        // If record exists → need update perm, else need create perm
        if (data && !canUpdate) {
            setError('You do not have permission to update Operation notes.')
            return
        }
        if (!data && !canCreate) {
            setError('You do not have permission to create Operation notes.')
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const payload = {
                surgeon_user_id: null, // backend uses current user if null/absent
                preop_diagnosis: form.diagnosis_pre || null,
                postop_diagnosis: form.diagnosis_post || null,
                indication: form.procedure_performed || null,
                findings: form.findings || null,
                procedure_steps: form.steps || null,
                blood_loss_ml: form.blood_loss_ml === '' ? null : Number(form.blood_loss_ml),
                complications: form.complications || null,
                drains_details: form.drains || null,
                postop_instructions: form.post_op_orders || null,
            }

            if (data) {
                await updateOperationNote(caseId, payload)
                setSuccess('Operation note updated.')
            } else {
                await createOperationNote(caseId, payload)
                setSuccess('Operation note created.')
            }

            await load()
        } catch (err) {
            console.error('Failed to save Operation note', err)
            setError(err?.response?.data?.detail || err?.message || 'Failed to save Operation note.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border border-slate-500 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
        >
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-2"
            >
                <div className="flex items-center gap-2 text-sky-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold md:text-base">Operation Notes</span>
                        <span className="text-[11px] text-slate-500">
                            Diagnosis · Findings · Steps · Complications · Post-op orders
                        </span>
                    </div>
                </div>

                {lastStamp && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Updated: {formatIST(lastStamp)}
                    </span>
                )}
            </motion.div>

            {banner}

            {loading && (
                <div className="space-y-2">
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
            )}

            {!loading && (
                <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <TextArea
                            label="Pre-op diagnosis"
                            rows={2}
                            value={form.diagnosis_pre}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('diagnosis_pre', v)}
                        />
                        <TextArea
                            label="Post-op diagnosis"
                            rows={2}
                            value={form.diagnosis_post}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('diagnosis_post', v)}
                        />
                    </div>

                    <TextArea
                        label="Procedure performed / indication"
                        rows={2}
                        value={form.procedure_performed}
                        disabled={!canEdit}
                        onChange={(v) => handleChange('procedure_performed', v)}
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <TextArea
                            label="Findings"
                            rows={3}
                            value={form.findings}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('findings', v)}
                        />
                        <TextArea
                            label="Steps / technique"
                            rows={3}
                            value={form.steps}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('steps', v)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <TextArea
                            label="Complications"
                            rows={2}
                            value={form.complications}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('complications', v)}
                        />
                        <TextArea
                            label="Drains / tubes"
                            rows={2}
                            value={form.drains}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('drains', v)}
                        />
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-slate-700">Approx. blood loss (ml)</span>
                            <input
                                type="number"
                                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                value={form.blood_loss_ml}
                                disabled={!canEdit}
                                onChange={(e) => handleChange('blood_loss_ml', e.target.value)}
                            />
                        </label>
                    </div>

                    <TextArea
                        label="Immediate post-op orders"
                        rows={2}
                        value={form.post_op_orders}
                        disabled={!canEdit}
                        onChange={(v) => handleChange('post_op_orders', v)}
                    />

                    {canEdit && (
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving && (
                                    <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                                )}
                                Save Operation note
                            </button>
                        </div>
                    )}
                </>
            )}
        </form>
    )
}

function TextArea({ label, value, onChange, rows = 2, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <textarea
                rows={rows}
                className="w-full resize-none rounded-md border border-slate-500 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

export default OperationNotesTab
