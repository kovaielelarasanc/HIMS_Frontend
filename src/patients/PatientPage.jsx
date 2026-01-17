// FILE: src/patients/PatientPage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'

import { listPatients, deactivatePatient, getPatientMastersAll, exportPatientsExcel } from '../api/patients'
import { useBranding } from '../branding/BrandingProvider'

// icons
import {
    Users,
    Search,
    Plus,
    FileDown,
    AlertCircle,
    Inbox,
    Phone,
    Mail,
    Tag,
    Eye,
    Pencil,
    Ban,
    X,
    RefreshCcw,
    CalendarDays,
    MoreVertical,
    ChevronRight,
    ChevronLeft,
    Command,
    Check,
    SlidersHorizontal,
    Bookmark,
    Trash2,
    ArrowDownUp,
    Baby,
    BadgeCheck,
    IdCard,
} from 'lucide-react'

// shadcn/ui
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import PatientFormModal from './PatientForm'
import PatientDetailDrawer from './PatientDetailDrawer'

/* ------------------------- utils ------------------------- */
const cx = (...a) => a.filter(Boolean).join(' ')
const safeHex = (v) => typeof v === 'string' && v.startsWith('#') && v.length === 7
const alphaHex = (hex, a = '1A') => (safeHex(hex) ? `${hex}${a}` : undefined)

const initials = (first = '', last = '') => {
    const a = (first || '').trim()[0] || 'P'
    const b = (last || '').trim()[0] || ''
    return (a + b).toUpperCase()
}

function getCreatedDate(p) {
    const raw =
        p.created_at ||
        p.createdAt ||
        p.registered_at ||
        p.registeredAt ||
        p.created_on ||
        p.createdOn ||
        p.updated_at ||
        p.updatedAt
    if (!raw) return null
    const dt = new Date(raw)
    return Number.isNaN(dt.getTime()) ? null : dt
}

function extractAgeYears(p) {
    const a = p.age ?? p.age_years ?? p.ageYears
    if (typeof a === 'number' && !Number.isNaN(a)) return a
    const txt = String(p.age_text || p.ageText || '').trim()
    const m = txt.match(/(\d+)/)
    return m ? Number(m[1]) : null
}

function boolish(v) {
    return v === true || v === 1 || v === '1' || v === 'true' || v === 'True'
}

/* ------------------------- Fetch All (server-paged) ------------------------- */
const SERVER_PAGE_LIMIT = 500
const MAX_PAGES_GUARD = 1000 // safety: 1000 * 500 = 500k rows max (won't happen normally)

function buildServerParams(search, patientType) {
    const params = {}
    if (search) params.q = search
    if (patientType) params.patient_type = patientType
    return params
}

/* ------------------------- UI bits ------------------------- */
function StatPill({ label, value, tone = 'slate' }) {
    const toneMap = {
        slate: 'bg-black/[0.04] text-slate-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        rose: 'bg-rose-50 text-rose-700',
        sky: 'bg-sky-50 text-sky-700',
        violet: 'bg-violet-50 text-violet-700',
    }
    return (
        <div
            className={cx(
                'inline-flex items-center gap-2 rounded-full px-3 py-1',
                'text-[12px] font-semibold tracking-tight',
                toneMap[tone] || toneMap.slate
            )}
        >
            <span className="opacity-80">{label}</span>
            <span className="tabular-nums">{value}</span>
        </div>
    )
}

function RowActions({ onView, onEdit, onDeactivate }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl hover:bg-black/[0.04]"
                    title="Actions"
                    onClick={(e) => e.stopPropagation()}
                >
                    <MoreVertical className="h-4 w-4 text-slate-600" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-44 rounded-2xl p-1.5 border border-black/10 shadow-xl bg-white"
                onClick={(e) => e.stopPropagation()}
            >
                <DropdownMenuItem
                    className="rounded-xl cursor-pointer"
                    onSelect={(e) => {
                        e.preventDefault()
                        onView?.()
                    }}
                >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                </DropdownMenuItem>

                <DropdownMenuItem
                    className="rounded-xl cursor-pointer"
                    onSelect={(e) => {
                        e.preventDefault()
                        onEdit?.()
                    }}
                >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                <DropdownMenuItem
                    className="rounded-xl cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                    onSelect={(e) => {
                        e.preventDefault()
                        onDeactivate?.()
                    }}
                >
                    <Ban className="h-4 w-4 mr-2" />
                    Deactivate
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/** iOS-ish segmented control (mobile-safe: horizontal scroll) */
function SegmentedControl({ value, onChange, primary = '#2563eb', options = [], moreOptions = [] }) {
    const activeStyle = { borderColor: alphaHex(primary, '22') || '#bfdbfe' }

    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 overflow-x-auto">
                <div className="inline-flex items-center rounded-2xl border border-black/10 bg-black/[0.03] p-1 whitespace-nowrap">
                    {options.map((opt) => {
                        const active = value === opt.value
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onChange(opt.value)}
                                className={cx(
                                    'relative h-9 px-3 rounded-xl text-[12px] font-semibold tracking-tight transition',
                                    'focus:outline-none',
                                    active
                                        ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-slate-900 border border-black/10'
                                        : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
                                )}
                                style={active ? activeStyle : undefined}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {moreOptions.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]">
                            More…
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 rounded-2xl p-1.5 border border-black/10 shadow-xl bg-white">
                        {moreOptions.map((opt) => {
                            const active = value === opt.value
                            return (
                                <DropdownMenuItem
                                    key={opt.value}
                                    className="rounded-xl cursor-pointer flex items-center justify-between"
                                    onSelect={(e) => {
                                        e.preventDefault()
                                        onChange(opt.value)
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        {active ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
                                        {opt.label}
                                    </span>
                                </DropdownMenuItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}

/** ⌘K palette (mobile-safe height + scroll) */
function CommandPalette({ open, onClose, primary, patientTypeFilter, onPickPatient, fallbackPatients = [] }) {
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [idx, setIdx] = useState(0)
    const [err, setErr] = useState('')
    const inputRef = useRef(null)

    const seqRef = useRef(0)
    const timerRef = useRef(null)

    const defaultRows = useMemo(() => (fallbackPatients || []).slice(0, 10), [fallbackPatients])

    useEffect(() => {
        if (!open) return
        setErr('')
        setQ('')
        setRows(defaultRows)
        setIdx(0)
        const t = setTimeout(() => inputRef.current?.focus?.(), 50)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        if (!open) return
        if (timerRef.current) clearTimeout(timerRef.current)

        const query = (q || '').trim()
        if (!query) {
            setRows(defaultRows)
            setLoading(false)
            setIdx(0)
            return
        }

        timerRef.current = setTimeout(async () => {
            const mySeq = ++seqRef.current
            setLoading(true)
            setErr('')
            try {
                const params = { q: query, limit: 50, offset: 0 }
                if (patientTypeFilter) params.patient_type = patientTypeFilter

                const res = await listPatients(params)
                if (seqRef.current !== mySeq) return

                setRows(res.data || [])
                setIdx(0)
            } catch (e) {
                if (seqRef.current !== mySeq) return
                setErr(e?.response?.data?.detail || e?.message || 'Search failed')
            } finally {
                if (seqRef.current === mySeq) setLoading(false)
            }
        }, 250)

        return () => timerRef.current && clearTimeout(timerRef.current)
    }, [q, open, patientTypeFilter, defaultRows])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (e) => e.key === 'Escape' && onClose?.()
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [open, onClose])

    if (!open) return null

    const pick = (p) => {
        if (!p) return
        onPickPatient?.(p)
        onClose?.()
    }

    const accent = {
        backgroundColor: alphaHex(primary, '12') || '#eff6ff',
        borderColor: alphaHex(primary, '22') || '#bfdbfe',
        color: primary,
    }

    return (
        <div
            className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm flex items-start justify-center px-3 py-6 sm:py-10"
            onMouseDown={onClose}
        >
            <div
                className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-black/10">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-2xl grid place-items-center border" style={accent}>
                            <Command className="h-4 w-4" />
                        </div>

                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                ref={inputRef}
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault()
                                        setIdx((v) => Math.min(v + 1, Math.max(0, rows.length - 1)))
                                    }
                                    if (e.key === 'ArrowUp') {
                                        e.preventDefault()
                                        setIdx((v) => Math.max(0, v - 1))
                                    }
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        pick(rows[idx] || rows[0])
                                    }
                                }}
                                className="h-11 rounded-2xl pl-10 pr-24 border-black/10 bg-white focus-visible:ring-black/10"
                                placeholder="Search patients… (UHID / Name / Phone)"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {!!q && (
                                    <button
                                        type="button"
                                        onClick={() => setQ('')}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/[0.04]"
                                        title="Clear"
                                    >
                                        <X className="h-4 w-4 text-slate-500" />
                                    </button>
                                )}
                                <div className="hidden sm:flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] text-slate-600">
                                    <span>Esc</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <div>{loading ? 'Searching…' : q?.trim() ? `${rows.length} result(s)` : 'Type to search (server)'}</div>
                        <div className="hidden sm:block">↑↓ to navigate · Enter to open</div>
                    </div>

                    {err && (
                        <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                            {err}
                        </div>
                    )}
                </div>

                <div className="max-h-[70vh] sm:max-h-[60vh] overflow-auto">
                    {rows.length === 0 && !loading ? (
                        <div className="px-4 py-10 text-center text-slate-500">
                            <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] grid place-items-center">
                                <Inbox className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="mt-3 font-semibold text-slate-900">No matches</div>
                            <div className="mt-1 text-[12px] text-slate-500">Try a different keyword.</div>
                        </div>
                    ) : (
                        <ul className="divide-y divide-black/5">
                            {rows.map((p, i) => {
                                const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
                                const active = p.is_active !== false
                                const selected = i === idx
                                const pregnant = boolish(p.is_pregnant)
                                const rch = String(p.rch_id || '').trim()

                                return (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onMouseEnter={() => setIdx(i)}
                                            onClick={() => pick(p)}
                                            className={cx(
                                                'w-full text-left px-4 py-3 flex items-center gap-3 transition',
                                                selected ? 'bg-black/[0.03]' : 'hover:bg-black/[0.02]'
                                            )}
                                        >
                                            <div
                                                className="h-10 w-10 rounded-2xl grid place-items-center border"
                                                style={{
                                                    backgroundColor: alphaHex(primary, '12') || '#eff6ff',
                                                    borderColor: alphaHex(primary, '22') || '#bfdbfe',
                                                    color: primary,
                                                }}
                                            >
                                                <span className="text-[12px] font-extrabold">{initials(p.first_name, p.last_name)}</span>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-slate-900 truncate">{fullName}</div>
                                                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                                                            <span className="font-mono text-[11px] bg-black/[0.04] border border-black/10 rounded-full px-2 py-0.5">
                                                                {p.uhid || '—'}
                                                            </span>
                                                            {p.phone && (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                                    {p.phone}
                                                                </span>
                                                            )}
                                                            <Badge variant="secondary" className="rounded-full border border-black/10 bg-black/[0.03] text-slate-700">
                                                                {active ? 'Active' : 'Inactive'}
                                                            </Badge>

                                                            {pregnant && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] text-violet-700">
                                                                    <Baby className="h-3.5 w-3.5" />
                                                                    Pregnant
                                                                </span>
                                                            )}
                                                            {rch && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-black/10 px-2 py-0.5 text-[11px] text-slate-700">
                                                                    <IdCard className="h-3.5 w-3.5 text-slate-500" />
                                                                    RCH: {rch}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <ChevronRight className={cx('h-5 w-5', selected ? 'text-slate-500' : 'text-slate-300')} />
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ------------------------- Filters ------------------------- */
const FILTER_DEFAULT = {
    status: 'all', // all | active | inactive
    gender: 'all', // all | male | female | other
    pregnancy: 'all', // all | pregnant | not_pregnant
    blood_group: '',
    tag_contains: '',
    has_phone: false,
    has_email: false,
    age_min: '',
    age_max: '',
    reg_from: '',
    reg_to: '',
    sort_by: 'recent', // recent | name | uhid | age
    sort_dir: 'desc', // asc | desc
}

const VIEWS_KEY = 'nutryah_patient_views_v1'

function FilterChip({ label, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {label}
            <button
                type="button"
                className="h-5 w-5 rounded-full hover:bg-black/[0.05] grid place-items-center"
                onClick={onRemove}
                title="Remove"
            >
                <X className="h-3.5 w-3.5 text-slate-500" />
            </button>
        </span>
    )
}

function NativeSelect({ value, onChange, children }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full rounded-2xl border border-black/10 bg-white px-3 text-[13px] text-slate-900 outline-none focus-visible:ring-black/10"
        >
            {children}
        </select>
    )
}

function FiltersDialog({ open, onOpenChange, filters, setFilters, primary }) {
    const accent = {
        backgroundColor: alphaHex(primary, '10') || '#eff6ff',
        borderColor: alphaHex(primary, '22') || '#bfdbfe',
        color: primary,
    }

    const set = (k, v) => setFilters((p) => ({ ...p, [k]: v }))
    const toggle = (k) => setFilters((p) => ({ ...p, [k]: !p[k] }))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cx(
                    'p-0 overflow-hidden',
                    'w-[calc(100vw-1.25rem)] sm:w-full',
                    'max-w-3xl rounded-3xl border border-black/10 bg-white'
                )}
            >
                <DialogHeader className="px-5 py-4 border-b border-black/10">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <DialogTitle className="text-[16px] font-semibold tracking-tight">Advanced Filters</DialogTitle>
                            <div className="text-[12px] text-slate-500 mt-1">Filtering + sorting.</div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1 border" style={accent}>
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-2xl"
                                onClick={() => onOpenChange(false)}
                                title="Close"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="max-h-[78vh] overflow-auto">
                    <div className="p-5 grid gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Status</div>
                                <NativeSelect value={filters.status} onChange={(v) => set('status', v)}>
                                    <option value="all">All</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </NativeSelect>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Gender</div>
                                <NativeSelect value={filters.gender} onChange={(v) => set('gender', v)}>
                                    <option value="all">All</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </NativeSelect>
                            </div>

                            {/* ✅ Pregnancy / RCH filter (safe even if backend doesn't return is_pregnant yet) */}
                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Pregnancy</div>
                                <NativeSelect value={filters.pregnancy} onChange={(v) => set('pregnancy', v)}>
                                    <option value="all">All</option>
                                    <option value="pregnant">Pregnant</option>
                                    <option value="not_pregnant">Not Pregnant</option>
                                </NativeSelect>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Blood Group</div>
                                <Input
                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                    placeholder="A+ / O- / AB+"
                                    value={filters.blood_group}
                                    onChange={(e) => set('blood_group', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Age Min</div>
                                <Input
                                    inputMode="numeric"
                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                    placeholder="e.g., 18"
                                    value={filters.age_min}
                                    onChange={(e) => set('age_min', e.target.value.replace(/\D/g, ''))}
                                />
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Age Max</div>
                                <Input
                                    inputMode="numeric"
                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                    placeholder="e.g., 60"
                                    value={filters.age_max}
                                    onChange={(e) => set('age_max', e.target.value.replace(/\D/g, ''))}
                                />
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Tag Contains</div>
                                <Input
                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                    placeholder="VIP / Staff / Corporate"
                                    value={filters.tag_contains}
                                    onChange={(e) => set('tag_contains', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Registered From</div>
                                <Input
                                    type="date"
                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                    value={filters.reg_from}
                                    onChange={(e) => set('reg_from', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Registered To</div>
                                <Input
                                    type="date"
                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                    value={filters.reg_to}
                                    onChange={(e) => set('reg_to', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase">Sort</div>
                                <div className="flex gap-2">
                                    <NativeSelect value={filters.sort_by} onChange={(v) => set('sort_by', v)}>
                                        <option value="recent">Recent</option>
                                        <option value="name">Name</option>
                                        <option value="uhid">UHID</option>
                                        <option value="age">Age</option>
                                    </NativeSelect>
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                        onClick={() => set('sort_dir', filters.sort_dir === 'asc' ? 'desc' : 'asc')}
                                        title="Toggle sort direction"
                                    >
                                        <ArrowDownUp className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    className={cx(
                                        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold border border-black/10',
                                        filters.has_phone ? 'bg-white' : 'bg-black/[0.02] hover:bg-black/[0.04]'
                                    )}
                                    onClick={() => toggle('has_phone')}
                                >
                                    <Phone className="h-4 w-4 text-slate-500" />
                                    Has Phone
                                </button>

                                <button
                                    type="button"
                                    className={cx(
                                        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold border border-black/10',
                                        filters.has_email ? 'bg-white' : 'bg-black/[0.02] hover:bg-black/[0.04]'
                                    )}
                                    onClick={() => toggle('has_email')}
                                >
                                    <Mail className="h-4 w-4 text-slate-500" />
                                    Has Email
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                    onClick={() => setFilters({ ...FILTER_DEFAULT })}
                                >
                                    Reset
                                </Button>
                                <Button className="rounded-2xl shadow-sm" style={{ backgroundColor: primary }} onClick={() => onOpenChange(false)}>
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ViewsMenu({ primary, onSave, views, onApply, onDelete }) {
    const accent = {
        backgroundColor: alphaHex(primary, '10') || '#eff6ff',
        borderColor: alphaHex(primary, '22') || '#bfdbfe',
        color: primary,
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]" title="Saved Views">
                    <Bookmark className="h-4 w-4 mr-2" />
                    Views
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-2xl p-1.5 border border-black/10 shadow-xl bg-white">
                <DropdownMenuItem
                    className="rounded-xl cursor-pointer"
                    onSelect={(e) => {
                        e.preventDefault()
                        onSave?.()
                    }}
                >
                    <span className="inline-flex items-center gap-2">
                        <span className="h-8 w-8 rounded-2xl grid place-items-center border" style={accent}>
                            <Bookmark className="h-4 w-4" />
                        </span>
                        Save current view
                    </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {views.length === 0 ? (
                    <div className="px-3 py-2 text-[12px] text-slate-500">No saved views yet.</div>
                ) : (
                    views.map((v) => (
                        <div key={v.name} className="flex items-center justify-between gap-2 px-1">
                            <DropdownMenuItem
                                className="rounded-xl cursor-pointer flex-1"
                                onSelect={(e) => {
                                    e.preventDefault()
                                    onApply?.(v)
                                }}
                            >
                                {v.name}
                            </DropdownMenuItem>
                            <button
                                type="button"
                                className="h-9 w-9 rounded-xl hover:bg-rose-50 grid place-items-center"
                                title="Delete view"
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onDelete?.(v)
                                }}
                            >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                            </button>
                        </div>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/* ------------------------- Pagination ------------------------- */
const PAGE_SIZES = [10, 20, 30, 40, 100, 'All']

function PaginationBar({ total, page, setPage, pageSize, setPageSize }) {
    const pages = useMemo(() => {
        if (pageSize === 'All') return 1
        const n = Math.max(1, Math.ceil((total || 0) / Number(pageSize || 20)))
        return n
    }, [total, pageSize])

    useEffect(() => {
        setPage((p) => Math.min(Math.max(1, p), pages))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pages])

    const canPrev = page > 1
    const canNext = page < pages

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-black/10 bg-white/80 backdrop-blur">
            <div className="text-[12px] text-slate-600 flex items-center gap-2">
                <span className="font-semibold text-slate-800 tabular-nums">{total || 0}</span>
                <span>records</span>
                <span className="text-slate-300">•</span>
                <span className="tabular-nums">
                    Page <span className="font-semibold text-slate-800">{page}</span> / {pages}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
                <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-600">Show</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(e.target.value === 'All' ? 'All' : Number(e.target.value))}
                        className="h-9 rounded-2xl border border-black/10 bg-white px-3 text-[13px] outline-none"
                    >
                        {PAGE_SIZES.map((s) => (
                            <option key={String(s)} value={String(s)}>
                                {String(s)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="h-9 rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                        disabled={!canPrev || pageSize === 'All'}
                        onClick={() => canPrev && setPage(page - 1)}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Prev
                    </Button>
                    <Button
                        variant="outline"
                        className="h-9 rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                        disabled={!canNext || pageSize === 'All'}
                        onClick={() => canNext && setPage(page + 1)}
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

/* ------------------------- Page ------------------------- */
export default function PatientPage() {
    const { branding } = useBranding() || {}
    const primary = branding?.primary_color || '#2563eb'
    const secondary = branding?.secondary_color || primary

    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [loadedCount, setLoadedCount] = useState(0)

    const [q, setQ] = useState('')
    const [error, setError] = useState('')

    const [formOpen, setFormOpen] = useState(false)
    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [editingPatient, setEditingPatient] = useState(null)

    const [paletteOpen, setPaletteOpen] = useState(false)

    const [lookups, setLookups] = useState({
        refSources: [],
        doctors: [],
        payers: [],
        tpas: [],
        creditPlans: [],
        patientTypes: [],
    })

    // Server filter
    const [patientTypeFilter, setPatientTypeFilter] = useState('')

    // Export
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [exporting, setExporting] = useState(false)

    // Local filters
    const [filters, setFilters] = useState({ ...FILTER_DEFAULT })
    const [filtersOpen, setFiltersOpen] = useState(false)

    // Views
    const [views, setViews] = useState(() => {
        try {
            const raw = localStorage.getItem(VIEWS_KEY)
            const parsed = raw ? JSON.parse(raw) : []
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    })

    // Pagination
    const [pageSize, setPageSize] = useState(100)
    const [page, setPage] = useState(1)

    const patientTypeOptions = useMemo(() => lookups.patientTypes || [], [lookups.patientTypes])

    const baseStats = useMemo(() => {
        const total = patients.length
        const active = patients.filter((p) => p.is_active !== false).length
        const preg = patients.filter((p) => boolish(p.is_pregnant)).length
        return { total, active, inactive: total - active, pregnant: preg }
    }, [patients])

    const activeTypeLabel = useMemo(() => {
        if (!patientTypeFilter) return 'All'
        const hit = patientTypeOptions.find((x) => (x.code || x.name) === patientTypeFilter)
        return hit?.name || hit?.code || patientTypeFilter
    }, [patientTypeFilter, patientTypeOptions])

    const loadSeqRef = useRef(0)

    const loadPatients = useCallback(
        async (search = q, patientType = patientTypeFilter) => {
            const seq = ++loadSeqRef.current
            setError('')
            setLoadedCount(0)

            const baseParams = buildServerParams(search, patientType)

            setLoading(true)
            setLoadingMore(false)
            setPatients([])

            try {
                let offset = 0
                let totalLoaded = 0
                let pageNo = 0

                while (pageNo < MAX_PAGES_GUARD) {
                    pageNo += 1
                    const res = await listPatients({ ...baseParams, limit: SERVER_PAGE_LIMIT, offset })
                    if (loadSeqRef.current !== seq) return

                    const batch = res?.data || []
                    totalLoaded += batch.length
                    setLoadedCount(totalLoaded)

                    if (offset === 0) {
                        setPatients(batch)
                        setLoading(false)
                    } else {
                        setPatients((prev) => prev.concat(batch))
                    }

                    if (batch.length < SERVER_PAGE_LIMIT) break
                    offset += SERVER_PAGE_LIMIT
                    setLoadingMore(true)
                }

                setLoading(false)
                setLoadingMore(false)
            } catch (err) {
                if (loadSeqRef.current !== seq) return
                const msg = err?.response?.data?.detail || err?.message || 'Failed to load patients'
                setError(msg)
                toast.error('Failed to load patients', { description: msg })
                setLoading(false)
                setLoadingMore(false)
            }
        },
        [q, patientTypeFilter]
    )

    const loadLookups = useCallback(async () => {
        try {
            const res = await getPatientMastersAll()
            const data = res.data || {}
            setLookups({
                refSources: data.reference_sources || [],
                doctors: data.doctors || [],
                payers: data.payers || [],
                tpas: data.tpas || [],
                creditPlans: data.credit_plans || [],
                patientTypes: data.patient_types || [],
            })
        } catch {
            // ignore
        }
    }, [])

    useEffect(() => {
        loadPatients('', '')
        loadLookups()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ⌘K / Ctrl+K
    useEffect(() => {
        const onKeyDown = (e) => {
            const plat = (navigator?.platform || '').toLowerCase()
            const isMac = plat.includes('mac')
            const mod = isMac ? e.metaKey : e.ctrlKey
            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setPaletteOpen(true)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    const handleSearchSubmit = (e) => {
        e.preventDefault()
        setPage(1)
        loadPatients(q, patientTypeFilter)
    }

    const handlePatientType = (codeOrEmpty) => {
        setPatientTypeFilter(codeOrEmpty)
        setPage(1)
        loadPatients(q, codeOrEmpty)
    }

    const handleResetAll = () => {
        setPatientTypeFilter('')
        setQ('')
        setFilters({ ...FILTER_DEFAULT })
        setPage(1)
        loadPatients('', '')
    }

    const handleNew = () => {
        setEditingPatient(null)
        setFormOpen(true)
    }

    const handleEdit = (p) => {
        setEditingPatient(p)
        setFormOpen(true)
    }

    const handleView = (p) => {
        setSelectedPatient(p)
        setDetailOpen(true)
    }

    const handleDeactivate = async (p) => {
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'this patient'
        if (!window.confirm(`Deactivate ${name}?`)) return
        try {
            await deactivatePatient(p.id)
            toast.success('Patient deactivated.')
            await loadPatients(q, patientTypeFilter)
        } catch (err) {
            const msg = err?.response?.data?.detail || err?.message || 'Failed to deactivate patient'
            toast.error('Failed to deactivate patient', { description: msg })
        }
    }

    const updatePatientInList = (updated) => {
        setPatients((prev) => {
            const idx = prev.findIndex((x) => x.id === updated.id)
            if (idx === -1) return prev
            const clone = [...prev]
            clone[idx] = updated
            return clone
        })
    }

    const handleExportExcel = async () => {
        if (!fromDate || !toDate) {
            toast.warning('Please select From and To date for Excel export.')
            return
        }
        if (toDate < fromDate) {
            toast.warning('To Date must be on or after From Date.')
            return
        }

        setExporting(true)
        try {
            const params = { from_date: fromDate, to_date: toDate }
            if (patientTypeFilter) params.patient_type = patientTypeFilter

            const res = await exportPatientsExcel(params)
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `patients_${fromDate}_to_${toDate}.xlsx`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
            toast.success('Excel downloaded.')
        } catch (err) {
            const msg = err?.response?.data?.detail || err?.message || 'Failed to export Excel.'
            toast.error('Export failed.', { description: msg })
        } finally {
            setExporting(false)
        }
    }

    const segmented = useMemo(() => {
        const all = [{ value: '', label: 'All' }]
        const mapped = patientTypeOptions.map((x) => ({
            value: x.code || x.name,
            label: x.name || x.code,
        }))

        const MAX_MAIN = 6
        const main = all.concat(mapped).slice(0, MAX_MAIN + 1)
        const rest = all.concat(mapped).slice(MAX_MAIN + 1)

        return { main, rest }
    }, [patientTypeOptions])

    const accentHint = {
        backgroundColor: alphaHex(primary, '12') || '#eff6ff',
        borderColor: alphaHex(primary, '22') || '#bfdbfe',
        color: primary,
    }

    const hasAnyLocalFilter = useMemo(() => {
        const f = filters
        return (
            f.status !== 'all' ||
            f.gender !== 'all' ||
            f.pregnancy !== 'all' ||
            !!String(f.blood_group || '').trim() ||
            !!String(f.tag_contains || '').trim() ||
            !!String(f.age_min || '').trim() ||
            !!String(f.age_max || '').trim() ||
            !!String(f.reg_from || '').trim() ||
            !!String(f.reg_to || '').trim() ||
            f.has_phone ||
            f.has_email ||
            f.sort_by !== FILTER_DEFAULT.sort_by ||
            f.sort_dir !== FILTER_DEFAULT.sort_dir
        )
    }, [filters])

    const filteredPatients = useMemo(() => {
        const f = filters
        const bgNeed = String(f.blood_group || '').trim().toLowerCase()
        const tagNeed = String(f.tag_contains || '').trim().toLowerCase()
        const ageMin = f.age_min ? Number(f.age_min) : null
        const ageMax = f.age_max ? Number(f.age_max) : null

        const regFrom = f.reg_from ? new Date(`${f.reg_from}T00:00:00`) : null
        const regTo = f.reg_to ? new Date(`${f.reg_to}T23:59:59`) : null

        let rows = (patients || []).filter((p) => {
            if (f.status === 'active' && p.is_active === false) return false
            if (f.status === 'inactive' && p.is_active !== false) return false

            if (f.gender !== 'all') {
                const g = String(p.gender || '').toLowerCase()
                if (g !== f.gender) return false
            }

            if (f.pregnancy !== 'all') {
                const preg = boolish(p.is_pregnant)
                if (f.pregnancy === 'pregnant' && !preg) return false
                if (f.pregnancy === 'not_pregnant' && preg) return false
            }

            if (bgNeed) {
                const bg = String(p.blood_group || '').toLowerCase()
                if (!bg.includes(bgNeed)) return false
            }

            if (tagNeed) {
                const t = String(p.tag || '').toLowerCase()
                if (!t.includes(tagNeed)) return false
            }

            if (f.has_phone && !String(p.phone || '').trim()) return false
            if (f.has_email && !String(p.email || '').trim()) return false

            if (ageMin !== null || ageMax !== null) {
                const age = extractAgeYears(p)
                if (age === null) return false
                if (ageMin !== null && age < ageMin) return false
                if (ageMax !== null && age > ageMax) return false
            }

            if (regFrom || regTo) {
                const dt = getCreatedDate(p)
                if (!dt) return false
                if (regFrom && dt < regFrom) return false
                if (regTo && dt > regTo) return false
            }

            return true
        })

        const dir = f.sort_dir === 'asc' ? 1 : -1
        rows.sort((a, b) => {
            if (f.sort_by === 'name') {
                const an = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
                const bn = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
                return an.localeCompare(bn) * dir
            }
            if (f.sort_by === 'uhid') {
                const au = String(a.uhid || '').toLowerCase()
                const bu = String(b.uhid || '').toLowerCase()
                return au.localeCompare(bu) * dir
            }
            if (f.sort_by === 'age') {
                const aa = extractAgeYears(a) ?? -1
                const ba = extractAgeYears(b) ?? -1
                return (aa - ba) * dir
            }
            const ad = getCreatedDate(a)?.getTime?.() || 0
            const bd = getCreatedDate(b)?.getTime?.() || 0
            return (ad - bd) * dir
        })

        return rows
    }, [patients, filters])

    useEffect(() => {
        setPage(1)
    }, [q, patientTypeFilter, filters])

    const shownStats = useMemo(() => {
        const total = filteredPatients.length
        const active = filteredPatients.filter((p) => p.is_active !== false).length
        const preg = filteredPatients.filter((p) => boolish(p.is_pregnant)).length
        return { total, active, inactive: total - active, pregnant: preg }
    }, [filteredPatients])

    const chips = useMemo(() => {
        const f = filters
        const out = []

        if (f.status !== 'all') out.push({ k: 'status', label: `Status: ${f.status}` })
        if (f.gender !== 'all') out.push({ k: 'gender', label: `Gender: ${f.gender}` })
        if (f.pregnancy !== 'all') out.push({ k: 'pregnancy', label: `Pregnancy: ${f.pregnancy.replace('_', ' ')}` })
        if (String(f.blood_group || '').trim()) out.push({ k: 'blood_group', label: `Blood: ${f.blood_group}` })
        if (String(f.tag_contains || '').trim()) out.push({ k: 'tag_contains', label: `Tag: ${f.tag_contains}` })
        if (f.has_phone) out.push({ k: 'has_phone', label: 'Has Phone' })
        if (f.has_email) out.push({ k: 'has_email', label: 'Has Email' })
        if (String(f.age_min || '').trim() || String(f.age_max || '').trim()) {
            out.push({ k: 'age', label: `Age: ${f.age_min || '…'}–${f.age_max || '…'}` })
        }
        if (String(f.reg_from || '').trim() || String(f.reg_to || '').trim()) {
            out.push({ k: 'reg', label: `Reg: ${f.reg_from || '…'} → ${f.reg_to || '…'}` })
        }
        if (f.sort_by !== FILTER_DEFAULT.sort_by || f.sort_dir !== FILTER_DEFAULT.sort_dir) {
            out.push({ k: 'sort', label: `Sort: ${f.sort_by} (${f.sort_dir})` })
        }

        return out
    }, [filters])

    const clearChip = (k) => {
        if (k === 'age') return setFilters((p) => ({ ...p, age_min: '', age_max: '' }))
        if (k === 'reg') return setFilters((p) => ({ ...p, reg_from: '', reg_to: '' }))
        if (k === 'sort')
            return setFilters((p) => ({ ...p, sort_by: FILTER_DEFAULT.sort_by, sort_dir: FILTER_DEFAULT.sort_dir }))
        if (k === 'has_phone') return setFilters((p) => ({ ...p, has_phone: false }))
        if (k === 'has_email') return setFilters((p) => ({ ...p, has_email: false }))
        setFilters((p) => ({ ...p, [k]: FILTER_DEFAULT[k] }))
    }

    const saveView = () => {
        const name = window.prompt('View name? (e.g., Active OPD VIP)')
        if (!name) return
        const next = [...views.filter((v) => v.name !== name), { name, q, patientTypeFilter, filters }]
        setViews(next)
        try {
            localStorage.setItem(VIEWS_KEY, JSON.stringify(next))
        } catch {
            // ignore
        }
        toast.success('View saved.')
    }

    const applyView = (v) => {
        setQ(v.q || '')
        setPatientTypeFilter(v.patientTypeFilter || '')
        setFilters(v.filters || { ...FILTER_DEFAULT })
        setPage(1)
        loadPatients(v.q || '', v.patientTypeFilter || '')
        toast.success('View applied.')
    }

    const deleteView = (v) => {
        const ok = window.confirm(`Delete view "${v.name}"?`)
        if (!ok) return
        const next = views.filter((x) => x.name !== v.name)
        setViews(next)
        try {
            localStorage.setItem(VIEWS_KEY, JSON.stringify(next))
        } catch {
            // ignore
        }
        toast.success('View deleted.')
    }

    const pagedPatients = useMemo(() => {
        if (pageSize === 'All') return filteredPatients
        const size = Number(pageSize || 20)
        const start = (page - 1) * size
        return filteredPatients.slice(start, start + size)
    }, [filteredPatients, page, pageSize])

    return (
        <div className="h-full min-h-0 w-full bg-slate-50 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="mx-auto w-full max-w-[1680px] px-3 sm:px-5 lg:px-6 py-4 flex flex-col gap-4">
                    <Card className="rounded-3xl border-black/10 bg-white/90 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold tracking-tight border" style={accentHint}>
                                        <Users className="h-4 w-4" />
                                        Patient Registry
                                    </div>

                                    <CardTitle className="mt-2 text-[22px] sm:text-[26px] tracking-tight font-semibold">
                                        Patient Management
                                    </CardTitle>

                                    <p className="mt-1 text-[13px] text-slate-600 max-w-2xl leading-relaxed">
                                        UHID search, responsive filters, saved views, export, and quick profile actions.
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                                        <StatPill label="Showing" value={`${shownStats.total}/${baseStats.total}`} tone="sky" />
                                        <StatPill label="Active" value={shownStats.active} tone="emerald" />
                                        {shownStats.inactive > 0 && <StatPill label="Inactive" value={shownStats.inactive} tone="rose" />}
                                        {shownStats.pregnant > 0 && <StatPill label="Pregnant" value={shownStats.pregnant} tone="violet" />}

                                        <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-semibold text-slate-700">
                                            <Tag className="h-4 w-4 opacity-70" />
                                            Type: {activeTypeLabel}
                                        </div>

                                        {(loadingMore || (loading && loadedCount > 0)) && (
                                            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                                                <RefreshCcw className="h-4 w-4 animate-spin" />
                                                Loading more… ({loadedCount})
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full lg:w-auto">
                                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:justify-end">
                                        <ViewsMenu primary={primary} onSave={saveView} views={views} onApply={applyView} onDelete={deleteView} />

                                        <Button
                                            variant="outline"
                                            className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                            onClick={() => setFiltersOpen(true)}
                                            title="Advanced Filters"
                                        >
                                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                                            Filters
                                        </Button>

                                        <Button
                                            variant="outline"
                                            className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                            onClick={() => loadPatients(q, patientTypeFilter)}
                                            title="Reload"
                                            disabled={loading || loadingMore}
                                        >
                                            <RefreshCcw className={cx('h-4 w-4 mr-2', (loading || loadingMore) && 'animate-spin')} />
                                            Reload
                                        </Button>

                                        <Button
                                            className="rounded-2xl shadow-sm active:scale-[0.99] transition"
                                            style={{ backgroundColor: primary }}
                                            onClick={handleNew}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            New Patient
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <div className="grid gap-3">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                    <form onSubmit={handleSearchSubmit} className="w-full lg:max-w-xl">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                className="h-11 rounded-2xl pl-10 pr-24 border-black/10 bg-white focus-visible:ring-black/10"
                                                placeholder="Search UHID, Name, Mobile, Email..."
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                            />

                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {!!q && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setQ('')
                                                            setPage(1)
                                                            loadPatients('', patientTypeFilter)
                                                        }}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/[0.04]"
                                                        title="Clear"
                                                    >
                                                        <X className="h-4 w-4 text-slate-500" />
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => setPaletteOpen(true)}
                                                    className="hidden sm:inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] text-slate-600 hover:bg-black/[0.05]"
                                                    title="Quick Search"
                                                >
                                                    <Command className="h-3.5 w-3.5" />
                                                    <span>⌘K</span>
                                                </button>
                                            </div>
                                        </div>
                                    </form>

                                    <div className="grid grid-cols-2 sm:flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                            onClick={handleResetAll}
                                        >
                                            Reset All
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                            onClick={() => {
                                                setPage(1)
                                                loadPatients(q, patientTypeFilter)
                                            }}
                                        >
                                            Apply Server
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <div className="text-[12px] font-semibold text-slate-600 shrink-0">Patient Type</div>
                                    <SegmentedControl
                                        value={patientTypeFilter}
                                        onChange={handlePatientType}
                                        primary={primary}
                                        options={segmented.main}
                                        moreOptions={segmented.rest}
                                    />
                                </div>

                                {hasAnyLocalFilter && (
                                    <div className="flex flex-wrap gap-2">
                                        {chips.map((c) => (
                                            <FilterChip key={c.k} label={c.label} onRemove={() => clearChip(c.k)} />
                                        ))}
                                        <Button
                                            variant="outline"
                                            className="h-8 rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                            onClick={() => setFilters({ ...FILTER_DEFAULT })}
                                        >
                                            Clear Filters
                                        </Button>
                                    </div>
                                )}

                                <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-3">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                            <CalendarDays className="h-4 w-4 text-slate-500" />
                                            Export Patients
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:max-w-[720px]">
                                            <div className="grid gap-1">
                                                <label className="text-[11px] font-semibold text-slate-600">From</label>
                                                <Input
                                                    type="date"
                                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                                    value={fromDate}
                                                    onChange={(e) => setFromDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <label className="text-[11px] font-semibold text-slate-600">To</label>
                                                <Input
                                                    type="date"
                                                    className="h-10 rounded-2xl border-black/10 bg-white focus-visible:ring-black/10"
                                                    value={toDate}
                                                    onChange={(e) => setToDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <Button
                                                    className="w-full h-10 rounded-2xl shadow-sm"
                                                    disabled={exporting}
                                                    onClick={handleExportExcel}
                                                    style={{ backgroundColor: secondary }}
                                                >
                                                    <FileDown className="h-4 w-4 mr-2" />
                                                    {exporting ? 'Exporting…' : 'Export Excel'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {!!error && (
                                    <div className="rounded-3xl border border-rose-200 bg-rose-50 px-3 py-2 flex items-start gap-2 text-rose-700">
                                        <AlertCircle className="h-4 w-4 mt-0.5" />
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-semibold">Unable to load patients</div>
                                            <div className="text-[12px] break-words">{error}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* LIST AREA */}
                    <div className="grid gap-3">
                        {/* Desktop table */}
                        <div className="hidden md:block">
                            <Card className="rounded-3xl border-black/10 bg-white/90 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                                <div className="max-h-[calc(100vh-320px)] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/10">
                                            <tr>
                                                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Patient
                                                </th>
                                                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Demographics
                                                </th>
                                                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Contact
                                                </th>
                                                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Tags
                                                </th>
                                                <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-black/5">
                                            {loading && (
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                                                        Loading patients…
                                                    </td>
                                                </tr>
                                            )}

                                            {!loading && pagedPatients.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-14 text-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="h-12 w-12 rounded-3xl bg-black/[0.04] grid place-items-center">
                                                                <Inbox className="h-6 w-6 text-slate-400" />
                                                            </div>
                                                            <div className="font-semibold text-slate-900">
                                                                {patients.length === 0 ? 'No patients found' : 'No matches for filters'}
                                                            </div>
                                                            <div className="text-[12px] text-slate-500">
                                                                {patients.length === 0
                                                                    ? 'Try search / filters or create a new patient.'
                                                                    : 'Clear filters or widen conditions.'}
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 mt-2 justify-center">
                                                                {patients.length === 0 ? (
                                                                    <Button className="rounded-2xl mt-1 shadow-sm" style={{ backgroundColor: primary }} onClick={handleNew}>
                                                                        <Plus className="h-4 w-4 mr-2" />
                                                                        New Patient
                                                                    </Button>
                                                                ) : (
                                                                    <>
                                                                        <Button
                                                                            variant="outline"
                                                                            className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                                                            onClick={() => setFilters({ ...FILTER_DEFAULT })}
                                                                        >
                                                                            Clear Filters
                                                                        </Button>
                                                                        <Button className="rounded-2xl shadow-sm" style={{ backgroundColor: primary }} onClick={() => setFiltersOpen(true)}>
                                                                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                                                                            Edit Filters
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {!loading &&
                                                pagedPatients.map((p) => {
                                                    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
                                                    const active = p.is_active !== false
                                                    const pregnant = boolish(p.is_pregnant)
                                                    const rch = String(p.rch_id || '').trim()

                                                    return (
                                                        <tr
                                                            key={p.id}
                                                            className="group hover:bg-black/[0.02] cursor-pointer transition"
                                                            onClick={() => handleView(p)}
                                                        >
                                                            <td className="px-5 py-4 align-top">
                                                                <div className="flex items-start gap-3">
                                                                    <div
                                                                        className="h-11 w-11 rounded-2xl grid place-items-center border"
                                                                        style={{
                                                                            backgroundColor: alphaHex(primary, '12') || '#eff6ff',
                                                                            borderColor: alphaHex(primary, '22') || '#bfdbfe',
                                                                            color: primary,
                                                                        }}
                                                                    >
                                                                        <span className="text-[12px] font-extrabold">{initials(p.first_name, p.last_name)}</span>
                                                                    </div>

                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <div className="font-semibold text-slate-900 truncate">{fullName}</div>
                                                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                                                                                    <span className="font-mono text-[11px] bg-black/[0.04] border border-black/10 rounded-full px-2 py-0.5">
                                                                                        {p.uhid || '—'}
                                                                                    </span>
                                                                                    <span>Age: {p.age_text || '—'}</span>
                                                                                    <span className="text-slate-300">•</span>
                                                                                    <span>{p.gender || '—'}</span>

                                                                                    <Badge variant="secondary" className="rounded-full border border-black/10 bg-black/[0.03] text-slate-700">
                                                                                        {active ? 'Active' : 'Inactive'}
                                                                                    </Badge>

                                                                                    {pregnant && (
                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] text-violet-700">
                                                                                            <Baby className="h-3.5 w-3.5" />
                                                                                            Pregnant
                                                                                        </span>
                                                                                    )}
                                                                                    {rch && (
                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-black/10 px-2 py-0.5 text-[11px] text-slate-700">
                                                                                            <IdCard className="h-3.5 w-3.5 text-slate-500" />
                                                                                            RCH: {rch}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <ChevronRight className="h-5 w-5 text-slate-300 opacity-0 group-hover:opacity-100 transition" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4 align-top text-[12px] text-slate-700">
                                                                <div>Blood: {p.blood_group || '—'}</div>
                                                                <div className="mt-1">Marital: {p.marital_status || '—'}</div>
                                                                <div className="mt-1">Type: {p.patient_type || '—'}</div>
                                                            </td>

                                                            <td className="px-5 py-4 align-top text-[12px] text-slate-700">
                                                                <div className="flex items-center gap-2">
                                                                    <Phone className="h-4 w-4 text-slate-400" />
                                                                    <span>{p.phone || '—'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Mail className="h-4 w-4 text-slate-400" />
                                                                    <span className="truncate max-w-[260px]">{p.email || '—'}</span>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4 align-top">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {p.patient_type && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] border border-black/10 px-2.5 py-1 text-[11px] text-slate-800">
                                                                            <Tag className="h-3.5 w-3.5 text-slate-400" />
                                                                            {p.patient_type}
                                                                        </span>
                                                                    )}
                                                                    {p.tag && (
                                                                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[11px] text-emerald-700">
                                                                            {p.tag}
                                                                        </span>
                                                                    )}
                                                                    {pregnant && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2.5 py-1 text-[11px] text-violet-700">
                                                                            <BadgeCheck className="h-3.5 w-3.5" />
                                                                            ANC
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4 align-top text-right" onClick={(e) => e.stopPropagation()}>
                                                                <RowActions onView={() => handleView(p)} onEdit={() => handleEdit(p)} onDeactivate={() => handleDeactivate(p)} />
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                        </tbody>
                                    </table>
                                </div>

                                <PaginationBar total={filteredPatients.length} page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} />
                            </Card>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden">
                            <Card className="rounded-3xl border-black/10 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                                <div className="max-h-[calc(100vh-280px)] overflow-auto p-3">
                                    <div className="grid gap-3">
                                        {loading && (
                                            <Card className="rounded-3xl border-black/10 bg-white">
                                                <CardContent className="py-6 text-center text-slate-500">Loading…</CardContent>
                                            </Card>
                                        )}

                                        {!loading && pagedPatients.length === 0 && (
                                            <Card className="rounded-3xl border-black/10 bg-white">
                                                <CardContent className="py-8 text-center">
                                                    <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] grid place-items-center">
                                                        <Inbox className="h-6 w-6 text-slate-400" />
                                                    </div>
                                                    <div className="mt-3 font-semibold text-slate-900">
                                                        {patients.length === 0 ? 'No patients found' : 'No matches for filters'}
                                                    </div>
                                                    <div className="mt-1 text-[12px] text-slate-500">
                                                        {patients.length === 0 ? 'Try search or create a patient.' : 'Clear filters or widen conditions.'}
                                                    </div>
                                                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                                                        {patients.length === 0 ? (
                                                            <Button className="rounded-2xl shadow-sm" style={{ backgroundColor: primary }} onClick={handleNew}>
                                                                <Plus className="h-4 w-4 mr-2" />
                                                                New Patient
                                                            </Button>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    className="rounded-2xl border-black/10 bg-white hover:bg-black/[0.03]"
                                                                    onClick={() => setFilters({ ...FILTER_DEFAULT })}
                                                                >
                                                                    Clear Filters
                                                                </Button>
                                                                <Button className="rounded-2xl shadow-sm" style={{ backgroundColor: primary }} onClick={() => setFiltersOpen(true)}>
                                                                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                                                                    Filters
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {!loading &&
                                            pagedPatients.map((p) => {
                                                const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
                                                const active = p.is_active !== false
                                                const pregnant = boolish(p.is_pregnant)
                                                const rch = String(p.rch_id || '').trim()

                                                return (
                                                    <Card
                                                        key={p.id}
                                                        className="rounded-3xl border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                                                        onClick={() => handleView(p)}
                                                    >
                                                        <CardContent className="p-4">
                                                            <div className="flex items-start gap-3">
                                                                <div
                                                                    className="h-11 w-11 rounded-3xl grid place-items-center border"
                                                                    style={{
                                                                        backgroundColor: alphaHex(primary, '12') || '#eff6ff',
                                                                        borderColor: alphaHex(primary, '22') || '#bfdbfe',
                                                                        color: primary,
                                                                    }}
                                                                >
                                                                    <span className="text-[12px] font-extrabold">{initials(p.first_name, p.last_name)}</span>
                                                                </div>

                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="truncate font-semibold text-slate-900">{fullName}</div>
                                                                                <ChevronRight className="h-5 w-5 text-slate-300" />
                                                                            </div>

                                                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                                                                                <span className="font-mono text-[11px] bg-black/[0.04] border border-black/10 rounded-full px-2 py-0.5">
                                                                                    {p.uhid || '—'}
                                                                                </span>
                                                                                <span>Age: {p.age_text || '—'}</span>
                                                                                <span className="text-slate-300">•</span>
                                                                                <span>{p.gender || '—'}</span>

                                                                                {pregnant && (
                                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] text-violet-700">
                                                                                        <Baby className="h-3.5 w-3.5" />
                                                                                        Pregnant
                                                                                    </span>
                                                                                )}
                                                                                {rch && (
                                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-black/10 px-2 py-0.5 text-[11px] text-slate-700">
                                                                                        <IdCard className="h-3.5 w-3.5 text-slate-500" />
                                                                                        RCH: {rch}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                            <Badge variant="secondary" className="rounded-full border border-black/10 bg-black/[0.03] text-slate-700">
                                                                                {active ? 'Active' : 'Inactive'}
                                                                            </Badge>
                                                                            <RowActions onView={() => handleView(p)} onEdit={() => handleEdit(p)} onDeactivate={() => handleDeactivate(p)} />
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-2 grid gap-1 text-[12px] text-slate-700">
                                                                        <div className="flex items-center gap-2">
                                                                            <Phone className="h-4 w-4 text-slate-400" />
                                                                            <span>{p.phone || '—'}</span>
                                                                        </div>
                                                                        {p.email && (
                                                                            <div className="flex items-center gap-2">
                                                                                <Mail className="h-4 w-4 text-slate-400" />
                                                                                <span className="truncate">{p.email}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                                        {p.patient_type && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] border border-black/10 px-2.5 py-1 text-[11px] text-slate-800">
                                                                                <Tag className="h-3.5 w-3.5 text-slate-400" />
                                                                                {p.patient_type}
                                                                            </span>
                                                                        )}
                                                                        {p.tag && (
                                                                            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[11px] text-emerald-700">
                                                                                {p.tag}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )
                                            })}
                                    </div>
                                </div>

                                <PaginationBar total={filteredPatients.length} page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} />
                            </Card>
                        </div>
                    </div>

                    {/* Modals / Drawer */}
                    <PatientFormModal
                        open={formOpen}
                        onClose={() => setFormOpen(false)}
                        onSaved={() => {
                            setPage(1)
                            loadPatients(q, patientTypeFilter)
                        }}
                        initialPatient={editingPatient}
                        lookups={lookups}
                    />

                    <PatientDetailDrawer
                        open={detailOpen}
                        onClose={() => setDetailOpen(false)}
                        patient={selectedPatient}
                        onUpdated={updatePatientInList}
                        onEdit={(p) => {
                            setDetailOpen(false)
                            handleEdit(p)
                        }}
                    />
                </div>
            </div>

            {/* ⌘K Palette */}
            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                primary={primary}
                patientTypeFilter={patientTypeFilter}
                fallbackPatients={filteredPatients}
                onPickPatient={(p) => {
                    setSelectedPatient(p)
                    setDetailOpen(true)
                }}
            />

            {/* Advanced Filters */}
            <FiltersDialog open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} setFilters={setFilters} primary={primary} />
        </div>
    )
}
