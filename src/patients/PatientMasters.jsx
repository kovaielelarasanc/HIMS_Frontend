// FILE: frontend/src/patients/PatientMasters.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import API from '../api/client'
import { useCan } from '../hooks/useCan'
import { useBranding } from '../branding/BrandingProvider'
import { toast } from 'sonner'

import {
    Building2,
    ShieldCheck,
    Layers,
    Plus,
    X,
    Pencil,
    Trash2,
    Search,
    Users,
    CreditCard,
    Shield,
    ChevronRight,
    MoreHorizontal,
} from 'lucide-react'

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const safeHex = (v) => typeof v === 'string' && v.startsWith('#') && v.length === 7
const alphaHex = (hex, a = '1A') => (safeHex(hex) ? `${hex}${a}` : undefined)
const cx = (...a) => a.filter(Boolean).join(' ')

const PAYER_TYPES = [
    { value: 'insurance', label: 'Insurance' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'govt', label: 'Govt Scheme' },
    { value: 'other', label: 'Other' },
]

/* -------------------------
   NUTRYAH UI Primitives
------------------------- */
const UI = {
    page: 'bg-slate-50 min-h-full',
    container: 'mx-auto w-full max-w-12xl px-3 sm:px-5 py-4',
    card:
        'rounded-3xl border border-black/50 bg-white/85 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
    insetCard:
        'rounded-3xl border border-black/50 bg-white/90 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
    subtle: 'rounded-3xl border border-black/50 bg-black/[0.02]',
    label: 'text-[11px] font-semibold text-slate-600',
    input:
        'w-full rounded-2xl border border-black/50 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-black/20 focus:ring-2 focus:ring-black/10',
    inputSm:
        'w-full rounded-2xl border border-black/50 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-black/20 focus:ring-2 focus:ring-black/10',
    textarea:
        'w-full rounded-2xl border border-black/50 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-black/20 focus:ring-2 focus:ring-black/10 min-h-[90px]',
    btn:
        'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition active:scale-[0.99]',
    btnOutline:
        'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border border-black/50 bg-white hover:bg-black/[0.03] transition active:scale-[0.99]',
    badge:
        'inline-flex items-center rounded-full border border-black/50 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-slate-700',
}

/** NUTRYAH segmented control */
function Segmented({ value, onChange, options, primary = '#2563eb', className = '' }) {
    return (
        <div
            className={cx(
                'inline-flex items-center rounded-2xl border border-black/50 bg-black/[0.03] p-1',
                className
            )}
        >
            {options.map((o) => {
                const active = value === o.value
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={cx(
                            'h-9 px-3 rounded-xl text-[12px] font-semibold tracking-tight transition',
                            active
                                ? 'bg-white text-slate-900 border border-black/50 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                                : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
                        )}
                        style={
                            active
                                ? { borderColor: alphaHex(primary, '22') || 'rgba(0,0,0,0.1)' }
                                : undefined
                        }
                    >
                        <span className="inline-flex items-center gap-2">
                            {o.icon ? <o.icon className="h-4 w-4 opacity-80" /> : null}
                            {o.label}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

/** NUTRYAH mini segmented */
function MiniSegmented({ value, onChange, options, primary = '#2563eb' }) {
    return (
        <div className="inline-flex items-center rounded-2xl border border-black/50 bg-black/[0.03] p-1">
            {options.map((o) => {
                const active = value === o.value
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={cx(
                            'h-8 px-3 rounded-xl text-[12px] font-semibold transition',
                            active
                                ? 'bg-white text-slate-900 border border-black/50 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                                : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
                        )}
                        style={
                            active
                                ? { borderColor: alphaHex(primary, '22') || 'rgba(0,0,0,0.1)' }
                                : undefined
                        }
                    >
                        {o.label}
                    </button>
                )
            })}
        </div>
    )
}

/** NUTRYAH search input */
function NUTRYAHSearch({ value, onChange, placeholder = 'Search…', className = '' }) {
    return (
        <div className={cx('relative w-full', className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cx(UI.inputSm, 'pl-9 pr-9 bg-white/90')}
            />
            {!!value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/[0.04]"
                    title="Clear"
                >
                    <X className="h-4 w-4 text-slate-500" />
                </button>
            )}
        </div>
    )
}

/** NUTRYAH modal: bottom sheet on mobile, centered on desktop */
function NUTRYAHModal({ title, subtitle, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/35 backdrop-blur-sm p-0 sm:p-4">
            <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-black/50 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] px-4 py-4 sm:px-5 sm:py-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-[16px] sm:text-[18px] font-semibold text-slate-900 tracking-tight">
                            {title}
                        </h3>
                        {subtitle ? (
                            <p className="mt-1 text-[12px] sm:text-[13px] text-slate-500 leading-relaxed">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="rounded-full p-2 text-slate-500 hover:bg-black/[0.04] hover:text-slate-700"
                        title="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

function EmptyState({ title, subtitle }) {
    return (
        <div className="rounded-3xl border border-black/50 bg-white/80 p-6 text-center text-slate-600">
            <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] grid place-items-center">
                <Users className="h-6 w-6 text-slate-400" />
            </div>
            <div className="mt-3 font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div>
        </div>
    )
}

/* -------------------------
   NUTRYAH macOS List (no tables)
------------------------- */
function NUTRYAHListShell({ title, right, children }) {
    return (
        <div className="overflow-hidden rounded-3xl border border-black/50 bg-white/85 backdrop-blur">
            {(title || right) && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/50 bg-white/80 backdrop-blur">
                    <div className="text-[12px] font-semibold text-slate-700 tracking-tight">{title}</div>
                    <div className="flex items-center gap-2">{right}</div>
                </div>
            )}
            <div className="divide-y divide-black/5">{children}</div>
        </div>
    )
}

function RowPill({ dotClass, label, className = '' }) {
    return (
        <span className={cx('inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold', className)}>
            <span className={cx('h-1.5 w-1.5 rounded-full', dotClass)} />
            {label}
        </span>
    )
}

function CodeBadge({ code }) {
    if (!code) return null
    return (
        <span className="rounded-full bg-black/[0.04] border border-black/50 px-2 py-0.5 text-[11px] font-mono text-slate-700">
            {code}
        </span>
    )
}

function RowActions({ canManage, onEdit, onDeactivate, deactivateLabel = 'Deactivate' }) {
    if (!canManage) return null
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/[0.04] text-slate-600"
                    title="Actions"
                    onClick={(e) => e.stopPropagation()}
                >
                    <MoreHorizontal className="h-4.5 w-4.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem
                    onSelect={(e) => {
                        e.preventDefault()
                        onEdit?.()
                    }}
                    className="cursor-pointer"
                >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onSelect={(e) => {
                        e.preventDefault()
                        onDeactivate?.()
                    }}
                    className="cursor-pointer text-rose-700 focus:text-rose-700"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deactivateLabel}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function NUTRYAHListRow({
    title,
    subtitle,
    metaLeft,
    metaRight,
    canClick,
    onClick,
    canManage,
    onEdit,
    onDeactivate,
}) {
    return (
        <div
            role={canClick ? 'button' : undefined}
            tabIndex={canClick ? 0 : -1}
            onClick={canClick ? onClick : undefined}
            onKeyDown={(e) => {
                if (!canClick) return
                if (e.key === 'Enter' || e.key === ' ') onClick?.()
            }}
            className={cx(
                'group px-4 py-3 transition',
                canClick ? 'cursor-pointer hover:bg-black/[0.02]' : 'cursor-default'
            )}
        >
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[14px] sm:text-[15px] font-semibold text-slate-900 truncate">
                            {title}
                        </div>
                        {subtitle}
                    </div>

                    {(metaLeft || metaRight) && (
                        <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                            <div className="text-[12px] text-slate-600 min-w-0">{metaLeft}</div>
                            <div className="text-[12px] text-slate-500 flex items-center gap-2 justify-start sm:justify-end">
                                {metaRight}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <RowActions
                        canManage={canManage}
                        onEdit={onEdit}
                        onDeactivate={onDeactivate}
                    />
                    <ChevronRight className="h-5 w-5 text-slate-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition" />
                </div>
            </div>
        </div>
    )
}

/* -------------------------
   PAGE
------------------------- */
export default function PatientMasters() {
    const { branding } = useBranding() || {}
    const primary = branding?.primary_color || '#2563eb'

    const [tab, setTab] = useState('payers')

    const canMastersView = useCan('patients.masters.view')
    const canPatientsView = useCan('patients.view')
    const canView = canMastersView || canPatientsView

    if (!canView) {
        return (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-sm">
                You do not have permission to view patient masters.
            </div>
        )
    }

    const tabs = [
        { value: 'types', label: 'Patient Types', icon: Users },
        { value: 'payers', label: 'Payers', icon: Building2 },
        { value: 'tpas', label: 'TPAs', icon: Shield },
        { value: 'plans', label: 'Credit Plans', icon: CreditCard },
    ]

    return (
        <div className={UI.page} >
            <div className={UI.container}>
                {/* Header */}
                <div className={cx(UI.card, 'p-5')}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between ">
                        <div className="min-w-0">
                            <div
                                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold border"
                                style={{
                                    backgroundColor: alphaHex(primary, '12') || '#eff6ff',
                                    borderColor: alphaHex(primary, '22') || '#bfdbfe',
                                    color: primary,
                                }}
                            >
                                <ShieldCheck className="h-4 w-4" />
                                Patient Masters
                            </div>

                            <div className="mt-2 text-[22px] sm:text-[26px] font-semibold tracking-tight text-slate-900">
                                Registration & Billing Masters
                            </div>

                            <p className="mt-1 max-w-2xl text-[13px] text-slate-600 leading-relaxed">
                                Configure patient types, payers, TPAs & credit plans used across OPD/IPD
                                registration, authorization and billing workflows.
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className={UI.badge}>
                                    <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    OPD/IPD ready
                                </span>
                                <span className={UI.badge}>
                                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5 opacity-80" />
                                    NABH aligned
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start md:justify-end">
                            <div className="w-full overflow-x-auto no-scrollbar">
                                <Segmented value={tab} onChange={setTab} options={tabs} primary={primary} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className={cx(UI.insetCard, 'mt-4 p-3 sm:p-4')}>
                    {tab === 'types' && <PatientTypesTab primary={primary} />}
                    {tab === 'payers' && <PayersTab primary={primary} />}
                    {tab === 'tpas' && <TpasTab primary={primary} />}
                    {tab === 'plans' && <CreditPlansTab primary={primary} />}
                </div>
            </div>
        </div>
    )
}

/* ---------------------------------------------------
   PATIENT TYPES TAB
--------------------------------------------------- */
function PatientTypesTab({ primary }) {
    const canView = useCan('patients.view') || useCan('patients.masters.view')
    const canManage = useCan('patients.update') || useCan('patients.masters.manage')

    const [statusFilter, setStatusFilter] = useState('all')
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [q, setQ] = useState('')

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    const load = useCallback(async () => {
        if (!canView) return
        setLoading(true)
        setErr('')
        try {
            const { data } = await API.get('/patient-types', { params: { include_inactive: true } })
            setItems(data || [])
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to load patient types'
            setErr(msg)
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        let data = [...items]
        if (statusFilter === 'active') data = data.filter((t) => t.is_active)
        if (statusFilter === 'inactive') data = data.filter((t) => !t.is_active)

        if (!q) return data
        const ql = q.toLowerCase()
        return data.filter(
            (t) =>
                t.name?.toLowerCase().includes(ql) ||
                t.code?.toLowerCase().includes(ql) ||
                t.description?.toLowerCase().includes(ql)
        )
    }, [items, q, statusFilter])

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }
    const openEdit = (item) => {
        if (!canManage) return
        setEditing(item)
        setModalOpen(true)
    }
    const onSaved = (mode) => {
        setModalOpen(false)
        setEditing(null)
        load()
        toast.success(mode === 'update' ? 'Patient type updated' : 'Patient type created')
    }
    const onDeleted = () => {
        load()
        toast.success('Patient type deactivated')
    }

    const quickDeactivate = async (item) => {
        if (!canManage) return
        if (!window.confirm('Deactivate this patient type?')) return
        try {
            await API.delete(`/patient-types/${item.id}`)
            onDeleted()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to deactivate patient type')
        }
    }

    return (
        <div className="space-y-4">
            <div className={cx(UI.subtle, 'p-3')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-start gap-2">
                            <ShieldCheck className="mt-0.5 h-4 w-4" style={{ color: primary }} />
                            <div className="text-[13px] text-slate-600 leading-relaxed">
                                Define visit types like <span className="font-semibold text-slate-900">Emergency, OPD, IPD</span> used in registration & triage.
                            </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={UI.badge}>
                                Total: <span className="ml-1 tabular-nums">{items.length}</span>
                            </span>
                            <span className={UI.badge}>
                                Showing: <span className="ml-1 tabular-nums">{filtered.length}</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <NUTRYAHSearch value={q} onChange={setQ} placeholder="Search code, name, description…" className="sm:w-[320px]" />
                        {canManage && (
                            <button
                                onClick={openCreate}
                                className={cx(UI.btn, 'text-white shadow-sm')}
                                style={{ backgroundColor: primary }}
                            >
                                <Plus className="h-4 w-4" />
                                New Type
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={UI.label}>Status</span>
                    <MiniSegmented
                        value={statusFilter}
                        onChange={setStatusFilter}
                        primary={primary}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                        ]}
                    />
                </div>
            </div>

            {err && (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            {loading && <div className={cx(UI.card, 'p-4 text-center text-slate-500')}>Loading…</div>}

            {!loading && filtered.length === 0 && (
                <EmptyState
                    title="No patient types"
                    subtitle={canManage ? 'Create a new patient type to get started.' : 'No data found.'}
                />
            )}

            {!loading && filtered.length > 0 && (
                <NUTRYAHListShell
                    title="Patient Types"
                    right={<span className={UI.badge}>macOS list</span>}
                >
                    {filtered.map((t) => (
                        <NUTRYAHListRow
                            key={t.id}
                            title={t.name}
                            subtitle={<CodeBadge code={t.code} />}
                            metaLeft={
                                t.description ? (
                                    <span className="line-clamp-1">{t.description}</span>
                                ) : (
                                    <span className="text-slate-400">No description</span>
                                )
                            }
                            metaRight={
                                <>
                                    <RowPill
                                        dotClass={t.is_active ? 'bg-emerald-500' : 'bg-slate-400'}
                                        label={t.is_active ? 'Active' : 'Inactive'}
                                        className={
                                            t.is_active
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : 'border-black/50 bg-black/[0.03] text-slate-600'
                                        }
                                    />
                                    <span className="text-slate-400">Sort: {t.sort_order ?? 0}</span>
                                </>
                            }
                            canClick={!!canManage}
                            onClick={() => openEdit(t)}
                            canManage={!!canManage}
                            onEdit={() => openEdit(t)}
                            onDeactivate={() => quickDeactivate(t)}
                        />
                    ))}
                </NUTRYAHListShell>
            )}

            {modalOpen && (
                <PatientTypeModal
                    primary={primary}
                    existing={editing}
                    onClose={() => {
                        setModalOpen(false)
                        setEditing(null)
                    }}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    )
}

function PatientTypeModal({ existing, onClose, onSaved, onDeleted, primary }) {
    const canManage = useCan('patients.update') || useCan('patients.masters.manage')

    const [form, setForm] = useState(() => ({
        code: existing?.code || '',
        name: existing?.name || '',
        description: existing?.description || '',
        is_active: existing?.is_active ?? true,
        sort_order: existing?.sort_order ?? 0,
    }))
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    const save = async (e) => {
        e.preventDefault()
        if (!canManage) return
        setSaving(true)
        setErr('')
        try {
            const payload = { ...form, sort_order: Number(form.sort_order) || 0 }
            if (existing) {
                await API.put(`/patient-types/${existing.id}`, payload)
                onSaved?.('update')
            } else {
                await API.post('/patient-types', payload)
                onSaved?.('create')
            }
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to save patient type'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        if (!existing || !canManage) return
        if (!window.confirm('Deactivate this patient type?')) return
        setSaving(true)
        setErr('')
        try {
            await API.delete(`/patient-types/${existing.id}`)
            onDeleted?.()
            onClose?.()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate patient type'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <NUTRYAHModal
            title={existing ? 'Edit Patient Type' : 'New Patient Type'}
            subtitle="Define master types like Emergency, OPD, IPD, Health Checkup…"
            onClose={onClose}
        >
            {err && (
                <div className="mb-3 rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            <form onSubmit={save} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={UI.label}>Code</label>
                        <input
                            className={UI.input}
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                            required
                        />
                        <p className="mt-1 text-[11px] text-slate-400">Example: EMERGENCY, OPD, IPD, HC</p>
                    </div>
                    <div>
                        <label className={UI.label}>Name</label>
                        <input
                            className={UI.input}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className={UI.label}>Description</label>
                    <textarea
                        className={UI.textarea}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 items-end">
                    <div>
                        <label className={UI.label}>Sort Order</label>
                        <input
                            className={UI.input}
                            type="number"
                            value={form.sort_order}
                            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">Lower number shows earlier in dropdowns.</p>
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                        <input
                            id="pt-active"
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={form.is_active}
                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        />
                        <label htmlFor="pt-active" className="text-[13px] font-semibold text-slate-800">
                            Active
                        </label>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {existing ? (
                        <button
                            type="button"
                            onClick={remove}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100/60"
                        >
                            <Trash2 className="h-4 w-4" />
                            Deactivate
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} className={cx(UI.btnOutline, 'h-10')}>
                            Cancel
                        </button>
                        <button
                            disabled={saving || !canManage}
                            className={cx(UI.btn, 'h-10 text-white shadow-sm')}
                            style={{ backgroundColor: primary }}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </form>
        </NUTRYAHModal>
    )
}

/* ---------------------------------------------------
   PAYERS TAB (List rows + action menu)
--------------------------------------------------- */
function PayersTab({ primary }) {
    const canView = useCan('patients.masters.view')
    const canManage = useCan('patients.masters.manage')

    const [payerTypeFilter, setPayerTypeFilter] = useState('all')
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [q, setQ] = useState('')

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    const load = useCallback(async () => {
        if (!canView) return
        setLoading(true)
        setErr('')
        try {
            const { data } = await API.get('/patient-masters/payers')
            setItems(data || [])
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to load payers'
            setErr(msg)
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        let data = [...items]
        if (payerTypeFilter !== 'all') data = data.filter((p) => p.payer_type === payerTypeFilter)
        if (!q) return data
        const ql = q.toLowerCase()
        return data.filter(
            (p) =>
                p.name?.toLowerCase().includes(ql) ||
                p.code?.toLowerCase().includes(ql) ||
                p.payer_type?.toLowerCase().includes(ql)
        )
    }, [items, q, payerTypeFilter])

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }
    const openEdit = (item) => {
        if (!canManage) return
        setEditing(item)
        setModalOpen(true)
    }
    const onSaved = (mode) => {
        setModalOpen(false)
        setEditing(null)
        load()
        toast.success(mode === 'update' ? 'Payer updated' : 'Payer created')
    }
    const onDeleted = () => {
        load()
        toast.success('Payer deactivated')
    }

    const quickDeactivate = async (item) => {
        if (!canManage) return
        if (!window.confirm('Deactivate this payer?')) return
        try {
            await API.delete(`/patient-masters/payers/${item.id}`)
            onDeleted()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to deactivate payer')
        }
    }

    return (
        <div className="space-y-4">
            <div className={cx(UI.subtle, 'p-3')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4" style={{ color: primary }} />
                        <div className="text-[13px] text-slate-600 leading-relaxed">
                            Payers used for <span className="font-semibold text-slate-900">insurance / corporate / government schemes</span> in OPD/IPD billing.
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <NUTRYAHSearch value={q} onChange={setQ} placeholder="Search code, name, type…" className="sm:w-[320px]" />
                        {canManage && (
                            <button
                                onClick={openCreate}
                                className={cx(UI.btn, 'text-white shadow-sm')}
                                style={{ backgroundColor: primary }}
                            >
                                <Plus className="h-4 w-4" />
                                New Payer
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={UI.label}>Payer type</span>
                    <MiniSegmented
                        value={payerTypeFilter}
                        onChange={setPayerTypeFilter}
                        primary={primary}
                        options={[
                            { value: 'all', label: 'All' },
                            ...PAYER_TYPES.map((t) => ({ value: t.value, label: t.label })),
                        ]}
                    />
                    <div className="ml-auto flex gap-2">
                        <span className={UI.badge}>
                            Total: <span className="ml-1 tabular-nums">{items.length}</span>
                        </span>
                        <span className={UI.badge}>
                            Showing: <span className="ml-1 tabular-nums">{filtered.length}</span>
                        </span>
                    </div>
                </div>
            </div>

            {err && (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            {loading && <div className={cx(UI.card, 'p-4 text-center text-slate-500')}>Loading…</div>}

            {!loading && filtered.length === 0 && (
                <EmptyState title="No payers" subtitle={canManage ? 'Create a new payer to get started.' : 'No data found.'} />
            )}

            {!loading && filtered.length > 0 && (
                <NUTRYAHListShell title="Payers" right={<span className={UI.badge}>macOS list</span>}>
                    {filtered.map((p) => (
                        <NUTRYAHListRow
                            key={p.id}
                            title={p.name}
                            subtitle={<CodeBadge code={p.code} />}
                            metaLeft={
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <div className="capitalize">
                                        Type: <span className="font-semibold text-slate-800">{p.payer_type || '—'}</span>
                                    </div>
                                    <div className="text-slate-500 line-clamp-1">
                                        {p.contact_person ? `Contact: ${p.contact_person}` : 'No contact person'}
                                    </div>
                                    <div className="text-slate-500 line-clamp-1">
                                        {p.phone || p.email ? `${p.phone || '—'} • ${p.email || '—'}` : 'No phone/email'}
                                    </div>
                                </div>
                            }
                            metaRight={<span className="text-slate-400 line-clamp-1">{p.address || '—'}</span>}
                            canClick={!!canManage}
                            onClick={() => openEdit(p)}
                            canManage={!!canManage}
                            onEdit={() => openEdit(p)}
                            onDeactivate={() => quickDeactivate(p)}
                        />
                    ))}
                </NUTRYAHListShell>
            )}

            {modalOpen && (
                <PayerModal
                    primary={primary}
                    existing={editing}
                    onClose={() => {
                        setModalOpen(false)
                        setEditing(null)
                    }}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    )
}

function PayerModal({ existing, onClose, onSaved, onDeleted, primary }) {
    const canManage = useCan('patients.masters.manage')
    const [form, setForm] = useState(() => ({
        code: existing?.code || '',
        name: existing?.name || '',
        payer_type: existing?.payer_type || 'insurance',
        contact_person: existing?.contact_person || '',
        phone: existing?.phone || '',
        email: existing?.email || '',
        address: existing?.address || '',
    }))
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    const save = async (e) => {
        e.preventDefault()
        if (!canManage) return
        setSaving(true)
        setErr('')
        try {
            if (existing) {
                await API.put(`/patient-masters/payers/${existing.id}`, form)
                onSaved?.('update')
            } else {
                await API.post('/patient-masters/payers', form)
                onSaved?.('create')
            }
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to save payer'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        if (!existing || !canManage) return
        if (!window.confirm('Deactivate this payer?')) return
        setSaving(true)
        setErr('')
        try {
            await API.delete(`/patient-masters/payers/${existing.id}`)
            onDeleted?.()
            onClose?.()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate payer'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <NUTRYAHModal
            title={existing ? 'Edit Payer' : 'New Payer'}
            subtitle="Master record used for credit / insurance patients."
            onClose={onClose}
        >
            {err && (
                <div className="mb-3 rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            <form onSubmit={save} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={UI.label}>Code</label>
                        <input
                            className={UI.input}
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                            required
                        />
                    </div>
                    <div>
                        <label className={UI.label}>Name</label>
                        <input
                            className={UI.input}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                        <label className={UI.label}>Type</label>
                        <select
                            className={UI.input}
                            value={form.payer_type}
                            onChange={(e) => setForm({ ...form, payer_type: e.target.value })}
                        >
                            {PAYER_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <label className={UI.label}>Contact Person</label>
                        <input
                            className={UI.input}
                            value={form.contact_person}
                            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={UI.label}>Phone</label>
                        <input className={UI.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div>
                        <label className={UI.label}>Email</label>
                        <input
                            className={UI.input}
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className={UI.label}>Address</label>
                    <textarea
                        className={UI.textarea}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {existing ? (
                        <button
                            type="button"
                            onClick={remove}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100/60"
                        >
                            <Trash2 className="h-4 w-4" />
                            Deactivate
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} className={cx(UI.btnOutline, 'h-10')}>
                            Cancel
                        </button>
                        <button
                            className={cx(UI.btn, 'h-10 text-white shadow-sm')}
                            style={{ backgroundColor: primary }}
                            disabled={saving || !canManage}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </form>
        </NUTRYAHModal>
    )
}

/* ---------------------------------------------------
   TPAs TAB (List rows + action menu)
--------------------------------------------------- */
function TpasTab({ primary }) {
    const canView = useCan('patients.masters.view')
    const canManage = useCan('patients.masters.manage')

    const [items, setItems] = useState([])
    const [payers, setPayers] = useState([])

    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [q, setQ] = useState('')

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    const load = useCallback(async () => {
        if (!canView) return
        setLoading(true)
        setErr('')
        try {
            const [tpaRes, payerRes] = await Promise.all([
                API.get('/patient-masters/tpas'),
                API.get('/patient-masters/payers'),
            ])
            setItems(tpaRes.data || [])
            setPayers(payerRes.data || [])
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to load TPAs'
            setErr(msg)
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const payerMap = useMemo(() => {
        const m = {}
        for (const p of payers) m[p.id] = p
        return m
    }, [payers])

    const filtered = useMemo(() => {
        if (!q) return items
        const ql = q.toLowerCase()
        return items.filter(
            (t) =>
                t.name?.toLowerCase().includes(ql) ||
                t.code?.toLowerCase().includes(ql) ||
                payerMap[t.payer_id]?.name?.toLowerCase().includes(ql)
        )
    }, [items, q, payerMap])

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }
    const openEdit = (item) => {
        if (!canManage) return
        setEditing(item)
        setModalOpen(true)
    }

    const onSaved = (mode) => {
        setModalOpen(false)
        setEditing(null)
        load()
        toast.success(mode === 'update' ? 'TPA updated' : 'TPA created')
    }
    const onDeleted = () => {
        load()
        toast.success('TPA deactivated')
    }

    const quickDeactivate = async (item) => {
        if (!canManage) return
        if (!window.confirm('Deactivate this TPA?')) return
        try {
            await API.delete(`/patient-masters/tpas/${item.id}`)
            onDeleted()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to deactivate TPA')
        }
    }

    return (
        <div className="space-y-4">
            <div className={cx(UI.subtle, 'p-3')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                        <Shield className="mt-0.5 h-4 w-4" style={{ color: primary }} />
                        <div className="text-[13px] text-slate-600 leading-relaxed">
                            Third-party administrators (TPAs) linked to payers.
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <NUTRYAHSearch value={q} onChange={setQ} placeholder="Search code, name, payer…" className="sm:w-[320px]" />
                        {canManage && (
                            <button
                                onClick={openCreate}
                                className={cx(UI.btn, 'text-white shadow-sm')}
                                style={{ backgroundColor: primary }}
                            >
                                <Plus className="h-4 w-4" />
                                New TPA
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                    <span className={UI.badge}>
                        Total: <span className="ml-1 tabular-nums">{items.length}</span>
                    </span>
                    <span className={UI.badge}>
                        Showing: <span className="ml-1 tabular-nums">{filtered.length}</span>
                    </span>
                </div>
            </div>

            {err && (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            {loading && <div className={cx(UI.card, 'p-4 text-center text-slate-500')}>Loading…</div>}

            {!loading && filtered.length === 0 && <EmptyState title="No TPAs" subtitle="No data found." />}

            {!loading && filtered.length > 0 && (
                <NUTRYAHListShell title="TPAs" right={<span className={UI.badge}>macOS list</span>}>
                    {filtered.map((t) => (
                        <NUTRYAHListRow
                            key={t.id}
                            title={t.name}
                            subtitle={<CodeBadge code={t.code} />}
                            metaLeft={
                                <div className="flex flex-col gap-0.5">
                                    <div>
                                        Payer:{' '}
                                        <span className="font-semibold text-slate-800">
                                            {payerMap[t.payer_id]?.name || '—'}
                                        </span>
                                    </div>
                                    <div className="text-slate-500 line-clamp-1">
                                        {t.contact_person ? `Contact: ${t.contact_person}` : 'No contact person'}
                                    </div>
                                    <div className="text-slate-500 line-clamp-1">
                                        {t.phone || t.email ? `${t.phone || '—'} • ${t.email || '—'}` : 'No phone/email'}
                                    </div>
                                </div>
                            }
                            metaRight={<span className="text-slate-400">—</span>}
                            canClick={!!canManage}
                            onClick={() => openEdit(t)}
                            canManage={!!canManage}
                            onEdit={() => openEdit(t)}
                            onDeactivate={() => quickDeactivate(t)}
                        />
                    ))}
                </NUTRYAHListShell>
            )}

            {modalOpen && (
                <TpaModal
                    primary={primary}
                    existing={editing}
                    payers={payers}
                    onClose={() => {
                        setModalOpen(false)
                        setEditing(null)
                    }}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    )
}

function TpaModal({ existing, payers, onClose, onSaved, onDeleted, primary }) {
    const canManage = useCan('patients.masters.manage')
    const [form, setForm] = useState(() => ({
        code: existing?.code || '',
        name: existing?.name || '',
        payer_id: existing?.payer_id || '',
        contact_person: existing?.contact_person || '',
        phone: existing?.phone || '',
        email: existing?.email || '',
    }))
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    const save = async (e) => {
        e.preventDefault()
        if (!canManage) return
        setSaving(true)
        setErr('')
        try {
            const payload = { ...form, payer_id: form.payer_id ? Number(form.payer_id) : null }
            if (existing) {
                await API.put(`/patient-masters/tpas/${existing.id}`, payload)
                onSaved?.('update')
            } else {
                await API.post('/patient-masters/tpas', payload)
                onSaved?.('create')
            }
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to save TPA'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        if (!existing || !canManage) return
        if (!window.confirm('Deactivate this TPA?')) return
        setSaving(true)
        setErr('')
        try {
            await API.delete(`/patient-masters/tpas/${existing.id}`)
            onDeleted?.()
            onClose?.()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate TPA'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <NUTRYAHModal title={existing ? 'Edit TPA' : 'New TPA'} subtitle="Third-party administrator master, mapped to payer." onClose={onClose}>
            {err && (
                <div className="mb-3 rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            <form onSubmit={save} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={UI.label}>Code</label>
                        <input
                            className={UI.input}
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                            required
                        />
                    </div>
                    <div>
                        <label className={UI.label}>Name</label>
                        <input className={UI.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                </div>

                <div>
                    <label className={UI.label}>Payer</label>
                    <select
                        className={UI.input}
                        value={form.payer_id || ''}
                        onChange={(e) => setForm({ ...form, payer_id: e.target.value || '' })}
                        required
                    >
                        <option value="">Select payer…</option>
                        {payers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={UI.label}>Contact Person</label>
                        <input className={UI.input} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                    </div>
                    <div>
                        <label className={UI.label}>Phone</label>
                        <input className={UI.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                </div>

                <div>
                    <label className={UI.label}>Email</label>
                    <input className={UI.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {existing ? (
                        <button
                            type="button"
                            onClick={remove}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100/60"
                        >
                            <Trash2 className="h-4 w-4" />
                            Deactivate
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} className={cx(UI.btnOutline, 'h-10')}>
                            Cancel
                        </button>
                        <button className={cx(UI.btn, 'h-10 text-white shadow-sm')} style={{ backgroundColor: primary }} disabled={saving || !canManage}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </form>
        </NUTRYAHModal>
    )
}

/* ---------------------------------------------------
   CREDIT PLANS TAB (List rows + action menu)
--------------------------------------------------- */
function CreditPlansTab({ primary }) {
    const canView = useCan('patients.masters.view')
    const canManage = useCan('patients.masters.manage')

    const [items, setItems] = useState([])
    const [payers, setPayers] = useState([])
    const [tpas, setTpas] = useState([])

    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [q, setQ] = useState('')

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    const load = useCallback(async () => {
        if (!canView) return
        setLoading(true)
        setErr('')
        try {
            const [planRes, payerRes, tpaRes] = await Promise.all([
                API.get('/patient-masters/credit-plans'),
                API.get('/patient-masters/payers'),
                API.get('/patient-masters/tpas'),
            ])
            setItems(planRes.data || [])
            setPayers(payerRes.data || [])
            setTpas(tpaRes.data || [])
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to load credit plans'
            setErr(msg)
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const payerMap = useMemo(() => {
        const m = {}
        for (const p of payers) m[p.id] = p
        return m
    }, [payers])

    const tpaMap = useMemo(() => {
        const m = {}
        for (const t of tpas) m[t.id] = t
        return m
    }, [tpas])

    const filtered = useMemo(() => {
        if (!q) return items
        const ql = q.toLowerCase()
        return items.filter(
            (cp) =>
                cp.name?.toLowerCase().includes(ql) ||
                cp.code?.toLowerCase().includes(ql) ||
                payerMap[cp.payer_id]?.name?.toLowerCase().includes(ql) ||
                tpaMap[cp.tpa_id]?.name?.toLowerCase().includes(ql)
        )
    }, [items, q, payerMap, tpaMap])

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }
    const openEdit = (item) => {
        if (!canManage) return
        setEditing(item)
        setModalOpen(true)
    }

    const onSaved = (mode) => {
        setModalOpen(false)
        setEditing(null)
        load()
        toast.success(mode === 'update' ? 'Credit plan updated' : 'Credit plan created')
    }
    const onDeleted = () => {
        load()
        toast.success('Credit plan deactivated')
    }

    const quickDeactivate = async (item) => {
        if (!canManage) return
        if (!window.confirm('Deactivate this credit plan?')) return
        try {
            await API.delete(`/patient-masters/credit-plans/${item.id}`)
            onDeleted()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to deactivate credit plan')
        }
    }

    return (
        <div className="space-y-4">
            <div className={cx(UI.subtle, 'p-3')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                        <Layers className="mt-0.5 h-4 w-4" style={{ color: primary }} />
                        <div className="text-[13px] text-slate-600 leading-relaxed">
                            Credit / insurance plans used for IPD/OPD billing & authorization.
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <NUTRYAHSearch value={q} onChange={setQ} placeholder="Search code, name, payer, TPA…" className="sm:w-[320px]" />
                        {canManage && (
                            <button onClick={openCreate} className={cx(UI.btn, 'text-white shadow-sm')} style={{ backgroundColor: primary }}>
                                <Plus className="h-4 w-4" />
                                New Plan
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                    <span className={UI.badge}>
                        Total: <span className="ml-1 tabular-nums">{items.length}</span>
                    </span>
                    <span className={UI.badge}>
                        Showing: <span className="ml-1 tabular-nums">{filtered.length}</span>
                    </span>
                </div>
            </div>

            {err && (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            {loading && <div className={cx(UI.card, 'p-4 text-center text-slate-500')}>Loading…</div>}

            {!loading && filtered.length === 0 && <EmptyState title="No credit plans" subtitle="No data found." />}

            {!loading && filtered.length > 0 && (
                <NUTRYAHListShell title="Credit Plans" right={<span className={UI.badge}>macOS list</span>}>
                    {filtered.map((cp) => (
                        <NUTRYAHListRow
                            key={cp.id}
                            title={cp.name}
                            subtitle={<CodeBadge code={cp.code} />}
                            metaLeft={
                                <div className="flex flex-col gap-0.5">
                                    <div>
                                        Payer:{' '}
                                        <span className="font-semibold text-slate-800">
                                            {payerMap[cp.payer_id]?.name || '—'}
                                        </span>
                                    </div>
                                    <div className="text-slate-500">
                                        TPA:{' '}
                                        <span className="font-semibold text-slate-700">
                                            {tpaMap[cp.tpa_id]?.name || '—'}
                                        </span>
                                    </div>
                                    {cp.description ? (
                                        <div className="text-slate-500 line-clamp-1">{cp.description}</div>
                                    ) : (
                                        <div className="text-slate-400">No notes</div>
                                    )}
                                </div>
                            }
                            metaRight={<span className="text-slate-400">—</span>}
                            canClick={!!canManage}
                            onClick={() => openEdit(cp)}
                            canManage={!!canManage}
                            onEdit={() => openEdit(cp)}
                            onDeactivate={() => quickDeactivate(cp)}
                        />
                    ))}
                </NUTRYAHListShell>
            )}

            {modalOpen && (
                <CreditPlanModal
                    primary={primary}
                    existing={editing}
                    payers={payers}
                    tpas={tpas}
                    onClose={() => {
                        setModalOpen(false)
                        setEditing(null)
                    }}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    )
}

function CreditPlanModal({ existing, payers, tpas, onClose, onSaved, onDeleted, primary }) {
    const canManage = useCan('patients.masters.manage')
    const [form, setForm] = useState(() => ({
        code: existing?.code || '',
        name: existing?.name || '',
        payer_id: existing?.payer_id || '',
        tpa_id: existing?.tpa_id || '',
        description: existing?.description || '',
    }))
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    const save = async (e) => {
        e.preventDefault()
        if (!canManage) return
        setSaving(true)
        setErr('')
        try {
            const payload = {
                ...form,
                payer_id: form.payer_id ? Number(form.payer_id) : null,
                tpa_id: form.tpa_id ? Number(form.tpa_id) : null,
            }
            if (existing) {
                await API.put(`/patient-masters/credit-plans/${existing.id}`, payload)
                onSaved?.('update')
            } else {
                await API.post('/patient-masters/credit-plans', payload)
                onSaved?.('create')
            }
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to save credit plan'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        if (!existing || !canManage) return
        if (!window.confirm('Deactivate this credit plan?')) return
        setSaving(true)
        setErr('')
        try {
            await API.delete(`/patient-masters/credit-plans/${existing.id}`)
            onDeleted?.()
            onClose?.()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate credit plan'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <NUTRYAHModal title={existing ? 'Edit Credit Plan' : 'New Credit Plan'} subtitle="Map plan to payer & optional TPA for billing workflows." onClose={onClose}>
            {err && (
                <div className="mb-3 rounded-3xl border border-rose-200 bg-rose-50/80 p-3 text-[13px] text-rose-700">
                    {err}
                </div>
            )}

            <form onSubmit={save} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={UI.label}>Code</label>
                        <input className={UI.input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
                    </div>
                    <div>
                        <label className={UI.label}>Name</label>
                        <input className={UI.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={UI.label}>Payer</label>
                        <select className={UI.input} value={form.payer_id || ''} onChange={(e) => setForm({ ...form, payer_id: e.target.value || '' })} required>
                            <option value="">Select payer…</option>
                            {payers.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={UI.label}>TPA (optional)</label>
                        <select className={UI.input} value={form.tpa_id || ''} onChange={(e) => setForm({ ...form, tpa_id: e.target.value || '' })}>
                            <option value="">No TPA</option>
                            {tpas.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className={UI.label}>Description / Notes</label>
                    <textarea className={UI.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {existing ? (
                        <button
                            type="button"
                            onClick={remove}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100/60"
                        >
                            <Trash2 className="h-4 w-4" />
                            Deactivate
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} className={cx(UI.btnOutline, 'h-10')}>
                            Cancel
                        </button>
                        <button className={cx(UI.btn, 'h-10 text-white shadow-sm')} style={{ backgroundColor: primary }} disabled={saving || !canManage}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </form>
        </NUTRYAHModal>
    )
}
