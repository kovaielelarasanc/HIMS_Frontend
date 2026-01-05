// FILE: src/ipd/Bedboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/* -------------------------
   Warm palette (your colors)
-------------------------- */
const COLORS = {
    mint: '#B7E5CD',
    teal: '#8ABEB9',
    deep: '#305669',
    clay: '#C1785A',
}

function normalizeState(s) {
    return String(s || '').toLowerCase()
}

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

/* -------------------------
   UI helpers (warm + premium)
-------------------------- */
function stateMeta(state) {
    const s = normalizeState(state)
    if (s === 'vacant') return { label: 'Vacant', bg: COLORS.mint, fg: COLORS.deep }
    if (s === 'reserved') return { label: 'Reserved', bg: COLORS.teal, fg: COLORS.deep }
    if (s === 'occupied') return { label: 'Occupied', bg: COLORS.clay, fg: '#1b2a33' }
    if (s === 'preoccupied') return { label: 'Preoccupied', bg: COLORS.deep, fg: COLORS.mint }
    return { label: s || 'Unknown', bg: 'rgba(255,255,255,0.55)', fg: COLORS.deep }
}

function BedBadge({ state }) {
    const m = stateMeta(state)
    return (
        <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
                background: 'rgba(255,255,255,0.45)',
                border: `1px solid rgba(48,86,105,0.25)`,
                color: COLORS.deep,
            }}
            title={m.label}
        >
            <span
                className="mr-2 inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: m.bg }}
            />
            {m.label}
        </span>
    )
}

function Pill({ active, onClick, label, value, dot }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                'inline-flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-[11px] font-semibold transition',
                active ? 'ring-2' : 'hover:opacity-95',
            )}
            style={{
                background: active ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.55)',
                border: `1px solid rgba(48,86,105,${active ? 0.35 : 0.22})`,
                color: COLORS.deep,
                boxShadow: active
                    ? '0 14px 40px rgba(16,24,40,0.14)'
                    : '0 10px 24px rgba(16,24,40,0.10)',
                ringColor: 'rgba(48,86,105,0.25)',
            }}
        >
            <span className="inline-flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
                <span className="truncate">{label}</span>
            </span>
            <span className="tabular-nums">{value}</span>
        </button>
    )
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

    const aliveRef = useRef(true)

    const load = useCallback(async () => {
        setLoading(true)
        setErr('')
        try {
            const [w, r, b] = await Promise.all([listWards(), listRooms(), listBeds()])
            if (!aliveRef.current) return
            setWards(w?.data || [])
            setRooms(r?.data || [])
            setBeds(b?.data || [])
        } catch (e) {
            if (!aliveRef.current) return
            setErr(e?.response?.data?.detail || 'Failed to load bedboard.')
        } finally {
            if (!aliveRef.current) return
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        aliveRef.current = true
        load()
        return () => {
            aliveRef.current = false
        }
    }, [load])

    const roomById = useMemo(() => {
        const m = new Map()
        for (const r of rooms || []) m.set(r.id, r)
        return m
    }, [rooms])

    // ward -> rooms (sorted)
    const wardRooms = useMemo(() => {
        const map = {}
        for (const r of rooms || []) {
            ; (map[r.ward_id] ||= []).push(r)
        }
        Object.values(map).forEach((arr) => {
            arr.sort((a, b) => String(a.number || '').localeCompare(String(b.number || '')))
        })
        return map
    }, [rooms])

    // room -> beds (sorted)
    const roomBeds = useMemo(() => {
        const map = {}
        for (const b of beds || []) {
            ; (map[b.room_id] ||= []).push(b)
        }
        Object.values(map).forEach((arr) => {
            arr.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')))
        })
        return map
    }, [beds])

    const counts = useMemo(() => {
        const c = { total: beds.length, vacant: 0, occupied: 0, reserved: 0, preoccupied: 0, other: 0 }
        for (const b of beds || []) {
            const st = normalizeState(b.state)
            if (st === 'vacant') c.vacant++
            else if (st === 'occupied') c.occupied++
            else if (st === 'reserved') c.reserved++
            else if (st === 'preoccupied') c.preoccupied++
            else c.other++
        }
        return c
    }, [beds])

    const q = search.trim().toLowerCase()

    // Which wards to show (search + state filter)
    const filteredWardIds = useMemo(() => {
        const ids = new Set()

        const bedMatchFn = (b) => {
            const st = normalizeState(b.state)
            const matchesState = stateFilter === 'all' ? true : st === stateFilter
            const matchesSearch = !q ? true : (b.code || '').toLowerCase().includes(q) || st.includes(q)
            return matchesState && matchesSearch
        }

        for (const w of wards || []) {
            const wardMatch =
                !q ||
                String(w.code || '').toLowerCase().includes(q) ||
                String(w.name || '').toLowerCase().includes(q) ||
                String(w.floor || '').toLowerCase().includes(q)

            const wRooms = wardRooms[w.id] || []
            let hasMatch = wardMatch && stateFilter === 'all'

            for (const r of wRooms) {
                const roomMatch =
                    !q ||
                    String(r.number || '').toLowerCase().includes(q) ||
                    String(r.type || '').toLowerCase().includes(q)

                const rBeds = roomBeds[r.id] || []
                const bedsMatch = rBeds.some(bedMatchFn)

                if (roomMatch && stateFilter === 'all') hasMatch = true
                if (bedsMatch) hasMatch = true
            }

            if (hasMatch) ids.add(w.id)
        }

        // If only state filter (no search), show wards having that state
        if (!q && stateFilter !== 'all') {
            for (const w of wards || []) {
                const wRooms = wardRooms[w.id] || []
                const has = wRooms.some((r) =>
                    (roomBeds[r.id] || []).some((b) => normalizeState(b.state) === stateFilter),
                )
                if (has) ids.add(w.id)
            }
        }

        return Array.from(ids)
    }, [q, stateFilter, wards, wardRooms, roomBeds])

    const filteredWards = useMemo(() => {
        const s = new Set(filteredWardIds)
        return (wards || []).filter((w) => s.has(w.id))
    }, [wards, filteredWardIds])

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

    return (
        <div
            className="min-h-screen px-4 py-4 md:px-6 md:py-6"
            style={{
                // warm background using your palette (subtle + premium)
                background: 'rgba(255,255,255,0.58)'
            }

            }
        >
            <div className="mx-auto max-w-7xl">
                {/* HERO */}
                <div
                    className="relative overflow-hidden rounded-[28px] p-4 sm:p-5"
                    style={{
                        background: 'rgba(255,255,255,0.58)',
                        border: '1px solid rgba(48,86,105,0.22)',
                        boxShadow: '0 22px 80px rgba(16,24,40,0.16)',
                        backdropFilter: 'blur(14px)',
                    }}
                >
                    <div
                        className="absolute inset-0 opacity-70"
                        style={{
                            background:
                                `radial-gradient(circle at top, rgba(48,86,105,0.16), transparent 60%),` +
                                `radial-gradient(circle at 30% 20%, rgba(193,120,90,0.12), transparent 55%)`,
                        }}
                    />

                    <div className="relative flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-start gap-3">
                                <div
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-3xl"
                                    style={{
                                        background: 'rgba(48,86,105,0.10)',
                                        border: '1px solid rgba(48,86,105,0.22)',
                                    }}
                                >
                                    <BedDouble className="h-5 w-5" style={{ color: COLORS.deep }} />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-[18px] sm:text-[20px] font-semibold tracking-tight" style={{ color: COLORS.deep }}>
                                        Bedboard
                                    </h1>
                                    <p className="mt-1 text-[12px]" style={{ color: 'rgba(48,86,105,0.78)' }}>
                                        Ward vertical • Rooms horizontal • Warm premium cards
                                    </p>
                                </div>
                            </div>

                            {/* Pills */}
                            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                                <Pill
                                    active={stateFilter === 'all'}
                                    onClick={() => setStateFilter('all')}
                                    label="All"
                                    value={counts.total}
                                    dot={COLORS.deep}
                                />
                                <Pill
                                    active={stateFilter === 'vacant'}
                                    onClick={() => setStateFilter('vacant')}
                                    label="Vacant"
                                    value={counts.vacant}
                                    dot={COLORS.mint}
                                />
                                <Pill
                                    active={stateFilter === 'occupied'}
                                    onClick={() => setStateFilter('occupied')}
                                    label="Occupied"
                                    value={counts.occupied}
                                    dot={COLORS.clay}
                                />
                                <Pill
                                    active={stateFilter === 'reserved'}
                                    onClick={() => setStateFilter('reserved')}
                                    label="Reserved"
                                    value={counts.reserved}
                                    dot={COLORS.teal}
                                />
                                <Pill
                                    active={stateFilter === 'preoccupied'}
                                    onClick={() => setStateFilter('preoccupied')}
                                    label="Preoccupied"
                                    value={counts.preoccupied}
                                    dot={COLORS.deep}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                            <div
                                className="inline-flex h-10 items-center justify-center rounded-2xl px-4 text-[12px] font-semibold"
                                style={{
                                    background: 'rgba(255,255,255,0.65)',
                                    border: '1px solid rgba(48,86,105,0.18)',
                                    color: COLORS.deep,
                                }}
                            >
                                Total <span className="ml-2 tabular-nums">{counts.total}</span>
                            </div>

                            <button
                                type="button"
                                onClick={load}
                                disabled={loading}
                                className="inline-flex h-10 items-center justify-center rounded-2xl px-4 text-[12px] font-semibold transition disabled:opacity-60"
                                style={{
                                    background: 'rgba(255,255,255,0.65)',
                                    border: '1px solid rgba(48,86,105,0.18)',
                                    color: COLORS.deep,
                                    boxShadow: '0 10px 24px rgba(16,24,40,0.10)',
                                }}
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative mt-4">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'rgba(48,86,105,0.55)' }} />
                        <input
                            className="h-10 w-full rounded-2xl pl-9 pr-3 text-[12px] font-semibold outline-none transition"
                            style={{
                                background: 'rgba(255,255,255,0.70)',
                                border: '1px solid rgba(48,86,105,0.20)',
                                color: COLORS.deep,
                                boxShadow: '0 10px 24px rgba(16,24,40,0.10)',
                            }}
                            placeholder="Search ward, room, bed code or state…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <p className="mt-1 text-[11px]" style={{ color: 'rgba(48,86,105,0.60)' }}>
                            Example: <span className="font-mono">W1</span>, <span className="font-mono">Room 12</span>, <span className="font-mono">B-102</span>, <span className="font-mono">vacant</span>.
                        </p>
                    </div>
                </div>

                {/* Error */}
                {err && (
                    <div
                        className="mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-[12px] font-semibold"
                        style={{
                            background: 'rgba(193,120,90,0.18)',
                            border: '1px solid rgba(193,120,90,0.28)',
                            color: '#5a2c20',
                        }}
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <span>{err}</span>
                    </div>
                )}

                {/* Loading */}
                {loading && !beds.length && (
                    <div
                        className="mt-4 flex items-center justify-center rounded-[28px] px-4 py-12 text-[12px] font-semibold"
                        style={{
                            background: 'rgba(255,255,255,0.55)',
                            border: '1px solid rgba(48,86,105,0.18)',
                            color: 'rgba(48,86,105,0.75)',
                            boxShadow: '0 18px 60px rgba(16,24,40,0.12)',
                        }}
                    >
                        <span
                            className="inline-flex items-center gap-2 rounded-full px-3 py-2"
                            style={{
                                background: 'rgba(255,255,255,0.65)',
                                border: '1px solid rgba(48,86,105,0.16)',
                            }}
                        >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading bedboard…
                        </span>
                    </div>
                )}

                {/* ================================
            WARD: VERTICAL (stack)
            ROOM: HORIZONTAL (inside ward)
           ================================ */}
                {!loading && (
                    <div className="mt-5 space-y-4">
                        {filteredWards.length === 0 ? (
                            <div
                                className="rounded-[28px] px-4 py-12 text-center text-[12px] font-semibold"
                                style={{
                                    background: 'rgba(255,255,255,0.55)',
                                    border: '1px solid rgba(48,86,105,0.18)',
                                    color: 'rgba(48,86,105,0.75)',
                                    boxShadow: '0 18px 60px rgba(16,24,40,0.12)',
                                }}
                            >
                                No beds match your filter. Try changing state pills or clearing search.
                            </div>
                        ) : (
                            filteredWards.map((w) => {
                                const wRooms = wardRooms[w.id] || []

                                // ward header match helps show ward even if rooms filtered heavily
                                const wardMatch =
                                    !q ||
                                    String(w.code || '').toLowerCase().includes(q) ||
                                    String(w.name || '').toLowerCase().includes(q) ||
                                    String(w.floor || '').toLowerCase().includes(q)

                                // Build filtered room list (to render horizontally)
                                const filteredRooms = (wRooms || []).map((r) => {
                                    const allBeds = roomBeds[r.id] || []
                                    const bedsForRoom = allBeds.filter((b) => {
                                        const st = normalizeState(b.state)
                                        const matchesState = stateFilter === 'all' ? true : st === stateFilter
                                        const matchesSearch = !q ? true : (b.code || '').toLowerCase().includes(q) || st.includes(q)
                                        return matchesState && matchesSearch
                                    })

                                    const roomMatch =
                                        !q ||
                                        String(r.number || '').toLowerCase().includes(q) ||
                                        String(r.type || '').toLowerCase().includes(q)

                                    // show room if: it has matching beds OR room text matches OR ward text matches (and no state filter restriction)
                                    const show =
                                        bedsForRoom.length > 0 ||
                                        (roomMatch && stateFilter === 'all') ||
                                        (wardMatch && stateFilter === 'all')

                                    return show ? { r, allBeds, bedsForRoom } : null
                                }).filter(Boolean)

                                return (
                                    <div
                                        key={w.id}
                                        className="overflow-hidden rounded-[28px]"
                                        style={{
                                            background: 'rgba(255,255,255,0.55)',
                                            border: '1px solid rgba(48,86,105,0.18)',
                                            boxShadow: '0 18px 70px rgba(16,24,40,0.14)',
                                            backdropFilter: 'blur(12px)',
                                        }}
                                    >
                                        {/* Ward header */}
                                        <div
                                            className="px-4 py-3"
                                            style={{
                                                background: 'rgba(255,255,255,0.62)',
                                                borderBottom: '1px solid rgba(48,86,105,0.14)',
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex items-start gap-2">
                                                    <div
                                                        className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-3xl"
                                                        style={{
                                                            background: 'rgba(48,86,105,0.10)',
                                                            border: '1px solid rgba(48,86,105,0.20)',
                                                        }}
                                                    >
                                                        <Building2 className="h-4.5 w-4.5" style={{ color: COLORS.deep }} />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="truncate text-[13px] font-semibold" style={{ color: COLORS.deep }}>
                                                            {w.code} — {w.name}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-[11px]" style={{ color: 'rgba(48,86,105,0.65)' }}>
                                                            {w.floor ? `Floor: ${w.floor}` : 'Ward'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.60)',
                                                        border: '1px solid rgba(48,86,105,0.18)',
                                                        color: COLORS.deep,
                                                    }}
                                                >
                                                    Rooms <span className="ml-1 tabular-nums">{wRooms.length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Room lane (horizontal) */}
                                        <div className="px-4 py-4">
                                            {wRooms.length === 0 ? (
                                                <div className="rounded-3xl px-4 py-4 text-[12px]" style={{ background: 'rgba(255,255,255,0.55)', border: '1px dashed rgba(48,86,105,0.20)', color: 'rgba(48,86,105,0.70)' }}>
                                                    No rooms configured for this ward.
                                                </div>
                                            ) : filteredRooms.length === 0 ? (
                                                <div className="rounded-3xl px-4 py-4 text-[12px]" style={{ background: 'rgba(255,255,255,0.55)', border: '1px dashed rgba(48,86,105,0.20)', color: 'rgba(48,86,105,0.70)' }}>
                                                    No rooms/beds match the current filter in this ward.
                                                </div>
                                            ) : (
                                                <div className="flex gap-3 overflow-x-auto pb-2 pr-2 [-webkit-overflow-scrolling:touch]">
                                                    {filteredRooms.map(({ r, allBeds, bedsForRoom }) => (
                                                        <div
                                                            key={r.id}
                                                            className="shrink-0 w-[380px] rounded-[26px] p-3"
                                                            style={{
                                                                background: 'rgba(138,190,185,0.32)', // #8ABEB9 warm lane
                                                                border: '1px solid rgba(48,86,105,0.18)',
                                                                boxShadow: '0 16px 55px rgba(16,24,40,0.12)',
                                                            }}
                                                        >
                                                            {/* Room header */}
                                                            <div className="mb-3 flex items-start justify-between gap-2">
                                                                <div className="min-w-0 flex items-start gap-2">
                                                                    <div
                                                                        className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-3xl"
                                                                        style={{
                                                                            background: 'rgba(48,86,105,0.10)',
                                                                            border: '1px solid rgba(48,86,105,0.18)',
                                                                        }}
                                                                    >
                                                                        <DoorClosed className="h-4 w-4" style={{ color: COLORS.deep }} />
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-[12px] font-semibold" style={{ color: COLORS.deep }}>
                                                                            Room {r.number}
                                                                        </div>
                                                                        <div className="truncate text-[11px]" style={{ color: 'rgba(48,86,105,0.70)' }}>
                                                                            {r.type || '—'}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div
                                                                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.55)',
                                                                        border: '1px solid rgba(48,86,105,0.18)',
                                                                        color: COLORS.deep,
                                                                    }}
                                                                    title="Matching / Total"
                                                                >
                                                                    {bedsForRoom.length}
                                                                    <span style={{ color: 'rgba(48,86,105,0.55)' }}> / </span>
                                                                    <span className="tabular-nums" style={{ color: 'rgba(48,86,105,0.80)' }}>{allBeds.length}</span>
                                                                </div>
                                                            </div>

                                                            {/* Beds grid */}
                                                            {bedsForRoom.length === 0 ? (
                                                                <div
                                                                    className="rounded-3xl px-3 py-3 text-[12px]"
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.55)',
                                                                        border: '1px dashed rgba(48,86,105,0.20)',
                                                                        color: 'rgba(48,86,105,0.70)',
                                                                    }}
                                                                >
                                                                    No beds match the current filter in this room.
                                                                </div>
                                                            ) : (
                                                                <div className="grid gap-2 grid-cols-2">
                                                                    {bedsForRoom.map((b) => {
                                                                        const m = stateMeta(b.state)
                                                                        const isDark = normalizeState(b.state) === 'preoccupied'
                                                                        return (
                                                                            <div
                                                                                key={b.id}
                                                                                className="rounded-3xl p-3 transition hover:-translate-y-0.5"
                                                                                style={{
                                                                                    background: m.bg,
                                                                                    border: `1px solid rgba(48,86,105,0.24)`,
                                                                                    boxShadow: '0 14px 35px rgba(16,24,40,0.14)',
                                                                                    color: m.fg,
                                                                                }}
                                                                            >
                                                                                {/* code + badge */}
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <div className="truncate text-[13px] font-semibold">
                                                                                        {b.code}
                                                                                    </div>
                                                                                    <BedBadge state={b.state} />
                                                                                </div>

                                                                                {/* meta */}
                                                                                {b.reserved_until ? (
                                                                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: isDark ? 'rgba(183,229,205,0.85)' : 'rgba(48,86,105,0.78)' }}>
                                                                                        <Clock3 className="h-3.5 w-3.5" style={{ color: isDark ? 'rgba(183,229,205,0.75)' : 'rgba(48,86,105,0.55)' }} />
                                                                                        <span className="truncate" title={formatIST(b.reserved_until)}>
                                                                                            {formatIST(b.reserved_until)}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : null}

                                                                                {b.note ? (
                                                                                    <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: isDark ? 'rgba(183,229,205,0.80)' : 'rgba(48,86,105,0.72)' }}>
                                                                                        <StickyNote className="h-3.5 w-3.5" style={{ color: isDark ? 'rgba(183,229,205,0.70)' : 'rgba(48,86,105,0.55)' }} />
                                                                                        <span className="truncate" title={b.note}>{b.note}</span>
                                                                                    </div>
                                                                                ) : null}

                                                                                {/* actions */}
                                                                                <div className="mt-3 grid grid-cols-3 gap-1.5">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="h-9 rounded-2xl text-[11px] font-semibold transition hover:opacity-95"
                                                                                        style={{
                                                                                            background: 'rgba(255,255,255,0.55)',
                                                                                            border: '1px solid rgba(48,86,105,0.20)',
                                                                                            color: COLORS.deep,
                                                                                        }}
                                                                                        onClick={() => quickAction(b.id, b.code, 'reserved')}
                                                                                    >
                                                                                        Reserve
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="h-9 rounded-2xl text-[11px] font-semibold transition hover:opacity-95"
                                                                                        style={{
                                                                                            background: 'rgba(255,255,255,0.55)',
                                                                                            border: '1px solid rgba(48,86,105,0.20)',
                                                                                            color: COLORS.deep,
                                                                                        }}
                                                                                        onClick={() => quickAction(b.id, b.code, 'preoccupied')}
                                                                                    >
                                                                                        Pre
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="h-9 rounded-2xl text-[11px] font-semibold transition hover:opacity-95"
                                                                                        style={{
                                                                                            background: 'rgba(255,255,255,0.55)',
                                                                                            border: '1px solid rgba(48,86,105,0.20)',
                                                                                            color: COLORS.deep,
                                                                                        }}
                                                                                        onClick={() => quickAction(b.id, b.code, 'vacant')}
                                                                                    >
                                                                                        Vacate
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Dialog */}
            {
                dialog && (
                    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
                        <div
                            className="w-full max-w-md overflow-hidden rounded-[28px]"
                            style={{
                                background: 'rgba(255,255,255,0.78)',
                                border: '1px solid rgba(48,86,105,0.22)',
                                boxShadow: '0 24px 90px rgba(16,24,40,0.30)',
                                backdropFilter: 'blur(14px)',
                            }}
                        >
                            <div
                                className="px-4 py-3"
                                style={{ borderBottom: '1px solid rgba(48,86,105,0.14)' }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'rgba(48,86,105,0.70)' }}>
                                            Update bed state
                                        </div>
                                        <div className="mt-0.5 truncate text-[13px] font-semibold" style={{ color: COLORS.deep }}>
                                            {dialog.code} → {dialog.action}
                                        </div>
                                    </div>
                                    <BedBadge state={dialog.action} />
                                </div>
                            </div>

                            <div className="px-4 py-4 space-y-3">
                                {dialog.action === 'reserved' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(48,86,105,0.70)' }}>
                                            Reserved until
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="h-10 w-full rounded-2xl px-3 text-[12px] font-semibold outline-none"
                                            style={{
                                                background: 'rgba(255,255,255,0.70)',
                                                border: '1px solid rgba(48,86,105,0.20)',
                                                color: COLORS.deep,
                                            }}
                                            value={dialog.dt}
                                            onChange={(e) => setDialog((d) => ({ ...d, dt: e.target.value }))}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(48,86,105,0.70)' }}>
                                        Note (optional)
                                    </label>
                                    <input
                                        className="h-10 w-full rounded-2xl px-3 text-[12px] font-semibold outline-none"
                                        style={{
                                            background: 'rgba(255,255,255,0.70)',
                                            border: '1px solid rgba(48,86,105,0.20)',
                                            color: COLORS.deep,
                                        }}
                                        placeholder="Reason / patient ref / comment…"
                                        value={dialog.note}
                                        onChange={(e) => setDialog((d) => ({ ...d, note: e.target.value }))}
                                    />
                                </div>

                                {dialogErr && (
                                    <div
                                        className="flex items-start gap-2 rounded-2xl px-3 py-2 text-[12px] font-semibold"
                                        style={{
                                            background: 'rgba(193,120,90,0.18)',
                                            border: '1px solid rgba(193,120,90,0.28)',
                                            color: '#5a2c20',
                                        }}
                                    >
                                        <AlertCircle className="mt-0.5 h-4 w-4" />
                                        <span>{dialogErr}</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        className="inline-flex h-10 items-center justify-center rounded-2xl px-4 text-[12px] font-semibold transition disabled:opacity-60"
                                        style={{
                                            background: 'rgba(255,255,255,0.65)',
                                            border: '1px solid rgba(48,86,105,0.18)',
                                            color: COLORS.deep,
                                        }}
                                        onClick={() => setDialog(null)}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className="inline-flex h-10 items-center justify-center rounded-2xl px-4 text-[12px] font-semibold transition disabled:opacity-60"
                                        style={{
                                            background: COLORS.deep,
                                            color: COLORS.mint,
                                            boxShadow: '0 14px 40px rgba(16,24,40,0.22)',
                                        }}
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
                )
            }
        </div >
    )
}
