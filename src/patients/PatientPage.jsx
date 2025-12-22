// FILE: src/patients/PatientPage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
    listPatients,
    deactivatePatient,
    getPatientMastersAll,
    exportPatientsExcel,
} from '../api/patients'

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
    Command,
    Check,
} from 'lucide-react'

import { useBranding } from '../branding/BrandingProvider'

// shadcn/ui
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// Dropdown (3-dot + segmented more)
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import PatientFormModal from './PatientForm'
import PatientDetailDrawer from './PatientDetailDrawer'

const cx = (...a) => a.filter(Boolean).join(' ')
const safeHex = (v) => typeof v === 'string' && v.startsWith('#') && v.length === 7
const alphaHex = (hex, a = '1A') => (safeHex(hex) ? `${hex}${a}` : undefined)

const initials = (first = '', last = '') => {
    const a = (first || '').trim()[0] || 'P'
    const b = (last || '').trim()[0] || ''
    return (a + b).toUpperCase()
}

function StatPill({ label, value, tone = 'slate' }) {
    const toneMap = {
        slate: 'bg-black/[0.04] text-slate-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        rose: 'bg-rose-50 text-rose-700',
        sky: 'bg-sky-50 text-sky-700',
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
                className="w-44 rounded-2xl p-1.5 border border-black/50 shadow-xl bg-white"
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

/** iOS segmented control (clean) */
function SegmentedControl({
    value,
    onChange,
    primary = '#2563eb',
    options = [],
    moreOptions = [],
}) {
    const activeStyle = {
        borderColor: alphaHex(primary, '22') || '#bfdbfe',
    }

    return (
        <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-2xl border border-black/50 bg-black/[0.03] p-1">
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
                                    ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-slate-900 border border-black/50'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
                            )}
                            style={active ? activeStyle : undefined}
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>

            {moreOptions.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="h-10 rounded-2xl border-black/50 bg-white hover:bg-black/[0.03]"
                        >
                            More…
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 rounded-2xl p-1.5 border border-black/50 shadow-xl bg-white">
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

/** ⌘K palette (server search debounced, keyboard nav) */
function CommandPalette({
    open,
    onClose,
    primary,
    patientTypeFilter,
    onPickPatient,
    fallbackPatients = [],
}) {
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [idx, setIdx] = useState(0)
    const [err, setErr] = useState('')
    const inputRef = useRef(null)

    const seqRef = useRef(0)
    const timerRef = useRef(null)

    const defaultRows = useMemo(() => {
        // show a few “ready” rows even when empty
        return (fallbackPatients || []).slice(0, 10)
    }, [fallbackPatients])

    useEffect(() => {
        if (!open) return
        setErr('')
        setQ('')
        setRows(defaultRows)
        setIdx(0)

        // focus
        const t = setTimeout(() => inputRef.current?.focus?.(), 50)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        if (!open) return
        // debounced server search
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
                const params = { q: query }
                if (patientTypeFilter) params.patient_type = patientTypeFilter
                const res = await listPatients(params)
                if (seqRef.current !== mySeq) return
                const data = res.data || []
                setRows(data)
                setIdx(0)
            } catch (e) {
                if (seqRef.current !== mySeq) return
                setErr(e?.response?.data?.detail || e?.message || 'Search failed')
            } finally {
                if (seqRef.current === mySeq) setLoading(false)
            }
        }, 250)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [q, open, patientTypeFilter, defaultRows])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
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
            className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm flex items-start justify-center px-3 py-10"
            onMouseDown={onClose}
        >
            <div
                className="w-full max-w-2xl rounded-3xl border border-black/50 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* top */}
                <div className="px-4 py-3 border-b border-black/50">
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
                                className="h-11 rounded-2xl pl-10 pr-24 border-black/50 bg-white focus-visible:ring-black/10"
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
                                <div className="hidden sm:flex items-center gap-1 rounded-full border border-black/50 bg-black/[0.03] px-2 py-1 text-[11px] text-slate-600">
                                    <span>Esc</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                            {loading ? 'Searching…' : q?.trim() ? `${rows.length} result(s)` : 'Type to search (server)'}
                        </div>
                        <div className="hidden sm:block">
                            ↑↓ to navigate · Enter to open
                        </div>
                    </div>

                    {err && (
                        <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                            {err}
                        </div>
                    )}
                </div>

                {/* results */}
                <div className="max-h-[60vh] overflow-auto">
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
                                const fullName =
                                    `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
                                const active = p.is_active !== false
                                const selected = i === idx

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
                                                <span className="text-[12px] font-extrabold">
                                                    {initials(p.first_name, p.last_name)}
                                                </span>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-slate-900 truncate">
                                                            {fullName}
                                                        </div>
                                                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                                                            <span className="font-mono text-[11px] bg-black/[0.04] border border-black/50 rounded-full px-2 py-0.5">
                                                                {p.uhid || '—'}
                                                            </span>
                                                            {p.phone && (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                                    {p.phone}
                                                                </span>
                                                            )}
                                                            <Badge
                                                                variant="secondary"
                                                                className="rounded-full border border-black/50 bg-black/[0.03] text-slate-700"
                                                            >
                                                                {active ? 'Active' : 'Inactive'}
                                                            </Badge>
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

export default function PatientPage() {
    const { branding } = useBranding() || {}
    const primary = branding?.primary_color || '#2563eb'

    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(false)
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

    // Filters
    const [patientTypeFilter, setPatientTypeFilter] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [exporting, setExporting] = useState(false)

    const patientTypeOptions = useMemo(() => lookups.patientTypes || [], [lookups.patientTypes])

    const stats = useMemo(() => {
        const total = patients.length
        const active = patients.filter((p) => p.is_active !== false).length
        return { total, active, inactive: total - active }
    }, [patients])

    const activeTypeLabel = useMemo(() => {
        if (!patientTypeFilter) return 'All'
        const hit = patientTypeOptions.find((x) => (x.code || x.name) === patientTypeFilter)
        return hit?.name || hit?.code || patientTypeFilter
    }, [patientTypeFilter, patientTypeOptions])

    const loadPatients = useCallback(
        async (search = q, patientType = patientTypeFilter) => {
            setLoading(true)
            setError('')
            try {
                const params = {}
                if (search) params.q = search
                if (patientType) params.patient_type = patientType
                const res = await listPatients(params)
                setPatients(res.data || [])
            } catch (err) {
                const msg = err?.response?.data?.detail || err?.message || 'Failed to load patients'
                setError(msg)
                toast.error('Failed to load patients', { description: msg })
            } finally {
                setLoading(false)
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
            const isMac = navigator.platform?.toLowerCase?.().includes('mac')
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
        loadPatients(q, patientTypeFilter)
    }

    const handlePatientType = (codeOrEmpty) => {
        setPatientTypeFilter(codeOrEmpty)
        loadPatients(q, codeOrEmpty)
    }

    const handleReset = () => {
        setPatientTypeFilter('')
        setQ('')
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

    // Segmented: keep it clean (first N) + More…
    const segmented = useMemo(() => {
        const all = [{ value: '', label: 'All' }]
        const mapped = patientTypeOptions.map((x) => ({
            value: x.code || x.name,
            label: x.name || x.code,
        }))

        const MAX_MAIN = 6 // All + 6 looks very iOS-clean
        const main = all.concat(mapped).slice(0, MAX_MAIN + 1)
        const rest = all.concat(mapped).slice(MAX_MAIN + 1)

        return { main, rest }
    }, [patientTypeOptions])

    const accentHint = {
        backgroundColor: alphaHex(primary, '12') || '#eff6ff',
        borderColor: alphaHex(primary, '22') || '#bfdbfe',
        color: primary,
    }

    return (
        <div className="h-full min-h-0 w-full bg-slate-50">
            {/* Centered container */}
            <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 py-4 flex flex-col gap-4 min-h-0">
                {/* Header */}
                <Card className="rounded-3xl border-black/50 bg-white/90 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div
                                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold tracking-tight border"
                                    style={accentHint}
                                >
                                    <Users className="h-4 w-4" />
                                    Patient Registry
                                </div>

                                <CardTitle className="mt-2 text-[22px] sm:text-[26px] tracking-tight font-semibold">
                                    Patient Management
                                </CardTitle>

                                <p className="mt-1 text-[13px] text-slate-600 max-w-2xl leading-relaxed">
                                    UHID search, smart filters, export, and quick profile actions.
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <StatPill label="Active" value={stats.active} tone="emerald" />
                                    <StatPill label="Total" value={stats.total} tone="sky" />
                                    {stats.inactive > 0 && <StatPill label="Inactive" value={stats.inactive} tone="rose" />}
                                    <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-semibold text-slate-700">
                                        <Tag className="h-4 w-4 opacity-70" />
                                        Type: {activeTypeLabel}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 md:justify-end">
                                <Button
                                    variant="outline"
                                    className="rounded-2xl border-black/50 bg-white hover:bg-black/[0.03]"
                                    onClick={() => loadPatients(q, patientTypeFilter)}
                                    title="Reload"
                                >
                                    <RefreshCcw className="h-4 w-4 mr-2" />
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
                    </CardHeader>

                    <CardContent className="pt-0">
                        <div className="grid gap-3">
                            {/* Search bar + CmdK */}
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <form onSubmit={handleSearchSubmit} className="w-full lg:max-w-xl">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="h-11 rounded-2xl pl-10 pr-24 border-black/50 bg-white focus-visible:ring-black/10"
                                            placeholder="Search UHID, Name, Mobile, Email..."
                                            value={q}
                                            onChange={(e) => setQ(e.target.value)}
                                        />

                                        {/* right: clear + ⌘K hint */}
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {!!q && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setQ('')
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
                                                className="hidden sm:inline-flex items-center gap-1 rounded-full border border-black/50 bg-black/[0.03] px-2 py-1 text-[11px] text-slate-600 hover:bg-black/[0.05]"
                                                title="Quick Search"
                                            >
                                                <Command className="h-3.5 w-3.5" />
                                                <span>⌘K</span>
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl border-black/50 bg-white hover:bg-black/[0.03]"
                                        onClick={handleReset}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl border-black/50 bg-white hover:bg-black/[0.03]"
                                        onClick={() => loadPatients(q, patientTypeFilter)}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            </div>

                            {/* True iOS segmented control */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="text-[12px] font-semibold text-slate-600">Patient Type</div>
                                <SegmentedControl
                                    value={patientTypeFilter}
                                    onChange={handlePatientType}
                                    primary={primary}
                                    options={segmented.main}
                                    moreOptions={segmented.rest}
                                />
                            </div>

                            {/* Export (clean) */}
                            <div className="rounded-3xl border border-black/50 bg-black/[0.02] p-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                        <CalendarDays className="h-4 w-4 text-slate-500" />
                                        Export Patients
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="grid gap-1">
                                            <label className="text-[11px] font-semibold text-slate-600">From</label>
                                            <Input
                                                type="date"
                                                className="h-10 rounded-2xl border-black/50 bg-white focus-visible:ring-black/10"
                                                value={fromDate}
                                                onChange={(e) => setFromDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <label className="text-[11px] font-semibold text-slate-600">To</label>
                                            <Input
                                                type="date"
                                                className="h-10 rounded-2xl border-black/50 bg-white focus-visible:ring-black/10"
                                                value={toDate}
                                                onChange={(e) => setToDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <Button
                                                className="w-full h-10 rounded-2xl shadow-sm"
                                                disabled={exporting}
                                                onClick={handleExportExcel}
                                                style={{ backgroundColor: '#16a34a' }}
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
                <div className="flex-1 min-h-0">
                    {/* Desktop */}
                    <div className="hidden md:block h-full min-h-0">
                        <Card className="h-full min-h-0 rounded-3xl border-black/50 bg-white/90 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="h-full min-h-0 overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-black/50">
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

                                        {!loading && patients.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-14 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="h-12 w-12 rounded-3xl bg-black/[0.04] grid place-items-center">
                                                            <Inbox className="h-6 w-6 text-slate-400" />
                                                        </div>
                                                        <div className="font-semibold text-slate-900">No patients found</div>
                                                        <div className="text-[12px] text-slate-500">
                                                            Try search / filters or create a new patient.
                                                        </div>
                                                        <Button className="rounded-2xl mt-1 shadow-sm" style={{ backgroundColor: primary }} onClick={handleNew}>
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            New Patient
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {!loading &&
                                            patients.map((p) => {
                                                const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
                                                const active = p.is_active !== false

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
                                                                                <span className="font-mono text-[11px] bg-black/[0.04] border border-black/50 rounded-full px-2 py-0.5">
                                                                                    {p.uhid || '—'}
                                                                                </span>
                                                                                <span>Age: {p.age_text || '—'}</span>
                                                                                <span className="text-slate-300">•</span>
                                                                                <span>{p.gender || '—'}</span>
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="rounded-full border border-black/50 bg-black/[0.03] text-slate-700"
                                                                                >
                                                                                    {active ? 'Active' : 'Inactive'}
                                                                                </Badge>
                                                                            </div>
                                                                        </div>

                                                                        {/* Hover chevron (NUTRYAH feel) */}
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
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] border border-black/50 px-2.5 py-1 text-[11px] text-slate-800">
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
                                                        </td>

                                                        <td className="px-5 py-4 align-top text-right" onClick={(e) => e.stopPropagation()}>
                                                            <RowActions
                                                                onView={() => handleView(p)}
                                                                onEdit={() => handleEdit(p)}
                                                                onDeactivate={() => handleDeactivate(p)}
                                                            />
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden grid gap-3">
                        {loading && (
                            <Card className="rounded-3xl border-black/50 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                <CardContent className="py-6 text-center text-slate-500">Loading…</CardContent>
                            </Card>
                        )}

                        {!loading && patients.length === 0 && (
                            <Card className="rounded-3xl border-black/50 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                <CardContent className="py-8 text-center">
                                    <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] grid place-items-center">
                                        <Inbox className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <div className="mt-3 font-semibold text-slate-900">No patients found</div>
                                    <div className="mt-1 text-[12px] text-slate-500">Try search or create a patient.</div>
                                    <Button className="rounded-2xl mt-4 shadow-sm" style={{ backgroundColor: primary }} onClick={handleNew}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        New Patient
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {!loading &&
                            patients.map((p) => {
                                const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
                                const active = p.is_active !== false

                                return (
                                    <Card
                                        key={p.id}
                                        className="rounded-3xl border-black/50 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
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
                                                                <span className="font-mono text-[11px] bg-black/[0.04] border border-black/50 rounded-full px-2 py-0.5">
                                                                    {p.uhid || '—'}
                                                                </span>
                                                                <span>Age: {p.age_text || '—'}</span>
                                                                <span className="text-slate-300">•</span>
                                                                <span>{p.gender || '—'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <Badge
                                                                variant="secondary"
                                                                className="rounded-full border border-black/50 bg-black/[0.03] text-slate-700"
                                                            >
                                                                {active ? 'Active' : 'Inactive'}
                                                            </Badge>
                                                            <RowActions
                                                                onView={() => handleView(p)}
                                                                onEdit={() => handleEdit(p)}
                                                                onDeactivate={() => handleDeactivate(p)}
                                                            />
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
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] border border-black/50 px-2.5 py-1 text-[11px] text-slate-800">
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

                {/* Modals / Drawer */}
                <PatientFormModal
                    open={formOpen}
                    onClose={() => setFormOpen(false)}
                    onSaved={() => loadPatients(q, patientTypeFilter)}
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

            {/* ⌘K Palette */}
            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                primary={primary}
                patientTypeFilter={patientTypeFilter}
                fallbackPatients={patients}
                onPickPatient={(p) => {
                    setSelectedPatient(p)
                    setDetailOpen(true)
                }}
            />
        </div>
    )
}
