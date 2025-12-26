// FILE: src/ipd/Bedboard.jsx
import { useEffect, useMemo, useState } from 'react'
import { listWards, listRooms, listBeds, setBedState } from '../api/ipd'
import {
    Search,
    Loader2,
    AlertCircle,
    RotateCcw,
    BedDouble,
    Building2,
    DoorClosed,
    CheckCircle2,
    Clock3,
    StickyNote,
} from 'lucide-react'

const cx = (...a) => a.filter(Boolean).join(' ')

function parseApiDateUTC(s) {
    if (!s) return null
    const hasTZ = /Z$|[+-]\d{2}:\d{2}$/.test(s)
    return new Date(hasTZ ? s : `${s}Z`)
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
    })
}

export default function BedBoard() {
    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')

    const [dialog, setDialog] = useState(null) // { id, code, action, dt, note }
    const [saving, setSaving] = useState(false)
    const [dialogErr, setDialogErr] = useState('')

    const [search, setSearch] = useState('')
    const [stateFilter, setStateFilter] = useState('all') // all | vacant | occupied | reserved | preoccupied

    const load = async () => {
        setLoading(true)
        setErr('')
        try {
            const [w, r, b] = await Promise.all([listWards(), listRooms(), listBeds()])
            setWards(w.data || [])
            setRooms(r.data || [])
            setBeds(b.data || [])
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load bedboard.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const wardRooms = useMemo(() => {
        const map = {}
        rooms.forEach((r) => {
            ; (map[r.ward_id] ||= []).push(r)
        })
        return map
    }, [rooms])

    const roomBeds = useMemo(() => {
        const map = {}
        beds.forEach((b) => {
            ; (map[b.room_id] ||= []).push(b)
        })
        return map
    }, [beds])

    const counts = useMemo(() => {
        const c = { total: beds.length, vacant: 0, occupied: 0, reserved: 0, preoccupied: 0, other: 0 }
        for (const b of beds) {
            if (b.state === 'vacant') c.vacant++
            else if (b.state === 'occupied') c.occupied++
            else if (b.state === 'reserved') c.reserved++
            else if (b.state === 'preoccupied') c.preoccupied++
            else c.other++
        }
        return c
    }, [beds])

    const badgeCls = (s) => {
        if (s === 'vacant') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
        if (s === 'occupied') return 'border-rose-200 bg-rose-50 text-rose-800'
        if (s === 'reserved') return 'border-amber-200 bg-amber-50 text-amber-900'
        if (s === 'preoccupied') return 'border-sky-200 bg-sky-50 text-sky-800'
        return 'border-black/10 bg-white/70 text-slate-700'
    }

    const bedCardClass = (state) => {
        if (state === 'vacant') return 'border-emerald-200 bg-emerald-50/60'
        if (state === 'occupied') return 'border-rose-200 bg-rose-50/60'
        if (state === 'reserved') return 'border-amber-200 bg-amber-50/60'
        if (state === 'preoccupied') return 'border-sky-200 bg-sky-50/60'
        return 'border-black/10 bg-white/70'
    }

    const quickAction = (id, code, action) => {
        setDialog({ id, code, action, dt: '', note: '' })
        setDialogErr('')
    }

    const doSet = async () => {
        if (!dialog) return
        setDialogErr('')

        if (dialog.action === 'reserved' && !dialog.dt) {
            setDialogErr('Please select a "Reserved until" date & time.')
            return
        }

        try {
            setSaving(true)
            const payload = { state: dialog.action }
            if (dialog.action === 'reserved') {
                payload.reserved_until = dialog.dt
                    ? dialog.dt.length === 16
                        ? `${dialog.dt}:00`
                        : dialog.dt
                    : null
            }
            if (dialog.note) payload.note = dialog.note

            await setBedState(dialog.id, payload)
            setDialog(null)
            await load()
        } catch (e) {
            setDialogErr(e?.response?.data?.detail || 'Failed to update bed state.')
        } finally {
            setSaving(false)
        }
    }

    const q = search.trim().toLowerCase()

    // Filter which wards should display (based on search + state filter)
    const filteredWardIds = useMemo(() => {
        const ids = new Set()

        const bedMatchFn = (b) => {
            const st = (b.state || '').toLowerCase()
            const matchesState = stateFilter === 'all' ? true : st === stateFilter
            const matchesSearch = !q ? true : (b.code || '').toLowerCase().includes(q) || st.includes(q)
            return matchesState && matchesSearch
        }

        wards.forEach((w) => {
            const wardMatch =
                !q ||
                w.code?.toLowerCase().includes(q) ||
                w.name?.toLowerCase().includes(q)

            const wRooms = wardRooms[w.id] || []
            let hasMatch = wardMatch && stateFilter === 'all'

            wRooms.forEach((r) => {
                const roomMatch =
                    !q ||
                    String(r.number || '').toLowerCase().includes(q) ||
                    String(r.type || '').toLowerCase().includes(q)

                const rBeds = roomBeds[r.id] || []
                const bedsMatch = rBeds.some(bedMatchFn)

                if (roomMatch && stateFilter === 'all') hasMatch = true
                if (bedsMatch) hasMatch = true
            })

            if (hasMatch) ids.add(w.id)
        })

        // If no search and a state filter is applied: only wards that contain that state
        if (!q && stateFilter !== 'all') {
            wards.forEach((w) => {
                const wRooms = wardRooms[w.id] || []
                const has = wRooms.some((r) => (roomBeds[r.id] || []).some((b) => (b.state || '').toLowerCase() === stateFilter))
                if (has) ids.add(w.id)
            })
        }

        return Array.from(ids)
    }, [q, stateFilter, wards, wardRooms, roomBeds])

    const pill = (key, label, value, tone) => {
        const active = stateFilter === key
        const base =
            'inline-flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-[11px] font-semibold shadow-[0_10px_24px_rgba(2,6,23,0.06)] transition'
        const act = active ? 'ring-2 ring-sky-100 border-sky-300 bg-white' : 'border-black/10 bg-white/80 hover:bg-black/[0.02]'
        const dot =
            tone === 'emerald'
                ? 'bg-emerald-500'
                : tone === 'rose'
                    ? 'bg-rose-500'
                    : tone === 'amber'
                        ? 'bg-amber-500'
                        : tone === 'sky'
                            ? 'bg-sky-500'
                            : 'bg-slate-400'
        return (
            <button
                type="button"
                onClick={() => setStateFilter(key)}
                className={cx(base, act)}
            >
                <span className="inline-flex items-center gap-2 min-w-0">
                    <span className={cx('h-2 w-2 rounded-full', dot)} />
                    <span className="truncate text-slate-800">{label}</span>
                </span>
                <span className="tabular-nums text-slate-900">{value}</span>
            </button>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-4 text-black md:px-6 md:py-6">
            {/* Premium hero */}
            <div className="mx-auto max-w-6xl">
                <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_18px_60px_rgba(2,6,23,0.12)]">
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_60%)]" />
                    <div className="relative p-4 sm:p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-60" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                                        Live IPD Bedboard
                                    </span>
                                </div>

                                <div className="mt-2 flex items-start gap-3">
                                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/[0.03]">
                                        <BedDouble className="h-5 w-5 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-slate-900">
                                            Bedboard
                                        </h1>
                                        <p className="mt-1 text-[12px] text-slate-600">
                                            Search, filter and update bed states quickly — optimized for mobile + web.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                                <div className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 bg-white/85 px-4 text-[12px] font-semibold text-slate-700">
                                    Total <span className="ml-2 tabular-nums text-slate-900">{counts.total}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={load}
                                    disabled={loading}
                                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 bg-white/85 px-4 text-[12px] font-semibold text-slate-800 shadow-[0_10px_24px_rgba(2,6,23,0.06)] transition hover:bg-black/[0.02] disabled:opacity-60"
                                >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {/* State pills */}
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                            {pill('all', 'All', counts.total, 'slate')}
                            {pill('vacant', 'Vacant', counts.vacant, 'emerald')}
                            {pill('occupied', 'Occupied', counts.occupied, 'rose')}
                            {pill('reserved', 'Reserved', counts.reserved, 'amber')}
                            {pill('preoccupied', 'Preoccupied', counts.preoccupied, 'sky')}
                        </div>

                        {/* Search */}
                        <div className="mt-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    className="h-10 w-full rounded-2xl border border-black/10 bg-white/90 px-9 text-[12px] font-semibold text-slate-900 shadow-[0_10px_24px_rgba(2,6,23,0.06)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                    placeholder="Search ward, room, bed code or state…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                                Example: <span className="font-mono">W1</span>, <span className="font-mono">Room 12</span>, <span className="font-mono">B-102</span>, <span className="font-mono">vacant</span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error / loading */}
                {err && (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <span>{err}</span>
                    </div>
                )}

                {loading && !beds.length && (
                    <div className="mt-3 flex items-center justify-center rounded-3xl border border-black/10 bg-white/80 px-4 py-10 text-[12px] font-semibold text-slate-600 shadow-[0_18px_60px_rgba(2,6,23,0.10)]">
                        <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            Loading bedboard…
                        </span>
                    </div>
                )}

                {/* Ward / room / bed grid */}
                {!loading && (
                    <div className="mt-4 space-y-4">
                        {wards
                            .filter((w) => filteredWardIds.includes(w.id))
                            .map((w) => (
                                <div
                                    key={w.id}
                                    className="overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_18px_60px_rgba(2,6,23,0.10)]"
                                >
                                    {/* Ward header */}
                                    <div className="flex items-center gap-2 border-b border-black/10 bg-white/70 px-4 py-3">
                                        <Building2 className="h-4 w-4 text-slate-500" />
                                        <div className="min-w-0">
                                            <div className="text-[12px] font-semibold text-slate-900 truncate">
                                                {w.code} — {w.name}
                                            </div>
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                Ward
                                            </div>
                                        </div>
                                    </div>

                                    {(wardRooms[w.id] || []).length === 0 ? (
                                        <div className="px-4 py-4 text-[12px] text-slate-500">
                                            No rooms configured for this ward.
                                        </div>
                                    ) : (
                                        (wardRooms[w.id] || []).map((r) => {
                                            // Beds for this room filtered by stateFilter + search
                                            const bedsForRoom = (roomBeds[r.id] || []).filter((b) => {
                                                const st = (b.state || '').toLowerCase()
                                                const matchesState = stateFilter === 'all' ? true : st === stateFilter
                                                const matchesSearch =
                                                    !q ||
                                                    (b.code || '').toLowerCase().includes(q) ||
                                                    st.includes(q)
                                                return matchesState && matchesSearch
                                            })

                                            // If searching, also allow room match to show room header even if no bed matches
                                            const roomMatch =
                                                !q ||
                                                String(r.number || '').toLowerCase().includes(q) ||
                                                String(r.type || '').toLowerCase().includes(q)

                                            if (!bedsForRoom.length && !roomMatch) return null

                                            return (
                                                <div key={r.id} className="border-t border-black/10 px-4 py-4">
                                                    <div className="mb-3 flex items-center justify-between gap-2">
                                                        <div className="min-w-0 flex items-center gap-2">
                                                            <DoorClosed className="h-4 w-4 text-slate-400" />
                                                            <div className="min-w-0">
                                                                <div className="truncate text-[12px] font-semibold text-slate-900">
                                                                    Room {r.number}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 truncate">
                                                                    {r.type}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                            Beds <span className="ml-1 tabular-nums text-slate-900">{(roomBeds[r.id] || []).length}</span>
                                                        </div>
                                                    </div>

                                                    {bedsForRoom.length === 0 ? (
                                                        <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 px-3 py-3 text-[12px] text-slate-500">
                                                            No beds match the current filter in this room.
                                                        </div>
                                                    ) : (
                                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                            {bedsForRoom.map((b) => (
                                                                <div
                                                                    key={b.id}
                                                                    className={cx(
                                                                        'group rounded-3xl border px-3 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_60px_rgba(2,6,23,0.14)]',
                                                                        bedCardClass(b.state)
                                                                    )}
                                                                >
                                                                    {/* Top row: code + badge */}
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                                                                            {b.code}
                                                                        </div>
                                                                        <span
                                                                            className={cx(
                                                                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize',
                                                                                badgeCls(b.state)
                                                                            )}
                                                                        >
                                                                            {b.state || 'unknown'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Meta (single-line) */}
                                                                    {b.reserved_until ? (
                                                                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                                                                            <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                                                                            <span className="truncate" title={formatIST(b.reserved_until)}>
                                                                                Reserved till {formatIST(b.reserved_until)}
                                                                            </span>
                                                                        </div>
                                                                    ) : null}

                                                                    {b.note ? (
                                                                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                                                                            <StickyNote className="h-3.5 w-3.5 text-slate-400" />
                                                                            <span className="truncate" title={b.note}>
                                                                                {b.note}
                                                                            </span>
                                                                        </div>
                                                                    ) : null}

                                                                    {/* Actions (compact, mobile-friendly) */}
                                                                    <div className="mt-3 flex gap-1.5">
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100"
                                                                            onClick={() => quickAction(b.id, b.code, 'reserved')}
                                                                        >
                                                                            Reserve
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-2 py-2 text-[11px] font-semibold text-sky-900 transition hover:bg-sky-100"
                                                                            onClick={() => quickAction(b.id, b.code, 'preoccupied')}
                                                                        >
                                                                            Pre
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[11px] font-semibold text-emerald-900 transition hover:bg-emerald-100"
                                                                            onClick={() => quickAction(b.id, b.code, 'vacant')}
                                                                        >
                                                                            Vacate
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            ))}

                        {!loading && filteredWardIds.length === 0 && (
                            <div className="rounded-3xl border border-black/10 bg-white/80 px-4 py-10 text-center text-[12px] font-semibold text-slate-600 shadow-[0_18px_60px_rgba(2,6,23,0.10)]">
                                No beds match your filter. Try changing state pills or clearing search.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Premium dialog */}
            {dialog && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-black/10 bg-white/90 backdrop-blur-xl shadow-[0_24px_90px_rgba(2,6,23,0.35)]">
                        <div className="border-b border-black/10 bg-white/80 px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Update bed state
                                    </div>
                                    <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">
                                        {dialog.code} → {dialog.action}
                                    </div>
                                </div>
                                <span className={cx('shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize', badgeCls(dialog.action))}>
                                    {dialog.action}
                                </span>
                            </div>
                        </div>

                        <div className="px-4 py-4 space-y-3">
                            {dialog.action === 'reserved' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Reserved until
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="h-10 w-full rounded-2xl border border-black/10 bg-white/90 px-3 text-[12px] font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                        value={dialog.dt}
                                        onChange={(e) => setDialog((d) => ({ ...d, dt: e.target.value }))}
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Note (optional)
                                </label>
                                <input
                                    className="h-10 w-full rounded-2xl border border-black/10 bg-white/90 px-3 text-[12px] font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                    placeholder="Reason / patient ref / comment…"
                                    value={dialog.note}
                                    onChange={(e) => setDialog((d) => ({ ...d, note: e.target.value }))}
                                />
                            </div>

                            {dialogErr && (
                                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                                    <AlertCircle className="mt-0.5 h-4 w-4" />
                                    <span>{dialogErr}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 bg-white/80 px-4 text-[12px] font-semibold text-slate-700 transition hover:bg-black/[0.02] disabled:opacity-60"
                                    onClick={() => setDialog(null)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)] transition hover:bg-slate-800 disabled:opacity-60"
                                    onClick={doSet}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving…
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Save
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
