// FILE: frontend/src/opd/Followups.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { listFollowups, updateFollowup, scheduleFollowup, getFreeSlots } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'
import { useAuth } from '../store/authStore'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent } from '@/components/ui/dialog'

import {
    Activity,
    AlertCircle,
    Bell,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Clock,
    Loader2,
    Lock,
    RefreshCcw,
    Search,
    Stethoscope,
    User2,
    Users,
    X,
    XCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const todayStr = () => new Date().toISOString().slice(0, 10)

function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

const UI = {
    page: 'min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50',
    glass:
        'rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
    chip:
        'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700',
    chipBtn:
        'inline-flex items-center gap-2 rounded-full border bg-green-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:text-black hover:bg-black/[0.03] active:scale-[0.99] transition',
    input:
        'h-11 w-full rounded-2xl border border-black/50 bg-white/85 px-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
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

const STATUS = [
    { key: 'waiting', label: 'Waiting' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: '*', label: 'All' },
]

const STATUS_LABEL = {
    waiting: 'Waiting',
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    '*': 'All',
}

function statusPill(status) {
    const base = 'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase'
    switch (status) {
        case 'waiting':
            return cx(base, 'border-amber-200 bg-amber-50 text-amber-800')
        case 'scheduled':
            return cx(base, 'border-sky-200 bg-sky-50 text-sky-800')
        case 'completed':
            return cx(base, 'border-emerald-200 bg-emerald-50 text-emerald-800')
        case 'cancelled':
            return cx(base, 'border-slate-500 bg-slate-100 text-slate-600')
        default:
            return cx(base, 'border-slate-500 bg-slate-50 text-slate-700')
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
                    : tone === 'amber'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-white/80 text-slate-900 border-black/50'

    return (
        <div className={cx('rounded-3xl border px-4 py-3', toneCls)}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
                    <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">{value}</div>
                </div>
                {Icon && (
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/50 bg-white/30">
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
                                : 'border-black/50 bg-white/75 text-slate-700 hover:bg-black/[0.03]',
                        )}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

/** NUTRYAH-style dialog */
function NUTRYAHDialog({ open, onOpenChange, title, subtitle, right, children }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cx(
                    'p-0 overflow-hidden border border-black/50 bg-white/75 backdrop-blur-xl',
                    'shadow-[0_18px_55px_rgba(2,6,23,0.18)]',
                    '!left-0 !right-0 !bottom-0 !top-auto !translate-x-0 !translate-y-0',
                    'w-screen h-[100dvh]',
                    'rounded-t-3xl rounded-b-none',
                    'sm:!left-1/2 sm:!top-1/2 sm:!bottom-auto sm:!-translate-x-1/2 sm:!-translate-y-1/2',
                    'sm:w-[92vw] sm:max-w-5xl sm:h-[88vh]',
                    'sm:rounded-3xl',
                    'data-[state=open]:animate-in data-[state=closed]:animate-out',
                    'data-[state=open]:duration-200 data-[state=closed]:duration-150',
                    'data-[state=open]:slide-in-from-bottom-10 data-[state=closed]:slide-out-to-bottom-10',
                    'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
                )}
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_60%)] opacity-70" />

                    <div className="relative sm:hidden pt-3">
                        <div className="mx-auto h-1.5 w-12 rounded-full bg-black/15" />
                    </div>

                    <div className="relative border-b border-black/50 bg-white/55 backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold tracking-tight text-slate-900 truncate">{title}</div>
                                {subtitle ? <div className="mt-0.5 text-[11px] text-slate-600 truncate">{subtitle}</div> : null}
                            </div>

                            <div className="flex items-center gap-2">
                                {right}
                                <button
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/50 bg-white/75 hover:bg-black/[0.03] transition"
                                    title="Close"
                                >
                                    <X className="h-4 w-4 text-slate-700" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="h-[calc(100dvh-72px)] sm:h-[calc(88vh-56px)]">
                        <div className="p-4 sm:p-6 pb-[env(safe-area-inset-bottom)]">{children}</div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default function Followups() {
    const { user } = useAuth() || {}
    const navigate = useNavigate()

    const [status, setStatus] = useState('waiting')
    const [doctorId, setDoctorId] = useState(null)
    const [doctorMeta, setDoctorMeta] = useState(null)

    const [dateFrom, setDateFrom] = useState(todayStr())
    const [dateTo, setDateTo] = useState(todayStr())

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // My follow-ups toggle
    const [myOnly, setMyOnly] = useState(false)
    const prevDoctorRef = useRef({ id: null, meta: null })

    // Edit dialog
    const [editTarget, setEditTarget] = useState(null)
    const [editDate, setEditDate] = useState('')
    const [editNote, setEditNote] = useState('')
    const [editSaving, setEditSaving] = useState(false)

    // Schedule dialog
    const [schedTarget, setSchedTarget] = useState(null)
    const [schedDate, setSchedDate] = useState('')
    const [schedTime, setSchedTime] = useState('')

    // ✅ NEW: Free booking mode (no slot required)
    const [freeBooking, setFreeBooking] = useState(true)

    const [slots, setSlots] = useState([])
    const [schedSaving, setSchedSaving] = useState(false)
    const [slotsLoading, setSlotsLoading] = useState(false)

    const hasSelection = Boolean(dateFrom) && Boolean(dateTo) && (myOnly ? Boolean(user?.id) : true)

    const load = useCallback(async () => {
        if (!dateFrom || !dateTo) {
            setRows([])
            return
        }

        const effectiveDoctorId = myOnly ? user?.id : doctorId

        try {
            setLoading(true)
            const params = {
                status,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                doctor_id: effectiveDoctorId ? Number(effectiveDoctorId) : undefined,
            }
            const { data } = await listFollowups(params)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error(e)
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [status, dateFrom, dateTo, doctorId, myOnly, user])

    useEffect(() => {
        load()
    }, [load])

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
                prevDoctorRef.current = { id: doctorId, meta: doctorMeta }
                setDoctorId(user.id)
                setDoctorMeta({ name: user?.name || user?.full_name || 'My follow-ups' })
                toast.success('Showing my follow-ups only')
            } else {
                const prev = prevDoctorRef.current || {}
                setDoctorId(prev?.id || null)
                setDoctorMeta(prev?.meta || null)
                toast.success('Showing selected doctor / all follow-ups')
            }
            return next
        })
    }

    // ---- Edit ----
    const openEdit = (row) => {
        setEditTarget(row)
        setEditDate(row.due_date)
        setEditNote(row.note || '')
    }

    const closeEdit = () => {
        setEditTarget(null)
        setEditDate('')
        setEditNote('')
        setEditSaving(false)
    }

    const saveEdit = async (e) => {
        e.preventDefault()
        if (!editTarget) return

        try {
            setEditSaving(true)
            await updateFollowup(editTarget.id, {
                due_date: editDate,
                note: editNote || undefined,
            })
            toast.success('Follow-up updated')
            closeEdit()
            await load()
        } catch {
            // handled globally
        } finally {
            setEditSaving(false)
        }
    }

    // ---- Schedule ----
    const loadSlots = async (row, dateStr) => {
        if (!row?.doctor_id || !dateStr) {
            setSlots([])
            return
        }
        try {
            setSlotsLoading(true)
            const { data } = await getFreeSlots({ doctorUserId: row.doctor_id, date: dateStr })
            setSlots(Array.isArray(data) ? data : [])
        } catch {
            setSlots([])
        } finally {
            setSlotsLoading(false)
        }
    }

    const openSchedule = async (row) => {
        setSchedTarget(row)
        const d = row.due_date
        setSchedDate(d)
        setSchedTime('')
        setSlots([])

        // ✅ default = Free booking (no time required)
        setFreeBooking(true)

        // do NOT load slots by default (only if doctor chooses "Set time")
        setSlotsLoading(false)
    }

    const closeSchedule = () => {
        setSchedTarget(null)
        setSchedDate('')
        setSchedTime('')
        setFreeBooking(true)
        setSlots([])
        setSlotsLoading(false)
        setSchedSaving(false)
    }

    const onSchedDateChange = async (e) => {
        const d = e.target.value
        setSchedDate(d)
        // load slots only if time-mode is enabled
        if (schedTarget && !freeBooking) await loadSlots(schedTarget, d)
    }

    const enableTimeMode = async () => {
        setFreeBooking(false)
        // lazy load slots now
        if (schedTarget && schedDate) await loadSlots(schedTarget, schedDate)
    }

    const enableFreeMode = () => {
        setFreeBooking(true)
        setSchedTime('')
        setSlots([]) // keep clean
    }

    const saveSchedule = async (e) => {
        e.preventDefault()
        if (!schedTarget) return
        if (!schedDate) return toast.error('Select a date')

        try {
            setSchedSaving(true)

            const payload = {
                date: schedDate || undefined,
                // ✅ slot_start OPTIONAL: only send if time-mode and value exists
                ...(freeBooking ? {} : (schedTime ? { slot_start: schedTime } : {})),
            }

            await scheduleFollowup(schedTarget.id, payload)
            toast.success(freeBooking || !schedTime ? 'Follow-up confirmed (Free booking)' : 'Follow-up scheduled')
            closeSchedule()
            await load()
        } catch {
            // handled globally
        } finally {
            setSchedSaving(false)
        }
    }

    // ---- stats ----
    const stats = useMemo(() => {
        const base = { total: rows.length, waiting: 0, scheduled: 0, completed: 0, cancelled: 0 }
        for (const r of rows) if (base[r.status] !== undefined) base[r.status] += 1
        return base
    }, [rows])

    // ---- search/sort ----
    const filteredRows = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((r) => {
            const name = String(r.patient_name || '').toLowerCase()
            const uhid = String(r.patient_uhid || '').toLowerCase()
            const phone = String(r.patient_phone || '').toLowerCase()
            const doc = String(r.doctor_name || '').toLowerCase()
            return name.includes(q) || uhid.includes(q) || phone.includes(q) || doc.includes(q)
        })
    }, [rows, searchTerm])

    const sortedRows = useMemo(() => {
        const toTime = (d) => {
            if (!d) return 9e15
            const t = new Date(d).getTime()
            return Number.isFinite(t) ? t : 9e15
        }
        return [...filteredRows].sort((a, b) => toTime(a.due_date) - toTime(b.due_date))
    }, [filteredRows])

    return (
        <div className={UI.page}>
            <div className="mx-auto max-w-6xl px-4 md:px-8 py-6 space-y-4">
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
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Follow-up Tracker</span>
                                </div>

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                        <ClipboardList className="h-5 w-5 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">OPD Follow-ups</h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Confirm follow-ups as OPD appointments — <span className="font-semibold">time is optional (Free booking)</span>.
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className={UI.chip}>
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                {prettyDate(dateFrom)} – {prettyDate(dateTo)}
                                            </span>

                                            {doctorMeta?.name && (
                                                <span className={UI.chip}>
                                                    <User2 className="h-3.5 w-3.5" />
                                                    {doctorMeta.name}
                                                    {myOnly ? <span className="ml-1 opacity-70">(Me)</span> : null}
                                                </span>
                                            )}

                                            <span className={UI.chip}>
                                                <Bell className="h-3.5 w-3.5" />
                                                {STATUS_LABEL[status] || status}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={toggleMyOnly}
                                                className={cx(
                                                    UI.chipBtn,
                                                    myOnly && 'bg-slate-900 text-white border-slate-900 hover:text-slate-100 hover:bg-slate-800',
                                                )}
                                                disabled={!user?.id}
                                                title="doctor_id = logged-in user id"
                                            >
                                                {myOnly ? <Lock className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                                                My follow-ups
                                            </button>

                                            <span className={UI.chip}>
                                                <Users className="h-3.5 w-3.5" />
                                                Showing <span className="tabular-nums">{sortedRows.length}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                <button type="button" onClick={load} className={UI.chipBtn} disabled={loading || !hasSelection} title="Refresh follow-ups">
                                    <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                    Refresh
                                </button>

                                <span className={UI.chip}>
                                    Total <span className="ml-1 tabular-nums">{stats.total}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Waiting" value={stats.waiting} icon={Bell} tone="amber" />
                            <StatCard label="Scheduled" value={stats.scheduled} icon={Clock} tone="sky" />
                            <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="emerald" />
                            <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} tone="slate" />
                        </div>
                    </div>
                </motion.div>

                {/* FILTERS + LIST */}
                <Card className={cx(UI.glass, 'overflow-hidden')}>
                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="grid w-full gap-3 md:grid-cols-[1.6fr,1fr,1fr]">
                                    <div>
                                        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">Follow-ups</CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Filter by doctor + date range. Confirm with date only (time optional).
                                        </CardDescription>

                                        <div
                                            className={cx('mt-3 rounded-2xl border border-black/50 bg-white/85 px-3 py-2', myOnly && 'opacity-70 pointer-events-none')}
                                            title={myOnly ? 'My follow-ups is ON (doctor locked)' : 'Select doctor (optional)'}
                                        >
                                            <DoctorPicker value={doctorId} onChange={handleDoctorChange} autoSelectCurrentDoctor />
                                        </div>

                                        {myOnly && (
                                            <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                                <Lock className="h-3.5 w-3.5" />
                                                Filtering with doctor_id = your user id
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            From
                                        </label>
                                        <Input
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            To
                                        </label>
                                        <Input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                        />

                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search name / UHID / phone / doctor…"
                                                className={cx(UI.input, 'pl-10')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                        onClick={() => {
                                            setSearchTerm('')
                                            setStatus('waiting')
                                        }}
                                        disabled={loading}
                                    >
                                        Clear
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
                                    className="rounded-full border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                    Showing <span className="ml-1 tabular-nums">{sortedRows.length}</span>
                                </Badge>
                            </div>

                            <Segmented value={status} onChange={setStatus} />
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {hasSelection && loading && (
                            <div className="space-y-3 py-3">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-3xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3">
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

                        {hasSelection && !loading && sortedRows.length > 0 && (
                            <ScrollArea className="max-h-[62vh] pr-1">
                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {sortedRows.map((r) => {
                                            const apptTime =
                                                r.slot_start || r.appointment_time || r.time || r.slot || '' // safe fallbacks
                                            const showFree = r.status === 'scheduled' && !apptTime

                                            return (
                                                <motion.div
                                                    key={r.id}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    transition={{ duration: 0.14 }}
                                                    className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]"
                                                >
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums">
                                                                    {prettyDate(r.due_date)}
                                                                </span>

                                                                <span className={statusPill(r.status)}>{STATUS_LABEL[r.status] || r.status}</span>

                                                                {apptTime ? (
                                                                    <span className={UI.chip}>
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        {apptTime}
                                                                    </span>
                                                                ) : null}

                                                                {showFree ? (
                                                                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                        Free booking
                                                                    </span>
                                                                ) : null}

                                                                {r.appointment_id && (
                                                                    <span className={UI.chip}>
                                                                        <Activity className="h-3.5 w-3.5" />
                                                                        Appt <span className="tabular-nums">#{r.appointment_id}</span>
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="mt-2 flex items-start gap-3 min-w-0">
                                                                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl border border-black/50 bg-black/[0.03] text-[12px] font-semibold text-slate-800">
                                                                    {(String(r.patient_name || 'P')
                                                                        .split(' ')
                                                                        .filter(Boolean)
                                                                        .slice(0, 2)
                                                                        .map((s) => s[0]?.toUpperCase())
                                                                        .join('')) || 'P'}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <div className="truncate text-[14px] font-semibold text-slate-900">{r.patient_name || '—'}</div>
                                                                        <div className="text-[11px] text-slate-500">
                                                                            UHID <span className="font-semibold text-slate-700">{r.patient_uhid || '—'}</span>
                                                                            {r.patient_phone ? (
                                                                                <>
                                                                                    {' · '}
                                                                                    <span className="font-semibold text-slate-700">{r.patient_phone}</span>
                                                                                </>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <User2 className="h-3.5 w-3.5" />
                                                                            Dr. <span className="font-semibold text-slate-700">{r.doctor_name || '—'}</span>
                                                                        </span>
                                                                    </div>

                                                                    {r.note ? <div className="mt-1 text-[11px] text-slate-600">Note: {r.note}</div> : null}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            {r.status === 'waiting' && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                                        onClick={() => openEdit(r)}
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                                        onClick={() => openSchedule(r)}
                                                                    >
                                                                        Confirm
                                                                    </Button>
                                                                </>
                                                            )}

                                                            {r.status === 'scheduled' && r.appointment_id ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                                    onClick={() => navigate('/opd/appointments')}
                                                                >
                                                                    Open appointments
                                                                </Button>
                                                            ) : null}
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

                {/* EDIT */}
                <NUTRYAHDialog
                    open={Boolean(editTarget)}
                    onOpenChange={(v) => {
                        if (!v) closeEdit()
                    }}
                    title="Edit Follow-up"
                    subtitle={editTarget ? `${editTarget.patient_name} · UHID ${editTarget.patient_uhid}` : ''}
                    right={
                        <Button
                            type="button"
                            disabled={editSaving}
                            className="h-9 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold"
                            onClick={(e) => saveEdit(e)}
                        >
                            {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save
                        </Button>
                    }
                >
                    {editTarget ? (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-black/50 bg-white/80 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={UI.chip}>
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        Due <span className="tabular-nums">{prettyDate(editTarget.due_date)}</span>
                                    </span>
                                    <span className={statusPill(editTarget.status)}>{STATUS_LABEL[editTarget.status] || editTarget.status}</span>
                                </div>
                            </div>

                            <form onSubmit={saveEdit} className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        Due date
                                    </label>
                                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-11 rounded-2xl" />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                        <Stethoscope className="h-3.5 w-3.5" />
                                        Note
                                    </label>
                                    <Input
                                        value={editNote}
                                        onChange={(e) => setEditNote(e.target.value)}
                                        placeholder="Short instruction for next visit…"
                                        className="h-11 rounded-2xl"
                                    />
                                </div>
                            </form>
                        </div>
                    ) : null}
                </NUTRYAHDialog>

                {/* SCHEDULE (Free booking) */}
                <NUTRYAHDialog
                    open={Boolean(schedTarget)}
                    onOpenChange={(v) => {
                        if (!v) closeSchedule()
                    }}
                    title="Confirm Follow-up"
                    subtitle={schedTarget ? `${schedTarget.patient_name} · UHID ${schedTarget.patient_uhid} · Dr. ${schedTarget.doctor_name || '—'}` : ''}
                    right={
                        <Button
                            type="button"
                            disabled={schedSaving}
                            className="h-9 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold"
                            onClick={(e) => saveSchedule(e)}
                        >
                            {schedSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirm
                        </Button>
                    }
                >
                    {schedTarget ? (
                        <div className="space-y-4">
                            {/* mode chooser */}
                            <div className="rounded-3xl border border-black/50 bg-white/80 p-4">
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={enableFreeMode}
                                            className={cx(
                                                'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                                                freeBooking ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/50 bg-white/75 text-slate-700',
                                            )}
                                        >
                                            ✅ Free booking (No time)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={enableTimeMode}
                                            className={cx(
                                                'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                                                !freeBooking ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/50 bg-white/75 text-slate-700',
                                            )}
                                        >
                                            ⏱ Optional time
                                        </button>

                                        <span className={UI.chip}>
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {prettyDate(schedTarget.due_date)}
                                        </span>

                                        <span className={statusPill(schedTarget.status)}>{STATUS_LABEL[schedTarget.status] || schedTarget.status}</span>
                                    </div>

                                    {freeBooking ? (
                                        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
                                            <CheckCircle2 className="mt-[1px] h-4 w-4" />
                                            <span>
                                                Free booking means: <span className="font-semibold">no slot/time is required</span>. Appointment will be created for the date and shown in queue.
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
                                            <Clock className="mt-[1px] h-4 w-4" />
                                            <span>Optional time: choose from free slots or type a custom time. (Still not mandatory.)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={saveSchedule} className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-[1fr,2fr] md:items-start">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            Date
                                        </label>
                                        <Input type="date" value={schedDate} onChange={onSchedDateChange} className="h-11 rounded-2xl" />
                                    </div>

                                    {/* time block only when optional-time mode */}
                                    {!freeBooking ? (
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" />
                                                Time (optional)
                                            </label>

                                            {slotsLoading ? (
                                                <div className="text-[12px] text-slate-500">Loading slots…</div>
                                            ) : slots.length === 0 ? (
                                                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                                                    <AlertCircle className="mt-[1px] h-4 w-4" />
                                                    <span>No free slots found. You can type time or leave empty.</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {slots.map((t) => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => setSchedTime(t)}
                                                            className={cx(
                                                                'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                                                                schedTime === t
                                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                                    : 'border-black/50 bg-white/75 text-slate-700 hover:bg-black/[0.03]',
                                                            )}
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <Input
                                                type="time"
                                                value={schedTime}
                                                onChange={(e) => setSchedTime(e.target.value)}
                                                className="h-11 rounded-2xl"
                                            />

                                            <p className="text-[11px] text-slate-500">
                                                Leave blank to still confirm as Free booking.
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            </form>
                        </div>
                    ) : null}
                </NUTRYAHDialog>
            </div>
        </div>
    )
}
