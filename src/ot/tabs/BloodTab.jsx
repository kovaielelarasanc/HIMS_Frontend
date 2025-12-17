// FILE: frontend/src/ot/tabs/BloodTab.jsx
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useCan } from '../../hooks/useCan'
import { Droplets, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import {
    listOtBloodTransfusions,
    createOtBloodTransfusion,
    updateOtBloodTransfusion,
    deleteOtBloodTransfusion,
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
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(11, 16)
    return ''
}

// Convert "HH:MM" -> ISO datetime string using today's date
function hhmmToIsoToday(hhmm) {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null
    const [h, m] = hhmm.split(':').map((x) => Number(x))
    const now = new Date()
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
    return dt.toISOString()
}

function BloodTab({ caseId }) {
    // ✅ Must match backend init_db:
    // ("ot.blood_transfusion", ["view","create","update","delete"])
    const canView = useCan('ot.cases.view') || useCan('ot.blood_transfusion.view') || useCan('ipd.view')
    const canCreate = useCan('ot.blood_transfusion.create') || useCan('ipd.doctor') || useCan('ipd.nursing')
    const canUpdate = useCan('ot.blood_transfusion.update') || useCan('ipd.doctor') || useCan('ipd.nursing')
    const canDelete = useCan('ot.blood_transfusion.delete') || useCan('ipd.doctor') || useCan('ipd.nursing')
    const canEdit = canCreate || canUpdate

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const [form, setForm] = useState({
        component: '',
        units: '1',
        blood_group: '',
        bag_no: '',
        start_time: '',
        end_time: '',
        reaction: '',
        reaction_action: '',
        notes: '',
    })

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
            const res = await listOtBloodTransfusions(caseId)
            setItems(res?.data || [])
        } catch (err) {
            console.error('Failed to load blood transfusions', err)
            setError(err?.response?.data?.detail || 'Failed to load blood transfusion records.')
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
                You do not have permission to view OT blood transfusions.
            </div>
        )
    }

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const resetForm = () =>
        setForm({
            component: '',
            units: '1',
            blood_group: '',
            bag_no: '',
            start_time: '',
            end_time: '',
            reaction: '',
            reaction_action: '',
            notes: '',
        })

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canCreate) {
            setError('You do not have permission to add transfusion entries.')
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const payload = {
                component: form.component || null,
                units: form.units === '' ? null : Number(form.units || 1),
                start_time: hhmmToIsoToday(form.start_time),
                end_time: hhmmToIsoToday(form.end_time),
                reaction: form.reaction || null,
                notes: form.notes || null,
                // blood_group, bag_no, reaction_action are UI-only for now
            }

            await createOtBloodTransfusion(caseId, payload)
            resetForm()
            await load()
            setSuccess('Transfusion entry added.')
        } catch (err) {
            console.error('Failed to add transfusion', err)
            setError(err?.response?.data?.detail || 'Failed to add transfusion entry.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!canDelete) {
            setError('You do not have permission to delete transfusion entries.')
            return
        }
        if (!window.confirm('Delete this transfusion record?')) return
        try {
            setError(null)
            setSuccess(null)
            await deleteOtBloodTransfusion(id)
            await load()
            setSuccess('Transfusion entry deleted.')
        } catch (err) {
            console.error('Failed to delete transfusion', err)
            setError(err?.response?.data?.detail || 'Failed to delete transfusion entry.')
        }
    }

    return (
        <div className="space-y-3">
            {/* List */}
            <div className="rounded-2xl border border-slate-500 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4">
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-2 flex flex-wrap items-center justify-between gap-2"
                >
                    <div className="flex items-center gap-2 text-sky-800">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                            <Droplets className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold md:text-base">
                                Blood & Fluids (Transfusion)
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Component · Units · Time · Reaction
                            </span>
                        </div>
                    </div>

                    <span className="text-[11px] text-slate-500">
                        Total: <span className="font-semibold text-slate-800">{items.length}</span>
                    </span>
                </motion.div>

                {banner}

                {loading && (
                    <div className="text-xs text-slate-500">Loading transfusion records...</div>
                )}

                <div className="max-h-72 overflow-auto rounded-xl border border-slate-500 bg-slate-50">
                    <table className="min-w-full text-left text-[11px] text-slate-700">
                        <thead className="sticky top-0 bg-slate-100">
                            <tr>
                                <th className="px-3 py-2">Component</th>
                                <th className="px-3 py-2">Units</th>
                                <th className="px-3 py-2">Start</th>
                                <th className="px-3 py-2">End</th>
                                <th className="px-3 py-2">Reaction</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && items.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-slate-500">
                                        No transfusions recorded for this case.
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                items.map((it) => (
                                    <tr key={it.id} className="border-t border-slate-100">
                                        <td className="px-3 py-2">{it.component || '—'}</td>
                                        <td className="px-3 py-2">{it.units ?? '—'}</td>
                                        <td className="px-3 py-2">
                                            {it.start_time ? formatDateTime(it.start_time) : '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                            {it.end_time ? formatDateTime(it.end_time) : '—'}
                                        </td>
                                        <td className="px-3 py-2">{it.reaction || 'None'}</td>
                                        <td className="px-3 py-2 text-right">
                                            {canDelete && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(it.id)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add */}
            {canCreate && (
                <form
                    onSubmit={handleSubmit}
                    className="space-y-2 rounded-2xl border border-slate-500 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
                >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Add transfusion entry
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <Field
                            label="Component *"
                            value={form.component}
                            onChange={(v) => handleChange('component', v)}
                            placeholder="PRBC / FFP / Platelets..."
                            required
                        />
                        <NumField
                            label="Units"
                            value={form.units}
                            onChange={(v) => handleChange('units', v)}
                            min={1}
                        />
                        <Field
                            label="Blood group (optional)"
                            value={form.blood_group}
                            onChange={(v) => handleChange('blood_group', v)}
                            placeholder="e.g., O+"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <Field
                            label="Bag number (optional)"
                            value={form.bag_no}
                            onChange={(v) => handleChange('bag_no', v)}
                            placeholder="Bag/Unit ID"
                        />
                        <TimeField
                            label="Start time"
                            value={form.start_time}
                            onChange={(v) => handleChange('start_time', v)}
                        />
                        <TimeField
                            label="End time"
                            value={form.end_time}
                            onChange={(v) => handleChange('end_time', v)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Field
                            label="Reaction (optional)"
                            value={form.reaction}
                            onChange={(v) => handleChange('reaction', v)}
                            placeholder="None / chills / rash / etc."
                        />
                        <Field
                            label="Action taken (UI-only)"
                            value={form.reaction_action}
                            onChange={(v) => handleChange('reaction_action', v)}
                            placeholder="Stopped / antihistamine / etc."
                        />
                    </div>

                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-slate-700">Notes</span>
                        <textarea
                            rows={2}
                            className="w-full resize-none rounded-md border border-slate-500 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            value={form.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Any remarks..."
                        />
                    </label>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Add transfusion
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}

/* Small fields */
function Field({ label, value, onChange, placeholder, required }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="text"
                required={required}
                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function NumField({ label, value, onChange, min }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="number"
                min={min}
                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function TimeField({ label, value, onChange }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
            <input
                type="time"
                className="h-9 w-full rounded-md border border-slate-500 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

export default BloodTab
