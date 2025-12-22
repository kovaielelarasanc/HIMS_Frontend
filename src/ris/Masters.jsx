// FILE: src/ris/Masters.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import PermGate from '../components/PermGate'
import { listRisTests, createRisTest, updateRisTest, deleteRisTest } from '../api/ris'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertCircle,
    Check,
    ChevronDown,
    Clock,
    Filter,
    Loader2,
    Pencil,
    Plus,
    Save,
    ScanSearch,
    Trash2,
    X,
} from 'lucide-react'

/* ---------------------------------- utils --------------------------------- */

function cn(...c) {
    return c.filter(Boolean).join(' ')
}

const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: 'easeOut' },
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
        <div className="flex items-start gap-2 rounded-[22px] border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-xs font-semibold text-rose-700 shadow-sm backdrop-blur-xl">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">{message}</div>
        </div>
    )
}

function IconPill({ title, onClick, danger, children }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/60 bg-black/10 text-slate-800 shadow-sm backdrop-blur-xl transition active:scale-[0.99]',
                'hover:bg-white/90 hover:shadow',
                danger && 'text-rose-700',
            )}
        >
            {children}
        </button>
    )
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

function SearchRow({ value, onChange, placeholder }) {
    return (
        <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl">
            <ScanSearch className="h-4 w-4 text-slate-500" />
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
            <div className="relative">
                <select
                    value={value ?? ''}
                    required={required}
                    onChange={(e) => onChange?.(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-white/60 bg-white/70 px-3 py-2 pr-9 text-sm font-medium text-slate-900 shadow-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-sky-400/35"
                >
                    <option value="">{placeholder}</option>
                    {options.map((o) => (
                        <option key={String(o.value)} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
        </label>
    )
}

function Modal({ open, title, subtitle, onClose, children }) {
    const isDesktop = useMediaQuery('(min-width: 768px)')

    useEffect(() => {
        if (!open) return
        const onKey = (e) => e.key === 'Escape' && onClose?.()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    const panelAnim = isDesktop
        ? { initial: { opacity: 0, y: 10, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.98 } }
        : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 18 } }

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    className="fixed inset-0 z-[90] flex items-end justify-center bg-white/65 p-3 backdrop-blur-sm md:items-center"
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
                        className="w-full max-w-[680px] rounded-[30px] border border-white/50 bg-white/88 p-4 shadow-2xl backdrop-blur-2xl md:p-5"
                        onMouseDown={(e) => e.stopPropagation()}
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

/* --------------------------------- chips ---------------------------------- */

function ModalityChip({ modality }) {
    const m = String(modality || '—').toUpperCase()
    let cls = 'border-slate-500/70 bg-slate-100/70 text-slate-700'
    if (m === 'XR' || m === 'X-RAY' || m === 'XRAY') cls = 'border-sky-200/70 bg-sky-50/70 text-sky-700'
    else if (m === 'CT') cls = 'border-indigo-200/70 bg-indigo-50/70 text-indigo-700'
    else if (m === 'MRI') cls = 'border-purple-200/70 bg-purple-50/70 text-purple-700'
    else if (m === 'USG' || m === 'US' || m === 'ULTRASOUND') cls = 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700'
    else if (m === 'MAMMO' || m === 'MG') cls = 'border-amber-200/70 bg-amber-50/70 text-amber-700'
    return <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold', cls)}>{m}</span>
}

/* --------------------------------- main ----------------------------------- */

const MODALITY_OPTIONS = [
    { value: 'XR', label: 'XR (X-Ray)' },
    { value: 'CT', label: 'CT' },
    { value: 'MRI', label: 'MRI' },
    { value: 'USG', label: 'USG (Ultrasound)' },
    { value: 'MG', label: 'MG (Mammogram)' },
    { value: 'FLUORO', label: 'FLUORO' },
    { value: 'DEXA', label: 'DEXA' },
    { value: 'NUC', label: 'NUC (Nuclear)' },
    { value: 'OTHER', label: 'Other' },
]

export default function RisMasters() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')

    const [q, setQ] = useState('')
    const [modalityFilter, setModalityFilter] = useState('all')
    const [sortKey, setSortKey] = useState('name') // name|code|price
    const [sortDir, setSortDir] = useState('asc') // asc|desc

    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    const [form, setForm] = useState({ code: '', name: '', modality: '', price: '' })
    const [saving, setSaving] = useState(false)

    const load = async () => {
        setLoading(true)
        setErr('')
        try {
            const { data } = await listRisTests({ q: q?.trim() || undefined, page_size: 200 })
            const items = Array.isArray(data) ? data : data?.items || []
            setRows(items)
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load RIS tests.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q])

    // derived lists
    const modalityOptions = useMemo(() => {
        const fromRows = Array.from(
            new Set((rows || []).map((r) => String(r.modality || '').trim()).filter(Boolean).map((x) => x.toUpperCase())),
        )
        const base = MODALITY_OPTIONS.map((o) => o.value)
        const merged = Array.from(new Set([...base, ...fromRows]))
        return merged
            .filter(Boolean)
            .map((m) => {
                const hit = MODALITY_OPTIONS.find((x) => x.value === m)
                return { value: m, label: hit?.label || m }
            })
    }, [rows])

    const filtered = useMemo(() => {
        let res = rows || []

        if (modalityFilter !== 'all') {
            res = res.filter((r) => String(r.modality || '').toUpperCase() === modalityFilter)
        }

        // client-side sort (server already filtered by q)
        const dir = sortDir === 'desc' ? -1 : 1
        res = [...res].sort((a, b) => {
            if (sortKey === 'price') return (Number(a.price || 0) - Number(b.price || 0)) * dir
            const va = String(a[sortKey] || '').toLowerCase()
            const vb = String(b[sortKey] || '').toLowerCase()
            return va.localeCompare(vb) * dir
        })

        return res
    }, [rows, modalityFilter, sortKey, sortDir])

    const stats = useMemo(() => {
        const total = rows?.length || 0
        const shown = filtered?.length || 0
        const m = new Map()
        for (const r of rows || []) {
            const k = String(r.modality || '—').toUpperCase() || '—'
            m.set(k, (m.get(k) || 0) + 1)
        }
        const top = Array.from(m.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
        return { total, shown, top }
    }, [rows, filtered])

    const startCreate = () => {
        setEditing(null)
        setForm({ code: '', name: '', modality: '', price: '' })
        setOpen(true)
    }

    const startEdit = (t) => {
        setEditing(t)
        setForm({
            code: t.code || '',
            name: t.name || '',
            modality: t.modality ? String(t.modality).toUpperCase() : '',
            price: t.price ?? '',
        })
        setOpen(true)
    }

    const reset = () => {
        setEditing(null)
        setForm({ code: '', name: '', modality: '', price: '' })
        setOpen(false)
        setSaving(false)
    }

    const submit = async () => {
        const code = String(form.code || '').trim()
        const name = String(form.name || '').trim()
        const modality = String(form.modality || '').trim()
        const price = form.price === '' || form.price == null ? 0 : Number(form.price)

        if (!code) return toast.error('Code is required')
        if (!name) return toast.error('Name is required')
        if (Number.isNaN(price) || price < 0) return toast.error('Price must be a valid number (>= 0)')

        setSaving(true)
        try {
            const payload = { code, name, modality: modality || undefined, price }
            if (editing?.id) {
                await updateRisTest(editing.id, payload)
                toast.success('Updated')
            } else {
                await createRisTest(payload)
                toast.success('Created')
            }
            reset()
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const onDelete = async (t) => {
        if (!window.confirm(`Delete ${t.code}?`)) return
        try {
            await deleteRisTest(t.id)
            toast.success('Deleted')
            await load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed')
        }
    }

    return (
        <PermGate anyOf={['radiology.masters.manage', 'masters.ris.manage', 'radiology.masters.view', 'masters.ris.view']}>
            <GlassBg />
            <div className="min-h-screen px-3 py-3 text-slate-900 md:px-6 md:py-6">
                <motion.div
                    {...fadeIn}
                    className="mx-auto w-full max-w-[1600px] rounded-[32px] border border-white/60 bg-white/55 p-4 shadow-[0_30px_120px_-80px_rgba(15,23,42,0.55)] backdrop-blur-2xl md:p-6"
                >
                    {/* header */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-slate-900 text-white shadow-sm">
                                <ScanSearch className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                                    RIS Masters <span className="text-slate-400">—</span> Radiology Tests
                                </h1>
                                <p className="mt-1 text-[11px] font-medium text-slate-600 md:text-xs">
                                    NUTRYAH-premium master UI: search, filter by modality, quick stats, create/edit via glass modal.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 md:items-end">
                            <div className="flex flex-wrap items-center gap-2">
                                <SearchRow value={q} onChange={setQ} placeholder="Search code / name…" />
                                <PermGate anyOf={['radiology.masters.manage', 'masters.ris.manage']}>
                                    <PrimaryButton onClick={startCreate}>
                                        <Plus className="h-4 w-4" />
                                        New Test
                                    </PrimaryButton>
                                </PermGate>
                            </div>

                            {/* small stat pills */}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/60 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                                    Total: <span className="text-slate-900">{stats.total}</span>
                                </span>
                                <span className="rounded-full border border-white/60 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                                    Showing: <span className="text-slate-900">{stats.shown}</span>
                                </span>
                                {stats.top.map(([m, c]) => (
                                    <span
                                        key={m}
                                        className="rounded-full border border-white/60 bg-white/60 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl"
                                    >
                                        {m}: <span className="text-slate-900">{c}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* error */}
                    {err ? <div className="mt-4"><ErrorBanner message={err} /></div> : null}

                    {/* filter bar */}
                    <div className="mt-5 flex flex-col gap-3 rounded-[26px] border border-white/60 bg-white/45 p-3 shadow-sm backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                                <Filter className="h-4 w-4" />
                                <span>Modality</span>
                                <div className="inline-flex rounded-full bg-white/70 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setModalityFilter('all')}
                                        className={cn(
                                            'rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                                            modalityFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white',
                                        )}
                                    >
                                        All
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {modalityOptions.map((o) => (
                                    <button
                                        key={o.value}
                                        type="button"
                                        onClick={() => setModalityFilter(o.value)}
                                        className={cn(
                                            'rounded-full border px-3 py-2 text-[11px] font-semibold shadow-sm backdrop-blur-xl transition active:scale-[0.99]',
                                            modalityFilter === o.value
                                                ? 'border-slate-900 bg-slate-900 text-white'
                                                : 'border-white/60 bg-white/70 text-slate-800 hover:bg-white/90',
                                        )}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl">
                                <Clock className="h-4 w-4" />
                                <span>Sort</span>
                                <div className="inline-flex rounded-full bg-white/70 p-1">
                                    {[
                                        { k: 'name', label: 'Name' },
                                        { k: 'code', label: 'Code' },
                                        { k: 'price', label: 'Price' },
                                    ].map((x) => (
                                        <button
                                            key={x.k}
                                            type="button"
                                            onClick={() => setSortKey(x.k)}
                                            className={cn(
                                                'rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                                                sortKey === x.k ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white',
                                            )}
                                        >
                                            {x.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                                    className="rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-white/90"
                                    title="Toggle direction"
                                >
                                    {sortDir === 'asc' ? 'Asc' : 'Desc'}
                                </button>
                            </div>

                            <PillButton onClick={load} disabled={loading}>
                                <Loader2 className={cn('h-4 w-4', loading && 'animate-spin')} />
                                Refresh
                            </PillButton>
                        </div>
                    </div>

                    {/* list */}
                    <div className="mt-4 overflow-hidden rounded-[28px] border border-white/60 bg-white/55 shadow-sm backdrop-blur-2xl">
                        <div className="overflow-x-auto">
                            <table className="min-w-[980px] w-full text-sm">
                                <thead>
                                    <tr className="bg-white/40 text-xs font-semibold text-slate-500">
                                        <th className="px-4 py-3 text-left">Code</th>
                                        <th className="px-4 py-3 text-left">Name</th>
                                        <th className="px-4 py-3 text-left">Modality</th>
                                        <th className="px-4 py-3 text-left">Price</th>
                                        <th className="px-4 py-3 text-right w-[260px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading tests…
                                                </div>
                                            </td>
                                        </tr>
                                    ) : null}

                                    {!loading &&
                                        filtered.map((t) => (
                                            <tr key={t.id} className="border-t border-white/50 hover:bg-white/35">
                                                <td className="px-4 py-3 font-semibold text-slate-900">{t.code}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{t.name}</td>
                                                <td className="px-4 py-3">
                                                    <ModalityChip modality={t.modality} />
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-slate-900">₹ {Number(t.price || 0).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <PermGate anyOf={['radiology.masters.manage', 'masters.ris.manage']}>
                                                        <div className="inline-flex items-center justify-end gap-2">
                                                            <PillButton onClick={() => startEdit(t)}>
                                                                <Pencil className="h-4 w-4" /> Edit
                                                            </PillButton>
                                                            <DangerButton onClick={() => onDelete(t)}>
                                                                <Trash2 className="h-4 w-4" /> Delete
                                                            </DangerButton>
                                                        </div>
                                                    </PermGate>
                                                </td>
                                            </tr>
                                        ))}

                                    {!loading && filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-10 text-center">
                                                <div className="mx-auto max-w-md space-y-2">
                                                    <div className="text-sm font-semibold text-slate-900">No tests found</div>
                                                    <div className="text-xs font-medium text-slate-600">
                                                        Try clearing search/filter, or create a new test.
                                                    </div>
                                                    <PermGate anyOf={['radiology.masters.manage', 'masters.ris.manage']}>
                                                        <div className="pt-2">
                                                            <PrimaryButton onClick={startCreate}>
                                                                <Plus className="h-4 w-4" /> New Test
                                                            </PrimaryButton>
                                                        </div>
                                                    </PermGate>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>

                {/* create/edit modal */}
                <Modal
                    open={open}
                    title={editing ? `Edit Test — ${editing.code}` : 'New RIS Test'}
                    subtitle="Keep code short (e.g., CT_BRAIN), modality standard (XR/CT/MRI/USG). Price used for billing."
                    onClose={() => (!saving ? reset() : null)}

                >
                    <div className="grid gap-3 md:grid-cols-2">
                        <TextField
                            label="Test code"
                            required
                            value={form.code}
                            onChange={(x) => setForm((p) => ({ ...p, code: x }))}
                            placeholder="e.g. CT_BRAIN"
                        />
                        <TextField
                            label="Test name"
                            required
                            value={form.name}
                            onChange={(x) => setForm((p) => ({ ...p, name: x }))}
                            placeholder="e.g. CT Brain Plain"
                        />
                        <SelectField
                            label="Modality"
                            value={form.modality}
                            onChange={(x) => setForm((p) => ({ ...p, modality: x }))}
                            options={MODALITY_OPTIONS}
                            placeholder="(Optional) Select modality…"
                        />
                        <TextField
                            label="Price (₹)"
                            type="number"
                            value={form.price}
                            onChange={(x) => setForm((p) => ({ ...p, price: x }))}
                            placeholder="e.g. 1800"
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-900">
                            <Check className="h-4 w-4 text-slate-600" />
                            Validations: code + name required, price ≥ 0.
                        </div>

                        <div className="flex items-center gap-2">
                            <PillButton onClick={reset} disabled={saving}>
                                <X className="h-4 w-4" /> Cancel
                            </PillButton>
                            <PrimaryButton onClick={submit} disabled={saving}>
                                <Save className="h-4 w-4" />
                                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create test'}
                            </PrimaryButton>
                        </div>
                    </div>
                </Modal>
            </div>
        </PermGate>
    )
}
