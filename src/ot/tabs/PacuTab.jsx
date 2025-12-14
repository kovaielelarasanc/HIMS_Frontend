// FILE: frontend/src/ot/tabs/PacuTab.jsx
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BedDouble, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useCan } from '../../hooks/useCan'
import { getPacuRecord, createPacuRecord, updatePacuRecord } from '../../api/ot'

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
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(11, 16)
    return ''
}

// ===========================
//   PACU TAB
// ===========================
function PacuTab({ caseId }) {
    // ✅ must match init_db:
    // ("ot.pacu", ["view","create","update"])
    const canView = useCan('ot.cases.view') || useCan('ot.pacu.view')|| useCan('ipd.view')
    const canCreate = useCan('ot.pacu.create')|| useCan('ipd.doctor')|| useCan('ipd.nursing')
    const canUpdate = useCan('ot.pacu.update')|| useCan('ipd.doctor')|| useCan('ipd.nursing')
    const canEdit = canCreate || canUpdate

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const [form, setForm] = useState({
        arrival_time: '',
        departure_time: '',
        pain_score: '',
        nausea_vomiting: '',
        airway_status: '',
        vitals_summary: '',
        complications: '',
        discharge_criteria_met: false,
        notes: '',
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

            const res = await getPacuRecord(caseId)
            const r = res?.data

            if (r) {
                setData(r)
                setForm({
                    arrival_time: toTimeInput(r.arrival_time),
                    departure_time: toTimeInput(r.departure_time),
                    pain_score: r.pain_score ?? '',
                    nausea_vomiting: r.nausea_vomiting ?? '',
                    airway_status: r.airway_status ?? '',
                    vitals_summary: r.vitals_summary ?? '',
                    complications: r.complications ?? '',
                    discharge_criteria_met: !!r.discharge_criteria_met,
                    notes: r.notes ?? '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null) // no record yet
            } else {
                console.error('Failed to load PACU record', err)
                setError(err?.response?.data?.detail || 'Failed to load PACU record.')
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
                You do not have permission to view PACU records.
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
            setError('You do not have permission to update PACU records.')
            return
        }
        if (!data && !canCreate) {
            setError('You do not have permission to create PACU records.')
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const payload = {
                arrival_time: form.arrival_time || null,
                departure_time: form.departure_time || null,
                pain_score: form.pain_score || null,
                nausea_vomiting: form.nausea_vomiting || null,
                airway_status: form.airway_status || null,
                vitals_summary: form.vitals_summary || null,
                complications: form.complications || null,
                discharge_criteria_met: !!form.discharge_criteria_met,
                notes: form.notes || null,
            }

            if (data) {
                await updatePacuRecord(caseId, payload)
                setSuccess('PACU record updated.')
            } else {
                await createPacuRecord(caseId, payload)
                setSuccess('PACU record created.')
            }

            await load()
        } catch (err) {
            console.error('Failed to save PACU record', err)
            const detail = err?.response?.data?.detail
            let msg = 'Failed to save PACU record.'
            if (Array.isArray(detail)) msg = detail.map((d) => d.msg).join(', ')
            else if (typeof detail === 'string') msg = detail
            else if (err?.message) msg = err.message
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
        >
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-2"
            >
                <div className="flex items-center gap-2 text-sky-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                        <BedDouble className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold md:text-base">
                            PACU / Post-anaesthesia recovery
                        </span>
                        <span className="text-[11px] text-slate-500">
                            Arrival · Pain · Airway · Vitals · Discharge criteria
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

            {banner}

            {loading && (
                <div className="space-y-2">
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
            )}

            {!loading && (
                <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <TimeField
                            label="Arrival time"
                            value={form.arrival_time}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('arrival_time', v)}
                        />
                        <TimeField
                            label="Departure time"
                            value={form.departure_time}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('departure_time', v)}
                        />
                        <Field
                            label="Pain score"
                            placeholder="e.g., 3/10"
                            value={form.pain_score}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('pain_score', v)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Field
                            label="Nausea / vomiting"
                            value={form.nausea_vomiting}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('nausea_vomiting', v)}
                        />
                        <Field
                            label="Airway status"
                            value={form.airway_status}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('airway_status', v)}
                        />
                        <Field
                            label="Vitals summary"
                            value={form.vitals_summary}
                            disabled={!canEdit}
                            onChange={(v) => handleChange('vitals_summary', v)}
                        />
                    </div>

                    <TextArea
                        label="PACU complications"
                        rows={2}
                        value={form.complications}
                        disabled={!canEdit}
                        onChange={(v) => handleChange('complications', v)}
                    />

                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                            checked={!!form.discharge_criteria_met}
                            disabled={!canEdit}
                            onChange={(e) => handleChange('discharge_criteria_met', e.target.checked)}
                        />
                        <span>PACU discharge criteria met; patient shifted as per orders</span>
                    </label>

                    <TextArea
                        label="Notes"
                        rows={2}
                        value={form.notes}
                        disabled={!canEdit}
                        onChange={(v) => handleChange('notes', v)}
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
                                Save PACU record
                            </button>
                        </div>
                    )}
                </>
            )}
        </form>
    )
}

function Field({ label, value, onChange, placeholder, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="text"
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function TimeField({ label, value, onChange, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="time"
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function TextArea({ label, value, onChange, rows = 2, disabled }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <textarea
                rows={rows}
                className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                value={value ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

export default PacuTab
