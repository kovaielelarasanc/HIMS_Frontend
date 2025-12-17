// FILE: frontend/src/opd/AppointmentBooking.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { createAppointment, listAppointments, getDoctorSlots } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'
import PatientPicker from './components/PatientPicker'

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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import {
    CalendarDays,
    Clock,
    Stethoscope,
    User2,
    Activity,
    Loader2,
    RefreshCcw,
    Search,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Sparkles,
    ArrowLeft,
    ArrowRight,
} from 'lucide-react'

const todayStr = () => new Date().toISOString().slice(0, 10)

const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
}

function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

function normTime(t) {
    if (!t) return ''
    const s = String(t)
    return s.length >= 5 ? s.slice(0, 5) : s
}

function parseTimeToMinutes(t) {
    const tt = normTime(t)
    if (!tt) return 0
    const [hh, mm] = tt.split(':')
    return Number(hh || 0) * 60 + Number(mm || 0)
}

function isFreeSlot(s) {
    return s?.status === 'free' || !s?.status
}

function timeBucket(start) {
    const m = parseTimeToMinutes(start)
    if (m < 12 * 60) return 'Morning'
    if (m < 17 * 60) return 'Afternoon'
    return 'Evening'
}

function addDays(isoDate, days) {
    const d = new Date(isoDate)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
}

const UI = {
    page: 'min-h-[calc(100vh-4rem)] w-full bg-slate-50',
    stickyTop:
        ' top-0 z-30 ',
    container: 'px-4 py-5 md:px-8 md:py-8',
    glass:
        'rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
    glassSoft:
        'rounded-3xl border border-black/50 bg-white/70 backdrop-blur-xl shadow-[0_6px_22px_rgba(2,6,23,0.08)]',
    chip:
        'inline-flex items-center gap-1 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700',
    pillBtn:
        'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed',
    input:
        'w-full rounded-2xl border border-black/50 bg-white/85 px-3 py-2 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
}

function SegmentedTabs({ value, onChange, tabs }) {
    return (
        <div className="inline-flex items-center rounded-full border border-black/50 bg-white/85 p-1 shadow-[0_8px_22px_rgba(2,6,23,0.08)]">
            {tabs.map((t) => {
                const active = value === t.key
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onChange(t.key)}
                        className={cx(
                            'relative px-3 sm:px-4 py-1.5 rounded-full text-[12px] font-semibold transition',
                            active ? 'text-white' : 'text-slate-700 hover:bg-black/[0.03]'
                        )}
                    >
                        {active && (
                            <motion.span
                                layoutId="seg-pill"
                                className="absolute inset-0 rounded-full bg-slate-900"
                                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                            />
                        )}
                        <span className="relative z-10">{t.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

function CollapsibleHeader({ open, onToggle, icon, title, subtitle, right }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-start justify-between gap-3 rounded-2xl border border-black/50 bg-white/70 px-4 py-3 hover:bg-black/[0.02] transition"
        >
            <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 rounded-2xl border border-black/50 bg-black/[0.04] grid place-items-center">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 truncate">
                        {title}
                    </div>
                    {subtitle && (
                        <div className="mt-0.5 text-[12px] text-slate-500 line-clamp-1">
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {right}
                <div className="h-9 w-9 rounded-full border border-black/50 bg-white/85 grid place-items-center">
                    <ChevronRight
                        className={cx('h-4 w-4 text-slate-600 transition', open && 'rotate-90')}
                    />
                </div>
            </div>
        </button>
    )
}

function EmptyState({ title, subtitle }) {
    return (
        <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] px-5 py-7 text-center">
            <div className="text-[13px] font-semibold text-slate-900">{title}</div>
            {subtitle && <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div>}
        </div>
    )
}

export default function AppointmentBooking() {
    // Core form state
    const [date, setDate] = useState(todayStr())
    const [doctorId, setDoctorId] = useState(null)
    const [departmentId, setDepartmentId] = useState(null)
    const [patientId, setPatientId] = useState(null)
    const [purpose, setPurpose] = useState('Consultation')

    // UI view (NO split layout)
    const [view, setView] = useState('book') // book | day | today

    // Top doctor picker (sticky header)
    const [topDoctorOpen, setTopDoctorOpen] = useState(true)

    // Slots
    const [slots, setSlots] = useState([])
    const [selectedSlot, setSelectedSlot] = useState('')
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [showAllSlots, setShowAllSlots] = useState(false)

    // Appointments for selected date
    const [appointments, setAppointments] = useState([])
    const [loadingAppts, setLoadingAppts] = useState(false)

    // Appointments for today (selected doctor)
    const [todayAppointments, setTodayAppointments] = useState([])
    const [loadingToday, setLoadingToday] = useState(false)

    // Filters (for lists)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')

    // Collapsibles
    const [open, setOpen] = useState({
        patient: true,
        doctor: false, // doctor section exists in form, but top picker is primary
        details: true,
        slots: true,
        preview: false,
        filters: true,
    })

    const today = useMemo(() => todayStr(), [])

    const handleDoctorChange = (id, meta) => {
        setDoctorId(id)
        setDepartmentId(meta?.department_id || null)
        setSelectedSlot('')
    }

    const handlePatientChange = (id) => setPatientId(id)

    // Auto-open top picker until doctor is selected
    useEffect(() => {
        if (!doctorId) setTopDoctorOpen(true)
    }, [doctorId])

    // ---- loaders ----
    const loadSelected = useCallback(async () => {
        if (!doctorId || !date) {
            setAppointments([])
            setSlots([])
            return
        }

        try {
            setLoadingSlots(true)
            const { data: slotData } = await getDoctorSlots({
                doctorUserId: Number(doctorId),
                date,
                detailed: true,
            })
            const arr = Array.isArray(slotData) ? slotData : slotData?.slots || []
            setSlots(arr)
        } catch {
            setSlots([])
        } finally {
            setLoadingSlots(false)
        }

        try {
            setLoadingAppts(true)
            const { data: appts } = await listAppointments({
                date,
                doctor_id: Number(doctorId),
            })
            setAppointments(appts || [])
        } catch {
            setAppointments([])
        } finally {
            setLoadingAppts(false)
        }
    }, [doctorId, date])

    const loadToday = useCallback(async () => {
        if (!doctorId) {
            setTodayAppointments([])
            return
        }
        try {
            setLoadingToday(true)
            const { data: appts } = await listAppointments({
                date: today,
                doctor_id: Number(doctorId),
            })
            setTodayAppointments(appts || [])
        } catch {
            setTodayAppointments([])
        } finally {
            setLoadingToday(false)
        }
    }, [doctorId, today])

    useEffect(() => {
        loadSelected()
    }, [loadSelected])

    useEffect(() => {
        loadToday()
    }, [loadToday])

    const refreshAll = async () => {
        await Promise.all([loadSelected(), loadToday()])
    }

    const freeSlots = useMemo(() => (slots || []).filter(isFreeSlot), [slots])

    const visibleSlots = useMemo(() => {
        const list = showAllSlots ? slots || [] : freeSlots
        return [...list].sort(
            (a, b) => parseTimeToMinutes(a?.start) - parseTimeToMinutes(b?.start)
        )
    }, [slots, freeSlots, showAllSlots])

    const slotsByBucket = useMemo(() => {
        const map = { Morning: [], Afternoon: [], Evening: [] }
        for (const s of visibleSlots) map[timeBucket(s?.start)].push(s)
        return map
    }, [visibleSlots])

    // map selected-date appointments by start time (for booked slot labels)
    const apptByStart = useMemo(() => {
        const m = new Map()
        for (const a of appointments || []) {
            const k = normTime(a?.slot_start)
            if (k) m.set(k, a)
        }
        return m
    }, [appointments])

    const selectedStats = useMemo(() => {
        const total = appointments.length
        const free = freeSlots.length
        const chosen =
            selectedSlot ||
            (freeSlots[0]?.start ? `Earliest ${freeSlots[0].start}` : 'Not selected')
        return { total, free, chosen }
    }, [appointments, freeSlots, selectedSlot])

    const activeList = useMemo(() => {
        return view === 'today' ? todayAppointments : appointments
    }, [view, todayAppointments, appointments])

    const activeDate = useMemo(() => {
        return view === 'today' ? today : date
    }, [view, today, date])

    const activeLoading = useMemo(() => {
        return view === 'today' ? loadingToday : loadingAppts
    }, [view, loadingToday, loadingAppts])

    const statusCounts = useMemo(() => {
        const c = {
            all: activeList.length,
            booked: 0,
            checked_in: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0,
            no_show: 0,
        }
        for (const a of activeList || []) {
            const k = String(a?.status || '').toLowerCase()
            if (c[k] !== undefined) c[k] += 1
        }
        return c
    }, [activeList])

    const filteredList = useMemo(() => {
        const q = search.toLowerCase().trim()
        return (activeList || []).filter((a) => {
            const st = String(a?.status || '').toLowerCase()
            if (status !== 'all' && st !== status) return false
            if (!q) return true
            const name = String(a?.patient_name || '').toLowerCase()
            const uhid = String(a?.uhid || '').toLowerCase()
            const dept = String(a?.department_name || '').toLowerCase()
            const doc = String(a?.doctor_name || '').toLowerCase()
            const slot = `${a?.slot_start || ''} ${a?.slot_end || ''}`.toLowerCase()
            return `${name} ${uhid} ${dept} ${doc} ${slot} ${st}`.includes(q)
        })
    }, [activeList, search, status])

    const canBookNow = useMemo(() => {
        return !!patientId && !!doctorId && !!departmentId && !!selectedSlot
    }, [patientId, doctorId, departmentId, selectedSlot])

    const book = async (e) => {
        e.preventDefault()
        if (!patientId) return toast.error('Please select a patient')
        if (!doctorId || !departmentId) return toast.error('Please select department & doctor')
        if (!selectedSlot) return toast.error('Please choose a time slot')

        try {
            await createAppointment({
                patient_id: patientId,
                department_id: departmentId,
                doctor_user_id: doctorId,
                date,
                slot_start: selectedSlot,
                purpose: purpose || 'Consultation',
            })
            toast.success('Appointment booked')
            setSelectedSlot('')
            await refreshAll()
            setView('day')
        } catch {
            // interceptor handles
        }
    }

    const headerTabs = useMemo(
        () => [
            { key: 'book', label: 'Book' },
            { key: 'day', label: `Schedule (${date})` },
            { key: 'today', label: `Today (${today})` },
        ],
        [date, today]
    )

    const clearDoctor = () => {
        setDoctorId(null)
        setDepartmentId(null)
        setSlots([])
        setAppointments([])
        setTodayAppointments([])
        setSelectedSlot('')
        setSearch('')
        setStatus('all')
    }

    return (
        <div className={UI.page}>
            {/* Sticky premium header */}
            <div className={UI.stickyTop}>
                <div className="px-4 py-4 md:px-8">
                    <div className="flex flex-col gap-3">
                        {/* Row 1: title + tabs */}
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={UI.chip}>
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Live OPD · Appointment
                                    </span>

                                    <button
                                        type="button"
                                        className={cx(UI.pillBtn, 'h-8')}
                                        onClick={() => {
                                            setDate(today)
                                            setView('day')
                                        }}
                                        title="Jump to today (selected-date schedule)"
                                    >
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        Today
                                    </button>

                                    {doctorId ? (
                                        <span className={UI.chip}>
                                            <Stethoscope className="h-3.5 w-3.5" />
                                            Doctor ID {doctorId}
                                        </span>
                                    ) : (
                                        <span className={UI.chip}>
                                            <Stethoscope className="h-3.5 w-3.5" />
                                            Select doctor
                                        </span>
                                    )}
                                </div>

                                <h1 className="mt-2 text-[18px] md:text-[22px] font-semibold tracking-tight text-slate-900">
                                    OPD Appointment Booking
                                </h1>
                                <p className="mt-1 text-[12px] md:text-[13px] text-slate-600">
                                    Book + schedule + today list in one full-width screen.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={refreshAll}
                                    className={cx(UI.pillBtn, 'h-10')}
                                    disabled={loadingSlots || loadingAppts || loadingToday}
                                    title="Refresh"
                                >
                                    <RefreshCcw
                                        className={cx(
                                            'h-4 w-4',
                                            (loadingSlots || loadingAppts || loadingToday) && 'animate-spin'
                                        )}
                                    />
                                    Refresh
                                </button>

                                <div className="hidden sm:flex items-center gap-2">
                                    <span className={UI.chip}>
                                        <User2 className="h-3.5 w-3.5" />
                                        <span className="tabular-nums">{selectedStats.total}</span> appts
                                    </span>
                                    <span className={UI.chip}>
                                        <Clock className="h-3.5 w-3.5" />
                                        <span className="tabular-nums">{selectedStats.free}</span> free
                                    </span>
                                </div>

                                <SegmentedTabs
                                    value={view}
                                    onChange={(k) => {
                                        setView(k)
                                        setSearch('')
                                        setStatus('all')
                                    }}
                                    tabs={headerTabs}
                                />
                            </div>
                        </div>

                        {/* Row 2: TOP DoctorPicker (easy switching) */}
                        <div className="mt-1">
                            <button
                                type="button"
                                onClick={() => setTopDoctorOpen((v) => !v)}
                                className="w-full rounded-2xl border border-black/50 bg-white/70 px-4 py-3 hover:bg-black/[0.02] transition flex items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-2xl border border-black/50 bg-black/[0.04] grid place-items-center">
                                        <Stethoscope className="h-4 w-4 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                                            Doctor & Department
                                        </div>
                                        <div className="text-[12px] text-slate-500 line-clamp-1">
                                            {doctorId
                                                ? `Doctor ${doctorId} · Department ${departmentId || '—'}`
                                                : 'Pick a doctor to load schedule & today list instantly'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {doctorId && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                clearDoctor()
                                            }}
                                            className={cx(UI.pillBtn, 'h-9')}
                                            title="Clear doctor"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Clear
                                        </button>
                                    )}
                                    <div className="h-9 w-9 rounded-full border border-black/50 bg-white/85 grid place-items-center">
                                        <ChevronRight
                                            className={cx(
                                                'h-4 w-4 text-slate-600 transition',
                                                topDoctorOpen && 'rotate-90'
                                            )}
                                        />
                                    </div>
                                </div>
                            </button>

                            <AnimatePresence initial={false}>
                                {topDoctorOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.18 }}
                                        className="mt-2"
                                    >
                                        <div className="rounded-2xl border border-black/50 bg-white/70 backdrop-blur px-4 py-3 shadow-[0_10px_28px_rgba(2,6,23,0.08)]">
                                            <DoctorPicker value={doctorId} onChange={handleDoctorChange} />
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                                <span>
                                                    Switching doctor refreshes <span className="font-semibold">Schedule</span> and{' '}
                                                    <span className="font-semibold">Today</span> automatically.
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    {(loadingAppts || loadingToday || loadingSlots) && (
                                                        <>
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            Loading…
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            <div className={UI.container}>
                {/* ---- BOOK VIEW (full width, no split) ---- */}
                <AnimatePresence initial={false}>
                    {view === 'book' && (
                        <motion.div key="book" {...fadeIn} className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <Card className={UI.glassSoft}>
                                    <CardContent className="flex items-center justify-between gap-3 py-4">
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                                Selected date appointments
                                            </p>
                                            <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                                                {appointments.length}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-black/50 bg-black/[0.04] p-2.5">
                                            <User2 className="h-5 w-5 text-slate-700" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className={UI.glassSoft}>
                                    <CardContent className="flex items-center justify-between gap-3 py-4">
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                                Free slots
                                            </p>
                                            <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                                                {freeSlots.length}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-black/50 bg-black/[0.04] p-2.5">
                                            <Clock className="h-5 w-5 text-slate-700" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className={UI.glassSoft}>
                                    <CardContent className="flex items-center justify-between gap-3 py-4">
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                                Selected time
                                            </p>
                                            <p className="text-[13px] font-semibold text-slate-900 truncate">
                                                {selectedStats.chosen}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-black/50 bg-black/[0.04] p-2.5">
                                            <Activity className="h-5 w-5 text-slate-700" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className={cx(UI.glass, 'overflow-hidden')}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-[15px] md:text-[16px] font-semibold text-slate-900">
                                                Book appointment
                                            </CardTitle>
                                            <CardDescription className="text-[12px] text-slate-600">
                                                Use the top doctor selector for faster switching. This form focuses on patient + slot.
                                            </CardDescription>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="rounded-full border-black/50 bg-white/85 text-[11px] font-semibold text-slate-700"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                                            Premium flow
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    <form onSubmit={book} className="space-y-3">
                                        {/* Patient */}
                                        <CollapsibleHeader
                                            open={open.patient}
                                            onToggle={() => setOpen((s) => ({ ...s, patient: !s.patient }))}
                                            icon={<User2 className="h-4 w-4 text-slate-700" />}
                                            title="Patient"
                                            subtitle={patientId ? `Selected patient ID ${patientId}` : 'Select a patient'}
                                        />
                                        <AnimatePresence initial={false}>
                                            {open.patient && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.18 }}
                                                    className="px-1"
                                                >
                                                    <div className="rounded-2xl border border-black/50 bg-black/[0.02] p-3">
                                                        <PatientPicker value={patientId} onChange={handlePatientChange} />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Date & purpose */}
                                        <CollapsibleHeader
                                            open={open.details}
                                            onToggle={() => setOpen((s) => ({ ...s, details: !s.details }))}
                                            icon={<CalendarDays className="h-4 w-4 text-slate-700" />}
                                            title="Date & Purpose"
                                            subtitle="Confirm visit date and reason"
                                            right={
                                                <div className="hidden sm:flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className={cx(UI.pillBtn, 'h-9')}
                                                        onClick={() => setDate((d) => addDays(d, -1))}
                                                    >
                                                        <ArrowLeft className="h-4 w-4" />
                                                        Prev
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={cx(UI.pillBtn, 'h-9')}
                                                        onClick={() => setDate((d) => addDays(d, 1))}
                                                    >
                                                        Next
                                                        <ArrowRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            }
                                        />
                                        <AnimatePresence initial={false}>
                                            {open.details && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.18 }}
                                                    className="px-1"
                                                >
                                                    <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-black/50 bg-black/[0.02] p-3">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[11px] font-semibold text-slate-600">
                                                                Date
                                                            </label>
                                                            <Input
                                                                type="date"
                                                                value={date}
                                                                onChange={(e) => setDate(e.target.value)}
                                                                className="h-11 rounded-2xl border-black/50 bg-white/85"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[11px] font-semibold text-slate-600">
                                                                Purpose
                                                            </label>
                                                            <Input
                                                                value={purpose}
                                                                onChange={(e) => setPurpose(e.target.value)}
                                                                placeholder="Consultation / Review / Procedure…"
                                                                className="h-11 rounded-2xl border-black/50 bg-white/85"
                                                            />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Slots */}
                                        <CollapsibleHeader
                                            open={open.slots}
                                            onToggle={() => setOpen((s) => ({ ...s, slots: !s.slots }))}
                                            icon={<Clock className="h-4 w-4 text-slate-700" />}
                                            title="Time slot"
                                            subtitle={
                                                selectedSlot
                                                    ? `Selected ${selectedSlot}`
                                                    : doctorId
                                                        ? `${freeSlots.length} free slot(s) available`
                                                        : 'Pick doctor from top to view slots'
                                            }
                                            right={
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllSlots((v) => !v)}
                                                    className={cx(UI.pillBtn, 'h-9')}
                                                    disabled={!doctorId}
                                                    title="Toggle free/all slots"
                                                >
                                                    {showAllSlots ? (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4" />
                                                    )}
                                                    {showAllSlots ? 'All slots' : 'Free only'}
                                                </button>
                                            }
                                        />
                                        <AnimatePresence initial={false}>
                                            {open.slots && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.18 }}
                                                    className="px-1"
                                                >
                                                    <div className="rounded-2xl border border-black/50 bg-black/[0.02] p-3 space-y-3">
                                                        {!doctorId ? (
                                                            <EmptyState
                                                                title="Pick a doctor from the top selector"
                                                                subtitle="Then slots will load instantly."
                                                            />
                                                        ) : loadingSlots ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {Array.from({ length: 10 }).map((_, i) => (
                                                                    <Skeleton key={i} className="h-8 w-24 rounded-full bg-slate-100" />
                                                                ))}
                                                            </div>
                                                        ) : visibleSlots.length === 0 ? (
                                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                                                                No slots available. Try another date/doctor.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {(['Morning', 'Afternoon', 'Evening'] || []).map((bucket) => {
                                                                    const list = slotsByBucket[bucket] || []
                                                                    if (!list.length) return null
                                                                    return (
                                                                        <div key={bucket} className="space-y-2">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                                                                    {bucket}
                                                                                </div>
                                                                                <div className="text-[11px] text-slate-500">
                                                                                    <span className="font-semibold tabular-nums">
                                                                                        {list.length}
                                                                                    </span>{' '}
                                                                                    slot(s)
                                                                                </div>
                                                                            </div>

                                                                            <ScrollArea className="max-h-44 pr-1">
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {list.map((s) => {
                                                                                        const free = isFreeSlot(s)
                                                                                        const active = selectedSlot === s.start
                                                                                        const disabled = !free
                                                                                        const a = !free
                                                                                            ? apptByStart.get(normTime(s?.start))
                                                                                            : null
                                                                                        const bookedName = a?.patient_name || ''
                                                                                        const bookedUhid = a?.uhid ? `UHID ${a.uhid}` : ''

                                                                                        return (
                                                                                            <button
                                                                                                key={`${s.start}-${s.end}-${s.status || 'na'}`}
                                                                                                type="button"
                                                                                                onClick={() => !disabled && setSelectedSlot(s.start)}
                                                                                                className={cx(
                                                                                                    'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                                                                                                    active
                                                                                                        ? 'border-slate-900 bg-slate-900 text-white'
                                                                                                        : disabled
                                                                                                            ? 'border-black/50 bg-black/[0.03] text-slate-400 cursor-not-allowed'
                                                                                                            : 'border-black/50 bg-white/85 text-slate-700 hover:bg-black/[0.03]'
                                                                                                )}
                                                                                                title={
                                                                                                    !free
                                                                                                        ? bookedName
                                                                                                            ? `${bookedName}${bookedUhid ? ` · ${bookedUhid}` : ''}`
                                                                                                            : 'Booked'
                                                                                                        : 'Select slot'
                                                                                                }
                                                                                            >
                                                                                                <Clock className="h-3.5 w-3.5" />
                                                                                                {s.start}–{s.end}
                                                                                                {!free && (
                                                                                                    <span className="ml-1 hidden sm:inline rounded-full bg-white/80 border border-black/50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 max-w-[220px] truncate">
                                                                                                        {bookedName || 'Booked'}
                                                                                                    </span>
                                                                                                )}
                                                                                            </button>
                                                                                        )
                                                                                    })}
                                                                                </div>
                                                                            </ScrollArea>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <Separator className="my-1" />

                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-[11px] text-slate-500">
                                                {doctorId ? (
                                                    <>
                                                        Selected date <span className="font-semibold">{date}</span> · free slots{' '}
                                                        <span className="font-semibold tabular-nums">{freeSlots.length}</span>
                                                    </>
                                                ) : (
                                                    'Pick doctor (top) to load slots & schedule.'
                                                )}
                                            </div>
                                            <Button
                                                type="submit"
                                                className="h-11 rounded-2xl bg-slate-900 px-5 text-[12px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                                disabled={!canBookNow}
                                            >
                                                Book appointment
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---- SCHEDULE VIEWS (Selected date + Today) ---- */}
                <AnimatePresence initial={false}>
                    {(view === 'day' || view === 'today') && (
                        <motion.div key={view} {...fadeIn} className="space-y-4">
                            <Card className={UI.glass}>
                                <CardContent className="py-4 space-y-3">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={UI.chip}>
                                                    <CalendarDays className="h-3.5 w-3.5" />
                                                    {activeDate}
                                                </span>
                                                <span className={UI.chip}>
                                                    <User2 className="h-3.5 w-3.5" />
                                                    <span className="tabular-nums">{activeList.length}</span> appointments
                                                </span>
                                                {view === 'today' && (
                                                    <span className={UI.chip}>
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                        Today view
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[13px] font-semibold text-slate-900">
                                                {view === 'today'
                                                    ? 'Today appointments (selected doctor)'
                                                    : 'Selected date appointments (selected doctor)'}
                                            </div>
                                            <div className="text-[12px] text-slate-500">
                                                Switch doctor from top bar anytime.
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                            {view === 'day' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className={cx(UI.pillBtn, 'h-10')}
                                                        onClick={() => setDate((d) => addDays(d, -1))}
                                                        disabled={!doctorId}
                                                    >
                                                        <ArrowLeft className="h-4 w-4" />
                                                        Prev day
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={cx(UI.pillBtn, 'h-10')}
                                                        onClick={() => setDate((d) => addDays(d, 1))}
                                                        disabled={!doctorId}
                                                    >
                                                        Next day
                                                        <ArrowRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                className={cx(UI.pillBtn, 'h-10')}
                                                onClick={view === 'today' ? loadToday : loadSelected}
                                                disabled={!doctorId || activeLoading}
                                            >
                                                <RefreshCcw className={cx('h-4 w-4', activeLoading && 'animate-spin')} />
                                                Refresh
                                            </button>

                                            <button
                                                type="button"
                                                className={cx(UI.pillBtn, 'h-10')}
                                                onClick={() => setView('book')}
                                            >
                                                Back to booking
                                            </button>
                                        </div>
                                    </div>

                                    {!doctorId && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                                            Pick a doctor from the top selector to load appointments.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Filters */}
                            <div className="space-y-2">
                                <CollapsibleHeader
                                    open={open.filters}
                                    onToggle={() => setOpen((s) => ({ ...s, filters: !s.filters }))}
                                    icon={<Search className="h-4 w-4 text-slate-700" />}
                                    title="Filters"
                                    subtitle="Search and filter by status"
                                    right={
                                        (activeLoading || loadingSlots || loadingAppts || loadingToday) && (
                                            <span className={UI.chip}>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Syncing
                                            </span>
                                        )
                                    }
                                />
                                <AnimatePresence initial={false}>
                                    {open.filters && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className="px-1"
                                        >
                                            <div className={cx(UI.glassSoft, 'p-3')}>
                                                <div className="grid gap-2 lg:grid-cols-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                        <input
                                                            value={search}
                                                            onChange={(e) => setSearch(e.target.value)}
                                                            className={cx(UI.input, 'pl-10')}
                                                            placeholder="Search patient / UHID / time / status…"
                                                            disabled={!doctorId}
                                                        />
                                                    </div>

                                                    <select
                                                        className={cx(UI.input, 'h-10')}
                                                        value={status}
                                                        onChange={(e) => setStatus(e.target.value)}
                                                        disabled={!doctorId}
                                                    >
                                                        <option value="all">All ({statusCounts.all})</option>
                                                        <option value="booked">Booked ({statusCounts.booked})</option>
                                                        <option value="checked_in">Checked-in ({statusCounts.checked_in})</option>
                                                        <option value="in_progress">In progress ({statusCounts.in_progress})</option>
                                                        <option value="completed">Completed ({statusCounts.completed})</option>
                                                        <option value="cancelled">Cancelled ({statusCounts.cancelled})</option>
                                                        <option value="no_show">No show ({statusCounts.no_show})</option>
                                                    </select>
                                                </div>

                                                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                                                    <span>
                                                        Showing{' '}
                                                        <span className="font-semibold tabular-nums">{filteredList.length}</span> of{' '}
                                                        <span className="font-semibold tabular-nums">{activeList.length}</span>
                                                    </span>
                                                    <span className="hidden sm:inline">Tip: search “09:30” or “completed”</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* List */}
                            {!doctorId ? (
                                <EmptyState title="Pick a doctor" subtitle="Appointments will appear here." />
                            ) : activeLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full rounded-3xl bg-slate-100" />
                                    ))}
                                </div>
                            ) : filteredList.length === 0 ? (
                                <EmptyState title="No appointments match" subtitle="Change filters or search." />
                            ) : (
                                <ScrollArea className="max-h-[64vh] pr-1">
                                    <div className="space-y-2">
                                        <AnimatePresence initial={false}>
                                            {filteredList.map((a) => {
                                                const st = String(a?.status || 'booked')
                                                const pill =
                                                    st === 'completed'
                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                        : st === 'in_progress'
                                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                            : st === 'checked_in'
                                                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                                                : st === 'cancelled' || st === 'no_show'
                                                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                                    : 'bg-black/[0.03] text-slate-700 border-black/50'

                                                return (
                                                    <motion.div
                                                        key={a.id}
                                                        initial={{ opacity: 0, y: 6 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -6 }}
                                                        transition={{ duration: 0.16 }}
                                                        className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_8px_24px_rgba(2,6,23,0.08)]"
                                                    >
                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className={UI.chip}>
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        {normTime(a.slot_start)}–{normTime(a.slot_end)}
                                                                    </span>

                                                                    <span className="text-[13px] font-semibold text-slate-900 truncate">
                                                                        {a.patient_name}
                                                                    </span>

                                                                    <span className="text-[11px] text-slate-500 truncate">
                                                                        (UHID {a.uhid})
                                                                    </span>
                                                                </div>

                                                                <div className="mt-1 text-[12px] text-slate-600 line-clamp-1">
                                                                    {a.department_name} · {a.doctor_name}
                                                                </div>

                                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                    <span
                                                                        className={cx(
                                                                            'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold',
                                                                            pill
                                                                        )}
                                                                    >
                                                                        {st.replace('_', ' ')}
                                                                    </span>

                                                                    {a.vitals_registered ? (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                                                                            <Activity className="h-3.5 w-3.5" />
                                                                            Vitals done
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.03] px-3 py-1 text-[11px] font-semibold text-slate-700 border border-black/50">
                                                                            <Activity className="h-3.5 w-3.5" />
                                                                            No vitals
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="sm:text-right text-[11px] text-slate-500">
                                                                <div className="rounded-2xl border border-black/50 bg-black/[0.02] px-3 py-2">
                                                                    <div className="font-semibold text-slate-700">Purpose</div>
                                                                    <div className="mt-0.5 text-slate-600">{a.purpose || '—'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </AnimatePresence>
                                    </div>
                                </ScrollArea>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
