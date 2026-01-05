// FILE: src/ipd/Masters.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import PermGate from '../components/PermGate'
import {
    listWards,
    createWard,
    updateWard,
    deleteWard,
    listRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    listBeds,
    createBed,
    updateBed,
    deleteBed,
    listPackages,
    createPackage,
    updatePackage,
    deletePackage,
    listBedRates,
    createBedRate,
    updateBedRate,
    deleteBedRate,
} from '../api/ipd'

import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    AlertCircle,
    BedDouble,
    Building2,
    CalendarClock,
    CheckCircle2,
    ChevronsUpDown,
    ClipboardList,
    DoorClosed,
    Filter,
    Layers,
    Loader2,
    Pencil,
    Plus,
    RefreshCcw,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'

/* =========================================================
   Helpers
   ========================================================= */

const PREDEFINED_ROOM_TYPES = [
    'General Ward',
    'Semi-Private',
    'Private',
    'Deluxe',
    'Suite',
    'ICU',
    'HDU',
    'PICU',
    'NICU',
    'Isolation Room',
    'Day Care',
    'Observation',
    'Emergency / ER',
]

function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

function useMediaQuery(query) {
    const [ok, setOk] = useState(false)
    useEffect(() => {
        try {
            const m = window.matchMedia(query)
            const on = () => setOk(!!m.matches)
            on()
            m.addEventListener?.('change', on)
            return () => m.removeEventListener?.('change', on)
        } catch {
            // ignore
        }
    }, [query])
    return ok
}

function ErrorBanner({ message }) {
    if (!message) return null
    return (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">{message}</div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle, action }) {
    return (
        <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-6 py-10 text-center">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-black/50 bg-white/70">
                <Icon className="h-5 w-5 text-slate-700" />
            </div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            {subtitle ? <p className="mt-1 text-[12px] text-slate-600">{subtitle}</p> : null}
            {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
        </div>
    )
}

function Pill({ children }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700">
            {children}
        </span>
    )
}

function Segmented({ value, onChange, options }) {
    return (
        <div className="flex items-center gap-1.5 overflow-auto no-scrollbar rounded-full border border-black/50 bg-white/70 p-1">
            {options.map((o) => {
                const active = value === o.key
                return (
                    <button
                        key={o.key}
                        type="button"
                        onClick={() => onChange(o.key)}
                        className={cx(
                            'whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-semibold transition',
                            active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-black/[0.03]',
                        )}
                    >
                        {o.label}
                    </button>
                )
            })}
        </div>
    )
}

function confirmDelete(msg) {
    try {
        return window.confirm(msg)
    } catch {
        return true
    }
}

function normalizeDateOnly(v) {
    if (!v) return ''
    try {
        return String(v).slice(0, 10)
    } catch {
        return ''
    }
}

// room_type stored as "TYPE (Daily)" / "TYPE (Hourly)" in your earlier code
function parseRoomType(raw) {
    const txt = String(raw || '').trim()
    if (!txt) return { baseType: '', basis: 'Daily' }
    if (/\(hourly\)$/i.test(txt)) return { baseType: txt.replace(/\(hourly\)$/i, '').trim(), basis: 'Hourly' }
    if (/\(daily\)$/i.test(txt)) return { baseType: txt.replace(/\(daily\)$/i, '').trim(), basis: 'Daily' }
    return { baseType: txt, basis: 'Daily' }
}

function basisChipClass(basis) {
    const b = String(basis || '').toLowerCase()
    if (b === 'hourly') return 'border-purple-200 bg-purple-50 text-purple-800'
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
}

function stateChipClass(state) {
    const s = String(state || '').toLowerCase()
    if (s === 'vacant') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    if (s === 'occupied') return 'border-rose-200 bg-rose-50 text-rose-800'
    if (s === 'reserved') return 'border-amber-200 bg-amber-50 text-amber-900'
    if (s === 'preoccupied') return 'border-sky-200 bg-sky-50 text-sky-900'
    return 'border-slate-500 bg-slate-50 text-slate-700'
}

/* =========================================================
   Simple Modal (mobile-friendly)
   ========================================================= */

function Modal({ open, title, subtitle, onClose, children }) {
    useEffect(() => {
        if (!open) return
        const onKey = (e) => e.key === 'Escape' && onClose?.()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    className="fixed inset-0 z-[99] flex items-end justify-center bg-black/40 p-3 md:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) onClose?.()
                    }}
                >
                    <motion.div
                        className="w-full max-w-xl rounded-3xl border border-black/50 bg-white p-4 shadow-2xl md:p-5"
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 14, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{title}</div>
                                {subtitle ? <div className="mt-0.5 text-[12px] text-slate-600">{subtitle}</div> : null}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/50 bg-white hover:bg-black/[0.03]"
                                title="Close"
                            >
                                <X className="h-5 w-5 text-slate-700" />
                            </button>
                        </div>

                        <div className="mt-4">{children}</div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}

/* =========================================================
   Form inputs
   ========================================================= */

function Field({ label, children }) {
    return (
        <label className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-600">{label}</div>
            {children}
        </label>
    )
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
    return (
        <input
            type={type}
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-2xl border border-black/50 bg-white px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
    )
}

function SelectInput({ value, onChange, options, placeholder = 'Select…' }) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            className="h-11 w-full rounded-2xl border border-black/50 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        >
            <option value="">{placeholder}</option>
            {(options || []).map((o) => (
                <option key={String(o.value)} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    )
}

/* =========================================================
   Page
   ========================================================= */

const SECTIONS = [
    { key: 'layout', label: 'Wards / Rooms / Beds' },
    { key: 'rates', label: 'Bed Rates' },
    { key: 'packages', label: 'Packages' },
]

export default function Masters() {
    const [section, setSection] = useState('layout')

    return (
        <PermGate anyOf={['ipd.masters.manage', 'ipd.packages.manage']}>
            <div className="min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50">
                <div className="mx-auto max-w-7xl px-4 py-6 space-y-4 md:px-8">
                    {/* HERO */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)] overflow-hidden"
                    >
                        <div className="relative p-5 md:p-7">
                            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_60%)]" />

                            <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-start gap-3">
                                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                            <BedDouble className="h-5 w-5 text-slate-700" />
                                        </div>
                                        <div className="min-w-0">
                                            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                                IPD Masters
                                            </h1>
                                            <p className="mt-1 text-sm text-slate-600">
                                                Simple, user-friendly masters with <span className="font-semibold">mobile cards</span> and desktop tables.
                                            </p>

                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <Pill>
                                                    <Layers className="h-3.5 w-3.5" />
                                                    One screen control
                                                </Pill>
                                                <Pill>
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Cleaner actions
                                                </Pill>
                                                <Pill>
                                                    <ClipboardList className="h-3.5 w-3.5" />
                                                    Works on all devices
                                                </Pill>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 md:justify-end">
                                    <Segmented value={section} onChange={setSection} options={SECTIONS} />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {section === 'layout' ? <SectionLayoutExplorer /> : null}
                    {section === 'rates' ? <SectionBedRates /> : null}
                    {section === 'packages' ? <SectionPackages /> : null}
                </div>
            </div>
        </PermGate>
    )
}

/* =========================================================
   1) Layout Explorer (Wards / Rooms / Beds)
   - Desktop: 3 columns (wards list + rooms table + beds table)
   - Mobile: select ward + select room + bed cards
   ========================================================= */

function SectionLayoutExplorer() {
    const isDesktop = useMediaQuery('(min-width: 1024px)')

    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])

    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState('')

    const [wardQ, setWardQ] = useState('')
    const [roomQ, setRoomQ] = useState('')
    const [bedQ, setBedQ] = useState('')
    const [bedState, setBedState] = useState('all')

    const [wardId, setWardId] = useState('')
    const [roomId, setRoomId] = useState('')

    // modal state
    const [modal, setModal] = useState(null) // {entity, mode, row, defaults}
    const aliveRef = useRef(true)

    const load = useCallback(async ({ silent = false } = {}) => {
        silent ? setSyncing(true) : setLoading(true)
        setError('')
        try {
            const [w, r, b] = await Promise.all([listWards(), listRooms(), listBeds()])
            if (!aliveRef.current) return
            setWards(w.data || [])
            setRooms(r.data || [])
            setBeds(b.data || [])
        } catch (e) {
            if (!aliveRef.current) return
            setError(e?.response?.data?.detail || 'Failed to load masters.')
            setWards([])
            setRooms([])
            setBeds([])
        } finally {
            if (!aliveRef.current) return
            setLoading(false)
            setSyncing(false)
        }
    }, [])

    useEffect(() => {
        aliveRef.current = true
        load()
        return () => {
            aliveRef.current = false
        }
    }, [load])

    // derived lists
    const filteredWards = useMemo(() => {
        const q = wardQ.trim().toLowerCase()
        let list = wards || []
        if (!q) return list
        return list.filter((w) => {
            return (
                String(w.code || '').toLowerCase().includes(q) ||
                String(w.name || '').toLowerCase().includes(q) ||
                String(w.floor || '').toLowerCase().includes(q)
            )
        })
    }, [wards, wardQ])

    const roomsForWard = useMemo(() => {
        const wid = wardId ? Number(wardId) : null
        if (!wid) return []
        return (rooms || []).filter((r) => r.ward_id === wid)
    }, [rooms, wardId])

    const filteredRooms = useMemo(() => {
        const q = roomQ.trim().toLowerCase()
        let list = roomsForWard
        if (!q) return list
        return list.filter((r) => String(r.number || '').toLowerCase().includes(q) || String(r.type || '').toLowerCase().includes(q))
    }, [roomsForWard, roomQ])

    // auto room select on ward change
    useEffect(() => {
        if (!wardId) {
            setRoomId('')
            return
        }
        const rid = roomId ? Number(roomId) : null
        const ok = rid && filteredRooms.some((r) => r.id === rid)
        if (ok) return
        setRoomId(filteredRooms[0]?.id ? String(filteredRooms[0].id) : '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wardId, rooms])

    const bedsForRoom = useMemo(() => {
        const rid = roomId ? Number(roomId) : null
        if (!rid) return []
        return (beds || []).filter((b) => b.room_id === rid)
    }, [beds, roomId])

    const filteredBeds = useMemo(() => {
        const q = bedQ.trim().toLowerCase()
        let list = bedsForRoom
        if (bedState !== 'all') {
            list = list.filter((b) => String(b.state || '').toLowerCase() === bedState)
        }
        if (!q) return list
        return list.filter((b) => String(b.code || '').toLowerCase().includes(q))
    }, [bedsForRoom, bedQ, bedState])

    const wardOptions = useMemo(
        () => (wards || []).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
        [wards],
    )

    const roomOptions = useMemo(() => {
        const wid = wardId ? Number(wardId) : null
        const list = wid ? roomsForWard : (rooms || [])
        return (list || []).map((r) => ({ value: r.id, label: `Room ${r.number}${r.type ? ` • ${r.type}` : ''}` }))
    }, [roomsForWard, rooms, wardId])

    const openCreate = (entity, defaults) => setModal({ entity, mode: 'create', row: null, defaults: defaults || null })
    const openEdit = (entity, row) => setModal({ entity, mode: 'edit', row, defaults: null })
    const closeModal = () => setModal(null)

    const onDelete = async (entity, row) => {
        const label =
            entity === 'ward'
                ? 'Delete ward? (Possible only if no rooms exist)'
                : entity === 'room'
                    ? 'Delete room? (Possible only if no beds exist)'
                    : 'Delete bed?'
        if (!confirmDelete(label)) return

        try {
            if (entity === 'ward') await deleteWard(row.id)
            if (entity === 'room') await deleteRoom(row.id)
            if (entity === 'bed') await deleteBed(row.id)
            toast.success('Deleted')
            await load({ silent: true })
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <>
            <Card className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)] overflow-hidden">
                <CardHeader className="border-b border-black/50 bg-white/60">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                Ward / Room / Bed Masters
                            </CardTitle>
                            <CardDescription className="text-[12px] text-slate-600">
                                Desktop shows tables. Mobile converts everything into easy cards + pickers.
                            </CardDescription>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    className="h-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                    onClick={() => openCreate('ward')}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Ward
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/50 bg-white"
                                    onClick={() => {
                                        if (!wardId) return toast.error('Select a ward first')
                                        openCreate('room', { ward_id: Number(wardId) })
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Room
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/50 bg-white"
                                    onClick={() => {
                                        if (!roomId) return toast.error('Select a room first')
                                        openCreate('bed', { room_id: Number(roomId) })
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Bed
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/50 bg-white"
                                    onClick={() => load({ silent: true })}
                                    disabled={loading || syncing}
                                >
                                    <RefreshCcw className={cx('mr-2 h-4 w-4', (loading || syncing) && 'animate-spin')} />
                                    Refresh
                                </Button>

                                {(loading || syncing) && (
                                    <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        Syncing…
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2 md:min-w-[320px]">
                            <ErrorBanner message={error} />

                            {/* context + quick pickers */}
                            <div className="rounded-2xl border border-black/50 bg-white p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Current selection
                                    </div>
                                    <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                        <Building2 className="mr-1 h-3.5 w-3.5" />
                                        {wardId ? 'Ward selected' : 'No ward'}
                                    </Badge>
                                </div>

                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                    <div>
                                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Ward</div>
                                        <select
                                            value={wardId}
                                            onChange={(e) => setWardId(e.target.value)}
                                            className="h-10 w-full rounded-2xl border border-black/50 bg-white px-3 text-[12px] font-semibold"
                                        >
                                            <option value="">Select ward…</option>
                                            {wardOptions.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Room</div>
                                        <select
                                            value={roomId}
                                            onChange={(e) => setRoomId(e.target.value)}
                                            className="h-10 w-full rounded-2xl border border-black/50 bg-white px-3 text-[12px] font-semibold"
                                            disabled={!wardId}
                                        >
                                            <option value="">{wardId ? 'Select room…' : 'Select ward first'}</option>
                                            {roomOptions.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="my-4 bg-black/10" />

                    {/* filters row */}
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                value={wardQ}
                                onChange={(e) => setWardQ(e.target.value)}
                                placeholder="Search ward…"
                                className="h-11 rounded-2xl border-black/50 bg-white pl-10 text-[12px] font-semibold"
                            />
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                value={roomQ}
                                onChange={(e) => setRoomQ(e.target.value)}
                                placeholder="Search room…"
                                className="h-11 rounded-2xl border-black/50 bg-white pl-10 text-[12px] font-semibold"
                                disabled={!wardId}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    value={bedQ}
                                    onChange={(e) => setBedQ(e.target.value)}
                                    placeholder="Search bed code…"
                                    className="h-11 rounded-2xl border-black/50 bg-white pl-10 text-[12px] font-semibold"
                                    disabled={!roomId}
                                />
                            </div>

                            <select
                                value={bedState}
                                onChange={(e) => setBedState(e.target.value)}
                                className="h-11 rounded-2xl border border-black/50 bg-white px-3 text-[12px] font-semibold"
                                disabled={!roomId}
                                title="Bed state filter"
                            >
                                <option value="all">All</option>
                                <option value="vacant">Vacant</option>
                                <option value="occupied">Occupied</option>
                                <option value="reserved">Reserved</option>
                                <option value="preoccupied">Preoccupied</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-4">
                    {loading && (
                        <div className="grid gap-3 lg:grid-cols-3">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="rounded-3xl border border-black/50 bg-white/70 p-4">
                                    <Skeleton className="h-4 w-44 rounded-xl" />
                                    <Skeleton className="mt-2 h-3 w-72 rounded-xl" />
                                    <Skeleton className="mt-4 h-10 w-full rounded-2xl" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && (
                        <>
                            {/* MOBILE: card-first layout */}
                            {!isDesktop ? (
                                <div className="space-y-4">
                                    <div className="rounded-3xl border border-black/50 bg-white/80 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold text-slate-900">Wards</div>
                                            <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                                {filteredWards.length}
                                            </Badge>
                                        </div>

                                        <div className="mt-3 space-y-2">
                                            {filteredWards.map((w) => {
                                                const active = Number(wardId || 0) === w.id
                                                return (
                                                    <button
                                                        key={w.id}
                                                        type="button"
                                                        onClick={() => setWardId(String(w.id))}
                                                        className={cx(
                                                            'w-full rounded-3xl border p-4 text-left transition',
                                                            active ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/20 bg-white hover:bg-black/[0.02]',
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold truncate">
                                                                    {w.code || '—'} — {w.name || 'Unnamed'}
                                                                </div>
                                                                <div className={cx('mt-1 text-[12px] truncate', active ? 'text-white/80' : 'text-slate-600')}>
                                                                    {w.floor ? `Floor: ${w.floor}` : 'No floor set'}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant={active ? 'secondary' : 'outline'}
                                                                    className={cx('h-9 rounded-2xl', active ? 'border-white/20 bg-white/10 text-white' : 'border-black/50')}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openEdit('ward', w)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className={cx('h-9 rounded-2xl border-black/50', active ? 'border-white/20 bg-white/10 text-white' : '')}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        onDelete('ward', w)
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })}

                                            {!filteredWards.length && (
                                                <EmptyState
                                                    icon={Building2}
                                                    title="No wards found"
                                                    subtitle="Try clearing the search or create a new ward."
                                                    action={
                                                        <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => openCreate('ward')}>
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            New Ward
                                                        </Button>
                                                    }
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-black/50 bg-white/80 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold text-slate-900">Rooms</div>
                                            <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                                {filteredRooms.length}
                                            </Badge>
                                        </div>

                                        {!wardId ? (
                                            <div className="mt-3 text-[12px] text-slate-600">Select a ward to see rooms.</div>
                                        ) : (
                                            <div className="mt-3 space-y-2">
                                                {filteredRooms.map((r) => {
                                                    const active = Number(roomId || 0) === r.id
                                                    return (
                                                        <button
                                                            key={r.id}
                                                            type="button"
                                                            onClick={() => setRoomId(String(r.id))}
                                                            className={cx(
                                                                'w-full rounded-3xl border p-4 text-left transition',
                                                                active ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/20 bg-white hover:bg-black/[0.02]',
                                                            )}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-semibold">
                                                                        Room {r.number}
                                                                    </div>
                                                                    <div className={cx('mt-1 text-[12px] truncate', active ? 'text-white/80' : 'text-slate-600')}>
                                                                        {r.type || 'No type set'}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={active ? 'secondary' : 'outline'}
                                                                        className={cx('h-9 rounded-2xl', active ? 'border-white/20 bg-white/10 text-white' : 'border-black/50')}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            openEdit('room', r)
                                                                        }}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className={cx('h-9 rounded-2xl border-black/50', active ? 'border-white/20 bg-white/10 text-white' : '')}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            onDelete('room', r)
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    )
                                                })}

                                                {!filteredRooms.length && (
                                                    <EmptyState
                                                        icon={DoorClosed}
                                                        title="No rooms found"
                                                        subtitle="Create a room under the selected ward."
                                                        action={
                                                            <Button
                                                                className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                                                onClick={() => openCreate('room', { ward_id: Number(wardId) })}
                                                            >
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                New Room
                                                            </Button>
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-3xl border border-black/50 bg-white/80 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold text-slate-900">Beds</div>
                                            <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                                {filteredBeds.length}
                                            </Badge>
                                        </div>

                                        {!roomId ? (
                                            <div className="mt-3 text-[12px] text-slate-600">Select a room to see beds.</div>
                                        ) : (
                                            <div className="mt-3 space-y-2">
                                                {filteredBeds.map((b) => (
                                                    <div key={b.id} className="rounded-3xl border border-black/20 bg-white p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold text-slate-900">{b.code}</div>
                                                                <div className="mt-2">
                                                                    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize', stateChipClass(b.state))}>
                                                                        {b.state || 'unknown'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-9 rounded-2xl border-black/50"
                                                                    onClick={() => openEdit('bed', b)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-9 rounded-2xl border-black/50"
                                                                    onClick={() => onDelete('bed', b)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {!filteredBeds.length && (
                                                    <EmptyState
                                                        icon={BedDouble}
                                                        title="No beds found"
                                                        subtitle="Create beds under the selected room."
                                                        action={
                                                            <Button
                                                                className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                                                onClick={() => openCreate('bed', { room_id: Number(roomId) })}
                                                            >
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                New Bed
                                                            </Button>
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* DESKTOP: simple 3-area layout */
                                <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
                                    {/* Left: wards list */}
                                    <div className="rounded-3xl border border-black/50 bg-white/70 overflow-hidden">
                                        <div className="border-b border-black/10 bg-white/70 p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-semibold text-slate-900">Wards</div>
                                                <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                                    {filteredWards.length}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="max-h-[560px] overflow-auto p-2 space-y-2">
                                            {filteredWards.map((w) => {
                                                const active = Number(wardId || 0) === w.id
                                                return (
                                                    <div
                                                        key={w.id}
                                                        className={cx(
                                                            'rounded-3xl border p-3',
                                                            active ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/20 bg-white hover:bg-black/[0.02]',
                                                        )}
                                                    >
                                                        <button type="button" onClick={() => setWardId(String(w.id))} className="w-full text-left">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold">
                                                                        {w.code || '—'} — {w.name || 'Unnamed'}
                                                                    </div>
                                                                    <div className={cx('mt-1 truncate text-[12px]', active ? 'text-white/80' : 'text-slate-600')}>
                                                                        {w.floor ? `Floor: ${w.floor}` : 'No floor set'}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className={cx('h-9 rounded-2xl', active ? 'border-white/20 bg-white/10 text-white' : 'border-black/50')}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            openEdit('ward', w)
                                                                        }}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className={cx('h-9 rounded-2xl', active ? 'border-white/20 bg-white/10 text-white' : 'border-black/50')}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            onDelete('ward', w)
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                )
                                            })}

                                            {!filteredWards.length && (
                                                <div className="p-3">
                                                    <EmptyState
                                                        icon={Building2}
                                                        title="No wards found"
                                                        subtitle="Create a ward to begin."
                                                        action={
                                                            <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => openCreate('ward')}>
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                New Ward
                                                            </Button>
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: rooms + beds */}
                                    <div className="space-y-4">
                                        {/* Rooms table */}
                                        <div className="rounded-3xl border border-black/50 bg-white/70 overflow-hidden">
                                            <div className="border-b border-black/10 bg-white/70 p-3 flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900">Rooms</div>
                                                    <div className="text-[12px] text-slate-600">
                                                        {wardId ? `Ward ${wardId} rooms` : 'Select a ward'}
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                                    {filteredRooms.length}
                                                </Badge>
                                            </div>

                                            {!wardId ? (
                                                <div className="p-4 text-[12px] text-slate-600">Select a ward to view rooms.</div>
                                            ) : filteredRooms.length === 0 ? (
                                                <div className="p-4">
                                                    <EmptyState
                                                        icon={DoorClosed}
                                                        title="No rooms"
                                                        subtitle="Create a room under the selected ward."
                                                        action={
                                                            <Button
                                                                className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                                                onClick={() => openCreate('room', { ward_id: Number(wardId) })}
                                                            >
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                New Room
                                                            </Button>
                                                        }
                                                    />
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-white/70 text-[11px] uppercase tracking-wide text-slate-500">
                                                                <th className="px-4 py-3 text-left font-semibold">Room</th>
                                                                <th className="px-4 py-3 text-left font-semibold">Type</th>
                                                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredRooms.map((r) => {
                                                                const active = Number(roomId || 0) === r.id
                                                                return (
                                                                    <tr key={r.id} className={cx('border-t border-black/5', active ? 'bg-black/[0.02]' : 'hover:bg-black/[0.02]')}>
                                                                        <td className="px-4 py-3">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setRoomId(String(r.id))}
                                                                                className="inline-flex items-center gap-2 font-semibold text-slate-900 hover:underline underline-offset-2"
                                                                            >
                                                                                Room {r.number}
                                                                                {active ? (
                                                                                    <Badge className="rounded-full bg-slate-900 text-white text-[10px]">Selected</Badge>
                                                                                ) : null}
                                                                            </button>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-slate-700">{r.type || '—'}</td>
                                                                        <td className="px-4 py-3 text-right">
                                                                            <div className="inline-flex items-center justify-end gap-2">
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-9 rounded-2xl border-black/50"
                                                                                    onClick={() => openEdit('room', r)}
                                                                                >
                                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                                    Edit
                                                                                </Button>
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-9 rounded-2xl border-black/50"
                                                                                    onClick={() => onDelete('room', r)}
                                                                                >
                                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                                    Delete
                                                                                </Button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* Beds table */}
                                        <div className="rounded-3xl border border-black/50 bg-white/70 overflow-hidden">
                                            <div className="border-b border-black/10 bg-white/70 p-3 flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900">Beds</div>
                                                    <div className="text-[12px] text-slate-600">{roomId ? `Room ${roomId} beds` : 'Select a room'}</div>
                                                </div>
                                                <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                                    {filteredBeds.length}
                                                </Badge>
                                            </div>

                                            {!roomId ? (
                                                <div className="p-4 text-[12px] text-slate-600">Select a room to view beds.</div>
                                            ) : filteredBeds.length === 0 ? (
                                                <div className="p-4">
                                                    <EmptyState
                                                        icon={BedDouble}
                                                        title="No beds"
                                                        subtitle="Create beds under the selected room."
                                                        action={
                                                            <Button
                                                                className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                                                onClick={() => openCreate('bed', { room_id: Number(roomId) })}
                                                            >
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                New Bed
                                                            </Button>
                                                        }
                                                    />
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-white/70 text-[11px] uppercase tracking-wide text-slate-500">
                                                                <th className="px-4 py-3 text-left font-semibold">Bed code</th>
                                                                <th className="px-4 py-3 text-left font-semibold">State</th>
                                                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredBeds.map((b) => (
                                                                <tr key={b.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                                                                    <td className="px-4 py-3 font-semibold text-slate-900">{b.code}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize', stateChipClass(b.state))}>
                                                                            {b.state || 'unknown'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="inline-flex items-center justify-end gap-2">
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-9 rounded-2xl border-black/50"
                                                                                onClick={() => openEdit('bed', b)}
                                                                            >
                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                Edit
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-9 rounded-2xl border-black/50"
                                                                                onClick={() => onDelete('bed', b)}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </Button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit modal */}
            <EntityModal
                open={!!modal}
                modal={modal}
                onClose={closeModal}
                wardOptions={wardOptions}
                roomOptions={roomOptions}
                onSaved={async () => {
                    closeModal()
                    await load({ silent: true })
                }}
            />
        </>
    )
}

function EntityModal({ open, modal, onClose, wardOptions, roomOptions, onSaved }) {
    const entity = modal?.entity
    const mode = modal?.mode
    const row = modal?.row
    const defaults = modal?.defaults ?? null
    const defaultsWardId = defaults?.ward_id ?? ''
    const defaultsRoomId = defaults?.room_id ?? ''


    const title =
        mode === 'create'
            ? entity === 'ward'
                ? 'New Ward'
                : entity === 'room'
                    ? 'New Room'
                    : 'New Bed'
            : entity === 'ward'
                ? 'Edit Ward'
                : entity === 'room'
                    ? 'Edit Room'
                    : 'Edit Bed'

    const subtitle =
        entity === 'ward'
            ? 'Ward code, name and floor.'
            : entity === 'room'
                ? 'Room number, type and ward mapping.'
                : 'Bed code and room mapping.'

    const [v, setV] = useState({})
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        setErr('')

        if (entity === 'ward') {
            setV({
                code: mode === 'edit' ? row?.code || '' : '',
                name: mode === 'edit' ? row?.name || '' : '',
                floor: mode === 'edit' ? row?.floor || '' : '',
            })
            return
        }

        if (entity === 'room') {
            setV({
                ward_id: mode === 'edit' ? String(row?.ward_id ?? '') : String(defaultsWardId ?? ''),
                number: mode === 'edit' ? row?.number || '' : '',
                type: mode === 'edit' ? row?.type || '' : '',
            })
            return
        }

        if (entity === 'bed') {
            setV({
                room_id: mode === 'edit' ? String(row?.room_id ?? '') : String(defaultsRoomId ?? ''),
                code: mode === 'edit' ? row?.code || '' : '',
            })
        }
    }, [open, entity, mode, row, defaultsWardId, defaultsRoomId])


    const roomTypeOptions = useMemo(() => {
        const set = new Set(PREDEFINED_ROOM_TYPES)
        return Array.from(set).map((t) => ({ value: t, label: t }))
    }, [])

    const save = async () => {
        setErr('')

        try {
            if (entity === 'ward') {
                if (!String(v.code || '').trim()) return setErr('Ward code required.')
                if (!String(v.name || '').trim()) return setErr('Ward name required.')

                const payload = {
                    code: String(v.code).trim(),
                    name: String(v.name).trim(),
                    floor: String(v.floor || '').trim() || undefined,
                }

                setSaving(true)
                if (mode === 'create') await createWard(payload)
                else await updateWard(row.id, payload)
            }

            if (entity === 'room') {
                if (!String(v.ward_id || '').trim()) return setErr('Select ward.')
                if (!String(v.number || '').trim()) return setErr('Room number required.')

                const payload = {
                    ward_id: Number(v.ward_id),
                    number: String(v.number).trim(),
                    type: String(v.type || '').trim() || undefined,
                }

                setSaving(true)
                if (mode === 'create') await createRoom(payload)
                else await updateRoom(row.id, payload)
            }

            if (entity === 'bed') {
                if (!String(v.room_id || '').trim()) return setErr('Select room.')
                if (!String(v.code || '').trim()) return setErr('Bed code required.')

                const payload = {
                    room_id: Number(v.room_id),
                    code: String(v.code).trim(),
                }

                setSaving(true)
                if (mode === 'create') await createBed(payload)
                else await updateBed(row.id, payload)
            }

            toast.success(mode === 'create' ? 'Created' : 'Updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal open={open} title={title} subtitle={subtitle} onClose={saving ? undefined : onClose}>
            <div className="space-y-4">
                {entity === 'ward' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Ward code">
                            <TextInput value={v.code} onChange={(x) => setV((p) => ({ ...p, code: x }))} placeholder="e.g. W1" />
                        </Field>
                        <Field label="Floor / Level">
                            <TextInput value={v.floor} onChange={(x) => setV((p) => ({ ...p, floor: x }))} placeholder="e.g. 1st Floor" />
                        </Field>
                        <div className="md:col-span-2">
                            <Field label="Ward name">
                                <TextInput value={v.name} onChange={(x) => setV((p) => ({ ...p, name: x }))} placeholder="e.g. General Ward" />
                            </Field>
                        </div>
                    </div>
                ) : null}

                {entity === 'room' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Ward">
                            <SelectInput value={v.ward_id} onChange={(x) => setV((p) => ({ ...p, ward_id: x }))} options={wardOptions} placeholder="Select ward…" />
                        </Field>
                        <Field label="Room number">
                            <TextInput value={v.number} onChange={(x) => setV((p) => ({ ...p, number: x }))} placeholder="e.g. 101" />
                        </Field>
                        <div className="md:col-span-2">
                            <Field label="Room type (optional)">
                                <SelectInput value={v.type} onChange={(x) => setV((p) => ({ ...p, type: x }))} options={roomTypeOptions} placeholder="Select type…" />
                            </Field>
                        </div>
                    </div>
                ) : null}

                {entity === 'bed' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Room">
                            <SelectInput value={v.room_id} onChange={(x) => setV((p) => ({ ...p, room_id: x }))} options={roomOptions} placeholder="Select room…" />
                        </Field>
                        <Field label="Bed code">
                            <TextInput value={v.code} onChange={(x) => setV((p) => ({ ...p, code: x }))} placeholder="e.g. W1-R101-B01" />
                        </Field>
                    </div>
                ) : null}

                {err ? <ErrorBanner message={err} /> : null}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" className="h-11 rounded-2xl border-black/50" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" className="h-11 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

/* =========================================================
   2) Bed Rates (mobile cards + desktop table)
   ========================================================= */

function SectionBedRates() {
    const isDesktop = useMediaQuery('(min-width: 768px)')

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState('')

    const [q, setQ] = useState('')
    const [basis, setBasis] = useState('all')

    const [modal, setModal] = useState(null) // {mode,row}
    const aliveRef = useRef(true)

    const load = useCallback(async ({ silent = false } = {}) => {
        silent ? setSyncing(true) : setLoading(true)
        setError('')
        try {
            const { data } = await listBedRates()
            if (!aliveRef.current) return
            setRows(data || [])
        } catch (e) {
            if (!aliveRef.current) return
            setError(e?.response?.data?.detail || 'Failed to load bed rates.')
            setRows([])
        } finally {
            if (!aliveRef.current) return
            setLoading(false)
            setSyncing(false)
        }
    }, [])

    useEffect(() => {
        aliveRef.current = true
        load()
        return () => {
            aliveRef.current = false
        }
    }, [load])

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase()
        let list = rows || []

        if (basis !== 'all') {
            list = list.filter((r) => {
                const p = parseRoomType(r.room_type)
                return String(p.basis).toLowerCase() === basis
            })
        }

        if (!qq) return list
        return list.filter((r) => {
            const rt = String(r.room_type || '').toLowerCase()
            const amt = String(r.daily_rate ?? '').toLowerCase()
            return rt.includes(qq) || amt.includes(qq)
        })
    }, [rows, q, basis])

    const remove = async (row) => {
        if (!confirmDelete('Delete this bed rate?')) return
        try {
            await deleteBedRate(row.id)
            toast.success('Deleted')
            await load({ silent: true })
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <>
            <Card className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)] overflow-hidden">
                <CardHeader className="border-b border-black/50 bg-white/60">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <CardTitle className="text-base md:text-lg font-semibold text-slate-900">Bed Rates</CardTitle>
                            <CardDescription className="text-[12px] text-slate-600">
                                Daily/Hourly tariffs. Mobile shows cards.
                            </CardDescription>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button className="h-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setModal({ mode: 'create', row: null })}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Rate
                                </Button>

                                <Button
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/50 bg-white"
                                    onClick={() => load({ silent: true })}
                                    disabled={loading || syncing}
                                >
                                    <RefreshCcw className={cx('mr-2 h-4 w-4', (loading || syncing) && 'animate-spin')} />
                                    Refresh
                                </Button>

                                {(loading || syncing) && (
                                    <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        Syncing…
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2 md:min-w-[360px]">
                            <ErrorBanner message={error} />

                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search room type / amount…"
                                        className="h-11 rounded-2xl border-black/50 bg-white pl-10 text-[12px] font-semibold"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-slate-500" />
                                    <select
                                        value={basis}
                                        onChange={(e) => setBasis(e.target.value)}
                                        className="h-11 rounded-2xl border border-black/50 bg-white px-3 text-[12px] font-semibold"
                                    >
                                        <option value="all">All</option>
                                        <option value="daily">Daily</option>
                                        <option value="hourly">Hourly</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-4">
                    {loading ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="rounded-3xl border border-black/50 bg-white/70 px-4 py-3">
                                    <Skeleton className="h-4 w-44 rounded-xl" />
                                    <Skeleton className="mt-2 h-3 w-72 rounded-xl" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState
                            icon={CalendarClock}
                            title="No bed rates found"
                            subtitle="Create a bed rate to enable IPD billing resolution."
                            action={
                                <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setModal({ mode: 'create', row: null })}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Rate
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            {/* Desktop table */}
                            {isDesktop ? (
                                <div className="overflow-x-auto rounded-3xl border border-black/50 bg-white/70">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-white/70 text-[11px] uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3 text-left font-semibold">Room type</th>
                                                <th className="px-4 py-3 text-left font-semibold">Basis</th>
                                                <th className="px-4 py-3 text-left font-semibold">Rate</th>
                                                <th className="px-4 py-3 text-left font-semibold">Effective</th>
                                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((r) => {
                                                const p = parseRoomType(r.room_type)
                                                return (
                                                    <tr key={r.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                                                        <td className="px-4 py-3 font-semibold text-slate-900">{p.baseType || r.room_type || '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', basisChipClass(p.basis))}>
                                                                {p.basis}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold text-slate-900">₹ {r.daily_rate ?? '—'}</td>
                                                        <td className="px-4 py-3 text-[12px] text-slate-700">
                                                            {normalizeDateOnly(r.effective_from) || '—'}
                                                            {r.effective_to ? ` → ${normalizeDateOnly(r.effective_to)}` : ''}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="inline-flex items-center justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-9 rounded-2xl border-black/50"
                                                                    onClick={() => setModal({ mode: 'edit', row: r })}
                                                                >
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-9 rounded-2xl border-black/50"
                                                                    onClick={() => remove(r)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* Mobile cards */
                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {filtered.map((r) => {
                                            const p = parseRoomType(r.room_type)
                                            return (
                                                <motion.div
                                                    key={r.id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    transition={{ duration: 0.14 }}
                                                    className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-semibold text-slate-900 truncate">{p.baseType || r.room_type || '—'}</div>
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', basisChipClass(p.basis))}>
                                                                    {p.basis}
                                                                </span>
                                                                <span className="inline-flex items-center rounded-full border border-black/50 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-800">
                                                                    ₹ {r.daily_rate ?? '—'}
                                                                </span>
                                                            </div>

                                                            <div className="mt-2 text-[12px] text-slate-700">
                                                                Effective: <span className="font-semibold">{normalizeDateOnly(r.effective_from) || '—'}</span>
                                                                {r.effective_to ? <span> → <span className="font-semibold">{normalizeDateOnly(r.effective_to)}</span></span> : null}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-2">
                                                            <Button size="sm" className="h-9 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setModal({ mode: 'edit', row: r })}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-9 rounded-2xl border-black/50" onClick={() => remove(r)}>
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <BedRateModal
                open={!!modal}
                modal={modal}
                onClose={() => setModal(null)}
                onSaved={async () => {
                    setModal(null)
                    await load({ silent: true })
                }}
            />
        </>
    )
}

function BedRateModal({ open, modal, onClose, onSaved }) {
    const mode = modal?.mode
    const row = modal?.row
    const parsed = useMemo(() => parseRoomType(row?.room_type), [row])

    const [v, setV] = useState({
        baseType: '',
        basis: 'daily',
        amount: '',
        effective_from: '',
        effective_to: '',
        is_active: true,
    })
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        setErr('')
        if (mode === 'edit' && row) {
            setV({
                baseType: parsed.baseType || '',
                basis: String(parsed.basis || 'Daily').toLowerCase() === 'hourly' ? 'hourly' : 'daily',
                amount: row.daily_rate ?? '',
                effective_from: normalizeDateOnly(row.effective_from),
                effective_to: normalizeDateOnly(row.effective_to),
                is_active: row.is_active ?? true,
            })
        } else {
            setV({ baseType: '', basis: 'daily', amount: '', effective_from: '', effective_to: '', is_active: true })
        }
    }, [open, mode, row, parsed])

    const save = async () => {
        setErr('')
        if (!String(v.baseType || '').trim()) return setErr('Room type required.')
        if (!v.amount || Number(v.amount) <= 0) return setErr('Rate must be > 0.')
        if (!v.effective_from) return setErr('Effective from required.')

        const basisLabel = v.basis === 'hourly' ? 'Hourly' : 'Daily'
        const room_type = `${String(v.baseType).trim()} (${basisLabel})`

        const payload = {
            room_type,
            daily_rate: Number(v.amount),
            effective_from: v.effective_from,
            effective_to: v.effective_to || undefined,
            is_active: !!v.is_active,
        }

        setSaving(true)
        try {
            if (mode === 'create') await createBedRate(payload)
            else await updateBedRate(row.id, payload)

            toast.success(mode === 'create' ? 'Created' : 'Updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            open={open}
            title={mode === 'create' ? 'New Bed Rate' : 'Edit Bed Rate'}
            subtitle="Daily / Hourly tariff mapping for billing."
            onClose={() => (saving ? null : onClose?.())}
        >
            <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Room type">
                        <TextInput value={v.baseType} onChange={(x) => setV((p) => ({ ...p, baseType: x }))} placeholder="e.g. ICU" />
                    </Field>

                    <Field label="Basis">
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={v.basis === 'daily' ? 'default' : 'outline'}
                                className={cx('h-11 w-full rounded-2xl', v.basis === 'daily' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border-black/50')}
                                onClick={() => setV((p) => ({ ...p, basis: 'daily' }))}
                            >
                                Daily
                            </Button>
                            <Button
                                type="button"
                                variant={v.basis === 'hourly' ? 'default' : 'outline'}
                                className={cx('h-11 w-full rounded-2xl', v.basis === 'hourly' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border-black/50')}
                                onClick={() => setV((p) => ({ ...p, basis: 'hourly' }))}
                            >
                                Hourly
                            </Button>
                        </div>
                    </Field>

                    <Field label="Rate (₹)">
                        <TextInput type="number" value={v.amount} onChange={(x) => setV((p) => ({ ...p, amount: x }))} placeholder="e.g. 2500" />
                    </Field>

                    <Field label="Active">
                        <div className="flex items-center gap-2 rounded-2xl border border-black/50 bg-white px-3 h-11">
                            <input
                                type="checkbox"
                                checked={!!v.is_active}
                                onChange={(e) => setV((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                            <span className="text-sm font-semibold text-slate-800">Enabled</span>
                        </div>
                    </Field>

                    <Field label="Effective from">
                        <TextInput type="date" value={v.effective_from} onChange={(x) => setV((p) => ({ ...p, effective_from: x }))} />
                    </Field>

                    <Field label="Effective to (optional)">
                        <TextInput type="date" value={v.effective_to} onChange={(x) => setV((p) => ({ ...p, effective_to: x }))} />
                    </Field>
                </div>

                {err ? <ErrorBanner message={err} /> : null}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" className="h-11 rounded-2xl border-black/50" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" className="h-11 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

/* =========================================================
   3) Packages (mobile cards + desktop table)
   ========================================================= */

function SectionPackages() {
    const isDesktop = useMediaQuery('(min-width: 768px)')

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState('')

    const [q, setQ] = useState('')
    const [modal, setModal] = useState(null) // {mode,row}

    const aliveRef = useRef(true)

    const load = useCallback(async ({ silent = false } = {}) => {
        silent ? setSyncing(true) : setLoading(true)
        setError('')
        try {
            const { data } = await listPackages()
            if (!aliveRef.current) return
            setRows(data || [])
        } catch (e) {
            if (!aliveRef.current) return
            setError(e?.response?.data?.detail || 'Failed to load packages.')
            setRows([])
        } finally {
            if (!aliveRef.current) return
            setLoading(false)
            setSyncing(false)
        }
    }, [])

    useEffect(() => {
        aliveRef.current = true
        load()
        return () => {
            aliveRef.current = false
        }
    }, [load])

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase()
        if (!qq) return rows || []
        return (rows || []).filter((p) => String(p.name || '').toLowerCase().includes(qq))
    }, [rows, q])

    const remove = async (row) => {
        if (!confirmDelete('Delete this package?')) return
        try {
            await deletePackage(row.id)
            toast.success('Deleted')
            await load({ silent: true })
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <>
            <Card className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)] overflow-hidden">
                <CardHeader className="border-b border-black/50 bg-white/60">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <CardTitle className="text-base md:text-lg font-semibold text-slate-900">IPD Packages</CardTitle>
                            <CardDescription className="text-[12px] text-slate-600">
                                Create packages like LSCS / Delivery with inclusions & exclusions.
                            </CardDescription>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button className="h-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setModal({ mode: 'create', row: null })}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Package
                                </Button>

                                <Button
                                    variant="outline"
                                    className="h-10 rounded-2xl border-black/50 bg-white"
                                    onClick={() => load({ silent: true })}
                                    disabled={loading || syncing}
                                >
                                    <RefreshCcw className={cx('mr-2 h-4 w-4', (loading || syncing) && 'animate-spin')} />
                                    Refresh
                                </Button>

                                {(loading || syncing) && (
                                    <Badge variant="outline" className="rounded-full border-black/50 bg-white/80 text-[11px]">
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        Syncing…
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2 md:min-w-[360px]">
                            <ErrorBanner message={error} />

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search package name…"
                                    className="h-11 rounded-2xl border-black/50 bg-white pl-10 text-[12px] font-semibold"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-4">
                    {loading ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="rounded-3xl border border-black/50 bg-white/70 px-4 py-3">
                                    <Skeleton className="h-4 w-44 rounded-xl" />
                                    <Skeleton className="mt-2 h-3 w-72 rounded-xl" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState
                            icon={Layers}
                            title="No packages found"
                            subtitle="Create your first IPD package."
                            action={
                                <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setModal({ mode: 'create', row: null })}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Package
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            {isDesktop ? (
                                <div className="overflow-x-auto rounded-3xl border border-black/50 bg-white/70">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-white/70 text-[11px] uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3 text-left font-semibold">Name</th>
                                                <th className="px-4 py-3 text-left font-semibold">Charges</th>
                                                <th className="px-4 py-3 text-left font-semibold">Included</th>
                                                <th className="px-4 py-3 text-left font-semibold">Excluded</th>
                                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((p) => (
                                                <tr key={p.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                                                    <td className="px-4 py-3 font-semibold text-slate-900">{p.name || '—'}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-900">{p.charges != null ? `₹ ${p.charges}` : '—'}</td>
                                                    <td className="px-4 py-3 text-[12px] text-slate-700">{p.included || '—'}</td>
                                                    <td className="px-4 py-3 text-[12px] text-slate-700">{p.excluded || '—'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="inline-flex items-center justify-end gap-2">
                                                            <Button size="sm" variant="outline" className="h-9 rounded-2xl border-black/50" onClick={() => setModal({ mode: 'edit', row: p })}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-9 rounded-2xl border-black/50" onClick={() => remove(p)}>
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {filtered.map((p) => (
                                            <motion.div
                                                key={p.id}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                transition={{ duration: 0.14 }}
                                                className="rounded-3xl border border-black/50 bg-white/80 backdrop-blur px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.08)]"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-slate-900 truncate">{p.name || '—'}</div>
                                                        <div className="mt-2 inline-flex items-center rounded-full border border-black/50 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-800">
                                                            Charges: {p.charges != null ? `₹ ${p.charges}` : '—'}
                                                        </div>

                                                        <div className="mt-3 space-y-2 text-[12px] text-slate-700">
                                                            <div>
                                                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Included</div>
                                                                <div className="mt-0.5">{p.included || '—'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Excluded</div>
                                                                <div className="mt-0.5">{p.excluded || '—'}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        <Button size="sm" className="h-9 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setModal({ mode: 'edit', row: p })}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-9 rounded-2xl border-black/50" onClick={() => remove(p)}>
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <PackageModal
                open={!!modal}
                modal={modal}
                onClose={() => setModal(null)}
                onSaved={async () => {
                    setModal(null)
                    await load({ silent: true })
                }}
            />
        </>
    )
}

function PackageModal({ open, modal, onClose, onSaved }) {
    const mode = modal?.mode
    const row = modal?.row

    const [v, setV] = useState({ name: '', charges: '', included: '', excluded: '' })
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        setErr('')
        if (mode === 'edit' && row) {
            setV({
                name: row.name || '',
                charges: row.charges ?? '',
                included: row.included || '',
                excluded: row.excluded || '',
            })
        } else {
            setV({ name: '', charges: '', included: '', excluded: '' })
        }
    }, [open, mode, row])

    const save = async () => {
        setErr('')
        if (!String(v.name || '').trim()) return setErr('Package name required.')

        const payload = {
            name: String(v.name).trim(),
            charges: v.charges === '' || v.charges == null ? undefined : Number(v.charges),
            included: String(v.included || '').trim() || undefined,
            excluded: String(v.excluded || '').trim() || undefined,
        }

        setSaving(true)
        try {
            if (mode === 'create') await createPackage(payload)
            else await updatePackage(row.id, payload)

            toast.success(mode === 'create' ? 'Created' : 'Updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            open={open}
            title={mode === 'create' ? 'New Package' : 'Edit Package'}
            subtitle="Define charges + inclusions/exclusions."
            onClose={() => (saving ? null : onClose?.())}
        >
            <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Package name">
                        <TextInput value={v.name} onChange={(x) => setV((p) => ({ ...p, name: x }))} placeholder="e.g. Normal Delivery" />
                    </Field>
                    <Field label="Charges (₹)">
                        <TextInput type="number" value={v.charges} onChange={(x) => setV((p) => ({ ...p, charges: x }))} placeholder="e.g. 25000" />
                    </Field>

                    <div className="md:col-span-2">
                        <Field label="Included">
                            <textarea
                                value={v.included ?? ''}
                                onChange={(e) => setV((p) => ({ ...p, included: e.target.value }))}
                                className="min-h-[90px] w-full rounded-2xl border border-black/50 bg-white px-3 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                placeholder="e.g. bed, nursing, routine labs"
                            />
                        </Field>
                    </div>

                    <div className="md:col-span-2">
                        <Field label="Excluded">
                            <textarea
                                value={v.excluded ?? ''}
                                onChange={(e) => setV((p) => ({ ...p, excluded: e.target.value }))}
                                className="min-h-[90px] w-full rounded-2xl border border-black/50 bg-white px-3 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                placeholder="e.g. blood, implants, high-value drugs"
                            />
                        </Field>
                    </div>
                </div>

                {err ? <ErrorBanner message={err} /> : null}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" className="h-11 rounded-2xl border-black/50" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" className="h-11 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
