// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    
    getPacuRecord,
    createPacuRecord,
    updatePacuRecord,
    
} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import {
    
    BedDouble,
   

} from 'lucide-react'


const TABS = [
    { id: 'preop', label: 'Pre-op Checklist' },
    { id: 'safety', label: 'WHO Safety Checklist' },
    { id: 'anaesthesia', label: 'Anaesthesia' },
    { id: 'nursing', label: 'Nursing Notes' },
    { id: 'counts', label: 'Instrument & Sponge Counts' },
    // { id: 'implants', label: 'Implants / Devices' },
    { id: 'blood', label: 'Blood & Fluids' },
    { id: 'notes', label: 'Operation Notes' },
    { id: 'pacu', label: 'PACU / Recovery' },
    { id: 'logs', label: 'Audit Log' },
]
// --------- small helpers for clean display ----------

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
//   PACU TAB
// ===========================

function PacuTab({ caseId }) {
    const canView = useCan('ot.cases.view') || useCan('ot.pacu.view')

    const canEdit = useCan('ot.pacu.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

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

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getPacuRecord(caseId)
            if (res.data) {
                const r = res.data
                setData(r)
                setForm({
                    arrival_time: toTimeInput(r.arrival_time),
                    departure_time: toTimeInput(r.departure_time),
                    pain_score: r.pain_score || '',
                    nausea_vomiting: r.nausea_vomiting || '',
                    airway_status: r.airway_status || '',
                    vitals_summary: r.vitals_summary || '',
                    complications: r.complications || '',
                    discharge_criteria_met: !!r.discharge_criteria_met,
                    notes: r.notes || '',
                })
            } else {
                setData(null)
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)
            } else {
                console.error('Failed to load PACU record', err)
                setError('Failed to load PACU record')  // string only
            }
        }
        finally {
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
        if (!canEdit) return

        setSaving(true)
        setError(null)
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
            } else {
                await createPacuRecord(caseId, payload)
            }
            await load()
        } catch (err) {
            console.error('Failed to save PACU record', err)

            let msg = 'Failed to save PACU record'
            const detail = err?.response?.data?.detail

            if (Array.isArray(detail)) {
                // Build a readable message from pydantic errors
                msg = detail.map((d) => d.msg).join(', ')
            } else if (typeof detail === 'string') {
                msg = detail
            } else if (err?.message) {
                msg = err.message
            }

            setError(msg)   // ✅ always a string
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
                    <BedDouble className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                        PACU / Post-anaesthesia recovery
                    </span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading PACU record...</div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Arrival time
                    </label>
                    <input
                        type="time"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.arrival_time}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('arrival_time', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Departure time
                    </label>
                    <input
                        type="time"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.departure_time}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('departure_time', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Pain score
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="e.g., 3/10"
                        value={form.pain_score}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('pain_score', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Nausea / vomiting
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.nausea_vomiting}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('nausea_vomiting', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Airway status
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.airway_status}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('airway_status', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Vitals summary
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={form.vitals_summary}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('vitals_summary', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    PACU complications
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.complications}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('complications', e.target.value)}
                />
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 hover:border-sky-400">
                <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={!!form.discharge_criteria_met}
                    disabled={!canEdit}
                    onChange={(e) =>
                        handleChange('discharge_criteria_met', e.target.checked)
                    }
                />
                <span>PACU discharge criteria met; patient shifted as per orders</span>
            </label>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={form.notes}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('notes', e.target.value)}
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
                        Save PACU record
                    </button>
                </div>
            )}
        </form>
    )
}

export default (PacuTab)