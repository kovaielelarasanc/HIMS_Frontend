// FILE: src/ipd/TrackingAdmissions.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { listAdmissions, listBeds, getPatient } from '../api/ipd'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

import {
    Activity,
    AlertCircle,
    BedDouble,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Loader2,
    RefreshCcw,
    Search,
    User,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const PAGE_SIZE = 10

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
        'inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03] active:scale-[0.99] transition disabled:opacity-60',
    input:
        'h-11 w-full rounded-2xl border border-black/10 bg-white/85 px-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500',
}

function prettyDateTime(v) {
    if (!v) return '—'
    try {
        return new Date(v).toLocaleString('en-IN')
    } catch {
        return String(v)
    }
}

function prettyTime(d) {
    if (!d) return ''
    try {
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
        return ''
    }
}

const code = (id) => `ADM-${String(id).padStart(6, '0')}`

function bedStateBadgeClass(state) {
    if (!state) return 'border-slate-200 bg-slate-50 text-slate-700'
    if (state === 'vacant') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    if (state === 'occupied') return 'border-rose-200 bg-rose-50 text-rose-800'
    if (state === 'reserved') return 'border-amber-200 bg-amber-50 text-amber-900'
    if (state === 'preoccupied') return 'border-sky-200 bg-sky-50 text-sky-900'
    return 'border-slate-200 bg-slate-50 text-slate-700'
}

function StatCard({ label, value, icon: Icon, tone = 'slate' }) {
    const toneCls =
        tone === 'dark'
            ? 'bg-slate-900 text-white border-slate-900'
            : tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : tone === 'amber'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : tone === 'rose'
                        ? 'bg-rose-50 text-rose-900 border-rose-200'
                        : tone === 'sky'
                            ? 'bg-sky-50 text-sky-900 border-sky-200'
                            : 'bg-white/80 text-slate-900 border-black/10'

    return (
        <div className={cx('rounded-3xl border px-4 py-3', toneCls)}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
                    <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">{value}</div>
                </div>
                {Icon ? (
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white/30">
                        <Icon className="h-5 w-5 opacity-80" />
                    </div>
                ) : null}
            </div>
        </div>
    )
}

const BED_STATE_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'occupied', label: 'Occupied' },
    { key: 'reserved', label: 'Reserved' },
    { key: 'vacant', label: 'Vacant' },
    { key: 'preoccupied', label: 'Pre-occupied' },
]

function Segmented({ value, onChange }) {
    return (
        <div className="flex items-center gap-1.5 overflow-auto no-scrollbar py-1">
            {BED_STATE_FILTERS.map((opt) => {
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

export default function TrackingAdmissions() {
    const [rows, setRows] = useState([])
    const [bedsById, setBedsById] = useState({})
    const [pmap, setPmap] = useState({}) // patient_id -> UHID label

    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState('')

    const [search, setSearch] = useState('')
    const [bedStateFilter, setBedStateFilter] = useState('all')

    const [page, setPage] = useState(1)
    const [lastSyncAt, setLastSyncAt] = useState(null)
    const [autoRefresh, setAutoRefresh] = useState(false)

    const aliveRef = useRef(true)

    const buildBedsMap = (beds) => {
        const m = {}
        for (const b of beds || []) m[b.id] = b
        return m
    }

    // ---- Load admissions + beds (real-time refresh) ----
    const loadData = useCallback(
        async ({ silent = false } = {}) => {
            silent ? setSyncing(true) : setLoading(true)
            setError('')
            try {
                const [a, b] = await Promise.all([listAdmissions({ status: 'admitted' }), listBeds()])

                let admissions = a.data || []
                const beds = b.data || []

                // latest on top
                admissions = [...admissions].sort(
                    (x, y) => new Date(y.admitted_at || 0) - new Date(x.admitted_at || 0),
                )

                if (!aliveRef.current) return
                setRows(admissions)
                setBedsById(buildBedsMap(beds))
                setLastSyncAt(new Date())
                setPage(1)
            } catch (e) {
                console.error('TrackingAdmissions loadData error', e)
                if (!aliveRef.current) return
                setError(e?.response?.data?.detail || 'Failed to load active admissions. Please try again.')
                setRows([])
                setBedsById({})
            } finally {
                if (!aliveRef.current) return
                setLoading(false)
                setSyncing(false)
            }
        },
        [],
    )

    useEffect(() => {
        aliveRef.current = true
        loadData()
        return () => {
            aliveRef.current = false
        }
    }, [loadData])

    // ---- Auto refresh ----
    useEffect(() => {
        if (!autoRefresh) return
        const t = setInterval(() => loadData({ silent: true }), 15000)
        return () => clearInterval(t)
    }, [autoRefresh, loadData])

    // ---- Filter + paginate ----
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase()

        let list = rows

        // bed-state filter (based on current_bed_id -> bed.state)
        if (bedStateFilter !== 'all') {
            list = list.filter((r) => {
                const bed = bedsById[r.current_bed_id]
                return (bed?.state || '') === bedStateFilter
            })
        }

        if (!q) return list

        return list.filter((r) => {
            const admCode = code(r.id).toLowerCase()
            const patientLabel = (pmap[r.patient_id] || `P-${r.patient_id}`).toLowerCase()
            const bedCode = (bedsById[r.current_bed_id]?.code || '').toLowerCase()
            return admCode.includes(q) || patientLabel.includes(q) || bedCode.includes(q)
        })
    }, [rows, search, pmap, bedsById, bedStateFilter])

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
    const startIdx = (page - 1) * PAGE_SIZE
    const pageRows = filteredRows.slice(startIdx, startIdx + PAGE_SIZE)

    useEffect(() => {
        setPage(1)
    }, [search, bedStateFilter])

    const handlePrev = () => setPage((p) => Math.max(1, p - 1))
    const handleNext = () => setPage((p) => Math.min(totalPages, p + 1))

    const disablePrev = page <= 1 || loading
    const disableNext = page >= totalPages || loading

    // ---- Fetch patient UHID for current page only (smart caching) ----
    const ensurePatientUhids = useCallback(async (pids) => {
        const uniq = [...new Set(pids)].filter(Boolean)
        const missing = uniq.filter((pid) => !pmap[pid])
        if (missing.length === 0) return

        const local = {}
        await Promise.all(
            missing.map(async (pid) => {
                try {
                    const { data } = await getPatient(pid)
                    local[pid] = data?.uhid || `P-${pid}`
                } catch {
                    local[pid] = `P-${pid}`
                }
            }),
        )

        if (!aliveRef.current) return
        setPmap((prev) => ({ ...prev, ...local }))
    }, [pmap])

    useEffect(() => {
        const pids = pageRows.map((r) => r.patient_id)
        if (pids.length) ensurePatientUhids(pids)
    }, [pageRows, ensurePatientUhids])

    // ---- Stats (real-time feel) ----
    const stats = useMemo(() => {
        let occupied = 0
        let reserved = 0
        let vacant = 0
        let preoccupied = 0
        let unknown = 0

        for (const r of rows) {
            const s = bedsById[r.current_bed_id]?.state
            if (s === 'occupied') occupied += 1
            else if (s === 'reserved') reserved += 1
            else if (s === 'vacant') vacant += 1
            else if (s === 'preoccupied') preoccupied += 1
            else unknown += 1
        }

        return { total: rows.length, occupied, reserved, vacant, preoccupied, unknown }
    }, [rows, bedsById])

    const fromN = rows.length === 0 ? 0 : startIdx + 1
    const toN = Math.min(startIdx + PAGE_SIZE, filteredRows.length)

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
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_60%)]" />
                    <div className="relative p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                                        Live IPD Tracking
                                    </span>
                                </div>

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/10">
                                        <BedDouble className="h-5 w-5 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                            Tracking Admissions
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Monitor currently admitted patients with bed position and quick open to nursing / vitals / orders.
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className={UI.chip}>
                                                <User className="h-3.5 w-3.5" />
                                                Active <span className="ml-1 tabular-nums">{stats.total}</span>
                                            </span>

                                            <span className={UI.chip}>
                                                <Activity className="h-3.5 w-3.5" />
                                                Occupied <span className="ml-1 tabular-nums">{stats.occupied}</span>
                                            </span>

                                            <button
                                                type="button"
                                                className={cx(
                                                    UI.chipBtn,
                                                    autoRefresh && 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800',
                                                )}
                                                onClick={() => setAutoRefresh((v) => !v)}
                                                title="Auto refresh every 15s"
                                            >
                                                <Activity className="h-4 w-4" />
                                                Auto refresh
                                            </button>

                                            {lastSyncAt && (
                                                <span className={UI.chip}>
                                                    <Clock3 className="h-3.5 w-3.5" />
                                                    Synced <span className="ml-1 tabular-nums">{prettyTime(lastSyncAt)}</span>
                                                </span>
                                            )}

                                            {syncing && (
                                                <span className={UI.chip}>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Syncing…
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={() => loadData()}
                                    className={UI.chipBtn}
                                    disabled={loading}
                                    title="Refresh"
                                >
                                    <RefreshCcw className={cx('h-4 w-4', (loading || syncing) && 'animate-spin')} />
                                    Refresh
                                </button>

                                <span className={UI.chip}>
                                    Showing <span className="ml-1 tabular-nums">{filteredRows.length}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Active admissions" value={stats.total} icon={User} tone="dark" />
                            <StatCard label="Occupied beds" value={stats.occupied} icon={BedDouble} tone="rose" />
                            <StatCard label="Reserved beds" value={stats.reserved} icon={AlertCircle} tone="amber" />
                            <StatCard label="Unknown bed state" value={stats.unknown} icon={AlertCircle} tone="sky" />
                        </div>
                    </div>
                </motion.div>

                {/* CONTROLS + LIST */}
                <Card className={cx(UI.glass, 'overflow-hidden')}>
                    <CardHeader className="border-b border-black/10 bg-white/60 backdrop-blur-xl">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="grid w-full gap-3 md:grid-cols-[2fr,1.2fr]">
                                    {/* Search */}
                                    <div>
                                        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                            Active Admissions
                                        </CardTitle>
                                        <CardDescription className="text-[12px] text-slate-600">
                                            Search by admission code, UHID, or bed code. Filter by bed state.
                                        </CardDescription>

                                        <div className="mt-3 relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                className={cx(UI.input, 'pl-10')}
                                                placeholder="Search ADM-000123 / UHID / Bed…"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                            />
                                        </div>

                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Tip: Type <span className="font-semibold">ADM-</span> or a bed code like <span className="font-semibold">W2-R1-B03</span>.
                                        </p>
                                    </div>

                                    {/* Right meta */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                                Range
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="rounded-full border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                            >
                                                {filteredRows.length === 0 ? '0' : `${fromN}-${toN}`} / {filteredRows.length}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-11 rounded-2xl border-black/10 bg-white/85 font-semibold w-full"
                                                onClick={() => {
                                                    setSearch('')
                                                    setBedStateFilter('all')
                                                }}
                                                disabled={loading}
                                            >
                                                Clear
                                            </Button>
                                            <Button
                                                type="button"
                                                className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold w-full"
                                                onClick={() => loadData()}
                                                disabled={loading}
                                            >
                                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                                                Refresh
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-black/10" />

                            <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Bed state
                                </div>
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                    Page <span className="ml-1 tabular-nums">{page}</span> / {totalPages}
                                </Badge>
                            </div>

                            <Segmented value={bedStateFilter} onChange={setBedStateFilter} />
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {error && (
                            <div className="mb-3 flex items-start gap-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800">
                                <AlertCircle className="mt-0.5 h-4 w-4" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Loading skeleton */}
                        {loading && (
                            <div className="space-y-2">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-40 rounded-xl" />
                                                <Skeleton className="h-3 w-72 rounded-xl" />
                                            </div>
                                            <Skeleton className="h-10 w-24 rounded-2xl" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty */}
                        {!loading && pageRows.length === 0 && (
                            <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
                                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/10 bg-white/60">
                                    <AlertCircle className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">No active admissions found</div>
                                <p className="mt-1 text-[12px] text-slate-500">Try clearing filters or refreshing.</p>
                            </div>
                        )}

                        {/* Desktop table */}
                        {!loading && pageRows.length > 0 && (
                            <>
                                <div className="hidden md:block overflow-x-auto rounded-3xl border border-black/10 bg-white/70">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-white/70 text-[11px] uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3 text-left font-semibold">Admission</th>
                                                <th className="px-4 py-3 text-left font-semibold">Patient (UHID)</th>
                                                <th className="px-4 py-3 text-left font-semibold">Bed</th>
                                                <th className="px-4 py-3 text-left font-semibold">Admitted at</th>
                                                <th className="px-4 py-3 text-right font-semibold">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageRows.map((r) => {
                                                const bed = bedsById[r.current_bed_id]
                                                const bedCode = bed?.code || '—'
                                                const patientLabel = pmap[r.patient_id] || `P-${r.patient_id}`

                                                return (
                                                    <tr key={r.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums">
                                                                {code(r.id)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-800">
                                                            <span className="font-semibold">{patientLabel}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-800">
                                                            <span className="font-semibold">{bedCode}</span>
                                                            <span
                                                                className={cx(
                                                                    'ml-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                                                                    bedStateBadgeClass(bed?.state),
                                                                )}
                                                            >
                                                                {bed?.state || 'unknown'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-700">{prettyDateTime(r.admitted_at)}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Link
                                                                to={`/ipd/admission/${r.id}`}
                                                                state={{ admission: r }}
                                                                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
                                                            >
                                                                Open
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="md:hidden space-y-2">
                                    <AnimatePresence initial={false}>
                                        {pageRows.map((r) => {
                                            const bed = bedsById[r.current_bed_id]
                                            const bedCode = bed?.code || '—'
                                            const patientLabel = pmap[r.patient_id] || `P-${r.patient_id}`

                                            return (
                                                <motion.div
                                                    key={r.id}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    transition={{ duration: 0.14 }}
                                                    className="rounded-3xl border border-black/10 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums">
                                                            {code(r.id)}
                                                        </span>
                                                        <Link
                                                            to={`/ipd/admission/${r.id}`}
                                                            state={{ admission: r }}
                                                            className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
                                                        >
                                                            Open
                                                        </Link>
                                                    </div>

                                                    <div className="mt-3 space-y-2 text-[12px] text-slate-700">
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-slate-500" />
                                                            <span className="font-semibold text-slate-900">{patientLabel}</span>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <BedDouble className="h-4 w-4 text-slate-500" />
                                                            <span className="font-semibold text-slate-900">{bedCode}</span>
                                                            <span
                                                                className={cx(
                                                                    'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                                                                    bedStateBadgeClass(bed?.state),
                                                                )}
                                                            >
                                                                {bed?.state || 'unknown'}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-start gap-2">
                                                            <Clock3 className="mt-0.5 h-4 w-4 text-slate-500" />
                                                            <div>
                                                                <div className="text-[11px] text-slate-500">Admitted at</div>
                                                                <div className="text-[12px]">{prettyDateTime(r.admitted_at)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>

                                {/* Pagination */}
                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={handlePrev}
                                        disabled={disablePrev}
                                        className={UI.chipBtn}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </button>

                                    <span className={UI.chip}>
                                        Page <span className="ml-1 tabular-nums">{page}</span> / {totalPages}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        disabled={disableNext}
                                        className={UI.chipBtn}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
