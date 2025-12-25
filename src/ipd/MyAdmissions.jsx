
// FILE: src/ipd/MyAdmissions.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom'
import { listAdmissions, listBeds, getPatient } from '../api/ipd'
import { useAuth } from '../store/authStore'
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
} from 'lucide-react'

const PAGE_SIZE = 10

export default function MyAdmissions() {


    function parseApiDateUTC(s) {
        if (!s) return null
        const hasTZ = /Z$|[+-]\d{2}:\d{2}$/.test(s)
        return new Date(hasTZ ? s : `${s}Z`) // ✅ treat timezone-missing as UTC
    }

    function formatIST(s) {
        const d = parseApiDateUTC(s)
        if (!d) return ''
        return d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
        })
    }
    const me = useAuth((s) => s.user)

    const [rows, setRows] = useState([])
    const [bedsById, setBedsById] = useState({})
    const [pmap, setPmap] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    const code = (id) => `ADM-${String(id).padStart(6, '0')}`

    const bedStateBadgeClass = (state) => {
        if (!state) return 'bg-slate-50 text-slate-700 border-slate-500'
        if (state === 'vacant')
            return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        if (state === 'occupied')
            return 'bg-rose-50 text-rose-700 border-rose-200'
        if (state === 'reserved')
            return 'bg-amber-50 text-amber-700 border-amber-200'
        if (state === 'preoccupied')
            return 'bg-sky-50 text-sky-700 border-sky-200'
        return 'bg-slate-50 text-slate-700 border-slate-500'
    }

    const loadData = async () => {
        if (!me?.id) return
        setLoading(true)
        setError('')
        try {
            const [a, b] = await Promise.all([
                listAdmissions({
                    status: 'admitted',
                    practitioner_user_id: me.id,
                }),
                listBeds(),
            ])

            const admissions = a.data || []
            const beds = b.data || []

            admissions.sort(
                (x, y) =>
                    new Date(y.admitted_at || 0) - new Date(x.admitted_at || 0)
            )

            setRows(admissions)

            const bedsMap = {}
            for (const bed of beds) bedsMap[bed.id] = bed
            setBedsById(bedsMap)

            const ids = [...new Set(admissions.map((x) => x.patient_id))].slice(
                0,
                100
            )
            const m = {}
            await Promise.all(
                ids.map(async (pid) => {
                    try {
                        const { data } = await getPatient(pid)
                        m[pid] = data?.uhid || `P-${pid}`
                    } catch {
                        m[pid] = `P-${pid}`
                    }
                })
            )
            setPmap(m)
            setPage(1)
        } catch (e) {
            console.error('MyAdmissions loadData error', e)
            setError(
                e?.response?.data?.detail ||
                'Failed to load your admissions. Please try again.'
            )
            setRows([])
            setBedsById({})
            setPmap({})
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!me?.id) return
        let alive = true
            ; (async () => {
                await loadData()
                if (!alive) return
            })()
        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me?.id])

    // ------------- Filter + paginate -------------
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows

        return rows.filter((r) => {
            const admCode = code(r.id).toLowerCase()
            const patientLabel =
                (pmap[r.patient_id] || `P-${r.patient_id}`).toLowerCase()
            const bedCode = (bedsById[r.current_bed_id]?.code || '').toLowerCase()

            return (
                admCode.includes(q) ||
                patientLabel.includes(q) ||
                bedCode.includes(q)
            )
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

    if (!me?.id) {
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-6 text-sm text-slate-700 md:px-6">
                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-500 bg-white p-4 shadow-sm">
                    You are not logged in or your user information is missing. Please
                    log in again to view your admissions.
                </div>
            </div>
        )
    }

    const displayName =
        me?.full_name || me?.name || me?.username || me?.email || 'you'

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-4 text-black md:px-6 md:py-6">
            {/* Header + description */}
            <div className="mx-auto mb-4 flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                        My Admissions
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">
                        This view shows all{' '}
                        <span className="font-semibold">active in-patient admissions</span>{' '}
                        where <span className="font-semibold">{displayName}</span> is set as the
                        primary doctor / practitioner. Use it to quickly jump into your
                        patients&apos; admission detail screens for orders, notes, vitals and
                        discharge planning.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-500 bg-white px-3 py-2 shadow-sm">
                        <User className="h-4 w-4 text-slate-500" />
                        <span className="leading-tight">
                            <span className="font-medium text-slate-800">
                                Your in-patients
                            </span>
                            <br />
                            Assigned to you
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-500 bg-white px-3 py-2 shadow-sm">
                        <BedDouble className="h-4 w-4 text-slate-500" />
                        <span className="leading-tight">
                            <span className="font-medium text-slate-800">
                                Bed overview
                            </span>
                            <br />
                            Ward / room / bed
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-500 bg-white px-3 py-2 shadow-sm">
                        <Clock3 className="h-4 w-4 text-slate-500" />
                        <span className="leading-tight">
                            <span className="font-medium text-slate-800">
                                Admitted since
                            </span>
                            <br />
                            Length of stay
                        </span>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-6xl space-y-3">
                {/* Search + stats + refresh */}
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-500 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="w-full md:max-w-md">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                className="w-full rounded-2xl border border-slate-500 bg-white px-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                placeholder="Search by Admission no, UHID, Bed code…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                            Tip: Type an admission number (ADM-000123), UHID or bed code to
                            quickly find a patient.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                        <div className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-900">
                                {filteredRows.length}
                            </span>{' '}
                            of {totalCount} active admissions assigned to you
                        </div>
                        <button
                            type="button"
                            onClick={loadData}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Error bar */}
                {error && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Global loading / empty */}
                {loading && !rows.length && (
                    <div className="flex items-center justify-center rounded-2xl border border-slate-500 bg-white px-4 py-10 text-sm text-slate-600 shadow-sm">
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-500 px-3 py-1.5 text-xs">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            Loading your admissions…
                        </span>
                    </div>
                )}

                {!loading && pageRows.length === 0 && (
                    <div className="rounded-2xl border border-slate-500 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                        No active admissions assigned to you.
                    </div>
                )}

                {/* Main content: desktop table + mobile cards */}
                {!loading && pageRows.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-slate-500 bg-white shadow-sm">
                        {/* Desktop table (md+) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-xs text-slate-500">
                                        <th className="px-4 py-2 text-left font-medium">
                                            Admission
                                        </th>
                                        <th className="px-4 py-2 text-left font-medium">
                                            Patient (UHID)
                                        </th>
                                        <th className="px-4 py-2 text-left font-medium">
                                            Bed
                                        </th>
                                        <th className="px-4 py-2 text-left font-medium">
                                            Admitted at
                                        </th>
                                        <th className="px-4 py-2 text-right font-medium">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((r) => {
                                        const bed = bedsById[r.current_bed_id]
                                        const bedCode = bed?.code || '—'
                                        const patientLabel =
                                            pmap[r.patient_id] || `P-${r.patient_id}`

                                        return (
                                            <tr
                                                className="border-t text-sm hover:bg-slate-50"
                                                key={r.id}
                                            >
                                                <td className="px-4 py-2 align-middle text-slate-900">
                                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-slate-800">
                                                        {code(r.id)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 align-middle text-slate-800">
                                                    {patientLabel}
                                                </td>
                                                <td className="px-4 py-2 align-middle text-slate-800">
                                                    {bedCode}
                                                    {bed?.state && (
                                                        <span
                                                            className={`ml-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${bedStateBadgeClass(
                                                                bed.state
                                                            )}`}
                                                        >
                                                            {bed.state}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 align-middle text-slate-700">
                                                    {/* {r.admitted_at
                                                        ? new Date(
                                                            r.admitted_at
                                                        ).toLocaleString()
                                                        : '—'} */}
                                                        {formatIST(r.admitted_at)}
                                                </td>
                                                <td className="px-4 py-2 align-middle text-right">
                                                    <Link
                                                        to={`/ipd/admission/${r.id}`}
                                                        state={{ admission: r }}
                                                        className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
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

                        {/* Mobile cards (< md) */}
                        <div className="space-y-2 p-3 md:hidden">
                            {pageRows.map((r) => {
                                const bed = bedsById[r.current_bed_id]
                                const bedCode = bed?.code || '—'
                                const patientLabel =
                                    pmap[r.patient_id] || `P-${r.patient_id}`

                                return (
                                    <div
                                        key={r.id}
                                        className="rounded-2xl border border-slate-500 bg-slate-50 px-3 py-2 text-xs shadow-sm"
                                    >
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                                                {code(r.id)}
                                            </span>
                                            <Link
                                                to={`/ipd/admission/${r.id}`}
                                                state={{ admission: r }}
                                                className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                            >
                                                Open
                                            </Link>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-slate-800">
                                                <User className="h-3.5 w-3.5 text-slate-500" />
                                                <span className="font-medium">
                                                    {patientLabel}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-slate-800">
                                                <BedDouble className="h-3.5 w-3.5 text-slate-500" />
                                                <span className="font-medium">
                                                    {bedCode}
                                                </span>
                                                {bed?.state && (
                                                    <span
                                                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${bedStateBadgeClass(
                                                            bed.state
                                                        )}`}
                                                    >
                                                        {bed.state}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-start gap-2 text-slate-700">
                                                <Clock3 className="mt-0.5 h-3.5 w-3.5 text-slate-500" />
                                                <div>
                                                    <div className="text-[11px] text-slate-500">
                                                        Admitted at
                                                    </div>
                                                    <div className="text-[11px]">
                                                        {r.admitted_at
                                                            ? new Date(
                                                                r.admitted_at
                                                            ).toLocaleString()
                                                            : '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Pagination */}
                        {filteredRows.length > 0 && (
                            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    disabled={disablePrev}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Prev
                                </button>

                                <div className="text-[11px] text-slate-500">
                                    Page{' '}
                                    <span className="font-medium text-slate-900">
                                        {page}
                                    </span>{' '}
                                    of {totalPages}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={disableNext}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-white px-3 py-1.5 font-medium shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
