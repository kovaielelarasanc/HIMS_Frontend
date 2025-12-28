// FILE: frontend/src/opd/Queue.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { fetchQueue, updateAppointmentStatus } from '../api/opd'
import DoctorPicker from './components/DoctorPicker'
import { useAuth } from '../store/authStore'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
    ArrowUpDown,
    Timer,
    ClipboardList,
    Sparkles,
    Zap,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    MoreHorizontal,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanAny } from '../hooks/useCan'


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

const SORTS = [
    { key: 'clinical', label: 'Clinical' },
    { key: 'queue', label: 'Queue#' },
    { key: 'time', label: 'Time' },
    { key: 'waiting', label: 'Waiting' },
]

const PAGE_SIZES = [
    { key: 20, label: '20' },
    { key: 30, label: '30' },
    { key: 40, label: '40' },
    { key: 'all', label: 'All' },
]

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

function isTodayStr(d) {
    return d === new Date().toISOString().slice(0, 10)
}

function waitingMinutes(row, forDate) {
    if (!row?.time) return null
    if (!['booked', 'checked_in', 'in_progress'].includes(row.status)) return null
    if (!isTodayStr(forDate)) return null
    try {
        const now = new Date()
        const slotDt = new Date(`${forDate}T${row.time}:00`)
        const diffMs = now.getTime() - slotDt.getTime()
        return Math.max(0, Math.floor(diffMs / (1000 * 60)))
    } catch {
        return null
    }
}

function computeWaitingLabel(row, forDate) {
    const m = waitingMinutes(row, forDate)
    if (m === null) return null
    if (m <= 0) return '0 min'
    if (m < 60) return `${m} min`
    const hrs = Math.floor(m / 60)
    const mins = m % 60
    if (hrs >= 5) return `${hrs} hrs+`
    if (mins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`
    return `${hrs}h ${mins}m`
}

function statusPill(status) {
    const base = 'rounded-full border px-2.5 py-1 text-[11px] font-semibold'
    switch (status) {
        case 'booked':
            return cx(base, 'border-slate-500 bg-slate-50 text-slate-700')
        case 'checked_in':
            return cx(base, 'border-sky-200 bg-sky-50 text-sky-800')
        case 'in_progress':
            return cx(base, 'border-amber-200 bg-amber-50 text-amber-800')
        case 'completed':
            return cx(base, 'border-emerald-200 bg-emerald-50 text-emerald-800')
        case 'no_show':
            return cx(base, 'border-rose-200 bg-rose-50 text-rose-800')
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

function MiniSeg({ value, onChange, options }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {options.map((opt) => {
                const active = value === opt.key
                return (
                    <button
                        key={String(opt.key)}
                        type="button"
                        onClick={() => onChange(opt.key)}
                        className={cx(
                            'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                            active
                                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                : 'border-black/50 bg-white/80 text-slate-700 hover:bg-black/[0.03]',
                        )}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

function FilterChip({ active, onClick, icon: Icon, children, tone = 'slate', title }) {
    const cls =
        tone === 'emerald'
            ? active
                ? 'border-emerald-700 bg-emerald-600 text-white'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : tone === 'amber'
                ? active
                    ? 'border-amber-700 bg-amber-600 text-white'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                : tone === 'rose'
                    ? active
                        ? 'border-rose-700 bg-rose-600 text-white'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    : active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-black/50 bg-white/85 text-slate-700'

    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition', cls)}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {children}
        </button>
    )
}

function PaginationBar({ page, pageCount, onPage }) {
    if (!pageCount || pageCount <= 1) return null

    const makePages = () => {
        const out = []
        const push = (x) => out.push(x)

        const clamp = (n) => Math.max(1, Math.min(pageCount, n))
        const cur = clamp(page)

        // show: 1 ... (cur-1) cur (cur+1) ... last
        const window = 1
        const left = clamp(cur - window)
        const right = clamp(cur + window)

        push(1)
        if (left > 2) push('dotsL')
        for (let p = left; p <= right; p++) {
            if (p !== 1 && p !== pageCount) push(p)
        }
        if (right < pageCount - 1) push('dotsR')
        if (pageCount !== 1) push(pageCount)

        // remove duplicates
        const uniq = []
        const seen = new Set()
        for (const x of out) {
            const k = String(x)
            if (!seen.has(k)) {
                seen.add(k)
                uniq.push(x)
            }
        }
        return uniq
    }

    const items = makePages()

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
                size="sm"
                variant="outline"
                className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                onClick={() => onPage(1)}
                disabled={page <= 1}
                title="First"
            >
                <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
                size="sm"
                variant="outline"
                className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
                title="Previous"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex flex-wrap items-center gap-1">
                {items.map((it) => {
                    if (it === 'dotsL' || it === 'dotsR') {
                        return (
                            <span
                                key={String(it)}
                                className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/30 bg-white/60 px-3 text-[12px] text-slate-500"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </span>
                        )
                    }

                    const active = it === page
                    return (
                        <button
                            key={String(it)}
                            type="button"
                            onClick={() => onPage(it)}
                            className={cx(
                                'h-10 min-w-[42px] rounded-2xl border px-3 text-[12px] font-semibold transition',
                                active
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-black/50 bg-white/85 text-slate-700 hover:bg-black/[0.03]',
                            )}
                            title={`Page ${it}`}
                        >
                            {it}
                        </button>
                    )
                })}
            </div>

            <Button
                size="sm"
                variant="outline"
                className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                onClick={() => onPage(page + 1)}
                disabled={page >= pageCount}
                title="Next"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
                size="sm"
                variant="outline"
                className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                onClick={() => onPage(pageCount)}
                disabled={page >= pageCount}
                title="Last"
            >
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

export default function Queue() {
    const { user } = useAuth() || {}
    const canViewQueue = useCanAny(['appointments.view', 'visits.view', 'vitals.create']) || Boolean(user?.is_doctor)

    const navigate = useNavigate()

    const [doctorId, setDoctorId] = useState(null)
    const [doctorMeta, setDoctorMeta] = useState(null)

    const [date, setDate] = useState(todayStr())
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [statusFilter, setStatusFilter] = useState('active')
    const [searchTerm, setSearchTerm] = useState('')

    // ✅ Doctor-first behavior
    const [myOnly, setMyOnly] = useState(false)
    const prevDoctorRef = useRef({ id: null, meta: null })

    // ✅ Doctor-friendly filters
    const [vitalsFilter, setVitalsFilter] = useState('all') // all | needed | done
    const [visitFilter, setVisitFilter] = useState('all') // all | no_visit | has_visit
    const [waiting30Plus, setWaiting30Plus] = useState(false)
    const [sortMode, setSortMode] = useState('clinical') // clinical | queue | time | waiting
    const [autoRefresh, setAutoRefresh] = useState(true)

    // ✅ Pagination
    const [pageSize, setPageSize] = useState(20) // 20 | 30 | 40 | 'all'
    const [page, setPage] = useState(1)

    const effectiveDoctorId = myOnly ? user?.id : doctorId
    const hasSelection = Boolean(date) && (myOnly ? Boolean(user?.id) : Boolean(doctorId))

    // auto-enable My appointments for doctors
    useEffect(() => {
        if (!user?.id) return
        const isDoctor = Boolean(user?.is_doctor)
        if (!isDoctor) return
        if (myOnly) return
        if (doctorId) return
        setMyOnly(true)
        setDoctorId(user.id)
        setDoctorMeta({ name: user?.name || user?.full_name || 'My queue' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])

    // inside Queue component, before load() definition OR inside load()
    // inside Queue component, replace your load() with this
    const load = useCallback(async () => {
        if (!canViewQueue) {
            setRows([])
            return
        }

        if (!date || !hasSelection) {
            setRows([])
            return
        }

        try {
            setLoading(true)

            // base params
            const params = { for_date: date }

            if (myOnly) params.my_only = true
            else params.doctor_user_id = Number(effectiveDoctorId)

            // ✅ ONLY doctors send department_id, others send null (i.e., don't send)
            if (user?.is_doctor && user?.department_id) {
                params.department_id = Number(user.department_id)
            } else {
                // will be removed by toParams() in fetchQueue()
                params.department_id = null
            }

            // 1) first call
            const res1 = await fetchQueue(params)
            let list = Array.isArray(res1?.data) ? res1.data : []

            // ✅ OPTIONAL SAFETY: if doctor dept filter caused empty, retry without department_id
            if (list.length === 0 && user?.is_doctor && user?.department_id) {
                const { department_id, ...rest } = params
                const res2 = await fetchQueue(rest)
                list = Array.isArray(res2?.data) ? res2.data : []
            }

            setRows(list)
        } catch (e) {
            console.error(e)
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [canViewQueue, date, hasSelection, myOnly, effectiveDoctorId, user])


    useEffect(() => {
        load()
    }, [load])

    useEffect(() => {
        if (!autoRefresh) return
        if (!hasSelection) return
        const t = setInterval(() => {
            load()
        }, 30000)
        return () => clearInterval(t)
    }, [autoRefresh, hasSelection, load])

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
                prevDoctorRef.current = { id: doctorId, meta: doctorMeta }
                setDoctorId(user.id)
                setDoctorMeta({ name: user?.name || user?.full_name || 'My queue' })
                toast.success('Showing my appointments only')
            } else {
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
            vitals_done: 0,
            vitals_need: 0,
            visit_yes: 0,
            visit_no: 0,
        }
        for (const r of rows) {
            if (base[r.status] !== undefined) base[r.status] += 1
            if (r?.has_vitals) base.vitals_done += 1
            else base.vitals_need += 1
            if (r?.visit_id) base.visit_yes += 1
            else base.visit_no += 1
        }
        return base
    }, [rows])

    const activeCount = stats.booked + stats.checked_in + stats.in_progress

    const filteredByStatus = useMemo(() => {
        if (statusFilter === 'all') return rows
        if (statusFilter === 'active') return rows.filter((r) => ['booked', 'checked_in', 'in_progress'].includes(r.status))
        return rows.filter((r) => r.status === statusFilter)
    }, [rows, statusFilter])

    const filteredRows = useMemo(() => {
        let list = filteredByStatus

        if (vitalsFilter === 'needed') list = list.filter((r) => !r.has_vitals)
        if (vitalsFilter === 'done') list = list.filter((r) => !!r.has_vitals)

        if (visitFilter === 'no_visit') list = list.filter((r) => !r.visit_id)
        if (visitFilter === 'has_visit') list = list.filter((r) => !!r.visit_id)

        if (waiting30Plus) {
            list = list.filter((r) => {
                const m = waitingMinutes(r, date)
                return m !== null && m >= 30
            })
        }

        const q = searchTerm.trim().toLowerCase()
        if (q) {
            list = list.filter((r) => {
                const name = (r.patient?.name || '').toLowerCase()
                const uhid = String(r.patient?.uhid || '').toLowerCase()
                const phone = String(r.patient?.phone || '').toLowerCase()
                const purpose = String(r.visit_purpose || '').toLowerCase()
                const qno = String(r.queue_no ?? '').toLowerCase()
                return name.includes(q) || uhid.includes(q) || phone.includes(q) || purpose.includes(q) || qno.includes(q)
            })
        }

        return list
    }, [filteredByStatus, vitalsFilter, visitFilter, waiting30Plus, searchTerm, date])

    const sortedRows = useMemo(() => {
        const score = (s) => (s === 'in_progress' ? 0 : s === 'checked_in' ? 1 : s === 'booked' ? 2 : 9)
        const parseTime = (t) => {
            if (!t || t === 'Free') return 9999
            const [hh, mm] = String(t).split(':').map((x) => Number(x))
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 9999
            return hh * 60 + mm
        }
        const qno = (x) => (Number.isFinite(Number(x)) ? Number(x) : 999999)

        const arr = [...filteredRows]

        arr.sort((a, b) => {
            if (sortMode === 'queue') {
                const dq = qno(a.queue_no) - qno(b.queue_no)
                if (dq !== 0) return dq
                return parseTime(a.time) - parseTime(b.time)
            }

            if (sortMode === 'time') {
                const dt = parseTime(a.time) - parseTime(b.time)
                if (dt !== 0) return dt
                return score(a.status) - score(b.status)
            }

            if (sortMode === 'waiting') {
                const wa = waitingMinutes(a, date) ?? -1
                const wb = waitingMinutes(b, date) ?? -1
                const dw = wb - wa
                if (dw !== 0) return dw
                const ds = score(a.status) - score(b.status)
                if (ds !== 0) return ds
                return qno(a.queue_no) - qno(b.queue_no)
            }

            const ds = score(a.status) - score(b.status)
            if (ds !== 0) return ds
            const wa = waitingMinutes(a, date) ?? -1
            const wb = waitingMinutes(b, date) ?? -1
            const dw = wb - wa
            if (dw !== 0) return dw
            const dq = qno(a.queue_no) - qno(b.queue_no)
            if (dq !== 0) return dq
            return parseTime(a.time) - parseTime(b.time)
        })

        return arr
    }, [filteredRows, sortMode, date])

    // ✅ Reset to page 1 when filters change
    useEffect(() => {
        setPage(1)
    }, [date, effectiveDoctorId, myOnly, statusFilter, vitalsFilter, visitFilter, waiting30Plus, sortMode, searchTerm, pageSize])

    // ✅ Client-side pagination
    const { pageRows, pageCount, pageInfo } = useMemo(() => {
        const total = sortedRows.length
        if (pageSize === 'all') {
            return {
                pageRows: sortedRows,
                pageCount: 1,
                pageInfo: { total, from: total ? 1 : 0, to: total },
            }
        }
        const size = Number(pageSize) || 20
        const count = Math.max(1, Math.ceil(total / size))
        const p = Math.max(1, Math.min(page, count))
        const start = (p - 1) * size
        const end = Math.min(total, start + size)
        return {
            pageRows: sortedRows.slice(start, end),
            pageCount: count,
            pageInfo: { total, from: total ? start + 1 : 0, to: end },
        }
    }, [sortedRows, pageSize, page])

    // clamp page if total shrinks
    useEffect(() => {
        if (pageCount <= 1) return
        if (page > pageCount) setPage(pageCount)
    }, [pageCount, page])

    const openTriageFor = (row) => {
        navigate('/opd/triage', {
            state: {
                doctorId: effectiveDoctorId,
                date,
                appointmentId: row?.appointment_id,
            },
        })
    }

    const nextCandidate = useMemo(() => {
        const a = sortedRows.find((r) => r.status === 'checked_in')
        if (a) return a
        const b = sortedRows.find((r) => r.status === 'booked')
        if (b) return b
        return null
    }, [sortedRows])

    const startNext = async () => {
        const row = nextCandidate
        if (!row) return toast.message('No next patient found')
        if (!row.has_vitals) {
            toast.message('Vitals needed before starting visit')
            return openTriageFor(row)
        }
        if (row.status === 'booked') {
            toast.message('Please check-in first')
            return
        }
        await changeStatus(row, 'in_progress', { goToVisit: true })
    }

    if (!canViewQueue) {
        return (
            <div className={UI.page}>
                <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
                    <div className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur p-6 shadow-[0_12px_35px_rgba(2,6,23,0.10)]">
                        <div className="flex items-start gap-3">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/50 bg-black/[0.04]">
                                <Lock className="h-5 w-5 text-slate-700" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-lg font-semibold text-slate-900">Access denied</div>
                                <p className="mt-1 text-sm text-slate-600">
                                    You don’t have permission to view the OPD Queue.
                                </p>
                                <div className="mt-3 text-[12px] text-slate-500">
                                    Required: <span className="font-semibold text-slate-700">appointments.view</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }


    return (
        <div className={UI.page}>
            <div className="mx-auto max-w-12xl px-4 py-6 space-y-4 md:px-8">
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
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                        <Stethoscope className="h-5 w-5 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                            Queue Management
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Doctor workflow: find next → check vitals → start visit → complete.
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
                                                    {myOnly ? <span className="ml-1 opacity-70">(Me)</span> : null}
                                                </span>
                                            )}

                                            <span className={UI.chip}>
                                                <Activity className="h-3.5 w-3.5" />
                                                Active <span className="ml-1 tabular-nums">{activeCount}</span>
                                            </span>

                                            <button
                                                type="button"
                                                onClick={toggleMyOnly}
                                                className={cx(UI.chipBtn, myOnly && 'bg-slate-900')}
                                                title="Show only My appointments"
                                                disabled={!user?.id}
                                            >
                                                {myOnly ? <Lock className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                                                My appointments
                                            </button>

                                            <FilterChip
                                                active={autoRefresh}
                                                onClick={() => setAutoRefresh((v) => !v)}
                                                icon={Sparkles}
                                                title="Auto refresh every 30 seconds"
                                                tone="emerald"
                                            >
                                                Auto refresh
                                            </FilterChip>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
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

                                <Button
                                    type="button"
                                    className="h-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4"
                                    onClick={startNext}
                                    disabled={loading || !hasSelection || !nextCandidate}
                                    title="Start next patient (opens triage if vitals missing)"
                                >
                                    {nextCandidate?.has_vitals ? (
                                        <Zap className="mr-2 h-4 w-4" />
                                    ) : (
                                        <HeartPulse className="mr-2 h-4 w-4" />
                                    )}
                                    Start next
                                </Button>

                                <span className={UI.chip}>
                                    Total <span className="ml-1 tabular-nums">{stats.total}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Total appointments" value={stats.total} icon={Users} tone="dark" />
                            <StatCard label="Active" value={activeCount} icon={Activity} tone="emerald" />
                            <StatCard label="Vitals needed" value={stats.vitals_need} icon={HeartPulse} tone="rose" />
                            <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="sky" />
                        </div>
                    </div>
                </motion.div>

                {/* CONTROLS + LIST */}
                <Card className={cx(UI.glass, 'overflow-hidden flex flex-col')}>
                    <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="grid w-full gap-3 md:grid-cols-[2fr,1.1fr]">
                                    <div>
                                        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">Queue</CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Doctor filters: Vitals / Visit / Waiting / Sort. Search by UHID, phone, purpose, queue#.
                                        </CardDescription>

                                        <div
                                            className={cx(
                                                'mt-3 rounded-2xl border border-black/50 bg-white/85 px-3 py-2',
                                                myOnly && 'opacity-70 pointer-events-none',
                                            )}
                                            title={myOnly ? 'My appointments is ON (doctor locked)' : 'Select doctor'}
                                        >
                                            <DoctorPicker value={doctorId} onChange={handleDoctorChange} autoSelectCurrentDoctor />
                                        </div>

                                        {myOnly && (
                                            <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                                <Lock className="h-3.5 w-3.5" />
                                                my_only = true
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
                                            className="h-11 rounded-2xl border-black/50 bg-white/85 text-[12px] font-semibold"
                                        />

                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search name / UHID / phone / purpose / queue#…"
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
                                            setStatusFilter('active')
                                            setVitalsFilter('all')
                                            setVisitFilter('all')
                                            setWaiting30Plus(false)
                                            setSortMode('clinical')
                                            setPageSize(20)
                                            setPage(1)
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

                            {/* Doctor-friendly quick filters */}
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4" />
                                        Quick filters
                                    </div>

                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                    >
                                        Showing <span className="ml-1 tabular-nums">{sortedRows.length}</span>
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <MiniSeg
                                        value={vitalsFilter}
                                        onChange={setVitalsFilter}
                                        options={[
                                            { key: 'all', label: `Vitals: All (${stats.total})` },
                                            { key: 'needed', label: `Needs (${stats.vitals_need})` },
                                            { key: 'done', label: `Done (${stats.vitals_done})` },
                                        ]}
                                    />

                                    <span className="mx-1 hidden md:inline text-slate-300">•</span>

                                    <MiniSeg
                                        value={visitFilter}
                                        onChange={setVisitFilter}
                                        options={[
                                            { key: 'all', label: `Visit: All (${stats.total})` },
                                            { key: 'no_visit', label: `No visit (${stats.visit_no})` },
                                            { key: 'has_visit', label: `Has visit (${stats.visit_yes})` },
                                        ]}
                                    />

                                    <FilterChip
                                        active={waiting30Plus}
                                        onClick={() => setWaiting30Plus((v) => !v)}
                                        icon={Timer}
                                        tone="amber"
                                        title="Only patients waiting 30+ minutes (today)"
                                    >
                                        Waiting 30+
                                    </FilterChip>

                                    <div className="ml-auto flex flex-wrap items-center gap-2">
                                        <span className={UI.chip}>
                                            <ArrowUpDown className="h-3.5 w-3.5" />
                                            Sort
                                        </span>
                                        <MiniSeg value={sortMode} onChange={setSortMode} options={SORTS} />
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-black/10" />

                            {/* ✅ Rows per page + Pagination (top) */}
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={UI.chip}>Rows</span>
                                    <MiniSeg value={pageSize} onChange={setPageSize} options={PAGE_SIZES} />

                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                        title="Current visible range"
                                    >
                                        {pageInfo.from}-{pageInfo.to} of <span className="ml-1 tabular-nums">{pageInfo.total}</span>
                                    </Badge>
                                </div>

                                <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
                            </div>

                            <Separator className="bg-black/10" />

                            <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</div>
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                    Mode <span className="ml-1 tabular-nums">{myOnly ? 'My' : 'Doctor'}</span>
                                </Badge>
                            </div>

                            <Segmented value={statusFilter} onChange={setStatusFilter} />
                        </div>
                    </CardHeader>

                    {/* ✅ IMPORTANT: flex-1 + min-h-0 fixes ScrollArea on all devices */}
                    <CardContent className="pt-4 flex-1 min-h-0">
                        {!hasSelection && (
                            <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/50 bg-white/60">
                                    <Stethoscope className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">Select doctor & date to view queue</div>
                                <p className="mt-1 text-[12px] text-slate-500">Or enable My appointments.</p>
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
                                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/50 bg-white/60">
                                    <Clock className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">No appointments found</div>
                                <p className="mt-1 text-[12px] text-slate-500">
                                    Try switching filters, clearing search, or choose a different date.
                                </p>
                            </div>
                        )}

                        {hasSelection && !loading && sortedRows.length > 0 && (
                            <>
                                {/* ✅ FIX: ScrollArea must have fixed HEIGHT (h-...), not max-h */}
                                <ScrollArea className="h-[66vh] md:h-[68vh] lg:h-[70vh] pr-1">
                                    <div className="space-y-2">
                                        <AnimatePresence initial={false}>
                                            {pageRows.map((row) => {
                                                const waiting = computeWaitingLabel(row, date)
                                                const initials =
                                                    (row.patient?.name || 'P')
                                                        .split(' ')
                                                        .filter(Boolean)
                                                        .slice(0, 2)
                                                        .map((s) => s[0]?.toUpperCase())
                                                        .join('') || 'P'

                                                const queueNo = row?.queue_no ?? null

                                                return (
                                                    <motion.div
                                                        key={row.appointment_id}
                                                        initial={{ opacity: 0, y: 6 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -6 }}
                                                        transition={{ duration: 0.14 }}
                                                        className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]"
                                                    >
                                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                            {/* LEFT */}
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums">
                                                                        {row.time || '-'}
                                                                    </span>

                                                                    {queueNo !== null && queueNo !== undefined ? (
                                                                        <span className="inline-flex items-center gap-1 rounded-full border border-black/50 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                                            <span className="opacity-70">Queue</span>
                                                                            <span className="tabular-nums">{queueNo}</span>
                                                                        </span>
                                                                    ) : null}

                                                                    <span className={statusPill(row.status)}>
                                                                        {statusLabel[row.status] || row.status}
                                                                    </span>

                                                                    {waiting && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full border border-black/50 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                                                                            Waiting <span className="tabular-nums">{waiting}</span>
                                                                        </span>
                                                                    )}

                                                                    <span className="inline-flex items-center gap-1 rounded-full border border-black/50 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                                        <HeartPulse className="h-3.5 w-3.5 text-slate-500" />
                                                                        Vitals <span className="font-semibold">{row.has_vitals ? 'Yes' : 'No'}</span>
                                                                    </span>

                                                                    {row.visit_id ? (
                                                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                                            Visit ready
                                                                        </span>
                                                                    ) : null}
                                                                </div>

                                                                <div className="mt-2 flex items-start gap-3 min-w-0">
                                                                    <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl border border-black/50 bg-black/[0.03] text-[12px] font-semibold text-slate-800">
                                                                        {initials}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <div className="truncate text-[14px] font-semibold text-slate-900">
                                                                                {row.patient?.name || '—'}
                                                                            </div>
                                                                            <div className="text-[11px] text-slate-500">
                                                                                UHID{' '}
                                                                                <span className="font-semibold text-slate-700">{row.patient?.uhid || '—'}</span>
                                                                                {' · '}
                                                                                <span className="font-semibold text-slate-700">{row.patient?.phone || '—'}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                                            <span>
                                                                                Purpose{' '}
                                                                                <span className="font-semibold text-slate-700">{row.visit_purpose || 'Consultation'}</span>
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* RIGHT ACTIONS */}
                                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                                                    onClick={() => openTriageFor(row)}
                                                                    title="Open Triage for this appointment"
                                                                >
                                                                    <HeartPulse className="mr-2 h-4 w-4" />
                                                                    Vitals
                                                                </Button>

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
                                                                            className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
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
                                                                        onClick={() => {
                                                                            if (!row.has_vitals) return openTriageFor(row)
                                                                            changeStatus(row, 'in_progress', { goToVisit: true })
                                                                        }}
                                                                        title={row.has_vitals ? 'Start visit' : 'Vitals needed first'}
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
                                                                        className="h-10 rounded-2xl border-black/50 bg-white/85 font-semibold"
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

                                {/* ✅ Bottom Pagination (always visible) */}
                                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-black/50 bg-white/85 px-3 py-2 text-[11px] font-semibold text-slate-700"
                                    >
                                        Showing {pageInfo.from}-{pageInfo.to} of <span className="ml-1 tabular-nums">{pageInfo.total}</span>
                                    </Badge>

                                    <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
