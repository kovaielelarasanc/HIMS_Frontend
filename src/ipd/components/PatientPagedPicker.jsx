// FILE: src/ipd/components/PatientPagedPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { searchPatients } from '../../api/opd'
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    CheckCircle2,
} from 'lucide-react'

const PAGE_SIZE = 10

export default function PatientPagedPicker({ value, onChange }) {
    const [q, setQ] = useState('')
    const [debouncedQ, setDebouncedQ] = useState('')
    const [list, setList] = useState([])
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // --- Debounce search text so API is not called on every keystroke ---
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQ(q.trim()), 300)
        return () => clearTimeout(handle)
    }, [q])

    // --- Fetch patients from API ---
    useEffect(() => {
        let alive = true
        const run = async () => {
            setLoading(true)
            setError(null)
            try {
                const { data } = await searchPatients(debouncedQ || '')
                if (!alive) return
                setList(Array.isArray(data) ? data : [])
                setPage(0) // reset to first page when search changes
            } catch (e) {
                if (!alive) return
                const detail =
                    e?.response?.data?.detail ||
                    e?.message ||
                    'Could not load patients. Please try again.'
                setError(detail)
                setList([])
                setPage(0)
            } finally {
                alive && setLoading(false)
            }
        }
        run()
        return () => {
            alive = false
        }
    }, [debouncedQ])

    const pages = Math.max(1, Math.ceil((list?.length || 0) / PAGE_SIZE))
    const start = page * PAGE_SIZE

    const rows = useMemo(
        () => (list || []).slice(start, start + PAGE_SIZE),
        [list, start]
    )

    const handleSelect = (id) => {
        if (onChange) onChange(id)
    }

    const disabledPrev = page === 0 || loading
    const disabledNext = page >= pages - 1 || loading

    const selectedId = value ?? null

    return (
        <div className="space-y-3">
            {/* Label + small description (works nicely with your Admissions header) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Patient
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                        Search and select patient for admission
                    </span>
                </div>
                <p className="text-[11px] text-slate-500">
                    Search by UHID, name, phone or email and choose the correct patient.
                </p>
            </div>

            {/* Search box with perfectly centered icon */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Search by UHID, name, phone, email…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
            </div>

            {/* Result table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-xs text-slate-500">
                                <th className="px-4 py-2 text-left font-medium">UHID</th>
                                <th className="px-4 py-2 text-left font-medium">Name</th>
                                <th className="px-4 py-2 text-left font-medium">Phone</th>
                                <th className="px-4 py-2 text-right font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-6 text-center text-sm text-slate-500"
                                    >
                                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading patients…
                                        </span>
                                    </td>
                                </tr>
                            )}

                            {!loading && error && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-6 text-center text-sm text-rose-600"
                                    >
                                        {error}
                                    </td>
                                </tr>
                            )}

                            {!loading && !error && rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-6 text-center text-sm text-slate-500"
                                    >
                                        No patients found. Try a different search.
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                !error &&
                                rows.map((p) => {
                                    const isSelected = selectedId === p.id
                                    const fullName = `${p.first_name || ''} ${p.last_name || ''
                                        }`.trim()

                                    return (
                                        <tr
                                            key={p.id}
                                            className={`border-t text-sm transition hover:bg-slate-50 ${isSelected ? 'bg-sky-50' : ''
                                                }`}
                                        >
                                            <td className="px-4 py-2 align-middle text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    {isSelected && (
                                                        <CheckCircle2 className="h-4 w-4 text-sky-500" />
                                                    )}
                                                    <span className="font-medium">
                                                        {p.uhid || '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 align-middle text-slate-800">
                                                {fullName || p.name || '—'}
                                            </td>
                                            <td className="px-4 py-2 align-middle text-slate-700">
                                                {p.phone || '—'}
                                            </td>
                                            <td className="px-4 py-2 align-middle text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelect(p.id)}
                                                    className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm transition ${isSelected
                                                            ? 'bg-sky-600 text-white hover:bg-sky-700'
                                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                                        }`}
                                                >
                                                    {isSelected ? 'Selected' : 'Select'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 font-medium shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={disabledPrev}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                    </button>

                    <div className="text-[11px] text-slate-500">
                        Page <span className="font-medium">{page + 1}</span> / {pages}
                    </div>

                    <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 font-medium shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                        disabled={disabledNext}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
