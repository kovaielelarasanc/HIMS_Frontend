// FILE: frontend/src/ot/OtTheatreSchedulePage.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import {
    listOtSchedules,
    createOtSchedule,
    updateOtSchedule,
    openOtCaseFromSchedule,
    listOtProcedures,
    closeOtCase,
} from '../api/ot'
import API from '../api/client'
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
    Building2,
    Filter,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../store/authStore'

// 🔁 Reusable pickers
import PatientPicker from '../components/pickers/PatientPicker'
import DoctorPicker from '../components/pickers/DoctorPicker'
import { formatIST } from '@/ipd/components/timeZONE'

/* =========================================================
   Helpers (IST-safe display)
   ========================================================= */
const IST_TZ = 'Asia/Kolkata'

const formatDateInput = (d) => {
    if (!d) return ''
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toISOString().slice(0, 10)
}

const toTimeInput = (t) => {
    if (!t) return ''
    return String(t).slice(0, 5) // "HH:MM"
}

const fmtISTDateLabel = (yyyyMmDd) => {
    if (!yyyyMmDd) return ''
    // Date-only string -> create IST midnight to avoid timezone shifts
    const dt = new Date(`${yyyyMmDd}T00:00:00+05:30`)
    return dt.toLocaleDateString('en-IN', {
        timeZone: IST_TZ,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

const safeNum = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

/* =========================================================
   Badges
   ========================================================= */
const STATUS_COLORS = {
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
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
        STATUS_COLORS[status] || 'bg-slate-50 text-slate-700 border-slate-200'
    const label = status
        .replace(/_/g, ' ')
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
        PRIORITY_COLORS[priority] || 'bg-slate-50 text-slate-700 border-slate-200'
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
        >
            {priority}
        </span>
    )
}

/* =========================================================
   OT Theater Picker (dropdown + search)
   - Tries: GET /ot/theaters?q=&limit=
   - If your endpoint differs, change ENDPOINT below.
   ========================================================= */
const THEATER_ENDPOINT = '/ot/theaters'

function OtTheaterPicker({
    label = 'OT Theater',
    value,
    onChange,
    required = false,
    allowAll = false,
    dense = false,
}) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [loadError, setLoadError] = useState(null)

    const load = useCallback(async () => {
        try {
            setLoading(true)
            setLoadError(null)
            const res = await API.get(THEATER_ENDPOINT, {
                params: { q: search || undefined, limit: 200 },
            })
            const list = Array.isArray(res?.data?.items)
                ? res.data.items
                : Array.isArray(res?.data)
                    ? res.data
                    : []
            // show active first
            list.sort((a, b) => {
                const aa = a?.is_active === false ? 1 : 0
                const bb = b?.is_active === false ? 1 : 0
                return aa - bb
            })
            setItems(list)
        } catch (e) {
            console.error('Failed to load OT theaters', e)
            setLoadError('Unable to load OT theaters')
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [search])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const term = (search || '').trim().toLowerCase()
        if (!term) return items
        return items.filter((t) => {
            const name = (t.name || '').toLowerCase()
            const code = (t.code || '').toLowerCase()
            return name.includes(term) || code.includes(term)
        })
    }, [items, search])

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <label className={`text-xs font-semibold text-slate-700`}>
                    {label} {required && <span className="text-rose-500">*</span>}
                </label>

                <div className={`relative ${dense ? 'w-36' : 'w-40'}`}>
                    <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loadError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {loadError}. You can still type Theater ID manually:
                    <div className="mt-2">
                        <input
                            type="number"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={value || ''}
                            onChange={(e) => onChange?.(safeNum(e.target.value))}
                            placeholder="OT Theater ID"
                        />
                    </div>
                </div>
            ) : (
                <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
                    value={value ?? ''}
                    onChange={(e) => onChange?.(safeNum(e.target.value))}
                    disabled={loading}
                >
                    {allowAll && <option value="">All theaters</option>}
                    {!allowAll && <option value="">Select theater</option>}

                    {filtered.map((t) => (
                        <option key={t.id} value={t.id}>
                            {(t.code ? `${t.code} — ` : '') + (t.name || `Theater #${t.id}`)}
                            {t.is_active === false ? ' (Inactive)' : ''}
                        </option>
                    ))}
                </select>
            )}

            {loading && (
                <div className="text-[11px] text-slate-500">Loading theaters…</div>
            )}
        </div>
    )
}

/* =========================================================
   Filter Panel (Theater-based)
   ========================================================= */
function TheaterFilterPanel({
    date,
    selectedTheaterId,
    status,
    search,
    onChange,
}) {
    return (
        <motion.div
            layout
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-sm md:p-4"
        >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                        Filters (OT Theater)
                    </h2>
                    <p className="text-xs text-slate-500">
                        Filter the day schedule by theater, status and procedure keyword.
                    </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                    <Building2 className="h-4 w-4" />
                </div>
            </div>

            <div className="mt-3 flex-1 space-y-3">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Date</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <div className="flex-1">
                            <input
                                type="date"
                                className="w-full border-none bg-transparent text-sm font-medium text-slate-800 focus:outline-none"
                                value={date}
                                onChange={(e) => onChange?.({ date: e.target.value })}
                            />
                            <div className="mt-0.5 text-[11px] text-slate-500">
                                {fmtISTDateLabel(date)}
                            </div>
                        </div>
                    </div>
                </div>

                <OtTheaterPicker
                    label="OT Theater"
                    value={selectedTheaterId}
                    onChange={(id) => onChange?.({ ot_theater_id: id })}
                    allowAll
                    dense
                />

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                            Status
                        </label>
                        <select
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            value={status || ''}
                            onChange={(e) => onChange?.({ status: e.target.value || '' })}
                        >
                            <option value="">All</option>
                            <option value="planned">Planned</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                            Search
                        </label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Procedure keyword…"
                                value={search}
                                onChange={(e) => onChange?.({ q: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">Tip:</span> When
                    “End time” is empty, duration can auto-fill from the primary procedure
                    master (if configured).
                </div>
            </div>
        </motion.div>
    )
}

/* =========================================================
   Schedule Cards (right side)
   ========================================================= */
function ScheduleCards({
    schedules,
    loading,
    date,
    theaterId,
    theaterLabel,
    onEdit,
    onOpenCase,
    onMarkSuccess,
}) {
    const headerSubtitle = theaterId
        ? `${theaterLabel || `Theater #${theaterId}`} · ${fmtISTDateLabel(date)}`
        : `All theaters · ${fmtISTDateLabel(date)}`

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
                    <p className="text-xs text-slate-500">{headerSubtitle}</p>
                </div>
            </div>

            {/* Scrollable list */}
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
                                        <div className="h-4 w-28 rounded bg-slate-100" />
                                        <div className="h-4 w-20 rounded bg-slate-100" />
                                    </div>
                                    <div className="h-4 w-44 rounded bg-slate-100" />
                                    <div className="h-4 w-52 rounded bg-slate-100" />
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
                            No OT schedules found for this day.
                        </p>
                        <p className="text-xs text-slate-500">
                            Use <span className="font-semibold">New Schedule</span> to add a
                            booking.
                        </p>
                    </motion.div>
                )}

                {/* Cards */}
                <AnimatePresence initial={false}>
                    {!loading &&
                        schedules.map((s) => {
                            const timeRange = [toTimeInput(s.planned_start_time), toTimeInput(s.planned_end_time)]
                                .filter(Boolean)
                                .join(' – ')

                            const patientName =
                                s.patient?.full_name ||
                                [s.patient?.first_name, s.patient?.last_name].filter(Boolean).join(' ')
                            const patientUhid = s.patient?.uhid || s.patient_uhid

                            const surgeonName = s.surgeon?.full_name || s.surgeon_name || null
                            const anaesName =
                                s.anaesthetist?.full_name || s.anaesthetist_name || null
                            const petitoryName = s.petitory?.full_name || null
                            const asstName = s.asst_doctor?.full_name || null

                            const primaryProcName =
                                s.primary_procedure?.name || s.procedure_name || '—'
                            const additionalCount = (s.procedures || []).filter((l) => !l.is_primary).length

                            const tLabel =
                                s.theater?.name ||
                                (s.theater?.code ? `${s.theater.code}` : null) ||
                                (s.ot_theater_id ? `Theater #${s.ot_theater_id}` : 'No theater')

                            const created = s.created_at ? formatIST(s.created_at) : null
                            const updated = s.updated_at ? formatIST(s.updated_at) : null

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
                                    {/* Row 1: time + badges */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                            <Clock3 className="h-4 w-4 text-slate-500" />
                                            <span>{timeRange || 'Time not set'}</span>
                                            <span className="mx-1 text-slate-300">•</span>
                                            <span className="inline-flex items-center gap-1">
                                                <Building2 className="h-4 w-4 text-slate-500" />
                                                <span className="truncate">{tLabel}</span>
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <PriorityBadge priority={s.priority} />
                                            <StatusBadge status={s.status} />
                                        </div>
                                    </div>

                                    {/* Row 2: patient + primary staff */}
                                    <div className="mt-2 flex flex-col gap-2 md:mt-3 md:flex-row md:items-start md:justify-between">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                                <User className="h-4 w-4 text-slate-500" />
                                                <span className="truncate">
                                                    {patientName ||
                                                        (patientUhid
                                                            ? `UHID ${patientUhid}`
                                                            : s.patient_id
                                                                ? `Patient #${s.patient_id}`
                                                                : '—')}
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
                                                {s.case_id && (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                                        Case #{s.case_id}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-right md:text-left">
                                            <div className="flex items-center justify-end gap-1.5 text-sm font-semibold text-slate-900 md:justify-start">
                                                <Stethoscope className="h-4 w-4 text-slate-500" />
                                                <span className="truncate">
                                                    {surgeonName ? surgeonName : `Dr #${s.surgeon_user_id}`}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                Anaes{' '}
                                                {anaesName ? anaesName : s.anaesthetist_user_id ? `#${s.anaesthetist_user_id}` : '—'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: optional doctors + procedure */}
                                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start">
                                        <div className="space-y-1">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Team (Optional)
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 text-[12px] text-slate-700">
                                                {petitoryName ? (
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                                        Petitory: <span className="font-semibold">{petitoryName}</span>
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                                                        Petitory: —
                                                    </span>
                                                )}

                                                {asstName ? (
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                                        Asst: <span className="font-semibold">{asstName}</span>
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                                                        Asst: —
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1 md:max-w-sm md:justify-self-end">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Procedure
                                            </div>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {primaryProcName}
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

                                    {/* Row 4: meta + actions */}
                                    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 md:mt-4 md:flex-row md:items-center md:justify-between">
                                        <div className="text-[11px] text-slate-500">
                                            {created && (
                                                <span title={created}>
                                                    Created: <span className="font-semibold text-slate-700">{created}</span>
                                                </span>
                                            )}
                                            {updated && (
                                                <span className="ml-3" title={updated}>
                                                    Updated: <span className="font-semibold text-slate-700">{updated}</span>
                                                </span>
                                            )}
                                        </div>

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

/* =========================================================
   ProcedurePicker (primary + additional)
   ========================================================= */
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
            primary_procedure_name: id ? items.find((x) => x.id === id)?.name || '' : '',
        })
    }

    const handleToggleAdditional = (id) => {
        const cur = new Set(additionalIds || [])
        if (cur.has(id)) cur.delete(id)
        else cur.add(id)
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
                    <div className="text-[11px] text-slate-500">Loading procedures…</div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="text-[11px] text-slate-500">No procedures found.</div>
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

/* =========================================================
   Schedule Modal (Nutryah-premium + sticky action bar)
   - OT Theater dropdown
   - Surgeon + Anaesthetist mandatory
   - Petitory + Assistant optional
   ========================================================= */
function ScheduleModal({
    open,
    mode, // 'create' | 'edit'
    onClose,
    onSaved,
    defaultDate,
    defaultTheaterId,
    editingSchedule,
}) {
    const isEdit = mode === 'edit'

    const [form, setForm] = useState({
        date: defaultDate || '',
        planned_start_time: '',
        planned_end_time: '',
        patient_id: '',
        admission_id: '',
        ot_theater_id: defaultTheaterId || '',
        surgeon_user_id: '',
        anaesthetist_user_id: '',
        petitory_user_id: '',
        asst_doctor_user_id: '',
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
                planned_start_time: toTimeInput(editingSchedule.planned_start_time),
                planned_end_time: toTimeInput(editingSchedule.planned_end_time),
                patient_id: editingSchedule.patient_id || '',
                admission_id: editingSchedule.admission_id || '',
                ot_theater_id: editingSchedule.ot_theater_id || defaultTheaterId || '',
                surgeon_user_id: editingSchedule.surgeon_user_id || '',
                anaesthetist_user_id: editingSchedule.anaesthetist_user_id || '',
                petitory_user_id: editingSchedule.petitory_user_id || '',
                asst_doctor_user_id: editingSchedule.asst_doctor_user_id || '',
                procedure_name:
                    editingSchedule.procedure_name ||
                    editingSchedule.primary_procedure?.name ||
                    '',
                side: editingSchedule.side || '',
                priority: editingSchedule.priority || 'Elective',
                notes: editingSchedule.notes || '',
                primary_procedure_id: editingSchedule.primary_procedure_id || '',
                additional_procedure_ids:
                    editingSchedule.procedures?.filter((l) => !l.is_primary).map((l) => l.procedure_id) || [],
            })
        } else {
            setForm({
                date: defaultDate || '',
                planned_start_time: '',
                planned_end_time: '',
                patient_id: '',
                admission_id: '',
                ot_theater_id: defaultTheaterId || '',
                surgeon_user_id: '',
                anaesthetist_user_id: '',
                petitory_user_id: '',
                asst_doctor_user_id: '',
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
    }, [open, isEdit, editingSchedule, defaultTheaterId, defaultDate])

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const validate = () => {
        if (!form.date) return 'Please select a date'
        if (!form.planned_start_time) return 'Please enter start time'
        if (!form.ot_theater_id) return 'Please select OT theater'
        if (!form.procedure_name) return 'Please enter procedure name'
        if (!form.surgeon_user_id) return 'Please select surgeon'
        if (!form.anaesthetist_user_id) return 'Please select anaesthetist'
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

                patient_id: safeNum(form.patient_id),
                admission_id: safeNum(form.admission_id),

                ot_theater_id: safeNum(form.ot_theater_id),

                surgeon_user_id: safeNum(form.surgeon_user_id),
                anaesthetist_user_id: safeNum(form.anaesthetist_user_id),

                petitory_user_id: safeNum(form.petitory_user_id),
                asst_doctor_user_id: safeNum(form.asst_doctor_user_id),

                procedure_name: form.procedure_name,
                side: form.side || null,
                priority: form.priority || 'Elective',
                notes: form.notes || null,

                primary_procedure_id: safeNum(form.primary_procedure_id),
                additional_procedure_ids: (form.additional_procedure_ids || []).map((id) => Number(id)),
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
                err?.response?.data?.detail || err?.message || 'Failed to save OT schedule'
            setError(apiMsg)
        } finally {
            setSubmitting(false)
        }
    }

    const title = isEdit ? 'Edit OT Schedule' : 'New OT Schedule'
    const subtitle = isEdit
        ? 'Update timing, OT theater and team.'
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
                        className="w-full max-h-[95vh] rounded-t-3xl bg-white shadow-2xl md:max-w-4xl md:rounded-2xl"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                                <p className="text-xs text-slate-500">{subtitle}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="flex max-h-[calc(95vh-56px)] flex-col"
                        >
                            {/* Body */}
                            <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
                                {/* Left column */}
                                <div className="space-y-3">
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                                            <Filter className="h-4 w-4 text-slate-500" />
                                            Schedule
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">
                                                    Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    value={form.date}
                                                    onChange={(e) => handleChange('date', e.target.value)}
                                                />
                                                <div className="text-[11px] text-slate-500">
                                                    {fmtISTDateLabel(form.date)}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">
                                                    Priority
                                                </label>
                                                <select
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    value={form.priority}
                                                    onChange={(e) => handleChange('priority', e.target.value)}
                                                >
                                                    <option value="Elective">Elective</option>
                                                    <option value="Emergency">Emergency</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">
                                                    Start time <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="time"
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    value={form.planned_start_time}
                                                    onChange={(e) => handleChange('planned_start_time', e.target.value)}
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
                                                    onChange={(e) => handleChange('planned_end_time', e.target.value)}
                                                />
                                                <div className="text-[11px] text-slate-500">
                                                    Optional (auto from master duration if empty)
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <OtTheaterPicker
                                                label="OT Theater"
                                                required
                                                value={safeNum(form.ot_theater_id)}
                                                onChange={(id) => setForm((f) => ({ ...f, ot_theater_id: id || '' }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-100 bg-white p-3">
                                        <div className="mb-2 text-xs font-semibold text-slate-700">
                                            Patient context
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            <PatientPicker
                                                label="Patient"
                                                value={form.patient_id ? Number(form.patient_id) : null}
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
                                                    onChange={(e) => handleChange('admission_id', e.target.value)}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right column */}
                                <div className="space-y-3">
                                    <div className="rounded-2xl border border-slate-100 bg-white p-3">
                                        <ProcedurePicker
                                            primaryId={form.primary_procedure_id ? Number(form.primary_procedure_id) : null}
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

                                        <div className="mt-3 space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Procedure name (display){' '}
                                                <span className="text-rose-500">*</span>
                                            </label>
                                            <textarea
                                                rows={2}
                                                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                value={form.procedure_name}
                                                onChange={(e) => handleChange('procedure_name', e.target.value)}
                                                placeholder="E.g., Laparoscopic cholecystectomy"
                                            />
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">
                                                    Side
                                                </label>
                                                <select
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    value={form.side}
                                                    onChange={(e) => handleChange('side', e.target.value)}
                                                >
                                                    <option value="">Not applicable</option>
                                                    <option value="Right">Right</option>
                                                    <option value="Left">Left</option>
                                                    <option value="Bilateral">Bilateral</option>
                                                    <option value="Midline">Midline</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">
                                                    Notes
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    value={form.notes}
                                                    onChange={(e) => handleChange('notes', e.target.value)}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                                        <div className="mb-2 text-xs font-semibold text-slate-700">
                                            Team (Mandatory + Optional)
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            <DoctorPicker
                                                label="Surgeon *"
                                                value={form.surgeon_user_id ? Number(form.surgeon_user_id) : null}
                                                onChange={(doctorId) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        surgeon_user_id: doctorId || '',
                                                    }))
                                                }
                                            />

                                            <DoctorPicker
                                                label="Anaesthetist *"
                                                value={form.anaesthetist_user_id ? Number(form.anaesthetist_user_id) : null}
                                                onChange={(doctorId) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        anaesthetist_user_id: doctorId || '',
                                                    }))
                                                }
                                            />

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <DoctorPicker
                                                    label="Petitory (Optional)"
                                                    value={form.petitory_user_id ? Number(form.petitory_user_id) : null}
                                                    onChange={(doctorId) =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            petitory_user_id: doctorId || '',
                                                        }))
                                                    }
                                                />

                                                <DoctorPicker
                                                    label="Assistant Doctor (Optional)"
                                                    value={form.asst_doctor_user_id ? Number(form.asst_doctor_user_id) : null}
                                                    onChange={(doctorId) =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            asst_doctor_user_id: doctorId || '',
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="px-5 pb-2">
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                        {error}
                                    </div>
                                </div>
                            )}

                            {/* Sticky action bar */}
                            <div className="sticky bottom-0 z-10 border-t border-slate-100 bg-white/90 px-5 py-3 backdrop-blur">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-slate-500">
                                        Times & dates shown in <span className="font-semibold">IST</span>.
                                    </div>

                                    <div className="flex items-center gap-2">
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
                                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                                            disabled={submitting}
                                        >
                                            {submitting && (
                                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                                            )}
                                            {isEdit ? 'Update Schedule' : 'Create Schedule'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* =========================================================
   Page
   ========================================================= */
export default function OtTheatreSchedulePage() {
    const { user, permissions } = useAuth()

    console.log('OT Schedule page user=', user?.full_name, 'perms=', permissions)

    const canViewSchedule =
        useCan('ot.schedule.view') ||
        useCan('ot.cases.view') ||
        useCan('ot.masters.view') ||
        true

    const canCreateSchedule =
        useCan('ot.schedule.create') ||
        useCan('ot.schedule.create') ||
        useCan('ot.cases.create') ||
        useCan('ipd.view')

    const canUpdateSchedule =
        useCan('ot.schedule.update') ||
        useCan('ot.schedule.update') ||
        useCan('ot.cases.update')

    const canCloseCase = useCan('ot.cases.close') || useCan('ot.cases.update')

    const [date, setDate] = useState(formatDateInput(new Date()))
    const [selectedTheaterId, setSelectedTheaterId] = useState(null)
    const [status, setStatus] = useState('')
    const [q, setQ] = useState('')

    const [schedules, setSchedules] = useState([])
    const [loadingSchedule, setLoadingSchedule] = useState(false)
    const [error, setError] = useState(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('create')
    const [editingSchedule, setEditingSchedule] = useState(null)

    const navigate = useNavigate()

    const theaterLabel = useMemo(() => {
        // If schedule results include theater object, show from first row if same theater filtered
        if (selectedTheaterId && schedules?.length) {
            const t = schedules.find((x) => x.ot_theater_id === selectedTheaterId)?.theater
            if (t?.name) return t.name
            if (t?.code) return t.code
        }
        return null
    }, [selectedTheaterId, schedules])

    const loadSchedule = useCallback(async () => {
        if (!date) return
        try {
            setLoadingSchedule(true)
            setError(null)

            // Backend expects: date_from & date_to, ot_theater_id, status, q
            const res = await listOtSchedules({
                date_from: date,
                date_to: date,
                ot_theater_id: selectedTheaterId || undefined,
                status: status || undefined,
                q: q?.trim() ? q.trim() : undefined,
                limit: 200,
            })

            setSchedules(res?.data || [])
        } catch (err) {
            console.error('Failed to load OT schedule', err)
            setError('Failed to load OT schedule')
        } finally {
            setLoadingSchedule(false)
        }
    }, [date, selectedTheaterId, status, q])

    const handleOpenCase = async (schedule) => {
        try {
            if (schedule.case_id) {
                navigate(`/ot/cases/${schedule.case_id}`)
                return
            }

            const res = await openOtCaseFromSchedule(schedule.id)
            const caseId = res?.data?.id

            await loadSchedule()

            if (caseId) navigate(`/ot/cases/${caseId}`)
            else console.warn('No case id returned from open-case response', res)
        } catch (err) {
            console.error('Failed to open OT case', err)
            const apiMsg =
                err?.response?.data?.detail || err?.message || 'Failed to open OT case'
            toast.error?.(apiMsg)
        }
    }

    const handleMarkSuccess = async (schedule) => {
        if (!schedule.case_id) {
            toast.error?.('No OT case opened for this schedule yet.')
            return
        }

        try {
            await closeOtCase(schedule.case_id, { outcome: 'Completed' })
            toast.success?.('OT case marked as Completed')
            await loadSchedule()
        } catch (err) {
            console.error('Failed to mark OT case as completed', err)
            const apiMsg =
                err?.response?.data?.detail || err?.message || 'Failed to update OT status'
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

    const handleFilterChange = (patch) => {
        if (patch?.date !== undefined) setDate(patch.date)
        if (patch?.ot_theater_id !== undefined) setSelectedTheaterId(patch.ot_theater_id || null)
        if (patch?.status !== undefined) setStatus(patch.status || '')
        if (patch?.q !== undefined) setQ(patch.q)
    }

    useEffect(() => {
        if (!canViewSchedule) return
        loadSchedule()
    }, [loadSchedule, canViewSchedule])

    return (
        <>
            <div className="flex h-full flex-col gap-3 p-3 pb-6 md:p-4">
                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm md:px-4 md:py-4"
                >
                    <div className="space-y-1">
                        <h1 className="text-base font-semibold text-slate-900 md:text-lg">
                            OT Schedule (Theater-based)
                        </h1>
                        <p className="text-xs text-slate-500 md:text-[13px]">
                            Manage OT bookings by <span className="font-semibold">OT Theater</span>, date and team — IST safe.
                        </p>
                    </div>

                    {/* Desktop actions */}
                    <div className="hidden md:flex flex-wrap items-center gap-2">
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

                {/* Main responsive layout */}
                <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 gap-3 md:grid-cols-[minmax(280px,0.34fr)_minmax(0,0.66fr)]">
                    <TheaterFilterPanel
                        date={date}
                        selectedTheaterId={selectedTheaterId}
                        status={status}
                        search={q}
                        onChange={handleFilterChange}
                    />

                    <ScheduleCards
                        schedules={schedules}
                        loading={loadingSchedule}
                        date={date}
                        theaterId={selectedTheaterId}
                        theaterLabel={theaterLabel}
                        onEdit={handleOpenEdit}
                        onOpenCase={handleOpenCase}
                        onMarkSuccess={canCloseCase ? handleMarkSuccess : undefined}
                    />
                </div>

                {/* Mobile sticky action bar */}
                <div className="md:hidden sticky bottom-3 z-20">
                    <div className="mx-auto flex max-w-xl items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
                        <button
                            type="button"
                            onClick={loadSchedule}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-sky-400 hover:text-sky-800"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Refresh
                        </button>

                        {canCreateSchedule && (
                            <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sky-600 bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
                            >
                                <Plus className="h-4 w-4" />
                                New
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Schedule modal */}
            <ScheduleModal
                open={modalOpen}
                mode={modalMode}
                onClose={() => setModalOpen(false)}
                onSaved={loadSchedule}
                defaultDate={date}
                defaultTheaterId={selectedTheaterId}
                editingSchedule={editingSchedule}
            />
        </>
    )
}
