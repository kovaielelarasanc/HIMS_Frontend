// FILE: frontend/src/opd/NoShow.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { listNoShowAppointments, rescheduleAppointment } from '../api/opd'
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
    AlertCircle,
    CalendarDays,
    Clock,
    Lock,
    RefreshCcw,
    RotateCcw,
    Search,
    User2,
    X,
    Loader2,
} from 'lucide-react'

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
        'inline-flex items-center gap-2 rounded-full border border-black/50 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition',
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

function StatCard({ label, value, icon: Icon, tone = 'slate' }) {
    const toneCls =
        tone === 'dark'
            ? 'bg-slate-900 text-white border-slate-900'
            : tone === 'rose'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-white/80 text-slate-900 border-black/50'

    return (
        <div className={cx('rounded-3xl border px-4 py-3', toneCls)}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
                    <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">{value}</div>
                </div>
                {Icon ? (
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/50 bg-white/30">
                        <Icon className="h-5 w-5 opacity-80" />
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function AppleDialog({ open, onOpenChange, title, subtitle, right, children }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cx(
                    'p-0 overflow-hidden border border-black/50 bg-white/75 backdrop-blur-xl',
                    'shadow-[0_18px_55px_rgba(2,6,23,0.18)]',
                    '!left-0 !right-0 !bottom-0 !top-auto !translate-x-0 !translate-y-0',
                    'w-screen h-[100dvh] rounded-t-3xl rounded-b-none',
                    'sm:!left-1/2 sm:!top-1/2 sm:!bottom-auto sm:!-translate-x-1/2 sm:!-translate-y-1/2',
                    'sm:w-[92vw] sm:max-w-3xl sm:h-[80vh] sm:rounded-3xl',
                    'data-[state=open]:animate-in data-[state=closed]:animate-out',
                    'data-[state=open]:duration-200 data-[state=closed]:duration-150',
                    'data-[state=open]:slide-in-from-bottom-10 data-[state=closed]:slide-out-to-bottom-10',
                    'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
                )}
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.14),_transparent_60%)] opacity-60" />

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

                    <ScrollArea className="h-[calc(100dvh-72px)] sm:h-[calc(80vh-56px)]">
                        <div className="p-4 sm:p-6 pb-[env(safe-area-inset-bottom)]">{children}</div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default function NoShow() {
    const { user } = useAuth() || {}
    const navigate = useNavigate()

    const [doctorId, setDoctorId] = useState(null)
    const [doctorMeta, setDoctorMeta] = useState(null)

    const [date, setDate] = useState(todayStr())
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [searchTerm, setSearchTerm] = useState('')

    const [myOnly, setMyOnly] = useState(false)
    const prevDoctorRef = useRef({ id: null, meta: null })

    const [target, setTarget] = useState(null)
    const [newDate, setNewDate] = useState('')
    const [newTime, setNewTime] = useState('')
    const [saving, setSaving] = useState(false)

    const hasSelection = Boolean(date) && (myOnly ? Boolean(user?.id) : Boolean(doctorId))
    const effectiveDoctorId = myOnly ? user?.id : doctorId

    const load = useCallback(async () => {
        if (!date || !hasSelection || !effectiveDoctorId) {
            setRows([])
            return
        }

        try {
            setLoading(true)
            const params = {
                for_date: date,
                // ✅ compatibility: send both keys
                doctor_user_id: Number(effectiveDoctorId),
                doctor_id: Number(effectiveDoctorId),
            }
            if (user?.department_id) params.department_id = user.department_id

            const { data } = await listNoShowAppointments(params)
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error(e)
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [date, hasSelection, effectiveDoctorId, user])

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
                setDoctorMeta({ name: user?.name || user?.full_name || 'My no-shows' })
                toast.success('Showing my no-show appointments')
            } else {
                const prev = prevDoctorRef.current || {}
                setDoctorId(prev?.id || null)
                setDoctorMeta(prev?.meta || null)
                toast.success('Showing selected doctor no-shows')
            }
            return next
        })
    }

    const openReschedule = (row) => {
        setTarget(row)
        setNewDate(row.date)
        setNewTime(row.slot_start)
    }

    const doReschedule = async ({ openQueueAfter = false } = {}) => {
        if (!target) return
        if (!newDate || !newTime) return toast.error('Select date and time')

        try {
            setSaving(true)
            await rescheduleAppointment(target.id, {
                date: newDate,
                slot_start: newTime,
                create_new: true,
            })
            toast.success('No-show rescheduled as new appointment')
            setTarget(null)
            await load()

            if (openQueueAfter) {
                const doc = target?.doctor_id || effectiveDoctorId
                if (doc && newDate) {
                    navigate('/opd/queue', { state: { doctorId: doc, date: newDate } })
                }
            }
        } finally {
            setSaving(false)
        }
    }

    const total = rows.length

    const filteredRows = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((r) => {
            const name = String(r.patient_name || '').toLowerCase()
            const uhid = String(r.uhid || '').toLowerCase()
            return name.includes(q) || uhid.includes(q)
        })
    }, [rows, searchTerm])

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
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.14),_transparent_60%)]" />
                    <div className="relative p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700">No-show Recovery</span>
                                </div>

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                        <RotateCcw className="h-5 w-5 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">No-show Appointments</h1>
                                        <p className="mt-1 text-sm text-slate-600">Recover missed visits by creating a fresh appointment quickly.</p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className={UI.chip}>
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                {prettyDate(date)}
                                            </span>

                                            {doctorMeta?.name ? (
                                                <span className={UI.chip}>
                                                    <User2 className="h-3.5 w-3.5" />
                                                    {doctorMeta.name}
                                                    {myOnly ? <span className="ml-1 opacity-70">(You)</span> : null}
                                                </span>
                                            ) : null}

                                            <span className={UI.chip}>
                                                <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                                                Total <span className="ml-1 tabular-nums">{total}</span>
                                            </span>

                                            <button
                                                type="button"
                                                onClick={toggleMyOnly}
                                                className={cx(UI.chipBtn, myOnly && 'bg-slate-900')}
                                                title="Show only logged-in user's no-shows"
                                                disabled={!user?.id}
                                            >
                                                {myOnly ? <Lock className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                                                My no-shows
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                <button type="button" onClick={load} className={UI.chipBtn} disabled={loading || !hasSelection} title="Refresh">
                                    <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                    Refresh
                                </button>
                                <span className={UI.chip}>
                                    Showing <span className="ml-1 tabular-nums">{filteredRows.length}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Total no-shows" value={total} icon={AlertCircle} tone="rose" />
                            <StatCard label="Selected date" value={prettyDate(date)} icon={CalendarDays} tone="dark" />
                            <StatCard label="Filtered" value={filteredRows.length} icon={Search} tone="slate" />
                            <StatCard label="Action" value="Reschedule" icon={RotateCcw} tone="slate" />
                        </div>
                    </div>
                </motion.div>

                {/* CONTROLS + LIST */}
                <Card className={cx(UI.glass, 'overflow-hidden')}>
                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="grid w-full gap-3 md:grid-cols-[2fr,1.1fr]">
                                    <div>
                                        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">No-show List</CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">Select doctor + date, then reschedule missed visits.</CardDescription>

                                        <div
                                            className={cx('mt-3 rounded-2xl border border-black/50 bg-white/85 px-3 py-2', myOnly && 'opacity-70 pointer-events-none')}
                                            title={myOnly ? 'My no-shows is ON (doctor locked)' : 'Select doctor'}
                                        >
                                            <DoctorPicker value={doctorId} onChange={handleDoctorChange} autoSelectCurrentDoctor />
                                        </div>

                                        {myOnly && (
                                            <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                                <Lock className="h-3.5 w-3.5" />
                                                doctor_user_id = your user id
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            For date
                                        </label>
                                        <Input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                        />

                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search patient / UHID…"
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
                                        onClick={() => setSearchTerm('')}
                                        disabled={!hasSelection}
                                    >
                                        Clear search
                                    </Button>

                                    <Button
                                        type="button"
                                        className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                        onClick={load}
                                        disabled={loading || !hasSelection}
                                    >
                                        <RefreshCcw className={cx('mr-2 h-4 w-4', loading && 'animate-spin')} />
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            <Separator className="bg-black/10" />
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {!hasSelection && (
                            <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/50 bg-white/60">
                                    <AlertCircle className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">Select doctor & date</div>
                                <p className="mt-1 text-[12px] text-slate-500">Or enable My no-shows.</p>
                            </div>
                        )}

                        {hasSelection && loading && (
                            <div className="space-y-3 py-3">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-3xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-44 rounded-xl" />
                                                <Skeleton className="h-3 w-72 rounded-xl" />
                                            </div>
                                            <Skeleton className="h-10 w-28 rounded-2xl" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {hasSelection && !loading && filteredRows.length === 0 && (
                            <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/50 bg-white/60">
                                    <Clock className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">No no-shows found</div>
                                <p className="mt-1 text-[12px] text-slate-500">Try a different doctor/date or clear search.</p>
                            </div>
                        )}

                        {hasSelection && !loading && filteredRows.length > 0 && (
                            <ScrollArea className="max-h-[62vh] pr-1">
                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {filteredRows.map((r) => {
                                            const initials =
                                                (r.patient_name || 'P')
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((s) => s[0]?.toUpperCase())
                                                    .join('') || 'P'

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
                                                                    {prettyDate(r.date)} • {r.slot_start}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800">
                                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                                    No-show
                                                                </span>
                                                            </div>

                                                            <div className="mt-2 flex items-start gap-3 min-w-0">
                                                                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl border border-black/50 bg-black/[0.03] text-[12px] font-semibold text-slate-800">
                                                                    {initials}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <div className="truncate text-[14px] font-semibold text-slate-900">{r.patient_name || '—'}</div>
                                                                        <div className="text-[11px] text-slate-500">
                                                                            UHID <span className="font-semibold text-slate-700">{r.uhid || '—'}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-1 text-[11px] text-slate-500">
                                                                        {r.department_name} · Dr. {r.doctor_name} · Purpose:{' '}
                                                                        <span className="font-semibold text-slate-700">{r.purpose || 'Consultation'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                className="h-10 rounded-2xl font-semibold gap-2 bg-slate-900 hover:bg-slate-800 text-white"
                                                                onClick={() => openReschedule(r)}
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                                Reschedule
                                                            </Button>
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

                {/* ✅ Apple Reschedule Dialog */}
                <AppleDialog
                    open={Boolean(target)}
                    onOpenChange={(v) => {
                        if (!v) setTarget(null)
                    }}
                    title="Reschedule No-show"
                    subtitle={target ? `${target.patient_name} · UHID ${target.uhid} · Dr. ${target.doctor_name}` : ''}
                    right={
                        <>
                            <Button
                                type="button"
                                disabled={saving}
                                variant="outline"
                                className="h-9 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                onClick={() => doReschedule({ openQueueAfter: false })}
                            >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Create
                            </Button>

                            <Button
                                type="button"
                                disabled={saving}
                                className="h-9 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold"
                                onClick={() => doReschedule({ openQueueAfter: true })}
                            >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Create & open queue
                            </Button>
                        </>
                    }
                >
                    {target ? (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-black/50 bg-white/80 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={UI.chip}>
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        Old: {prettyDate(target.date)} · {target.slot_start}
                                    </span>
                                    <span className={UI.chip}>
                                        <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                                        No-show
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        New date
                                    </label>
                                    <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-11 rounded-2xl" />
                                </div>

                                <div className="space-y-1">
                                    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        <Clock className="h-3.5 w-3.5" />
                                        New time
                                    </label>
                                    <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-11 rounded-2xl" />
                                </div>

                                <div className="md:col-span-2 text-[12px] text-slate-500">
                                    This creates a fresh appointment (keeps the old no-show as history).
                                </div>
                            </div>
                        </div>
                    ) : null}
                </AppleDialog>
            </div>
        </div>
    )
}
