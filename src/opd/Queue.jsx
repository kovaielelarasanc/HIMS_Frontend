// frontend/src/opd/Queue.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { fetchQueue, updateAppointmentStatus } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'
import { useAuth } from '../store/authStore' // adjust path if needed

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import {
    Activity,
    CalendarDays,
    Clock,
    HeartPulse,
    RefreshCcw,
    Stethoscope,
    User,
} from 'lucide-react'

const todayStr = () => new Date().toISOString().slice(0, 10)

const statusLabel = {
    booked: 'Booked',
    checked_in: 'Checked-in',
    in_progress: 'In progress',
    completed: 'Completed',
    no_show: 'No-show',
    cancelled: 'Cancelled',
}

const statusBadgeClass = {
    booked: 'bg-slate-100 text-slate-700',
    checked_in: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    no_show: 'bg-rose-100 text-rose-700',
    cancelled: 'bg-slate-200 text-slate-600',
}

function prettyDate(d) {
    if (!d) return ''
    try {
        return new Date(d).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        })
    } catch {
        return d
    }
}

function computeWaitingLabel(row, forDate) {
    // Only show for active statuses & today
    if (!row?.time) return null
    if (!['booked', 'checked_in', 'in_progress'].includes(row.status)) return null

    try {
        const now = new Date()
        const isSameDate = forDate === now.toISOString().slice(0, 10)
        if (!isSameDate) return null

        const slotDt = new Date(`${forDate}T${row.time}:00`)
        const diffMs = now.getTime() - slotDt.getTime()
        const diffMin = Math.floor(diffMs / (1000 * 60))

        if (diffMin <= 0) return '0 min'

        if (diffMin < 60) return `${diffMin} min`
        const hrs = Math.floor(diffMin / 60)
        const mins = diffMin % 60
        if (hrs >= 5) return `${hrs} hrs+`
        if (mins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`
        return `${hrs}h ${mins}m`
    } catch {
        return null
    }
}

export default function Queue() {
    const { user } = useAuth() || {}

    const [doctorId, setDoctorId] = useState(null)
    const [date, setDate] = useState(todayStr())
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState('active') // active | all | each status

    const navigate = useNavigate()

    // Default doctor = logged-in doctor
    useEffect(() => {
        if (user?.is_doctor && !doctorId) {
            setDoctorId(user.id)
        }
    }, [user, doctorId])

    const hasSelection = Boolean(doctorId && date)

    const load = useCallback(async () => {
        if (!doctorId || !date) {
            setRows([])
            return
        }
        try {
            setLoading(true)
            const params = {
                doctor_user_id: Number(doctorId),
                for_date: date,
            }
            if (user?.department_id) {
                params.department_id = user.department_id
            }
            const { data } = await fetchQueue(params)
            setRows(data || [])
        } catch (e) {
            console.error(e)
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [doctorId, date, user])

    useEffect(() => {
        load()
    }, [load])

    const changeStatus = async (row, status, options = {}) => {
        try {
            const { data } = await updateAppointmentStatus(row.appointment_id, status)
            toast.success(`Status updated to ${data.status.toUpperCase()}`)
            if (options.goToVisit && data.visit_id) {
                navigate(`/opd/visit/${data.visit_id}`)
            } else {
                load()
            }
        } catch {
            // error toast already handled by interceptor
        }
    }

    const handleDoctorChange = (id /*, meta */) => {
        setDoctorId(id)
    }

    // ---- derived data ----
    const stats = useMemo(() => {
        const base = {
            total: rows.length,
            booked: 0,
            checked_in: 0,
            in_progress: 0,
            completed: 0,
            no_show: 0,
            cancelled: 0,
        }
        for (const r of rows) {
            if (base[r.status] !== undefined) base[r.status] += 1
        }
        return base
    }, [rows])

    const filteredRows = useMemo(() => {
        if (statusFilter === 'all') return rows
        if (statusFilter === 'active') {
            return rows.filter((r) =>
                ['booked', 'checked_in', 'in_progress'].includes(r.status),
            )
        }
        return rows.filter((r) => r.status === statusFilter)
    }, [rows, statusFilter])

    return (
        <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 md:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
                                Live OPD Queue
                            </p>
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                            OPD Queue Management
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Track today&apos;s appointments, check-in patients, and start / complete
                            visits in real-time.
                        </p>
                    </div>

                    <div className="hidden text-right text-xs text-slate-500 md:block">
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <Activity className="h-3 w-3" />
                            <span>Doctor OPD</span>
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                            <CalendarDays className="h-3 w-3" />
                            <span>{prettyDate(date)}</span>
                        </div>
                    </div>
                </div>

                {/* Filters + doctor/date */}
                <Card className="border-slate-200 shadow-sm rounded-3xl">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div className="grid w-full gap-3 md:grid-cols-[2fr,1.2fr] md:items-end">
                                <div>
                                    <DoctorPicker
                                        value={doctorId}
                                        onChange={handleDoctorChange}
                                        autoSelectCurrentDoctor
                                    />
                                    {user?.is_doctor && (
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Defaulted to your OPD queue.
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        Date
                                    </label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:w-auto">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={load}
                                    disabled={loading || !hasSelection}
                                >
                                    <RefreshCcw className="h-3 w-3" />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        {/* Quick stats */}
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1 rounded-full border-slate-200 bg-slate-50"
                            >
                                <Clock className="h-3 w-3" />
                                <span>Total</span>
                                <span className="font-semibold">{stats.total}</span>
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-slate-50"
                            >
                                Booked: {stats.booked}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-blue-50 text-blue-700"
                            >
                                Checked-in: {stats.checked_in}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-amber-50 text-amber-700"
                            >
                                In progress: {stats.in_progress}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-emerald-50 text-emerald-700"
                            >
                                Completed: {stats.completed}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="rounded-full border-slate-200 bg-rose-50 text-rose-700"
                            >
                                No-show: {stats.no_show}
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {/* Status filter pills */}
                        <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
                            {[
                                { key: 'active', label: 'Active (Booked / Checked-in / In progress)' },
                                { key: 'all', label: 'All' },
                                { key: 'booked', label: 'Booked' },
                                { key: 'checked_in', label: 'Checked-in' },
                                { key: 'in_progress', label: 'In progress' },
                                { key: 'completed', label: 'Completed' },
                                { key: 'no_show', label: 'No-show' },
                            ].map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setStatusFilter(opt.key)}
                                    className={[
                                        'rounded-full border px-3 py-1 transition text-[11px]',
                                        statusFilter === opt.key
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                    ].join(' ')}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        {!hasSelection && (
                            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                                    <Stethoscope className="h-5 w-5 text-slate-500" />
                                </div>
                                <div className="font-medium text-slate-700">
                                    Select doctor & date to view queue
                                </div>
                                <p className="max-w-md text-xs text-slate-500">
                                    Choose a consultant and date above to see the live OPD queue, update
                                    statuses, and open visits.
                                </p>
                            </div>
                        )}

                        {hasSelection && loading && (
                            <div className="space-y-3 py-4">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3"
                                    >
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-3 w-64" />
                                        </div>
                                        <div className="flex gap-2">
                                            <Skeleton className="h-7 w-16" />
                                            <Skeleton className="h-7 w-20" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {hasSelection && !loading && filteredRows.length === 0 && (
                            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                                    <Clock className="h-5 w-5 text-slate-500" />
                                </div>
                                <div className="font-medium text-slate-700">
                                    No appointments for this doctor / date
                                </div>
                                <p className="max-w-md text-xs text-slate-500">
                                    Try changing the status filter above or pick a different date to see
                                    previous or upcoming OPD queues.
                                </p>
                            </div>
                        )}

                        {hasSelection && !loading && filteredRows.length > 0 && (
                            <div className="space-y-2 pt-1 text-sm">
                                {filteredRows.map((row) => {
                                    const badgeCls =
                                        statusBadgeClass[row.status] || 'bg-slate-100 text-slate-700'
                                    const waitingLabel = computeWaitingLabel(row, date)

                                    return (
                                        <div
                                            key={row.appointment_id}
                                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm md:flex-row md:items-center md:justify-between"
                                        >
                                            {/* left */}
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-slate-900">
                                                        {row.time}
                                                    </span>
                                                    <span className="mx-0.5 text-slate-400">•</span>
                                                    <span className="flex items-center gap-1 text-sm font-medium text-slate-900">
                                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                                        {row.patient?.name}
                                                    </span>
                                                    <span className="mx-0.5 text-slate-400">•</span>
                                                    <span className="text-[11px] text-slate-500">
                                                        UHID {row.patient?.uhid} · {row.patient?.phone}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                                                    <span>Status:</span>
                                                    <Badge
                                                        className={`border-none px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeCls}`}
                                                    >
                                                        {statusLabel[row.status] || row.status}
                                                    </Badge>
                                                    <span className="mx-1 text-slate-300">•</span>
                                                    <span>
                                                        Purpose:{' '}
                                                        <span className="font-medium text-slate-700">
                                                            {row.visit_purpose || 'Consultation'}
                                                        </span>
                                                    </span>
                                                    <span className="mx-1 text-slate-300">•</span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <HeartPulse className="h-3 w-3" />
                                                        Vitals:{' '}
                                                        <span className="font-medium">
                                                            {row.has_vitals ? 'Yes' : 'No'}
                                                        </span>
                                                    </span>
                                                    {waitingLabel && (
                                                        <>
                                                            <span className="mx-1 text-slate-300">•</span>
                                                            <span className="inline-flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                Waiting:{' '}
                                                                <span className="font-medium">
                                                                    {waitingLabel}
                                                                </span>
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* right actions */}
                                            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                                                {row.status === 'booked' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => changeStatus(row, 'checked_in')}
                                                        >
                                                            Check-in
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => changeStatus(row, 'no_show')}
                                                        >
                                                            Mark No-show
                                                        </Button>
                                                    </>
                                                )}

                                                {row.status === 'checked_in' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            changeStatus(row, 'in_progress', {
                                                                goToVisit: true,
                                                            })
                                                        }
                                                    >
                                                        Start Visit
                                                    </Button>
                                                )}

                                                {row.status === 'in_progress' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => changeStatus(row, 'completed')}
                                                    >
                                                        Complete Visit
                                                    </Button>
                                                )}

                                                {row.visit_id && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            navigate(`/opd/visit/${row.visit_id}`)
                                                        }
                                                    >
                                                        Open Visit
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
