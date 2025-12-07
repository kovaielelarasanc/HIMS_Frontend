// FILE: frontend/src/ot/OtTheatreSchedulePage.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    listOtSchedules,
    createOtSchedule,
    updateOtSchedule,
    openOtCaseFromSchedule,
    listOtProcedures,
} from '../api/ot'
import { useCan } from '../hooks/useCan'
import {
    CalendarDays,
    RefreshCcw,
    Search,
    Clock3,
    User,
    Stethoscope,
    Activity,
    Plus,
    X,
    Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// 🔁 Reusable pickers
import PatientPicker from '../components/pickers/PatientPicker'
import DoctorPicker from '../components/pickers/DoctorPicker'
import WardRoomBedPicker from '../components/pickers/BedPicker'

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

// ---------------------------------------------------------------------
// Bed-based filter panel (left side)
// ---------------------------------------------------------------------
function BedFilterPanel({ selectedBedId, onSelectBed }) {
    return (
        <div className="flex h-full flex-col rounded-2xl border bg-white/80 backdrop-blur-sm">
            <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                    OT Location / Bed Filter
                </h2>
                <p className="text-xs text-slate-500">
                    Filter OT schedule by ward &amp; bed, or leave blank to see all.
                </p>
            </div>

            <div className="flex-1 space-y-3 px-3 py-3">
                <WardRoomBedPicker
                    value={selectedBedId ? Number(selectedBedId) : null}
                    onChange={(bedId) => onSelectBed(bedId || null)}
                />
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {selectedBedId ? (
                        <>Showing cases for <span className="font-semibold">Bed #{selectedBedId}</span>.</>
                    ) : (
                        <>No specific bed selected – showing <span className="font-semibold">all OT beds</span> for this day.</>
                    )}
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------
// Schedule Table (right side)
// ---------------------------------------------------------------------
function ScheduleTable({
    schedules,
    loading,
    date,
    bedId,
    onEdit,
    onOpenCase,
}) {
    const headerSubtitle = bedId
        ? `Bed #${bedId} · ${date}`
        : `All locations · ${date}`

    return (
        <div className="flex h-full flex-col rounded-2xl border bg-white/90 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                        OT Day Schedule
                    </h2>
                    <p className="text-xs text-slate-500">
                        {headerSubtitle}
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
                                Location / Bed
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
                                const primaryProcName =
                                    s.primary_procedure?.name || s.procedure_name
                                const additionalCount = (s.procedures || []).filter(
                                    (l) => !l.is_primary,
                                ).length

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
                                            {s.bed_id ? (
                                                <div className="font-medium text-slate-800">
                                                    Bed #{s.bed_id}
                                                </div>
                                            ) : (
                                                <div className="font-medium text-slate-400">
                                                    No bed assigned
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
                                                {primaryProcName || '—'}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                                {s.side && (
                                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                                                        {s.side}
                                                    </span>
                                                )}
                                                {additionalCount > 0 && (
                                                    <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                                                        +{additionalCount} more
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

                                                <button
                                                    type="button"
                                                    onClick={() => onOpenCase(s)}
                                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${s.case_id
                                                        ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700'
                                                        : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                                                        }`}
                                                >
                                                    <Activity className="h-3.5 w-3.5" />
                                                    {s.case_id ? 'Details' : 'Open Case'}
                                                </button>
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
// Schedule Modal (bed-based, no theatre_id)
// ---------------------------------------------------------------------

function ScheduleModal({
    open,
    mode, // 'create' | 'edit'
    onClose,
    onSaved,
    defaultDate,
    defaultBedId,
    editingSchedule,
}) {
    const isEdit = mode === 'edit'

    const [form, setForm] = useState({
        date: defaultDate || '',
        planned_start_time: '',
        planned_end_time: '',
        patient_id: '',
        admission_id: '',
        bed_id: defaultBedId || '',
        surgeon_user_id: '',
        anaesthetist_user_id: '',
        procedure_name: '',
        side: '',
        priority: 'Elective',
        notes: '',
        // 🔹 NEW: procedure master linkage
        primary_procedure_id: '',
        additional_procedure_ids: [],
    })

    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!open) return

        if (isEdit && editingSchedule) {
            setForm({
                date: editingSchedule.date || defaultDate || '',
                planned_start_time: toTimeInput(
                    editingSchedule.planned_start_time,
                ),
                planned_end_time: toTimeInput(
                    editingSchedule.planned_end_time,
                ),
                patient_id: editingSchedule.patient_id || '',
                admission_id: editingSchedule.admission_id || '',
                bed_id: editingSchedule.bed_id || defaultBedId || '',
                surgeon_user_id:
                    editingSchedule.surgeon_user_id || '',
                anaesthetist_user_id:
                    editingSchedule.anaesthetist_user_id || '',
                procedure_name:
                    editingSchedule.procedure_name ||
                    editingSchedule.primary_procedure?.name ||
                    '',
                side: editingSchedule.side || '',
                priority: editingSchedule.priority || 'Elective',
                notes: editingSchedule.notes || '',
                primary_procedure_id:
                    editingSchedule.primary_procedure_id || '',
                additional_procedure_ids:
                    editingSchedule.procedures
                        ?.filter((l) => !l.is_primary)
                        .map((l) => l.procedure_id) || [],
            })
        } else {
            setForm({
                date: defaultDate || '',
                planned_start_time: '',
                planned_end_time: '',
                patient_id: '',
                admission_id: '',
                bed_id: defaultBedId || '',
                surgeon_user_id: '',
                anaesthetist_user_id: '',
                procedure_name: '',
                side: '',
                priority: 'Elective',
                notes: '',
                primary_procedure_id: '',
                additional_procedure_ids: [],
            })
        }

        setError(null)
        setSubmitting(false)
    }, [open, isEdit, editingSchedule, defaultBedId, defaultDate])

    if (!open) return null

    const handleChange = (field, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const validate = () => {
        if (!form.date) return 'Please select a date'
        if (!form.planned_start_time) return 'Please enter start time'
        if (!form.procedure_name) return 'Please enter procedure name'
        if (!form.surgeon_user_id) return 'Please select surgeon'
        // bed is not hard-mandatory, but you can enforce if you want:
        // if (!form.bed_id) return 'Please select bed / OT location'
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
                date: form.date,
                planned_start_time: form.planned_start_time,
                planned_end_time: form.planned_end_time || null,
                patient_id: form.patient_id ? Number(form.patient_id) : null,
                admission_id: form.admission_id ? Number(form.admission_id) : null,
                bed_id: form.bed_id ? Number(form.bed_id) : null,
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
                primary_procedure_id: form.primary_procedure_id
                    ? Number(form.primary_procedure_id)
                    : null,
                additional_procedure_ids: (form.additional_procedure_ids || []).map(
                    (id) => Number(id),
                ),
            }
            console.log(payload, "bed no");
            

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
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={form.date}
                                        onChange={(e) =>
                                            handleChange('date', e.target.value)
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
                                            handleChange('priority', e.target.value)
                                        }
                                    >
                                        <option value="Elective">Elective</option>
                                        <option value="Emergency">Emergency</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Start time <span className="text-rose-500">*</span>
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

                            {/* Ward → Room → Bed mapping */}
                            <WardRoomBedPicker
                                value={form.bed_id ? Number(form.bed_id) : null}
                                onChange={(bedId) =>
                                    setForm((f) => ({
                                        ...f,
                                        bed_id: bedId || '',
                                    }))
                                }
                            />
                        </div>

                        {/* Right column */}
                        <div className="space-y-3">
                            {/* Pick primary + additional procedures from master */}
                            <ProcedurePicker
                                primaryId={
                                    form.primary_procedure_id
                                        ? Number(form.primary_procedure_id)
                                        : null
                                }
                                additionalIds={form.additional_procedure_ids || []}
                                onChange={(vals) => {
                                    setForm((f) => ({
                                        ...f,
                                        primary_procedure_id:
                                            vals.primary_procedure_id ?? f.primary_procedure_id,
                                        additional_procedure_ids:
                                            vals.additional_procedure_ids ?? f.additional_procedure_ids,
                                        procedure_name:
                                            vals.primary_procedure_name && !f.procedure_name
                                                ? vals.primary_procedure_name
                                                : f.procedure_name,
                                    }))
                                }}
                            />

                            {/* Free-text procedure display / override */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Procedure name (display){' '}
                                    <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={2}
                                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.procedure_name}
                                    onChange={(e) =>
                                        handleChange('procedure_name', e.target.value)
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
                                            handleChange('side', e.target.value)
                                        }
                                    >
                                        <option value="">Not applicable</option>
                                        <option value="Right">Right</option>
                                        <option value="Left">Left</option>
                                        <option value="Bilateral">Bilateral</option>
                                        <option value="Midline">Midline</option>
                                    </select>
                                </div>

                                {/* Surgeon picker */}
                                <DoctorPicker
                                    label="Surgeon"
                                    value={
                                        form.surgeon_user_id
                                            ? Number(form.surgeon_user_id)
                                            : null
                                    }
                                    onChange={(doctorId) =>
                                        setForm((f) => ({
                                            ...f,
                                            surgeon_user_id: doctorId || '',
                                        }))
                                    }
                                />
                            </div>

                            {/* Anaesthetist picker */}
                            <DoctorPicker
                                label="Anaesthetist"
                                value={
                                    form.anaesthetist_user_id
                                        ? Number(form.anaesthetist_user_id)
                                        : null
                                }
                                onChange={(doctorId) =>
                                    setForm((f) => ({
                                        ...f,
                                        anaesthetist_user_id: doctorId || '',
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
// ProcedurePicker (primary + additional) using OT Procedure Master
// ---------------------------------------------------------------------
function ProcedurePicker({ primaryId, additionalIds, onChange }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const res = await listOtProcedures({ limit: 500 })
                setItems(res.data || [])
            } catch (err) {
                console.error('Failed to load OT procedures', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return items
        return items.filter((it) => {
            const name = (it.name || '').toLowerCase()
            const code = (it.code || '').toLowerCase()
            return name.includes(term) || code.includes(term)
        })
    }, [items, search])

    const handlePrimaryChange = (val) => {
        const id = val ? Number(val) : null
        onChange({
            primary_procedure_id: id,
            additional_procedure_ids: additionalIds || [],
            primary_procedure_name:
                id ? items.find((x) => x.id === id)?.name || '' : '',
        })
    }

    const handleToggleAdditional = (id) => {
        const cur = new Set(additionalIds || [])
        if (cur.has(id)) {
            cur.delete(id)
        } else {
            cur.add(id)
        }
        onChange({
            primary_procedure_id: primaryId || null,
            additional_procedure_ids: Array.from(cur),
        })
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">
                    Procedures (from master)
                </label>
                <div className="relative w-40">
                    <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-1.5 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                {loading && (
                    <div className="text-[11px] text-slate-500">
                        Loading procedures...
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="text-[11px] text-slate-500">
                        No procedures found.
                    </div>
                )}

                {!loading && filtered.length > 0 && (
                    <>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                <Sparkles className="h-3 w-3" />
                                Primary procedure
                            </div>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={primaryId || ''}
                                onChange={(e) => handlePrimaryChange(e.target.value)}
                            >
                                <option value="">Not selected</option>
                                {filtered.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {(p.code ? p.code + ' – ' : '') + p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <div className="text-[11px] font-medium text-slate-600">
                                Additional procedures
                            </div>
                            <div className="max-h-32 space-y-1 overflow-auto rounded-lg border border-slate-100 bg-white p-1.5 text-[11px]">
                                {filtered.map((p) => {
                                    const checked = (additionalIds || []).includes(p.id)
                                    return (
                                        <label
                                            key={p.id}
                                            className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-50"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                                checked={checked}
                                                onChange={() => handleToggleAdditional(p.id)}
                                            />
                                            <span className="truncate">
                                                {(p.code ? p.code + ' – ' : '') + p.name}
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------
// Page component (now bed-based, name kept same for routing)
// ---------------------------------------------------------------------

export default function OtTheatreSchedulePage() {
    const canViewSchedule = useCan('ot.schedule.view')
    const canCreateSchedule = useCan('ot.schedule.create')
    const canUpdateSchedule = useCan('ot.schedule.update')

    const [date, setDate] = useState(formatDateInput(new Date()))
    const [selectedBedId, setSelectedBedId] = useState(null)
    const [schedules, setSchedules] = useState([])

    const [loadingSchedule, setLoadingSchedule] = useState(false)
    const [error, setError] = useState(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'
    const [editingSchedule, setEditingSchedule] = useState(null)

    const navigate = useNavigate()

    const loadSchedule = async () => {
        if (!date) return
        try {
            setLoadingSchedule(true)
            setError(null)
            const res = await listOtSchedules({
                date,
                bedId: selectedBedId || undefined,   // ✅ use bedId, not bed_id
            })
            setSchedules(res.data || [])
        } catch (err) {
            console.error('Failed to load OT schedule', err)
            setError('Failed to load OT schedule')
        } finally {
            setLoadingSchedule(false)
        }
    }

    const handleOpenCase = async (schedule) => {
        try {
            // If case already exists -> just go to details
            if (schedule.case_id) {
                navigate(`/ot/cases/${schedule.case_id}`)
                return
            }

            // Otherwise create/open case from schedule
            const res = await openOtCaseFromSchedule(schedule.id)
            const caseId = res?.data?.id

            // Refresh schedule so row shows case_id & status in_progress
            await loadSchedule()

            if (caseId) {
                navigate(`/ot/cases/${caseId}`)
            } else {
                console.warn('No case id returned from open-case response', res)
            }
        } catch (err) {
            console.error('Failed to open OT case', err)
            // Optionally: setError('Failed to open OT case')
        }
    }

    useEffect(() => {
        if (canViewSchedule) {
            loadSchedule()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, selectedBedId, canViewSchedule])

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
                            OT Schedule (Beds)
                        </h1>
                        <p className="text-xs text-slate-500">
                            View and manage OT bookings by date and bed / location, aligned with NABH OT records.
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
                            onClick={loadSchedule}
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
                    <BedFilterPanel
                        selectedBedId={selectedBedId}
                        onSelectBed={setSelectedBedId}
                    />
                    <ScheduleTable
                        schedules={schedules}
                        loading={loadingSchedule}
                        date={date}
                        bedId={selectedBedId}
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
                defaultDate={date}
                defaultBedId={selectedBedId}
                editingSchedule={editingSchedule}
            />
        </>
    )
}
