// FILE: frontend/src/ot/tabs/CountsTab.jsx
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCan } from '../../hooks/useCan'
import {
    getCountsRecord,
    createCountsRecord,
    updateCountsRecord,
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

function toIntOrNull(val) {
    if (val === '' || val === null || val === undefined) return null
    const n = Number(val)
    return Number.isFinite(n) ? n : null
}

function CountsTab({ caseId }) {
    // ✅ Permission mapping should match backend:
    // ("ot.counts", ["view","create","update"])
    const canView = useCan('ot.cases.view') || useCan('ot.counts.view') || useCan('ipd.view')
    const canEdit = useCan('ot.counts.create') || useCan('ot.counts.update') || useCan('ipd.doctor') || useCan('ipd.nursing')

    const [data, setData] = useState(null)
    const [form, setForm] = useState({
        sponges_initial: '',
        sponges_added: '',
        sponges_final: '',
        instruments_initial: '',
        instruments_final: '',
        needles_initial: '',
        needles_final: '',
        discrepancy_text: '',
        xray_done: false,
        resolved_by: '',
        notes: '',
    })

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

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

            const res = await getCountsRecord(caseId)
            const c = res?.data

            if (c) {
                setData(c)
                setForm({
                    sponges_initial: c.sponges_initial ?? '',
                    sponges_added: c.sponges_added ?? '',
                    sponges_final: c.sponges_final ?? '',
                    instruments_initial: c.instruments_initial ?? '',
                    instruments_final: c.instruments_final ?? '',
                    needles_initial: c.needles_initial ?? '',
                    needles_final: c.needles_final ?? '',
                    discrepancy_text: c.discrepancy_text || '',
                    xray_done: !!c.xray_done,
                    resolved_by: c.resolved_by || '',
                    notes: c.notes || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                // no record yet → empty form
                setData(null)
            } else {
                console.error('Failed to load counts record', err)
                setError('Failed to load counts record.')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setData(null)
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view sponge/instrument counts.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const buildPayload = () => ({
        sponges_initial: toIntOrNull(form.sponges_initial),
        sponges_added: toIntOrNull(form.sponges_added),
        sponges_final: toIntOrNull(form.sponges_final),
        instruments_initial: toIntOrNull(form.instruments_initial),
        instruments_final: toIntOrNull(form.instruments_final),
        needles_initial: toIntOrNull(form.needles_initial),
        needles_final: toIntOrNull(form.needles_final),
        discrepancy_text: form.discrepancy_text || null,
        xray_done: !!form.xray_done,
        resolved_by: form.resolved_by || null,
        notes: form.notes || null,
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) {
            setError('You do not have permission to edit counts.')
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        const payload = buildPayload()

        try {
            if (data?.id) {
                await updateCountsRecord(caseId, payload)
            } else {
                // Create with safe fallback to update (in case of race / already exists)
                try {
                    await createCountsRecord(caseId, payload)
                } catch (err) {
                    const status = err?.response?.status
                    const detail = err?.response?.data?.detail
                    if (
                        status === 400 &&
                        typeof detail === 'string' &&
                        detail.toLowerCase().includes('already exists')
                    ) {
                        await updateCountsRecord(caseId, payload)
                    } else {
                        throw err
                    }
                }
            }

            await load()
            setSuccess('Counts record saved.')
        } catch (err) {
            console.error('Failed to save counts record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save counts record.'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const NumField = ({ field, label, hint }) => (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">
                {label}
                {hint ? (
                    <span className="ml-1 font-normal text-slate-500">({hint})</span>
                ) : null}
            </span>
            <input
                type="number"
                inputMode="numeric"
                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={form[field]}
                disabled={!canEdit}
                onChange={(e) => handleChange(field, e.target.value)}
            />
        </label>
    )

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border border-slate-500 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
        >
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-2"
            >
                <div className="flex items-center gap-2 text-sky-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold md:text-base">
                            Sponge / Instrument / Needle Counts
                        </span>
                        <span className="text-[11px] text-slate-500">
                            Initial · Added · Final · Discrepancy · X-ray
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

            {loading ? (
                <div className="space-y-2">
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
            ) : (
                <>
                    <div className="rounded-2xl border border-slate-500 bg-slate-50/60 p-3">
                        <div className="mb-2 text-[11px] font-semibold text-slate-700">
                            Sponges
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <NumField field="sponges_initial" label="Initial" />
                            <NumField field="sponges_added" label="Added during case" />
                            <NumField field="sponges_final" label="Final count" />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-500 bg-slate-50/60 p-3">
                        <div className="mb-2 text-[11px] font-semibold text-slate-700">
                            Instruments & Needles
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <NumField field="instruments_initial" label="Instruments - Initial" />
                            <NumField field="instruments_final" label="Instruments - Final" />
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <NumField field="needles_initial" label="Needles - Initial" />
                            <NumField field="needles_final" label="Needles - Final" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                            Discrepancy (if any)
                        </span>
                        <textarea
                            rows={2}
                            className="w-full resize-none rounded-md border border-slate-500 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            value={form.discrepancy_text}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('discrepancy_text', e.target.value)}
                            placeholder="Describe discrepancy / missing item / reconciliation steps…"
                        />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-500 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                            checked={!!form.xray_done}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('xray_done', e.target.checked)}
                        />
                        <span>
                            X-ray done for suspected retained item (if indicated)
                        </span>
                    </label>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-slate-700">
                                Resolved by
                            </span>
                            <input
                                type="text"
                                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                value={form.resolved_by}
                                disabled={!canEdit}
                                onChange={(e) => handleChange('resolved_by', e.target.value)}
                                placeholder="Surgeon / Scrub nurse / Circulating nurse…"
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-slate-700">
                                Notes / corrective action
                            </span>
                            <textarea
                                rows={2}
                                className="w-full resize-none rounded-md border border-slate-500 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                value={form.notes}
                                disabled={!canEdit}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                placeholder="Actions taken, incident documentation, re-check method…"
                            />
                        </label>
                    </div>
                </>
            )}

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
                        Save counts record
                    </button>
                </div>
            )}
        </form>
    )
}

export default CountsTab
