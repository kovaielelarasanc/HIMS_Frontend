// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {

    listOtBloodTransfusions,
    createOtBloodTransfusion,
    updateOtBloodTransfusion,
    deleteOtBloodTransfusion,
} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import {

    Droplets,
    Trash2,


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


// ===========================
//   BLOOD TRANSFUSION TAB
// ===========================
function BloodTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.blood_transfusion.view')
    const canEdit = useCan('ot.blood_transfusion.manage') || useCan('ot.case.update')

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        component: '',
        units: '1',
        // extra UI fields – optional, currently not stored in backend
        blood_group: '',
        bag_no: '',
        start_time: '',
        end_time: '',
        reaction: '',
        reaction_action: '',
        notes: '',
    })

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)

            const res = await listOtBloodTransfusions(caseId)
            console.log('Blood transfusion API data:', res.data)
            // backend returns plain list
            setItems(res.data || [])
        } catch (err) {
            console.error('Failed to load blood transfusions', err)
            setError('Failed to load blood transfusion records')
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

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canEdit) return
        setSaving(true)
        try {
            const payload = {
                component: form.component || null,
                units: form.units === '' ? null : Number(form.units || 1),
                // backend currently supports only start_time/end_time as datetime,
                // we send them as null for now (or you can later upgrade to full datetime).
                start_time: null,
                end_time: null,
                reaction: form.reaction || null,
                notes: form.notes || null,
                // blood_group, bag_no, reaction_action are UI-only for now
            }
            await createOtBloodTransfusion(caseId, payload)

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
            await load()
        } catch (err) {
            console.error('Failed to add transfusion', err)
            alert(
                err?.response?.data?.detail ||
                'Failed to add transfusion entry',
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!canEdit) return
        if (!window.confirm('Delete this transfusion record?')) return
        try {
            await deleteOtBloodTransfusion(id)
            await load()
        } catch (err) {
            console.error('Failed to delete transfusion', err)
            alert('Failed to delete transfusion entry')
        }
    }

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border bg-white px-4 py-3 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Droplets className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                            OT blood transfusion record
                        </span>
                    </div>
                </div>

                {loading && (
                    <div className="text-xs text-slate-500">
                        Loading transfusion records...
                    </div>
                )}
                {error && (
                    <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="max-h-64 overflow-auto rounded-xl border bg-slate-50">
                    <table className="min-w-full text-left text-[11px] text-slate-700">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-1.5">Component</th>
                                <th className="px-3 py-1.5">Units</th>
                                <th className="px-3 py-1.5">Start</th>
                                <th className="px-3 py-1.5">End</th>
                                <th className="px-3 py-1.5">Reaction</th>
                                <th className="px-3 py-1.5 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-3 py-2 text-center text-[11px] text-slate-500"
                                    >
                                        No transfusions recorded for this case.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                items.map((it) => (
                                    <tr
                                        key={it.id}
                                        className="border-t border-slate-100"
                                    >
                                        <td className="px-3 py-1.5">
                                            {it.component || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.units ?? '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.start_time || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.end_time || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {it.reaction || 'None'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleDelete(it.id)
                                                    }
                                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
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
            {
                canEdit && (
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-2 rounded-2xl border bg-white px-4 py-3 text-xs"
                    >
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Add transfusion entry
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Component
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.component}
                                    onChange={(e) =>
                                        handleChange('component', e.target.value)
                                    }
                                    placeholder="PRBC / FFP / Platelets..."
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Units
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.units}
                                    onChange={(e) => handleChange('units', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Blood group
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.blood_group}
                                    onChange={(e) =>
                                        handleChange('blood_group', e.target.value)
                                    }
                                    placeholder="e.g., O+"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Bag number
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.bag_no}
                                    onChange={(e) => handleChange('bag_no', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Start time
                                </label>
                                <input
                                    type="time"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.start_time}
                                    onChange={(e) =>
                                        handleChange('start_time', e.target.value)
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    End time
                                </label>
                                <input
                                    type="time"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.end_time}
                                    onChange={(e) => handleChange('end_time', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Reaction
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.reaction}
                                    onChange={(e) =>
                                        handleChange('reaction', e.target.value)
                                    }
                                    placeholder="None / chills / rash / etc."
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Action taken
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                    value={form.reaction_action}
                                    onChange={(e) =>
                                        handleChange('reaction_action', e.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Notes
                            </label>
                            <textarea
                                rows={2}
                                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                value={form.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                            >
                                {saving && (
                                    <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                                )}
                                Add transfusion
                            </button>
                        </div>
                    </form>
                )
            }
        </div >
    )
}

export default (BloodTab)