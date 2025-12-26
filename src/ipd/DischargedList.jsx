// FILE: src/ipd/DischargedList.jsx
import { useEffect, useMemo, useState } from 'react'
import { listAdmissions, listBeds, getPatient } from '../api/ipd'
import {
    Search,
    Loader2,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    BedDouble,
    User,
    Clock3,
    AlertCircle,
    Sparkles,
} from 'lucide-react'

const PAGE_SIZE = 10
const cx = (...xs) => xs.filter(Boolean).join(' ')

export default function DischargedList() {
    // ✅ timezone-safe parse (treat TZ-missing as UTC)
    function parseApiDateUTC(s) {
        if (!s) return null
        const hasTZ = /Z$|[+-]\d{2}:\d{2}$/.test(s)
        return new Date(hasTZ ? s : `${s}Z`)
    }

    // ✅ IST formatter (desktop + mobile)
    function formatIST(s) {
        const d = parseApiDateUTC(s)
        if (!d) return ''
        return d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
    }

    const [rows, setRows] = useState([])
    const [bedsById, setBedsById] = useState({})
    const [pmap, setPmap] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [lastSyncAt, setLastSyncAt] = useState(null)

    const code = (id) => `ADM-${String(id).padStart(6, '0')}`

    const bedStateBadgeClass = (state) => {
        if (!state) return 'bg-slate-50 text-slate-700 border-black/10'
        if (state === 'vacant') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        if (state === 'occupied') return 'bg-rose-50 text-rose-700 border-rose-200'
        if (state === 'reserved') return 'bg-amber-50 text-amber-800 border-amber-200'
        if (state === 'preoccupied') return 'bg-sky-50 text-sky-700 border-sky-200'
        return 'bg-slate-50 text-slate-700 border-black/10'
    }

    const loadData = async () => {
        setLoading(true)
        setError('')
        try {
            const [a, b] = await Promise.all([
                listAdmissions({ status: 'discharged' }),
                listBeds(),
            ])

            const admissions = a.data || []
            const beds = b.data || []

            // ✅ Sort newest by discharged_at (fallback admitted_at) with safe parse
            admissions.sort((x, y) => {
                const tx =
                    parseApiDateUTC(x.discharged_at || x.admitted_at)?.getTime?.() || 0
                const ty =
                    parseApiDateUTC(y.discharged_at || y.admitted_at)?.getTime?.() || 0
                return ty - tx
            })

            setRows(admissions)

            const bedsMap = {}
            for (const bed of beds) bedsMap[bed.id] = bed
            setBedsById(bedsMap)

            // Build patient UHID map (limit)
            const ids = [...new Set(admissions.map((x) => x.patient_id))].slice(0, 120)
            const m = {}
            await Promise.all(
                ids.map(async (pid) => {
                    try {
                        const { data } = await getPatient(pid)
                        m[pid] = data?.uhid || data?.mrn || data?.patient_code || `P-${pid}`
                    } catch {
                        m[pid] = `P-${pid}`
                    }
                }),
            )
            setPmap(m)

            setPage(1)
            setLastSyncAt(new Date())
        } catch (e) {
            console.error('DischargedList loadData error', e)
            setError(e?.response?.data?.detail || 'Failed to load discharged admissions. Please try again.')
            setRows([])
            setBedsById({})
            setPmap({})
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let alive = true
            ; (async () => {
                await loadData()
                if (!alive) return
            })()
        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ------------ Filter + paginate ------------
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows

        return rows.filter((r) => {
            const admCode = code(r.id).toLowerCase()
            const patientLabel = (pmap[r.patient_id] || `P-${r.patient_id}`).toLowerCase()
            const bedCode = (bedsById[r.current_bed_id]?.code || '').toLowerCase()
            return admCode.includes(q) || patientLabel.includes(q) || bedCode.includes(q)
        })
    }, [rows, search, pmap, bedsById])

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))

    useEffect(() => {
        setPage(1)
    }, [search, rows])

    const startIdx = (page - 1) * PAGE_SIZE
    const pageRows = filteredRows.slice(startIdx, startIdx + PAGE_SIZE)

    const handlePrev = () => setPage((p) => Math.max(1, p - 1))
    const handleNext = () => setPage((p) => Math.min(totalPages, p + 1))

    const disablePrev = page <= 1 || loading
    const disableNext = page >= totalPages || loading
    const totalCount = rows.length

    return (
        <div className="min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-4 text-black md:px-6 md:py-6">
            <div className="mx-auto max-w-6xl space-y-3">
                {/* HERO (Apple-premium) */}
                <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_14px_40px_rgba(2,6,23,0.10)]">
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_55%)]" />
                    <div className="relative p-4 sm:p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-white/80">
                                        <Sparkles className="h-4.5 w-4.5 text-slate-700" />
                                    </span>
                                    <div className="min-w-0">
                                        <h1 className="text-[16px] sm:text-lg font-semibold tracking-tight text-slate-900">
                                            Discharged Patients
                                        </h1>
                                        <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">
                                            Completed IPD admissions for audit, reporting & record review.
                                        </p>
                                    </div>
                                </div>

                                {/* compact info line */}
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-slate-700">
                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                        Showing <span className="tabular-nums text-slate-900">{filteredRows.length}</span>
                                    </span>

                                    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-slate-700">
                                        <BedDouble className="h-3.5 w-3.5 text-slate-500" />
                                        Total <span className="tabular-nums text-slate-900">{totalCount}</span>
                                    </span>

                                    {lastSyncAt && (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-slate-700">
                                            <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                                            Synced{' '}
                                            <span className="tabular-nums text-slate-900">
                                                {lastSyncAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Search + Refresh */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                                <div className="relative w-full sm:w-[360px]">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        className="h-10 w-full rounded-2xl border border-black/10 bg-white/85 px-9 text-[12px] font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                        placeholder="Search ADM / UHID / bed…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={loadData}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/85 px-4 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={loading}
                                    title="Refresh"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                    Refresh
                                </button>
                            </div>
                        </div>

                        <p className="mt-2 text-[11px] text-slate-500">
                            Tip: Example search – <span className="font-mono">ADM-000245</span>, UHID, or bed code.
                        </p>
                    </div>
                </div>

                {/* Error bar */}
                {error && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Loading / empty */}
                {loading && !rows.length && (
                    <div className="flex items-center justify-center rounded-3xl border border-black/10 bg-white/75 px-4 py-10 text-sm text-slate-600 shadow-sm">
                        <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-3 py-2 text-xs font-semibold">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            Loading discharged admissions…
                        </span>
                    </div>
                )}

                {!loading && pageRows.length === 0 && (
                    <div className="rounded-3xl border border-black/10 bg-white/75 px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
                        No discharged records found.
                    </div>
                )}

                {/* Main content */}
                {!loading && pageRows.length > 0 && (
                    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_12px_30px_rgba(2,6,23,0.08)]">
                        {/* Desktop table (md+) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 text-xs text-slate-500">
                                        <th className="px-4 py-3 text-left font-semibold">Admission</th>
                                        <th className="px-4 py-3 text-left font-semibold">Patient (UHID)</th>
                                        <th className="px-4 py-3 text-left font-semibold">Last bed</th>
                                        <th className="px-4 py-3 text-left font-semibold">Admitted at (IST)</th>
                                        <th className="px-4 py-3 text-left font-semibold">Discharged at (IST)</th>
                                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((r) => {
                                        const bed = bedsById[r.current_bed_id]
                                        const bedCode = bed?.code || '—'
                                        const patientLabel = pmap[r.patient_id] || `P-${r.patient_id}`

                                        return (
                                            <tr className="border-t border-black/5 hover:bg-black/[0.02]" key={r.id}>
                                                <td className="px-4 py-3 align-middle">
                                                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-800">
                                                        {code(r.id)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 align-middle text-slate-800">
                                                    <span className="font-semibold">{patientLabel}</span>
                                                </td>

                                                <td className="px-4 py-3 align-middle text-slate-800">
                                                    <span className="font-semibold">{bedCode}</span>
                                                    {bed?.state && (
                                                        <span
                                                            className={cx(
                                                                'ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                                                bedStateBadgeClass(bed.state),
                                                            )}
                                                        >
                                                            {bed.state}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 align-middle text-slate-700">
                                                    {formatIST(r.admitted_at) || '—'}
                                                </td>

                                                <td className="px-4 py-3 align-middle text-slate-700">
                                                    {formatIST(r.discharged_at) || '—'}
                                                </td>

                                                <td className="px-4 py-3 align-middle">
                                                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                        {r.status || 'discharged'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards (< md) – single-line rows */}
                        <div className="space-y-2 p-3 md:hidden">
                            {pageRows.map((r) => {
                                const bed = bedsById[r.current_bed_id]
                                const bedCode = bed?.code || '—'
                                const patientLabel = pmap[r.patient_id] || `P-${r.patient_id}`

                                return (
                                    <div
                                        key={r.id}
                                        className="rounded-3xl border border-black/10 bg-white/80 px-3 py-3 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center rounded-full border border-black/10 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
                                                {code(r.id)}
                                            </span>
                                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                {r.status || 'discharged'}
                                            </span>
                                        </div>

                                        <div className="mt-2 space-y-2 text-[12px]">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-slate-400" />
                                                <span className="min-w-0 truncate font-semibold text-slate-900">{patientLabel}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <BedDouble className="h-4 w-4 text-slate-400" />
                                                <span className="font-semibold text-slate-900">{bedCode}</span>
                                                {bed?.state && (
                                                    <span
                                                        className={cx(
                                                            'ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                                            bedStateBadgeClass(bed.state),
                                                        )}
                                                    >
                                                        {bed.state}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Clock3 className="h-4 w-4 text-slate-400" />
                                                <span className="text-slate-600">Admitted</span>
                                                <span className="ml-auto tabular-nums font-semibold text-slate-900">
                                                    {formatIST(r.admitted_at) || '—'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Clock3 className="h-4 w-4 text-slate-400" />
                                                <span className="text-slate-600">Discharged</span>
                                                <span className="ml-auto tabular-nums font-semibold text-slate-900">
                                                    {formatIST(r.discharged_at) || '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Pagination */}
                        {filteredRows.length > 0 && (
                            <div className="flex flex-col items-center justify-between gap-3 border-t border-black/10 px-4 py-3 text-xs text-slate-600 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    disabled={disablePrev}
                                    className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-3 py-1.5 font-semibold shadow-sm transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Prev
                                </button>

                                <div className="text-[11px] text-slate-500">
                                    Page <span className="font-semibold text-slate-900">{page}</span> of {totalPages}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={disableNext}
                                    className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-3 py-1.5 font-semibold shadow-sm transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
