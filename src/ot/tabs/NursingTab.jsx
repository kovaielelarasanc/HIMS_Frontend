// FILE: frontend/src/ot/tabs/NursingTab.jsx
import { useEffect, useState, useMemo } from 'react'
import { ClipboardList, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCan } from '../../hooks/useCan'
import { useAuth } from '../../store/authStore'
import {
    getNursingRecord,
    createNursingRecord,
    updateNursingRecord,
} from '../../api/ot'

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

function toTimeInput(value) {
    if (!value) return ''
    if (/^\d{2}:\d{2}$/.test(value)) return value

    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(11, 16)
    }
    return ''
}

// ===========================
//   INTRA-OP NURSING TAB
// ===========================

function NursingTab({ caseId }) {
    // Align with: ("ot.nursing_record", ["view", "create", "update"])
    const { user, permissions } = useAuth()
    console.log('NURSING TAB DEBUG')
    console.log('User:', user)
    console.log('Permissions:', permissions)

    const canView =
        useCan('ot.cases.view') ||
        useCan('ot.nursing_record.view') ||
        useCan('ipd.view')

    const canEdit =
        useCan('ot.nursing_record.update') ||
        useCan('ot.nursing_record.create') ||
        useCan('ot.cases.update')||
        useCan('ipd.nursing')

    const [data, setData] = useState(null)
    const [form, setForm] = useState({
        scrub_nurse_name: '',
        circulating_nurse_name: '',
        positioning: '',
        skin_prep: '',
        catheterisation: '',
        diathermy_plate_site: '',
        counts_initial_done: false,
        counts_closure_done: false,
        antibiotics_time: '',
        warming_measures: '',
        notes: '',
    })

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const lastStamp = data?.updated_at || data?.created_at

    const banner = useMemo(
        () =>
            error ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            ) : success ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{success}</span>
                </div>
            ) : null,
        [error, success],
    )

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            setSuccess(null)

            const res = await getNursingRecord(caseId)
            if (res?.data) {
                const r = res.data
                setData(r)
                setForm({
                    scrub_nurse_name: r.scrub_nurse_name || '',
                    circulating_nurse_name: r.circulating_nurse_name || '',
                    positioning: r.positioning || '',
                    skin_prep: r.skin_prep || '',
                    catheterisation: r.catheterisation || '',
                    diathermy_plate_site: r.diathermy_plate_site || '',
                    counts_initial_done: !!r.counts_initial_done,
                    counts_closure_done: !!r.counts_closure_done,
                    antibiotics_time: toTimeInput(r.antibiotics_time),
                    warming_measures: r.warming_measures || '',
                    notes: r.notes || '',
                })
            } else {
                setData(null)
                setForm((prev) => ({
                    ...prev,
                    scrub_nurse_name: '',
                    circulating_nurse_name: '',
                    positioning: '',
                    skin_prep: '',
                    catheterisation: '',
                    diathermy_plate_site: '',
                    counts_initial_done: false,
                    counts_closure_done: false,
                    antibiotics_time: '',
                    warming_measures: '',
                    notes: '',
                }))
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null) // no record yet - empty form
            } else {
                console.error('Failed to load intra-op nursing record', err)
                setError('Failed to load intra-op nursing record.')
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
                You do not have permission to view intra-op nursing records.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) {
            setError('You do not have permission to edit intra-op nursing records.')
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        const payload = {
            // backend can auto-set primary_nurse_id if null
            primary_nurse_id: null,
            scrub_nurse_name: form.scrub_nurse_name || null,
            circulating_nurse_name: form.circulating_nurse_name || null,
            positioning: form.positioning || null,
            skin_prep: form.skin_prep || null,
            catheterisation: form.catheterisation || null,
            diathermy_plate_site: form.diathermy_plate_site || null,
            counts_initial_done: !!form.counts_initial_done,
            counts_closure_done: !!form.counts_closure_done,
            antibiotics_time: form.antibiotics_time || null,
            warming_measures: form.warming_measures || null,
            notes: form.notes || null,
        }

        try {
            if (data) {
                await updateNursingRecord(caseId, payload)
            } else {
                try {
                    await createNursingRecord(caseId, payload)
                } catch (err) {
                    const status = err?.response?.status
                    const detail = err?.response?.data?.detail

                    // If backend says "already exists", fallback to update
                    if (
                        status === 400 &&
                        typeof detail === 'string' &&
                        detail.toLowerCase().includes('already exists')
                    ) {
                        await updateNursingRecord(caseId, payload)
                    } else {
                        throw err
                    }
                }
            }
            await load()
            setSuccess('Intra-op nursing record saved.')
        } catch (err) {
            console.error('Failed to save intra-op nursing record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save intra-op nursing record.'
            setError(msg)
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
                        <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold md:text-base">
                            Intra-op Nursing Record
                        </span>
                        <span className="text-[11px] text-slate-500">
                            Positioning · prep · counts · warming – mapped to OT nursing workflow.
                        </span>
                    </div>
                </div>

                {lastStamp && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Updated: {formatDateTime(lastStamp)}
                    </span>
                )}
            </motion.div>

            {/* Banner */}
            {banner}

            {/* Loading text */}
            {loading && (
                <div className="space-y-2">
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
            )}

            {/* Main form sections */}
            {!loading && (
                <>
                    {/* Nurses */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Field
                            label="Scrub nurse"
                            value={form.scrub_nurse_name}
                            onChange={(v) => handleChange('scrub_nurse_name', v)}
                            disabled={!canEdit}
                        />
                        <Field
                            label="Circulating nurse"
                            value={form.circulating_nurse_name}
                            onChange={(v) =>
                                handleChange('circulating_nurse_name', v)
                            }
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Position / prep / catheter */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Field
                            label="Patient positioning"
                            value={form.positioning}
                            onChange={(v) => handleChange('positioning', v)}
                            placeholder="Supine / Lithotomy / Lateral…"
                            disabled={!canEdit}
                        />
                        <Field
                            label="Skin preparation"
                            value={form.skin_prep}
                            onChange={(v) => handleChange('skin_prep', v)}
                            placeholder="Povidone iodine / Chlorhexidine…"
                            disabled={!canEdit}
                        />
                        <Field
                            label="Catheterisation"
                            value={form.catheterisation}
                            onChange={(v) => handleChange('catheterisation', v)}
                            placeholder="Foley 16G / None…"
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Diathermy / antibiotics / warming */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Field
                            label="Diathermy plate site"
                            value={form.diathermy_plate_site}
                            onChange={(v) =>
                                handleChange('diathermy_plate_site', v)
                            }
                            placeholder="Thigh / Buttock…"
                            disabled={!canEdit}
                        />
                        <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-700">
                                Prophylactic antibiotics time
                            </span>
                            <input
                                type="time"
                                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                value={form.antibiotics_time}
                                disabled={!canEdit}
                                onChange={(e) =>
                                    handleChange(
                                        'antibiotics_time',
                                        e.target.value,
                                    )
                                }
                            />
                        </div>
                        <Field
                            label="Warming measures"
                            value={form.warming_measures}
                            onChange={(v) =>
                                handleChange('warming_measures', v)
                            }
                            placeholder="Bair Hugger, warm fluids…"
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Counts */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-500 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                            <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                                checked={!!form.counts_initial_done}
                                disabled={!canEdit}
                                onChange={(e) =>
                                    handleChange(
                                        'counts_initial_done',
                                        e.target.checked,
                                    )
                                }
                            />
                            <span>
                                Initial sponge / instrument counts completed
                            </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-500 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                            <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                                checked={!!form.counts_closure_done}
                                disabled={!canEdit}
                                onChange={(e) =>
                                    handleChange(
                                        'counts_closure_done',
                                        e.target.checked,
                                    )
                                }
                            />
                            <span>
                                Final counts completed at closure and recorded
                            </span>
                        </label>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                            Intra-op nursing notes
                        </span>
                        <textarea
                            rows={3}
                            className="w-full resize-none rounded-md border border-slate-500 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            value={form.notes}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Pressure points padded, eye protection, special equipment, positioning changes, events etc."
                        />
                    </div>
                </>
            )}

            {/* Save button */}
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
                        Save intra-op nursing record
                    </button>
                </div>
            )}
        </form>
    )
}

/* Small field component */

function Field({ label, value, onChange, placeholder, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">
                {label}
            </span>
            <input
                type="text"
                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

export default NursingTab
