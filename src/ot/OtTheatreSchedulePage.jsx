// FILE: frontend/src/ot/OtTheatreSchedulePage.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    listOtTheatres,
    listOtSchedules,
    createOtSchedule,
    updateOtSchedule,
    openOtCaseFromSchedule,

} from '../api/ot'
import { useCan } from '../hooks/useCan'
import {
    CalendarDays,
    RefreshCcw,
    AlertTriangle,
    Search,
    ChevronRight,
    Clock3,
    User,
    Stethoscope,
    Activity,
    Plus,
    X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// 🔁 Reusable pickers
import PatientPicker from '../components/pickers/PatientPicker'
import DoctorPicker from '../components/pickers/DoctorPicker'

const formatDateInput = (d) => {
    if (!d) return ''
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toISOString().slice(0, 10)
}

const toTimeInput = (t) => {
    if (!t) return ''
    // Expect "HH:MM" or "HH:MM:SS"
    return String(t).slice(0, 5)
}

const STATUS_COLORS = {
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
}

const PRIORITY_COLORS = {
    Elective: 'bg-slate-50 text-slate-700 border-slate-200',
    Emergency: 'bg-red-50 text-red-700 border-red-200',
}

function StatusBadge({ status }) {
    if (!status) return null
    const cls =
        STATUS_COLORS[status] ||
        'bg-slate-50 text-slate-700 border-slate-200'
    const label = status
        .replace('_', ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
        >
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {label}
        </span>
    )
}

function PriorityBadge({ priority }) {
    if (!priority) return null
    const cls =
        PRIORITY_COLORS[priority] ||
        'bg-slate-50 text-slate-700 border-slate-200'
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${cls}`}
        >
            {priority}
        </span>
    )
}

function TheatreList({ theatres, selectedId, onSelect, loading }) {
    const [searchTerm, setSearchTerm] = useState('')

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return theatres
        return theatres.filter(
            (th) =>
                (th.name || '').toLowerCase().includes(term) ||
                (th.code || '').toLowerCase().includes(term) ||
                (th.location || '').toLowerCase().includes(term),
        )
    }, [theatres, searchTerm])

    return (
        <div className="flex h-full flex-col rounded-2xl border bg-white/80 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                        OT Theatres
                    </h2>
                    <p className="text-xs text-slate-500">
                        Select a theatre to view schedule
                    </p>
                </div>
            </div>

            <div className="border-b px-3 py-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Search by name, code, location..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
                {loading && (
                    <>
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                                key={idx}
                                className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                            >
                                <div className="mb-1.5 h-3 w-2/3 rounded bg-slate-200" />
                                <div className="mb-1 h-2 w-1/2 rounded bg-slate-200" />
                                <div className="h-2 w-1/3 rounded bg-slate-200" />
                            </div>
                        ))}
                    </>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center text-xs text-slate-500">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span>No theatres found.</span>
                    </div>
                )}

                {!loading &&
                    filtered.map((th) => {
                        const isSelected = th.id === selectedId
                        return (
                            <button
                                key={th.id}
                                type="button"
                                onClick={() => onSelect(th.id)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs transition-all ${isSelected
                                    ? 'border-sky-500 bg-sky-50/80 shadow-sm'
                                    : 'border-slate-100 bg-white hover:border-sky-300 hover:bg-sky-50/40'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                {th.code}
                                            </span>
                                            <ChevronRight className="h-3 w-3 text-slate-400" />
                                        </div>
                                        <div className="text-[13px] font-semibold text-slate-900">
                                            {th.name}
                                        </div>
                                        {th.location && (
                                            <div className="mt-0.5 text-[11px] text-slate-500">
                                                {th.location}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
            </div>
        </div>
    )
}

function ScheduleTable({ schedules, loading, date, theatreName, onEdit, onOpenCase }) {


    return (
        <div className="flex h-full flex-col rounded-2xl border bg-white/90 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                        OT Day Schedule
                    </h2>
                    <p className="text-xs text-slate-500">
                        {theatreName ? (
                            <>
                                {theatreName} &middot; <span>{date}</span>
                            </>
                        ) : (
                            <>
                                All theatres &middot; <span>{date}</span>
                            </>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="min-w-full text-left text-xs text-slate-700">
                    <thead className="sticky top-0 z-10 border-b bg-slate-50/90 backdrop-blur">
                        <tr>
                            <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                Time
                            </th>
                            <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                Theatre
                            </th>
                            <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                Patient
                            </th>
                            <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                Procedure
                            </th>
                            <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                Surgeon
                            </th>
                            <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                Priority
                            </th>
                            <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                Status
                            </th>
                            <th className="px-4 py-2 text-right text-[11px] font-semibold text-slate-500">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <>
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <tr
                                        key={idx}
                                        className="animate-pulse border-b last:border-b-0"
                                    >
                                        {Array.from({ length: 8 }).map(
                                            (__, cIdx) => (
                                                <td
                                                    key={cIdx}
                                                    className="px-4 py-3"
                                                >
                                                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                                                </td>
                                            ),
                                        )}
                                    </tr>
                                ))}
                            </>
                        )}

                        {!loading && schedules.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-10 text-center text-xs text-slate-500"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-slate-400" />
                                        <span>
                                            No cases scheduled for this day.
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            schedules.map((s) => {
                                const timeRange = [s.planned_start_time, s.planned_end_time]
                                    .filter(Boolean)
                                    .join(' – ')

                                const patientName =
                                    s.patient?.full_name ||
                                    [
                                        s.patient?.first_name,
                                        s.patient?.last_name,
                                    ]
                                        .filter(Boolean)
                                        .join(' ')
                                const patientUhid =
                                    s.patient?.uhid || s.patient_uhid
                                const surgeonName =
                                    s.surgeon?.full_name ||
                                    s.surgeon_name ||
                                    null
                                const anaesName =
                                    s.anaesthetist?.full_name ||
                                    s.anaesthetist_name ||
                                    null

                                return (
                                    <tr
                                        key={s.id}
                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                                    >
                                        <td className="px-4 py-2 align-top">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                                                <span>
                                                    {timeRange || '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 align-top text-xs text-slate-700">
                                            <div className="font-medium text-slate-800">
                                                {s.theatre?.name ||
                                                    `#${s.theatre_id}`}
                                            </div>
                                            {s.theatre?.code && (
                                                <div className="text-[11px] text-slate-500">
                                                    {s.theatre.code}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 align-top text-xs text-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                <User className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="font-medium text-slate-800">
                                                    {patientName ||
                                                        (patientUhid
                                                            ? `UHID ${patientUhid}`
                                                            : `UHID #${s.patient_id}`)}
                                                </span>
                                            </div>
                                            {patientUhid && (
                                                <div className="text-[11px] text-slate-500">
                                                    UHID {patientUhid}
                                                </div>
                                            )}
                                            {s.admission_id && (
                                                <div className="text-[11px] text-slate-500">
                                                    IP #{s.admission_id}
                                                </div>
                                            )}
                                        </td>
                                        <td className="max-w-xs px-4 py-2 align-top text-xs text-slate-700">
                                            <div className="line-clamp-2 font-medium text-slate-900">
                                                {s.procedure_name}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                                {s.side && (
                                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                                                        {s.side}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 align-top text-xs text-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="font-medium text-slate-800">
                                                    {surgeonName
                                                        ? surgeonName
                                                        : `Dr #${s.surgeon_user_id}`}
                                                </span>
                                            </div>
                                            {(anaesName ||
                                                s.anaesthetist_user_id) && (
                                                    <div className="mt-0.5 text-[11px] text-slate-500">
                                                        Anaes{' '}
                                                        {anaesName
                                                            ? anaesName
                                                            : `#${s.anaesthetist_user_id}`}
                                                    </div>
                                                )}
                                        </td>
                                        <td className="px-4 py-2 align-top">
                                            <PriorityBadge
                                                priority={s.priority}
                                            />
                                        </td>
                                        <td className="px-4 py-2 align-top">
                                            <StatusBadge status={s.status} />
                                        </td>
                                        <td className="px-4 py-2 align-top">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-400 hover:text-sky-700"
                                                    onClick={() => onEdit(s)}
                                                >
                                                    Edit
                                                </button>

                                                {s.case_id ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/ot/cases/${s.case_id}`)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-400 hover:text-sky-700"
                                                    >
                                                        <Activity className="h-3.5 w-3.5" />
                                                        Details
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenCase(s)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                                                    >
                                                        <Activity className="h-3.5 w-3.5" />
                                                        Open Case
                                                    </button>
                                                )}
                                            </div>
                                        </td>


                                    </tr>
                                )
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------
// Schedule Modal
// ---------------------------------------------------------------------

function ScheduleModal({
    open,
    mode, // 'create' | 'edit'
    onClose,
    onSaved,
    theatres,
    defaultTheatreId,
    defaultDate,
    editingSchedule,
}) {
    const isEdit = mode === 'edit'

    const [form, setForm] = useState({
        theatre_id: defaultTheatreId || '',
        date: defaultDate || '',
        planned_start_time: '',
        planned_end_time: '',
        patient_id: '',
        admission_id: '',
        surgeon_user_id: '',
        anaesthetist_user_id: '',
        procedure_name: '',
        side: '',
        priority: 'Elective',
        notes: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!open) return

        if (isEdit && editingSchedule) {
            setForm({
                theatre_id:
                    editingSchedule.theatre_id ||
                    defaultTheatreId ||
                    '',
                date: editingSchedule.date || defaultDate || '',
                planned_start_time: toTimeInput(
                    editingSchedule.planned_start_time,
                ),
                planned_end_time: toTimeInput(
                    editingSchedule.planned_end_time,
                ),
                patient_id: editingSchedule.patient_id || '',
                admission_id: editingSchedule.admission_id || '',
                surgeon_user_id:
                    editingSchedule.surgeon_user_id || '',
                anaesthetist_user_id:
                    editingSchedule.anaesthetist_user_id || '',
                procedure_name:
                    editingSchedule.procedure_name || '',
                side: editingSchedule.side || '',
                priority: editingSchedule.priority || 'Elective',
                notes: editingSchedule.notes || '',
            })
        } else {
            setForm({
                theatre_id: defaultTheatreId || (theatres[0]?.id ?? ''),
                date: defaultDate || '',
                planned_start_time: '',
                planned_end_time: '',
                patient_id: '',
                admission_id: '',
                surgeon_user_id: '',
                anaesthetist_user_id: '',
                procedure_name: '',
                side: '',
                priority: 'Elective',
                notes: '',
            })
        }
        setError(null)
        setSubmitting(false)
    }, [open, isEdit, editingSchedule, defaultTheatreId, defaultDate, theatres])

    if (!open) return null

    const handleChange = (field, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const validate = () => {
        if (!form.theatre_id) return 'Please select a theatre'
        if (!form.date) return 'Please select a date'
        if (!form.planned_start_time) return 'Please enter start time'
        if (!form.procedure_name) return 'Please enter procedure name'
        if (!form.surgeon_user_id) return 'Please select surgeon'
        return null
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const msg = validate()
        if (msg) {
            setError(msg)
            return
        }

        setSubmitting(true)
        setError(null)
        try {
            const payload = {
                theatre_id: Number(form.theatre_id),
                date: form.date,
                planned_start_time: form.planned_start_time,
                planned_end_time: form.planned_end_time || null,
                patient_id: form.patient_id
                    ? Number(form.patient_id)
                    : null,
                admission_id: form.admission_id
                    ? Number(form.admission_id)
                    : null,
                surgeon_user_id: form.surgeon_user_id
                    ? Number(form.surgeon_user_id)
                    : null,
                anaesthetist_user_id: form.anaesthetist_user_id
                    ? Number(form.anaesthetist_user_id)
                    : null,
                procedure_name: form.procedure_name,
                side: form.side || null,
                priority: form.priority || 'Elective',
                notes: form.notes || null,
            }

            if (isEdit && editingSchedule?.id) {
                await updateOtSchedule(editingSchedule.id, payload)
            } else {
                await createOtSchedule(payload)
            }

            onSaved?.()
            onClose()
        } catch (err) {
            console.error('Failed to save OT schedule', err)
            const apiMsg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save OT schedule'
            setError(apiMsg)
        } finally {
            setSubmitting(false)
        }
    }

    const title = isEdit ? 'Edit OT Schedule' : 'New OT Schedule'
    const subtitle = isEdit
        ? 'Update timing and details of this OT booking.'
        : 'Create a new OT booking for the selected day.'

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b px-5 py-3.5">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                            {title}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {subtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
                        {/* Left column */}
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    OT Theatre{' '}
                                    <span className="text-rose-500">
                                        *
                                    </span>
                                </label>
                                <select
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.theatre_id}
                                    onChange={(e) =>
                                        handleChange(
                                            'theatre_id',
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="">Select theatre</option>
                                    {theatres.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.code} – {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Date{' '}
                                        <span className="text-rose-500">
                                            *
                                        </span>
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={form.date}
                                        onChange={(e) =>
                                            handleChange(
                                                'date',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Priority
                                    </label>
                                    <select
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={form.priority}
                                        onChange={(e) =>
                                            handleChange(
                                                'priority',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="Elective">
                                            Elective
                                        </option>
                                        <option value="Emergency">
                                            Emergency
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Start time{' '}
                                        <span className="text-rose-500">
                                            *
                                        </span>
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={form.planned_start_time}
                                        onChange={(e) =>
                                            handleChange(
                                                'planned_start_time',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        End time
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={form.planned_end_time}
                                        onChange={(e) =>
                                            handleChange(
                                                'planned_end_time',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Patient picker */}
                                <PatientPicker
                                    label="Patient"
                                    value={
                                        form.patient_id
                                            ? Number(form.patient_id)
                                            : null
                                    }
                                    onChange={(id) =>
                                        setForm((f) => ({
                                            ...f,
                                            patient_id: id || '',
                                        }))
                                    }
                                />
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Admission ID (IP)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={form.admission_id}
                                        onChange={(e) =>
                                            handleChange(
                                                'admission_id',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Procedure name{' '}
                                    <span className="text-rose-500">
                                        *
                                    </span>
                                </label>
                                <textarea
                                    rows={2}
                                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.procedure_name}
                                    onChange={(e) =>
                                        handleChange(
                                            'procedure_name',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="E.g., Laparoscopic cholecystectomy"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Side
                                    </label>
                                    <select
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={form.side}
                                        onChange={(e) =>
                                            handleChange(
                                                'side',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Not applicable
                                        </option>
                                        <option value="Right">Right</option>
                                        <option value="Left">Left</option>
                                        <option value="Bilateral">
                                            Bilateral
                                        </option>
                                        <option value="Midline">
                                            Midline
                                        </option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    {/* Surgeon picker */}
                                    <DoctorPicker
                                        label="Surgeon"
                                        value={
                                            form.surgeon_user_id
                                                ? Number(
                                                    form.surgeon_user_id,
                                                )
                                                : null
                                        }
                                        onChange={(doctorId) =>
                                            setForm((f) => ({
                                                ...f,
                                                surgeon_user_id:
                                                    doctorId || '',
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            {/* Anaesthetist */}
                            <DoctorPicker
                                label="Anaesthetist"
                                value={
                                    form.anaesthetist_user_id
                                        ? Number(
                                            form.anaesthetist_user_id,
                                        )
                                        : null
                                }
                                onChange={(doctorId) =>
                                    setForm((f) => ({
                                        ...f,
                                        anaesthetist_user_id:
                                            doctorId || '',
                                    }))
                                }
                            />

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Notes
                                </label>
                                <textarea
                                    rows={2}
                                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.notes}
                                    onChange={(e) =>
                                        handleChange('notes', e.target.value)
                                    }
                                    placeholder="Any special requirements / remarks"
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="px-5 pb-2">
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                {error}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                            disabled={submitting}
                        >
                            {submitting && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            {isEdit ? 'Update Schedule' : 'Create Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------

export default function OtTheatreSchedulePage() {
    const canViewSchedule = useCan('ot.schedule.view')
    const canCreateSchedule = useCan('ot.schedule.create')
    const canUpdateSchedule = useCan('ot.schedule.update')

    const [date, setDate] = useState(formatDateInput(new Date()))
    const [theatres, setTheatres] = useState([])
    const [selectedTheatreId, setSelectedTheatreId] = useState(null)
    const [schedules, setSchedules] = useState([])

    const [loadingTheatres, setLoadingTheatres] = useState(false)
    const [loadingSchedule, setLoadingSchedule] = useState(false)
    const [error, setError] = useState(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'
    const [editingSchedule, setEditingSchedule] = useState(null)

    const navigate = useNavigate()

    const selectedTheatre = useMemo(
        () => theatres.find((t) => t.id === selectedTheatreId),
        [theatres, selectedTheatreId],
    )

    const loadTheatres = async () => {
        try {
            setLoadingTheatres(true)
            setError(null)
            const res = await listOtTheatres({ active: true })
            const items = res.data || []
            setTheatres(items)
            if (!selectedTheatreId && items.length > 0) {
                setSelectedTheatreId(items[0].id)
            }
        } catch (err) {
            console.error('Failed to load OT theatres', err)
            setError('Failed to load OT theatres')
        } finally {
            setLoadingTheatres(false)
        }
    }
    const handleOpenCase = async (schedule) => {
        try {
            // Call backend to open/create the case
            const res = await openOtCaseFromSchedule(schedule.id)

            // Axios response → case data is in res.data
            const caseId = res?.data?.id

            // Refresh schedule so the row shows case_id & status in_progress
            await loadSchedule()

            // Immediately navigate to the case detail page
            if (caseId) {
                navigate(`/ot/cases/${caseId}`)
            } else {
                console.warn('No case id returned from open-case response', res)
            }
        } catch (err) {
            console.error('Failed to open OT case', err)
            // optionally setError('Failed to open OT case') or toast
        }
    }

    const loadSchedule = async () => {
        if (!date) return
        try {
            setLoadingSchedule(true)
            setError(null)
            const res = await listOtSchedules({
                date,
                theatre_id: selectedTheatreId || undefined, // 🔧 use theatre_id, not theatreId
            })
            setSchedules(res.data || [])
        } catch (err) {
            console.error('Failed to load OT schedule', err)
            setError('Failed to load OT schedule')
        } finally {
            setLoadingSchedule(false)
        }
    }

    useEffect(() => {
        if (canViewSchedule) {
            loadTheatres()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canViewSchedule])

    useEffect(() => {
        if (canViewSchedule) {
            loadSchedule()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, selectedTheatreId, canViewSchedule])

    const handleOpenCreate = () => {
        if (!canCreateSchedule) return
        setModalMode('create')
        setEditingSchedule(null)
        setModalOpen(true)
    }

    const handleOpenEdit = (schedule) => {
        if (!canUpdateSchedule) return
        setModalMode('edit')
        setEditingSchedule(schedule)
        setModalOpen(true)
    }

    if (!canViewSchedule) {
        return (
            <div className="p-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    You do not have permission to view OT schedules.
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="flex h-full flex-col gap-3 p-4">
                {/* Page header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-semibold text-slate-900">
                            OT Theatre Schedule
                        </h1>
                        <p className="text-xs text-slate-500">
                            View and manage OT bookings by theatre and day,
                            aligned with NABH OT records.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                            <CalendarDays className="h-4 w-4 text-slate-500" />
                            <input
                                type="date"
                                className="border-none bg-transparent text-xs text-slate-800 focus:outline-none"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                loadTheatres()
                                loadSchedule()
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-500 hover:text-sky-700"
                        >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Refresh
                        </button>
                        {canCreateSchedule && (
                            <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New Schedule
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                {/* Main grid */}
                <div className="grid h-[calc(100vh-170px)] grid-cols-1 gap-3 md:grid-cols-[minmax(260px,0.32fr)_minmax(0,0.68fr)]">
                    <TheatreList
                        theatres={theatres}
                        selectedId={selectedTheatreId}
                        onSelect={setSelectedTheatreId}
                        loading={loadingTheatres}
                    />
                    <ScheduleTable
                        schedules={schedules}
                        loading={loadingSchedule}
                        date={date}
                        theatreName={selectedTheatre?.name}
                        onEdit={handleOpenEdit}
                        onOpenCase={handleOpenCase}
                    />
                </div>
            </div>

            {/* Schedule modal */}
            <ScheduleModal
                open={modalOpen}
                mode={modalMode}
                onClose={() => setModalOpen(false)}
                onSaved={loadSchedule}
                theatres={theatres}
                defaultTheatreId={selectedTheatreId}
                defaultDate={date}
                editingSchedule={editingSchedule}
            />
        </>
    )
}
