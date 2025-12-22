// FILE: src/ipd/Masters.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
    AlertCircle,
    BedDouble,
    Building2,
    Check,
    Clock,
    Filter,
    Layers,
    Loader2,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'

/* ----------------------------- helpers / ui ----------------------------- */

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

const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: 'easeOut' },
}

function cn(...c) {
    return c.filter(Boolean).join(' ')
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
            return
        }
    }, [query])
    return ok
}

function GlassBg() {
    return (
        <>
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(99,102,241,0.12),transparent_60%),radial-gradient(900px_circle_at_30%_90%,rgba(16,185,129,0.10),transparent_55%)]" />
            <div className="pointer-events-none fixed inset-0 -z-10 bg-slate-50" />
        </>
    )
}

function ErrorBanner({ message }) {
    if (!message) return null
    return (
        <div className="flex items-start gap-2 rounded-[22px] border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-xs text-rose-700 shadow-sm backdrop-blur-xl">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">{message}</div>
        </div>
    )
}

function Divider() {
    return <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
}

function PillButton({ children, onClick, disabled, className }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-xl transition active:scale-[0.99] disabled:opacity-50',
                'hover:bg-white/90 hover:shadow',
                className,
            )}
        >
            {children}
        </button>
    )
}

function PrimaryButton({ children, onClick, disabled, className }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50',
                'hover:bg-slate-800 hover:shadow',
                className,
            )}
        >
            {children}
        </button>
    )
}

function DangerButton({ children, onClick, disabled, className }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50',
                'hover:bg-rose-700 hover:shadow',
                className,
            )}
        >
            {children}
        </button>
    )
}

function IconPill({ title, onClick, danger, children }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-800 shadow-sm backdrop-blur-xl transition active:scale-[0.99]',
                'hover:bg-white/90 hover:shadow',
                danger && 'text-rose-700',
            )}
        >
            {children}
        </button>
    )
}

function SearchRow({ value, onChange, placeholder }) {
    return (
        <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl">
            <Search className="h-4 w-4 text-slate-500" />
            <input
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {value ? (
                <button
                    type="button"
                    onClick={() => onChange?.('')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/70"
                    title="Clear"
                >
                    <X className="h-4 w-4 text-slate-500" />
                </button>
            ) : null}
        </div>
    )
}

function TextField({ label, value, onChange, placeholder, type = 'text', required }) {
    return (
        <label className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-600">
                {label} {required ? <span className="text-rose-600">*</span> : null}
            </div>
            <input
                type={type}
                value={value ?? ''}
                required={required}
                placeholder={placeholder}
                onChange={(e) => onChange?.(e.target.value)}
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-sky-400/35"
            />
        </label>
    )
}

function SelectField({ label, value, onChange, options = [], placeholder = 'Select…', required }) {
    return (
        <label className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-600">
                {label} {required ? <span className="text-rose-600">*</span> : null}
            </div>
            <select
                value={value ?? ''}
                required={required}
                onChange={(e) => onChange?.(e.target.value)}
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-900 shadow-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-sky-400/35"
            >
                <option value="">{placeholder}</option>
                {options.map((o) => (
                    <option key={String(o.value)} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    )
}

function RoomTypeChip({ type }) {
    if (!type) return <span className="text-xs text-slate-500">—</span>
    return (
        <span className="inline-flex items-center rounded-full border border-sky-200/70 bg-sky-50/70 px-3 py-1 text-[11px] font-semibold text-sky-700">
            {type}
        </span>
    )
}

function BedStateChip({ state }) {
    const s = String(state || 'unknown').toLowerCase()
    let cls = 'border-slate-500/70 bg-slate-100/70 text-slate-700'
    if (s === 'vacant' || s === 'available') cls = 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700'
    else if (s === 'occupied') cls = 'border-rose-200/70 bg-rose-50/70 text-rose-700'
    else if (s === 'reserved' || s === 'cleaning') cls = 'border-amber-200/70 bg-amber-50/70 text-amber-700'
    return (
        <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold capitalize', cls)}>
            {state || 'Unknown'}
        </span>
    )
}

function TariffBasisChip({ basis }) {
    const b = (basis || 'Daily').toLowerCase()
    const isHourly = b === 'hourly'
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold',
                isHourly ? 'border-purple-200/70 bg-purple-50/70 text-purple-700' : 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700',
            )}
        >
            {isHourly ? 'Hourly' : 'Daily'}
        </span>
    )
}

function GlassPanel({ icon: Icon, title, subtitle, right, children }) {
    return (
        <div className="rounded-[28px] border border-white/60 bg-white/55 p-4 shadow-[0_24px_90px_-60px_rgba(15,23,42,0.45)] backdrop-blur-2xl md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[22px] bg-slate-900 text-white shadow-sm">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-base font-semibold tracking-tight text-slate-900">{title}</div>
                        {subtitle ? <div className="mt-0.5 text-[11px] font-medium text-slate-600">{subtitle}</div> : null}
                    </div>
                </div>
                {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
            </div>

            <div className="mt-4">{children}</div>
        </div>
    )
}

function LoadingInline({ label = 'Loading…' }) {
    return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {label}
        </div>
    )
}

/* ----------------------------- sheet + popover ----------------------------- */

function Sheet({ open, title, subtitle, onClose, children }) {
    const isDesktop = useMediaQuery('(min-width: 768px)')

    useEffect(() => {
        if (!open) return
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    const panelAnim = isDesktop
        ? { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 18 } }
        : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 18 } }

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm md:items-stretch md:justify-end"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) onClose?.()
                    }}
                >
                    <motion.div
                        {...panelAnim}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className={cn(
                            'w-full rounded-[28px] border border-white/45 bg-white/85 p-4 shadow-2xl backdrop-blur-2xl',
                            'md:h-full md:max-w-[520px] md:rounded-r-none md:rounded-l-[28px] md:p-5',
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-[22px] bg-slate-900 text-white">
                                <Pencil className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-slate-900">{title}</div>
                                {subtitle ? <div className="mt-0.5 text-[11px] font-medium text-slate-600">{subtitle}</div> : null}
                            </div>
                            <button
                                type="button"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white/90"
                                onClick={onClose}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-4">{children}</div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}

function QuickEditPopover({ open, anchorRect, title, onClose, children }) {
    const [pos, setPos] = useState({ top: 100, left: 20 })

    useEffect(() => {
        if (!open || !anchorRect) return
        const calc = () => {
            const w = 360
            const pad = 12
            const top = Math.min(window.innerHeight - pad - 20, anchorRect.bottom + 10)
            const left = Math.max(pad, Math.min(window.innerWidth - pad - w, anchorRect.right - w))
            setPos({ top, left })
        }
        calc()
        const onKey = (e) => e.key === 'Escape' && onClose?.()
        window.addEventListener('resize', calc)
        window.addEventListener('scroll', onClose, true)
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('resize', calc)
            window.removeEventListener('scroll', onClose, true)
            window.removeEventListener('keydown', onKey)
        }
    }, [open, anchorRect, onClose])

    return (
        <AnimatePresence>
            {open ? (
                <>
                    <motion.div
                        className="fixed inset-0 z-[95]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onMouseDown={onClose}
                    />
                    <motion.div
                        className="fixed z-[96] w-[360px] max-w-[calc(100vw-24px)] rounded-[26px] border border-white/55 bg-white/92 p-4 shadow-2xl backdrop-blur-2xl"
                        style={{ top: pos.top, left: pos.left }}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900">{title}</div>
                                <div className="mt-0.5 text-[11px] font-medium text-slate-500">Quick edit (no sheet)</div>
                            </div>
                            <IconPill title="Close" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </IconPill>
                        </div>
                        <div className="mt-3">{children}</div>
                    </motion.div>
                </>
            ) : null}
        </AnimatePresence>
    )
}

/* ----------------------------- root page ----------------------------- */

export default function Masters() {
    return (
        <PermGate anyOf={['ipd.masters.manage', 'ipd.packages.manage']}>
            <GlassBg />
            <div className="min-h-screen px-3 py-3 text-slate-900 md:px-6 md:py-6">
                <motion.div
                    {...fadeIn}
                    className="mx-auto w-full max-w-[1600px] rounded-[32px] border border-white/60 bg-white/55 p-4 shadow-[0_30px_120px_-80px_rgba(15,23,42,0.55)] backdrop-blur-2xl md:p-6"
                >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-slate-900 text-white shadow-sm">
                                <BedDouble className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                                    IPD Masters
                                    <span className="text-slate-400"> — </span>
                                    Wards · Rooms · Beds · Tariffs · Packages
                                </h1>
                                <p className="mt-1 text-[11px] font-medium text-slate-600 md:text-xs">
                                    NUTRYAH-style explorer layout. Select ward → rooms → beds. Changes reflect in Admission, Bedboard and Billing.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/60 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                                Admin / Permission gated
                            </span>
                            <span className="rounded-full border border-emerald-200/60 bg-emerald-50/70 px-3 py-2 text-[11px] font-semibold text-emerald-700 shadow-sm backdrop-blur-xl">
                                Live billing impact
                            </span>
                        </div>
                    </div>

                    <div className="mt-5 space-y-5">
                        <LayoutExplorer />
                        <BedRatesNUTRYAH />
                        <PackagesNUTRYAH />
                    </div>
                </motion.div>
            </div>
        </PermGate>
    )
}

/* ----------------------------- 1) layout explorer ----------------------------- */

function LayoutExplorer() {
    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [wardSearch, setWardSearch] = useState('')
    const [roomSearch, setRoomSearch] = useState('')
    const [bedSearch, setBedSearch] = useState('')
    const [bedState, setBedState] = useState('all')

    const [selectedWardId, setSelectedWardId] = useState(null)
    const [selectedRoomId, setSelectedRoomId] = useState(null)

    const [sheet, setSheet] = useState(null) // { mode:'create'|'edit', entity:'ward'|'room'|'bed', row, defaults }
    const [qe, setQe] = useState(null) // { entity, row, rect }

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const [w, r, b] = await Promise.all([listWards(), listRooms(), listBeds()])
            setWards(w.data || [])
            setRooms(r.data || [])
            setBeds(b.data || [])
        } catch (e) {
            setError(e?.response?.data?.detail || 'Failed to load ward/room/bed data.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    // room types
    const derivedRoomTypes = useMemo(() => {
        const fromRooms = (rooms || [])
            .map((r) => r.type)
            .filter(Boolean)
            .map((x) => String(x).trim())
        return Array.from(new Set(fromRooms))
    }, [rooms])

    const allRoomTypes = useMemo(() => Array.from(new Set([...PREDEFINED_ROOM_TYPES, ...derivedRoomTypes])), [derivedRoomTypes])

    // filters
    const filteredWards = useMemo(() => {
        const list = wards || []
        if (!wardSearch.trim()) return list
        const q = wardSearch.toLowerCase()
        return list.filter(
            (w) =>
                String(w.code || '').toLowerCase().includes(q) ||
                String(w.name || '').toLowerCase().includes(q) ||
                String(w.floor || '').toLowerCase().includes(q),
        )
    }, [wards, wardSearch])

    const selectedWard = useMemo(() => (wards || []).find((w) => w.id === selectedWardId) || null, [wards, selectedWardId])
    const roomsForWard = useMemo(() => (selectedWardId ? (rooms || []).filter((r) => r.ward_id === selectedWardId) : []), [rooms, selectedWardId])

    const filteredRooms = useMemo(() => {
        let res = roomsForWard
        if (!roomSearch.trim()) return res
        const q = roomSearch.toLowerCase()
        return res.filter(
            (r) => String(r.number || '').toLowerCase().includes(q) || String(r.type || '').toLowerCase().includes(q),
        )
    }, [roomsForWard, roomSearch])

    // auto-select first room when ward changes (premium feel)
    useEffect(() => {
        if (!selectedWardId) {
            setSelectedRoomId(null)
            return
        }
        if (selectedRoomId) {
            const rr = (rooms || []).find((x) => x.id === selectedRoomId)
            if (rr && rr.ward_id === selectedWardId) return
        }
        const first = (rooms || []).find((r) => r.ward_id === selectedWardId)
        setSelectedRoomId(first?.id ?? null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWardId, rooms])

    const selectedRoom = useMemo(() => (rooms || []).find((r) => r.id === selectedRoomId) || null, [rooms, selectedRoomId])

    const bedsForRoom = useMemo(() => (selectedRoomId ? (beds || []).filter((b) => b.room_id === selectedRoomId) : []), [beds, selectedRoomId])

    const filteredBeds = useMemo(() => {
        let res = bedsForRoom
        if (bedState !== 'all') res = res.filter((b) => String(b.state || '').toLowerCase() === bedState)
        if (bedSearch.trim()) {
            const q = bedSearch.toLowerCase()
            res = res.filter((b) => String(b.code || '').toLowerCase().includes(q))
        }
        return res
    }, [bedsForRoom, bedState, bedSearch])

    // options for selects
    const wardOptions = useMemo(
        () => (wards || []).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
        [wards],
    )
    const roomOptions = useMemo(
        () =>
            (rooms || []).map((r) => ({
                value: r.id,
                label: `Ward ${r.ward_id} • Room ${r.number} (${r.type || 'Unspecified'})`,
            })),
        [rooms],
    )

    const confirmDelete = (label) => {
        try {
            return window.confirm(label || 'Delete this record?')
        } catch {
            return true
        }
    }

    // sheet open helpers
    const openCreate = (entity, defaults) => setSheet({ mode: 'create', entity, row: null, defaults: defaults || null })
    const openEdit = (entity, row) => setSheet({ mode: 'edit', entity, row, defaults: null })
    const closeSheet = () => setSheet(null)

    // delete handler
    const onDelete = async (entity, id, label) => {
        if (!confirmDelete(label)) return
        try {
            if (entity === 'ward') await deleteWard(id)
            if (entity === 'room') await deleteRoom(id)
            if (entity === 'bed') await deleteBed(id)
            toast.success('Deleted')
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    // Quick edit popover save
    const quickSave = async (entity, rowId, payload) => {
        try {
            if (entity === 'ward') await updateWard(rowId, payload)
            if (entity === 'room') await updateRoom(rowId, payload)
            if (entity === 'bed') await updateBed(rowId, payload)
            toast.success('Updated')
            setQe(null)
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Update failed')
        }
    }

    // mobile ward picker
    const [mobileWardOpen, setMobileWardOpen] = useState(false)

    return (
        <>
            <GlassPanel
                icon={Layers}
                title="Ward · Room · Bed Explorer"
                subtitle="No grid. NUTRYAH Finder-style navigation with sticky sidebar + animated detail panes."
                right={
                    <>
                        <PillButton onClick={() => openCreate('ward')}>
                            <Plus className="h-4 w-4" /> New Ward
                        </PillButton>
                        <PillButton onClick={() => (selectedWardId ? openCreate('room', { ward_id: selectedWardId }) : toast.error('Select a ward first'))}>
                            <Plus className="h-4 w-4" /> New Room
                        </PillButton>
                        <PillButton onClick={() => (selectedRoomId ? openCreate('bed', { room_id: selectedRoomId }) : toast.error('Select a room first'))}>
                            <Plus className="h-4 w-4" /> New Bed
                        </PillButton>
                    </>
                }
            >
                <ErrorBanner message={error} />

                {/* mobile context bar */}
                <div className="mb-3 mt-2 flex flex-col gap-2 md:hidden">
                    <div className="flex items-center gap-2">
                        <PrimaryButton onClick={() => setMobileWardOpen(true)} className="flex-1 justify-center">
                            <Building2 className="h-4 w-4" />
                            Choose Ward
                        </PrimaryButton>
                        <PillButton
                            onClick={() => {
                                setSelectedWardId(null)
                                setSelectedRoomId(null)
                            }}
                        >
                            Clear
                        </PillButton>
                    </div>

                    <div className="rounded-[22px] border border-white/60 bg-white/55 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                        Ward:{' '}
                        <span className="text-slate-900">{selectedWard ? `${selectedWard.code} — ${selectedWard.name}` : 'Not selected'}</span>
                        <span className="mx-2 text-slate-300">•</span>
                        Room:{' '}
                        <span className="text-slate-900">
                            {selectedRoom ? `${selectedRoom.number} (${selectedRoom.type || 'Unspecified'})` : 'Not selected'}
                        </span>
                    </div>
                </div>

                {/* main explorer */}
                <div className="flex flex-col gap-4 md:flex-row">
                    {/* LEFT (desktop): wards sidebar */}
                    <div className="hidden md:block md:w-[340px] md:shrink-0">
                        <div className="rounded-[26px] border border-white/60 bg-white/45 shadow-sm backdrop-blur-2xl">
                            {/* sticky header */}
                            <div className="sticky top-0 z-10 rounded-[26px] border-b border-white/50 bg-white/65 px-3 py-3 backdrop-blur-2xl">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-slate-900">Wards</div>
                                    <span className="text-[11px] font-semibold text-slate-500">{(wards || []).length} total</span>
                                </div>
                                <div className="mt-2">
                                    <SearchRow value={wardSearch} onChange={setWardSearch} placeholder="Search ward…" />
                                </div>
                            </div>

                            <div className="max-h-[520px] overflow-auto p-2">
                                {(filteredWards || []).map((w) => {
                                    const active = w.id === selectedWardId
                                    return (
                                        <button
                                            key={w.id}
                                            type="button"
                                            onClick={() => setSelectedWardId(w.id)}
                                            className={cn(
                                                'group w-full rounded-2xl px-3 py-2 text-left transition',
                                                active ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-white/55',
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className={cn('truncate text-sm font-semibold', active ? 'text-white' : 'text-slate-900')}>
                                                        {w.code || '—'} <span className={cn(active ? 'text-white/70' : 'text-slate-400')}>—</span>{' '}
                                                        <span className={cn(active ? 'text-white/90' : 'text-slate-700')}>{w.name || 'Unnamed'}</span>
                                                    </div>
                                                    <div className={cn('truncate text-[11px] font-medium', active ? 'text-white/75' : 'text-slate-600')}>
                                                        {w.floor ? `Floor: ${w.floor}` : 'No floor set'}
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                                    <IconPill
                                                        title="Quick edit"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setQe({ entity: 'ward', row: w, rect: e.currentTarget.getBoundingClientRect() })
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </IconPill>
                                                    <IconPill
                                                        title="Delete"
                                                        danger
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onDelete('ward', w.id, 'Delete ward? (Only possible if no rooms exist)')
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </IconPill>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}

                                {!filteredWards?.length && (
                                    <div className="rounded-2xl border border-dashed border-white/60 bg-white/40 p-4 text-center text-xs font-semibold text-slate-500 backdrop-blur-xl">
                                        No wards found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: rooms + beds */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {/* context breadcrumb */}
                        <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2 rounded-[22px] border border-white/60 bg-white/55 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                            <span className="text-slate-900">Context</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">Ward:</span>
                            <span className="text-slate-900">{selectedWard ? `${selectedWard.code} — ${selectedWard.name}` : 'Not selected'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">Room:</span>
                            <span className="text-slate-900">
                                {selectedRoom ? `${selectedRoom.number} (${selectedRoom.type || 'Unspecified'})` : 'Not selected'}
                            </span>
                            {(selectedWardId || selectedRoomId) && (
                                <button
                                    type="button"
                                    className="ml-auto rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-white/90"
                                    onClick={() => {
                                        setSelectedWardId(null)
                                        setSelectedRoomId(null)
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Rooms pane (animated on ward change) */}
                        <div className="rounded-[26px] border border-white/60 bg-white/45 p-3 shadow-sm backdrop-blur-2xl">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-xs font-semibold text-slate-900">Rooms</div>
                                    <div className="text-[11px] font-medium text-slate-600">
                                        {selectedWard ? `Ward ${selectedWard.code} rooms` : 'Select a ward to view rooms'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <SearchRow value={roomSearch} onChange={setRoomSearch} placeholder="Search rooms…" />
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div key={String(selectedWardId || 'none')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}>
                                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/60 bg-white/55 backdrop-blur-xl">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-[680px] w-full text-sm">
                                                <thead>
                                                    <tr className="bg-white/40 text-xs font-semibold text-slate-500">
                                                        <th className="px-4 py-3 text-left">Room</th>
                                                        <th className="px-4 py-3 text-left">Type</th>
                                                        <th className="px-4 py-3 text-left">Ward</th>
                                                        <th className="px-4 py-3 text-right w-[260px]">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {!selectedWardId ? (
                                                        <tr>
                                                            <td colSpan={4} className="px-4 py-5 text-sm font-semibold text-slate-500">
                                                                Select a ward to see rooms.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        <>
                                                            {filteredRooms.map((r) => {
                                                                const active = r.id === selectedRoomId
                                                                return (
                                                                    <tr key={r.id} className={cn('border-t border-white/50', active ? 'bg-slate-900/5' : 'hover:bg-white/35')}>
                                                                        <td className="px-4 py-3 font-semibold text-slate-900">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setSelectedRoomId(r.id)}
                                                                                className="underline-offset-2 hover:underline"
                                                                            >
                                                                                {r.number}
                                                                            </button>
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <RoomTypeChip type={r.type} />
                                                                        </td>
                                                                        <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                                                            {selectedWard ? `${selectedWard.code}` : `#${r.ward_id}`}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right">
                                                                            <div className="inline-flex items-center justify-end gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    className={cn(
                                                                                        'rounded-full px-3 py-2 text-xs font-semibold transition active:scale-[0.99]',
                                                                                        active
                                                                                            ? 'bg-slate-900 text-white'
                                                                                            : 'border border-white/60 bg-white/70 text-slate-800 hover:bg-white/90',
                                                                                    )}
                                                                                    onClick={() => setSelectedRoomId(r.id)}
                                                                                >
                                                                                    Select
                                                                                </button>

                                                                                <IconPill
                                                                                    title="Quick edit"
                                                                                    onClick={(e) => setQe({ entity: 'room', row: r, rect: e.currentTarget.getBoundingClientRect() })}
                                                                                >
                                                                                    <Pencil className="h-4 w-4" />
                                                                                </IconPill>

                                                                                <IconPill title="Edit (sheet)" onClick={() => openEdit('room', r)}>
                                                                                    <Layers className="h-4 w-4" />
                                                                                </IconPill>

                                                                                <IconPill
                                                                                    title="Delete"
                                                                                    danger
                                                                                    onClick={() => onDelete('room', r.id, 'Delete room? (Only possible if no beds exist)')}
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </IconPill>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                            {!filteredRooms.length && (
                                                                <tr>
                                                                    <td colSpan={4} className="px-4 py-5 text-sm font-semibold text-slate-500">
                                                                        No rooms found for this ward.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Beds pane (animated on room change) */}
                        <div className="rounded-[26px] border border-white/60 bg-white/45 p-3 shadow-sm backdrop-blur-2xl">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-xs font-semibold text-slate-900">Beds</div>
                                    <div className="text-[11px] font-medium text-slate-600">
                                        {selectedRoom ? `Room ${selectedRoom.number} beds` : 'Select a room to view beds'}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <SearchRow value={bedSearch} onChange={setBedSearch} placeholder="Search beds…" />
                                    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/55 p-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                                        {['all', 'vacant', 'occupied', 'reserved'].map((k) => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => setBedState(k)}
                                                className={cn(
                                                    'rounded-full px-3 py-2 capitalize transition active:scale-[0.99]',
                                                    bedState === k ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white/70',
                                                )}
                                            >
                                                {k}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div key={String(selectedRoomId || 'none')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}>
                                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/60 bg-white/55 backdrop-blur-xl">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-[680px] w-full text-sm">
                                                <thead>
                                                    <tr className="bg-white/40 text-xs font-semibold text-slate-500">
                                                        <th className="px-4 py-3 text-left">Bed code</th>
                                                        <th className="px-4 py-3 text-left">Status</th>
                                                        <th className="px-4 py-3 text-left">Room</th>
                                                        <th className="px-4 py-3 text-right w-[260px]">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {!selectedRoomId ? (
                                                        <tr>
                                                            <td colSpan={4} className="px-4 py-5 text-sm font-semibold text-slate-500">
                                                                Select a room to see beds.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        <>
                                                            {filteredBeds.map((b) => (
                                                                <tr key={b.id} className="border-t border-white/50 hover:bg-white/35">
                                                                    <td className="px-4 py-3 font-semibold text-slate-900">{b.code}</td>
                                                                    <td className="px-4 py-3">
                                                                        <BedStateChip state={b.state} />
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                                                        {selectedRoom ? `${selectedRoom.number}` : `#${b.room_id}`}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="inline-flex items-center justify-end gap-2">
                                                                            <IconPill
                                                                                title="Quick edit"
                                                                                onClick={(e) => setQe({ entity: 'bed', row: b, rect: e.currentTarget.getBoundingClientRect() })}
                                                                            >
                                                                                <Pencil className="h-4 w-4" />
                                                                            </IconPill>

                                                                            <IconPill title="Edit (sheet)" onClick={() => openEdit('bed', b)}>
                                                                                <Layers className="h-4 w-4" />
                                                                            </IconPill>

                                                                            <IconPill
                                                                                title="Delete"
                                                                                danger
                                                                                onClick={() => onDelete('bed', b.id, 'Delete bed? (Blocked if occupied)')}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </IconPill>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {!filteredBeds.length && (
                                                                <tr>
                                                                    <td colSpan={4} className="px-4 py-5 text-sm font-semibold text-slate-500">
                                                                        No beds found for this room.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            <div className="mt-3 flex flex-wrap gap-2">
                                {allRoomTypes.slice(0, 8).map((t) => (
                                    <span
                                        key={t}
                                        className="rounded-full border border-white/60 bg-white/60 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl"
                                    >
                                        {t}
                                    </span>
                                ))}
                                {allRoomTypes.length > 8 && (
                                    <span className="rounded-full border border-white/60 bg-white/60 px-3 py-2 text-[11px] font-semibold text-slate-600 backdrop-blur-xl">
                                        +{allRoomTypes.length - 8} more room types
                                    </span>
                                )}
                            </div>
                        </div>

                        {loading ? <LoadingInline label="Refreshing masters…" /> : null}
                    </div>
                </div>

                {/* mobile ward chooser sheet */}
                <Sheet
                    open={mobileWardOpen}
                    title="Choose Ward"
                    subtitle="Select ward to load rooms & beds."
                    onClose={() => setMobileWardOpen(false)}
                >
                    <SearchRow value={wardSearch} onChange={setWardSearch} placeholder="Search ward…" />
                    <div className="mt-3 max-h-[60vh] overflow-auto pr-1">
                        {(filteredWards || []).map((w) => {
                            const active = w.id === selectedWardId
                            return (
                                <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedWardId(w.id)
                                        setMobileWardOpen(false)
                                    }}
                                    className={cn(
                                        'mt-2 w-full rounded-2xl border px-3 py-3 text-left shadow-sm backdrop-blur-xl transition',
                                        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-white/60 bg-white/70 hover:bg-white/90',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold">{w.code || '—'} — {w.name || 'Unnamed'}</div>
                                            <div className={cn('truncate text-[11px] font-medium', active ? 'text-white/75' : 'text-slate-600')}>
                                                {w.floor ? `Floor: ${w.floor}` : 'No floor set'}
                                            </div>
                                        </div>
                                        {active ? <Check className="h-5 w-5" /> : null}
                                    </div>
                                </button>
                            )
                        })}
                        {!filteredWards?.length && (
                            <div className="mt-3 rounded-2xl border border-dashed border-white/60 bg-white/50 p-4 text-center text-xs font-semibold text-slate-500">
                                No wards found.
                            </div>
                        )}
                    </div>
                </Sheet>

                {/* Quick edit popover */}
                <QuickEditPopover
                    open={!!qe}
                    anchorRect={qe?.rect}
                    title={
                        qe?.entity === 'ward'
                            ? 'Quick edit ward'
                            : qe?.entity === 'room'
                                ? 'Quick edit room'
                                : qe?.entity === 'bed'
                                    ? 'Quick edit bed'
                                    : 'Quick edit'
                    }
                    onClose={() => setQe(null)}
                >
                    <QuickEditForm
                        entity={qe?.entity}
                        row={qe?.row}
                        wardOptions={wardOptions}
                        roomOptions={roomOptions}
                        allRoomTypes={allRoomTypes}
                        onCancel={() => setQe(null)}
                        onSave={(payload) => {
                            // normalize numeric ids
                            if (payload?.ward_id != null) payload.ward_id = Number(payload.ward_id)
                            if (payload?.room_id != null) payload.room_id = Number(payload.room_id)
                            quickSave(qe.entity, qe.row.id, payload)
                        }}
                    />
                </QuickEditPopover>

                {/* Sheet for create/edit */}
                <EntitySheet
                    open={!!sheet}
                    mode={sheet?.mode}
                    entity={sheet?.entity}
                    row={sheet?.row}
                    defaults={sheet?.defaults}
                    wardOptions={wardOptions}
                    roomOptions={roomOptions}
                    allRoomTypes={allRoomTypes}
                    onClose={closeSheet}
                    onSaved={async () => {
                        closeSheet()
                        await load()
                    }}
                    api={{
                        createWard,
                        updateWard,
                        createRoom,
                        updateRoom,
                        createBed,
                        updateBed,
                    }}
                />
            </GlassPanel>
        </>
    )
}

function QuickEditForm({ entity, row, wardOptions, roomOptions, allRoomTypes, onCancel, onSave }) {
    const [v, setV] = useState({})
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!row) return
        if (entity === 'ward') setV({ code: row.code || '', name: row.name || '', floor: row.floor || '' })
        if (entity === 'room') setV({ ward_id: String(row.ward_id ?? ''), number: row.number || '', type: row.type || '' })
        if (entity === 'bed') setV({ room_id: String(row.room_id ?? ''), code: row.code || '' })
        setErr('')
    }, [entity, row])

    const save = async () => {
        setErr('')
        // validate minimal
        if (entity === 'ward') {
            if (!String(v.code || '').trim()) return setErr('Ward code required.')
            if (!String(v.name || '').trim()) return setErr('Ward name required.')
        }
        if (entity === 'room') {
            if (!String(v.ward_id || '').trim()) return setErr('Ward required.')
            if (!String(v.number || '').trim()) return setErr('Room number required.')
        }
        if (entity === 'bed') {
            if (!String(v.room_id || '').trim()) return setErr('Room required.')
            if (!String(v.code || '').trim()) return setErr('Bed code required.')
        }

        const payload = { ...v }
        Object.keys(payload).forEach((k) => {
            if (typeof payload[k] === 'string') payload[k] = payload[k].trim()
            if (payload[k] === '') delete payload[k]
        })

        setSaving(true)
        try {
            await onSave(payload)
        } finally {
            setSaving(false)
        }
    }

    // room type quick select (optional)
    const roomTypeOptions = useMemo(() => {
        const fromAll = (allRoomTypes || []).map((t) => ({ value: t, label: t }))
        return fromAll
    }, [allRoomTypes])

    return (
        <div className="space-y-3">
            {entity === 'ward' ? (
                <div className="grid gap-3">
                    <TextField label="Ward code" required value={v.code ?? ''} onChange={(x) => setV((p) => ({ ...p, code: x }))} placeholder="e.g. GW-1" />
                    <TextField label="Ward name" required value={v.name ?? ''} onChange={(x) => setV((p) => ({ ...p, name: x }))} placeholder="e.g. General Ward" />
                    <TextField label="Floor / Level" value={v.floor ?? ''} onChange={(x) => setV((p) => ({ ...p, floor: x }))} placeholder="e.g. 1st Floor" />
                </div>
            ) : null}

            {entity === 'room' ? (
                <div className="grid gap-3">
                    <SelectField
                        label="Ward"
                        required
                        value={v.ward_id ?? ''}
                        onChange={(x) => setV((p) => ({ ...p, ward_id: x }))}
                        options={wardOptions}
                        placeholder="Select ward…"
                    />
                    <TextField label="Room number" required value={v.number ?? ''} onChange={(x) => setV((p) => ({ ...p, number: x }))} placeholder="e.g. 101" />
                    <SelectField
                        label="Room type"
                        value={v.type ?? ''}
                        onChange={(x) => setV((p) => ({ ...p, type: x }))}
                        options={roomTypeOptions}
                        placeholder="(Optional) Select type…"
                    />
                </div>
            ) : null}

            {entity === 'bed' ? (
                <div className="grid gap-3">
                    <SelectField
                        label="Room"
                        required
                        value={v.room_id ?? ''}
                        onChange={(x) => setV((p) => ({ ...p, room_id: x }))}
                        options={roomOptions}
                        placeholder="Select room…"
                    />
                    <TextField label="Bed code" required value={v.code ?? ''} onChange={(x) => setV((p) => ({ ...p, code: x }))} placeholder="e.g. GW-101-A" />
                </div>
            ) : null}

            {err ? <div className="text-xs font-semibold text-rose-600">{err}</div> : null}

            <div className="flex justify-end gap-2 pt-1">
                <PillButton onClick={onCancel} disabled={saving}>
                    Cancel
                </PillButton>
                <PrimaryButton onClick={save} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save'}
                </PrimaryButton>
            </div>
        </div>
    )
}

function EntitySheet({ open, mode, entity, row, defaults, wardOptions, roomOptions, allRoomTypes, onClose, onSaved, api }) {
    const title =
        mode === 'create'
            ? entity === 'ward'
                ? 'New Ward'
                : entity === 'room'
                    ? 'New Room'
                    : entity === 'bed'
                        ? 'New Bed'
                        : 'Create'
            : entity === 'ward'
                ? 'Edit Ward'
                : entity === 'room'
                    ? 'Edit Room'
                    : entity === 'bed'
                        ? 'Edit Bed'
                        : 'Edit'

    const subtitle =
        entity === 'ward'
            ? 'Code, name and floor define the ward identity.'
            : entity === 'room'
                ? 'Rooms belong to a ward and may have a type (ICU, Private, etc.).'
                : entity === 'bed'
                    ? 'Beds belong to rooms and appear in occupancy + billing.'
                    : ''

    return (
        <Sheet open={open} title={title} subtitle={subtitle} onClose={onClose}>
            {entity === 'ward' ? (
                <WardForm mode={mode} row={row} defaults={defaults} onSaved={onSaved} onClose={onClose} api={api} />
            ) : null}
            {entity === 'room' ? (
                <RoomForm
                    mode={mode}
                    row={row}
                    defaults={defaults}
                    wardOptions={wardOptions}
                    allRoomTypes={allRoomTypes}
                    onSaved={onSaved}
                    onClose={onClose}
                    api={api}
                />
            ) : null}
            {entity === 'bed' ? (
                <BedForm mode={mode} row={row} defaults={defaults} roomOptions={roomOptions} onSaved={onSaved} onClose={onClose} api={api} />
            ) : null}
        </Sheet>
    )
}

function WardForm({ mode, row, defaults, onClose, onSaved, api }) {
    const [v, setV] = useState({ code: '', name: '', floor: '' })
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mode === 'edit' && row) setV({ code: row.code || '', name: row.name || '', floor: row.floor || '' })
        else setV({ code: '', name: '', floor: '' })
        setErr('')
    }, [mode, row, defaults])

    const save = async () => {
        setErr('')
        if (!v.code.trim()) return setErr('Ward code required.')
        if (!v.name.trim()) return setErr('Ward name required.')

        const payload = { code: v.code.trim(), name: v.name.trim(), floor: (v.floor || '').trim() || undefined }

        setSaving(true)
        try {
            if (mode === 'create') await api.createWard(payload)
            else await api.updateWard(row.id, payload)
            toast.success(mode === 'create' ? 'Ward created' : 'Ward updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <TextField label="Ward code" required value={v.code} onChange={(x) => setV((p) => ({ ...p, code: x }))} placeholder="e.g. GW-1" />
            <TextField label="Ward name" required value={v.name} onChange={(x) => setV((p) => ({ ...p, name: x }))} placeholder="e.g. General Ward" />
            <TextField label="Floor / Level" value={v.floor} onChange={(x) => setV((p) => ({ ...p, floor: x }))} placeholder="e.g. 1st Floor" />

            {err ? <div className="text-xs font-semibold text-rose-600">{err}</div> : null}

            <div className="flex justify-end gap-2">
                <PillButton onClick={onClose} disabled={saving}>
                    Cancel
                </PillButton>
                <PrimaryButton onClick={save} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save'}
                </PrimaryButton>
            </div>
        </div>
    )
}

function RoomForm({ mode, row, defaults, wardOptions, allRoomTypes, onClose, onSaved, api }) {
    const [v, setV] = useState({ ward_id: '', number: '', typeChoice: '', customType: '' })
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mode === 'edit' && row) {
            setV({
                ward_id: String(row.ward_id ?? ''),
                number: row.number || '',
                typeChoice: row.type || '',
                customType: '',
            })
        } else {
            setV({
                ward_id: defaults?.ward_id ? String(defaults.ward_id) : '',
                number: '',
                typeChoice: '',
                customType: '',
            })
        }
        setErr('')
    }, [mode, row, defaults])

    const typeOptions = useMemo(() => {
        const base = PREDEFINED_ROOM_TYPES.map((t) => ({ value: t, label: t }))
        const extra = (allRoomTypes || [])
            .filter((t) => !PREDEFINED_ROOM_TYPES.includes(t))
            .map((t) => ({ value: t, label: `${t} (existing)` }))
        return [...base, ...extra, { value: '__custom', label: 'Other (custom)' }]
    }, [allRoomTypes])

    const save = async () => {
        setErr('')
        if (!v.ward_id) return setErr('Ward required.')
        if (!v.number.trim()) return setErr('Room number required.')
        if (v.typeChoice === '__custom' && !v.customType.trim()) return setErr('Enter custom room type.')

        const type =
            v.typeChoice === '__custom'
                ? v.customType.trim()
                : v.typeChoice?.trim()
                    ? v.typeChoice.trim()
                    : undefined

        const payload = {
            ward_id: Number(v.ward_id),
            number: v.number.trim(),
            type,
        }

        setSaving(true)
        try {
            if (mode === 'create') await api.createRoom(payload)
            else await api.updateRoom(row.id, payload)
            toast.success(mode === 'create' ? 'Room created' : 'Room updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <SelectField label="Ward" required value={v.ward_id} onChange={(x) => setV((p) => ({ ...p, ward_id: x }))} options={wardOptions} placeholder="Select ward…" />
            <TextField label="Room number" required value={v.number} onChange={(x) => setV((p) => ({ ...p, number: x }))} placeholder="e.g. 101" />
            <SelectField
                label="Room type"
                value={v.typeChoice}
                onChange={(x) => setV((p) => ({ ...p, typeChoice: x }))}
                options={typeOptions}
                placeholder="(Optional) Select room type…"
            />
            {v.typeChoice === '__custom' ? (
                <TextField label="Custom room type" required value={v.customType} onChange={(x) => setV((p) => ({ ...p, customType: x }))} placeholder="e.g. Chemotherapy Day Care" />
            ) : null}

            <div className="rounded-2xl border border-white/60 bg-white/55 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-xl">
                Tip: Standard types like ICU/NICU/Private help billing tariff mapping.
            </div>

            {err ? <div className="text-xs font-semibold text-rose-600">{err}</div> : null}

            <div className="flex justify-end gap-2">
                <PillButton onClick={onClose} disabled={saving}>
                    Cancel
                </PillButton>
                <PrimaryButton onClick={save} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save'}
                </PrimaryButton>
            </div>
        </div>
    )
}

function BedForm({ mode, row, defaults, roomOptions, onClose, onSaved, api }) {
    const [v, setV] = useState({ room_id: '', code: '' })
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mode === 'edit' && row) setV({ room_id: String(row.room_id ?? ''), code: row.code || '' })
        else setV({ room_id: defaults?.room_id ? String(defaults.room_id) : '', code: '' })
        setErr('')
    }, [mode, row, defaults])

    const save = async () => {
        setErr('')
        if (!v.room_id) return setErr('Room required.')
        if (!v.code.trim()) return setErr('Bed code required.')

        const payload = { room_id: Number(v.room_id), code: v.code.trim() }

        setSaving(true)
        try {
            if (mode === 'create') await api.createBed(payload)
            else await api.updateBed(row.id, payload)
            toast.success(mode === 'create' ? 'Bed created' : 'Bed updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <SelectField label="Room" required value={v.room_id} onChange={(x) => setV((p) => ({ ...p, room_id: x }))} options={roomOptions} placeholder="Select room…" />
            <TextField label="Bed code" required value={v.code} onChange={(x) => setV((p) => ({ ...p, code: x }))} placeholder="e.g. GW-101-A" />

            {err ? <div className="text-xs font-semibold text-rose-600">{err}</div> : null}

            <div className="flex justify-end gap-2">
                <PillButton onClick={onClose} disabled={saving}>
                    Cancel
                </PillButton>
                <PrimaryButton onClick={save} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save'}
                </PrimaryButton>
            </div>
        </div>
    )
}

/* ----------------------------- 2) bed rates ----------------------------- */

function parseRoomType(raw) {
    if (!raw) return { baseType: '', basis: 'Daily' }
    const txt = String(raw)
    if (/\(hourly\)/i.test(txt)) return { baseType: txt.replace(/\(hourly\)/i, '').trim(), basis: 'Hourly' }
    if (/\(daily\)/i.test(txt)) return { baseType: txt.replace(/\(daily\)/i, '').trim(), basis: 'Daily' }
    return { baseType: txt.trim(), basis: 'Daily' }
}

function BedRatesNUTRYAH() {
    const [rows, setRows] = useState([])
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [basisFilter, setBasisFilter] = useState('all')
    const [search, setSearch] = useState('')

    const [editRow, setEditRow] = useState(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const [r1, r2] = await Promise.all([listBedRates(), listRooms()])
            setRows(r1.data || [])
            setRooms(r2.data || [])
        } catch (e) {
            setError(e?.response?.data?.detail || 'Failed to load bed rates.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const roomTypeOptions = useMemo(() => {
        const fromRooms = (rooms || []).map((r) => r.type).filter(Boolean).map((x) => String(x).trim())
        const fromRates = (rows || []).map((r) => parseRoomType(r.room_type).baseType).filter(Boolean)
        return Array.from(new Set([...PREDEFINED_ROOM_TYPES, ...fromRooms, ...fromRates]))
    }, [rooms, rows])

    const filtered = useMemo(() => {
        let res = rows || []
        if (basisFilter !== 'all') {
            res = res.filter((r) => (parseRoomType(r.room_type).basis || 'Daily').toLowerCase() === basisFilter)
        }
        if (search.trim()) {
            const q = search.toLowerCase()
            res = res.filter((r) => String(r.room_type || '').toLowerCase().includes(q) || String(r.daily_rate || '').toLowerCase().includes(q))
        }
        return res
    }, [rows, basisFilter, search])

    const remove = async (id) => {
        try {
            if (!window.confirm('Delete / deactivate this bed rate?')) return
            await deleteBedRate(id)
            toast.success('Bed rate deleted')
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <>
            <GlassPanel
                icon={Clock}
                title="Bed Rates"
                subtitle="Daily & Hourly tariffs. Used by IP billing resolution."
                right={
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                            <Filter className="h-4 w-4" />
                            <span>Basis</span>
                            <div className="inline-flex rounded-full bg-white/70 p-1">
                                {['all', 'daily', 'hourly'].map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setBasisFilter(k)}
                                        className={cn(
                                            'rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition',
                                            basisFilter === k ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white',
                                        )}
                                    >
                                        {k}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <SearchRow value={search} onChange={setSearch} placeholder="Search room type / tariff…" />
                    </div>
                }
            >
                <ErrorBanner message={error} />

                <BedRateEditor
                    mode="create"
                    roomTypeOptions={roomTypeOptions}
                    onSaved={async () => {
                        await load()
                    }}
                />

                <div className="mt-4 overflow-hidden rounded-[26px] border border-white/60 bg-white/55 shadow-sm backdrop-blur-2xl">
                    <div className="overflow-x-auto">
                        <table className="min-w-[920px] w-full text-sm">
                            <thead>
                                <tr className="bg-white/40 text-xs font-semibold text-slate-500">
                                    <th className="px-4 py-3 text-left">Room type</th>
                                    <th className="px-4 py-3 text-left">Tariff</th>
                                    <th className="px-4 py-3 text-left">From</th>
                                    <th className="px-4 py-3 text-left">To</th>
                                    <th className="px-4 py-3 text-left">Active</th>
                                    <th className="px-4 py-3 text-right w-[260px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(filtered || []).map((r) => {
                                    const parsed = parseRoomType(r.room_type)
                                    return (
                                        <tr key={r.id} className="border-t border-white/50 hover:bg-white/35">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <RoomTypeChip type={parsed.baseType || r.room_type} />
                                                    <TariffBasisChip basis={parsed.basis} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-900">₹ {r.daily_rate ?? '—'}</td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-700">{String(r.effective_from || '—').slice(0, 10)}</td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-700">{r.effective_to ? String(r.effective_to).slice(0, 10) : '—'}</td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-700">{r.is_active ? 'Yes' : 'No'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center justify-end gap-2">
                                                    <PillButton
                                                        onClick={() => {
                                                            setEditRow(r)
                                                            setSheetOpen(true)
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" /> Edit
                                                    </PillButton>
                                                    <DangerButton onClick={() => remove(r.id)}>
                                                        <Trash2 className="h-4 w-4" /> Delete
                                                    </DangerButton>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {!filtered?.length ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-sm font-semibold text-slate-500">
                                            No bed rates found.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>

                {loading ? <div className="mt-3"><LoadingInline label="Refreshing bed rates…" /></div> : null}
            </GlassPanel>

            <Sheet
                open={sheetOpen}
                title="Edit Bed Rate"
                subtitle="Update tariff, basis and effective dates."
                onClose={() => setSheetOpen(false)}
            >
                <BedRateEditor
                    mode="edit"
                    row={editRow}
                    roomTypeOptions={roomTypeOptions}
                    onSaved={async () => {
                        setSheetOpen(false)
                        setEditRow(null)
                        await load()
                    }}
                />
            </Sheet>
        </>
    )
}

function BedRateEditor({ mode, row, roomTypeOptions = [], onSaved }) {
    const parsed = useMemo(() => parseRoomType(row?.room_type), [row])
    const [v, setV] = useState({
        baseRoomType: '',
        basis: 'daily',
        amount: '',
        effective_from: '',
        effective_to: '',
        is_active: true,
    })
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mode === 'edit' && row) {
            const p = parseRoomType(row.room_type)
            setV({
                baseRoomType: p.baseType || '',
                basis: (p.basis || 'Daily').toLowerCase() === 'hourly' ? 'hourly' : 'daily',
                amount: row.daily_rate ?? '',
                effective_from: row.effective_from ? String(row.effective_from).slice(0, 10) : '',
                effective_to: row.effective_to ? String(row.effective_to).slice(0, 10) : '',
                is_active: row.is_active ?? true,
            })
        } else {
            setV({ baseRoomType: '', basis: 'daily', amount: '', effective_from: '', effective_to: '', is_active: true })
        }
        setErr('')
    }, [mode, row])

    const save = async () => {
        setErr('')
        if (!v.baseRoomType) return setErr('Select a room type.')
        if (!v.amount || Number(v.amount) <= 0) return setErr('Tariff must be > 0.')
        if (!v.effective_from) return setErr('Effective from date required.')

        const basisLabel = v.basis === 'hourly' ? 'Hourly' : 'Daily'
        const room_type = `${v.baseRoomType} (${basisLabel})`

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
            toast.success(mode === 'create' ? 'Bed rate created' : 'Bed rate updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <SelectField
                    label="Room type"
                    required
                    value={v.baseRoomType}
                    onChange={(x) => setV((p) => ({ ...p, baseRoomType: x }))}
                    options={roomTypeOptions.map((t) => ({ value: t, label: t }))}
                    placeholder="Select room type…"
                />

                <label className="space-y-1">
                    <div className="text-[11px] font-semibold text-slate-600">Tariff basis</div>
                    <div className="inline-flex w-full items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-1 shadow-sm backdrop-blur-xl">
                        {[
                            { key: 'daily', label: 'Daily' },
                            { key: 'hourly', label: 'Hourly' },
                        ].map((b) => (
                            <button
                                key={b.key}
                                type="button"
                                onClick={() => setV((p) => ({ ...p, basis: b.key }))}
                                className={cn(
                                    'flex-1 rounded-2xl px-3 py-2 text-xs font-semibold transition',
                                    v.basis === b.key ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white/80',
                                )}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500">
                        {v.basis === 'hourly' ? 'Use hourly tariff for short-stay/observation.' : 'Use daily tariff for standard IP stays.'}
                    </div>
                </label>

                <TextField
                    label="Tariff amount (₹)"
                    required
                    type="number"
                    value={v.amount}
                    onChange={(x) => setV((p) => ({ ...p, amount: x }))}
                    placeholder="e.g. 2500"
                />

                <label className="space-y-1">
                    <div className="text-[11px] font-semibold text-slate-600">Active</div>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl">
                        <input
                            type="checkbox"
                            checked={!!v.is_active}
                            onChange={(e) => setV((p) => ({ ...p, is_active: e.target.checked }))}
                        />
                        <span className="text-xs font-semibold text-slate-700">Enabled (used in billing resolution)</span>
                    </div>
                </label>

                <TextField
                    label="Effective from"
                    required
                    type="date"
                    value={v.effective_from}
                    onChange={(x) => setV((p) => ({ ...p, effective_from: x }))}
                />

                <TextField
                    label="Effective to (optional)"
                    type="date"
                    value={v.effective_to}
                    onChange={(x) => setV((p) => ({ ...p, effective_to: x }))}
                />
            </div>

            {err ? <div className="text-xs font-semibold text-rose-600">{err}</div> : null}

            <div className="flex justify-end gap-2">
                <PrimaryButton onClick={save} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : mode === 'create' ? 'Create rate' : 'Save changes'}
                </PrimaryButton>
            </div>
        </div>
    )
}

/* ----------------------------- 3) packages ----------------------------- */

function PackagesNUTRYAH() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    const [editRow, setEditRow] = useState(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await listPackages()
            setRows(data || [])
        } catch (e) {
            setError(e?.response?.data?.detail || 'Failed to load packages.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const filtered = useMemo(() => {
        const list = rows || []
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter((p) => String(p.name || '').toLowerCase().includes(q))
    }, [rows, search])

    const remove = async (id) => {
        try {
            if (!window.confirm('Delete package?')) return
            await deletePackage(id)
            toast.success('Package deleted')
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <>
            <GlassPanel
                icon={BedDouble}
                title="IPD Packages"
                subtitle="Packages like LSCS / Normal Delivery with inclusions & exclusions."
                right={<SearchRow value={search} onChange={setSearch} placeholder="Search package…" />}
            >
                <ErrorBanner message={error} />

                <PackageEditor
                    mode="create"
                    onSaved={async () => {
                        await load()
                    }}
                />

                <div className="mt-4 overflow-hidden rounded-[26px] border border-white/60 bg-white/55 shadow-sm backdrop-blur-2xl">
                    <div className="overflow-x-auto">
                        <table className="min-w-[980px] w-full text-sm">
                            <thead>
                                <tr className="bg-white/40 text-xs font-semibold text-slate-500">
                                    <th className="px-4 py-3 text-left">Name</th>
                                    <th className="px-4 py-3 text-left">Charges</th>
                                    <th className="px-4 py-3 text-left">Included</th>
                                    <th className="px-4 py-3 text-left">Excluded</th>
                                    <th className="px-4 py-3 text-right w-[260px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(filtered || []).map((p) => (
                                    <tr key={p.id} className="border-t border-white/50 hover:bg-white/35">
                                        <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{p.charges != null ? `₹ ${p.charges}` : '—'}</td>
                                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{p.included || '—'}</td>
                                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{p.excluded || '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center justify-end gap-2">
                                                <PillButton
                                                    onClick={() => {
                                                        setEditRow(p)
                                                        setSheetOpen(true)
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" /> Edit
                                                </PillButton>
                                                <DangerButton onClick={() => remove(p.id)}>
                                                    <Trash2 className="h-4 w-4" /> Delete
                                                </DangerButton>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!filtered?.length ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-sm font-semibold text-slate-500">
                                            No packages found.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>

                {loading ? <div className="mt-3"><LoadingInline label="Refreshing packages…" /></div> : null}
            </GlassPanel>

            <Sheet open={sheetOpen} title="Edit Package" subtitle="Update name, inclusions, exclusions and charges." onClose={() => setSheetOpen(false)}>
                <PackageEditor
                    mode="edit"
                    row={editRow}
                    onSaved={async () => {
                        setSheetOpen(false)
                        setEditRow(null)
                        await load()
                    }}
                />
            </Sheet>
        </>
    )
}

function PackageEditor({ mode, row, onSaved }) {
    const [v, setV] = useState({ name: '', included: '', excluded: '', charges: '' })
    const [err, setErr] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mode === 'edit' && row) {
            setV({
                name: row.name || '',
                included: row.included || '',
                excluded: row.excluded || '',
                charges: row.charges ?? '',
            })
        } else {
            setV({ name: '', included: '', excluded: '', charges: '' })
        }
        setErr('')
    }, [mode, row])

    const save = async () => {
        setErr('')
        if (!String(v.name || '').trim()) return setErr('Package name required.')

        const payload = {
            name: String(v.name || '').trim(),
            included: String(v.included || '').trim() || undefined,
            excluded: String(v.excluded || '').trim() || undefined,
            charges: v.charges === '' || v.charges == null ? undefined : Number(v.charges),
        }

        setSaving(true)
        try {
            if (mode === 'create') await createPackage(payload)
            else await updatePackage(row.id, payload)
            toast.success(mode === 'create' ? 'Package created' : 'Package updated')
            await onSaved?.()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <TextField label="Package name" required value={v.name} onChange={(x) => setV((p) => ({ ...p, name: x }))} placeholder="e.g. Normal Delivery" />
                <TextField label="Charges (₹)" type="number" value={v.charges} onChange={(x) => setV((p) => ({ ...p, charges: x }))} placeholder="e.g. 25000" />
                <label className="md:col-span-2 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-600">Included</div>
                    <textarea
                        value={v.included ?? ''}
                        onChange={(e) => setV((p) => ({ ...p, included: e.target.value }))}
                        placeholder="e.g. bed, nursing, routine labs"
                        className="min-h-[84px] w-full rounded-2xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-sky-400/35"
                    />
                </label>
                <label className="md:col-span-2 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-600">Excluded</div>
                    <textarea
                        value={v.excluded ?? ''}
                        onChange={(e) => setV((p) => ({ ...p, excluded: e.target.value }))}
                        placeholder="e.g. blood, implants, high-value drugs"
                        className="min-h-[84px] w-full rounded-2xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-sky-400/35"
                    />
                </label>
            </div>

            {err ? <div className="text-xs font-semibold text-rose-600">{err}</div> : null}

            <div className="flex justify-end gap-2">
                <PrimaryButton onClick={save} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : mode === 'create' ? 'Create package' : 'Save changes'}
                </PrimaryButton>
            </div>
        </div>
    )
}
