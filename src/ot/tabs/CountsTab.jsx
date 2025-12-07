// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'

import {
    getCountsRecord,
    createCountsRecord,
    updateCountsRecord,

} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import {
    
    AlertTriangle,
    
    

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
//   SPONGE / INSTRUMENT COUNT TAB
// ===========================

function CountsTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.counts.view')
    const canEdit = useCan('ot.counts.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

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

    const toIntOrNull = (val) =>
        val === '' || val === null || val === undefined ? null : Number(val)

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)

            const res = await getCountsRecord(caseId)
            const c = res.data
            console.log('Counts record API data:', c)
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
        } catch (err) {
            if (err?.response?.status === 404) {
                // no record yet → create mode
                setData(null)
                setForm((f) => ({
                    ...f,
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
                }))
            } else {
                console.error('Failed to load counts record', err)
                setError('Failed to load counts record')
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
        if (!canEdit) return

        setSaving(true)
        setError(null)
        const payload = buildPayload()

        try {
            if (data?.id) {
                await updateCountsRecord(caseId, payload)
            } else {
                const res = await createCountsRecord(caseId, payload)
                setData(res.data)
            }
            await load()
        } catch (err) {
            console.error('Failed to save counts record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save counts record'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    const numberInput = (field, label) => (
        <div className="space-y-1" key={field}>
            <label className="text-xs font-medium text-slate-700">{label}</label>
            <input
                type="number"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                value={form[field]}
                disabled={!canEdit}
                onChange={(e) => handleChange(field, e.target.value)}
            />
        </div>
    )

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border bg-white px-4 py-3"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                        Sponge / instrument / needle count
                    </span>
                </div>
                {data && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Last updated: {data?.updated_at || data?.created_at || '—'}
                    </span>
                )}
            </div>

            {loading && (
                <div className="text-xs text-slate-500">Loading counts record...</div>
            )}
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {numberInput('sponges_initial', 'Sponges - initial')}
                {numberInput('sponges_added', 'Sponges - added during case')}
                {numberInput('sponges_final', 'Sponges - final count')}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {numberInput('instruments_initial', 'Instruments - initial')}
                {numberInput('instruments_final', 'Instruments - final')}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {numberInput('needles_initial', 'Needles - initial')}
                {numberInput('needles_final', 'Needles - final')}
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                    Discrepancy (if any)
                </label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    value={form.discrepancy_text}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('discrepancy_text', e.target.value)}
                />
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={!!form.xray_done}
                    disabled={!canEdit}
                    onChange={(e) => handleChange('xray_done', e.target.checked)}
                />
                <span>Intra-op / post-op X-ray done for suspected retained item</span>
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Discrepancy resolved by
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.resolved_by}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('resolved_by', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Notes / corrective action
                    </label>
                    <textarea
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.notes}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('notes', e.target.value)}
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
                        Save counts record
                    </button>
                </div>
            )}
        </form>
    )
}

export default (CountsTab)