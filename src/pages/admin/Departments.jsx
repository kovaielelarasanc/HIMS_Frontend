// FILE: frontend/src/admin/Departments.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'

import {
    Building2,
    Search,
    Plus,
    X,
    MoreHorizontal,
    Pencil,
    Trash2,
    ChevronRight,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'

const cx = (...a) => a.filter(Boolean).join(' ')

const fadeIn = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
}

/* -------------------------
   NUTRYAH-ish UI atoms
------------------------- */
const UI = {
    page: 'min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8',
    container: 'mx-auto max-w-6xl space-y-4 md:space-y-5 lg:space-y-6',
    card:
        'rounded-3xl border border-black/50 bg-white/85 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
    inset:
        'rounded-3xl border border-black/50 bg-white/90 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
    subtle: 'rounded-3xl border border-black/50 bg-black/[0.02]',
    label: 'text-[11px] font-semibold text-slate-600',
    input:
        'w-full rounded-2xl border border-black/50 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-black/20 focus:ring-2 focus:ring-black/10',
    inputSm:
        'w-full rounded-2xl border border-black/50 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-black/20 focus:ring-2 focus:ring-black/10',
    btn:
        'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition active:scale-[0.99]',
    btnOutline:
        'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border border-black/50 bg-white hover:bg-black/[0.03] transition active:scale-[0.99]',
    badge:
        'inline-flex items-center rounded-full border border-black/50 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-slate-700',
}

/** NUTRYAH segmented control */
function Segmented({ value, onChange, options, className = '' }) {
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
                    >
                        {o.label}
                    </button>
                )
            })}
        </div>
    )
}

/** NUTRYAH search */
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

/** NUTRYAH modal (bottom sheet on mobile, centered on desktop) */
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

/** macOS list shell */
function NUTRYAHListShell({ title, right, children }) {
    return (
        <div className="overflow-hidden rounded-3xl border border-black/50 bg-white/85 backdrop-blur">
            {(title || right) && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/50 bg-white/80 backdrop-blur">
                    <div className="text-[12px] font-semibold text-slate-700 tracking-tight">
                        {title}
                    </div>
                    <div className="flex items-center gap-2">{right}</div>
                </div>
            )}
            <div className="divide-y divide-black/5">{children}</div>
        </div>
    )
}

function RowActions({ canUpdate, canDelete, onEdit, onDelete }) {
    if (!canUpdate && !canDelete) return null
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
                {canUpdate && (
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
                )}
                {canUpdate && canDelete && <DropdownMenuSeparator />}
                {canDelete && (
                    <DropdownMenuItem
                        onSelect={(e) => {
                            e.preventDefault()
                            onDelete?.()
                        }}
                        className="cursor-pointer text-rose-700 focus:text-rose-700"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function NUTRYAHListRow({
    index,
    title,
    subtitle,
    canClick,
    onClick,
    canUpdate,
    canDelete,
    onEdit,
    onDelete,
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
                <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.04] border border-black/50 text-[11px] font-semibold text-slate-600">
                    {index}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-[14px] sm:text-[15px] font-semibold text-slate-900 truncate">
                        {title}
                    </div>
                    <div className="mt-1 text-[12px] text-slate-600 line-clamp-1">
                        {subtitle || <span className="text-slate-400">No description</span>}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <RowActions
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                    <ChevronRight className="h-5 w-5 text-slate-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition" />
                </div>
            </div>
        </div>
    )
}

function SkeletonRow() {
    return (
        <div className="px-4 py-3">
            <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-black/[0.06]" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded-full bg-black/[0.06]" />
                    <div className="h-2.5 w-1/2 rounded-full bg-black/[0.05]" />
                </div>
                <div className="h-9 w-9 rounded-full bg-black/[0.05]" />
            </div>
        </div>
    )
}

function EmptyState({ title, subtitle }) {
    return (
        <div className="rounded-3xl border border-black/50 bg-white/80 p-6 text-center text-slate-600">
            <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] grid place-items-center">
                <Building2 className="h-6 w-6 text-slate-400" />
            </div>
            <div className="mt-3 font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div>
        </div>
    )
}

/* -------------------------
   PAGE
------------------------- */
export default function Departments() {
    const { hasAny, canView, canCreate, canUpdate, canDelete } =
        useModulePerms('departments')

    const [items, setItems] = useState([])
    const [error, setError] = useState('')
    const [loadingList, setLoadingList] = useState(false)

    const [searchTerm, setSearchTerm] = useState('')
    const [filterChip, setFilterChip] = useState('all') // all | withDesc | withoutDesc

    // sheet modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [editId, setEditId] = useState(null)
    const [form, setForm] = useState({ name: '', description: '' })
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        if (!canView) return
        setError('')
        setLoadingList(true)
        try {
            const { data } = await API.get('/departments/')
            setItems(data || [])
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied for Departments.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to load departments.')
        } finally {
            setLoadingList(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const filteredItems = useMemo(() => {
        return (items || []).filter((d) => {
            if (!d) return false
            const name = (d.name || '').toLowerCase()
            const desc = (d.description || '').toLowerCase()
            const query = searchTerm.toLowerCase().trim()

            if (query && !(`${name} ${desc}`.includes(query))) return false
            if (filterChip === 'withDesc' && !d.description) return false
            if (filterChip === 'withoutDesc' && d.description) return false
            return true
        })
    }, [items, searchTerm, filterChip])

    // ----- permission denied state -----
    if (!hasAny || !canView) {
        return (
            <div className={UI.page}>
                <div className={UI.container}>
                    <div className={cx(UI.card, 'relative overflow-hidden text-white bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900')}>
                        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top,_#e5e7eb,_transparent_55%)]" />
                        <div className="relative px-5 py-6 sm:px-7 sm:py-7 md:px-9 md:py-8 flex items-center gap-3">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 border border-white/20">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                                    Departments
                                </h1>
                                <p className="mt-1 text-xs sm:text-sm text-slate-100/90">
                                    Configure clinical and support departments for your hospital.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={cx(UI.card, 'p-4')}>
                        <Alert className="border-amber-200 bg-amber-50 text-amber-900 rounded-2xl">
                            <AlertTitle className="font-semibold">Access restricted</AlertTitle>
                            <AlertDescription className="text-sm">
                                Your role does not currently include access to Departments configuration. Please contact your system administrator.
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>
            </div>
        )
    }

    const openCreate = () => {
        if (!canCreate) return
        setEditId(null)
        setForm({ name: '', description: '' })
        setModalOpen(true)
    }

    const openEdit = (d) => {
        if (!canUpdate) return
        setEditId(d.id)
        setForm({ name: d.name || '', description: d.description || '' })
        setModalOpen(true)
    }

    const closeModal = () => {
        setModalOpen(false)
        setEditId(null)
        setForm({ name: '', description: '' })
    }

    const save = async (e) => {
        e.preventDefault()
        if (!editId && !canCreate) return
        if (editId && !canUpdate) return

        setSaving(true)
        setError('')
        try {
            if (editId) await API.put(`/departments/${editId}`, form)
            else await API.post('/departments/', form)
            closeModal()
            load()
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to save department.')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (id) => {
        if (!canDelete) return
        if (!window.confirm('Delete this department?')) return
        try {
            await API.delete(`/departments/${id}`)
            load()
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to delete department.')
        }
    }

    return (
        <div className={UI.page}>
            <div className={UI.container}>
                {/* Top meta */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <Badge
                        variant="outline"
                        className="rounded-full border-slate-500 bg-white px-2.5 py-1 text-[11px] font-medium tracking-wide text-slate-700"
                    >
                        Admin · Departments
                    </Badge>
                   
                </div>

                {/* Hero (NUTRYAH glass gradient) */}
                <motion.div {...fadeIn}>
                    <div className={cx(UI.card, 'relative overflow-hidden')}>
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 opacity-90" />
                        <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />

                        <div className="relative px-5 py-6 sm:px-7 sm:py-7 md:px-9 md:py-8 text-white">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="max-w-2xl space-y-2">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm border border-white/20">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px]">
                                            <Building2 className="w-3.5 h-3.5" />
                                        </span>
                                        Core clinical & support structure
                                    </div>

                                    <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight">
                                        Clinical & Support Departments
                                    </h1>
                                    <p className="text-sm md:text-base text-teal-50/90 leading-relaxed">
                                        Keep OPD/IPD, diagnostics and support services aligned across the hospital.
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">
                                            Master configuration
                                        </span>
                                        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs">
                                            Used by OPD / IPD / Lab / OT
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full md:w-auto">
                                    <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur px-4 py-3">
                                        <div className="text-[10px] font-medium uppercase tracking-wide text-teal-100/90">
                                            Departments
                                        </div>
                                        <div className="mt-1 text-2xl font-semibold text-white tabular-nums">
                                            {items.length}
                                        </div>
                                        <div className="mt-1 text-[11px] text-teal-100/80">
                                            Active list used across modules
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Error */}
                {error && (
                    <motion.div {...fadeIn}>
                        <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-800">
                            <AlertTitle className="font-semibold">Issue</AlertTitle>
                            <AlertDescription className="text-sm">{error}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}

                {/* Controls */}
                <motion.div {...fadeIn}>
                    <div className={cx(UI.inset, 'p-3 sm:p-4')}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={UI.badge}>
                                        Total: <span className="ml-1 tabular-nums">{items.length}</span>
                                    </span>
                                    <span className={UI.badge}>
                                        Showing: <span className="ml-1 tabular-nums">{filteredItems.length}</span>
                                    </span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className={UI.label}>Filter</span>
                                    <Segmented
                                        value={filterChip}
                                        onChange={setFilterChip}
                                        options={[
                                            { value: 'all', label: 'All' },
                                            { value: 'withDesc', label: 'With description' },
                                            { value: 'withoutDesc', label: 'Without description' },
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                                <NUTRYAHSearch
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    placeholder="Search name or description…"
                                    className="sm:w-[320px]"
                                />
                                {canCreate && (
                                    <button
                                        type="button"
                                        onClick={openCreate}
                                        className={cx(UI.btn, 'text-white shadow-sm bg-blue-600 hover:bg-blue-700')}
                                    >
                                        <Plus className="h-4 w-4" />
                                        New
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* List (macOS rows, no tables) */}
                <motion.div {...fadeIn}>
                    {loadingList ? (
                        <NUTRYAHListShell title="Department list" right={<span className={UI.badge}>Loading…</span>}>
                            {[0, 1, 2, 3].map((i) => (
                                <SkeletonRow key={i} />
                            ))}
                        </NUTRYAHListShell>
                    ) : filteredItems.length === 0 ? (
                        <EmptyState
                            title="No departments found"
                            subtitle="Try changing your search/filter, or create a new department."
                        />
                    ) : (
                        <NUTRYAHListShell
                            title="Department list"
                           
                        >
                            {filteredItems.map((d, idx) => (
                                <NUTRYAHListRow
                                    key={d.id}
                                    index={idx + 1}
                                    title={d.name}
                                    subtitle={d.description}
                                    canClick={canUpdate}
                                    onClick={() => openEdit(d)}
                                    canUpdate={canUpdate}
                                    canDelete={canDelete}
                                    onEdit={() => openEdit(d)}
                                    onDelete={() => remove(d.id)}
                                />
                            ))}
                        </NUTRYAHListShell>
                    )}
                </motion.div>

                {/* Create/Edit Sheet */}
                {modalOpen && (
                    <NUTRYAHModal
                        title={editId ? 'Edit department' : 'New department'}
                        subtitle="Departments are used in OPD/IPD registration, staff workflows, and reporting."
                        onClose={closeModal}
                    >
                        <form onSubmit={save} className="space-y-3">
                            <div className="space-y-1.5">
                                <label className={UI.label}>
                                    Department name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    className={UI.input}
                                    placeholder="e.g., General Medicine"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    disabled={editId ? !canUpdate : !canCreate}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className={UI.label}>Description</label>
                                <input
                                    className={UI.input}
                                    placeholder="Optional short description"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    disabled={editId ? !canUpdate : !canCreate}
                                />
                            </div>

                            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                                {editId && canDelete ? (
                                    <button
                                        type="button"
                                        onClick={() => remove(editId)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100/60"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                ) : (
                                    <div />
                                )}

                                <div className="ml-auto flex gap-2">
                                    <button type="button" onClick={closeModal} className={cx(UI.btnOutline, 'h-10')}>
                                        Cancel
                                    </button>
                                    <button
                                        className={cx(UI.btn, 'h-10 text-white shadow-sm bg-blue-600 hover:bg-blue-700')}
                                        disabled={saving || (editId ? !canUpdate : !canCreate)}
                                    >
                                        {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </NUTRYAHModal>
                )}
            </div>
        </div>
    )
}
