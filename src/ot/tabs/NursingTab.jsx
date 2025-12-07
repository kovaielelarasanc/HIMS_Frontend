// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    getNursingRecord,
    createNursingRecord,
    updateNursingRecord,

} from '../../api/ot'
import { useCan } from '../../hooks/useCan'
import {

    ClipboardList,

    

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
//   INTRA-OP NURSING TAB
// ===========================

function NursingTab({ caseId }) {
    const canView = useCan('ot.case.view') || useCan('ot.nursing.view')
    const canEdit = useCan('ot.nursing.manage') || useCan('ot.case.update')

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

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

    const load = async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await getNursingRecord(caseId)
            if (res.data) {
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
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setData(null)      // ok, empty form
            } else {
                console.error('Failed to load intra-op nursing record', err)
                setError('Failed to load intra-op nursing record')   // <-- red banner
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
        if (!canEdit) return

        setSaving(true)
        setError(null)

        const payload = {
            // backend will default primary_nurse_id to current user if None
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
                // we already have record → normal update
                await updateNursingRecord(caseId, payload)
            } else {
                // we THINK record doesn’t exist → try create
                try {
                    await createNursingRecord(caseId, payload)
                } catch (err) {
                    const status = err?.response?.status
                    const detail = err?.response?.data?.detail

                    // 🔁 If backend says “already exists”, fallback to update
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

            // reload latest copy from backend
            await load()
        } catch (err) {
            console.error('Failed to save intra-op nursing record', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save intra-op nursing record'
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
                    <ClipboardList className="h-4 w-4" />
                    <span className="text-sm font-semibold">Intra-op nursing record</span>
                </div>

                <div className="flex items-center gap-2">
                    {data && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                            Last updated: {data?.updated_at || data?.created_at || '—'}
                        </span>
                    )}

                    {data?.primary_nurse && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                            Primary nurse: {data.primary_nurse.first_name} {data.primary_nurse.last_name}
                        </span>
                    )}
                </div>
            </div>

            {loading && (
                <div className="text-xs text-slate-500">
                    Loading intra-op nursing record...
                </div>
            )}
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Scrub nurse
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.scrub_nurse_name}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('scrub_nurse_name', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Circulating nurse
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.circulating_nurse_name}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('circulating_nurse_name', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Patient positioning
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.positioning}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('positioning', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Skin preparation
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.skin_prep}
                        disabled={!canEdit}
                        onChange={(e) => handleChange('skin_prep', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Catheterisation
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.catheterisation}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('catheterisation', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Diathermy plate site
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.diathermy_plate_site}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('diathermy_plate_site', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Prophylactic antibiotics time
                    </label>
                    <input
                        type="time"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.antibiotics_time}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('antibiotics_time', e.target.value)
                        }
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                        Warming measures
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        value={form.warming_measures}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('warming_measures', e.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={!!form.counts_initial_done}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('counts_initial_done', e.target.checked)
                        }
                    />
                    <span>Initial sponge / instrument counts completed</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={!!form.counts_closure_done}
                        disabled={!canEdit}
                        onChange={(e) =>
                            handleChange('counts_closure_done', e.target.checked)
                        }
                    />
                    <span>Final counts completed at closure</span>
                </label>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <textarea
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
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
                        Save intra-op nursing record
                    </button>
                </div>
            )}
        </form>
    )
}
export default (NursingTab)