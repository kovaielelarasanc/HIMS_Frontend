// FILE: frontend/src/ot/OtTheatreSchedulePage.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    listOtSchedules,
    createOtSchedule,
    updateOtSchedule,
    openOtCaseFromSchedule,
    listOtProcedures,
    closeOtCase,
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
    CheckCircle2,
    BedDouble,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

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
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}
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
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
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
        <motion.div
            layout
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-sm md:p-4"
        >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                        OT Location / Bed
                    </h2>
                    <p className="text-xs text-slate-500">
                        Filter cases by ward &amp; bed, or leave blank to view all.
                    </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                    <BedDouble className="h-4 w-4" />
                </div>
            </div>

            <div className="mt-3 flex-1 space-y-3">
                <WardRoomBedPicker
                    value={selectedBedId ? Number(selectedBedId) : null}
                    onChange={(bedId) => onSelectBed(bedId || null)}
                />
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
                    {selectedBedId ? (
                        <>
                            Showing OT cases for{' '}
                            <span className="font-semibold text-slate-900">
                                Bed #{selectedBedId}
                            </span>
                            .
                        </>
                    ) : (
                        <>
                            <span className="font-semibold text-slate-900">
                                All OT beds
                            </span>{' '}
                            are visible for the selected day.
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

// ---------------------------------------------------------------------
// Schedule Cards (right side) – mobile-first order cards
// ---------------------------------------------------------------------
function ScheduleCards({
    schedules,
    loading,
    date,
    bedId,
    onEdit,
    onOpenCase,
    onMarkSuccess,
}) {
    const headerSubtitle = bedId
        ? `Bed #${bedId} · ${date}`
        : `All OT locations · ${date}`

    return (
        <motion.div
            layout
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm backdrop-blur-sm"
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 md:px-4">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                        OT Day Schedule
                    </h2>
                    <p className="text-xs text-slate-500">
                        {headerSubtitle}
                    </p>
                </div>
            </div>

            {/* Scrollable list of cards */}
            <div className="flex-1 space-y-3 overflow-y-auto px-2 py-3 md:px-3 md:py-4">
                {/* Loading skeletons */}
                {loading && (
                    <>
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, delay: idx * 0.05 }}
                                className="animate-pulse rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm md:p-4"
                            >
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="h-4 w-24 rounded bg-slate-100" />
                                        <div className="h-4 w-20 rounded bg-slate-100" />
                                    </div>
                                    <div className="h-4 w-40 rounded bg-slate-100" />
                                    <div className="h-4 w-48 rounded bg-slate-100" />
                                    <div className="mt-2 flex gap-2">
                                        <div className="h-8 flex-1 rounded-full bg-slate-100" />
                                        <div className="h-8 flex-1 rounded-full bg-slate-100" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </>
                )}

                {/* Empty state */}
                {!loading && schedules.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center"
                    >
                        <CalendarDays className="h-6 w-6 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700">
                            No OT cases scheduled for this day.
                        </p>
                        <p className="text-xs text-slate-500">
                            Use <span className="font-semibold">New Schedule</span> to
                            add an OT booking.
                        </p>
                    </motion.div>
                )}

                {/* Cards */}
                <AnimatePresence initial={false}>
                    {!loading &&
                        schedules.map((s) => {
                            const timeRange = [s.planned_start_time, s.planned_end_time]
                                .filter(Boolean)
                                .join(' – ')

                            const patientName =
                                s.patient?.full_name ||
                                [s.patient?.first_name, s.patient?.last_name]
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

                            const wardName = s.bed?.room?.ward?.name
                            const roomNumber = s.bed?.room?.number
                            const bedCode = s.bed?.code
                            const locationLabel = s.bed_id
                                ? [
                                    wardName && `Ward: ${wardName}`,
                                    roomNumber && `Room: ${roomNumber}`,
                                    bedCode && `Bed: ${bedCode}`,
                                ]
                                    .filter(Boolean)
                                    .join(' • ') || `Bed #${s.bed_id}`
                                : 'No bed assigned'

                            return (
                                <motion.div
                                    key={s.id}
                                    layout
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                    className="group rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm ring-1 ring-transparent transition hover:border-sky-200 hover:shadow-md hover:ring-sky-100 md:px-4 md:py-4"
                                >
                                    {/* Row 1: Time + badges */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                            <Clock3 className="h-4 w-4 text-slate-500" />
                                            <span>{timeRange || 'Time not set'}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <PriorityBadge priority={s.priority} />
                                            <StatusBadge status={s.status} />
                                        </div>
                                    </div>

                                    {/* Row 2: Patient & surgeon */}
                                    <div className="mt-2 flex flex-col gap-2 md:mt-3 md:flex-row md:items-start md:justify-between">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                                <User className="h-4 w-4 text-slate-500" />
                                                <span>
                                                    {patientName ||
                                                        (patientUhid
                                                            ? `UHID ${patientUhid}`
                                                            : `UHID #${s.patient_id}`)}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                                                {patientUhid && (
                                                    <span className="rounded-full bg-slate-50 px-2 py-0.5">
                                                        UHID {patientUhid}
                                                    </span>
                                                )}
                                                {s.admission_id && (
                                                    <span className="rounded-full bg-slate-50 px-2 py-0.5">
                                                        IP #{s.admission_id}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-right md:text-left">
                                            <div className="flex items-center justify-end gap-1.5 text-sm font-semibold text-slate-900 md:justify-start">
                                                <Stethoscope className="h-4 w-4 text-slate-500" />
                                                <span>
                                                    {surgeonName
                                                        ? surgeonName
                                                        : `Dr #${s.surgeon_user_id}`}
                                                </span>
                                            </div>
                                            {(anaesName || s.anaesthetist_user_id) && (
                                                <div className="text-[11px] text-slate-500">
                                                    Anaes{' '}
                                                    {anaesName
                                                        ? anaesName
                                                        : `#${s.anaesthetist_user_id}`}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 3: Location & procedure */}
                                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div className="space-y-1">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Location
                                            </div>
                                            <div className="text-sm font-medium text-slate-900">
                                                {locationLabel}
                                            </div>
                                        </div>
                                        <div className="space-y-1 md:max-w-sm">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Procedure
                                            </div>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {primaryProcName || '—'}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-1">
                                                {s.side && (
                                                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                                        {s.side}
                                                    </span>
                                                )}
                                                {additionalCount > 0 && (
                                                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                                        +{additionalCount} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 4: Actions */}
                                    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 md:mt-4 md:flex-row md:items-center md:justify-end">
                                        <div className="flex flex-col gap-2 md:flex-row md:gap-2">
                                            <button
                                                type="button"
                                                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-sky-400 hover:text-sky-800"
                                                onClick={() => onEdit(s)}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => onOpenCase(s)}
                                                className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${s.case_id
                                                        ? 'border-slate-200 bg-white text-slate-900 hover:border-sky-400 hover:text-sky-800'
                                                        : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                                                    }`}
                                            >
                                                <Activity className="h-4 w-4" />
                                                {s.case_id ? 'View Case' : 'Open Case'}
                                            </button>

                                            {onMarkSuccess && s.case_id && s.status !== 'completed' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onMarkSuccess(s)}
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                                    title="Mark OT as completed (success) for billing"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Success
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}

// ---------------------------------------------------------------------
// Schedule Modal – mobile bottom sheet + desktop centered
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

            if (isEdit && editingSchedule?.id) {
                await updateOtSchedule(editingSchedule.id, payload)
                toast.success?.('OT schedule updated')
            } else {
                await createOtSchedule(payload)
                toast.success?.('OT schedule created')
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
        <AnimatePresence>
            {open && (
                <motion.div
                    key="ot-schedule-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm md:items-center"
                    onMouseDown={onClose}
                >
                    <motion.div
                        initial={{ y: 32, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 32, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                        className="w-full max-h-[95vh] rounded-t-3xl bg-white shadow-2xl md:max-w-3xl md:rounded-2xl"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">
                                    {title}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {subtitle}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex max-h-[calc(95vh-46px)] flex-col">
                            <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
                                {/* Left column */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Date <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                value={form.date}
                                                onChange={(e) =>
                                                    handleChange('date', e.target.value)
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Priority
                                            </label>
                                            <select
                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Start time{' '}
                                                <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="time"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                value={form.planned_start_time}
                                                onChange={(e) =>
                                                    handleChange(
                                                        'planned_start_time',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">
                                                End time
                                            </label>
                                            <input
                                                type="time"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Admission ID (IP)
                                            </label>
                                            <input
                                                type="number"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Ward / Room / Bed
                                        </label>
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
                                </div>

                                {/* Right column */}
                                <div className="space-y-3">
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
                                                    vals.primary_procedure_id ??
                                                    f.primary_procedure_id,
                                                additional_procedure_ids:
                                                    vals.additional_procedure_ids ??
                                                    f.additional_procedure_ids,
                                                procedure_name:
                                                    vals.primary_procedure_name &&
                                                        !f.procedure_name
                                                        ? vals.primary_procedure_name
                                                        : f.procedure_name,
                                            }))
                                        }}
                                    />

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Procedure name (display){' '}
                                            <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            rows={2}
                                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Side
                                            </label>
                                            <select
                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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

                                    <div className="space-y-1.5 pb-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Notes
                                        </label>
                                        <textarea
                                            rows={2}
                                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                                    disabled={submitting}
                                >
                                    {submitting && (
                                        <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                                    )}
                                    {isEdit ? 'Update Schedule' : 'Create Schedule'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
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
                const list = Array.isArray(res?.data?.items)
                    ? res.data.items
                    : Array.isArray(res?.data)
                        ? res.data
                        : []
                setItems(list)
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
            <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700">
                    Procedures (from master)
                </label>
                <div className="relative w-40">
                    <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-1.5 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
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
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
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

                        <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-slate-600">
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
// Page component (bed-based OT scheduler) – card layout
// ---------------------------------------------------------------------
export default function OtTheatreSchedulePage() {
    const canViewSchedule = useCan('ot.schedule.view')
    const canCreateSchedule = useCan('ot.schedule.create')
    const canUpdateSchedule = useCan('ot.schedule.update')
    const canCloseCase = useCan('ot.cases.close') || useCan('ot.cases.update')

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
                bedId: selectedBedId || undefined,
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
            if (schedule.case_id) {
                navigate(`/ot/cases/${schedule.case_id}`)
                return
            }

            const res = await openOtCaseFromSchedule(schedule.id)
            const caseId = res?.data?.id

            await loadSchedule()

            if (caseId) {
                navigate(`/ot/cases/${caseId}`)
            } else {
                console.warn('No case id returned from open-case response', res)
            }
        } catch (err) {
            console.error('Failed to open OT case', err)
            const apiMsg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to open OT case'
            toast.error?.(apiMsg)
        }
    }

    const handleMarkSuccess = async (schedule) => {
        if (!schedule.case_id) {
            toast.error?.('No OT case opened for this schedule yet.')
            return
        }

        try {
            await closeOtCase(schedule.case_id, {
                outcome: 'Completed',
            })

            toast.success?.('OT case marked as Completed')
            await loadSchedule()
        } catch (err) {
            console.error('Failed to mark OT case as completed', err)
            const apiMsg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to update OT status'
            toast.error?.(apiMsg)
        }
    }

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

    useEffect(() => {
        if (canViewSchedule) {
            loadSchedule()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, selectedBedId, canViewSchedule])

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
            <div className="flex h-full flex-col gap-3 p-3 pb-4 md:p-4">
                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
                >
                    <div className="space-y-1">
                        <h1 className="text-base font-semibold text-slate-900 md:text-lg">
                            OT Schedule (Beds)
                        </h1>
                        <p className="text-xs text-slate-500 md:text-[13px]">
                            View and manage OT bookings by date and OT bed / location in
                            line with NABH OT records.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5">
                            <CalendarDays className="h-4 w-4 text-slate-500" />
                            <input
                                type="date"
                                className="border-none bg-transparent text-xs font-medium text-slate-800 focus:outline-none"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={loadSchedule}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-sky-400 hover:text-sky-800"
                        >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Refresh
                        </button>
                        {canCreateSchedule && (
                            <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New Schedule
                            </button>
                        )}
                    </div>
                </motion.div>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                {/* Main responsive layout: filter + cards */}
                <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 gap-3 md:grid-cols-[minmax(260px,0.34fr)_minmax(0,0.66fr)]">
                    <BedFilterPanel
                        selectedBedId={selectedBedId}
                        onSelectBed={setSelectedBedId}
                    />
                    <ScheduleCards
                        schedules={schedules}
                        loading={loadingSchedule}
                        date={date}
                        bedId={selectedBedId}
                        onEdit={handleOpenEdit}
                        onOpenCase={handleOpenCase}
                        onMarkSuccess={canCloseCase ? handleMarkSuccess : undefined}
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
