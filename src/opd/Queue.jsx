// FILE: frontend/src/opd/Queue.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { fetchQueue, updateAppointmentStatus } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'
import { useAuth } from '../store/authStore'

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import {
    Activity,
    CalendarDays,
    CheckCircle2,
    Clock,
    HeartPulse,
    Loader2,
    RefreshCcw,
    Search,
    Stethoscope,
    User2,
    Users,
    XCircle,
    PlayCircle,
    LogIn,
    Lock,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const todayStr = () => new Date().toISOString().slice(0, 10)

const statusLabel = {
    booked: 'Booked',
    checked_in: 'Checked-in',
    in_progress: 'In progress',
    completed: 'Completed',
    no_show: 'No-show',
    cancelled: 'Cancelled',
}

const STATUS = [
    { key: 'active', label: 'Active' },
    { key: 'all', label: 'All' },
    { key: 'booked', label: 'Booked' },
    { key: 'checked_in', label: 'Checked-in' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'no_show', label: 'No-show' },
    { key: 'cancelled', label: 'Cancelled' },
]

function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

const UI = {
    page: 'min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50',
    glass:
        'rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
    chip:
        'inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700',
    chipBtn:
        'inline-flex items-center gap-2 rounded-full border bg-green-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:text-black hover:bg-black/[0.03] active:scale-[0.99] transition',
    input:
        'h-11 w-full rounded-2xl border border-black/10 bg-white/85 px-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
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

function statusPill(status) {
    const base = 'rounded-full border px-2.5 py-1 text-[11px] font-semibold'
    switch (status) {
        case 'booked':
            return cx(base, 'border-slate-200 bg-slate-50 text-slate-700')
        case 'checked_in':
            return cx(base, 'border-sky-200 bg-sky-50 text-sky-800')
        case 'in_progress':
            return cx(base, 'border-amber-200 bg-amber-50 text-amber-800')
        case 'completed':
            return cx(base, 'border-emerald-200 bg-emerald-50 text-emerald-800')
        case 'no_show':
            return cx(base, 'border-rose-200 bg-rose-50 text-rose-800')
        case 'cancelled':
            return cx(base, 'border-slate-200 bg-slate-100 text-slate-600')
        default:
            return cx(base, 'border-slate-200 bg-slate-50 text-slate-700')
    }
}

function StatCard({ label, value, icon: Icon, tone = 'slate' }) {
    const toneCls =
        tone === 'dark'
            ? 'bg-slate-900 text-white border-slate-900'
            : tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : tone === 'sky'
                    ? 'bg-sky-50 text-sky-900 border-sky-200'
                    : tone === 'rose'
                        ? 'bg-rose-50 text-rose-900 border-rose-200'
                        : 'bg-white/80 text-slate-900 border-black/10'

    return (
        <div className={cx('rounded-3xl border px-4 py-3', toneCls)}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                        {label}
                    </div>
                    <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">
                        {value}
                    </div>
                </div>
                {Icon && (
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white/30">
                        <Icon className="h-5 w-5 opacity-80" />
                    </div>
                )}
            </div>
        </div>
    )
}

function Segmented({ value, onChange }) {
    return (
        <div className="flex items-center gap-1.5 overflow-auto no-scrollbar py-1">
            {STATUS.map((opt) => {
                const active = value === opt.key
                return (
                    <button
                        key={opt.key}
                        type="button"
                        onClick={() => onChange(opt.key)}
                        className={cx(
                            'whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                            active
                                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                : 'border-black/10 bg-white/75 text-slate-700 hover:bg-black/[0.03]',
                        )}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

export default function Queue() {
    const { user } = useAuth() || {}
    const navigate = useNavigate()

    const [doctorId, setDoctorId] = useState(null)
    const [doctorMeta, setDoctorMeta] = useState(null)

    const [date, setDate] = useState(todayStr())
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [statusFilter, setStatusFilter] = useState('active')
    const [searchTerm, setSearchTerm] = useState('')

    // ✅ My appointments toggle (COMMON for everyone)
    const [myOnly, setMyOnly] = useState(false)
    const prevDoctorRef = useRef({ id: null, meta: null })

    // ✅ selection rule:
    // - if MyOnly ON → needs date + logged-in user.id
    // - else → needs doctorId + date
    const hasSelection = Boolean(date) && (myOnly ? Boolean(user?.id) : Boolean(doctorId))

    // ✅ FINAL: ALWAYS filter by doctor_user_id on backend
    // MyOnly ON -> doctor_user_id = logged-in user.id
    // MyOnly OFF -> doctor_user_id = selected doctorId
    const load = useCallback(async () => {
        if (!date) {
            setRows([])
            return
        }

        const effectiveDoctorId = myOnly ? user?.id : doctorId

        if (!effectiveDoctorId) {
            setRows([])
            return
        }

        try {
            setLoading(true)

            const params = {
                for_date: date,
                doctor_user_id: Number(effectiveDoctorId),
            }

            if (user?.department_id) params.department_id = user.department_id

            const { data } = await fetchQueue(params)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error(e)
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [date, doctorId, myOnly, user])

    useEffect(() => {
        load()
    }, [load])

    const changeStatus = async (row, status, options = {}) => {
        try {
            const { data } = await updateAppointmentStatus(row.appointment_id, status)
            toast.success(`Status updated to ${String(data.status).toUpperCase()}`)
            if (options.goToVisit && data.visit_id) {
                navigate(`/opd/visit/${data.visit_id}`)
            } else {
                load()
            }
        } catch {
            // interceptor handles toast
        }
    }

    const handleDoctorChange = (id, meta) => {
        if (myOnly) return
        setDoctorId(id)
        setDoctorMeta(meta || null)
    }

    const toggleMyOnly = () => {
        if (!user?.id) return toast.error('No logged-in user found')

        setMyOnly((v) => {
            const next = !v
            if (next) {
                // save current selection
                prevDoctorRef.current = { id: doctorId, meta: doctorMeta }

                // set UI display to user
                setDoctorId(user.id)
                setDoctorMeta({ name: user?.name || user?.full_name || 'My queue' })

                toast.success('Showing my appointments only')
            } else {
                // restore selection
                const prev = prevDoctorRef.current || {}
                setDoctorId(prev?.id || null)
                setDoctorMeta(prev?.meta || null)

                toast.success('Showing selected doctor queue')
            }
            return next
        })
    }

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

    const activeCount = stats.booked + stats.checked_in + stats.in_progress

    const filteredByStatus = useMemo(() => {
        if (statusFilter === 'all') return rows
        if (statusFilter === 'active') {
            return rows.filter((r) => ['booked', 'checked_in', 'in_progress'].includes(r.status))
        }
        return rows.filter((r) => r.status === statusFilter)
    }, [rows, statusFilter])

    const filteredRows = useMemo(() => {
        const list = filteredByStatus
        const q = searchTerm.trim().toLowerCase()
        if (!q) return list
        return list.filter((r) => {
            const name = (r.patient?.name || '').toLowerCase()
            const uhid = String(r.patient?.uhid || '').toLowerCase()
            const phone = String(r.patient?.phone || '').toLowerCase()
            return name.includes(q) || uhid.includes(q) || phone.includes(q)
        })
    }, [filteredByStatus, searchTerm])

    const sortedRows = useMemo(() => {
        const score = (s) => (s === 'in_progress' ? 0 : s === 'checked_in' ? 1 : s === 'booked' ? 2 : 9)
        const parseTime = (t) => {
            if (!t) return 9999
            const [hh, mm] = String(t).split(':').map((x) => Number(x))
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 9999
            return hh * 60 + mm
        }
        return [...filteredRows].sort((a, b) => {
            const ds = score(a.status) - score(b.status)
            if (ds !== 0) return ds
            return parseTime(a.time) - parseTime(b.time)
        })
    }, [filteredRows])

    return (
        <div className={UI.page}>
            <div className="mx-auto max-w-6xl px-4 py-6 space-y-4 md:px-8">
                {/* HERO */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cx(UI.glass, 'relative overflow-hidden')}
                >
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_60%)]" />
                    <div className="relative p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                        Live OPD Queue
                                    </span>
                                </div>

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/10">
                                        <Stethoscope className="h-5 w-5 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                            Queue Management
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Check-in patients, start visits, and complete consultations — fast.
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className={UI.chip}>
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                {prettyDate(date)}
                                            </span>

                                            {doctorMeta?.name && (
                                                <span className={UI.chip}>
                                                    <User2 className="h-3.5 w-3.5" />
                                                    {doctorMeta.name}
                                                    {myOnly ? <span className="ml-1 opacity-70 ">(Me)</span> : null}
                                                </span>
                                            )}

                                            <span className={UI.chip}>
                                                <Activity className="h-3.5 w-3.5" />
                                                Active <span className="ml-1 tabular-nums">{activeCount}</span>
                                            </span>

                                            {/* ✅ My appointments toggle (COMMON) */}
                                            <button
                                                type="button"
                                                onClick={toggleMyOnly}
                                                className={cx(
                                                    UI.chipBtn,
                                                    myOnly && 'bg-red-600 text-white border-green-900 hover:text-slate-100 hover:bg-slate-800',
                                                )}
                                                title="Show only My appointments "
                                                disabled={!user?.id}
                                            >
                                                {myOnly ? <Lock className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                                                My appointments
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={load}
                                    className={UI.chipBtn}
                                    disabled={loading || !hasSelection}
                                    title="Refresh queue"
                                >
                                    <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                    Refresh
                                </button>

                                <span className={UI.chip}>
                                    Total <span className="ml-1 tabular-nums">{stats.total}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Total appointments" value={stats.total} icon={Users} tone="dark" />
                            <StatCard label="Active" value={activeCount} icon={Activity} tone="emerald" />
                            <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="sky" />
                            <StatCard label="No-show" value={stats.no_show} icon={XCircle} tone="rose" />
                        </div>
                    </div>
                </motion.div>

                {/* CONTROLS + LIST */}
                <Card className={cx(UI.glass, 'overflow-hidden')}>
                    <CardHeader className="border-b border-black/10 bg-white/60 backdrop-blur-xl">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="grid w-full gap-3 md:grid-cols-[2fr,1.1fr]">
                                    <div>
                                        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                            Queue
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Select doctor + date. Filter, search and take actions per patient.
                                        </CardDescription>

                                        <div
                                            className={cx(
                                                'mt-3 rounded-2xl border border-black/10 bg-white/85 px-3 py-2',
                                                myOnly && 'opacity-70 pointer-events-none',
                                            )}
                                            title={myOnly ? 'My appointments is ON (doctor locked)' : 'Select doctor'}
                                        >
                                            <DoctorPicker value={doctorId} onChange={handleDoctorChange} autoSelectCurrentDoctor />
                                        </div>

                                        {myOnly && (
                                            <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                                <Lock className="h-3.5 w-3.5" />
                                                Showing appointments where doctor_user_id = your user id
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            Date
                                        </label>
                                        <Input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="h-11 rounded-2xl border-black/10 bg-white/85 text-[12px] font-semibold"
                                        />

                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search name / UHID / phone…"
                                                className={cx(UI.input, 'pl-10')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                        onClick={() => {
                                            setSearchTerm('')
                                            setStatusFilter('active')
                                        }}
                                        disabled={!hasSelection}
                                    >
                                        Clear filters
                                    </Button>

                                    <Button
                                        type="button"
                                        className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                        onClick={load}
                                        disabled={loading || !hasSelection}
                                    >
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            <Separator className="bg-black/10" />

                            <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</div>
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                    Showing <span className="ml-1 tabular-nums">{sortedRows.length}</span>
                                </Badge>
                            </div>

                            <Segmented value={statusFilter} onChange={setStatusFilter} />
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {!hasSelection && (
                            <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/10 bg-white/60">
                                    <Stethoscope className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">Select doctor & date to view queue</div>
                                <p className="mt-1 text-[12px] text-slate-500">
                                    Choose a consultant above (or use My appointments), then manage patient flow in real-time.
                                </p>
                            </div>
                        )}

                        {hasSelection && loading && (
                            <div className="space-y-3 py-3">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-44 rounded-xl" />
                                                <Skeleton className="h-3 w-72 rounded-xl" />
                                            </div>
                                            <div className="flex gap-2">
                                                <Skeleton className="h-10 w-24 rounded-2xl" />
                                                <Skeleton className="h-10 w-28 rounded-2xl" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {hasSelection && !loading && sortedRows.length === 0 && (
                            <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/10 bg-white/60">
                                    <Clock className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">No appointments found</div>
                                <p className="mt-1 text-[12px] text-slate-500">
                                    Try switching the status filter, clearing search, or choose a different date.
                                </p>
                            </div>
                        )}

                        {hasSelection && !loading && sortedRows.length > 0 && (
                            <ScrollArea className="max-h-[62vh] pr-1">
                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {sortedRows.map((row) => {
                                            const waiting = computeWaitingLabel(row, date)
                                            const initials =
                                                (row.patient?.name || 'P')
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((s) => s[0]?.toUpperCase())
                                                    .join('') || 'P'

                                            return (
                                                <motion.div
                                                    key={row.appointment_id}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    transition={{ duration: 0.14 }}
                                                    className="rounded-3xl border border-black/10 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]"
                                                >
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                        {/* LEFT */}
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums">
                                                                    {row.time || '—'}
                                                                </span>

                                                                <span className={statusPill(row.status)}>
                                                                    {statusLabel[row.status] || row.status}
                                                                </span>

                                                                {waiting && (
                                                                    <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                                                                        Waiting <span className="tabular-nums">{waiting}</span>
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="mt-2 flex items-start gap-3 min-w-0">
                                                                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl border border-black/10 bg-black/[0.03] text-[12px] font-semibold text-slate-800">
                                                                    {initials}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <div className="truncate text-[14px] font-semibold text-slate-900">
                                                                            {row.patient?.name || '—'}
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500">
                                                                            UHID{' '}
                                                                            <span className="font-semibold text-slate-700">
                                                                                {row.patient?.uhid || '—'}
                                                                            </span>
                                                                            {' · '}
                                                                            <span className="font-semibold text-slate-700">
                                                                                {row.patient?.phone || '—'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <HeartPulse className="h-3.5 w-3.5" />
                                                                            Vitals{' '}
                                                                            <span className="font-semibold text-slate-700">
                                                                                {row.has_vitals ? 'Yes' : 'No'}
                                                                            </span>
                                                                        </span>
                                                                        <span className="text-slate-300">•</span>
                                                                        <span>
                                                                            Purpose{' '}
                                                                            <span className="font-semibold text-slate-700">
                                                                                {row.visit_purpose || 'Consultation'}
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* RIGHT ACTIONS */}
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            {row.status === 'booked' && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                                        onClick={() => changeStatus(row, 'checked_in')}
                                                                    >
                                                                        <LogIn className="mr-2 h-4 w-4" />
                                                                        Check-in
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                                        onClick={() => changeStatus(row, 'no_show')}
                                                                    >
                                                                        <XCircle className="mr-2 h-4 w-4" />
                                                                        No-show
                                                                    </Button>
                                                                </>
                                                            )}

                                                            {row.status === 'checked_in' && (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                                    onClick={() => changeStatus(row, 'in_progress', { goToVisit: true })}
                                                                >
                                                                    <PlayCircle className="mr-2 h-4 w-4" />
                                                                    Start visit
                                                                </Button>
                                                            )}

                                                            {row.status === 'in_progress' && (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                                    onClick={() => changeStatus(row, 'completed')}
                                                                >
                                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                    Complete
                                                                </Button>
                                                            )}

                                                            {row.visit_id && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                                    onClick={() => navigate(`/opd/visit/${row.visit_id}`)}
                                                                >
                                                                    Open visit
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
