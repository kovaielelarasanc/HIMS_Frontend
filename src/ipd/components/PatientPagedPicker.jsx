// FILE: src/ipd/components/PatientPagedPicker.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { searchPatients } from '../../api/opd'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { Search, X, CheckCircle2, Phone, IdCard, User } from 'lucide-react'

function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

// strict positive integer check (rejects 0, "", null, undefined, NaN)
const isPosInt = (v) => {
    if (typeof v === 'number') return Number.isInteger(v) && v > 0
    if (typeof v === 'string' && v.trim() !== '' && /^\d+$/.test(v)) return Number(v) > 0
    return false
}

function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.matchMedia(query).matches
    })

    useEffect(() => {
        if (typeof window === 'undefined') return
        const m = window.matchMedia(query)
        const onChange = () => setMatches(m.matches)
        onChange()
        m.addEventListener?.('change', onChange)
        return () => m.removeEventListener?.('change', onChange)
    }, [query])

    return matches
}

function pickPatientName(p) {
    return (
        p?.full_name ||
        p?.name ||
        p?.patient_name ||
        [p?.first_name, p?.last_name].filter(Boolean).join(' ') ||
        (p?.id ? `Patient #${p.id}` : 'Patient')
    )
}

function pickPatientMeta(p) {
    const uhid = p?.uhid || p?.mrn || p?.patient_code || p?.code || p?.registration_no
    const phone = p?.phone || p?.mobile || p?.phone_number
    const gender = p?.gender || p?.sex
    const age = p?.age || p?.age_years
    return { uhid, phone, gender, age }
}

/**
 * Nutryah-premium Patient Picker
 * ✅ 3 default (recent)
 * ✅ more results only on search
 * ✅ modal centered on desktop + bottom sheet on mobile
 * ✅ cards aligned + equal height
 * ✅ selected badge does NOT break alignment
 */
export default function PatientPagedPicker({
    value,
    onChange,
    placeholder = 'Search patient by name / phone / UHID…',
}) {
    const selectedId = isPosInt(value) ? Number(value) : null
    const isMobile = useMediaQuery('(max-width: 640px)')

    const anchorRef = useRef(null)
    const panelRef = useRef(null)
    const focusRef = useRef(null)

    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const [debouncedQ, setDebouncedQ] = useState('')
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const isSearching = debouncedQ.trim().length > 0
    const showLimit = isSearching ? 18 : 3

    // debounce
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 250)
        return () => clearTimeout(t)
    }, [q])

    const fetchPatients = useCallback(async (queryStr) => {
        setLoading(true)
        setError('')
        try {
            const res = await searchPatients(queryStr || '')
            const data = res?.data
            const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
            // keep extra in memory, UI shows 3 by default
            setList(queryStr ? arr.slice(0, 60) : arr.slice(0, 15))
        } catch (e) {
            setError(e?.response?.data?.detail || e?.message || 'Could not load patients')
            setList([])
        } finally {
            setLoading(false)
        }
    }, [])

    // when open, load recent once (empty search)
    useEffect(() => {
        if (!open) return
        if (debouncedQ) return
        fetchPatients('')
    }, [open, debouncedQ, fetchPatients])

    // when searching, load matching
    useEffect(() => {
        if (!open) return
        fetchPatients(debouncedQ)
    }, [debouncedQ, open, fetchPatients])

    // lock scroll on mobile
    useEffect(() => {
        if (!open || !isMobile) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [open, isMobile])

    // click outside close
    useEffect(() => {
        if (!open) return
        const onDown = (ev) => {
            const a = anchorRef.current
            const p = panelRef.current
            if (a && a.contains(ev.target)) return
            if (p && p.contains(ev.target)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [open])

    // ESC close
    useEffect(() => {
        if (!open) return
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open])

    // autofocus search in modal
    useEffect(() => {
        if (!open) return
        const t = setTimeout(() => focusRef.current?.focus?.(), 0)
        return () => clearTimeout(t)
    }, [open])

    const visible = useMemo(() => (Array.isArray(list) ? list.slice(0, showLimit) : []), [list, showLimit])

    const selectedPatient = useMemo(() => {
        if (!selectedId) return null
        return (list || []).find((p) => Number(p?.id) === selectedId) || null
    }, [list, selectedId])

    const select = (p) => {
        onChange?.(p?.id ?? null)
        setOpen(false)
    }

    const Panel = (
        <div className="fixed inset-0 z-[9999]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setOpen(false)} />

            {/* Center (desktop) + Bottom sheet (mobile) */}
            <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6">
                <div
                    ref={panelRef}
                    className={cx(
                        'w-full border bg-white/92 backdrop-blur-xl shadow-[0_28px_80px_rgba(2,6,23,0.22)]',
                        'border-black/10',
                        // mobile bottom sheet look
                        'rounded-t-3xl sm:rounded-3xl',
                        // width on desktop
                        'sm:max-w-4xl',
                    )}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-black/10 px-4 py-4">
                        <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-slate-900">
                                {isSearching ? 'Search results' : 'Recent patients'}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-600">
                                {isSearching ? `Showing up to ${showLimit}` : 'Showing 3 only. Type to search more.'}
                            </div>

                            {selectedId ? (
                                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Selected: {selectedPatient ? pickPatientName(selectedPatient) : `#${selectedId}`}
                                </div>
                            ) : (
                                <div className="mt-2 inline-flex items-center rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                    Tap a card to select
                                </div>
                            )}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl border-black/10 bg-white/70 px-3 font-semibold"
                            onClick={() => setOpen(false)}
                        >
                            <X className="mr-2 h-4 w-4" />
                            Close
                        </Button>
                    </div>

                    {/* Body */}
                    <div className={cx('px-4 pb-5', isMobile ? 'max-h-[72vh] overflow-auto' : 'max-h-[70vh] overflow-auto')}>
                        {/* Search */}
                        <div className="sticky top-0 z-10 -mx-4 bg-white/92 px-4 pt-4 pb-3 backdrop-blur-xl">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    ref={focusRef}
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder={placeholder}
                                    className="h-11 rounded-2xl border-black/10 bg-white/85 pl-9 text-[12px] font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                />
                                {q ? (
                                    <button
                                        type="button"
                                        onClick={() => setQ('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/80 hover:bg-black/[0.03]"
                                        aria-label="Clear"
                                    >
                                        <X className="h-4 w-4 text-slate-700" />
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {error ? (
                            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800">
                                {error}
                            </div>
                        ) : null}

                        {loading ? (
                            <div className="mt-4 grid gap-3 items-stretch [grid-auto-rows:minmax(132px,auto)] sm:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: isSearching ? 6 : 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-[110px] rounded-2xl" />
                                ))}
                            </div>
                        ) : visible.length === 0 ? (
                            <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 px-3 py-3 text-[12px] text-slate-600">
                                {isSearching ? 'No patients found. Try another keyword.' : 'No recent patients found.'}
                            </div>
                        ) : (
                            <div className="mt-4 grid gap-3 items-stretch [grid-auto-rows:minmax(132px,auto)] sm:grid-cols-2 lg:grid-cols-3">
                                {visible.map((p) => {
                                    const name = pickPatientName(p)
                                    const meta = pickPatientMeta(p)
                                    const active = selectedId && Number(p?.id) === selectedId

                                    return (
                                        <button
                                            key={p?.id}
                                            type="button"
                                            onClick={() => select(p)}
                                            className={cx(
                                                'relative overflow-hidden text-left rounded-2xl border p-3 transition',
                                                'bg-white/85 hover:bg-black/[0.03]',
                                                'h-full min-h-[132px]', // ✅ consistent card height
                                                active
                                                    ? 'border-sky-500 ring-2 ring-sky-100 shadow-[0_14px_34px_rgba(2,132,199,0.20)]'
                                                    : 'border-black/10 hover:border-black/20',
                                            )}
                                        >
                                            {/* badge (absolute so it won't break alignment) */}
                                            <div className="absolute right-3 top-3">
                                                {active ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Selected
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                                        Pick
                                                    </span>
                                                )}
                                            </div>

                                            {/* content */}
                                            <div className="flex h-full flex-col justify-between gap-3 pr-20">
                                                <div className="min-w-0">
                                                    <div className="truncate text-[13px] font-semibold text-slate-900">{name}</div>

                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/80 px-2 py-0.5">
                                                            <IdCard className="h-3.5 w-3.5 text-slate-500" />
                                                            <span className="font-semibold text-slate-700">{meta?.uhid || `#${p?.id}`}</span>
                                                        </span>

                                                        {meta?.age || meta?.gender ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/80 px-2 py-0.5">
                                                                <User className="h-3.5 w-3.5 text-slate-500" />
                                                                <span className="font-semibold text-slate-700">
                                                                    {[meta?.age ? `${meta.age}` : null, meta?.gender].filter(Boolean).join(' · ')}
                                                                </span>
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                {meta?.phone ? (
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                                                        <span className="font-semibold">{meta.phone}</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-slate-500"> </div>
                                                )}
                                            </div>

                                            {active ? (
                                                <div
                                                    className={cx(
                                                        'mt-2 text-[11px] font-semibold',
                                                        active ? 'text-sky-700' : 'text-transparent',
                                                    )}
                                                >
                                                    ✓ This patient will be admitted
                                                </div>
                                            ) : null}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {!isSearching ? (
                            <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[11px] text-slate-600">
                                Tip: Type to search (name / phone / UHID). Only 3 are shown by default.
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div ref={anchorRef} className="rounded-3xl border border-black/10 bg-white/80 p-3 md:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Patient</div>
                    <div className="mt-1 text-[12px] text-slate-600">
                        Shows <span className="font-semibold">3 recent</span> patients by default. Type to search more.
                    </div>
                </div>

                {/* <Button
                    type="button"
                    className={cx(
                        'h-10 rounded-2xl px-3 font-semibold',
                        open ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-white/85 hover:bg-black/[0.03] text-slate-900',
                    )}
                    variant={open ? 'default' : 'outline'}
                    onClick={() => setOpen((v) => !v)}
                >
                    <Search className="mr-2 h-4 w-4" />
                    {open ? 'Close' : 'Search'}
                </Button> */}
            </div>

            {selectedId ? (
                <div className="mt-3 rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-sky-700">Selected</div>
                            <div className="truncate text-[12px] font-semibold text-slate-900">
                                {selectedPatient ? pickPatientName(selectedPatient) : `Patient #${selectedId}`}
                            </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white/80 px-2 py-1 text-[11px] font-semibold text-sky-800">
                            <CheckCircle2 className="h-4 w-4" />
                            Ready
                        </span>
                    </div>
                </div>
            ) : null}

            {/* quick open search input */}
            <div className="mt-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value)
                            if (!open) setOpen(true)
                        }}
                        onFocus={() => setOpen(true)}
                        placeholder={placeholder}
                        className="h-11 rounded-2xl border-black/10 bg-white/85 pl-9 text-[12px] font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    {q ? (
                        <button
                            type="button"
                            onClick={() => setQ('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white/80 hover:bg-black/[0.03]"
                            aria-label="Clear"
                        >
                            <X className="h-4 w-4 text-slate-700" />
                        </button>
                    ) : null}
                </div>
            </div>

            {open ? createPortal(Panel, document.body) : null}
        </div>
    )
}
