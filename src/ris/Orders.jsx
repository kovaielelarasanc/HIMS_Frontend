// FILE: src/ris/Orders.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus,
    Filter,
    Search,
    RefreshCw,
    X,
    Download,
    SlidersHorizontal,
    CalendarDays,
    LayoutList,
    LayoutGrid,
    Sparkles,
    Clock,
} from 'lucide-react'

import { listRisOrders } from '../api/ris'
import PermGate from '../components/PermGate'
import OrderBadge from '../components/OrderBadge'
import PatientBadge from '../components/PatientBadge'
import StatusBadge from '../components/StatusBadge'
import ModalityBadge from '../components/ModalityBadge'
import RisOrderForm from './components/RisOrderForm'

// ----------------------------
// Small helpers
// ----------------------------
function cx(...a) {
    return a.filter(Boolean).join(' ')
}

function clampStr(v) {
    if (v == null) return ''
    return String(v)
}

function ymd(d) {
    if (!d) return ''
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return ''
    const yyyy = x.getFullYear()
    const mm = String(x.getMonth() + 1).padStart(2, '0')
    const dd = String(x.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

function toLocalDateTime(d) {
    if (!d) return '—'
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return '—'
    return x.toLocaleString()
}

function norm(s) {
    return clampStr(s).toLowerCase().trim()
}

function downloadCsv(filename, rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = rows
        .map((r) => r.map(esc).join(','))
        .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

function useDebouncedValue(value, delay = 350) {
    const [v, setV] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return v
}

// ----------------------------
// Apple-glass modal/sheet
// ----------------------------
function GlassOverlay({ open, onClose, children }) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 backdrop-blur-xl md:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) onClose?.()
                    }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function GlassModal({ open, title, subtitle, onClose, children, maxWidth = 'max-w-4xl' }) {
    return (
        <GlassOverlay open={open} onClose={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.985 }}
                transition={{ duration: 0.16 }}
                className={cx(
                    'w-full rounded-[28px] border border-white/60 bg-white/75 shadow-2xl ring-1 ring-black/5',
                    'supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl',
                    maxWidth,
                )}
            >
                <div className="flex items-start gap-3 border-b border-black/5 px-4 py-4 md:px-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
                        {subtitle ? <div className="mt-0.5 text-[12px] text-slate-600">{subtitle}</div> : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-slate-700 hover:bg-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 md:p-5">{children}</div>
            </motion.div>
        </GlassOverlay>
    )
}

function GlassSheet({ open, title, subtitle, onClose, children }) {
    return (
        <GlassOverlay open={open} onClose={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.99 }}
                transition={{ duration: 0.16 }}
                className={cx(
                    'w-full rounded-[28px] border border-white/60 bg-white/75 shadow-2xl ring-1 ring-black/5',
                    'supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl',
                    'max-w-xl',
                )}
            >
                <div className="flex items-start gap-3 border-b border-black/5 px-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                        <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
                        {subtitle ? <div className="mt-0.5 text-[12px] text-slate-600">{subtitle}</div> : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-slate-700 hover:bg-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </motion.div>
        </GlassOverlay>
    )
}

// ----------------------------
// Main page
// ----------------------------
const DEFAULT_STATUSES = ['ordered', 'scheduled', 'checked_in', 'in_progress', 'completed', 'reported', 'cancelled']
const DEFAULT_MODALITIES = ['XR', 'CT', 'MRI', 'USG', 'CR', 'DX', 'MAMMO', 'PET', 'ECHO']
const DEFAULT_PRIORITIES = ['routine', 'urgent', 'stat']

export default function RisOrders() {
    const [raw, setRaw] = useState([])
    const [loading, setLoading] = useState(true)

    const [q, setQ] = useState('')
    const dq = useDebouncedValue(q, 320)

    // advanced filters
    const [status, setStatus] = useState([]) // multi
    const [modality, setModality] = useState([]) // multi
    const [priority, setPriority] = useState('all') // all | routine | urgent | stat
    const [datePreset, setDatePreset] = useState('all') // all | today | last24 | week | month | custom
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [sortKey, setSortKey] = useState('created_at') // created_at | status | priority | modality
    const [sortDir, setSortDir] = useState('desc') // asc | desc
    const [view, setView] = useState(() => localStorage.getItem('ris.orders.view') || 'table') // table | cards
    const [autoRefresh, setAutoRefresh] = useState(false)

    // saved views
    const [savedViews, setSavedViews] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('ris.orders.savedViews') || '[]')
        } catch {
            return []
        }
    })
    const [activeViewId, setActiveViewId] = useState('')

    // UI
    const [openCreate, setOpenCreate] = useState(false)
    const [openFilters, setOpenFilters] = useState(false)
    const searchRef = useRef(null)

    const load = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true)
        try {
            // NOTE: backend can ignore unknown params safely; we still do client-side filtering.
            const { data } = await listRisOrders({ q: dq, page_size: 500 })
            const rows = Array.isArray(data) ? data : (data?.items || [])
            setRaw(rows)
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load orders')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line
    }, [dq])

    useEffect(() => {
        localStorage.setItem('ris.orders.view', view)
    }, [view])

    // keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault()
                searchRef.current?.focus?.()
            }
            if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpenCreate(true)
            }
            if (e.key === 'Escape') {
                setOpenFilters(false)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // auto refresh
    useEffect(() => {
        if (!autoRefresh) return
        const t = setInterval(() => load({ silent: true }), 15000)
        return () => clearInterval(t)
        // eslint-disable-next-line
    }, [autoRefresh, dq])

    const derivedOptions = useMemo(() => {
        const s = new Set(DEFAULT_STATUSES)
        const m = new Set(DEFAULT_MODALITIES)
        const p = new Set(DEFAULT_PRIORITIES)
        raw.forEach((o) => {
            if (o?.status) s.add(String(o.status))
            if (o?.modality) m.add(String(o.modality))
            if (o?.priority) p.add(String(o.priority))
        })
        return {
            statuses: Array.from(s),
            modalities: Array.from(m),
            priorities: Array.from(p),
        }
    }, [raw])

    const filtered = useMemo(() => {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startOfWeek = new Date(startOfToday)
        startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const inPresetRange = (d) => {
            if (!d) return false
            const x = new Date(d)
            if (Number.isNaN(x.getTime())) return false

            if (datePreset === 'today') return x >= startOfToday
            if (datePreset === 'last24') return x >= new Date(Date.now() - 24 * 60 * 60 * 1000)
            if (datePreset === 'week') return x >= startOfWeek
            if (datePreset === 'month') return x >= startOfMonth
            if (datePreset === 'custom') {
                const f = fromDate ? new Date(fromDate + 'T00:00:00') : null
                const t = toDate ? new Date(toDate + 'T23:59:59') : null
                if (f && x < f) return false
                if (t && x > t) return false
                return true
            }
            return true
        }

        const qn = norm(dq)
        let rows = raw

        // lightweight extra client search (if API returns broader results)
        if (qn) {
            rows = rows.filter((o) => {
                const hay = [
                    o?.id,
                    o?.patient_id,
                    o?.uhid,
                    o?.patient_uhid,
                    o?.patient_name,
                    o?.name,
                    o?.test_name,
                    o?.test_code,
                    o?.modality,
                    o?.priority,
                    o?.status,
                ]
                    .map((x) => clampStr(x))
                    .join(' • ')
                return norm(hay).includes(qn)
            })
        }

        if (status.length) {
            const set = new Set(status.map((x) => norm(x)))
            rows = rows.filter((o) => set.has(norm(o?.status)))
        }

        if (modality.length) {
            const set = new Set(modality.map((x) => norm(x)))
            rows = rows.filter((o) => set.has(norm(o?.modality)))
        }

        if (priority !== 'all') {
            rows = rows.filter((o) => norm(o?.priority || 'routine') === norm(priority))
        }

        if (datePreset !== 'all') {
            rows = rows.filter((o) => inPresetRange(o?.created_at))
        }

        // sort
        const dir = sortDir === 'asc' ? 1 : -1
        const getKey = (o) => {
            if (sortKey === 'created_at') return new Date(o?.created_at || 0).getTime()
            if (sortKey === 'status') return norm(o?.status)
            if (sortKey === 'priority') return norm(o?.priority || 'routine')
            if (sortKey === 'modality') return norm(o?.modality)
            return new Date(o?.created_at || 0).getTime()
        }
        rows = [...rows].sort((a, b) => {
            const ka = getKey(a)
            const kb = getKey(b)
            if (ka < kb) return -1 * dir
            if (ka > kb) return 1 * dir
            return 0
        })

        return rows
    }, [raw, dq, status, modality, priority, datePreset, fromDate, toDate, sortKey, sortDir])

    const stats = useMemo(() => {
        const total = filtered.length
        const pending = filtered.filter((x) => !['completed', 'reported', 'cancelled'].includes(norm(x?.status))).length
        const urgent = filtered.filter((x) => ['urgent', 'stat'].includes(norm(x?.priority))).length
        return { total, pending, urgent }
    }, [filtered])

    const clearFilters = () => {
        setStatus([])
        setModality([])
        setPriority('all')
        setDatePreset('all')
        setFromDate('')
        setToDate('')
        setSortKey('created_at')
        setSortDir('desc')
        setActiveViewId('')
        toast.message('Filters cleared')
    }

    const applyPreset = (preset) => {
        setDatePreset(preset)
        if (preset !== 'custom') {
            setFromDate('')
            setToDate('')
        }
    }

    const saveCurrentView = () => {
        const name = prompt('Save view as (example: “Pending CT Today”)')
        if (!name?.trim()) return
        const v = {
            id: String(Date.now()),
            name: name.trim(),
            filters: {
                q,
                status,
                modality,
                priority,
                datePreset,
                fromDate,
                toDate,
                sortKey,
                sortDir,
                view,
            },
        }
        const next = [v, ...savedViews].slice(0, 12)
        setSavedViews(next)
        localStorage.setItem('ris.orders.savedViews', JSON.stringify(next))
        setActiveViewId(v.id)
        toast.success('View saved')
    }

    const loadView = (id) => {
        const v = savedViews.find((x) => x.id === id)
        if (!v) return
        const f = v.filters || {}
        setQ(f.q ?? '')
        setStatus(f.status ?? [])
        setModality(f.modality ?? [])
        setPriority(f.priority ?? 'all')
        setDatePreset(f.datePreset ?? 'all')
        setFromDate(f.fromDate ?? '')
        setToDate(f.toDate ?? '')
        setSortKey(f.sortKey ?? 'created_at')
        setSortDir(f.sortDir ?? 'desc')
        setView(f.view ?? 'table')
        setActiveViewId(id)
        toast.message(`Loaded: ${v.name}`)
    }

    const exportCsv = () => {
        const header = ['Order ID', 'Patient ID', 'Modality', 'Priority', 'Status', 'Created At']
        const rows = filtered.map((o) => [
            o?.id ?? '',
            o?.patient_id ?? '',
            o?.modality ?? '',
            o?.priority ?? 'routine',
            o?.status ?? '',
            o?.created_at ?? '',
        ])
        downloadCsv(`ris-orders-${ymd(new Date())}.csv`, [header, ...rows])
        toast.success('CSV downloaded')
    }

    return (
        <div className="min-h-[calc(100vh-40px)] text-slate-900">
            {/* Background (Apple-ish) */}
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-3 md:p-5">
                <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[820px] -translate-x-1/2 rounded-full bg-sky-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-purple-200/30 blur-3xl" />

                {/* Hero header */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cx(
                        'rounded-[26px] border border-white/60 bg-white/70 p-4 shadow-sm ring-1 ring-black/5',
                        'supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl',
                    )}
                >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                    <Clock className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="truncate text-[16px] font-semibold tracking-tight md:text-[18px]">
                                        Radiology Orders
                                    </h1>
                                    <p className="mt-0.5 text-[12px] text-slate-600">
                                        Book • Track • Scan • Report — with fast filters and saved views.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                <StatPill label="Total" value={stats.total} />
                                <StatPill label="Pending" value={stats.pending} tone="amber" />
                                <StatPill label="Urgent/STAT" value={stats.urgent} tone="rose" />
                                <div className="ml-1 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5">
                                    <input
                                        type="checkbox"
                                        checked={autoRefresh}
                                        onChange={(e) => setAutoRefresh(e.target.checked)}
                                    />
                                    <span className="text-slate-700">Auto refresh</span>
                                </div>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[520px]">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                    <input
                                        ref={searchRef}
                                        className={cx(
                                            'h-10 w-full rounded-2xl border border-black/10 bg-white/70 pl-10 pr-3 text-[13px]',
                                            'outline-none ring-0 focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60',
                                        )}
                                        placeholder="Search test / UHID / name / order…   ( / to focus )"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                    onClick={() => load()}
                                    title="Refresh"
                                >
                                    <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                </button>

                                <button
                                    type="button"
                                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white md:hidden"
                                    onClick={() => setOpenFilters(true)}
                                >
                                    <Filter className="h-4 w-4" />
                                    Filters
                                </button>

                                <PermGate anyOf={['orders.ris.create', 'radiology.orders.create']}>
                                    <button
                                        className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800"
                                        onClick={() => setOpenCreate(true)}
                                        title="New order (Ctrl/Cmd + N)"
                                    >
                                        <Plus className="h-4 w-4" />
                                        New Order
                                    </button>
                                </PermGate>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <QuickChips
                                    onPick={(cfg) => {
                                        if (cfg.status) setStatus(cfg.status)
                                        if (cfg.priority) setPriority(cfg.priority)
                                        if (cfg.datePreset) applyPreset(cfg.datePreset)
                                        if (cfg.modality) setModality(cfg.modality)
                                    }}
                                />

                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Saved views */}
                                    <select
                                        className="h-9 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                                        value={activeViewId}
                                        onChange={(e) => {
                                            const id = e.target.value
                                            setActiveViewId(id)
                                            if (id) loadView(id)
                                        }}
                                    >
                                        <option value="">Saved views…</option>
                                        {savedViews.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        className="h-9 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                        onClick={saveCurrentView}
                                    >
                                        Save view
                                    </button>

                                    <button
                                        type="button"
                                        className="h-9 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                        onClick={exportCsv}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <Download className="h-4 w-4" />
                                            CSV
                                        </span>
                                    </button>

                                    <div className="inline-flex h-9 overflow-hidden rounded-2xl border border-black/10 bg-white/70">
                                        <button
                                            type="button"
                                            className={cx(
                                                'inline-flex items-center gap-2 px-3 text-[12px] font-semibold',
                                                view === 'table' ? 'bg-white text-slate-900' : 'text-slate-700 hover:bg-white/70',
                                            )}
                                            onClick={() => setView('table')}
                                        >
                                            <LayoutList className="h-4 w-4" />
                                            Table
                                        </button>
                                        <button
                                            type="button"
                                            className={cx(
                                                'inline-flex items-center gap-2 px-3 text-[12px] font-semibold',
                                                view === 'cards' ? 'bg-white text-slate-900' : 'text-slate-700 hover:bg-white/70',
                                            )}
                                            onClick={() => setView('cards')}
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                            Cards
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Content layout (NO GRID): sidebar filters + list */}
                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    {/* Desktop filters panel */}
                    <div className="hidden w-[320px] shrink-0 md:block">
                        <FiltersPanel
                            statuses={derivedOptions.statuses}
                            modalities={derivedOptions.modalities}
                            status={status}
                            setStatus={setStatus}
                            modality={modality}
                            setModality={setModality}
                            priority={priority}
                            setPriority={setPriority}
                            datePreset={datePreset}
                            setDatePreset={applyPreset}
                            fromDate={fromDate}
                            setFromDate={setFromDate}
                            toDate={toDate}
                            setToDate={setToDate}
                            sortKey={sortKey}
                            setSortKey={setSortKey}
                            sortDir={sortDir}
                            setSortDir={setSortDir}
                            onClear={clearFilters}
                        />
                    </div>

                    {/* List */}
                    <div className="min-w-0 flex-1">
                        <div
                            className={cx(
                                'rounded-[26px] border border-white/60 bg-white/70 shadow-sm ring-1 ring-black/5',
                                'supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl',
                            )}
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3">
                                <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-slate-900">Results</div>
                                    <div className="mt-0.5 text-[12px] text-slate-600">
                                        Showing <span className="font-semibold text-slate-900">{filtered.length}</span> order(s)
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="hidden h-9 items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white md:inline-flex"
                                        onClick={() => setOpenFilters(true)}
                                    >
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Filters
                                    </button>

                                    <button
                                        type="button"
                                        className="h-9 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                        onClick={() => clearFilters()}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="p-4">
                                    <SkeletonRows />
                                </div>
                            ) : view === 'cards' ? (
                                <CardsList rows={filtered} />
                            ) : (
                                <TableList rows={filtered} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters sheet (mobile + also used by desktop Filters button) */}
                <GlassSheet
                    open={openFilters}
                    title="Advanced Filters"
                    subtitle="Filter by date, status, modality, priority and sort."
                    onClose={() => setOpenFilters(false)}
                >
                    <FiltersPanel
                        statuses={derivedOptions.statuses}
                        modalities={derivedOptions.modalities}
                        status={status}
                        setStatus={setStatus}
                        modality={modality}
                        setModality={setModality}
                        priority={priority}
                        setPriority={setPriority}
                        datePreset={datePreset}
                        setDatePreset={applyPreset}
                        fromDate={fromDate}
                        setFromDate={setFromDate}
                        toDate={toDate}
                        setToDate={setToDate}
                        sortKey={sortKey}
                        setSortKey={setSortKey}
                        sortDir={sortDir}
                        setSortDir={setSortDir}
                        onClear={clearFilters}
                    />

                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            className="h-10 rounded-2xl border border-black/10 bg-white/70 px-4 text-[12px] font-semibold text-slate-800 hover:bg-white"
                            onClick={() => setOpenFilters(false)}
                        >
                            Done
                        </button>
                    </div>
                </GlassSheet>

                {/* Create order modal */}
                <GlassModal
                    open={openCreate}
                    title="New Radiology Order"
                    subtitle="Create an order, pick patient + test, set modality/priority."
                    onClose={() => setOpenCreate(false)}
                    maxWidth="max-w-3xl"
                >
                    <RisOrderForm
                        onClose={() => setOpenCreate(false)}
                        onCreated={() => {
                            setOpenCreate(false)
                            load()
                        }}
                    />
                </GlassModal>
            </div>
        </div>
    )
}

// ----------------------------
// UI pieces
// ----------------------------
function StatPill({ label, value, tone = 'slate' }) {
    const styles =
        tone === 'amber'
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : tone === 'rose'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-slate-200 bg-slate-50 text-slate-800'
    return (
        <span className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-1.5', styles)}>
            <span className="text-[11px]">{label}</span>
            <span className="text-[11px] font-semibold">{value}</span>
        </span>
    )
}

function QuickChips({ onPick }) {
    const chip =
        'inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-white'
    return (
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={chip} onClick={() => onPick({ datePreset: 'today' })}>
                <CalendarDays className="h-4 w-4" />
                Today
            </button>
            <button type="button" className={chip} onClick={() => onPick({ datePreset: 'week' })}>
                This week
            </button>
            <button type="button" className={chip} onClick={() => onPick({ status: ['ordered', 'scheduled', 'checked_in', 'in_progress'] })}>
                Pending
            </button>
            <button type="button" className={chip} onClick={() => onPick({ priority: 'urgent' })}>
                Urgent
            </button>
            <button type="button" className={chip} onClick={() => onPick({ modality: ['CT'] })}>
                CT
            </button>
            <button type="button" className={chip} onClick={() => onPick({ modality: ['MRI'] })}>
                MRI
            </button>
        </div>
    )
}

function FiltersPanel({
    statuses,
    modalities,
    status,
    setStatus,
    modality,
    setModality,
    priority,
    setPriority,
    datePreset,
    setDatePreset,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    onClear,
}) {
    const box =
        'rounded-[22px] border border-black/10 bg-white/70 p-3 shadow-sm ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl'

    return (
        <div className="space-y-3">
            <div className={box}>
                <div className="text-[13px] font-semibold text-slate-900">Date</div>
                <div className="mt-2 flex flex-wrap gap-2">
                    <Pill active={datePreset === 'all'} onClick={() => setDatePreset('all')}>
                        All
                    </Pill>
                    <Pill active={datePreset === 'today'} onClick={() => setDatePreset('today')}>
                        Today
                    </Pill>
                    <Pill active={datePreset === 'last24'} onClick={() => setDatePreset('last24')}>
                        Last 24h
                    </Pill>
                    <Pill active={datePreset === 'week'} onClick={() => setDatePreset('week')}>
                        This week
                    </Pill>
                    <Pill active={datePreset === 'month'} onClick={() => setDatePreset('month')}>
                        This month
                    </Pill>
                    <Pill active={datePreset === 'custom'} onClick={() => setDatePreset('custom')}>
                        Custom
                    </Pill>
                </div>

                {datePreset === 'custom' ? (
                    <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-14 text-[11px] text-slate-600">From</span>
                            <input
                                type="date"
                                className="h-9 flex-1 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-14 text-[11px] text-slate-600">To</span>
                            <input
                                type="date"
                                className="h-9 flex-1 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                    </div>
                ) : null}
            </div>

            <div className={box}>
                <div className="text-[13px] font-semibold text-slate-900">Status</div>
                <div className="mt-2 flex flex-wrap gap-2">
                    {statuses.map((s) => (
                        <Pill
                            key={s}
                            active={status.includes(s)}
                            onClick={() => {
                                setStatus(status.includes(s) ? status.filter((x) => x !== s) : [...status, s])
                            }}
                        >
                            {s}
                        </Pill>
                    ))}
                </div>
            </div>

            <div className={box}>
                <div className="text-[13px] font-semibold text-slate-900">Modality</div>
                <div className="mt-2 flex flex-wrap gap-2">
                    {modalities.map((m) => (
                        <Pill
                            key={m}
                            active={modality.includes(m)}
                            onClick={() => {
                                setModality(modality.includes(m) ? modality.filter((x) => x !== m) : [...modality, m])
                            }}
                        >
                            {m}
                        </Pill>
                    ))}
                </div>
            </div>

            <div className={box}>
                <div className="text-[13px] font-semibold text-slate-900">Priority</div>
                <div className="mt-2 flex flex-wrap gap-2">
                    <Pill active={priority === 'all'} onClick={() => setPriority('all')}>
                        All
                    </Pill>
                    <Pill active={priority === 'routine'} onClick={() => setPriority('routine')}>
                        Routine
                    </Pill>
                    <Pill active={priority === 'urgent'} onClick={() => setPriority('urgent')}>
                        Urgent
                    </Pill>
                    <Pill active={priority === 'stat'} onClick={() => setPriority('stat')}>
                        STAT
                    </Pill>
                </div>
            </div>

            <div className={box}>
                <div className="text-[13px] font-semibold text-slate-900">Sort</div>
                <div className="mt-2 flex flex-col gap-2">
                    <select
                        className="h-9 rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value)}
                    >
                        <option value="created_at">Created time</option>
                        <option value="status">Status</option>
                        <option value="priority">Priority</option>
                        <option value="modality">Modality</option>
                    </select>

                    <div className="inline-flex h-9 overflow-hidden rounded-2xl border border-black/10 bg-white/70">
                        <button
                            type="button"
                            className={cx('flex-1 text-[12px] font-semibold', sortDir === 'desc' ? 'bg-white text-slate-900' : 'text-slate-700 hover:bg-white/70')}
                            onClick={() => setSortDir('desc')}
                        >
                            Newest
                        </button>
                        <button
                            type="button"
                            className={cx('flex-1 text-[12px] font-semibold', sortDir === 'asc' ? 'bg-white text-slate-900' : 'text-slate-700 hover:bg-white/70')}
                            onClick={() => setSortDir('asc')}
                        >
                            Oldest
                        </button>
                    </div>
                </div>
            </div>

            <button
                type="button"
                className="h-10 w-full rounded-2xl border border-black/10 bg-white/70 text-[12px] font-semibold text-slate-800 hover:bg-white"
                onClick={onClear}
            >
                Clear all filters
            </button>
        </div>
    )
}

function Pill({ active, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                active
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-black/10 bg-white/70 text-slate-800 hover:bg-white',
            )}
        >
            {children}
        </button>
    )
}

function TableList({ rows }) {
    return (
        <div className="w-full overflow-x-auto">
            <table className="min-w-[980px] w-full text-[13px]">
                <thead className="bg-white/40 text-[12px] text-slate-600">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold">Order</th>
                        <th className="px-4 py-3 text-left font-semibold">Patient</th>
                        <th className="px-4 py-3 text-left font-semibold">Modality</th>
                        <th className="px-4 py-3 text-left font-semibold">Priority</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Created</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {!rows.length ? (
                        <tr>
                            <td className="px-4 py-10 text-center text-[13px] text-slate-600" colSpan={7}>
                                No orders found.
                            </td>
                        </tr>
                    ) : (
                        rows.map((o) => (
                            <tr key={o.id} className="border-t border-black/5 hover:bg-white/40">
                                <td className="px-4 py-3">
                                    <OrderBadge order={o} to={`/ris/orders/${o.id}`} prefix="RAD" />
                                </td>
                                <td className="px-4 py-3">
                                    <PatientBadge patientId={o.patient_id} />
                                </td>
                                <td className="px-4 py-3">
                                    <ModalityBadge modality={o.modality} />
                                </td>
                                <td className="px-4 py-3 capitalize">{o.priority || 'routine'}</td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={o.status} />
                                </td>
                                <td className="px-4 py-3">{toLocalDateTime(o.created_at)}</td>
                                <td className="px-4 py-3 text-right">
                                    <Link
                                        to={`/ris/orders/${o.id}`}
                                        className="inline-flex h-9 items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                    >
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}

function CardsList({ rows }) {
    return (
        <div className="p-3">
            {!rows.length ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-8 text-center text-[13px] text-slate-600">
                    No orders found.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {rows.map((o) => (
                        <div
                            key={o.id}
                            className="rounded-[22px] border border-black/10 bg-white/70 p-3 shadow-sm ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55 supports-[backdrop-filter]:backdrop-blur-2xl"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <OrderBadge order={o} to={`/ris/orders/${o.id}`} prefix="RAD" />
                                        <ModalityBadge modality={o.modality} />
                                        <span className="text-[12px] capitalize text-slate-700">{o.priority || 'routine'}</span>
                                        <StatusBadge status={o.status} />
                                    </div>
                                    <div className="mt-2 text-[12px] text-slate-600">
                                        <span className="font-semibold text-slate-900">Created:</span> {toLocalDateTime(o.created_at)}
                                    </div>
                                    <div className="mt-2">
                                        <PatientBadge patientId={o.patient_id} />
                                    </div>
                                </div>

                                <Link
                                    to={`/ris/orders/${o.id}`}
                                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
                                >
                                    View
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function SkeletonRows() {
    const Row = () => (
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/60 p-3">
            <div className="h-9 w-24 rounded-xl bg-slate-200/60" />
            <div className="h-9 w-40 rounded-xl bg-slate-200/60" />
            <div className="h-9 w-20 rounded-xl bg-slate-200/60" />
            <div className="h-9 w-24 rounded-xl bg-slate-200/60" />
            <div className="ml-auto h-9 w-20 rounded-xl bg-slate-200/60" />
        </div>
    )
    return (
        <div className="space-y-2">
            <Row />
            <Row />
            <Row />
            <Row />
        </div>
    )
}
