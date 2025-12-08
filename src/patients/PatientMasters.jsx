// FILE: frontend/src/patients/PatientMasters.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import API from '../api/client'
import { useCan } from '../hooks/useCan'
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
} from 'lucide-react'
import { toast } from 'sonner'

const PAYER_TYPES = [
    { value: 'insurance', label: 'Insurance' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'govt', label: 'Govt Scheme' },
    { value: 'other', label: 'Other' },
]
// Small chip used for filters
function FilterChip({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "inline-flex items-center rounded-full px-3 py-1 text-xs sm:text-sm transition-all",
                active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            ].join(" ")}
        >
            {label}
        </button>
    )
}

// Modal wrapper: bottom sheet on mobile, centered on desktop
function ResponsiveModal({ title, subtitle, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto
                            rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl
                            px-4 py-4 sm:px-5 sm:py-5
                            transform transition-transform duration-200 ease-out translate-y-0">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="mt-1 text-xs sm:text-sm text-slate-500">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {children}
            </div>
        </div>
    )
}

export default function PatientMasters() {
    const [tab, setTab] = useState('payers')
    const canMastersView = useCan('patients.masters.view')
    const canPatientsView = useCan('patients.view')
    const canView = canMastersView || canPatientsView

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-sm">
                You do not have permission to view patient masters.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Top hero – teal style like sample login */}
            <div className="rounded-3xl bg-gradient-to-b from-teal-700 to-teal-600 text-white p-5 pb-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-xl sm:text-2xl font-semibold">Hello!</div>
                        <div className="mt-1 text-sm sm:text-base text-teal-50">
                            Welcome to <span className="font-semibold">Patient Masters</span>
                        </div>
                        <p className="mt-2 max-w-xl text-xs sm:text-sm text-teal-50/90">
                            Configure patient types, payers, TPAs & credit plans that drive
                            registration and billing workflows.
                        </p>
                    </div>
                    <div className="flex gap-2 text-[11px] sm:text-xs justify-start sm:justify-end">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            IPD / OPD ready
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                            <ShieldCheck className="h-3 w-3" />
                            NABH aligned
                        </span>
                    </div>
                </div>

                {/* Desktop tab chips */}
                <div className="mt-4 hidden sm:flex gap-2">
                    <MastersTabButton
                        label="Patient Types"
                        icon={Users}
                        active={tab === 'types'}
                        onClick={() => setTab('types')}
                    />
                    <MastersTabButton
                        label="Payers"
                        icon={Building2}
                        active={tab === 'payers'}
                        onClick={() => setTab('payers')}
                    />
                    <MastersTabButton
                        label="TPAs"
                        icon={Shield}
                        active={tab === 'tpas'}
                        onClick={() => setTab('tpas')}
                    />
                    <MastersTabButton
                        label="Credit Plans"
                        icon={CreditCard}
                        active={tab === 'plans'}
                        onClick={() => setTab('plans')}
                    />
                </div>
            </div>

            {/* Mobile sticky dropdown for tabs */}
            <div className="sm:hidden sticky top-0 z-20 -mt-3 -mx-3 mb-2 bg-slate-50/95 backdrop-blur px-3 pt-3 pb-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                    Section
                </label>
                <select
                    value={tab}
                    onChange={(e) => setTab(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                    <option value="types">Patient Types</option>
                    <option value="payers">Payers</option>
                    <option value="tpas">TPAs</option>
                    <option value="plans">Credit Plans</option>
                </select>
            </div>

            {/* Active tab body */}
            <div className="rounded-3xl border border-slate-100 bg-white/95 p-3 sm:p-4 shadow-sm">
                {tab === 'types' && <PatientTypesTab />}
                {tab === 'payers' && <PayersTab />}
                {tab === 'tpas' && <TpasTab />}
                {tab === 'plans' && <CreditPlansTab />}
            </div>
        </div>
    )
}


function MastersTabButton({ label, active, onClick, icon: Icon }) {
    return (
        <button
            onClick={onClick}
            className={[
                'inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-all duration-150',
                'border text-xs sm:text-[13px]',
                active
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50',
            ].join(' ')}
        >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{label}</span>
        </button>
    )
}

/* ---------------------------------------------------
   PATIENT TYPES TAB
--------------------------------------------------- */

function PatientTypesTab() {
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
            const { data } = await API.get('/patient-types', {
                params: { include_inactive: true },
            })
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

        if (statusFilter === 'active') {
            data = data.filter((t) => t.is_active)
        } else if (statusFilter === 'inactive') {
            data = data.filter((t) => !t.is_active)
        }

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
        toast.success(
            mode === 'update' ? 'Patient type updated successfully' : 'Patient type created successfully'
        )
    }

    const onDeleted = () => {
        load()
        toast.success('Patient type deactivated successfully')
    }

    return (
        <div className="space-y-4">
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-[11px] sm:text-xs text-slate-500 mr-1">
                    Status:
                </span>
                <FilterChip
                    label="All"
                    active={statusFilter === 'all'}
                    onClick={() => setStatusFilter('all')}
                />
                <FilterChip
                    label="Active"
                    active={statusFilter === 'active'}
                    onClick={() => setStatusFilter('active')}
                />
                <FilterChip
                    label="Inactive"
                    active={statusFilter === 'inactive'}
                    onClick={() => setStatusFilter('inactive')}
                />
            </div>
            {/* Top bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs text-slate-600 sm:text-sm">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-600" />
                    <span>
                        Define patient visit types like{' '}
                        <span className="font-medium text-slate-800">
                            Emergency, OPD, IPD, Health Checkup
                        </span>{' '}
                        used in registration & triage.
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search code, name, description…"
                            className="w-60 max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-1.5 text-xs text-slate-800 outline-none ring-0 transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md active:scale-95 sm:text-sm"

                        >
                            <Plus className="h-4 w-4" />
                            New Patient Type
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 sm:text-sm">
                    {err}
                </div>
            )}

            {/* Mobile cards (stacked layout) */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500 shadow-sm">
                        Loading patient types…
                    </div>
                )}
                {!loading &&
                    filtered.map((t) => (
                        <div
                            key={t.id}
                            className="group rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900">
                                            {t.name}
                                        </span>
                                        {t.code && (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                                                {t.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                        <span
                                            className={[
                                                'inline-flex items-center rounded-full border px-2 py-0.5',
                                                t.is_active
                                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                                    : 'border-slate-200 bg-slate-100 text-slate-500',
                                            ].join(' ')}
                                        >
                                            <span
                                                className={[
                                                    'mr-1 h-1.5 w-1.5 rounded-full',
                                                    t.is_active
                                                        ? 'bg-emerald-500'
                                                        : 'bg-slate-400',
                                                ].join(' ')}
                                            />
                                            {t.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            Sort: {t.sort_order ?? 0}
                                        </span>
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"

                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            {t.description && (
                                <div className="mt-2 text-[11px] text-slate-600">
                                    {t.description}
                                </div>
                            )}
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                        No patient types found. {canManage && 'Click “New Patient Type” to add one.'}
                    </div>
                )}
            </div>

            {/* Tablet / Desktop table (data-first layout) */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            <th className="p-2">#</th>
                            <th className="p-2">Code</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Description</th>
                            <th className="p-2">Sort</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="p-4 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    Loading patient types…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((t, idx) => (
                                <tr
                                    key={t.id}
                                    className={[
                                        'border-t border-slate-100 text-xs transition',
                                        t.is_active ? 'bg-white' : 'bg-slate-50/70 text-slate-400',
                                        'hover:bg-slate-50',
                                    ].join(' ')}
                                >
                                    <td className="p-2 text-slate-600">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px] text-slate-700">
                                        {t.code}
                                    </td>
                                    <td className="p-2 text-slate-900">{t.name}</td>
                                    <td className="p-2 max-w-xs">
                                        <div className="line-clamp-2 text-[11px] text-slate-600">
                                            {t.description || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-slate-700">
                                        {t.sort_order ?? 0}
                                    </td>
                                    <td className="p-2">
                                        <span
                                            className={[
                                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]',
                                                t.is_active
                                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                                    : 'border-slate-200 bg-slate-100 text-slate-500',
                                            ].join(' ')}
                                        >
                                            <span
                                                className={[
                                                    'mr-1 h-1.5 w-1.5 rounded-full',
                                                    t.is_active
                                                        ? 'bg-emerald-500'
                                                        : 'bg-slate-400',
                                                ].join(' ')}
                                            />
                                            {t.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(t)}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"

                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="p-6 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    No patient types found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <PatientTypeModal
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

function PatientTypeModal({ existing, onClose, onSaved, onDeleted }) {
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
            const payload = {
                ...form,
                sort_order: Number(form.sort_order) || 0,
            }
            if (existing) {
                await API.put(`/patient-types/${existing.id}`, payload)
                onSaved && onSaved('update')
            } else {
                await API.post('/patient-types', payload)
                onSaved && onSaved('create')
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
            onDeleted && onDeleted()
            onClose && onClose()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate patient type'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (

        <ResponsiveModal
            title={existing ? 'Edit Patient Type' : 'New Patient Type'}
            subtitle="Define master types like Emergency, OPD, IPD, Health Checkup, etc."
            onClose={onClose}
        >
            {err && (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs sm:text-sm text-rose-700">
                    {err}
                </div>
            )}

            <form onSubmit={save} className="space-y-3 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-800">
                            Code
                        </label>
                        <input
                            className="input text-slate-800"
                            value={form.code}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    code: e.target.value.toUpperCase(),
                                })
                            }
                            required
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            Example: EMERGENCY, OPD, IPD, HC
                        </p>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-800">
                            Name
                        </label>
                        <input
                            className="input text-slate-800"
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-800">
                        Description (optional)
                    </label>
                    <textarea
                        className="input min-h-[80px] text-slate-800"
                        value={form.description}
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                    />
                </div>

                <div className="grid items-center gap-3 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-800">
                            Sort Order
                        </label>
                        <input
                            className="input text-slate-800"
                            type="number"
                            value={form.sort_order}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    sort_order: e.target.value,
                                })
                            }
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            Lower number shows earlier in dropdowns.
                        </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 md:mt-7">
                        <input
                            id="pt-active"
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={form.is_active}
                            onChange={(e) =>
                                setForm({ ...form, is_active: e.target.checked })
                            }
                        />
                        <label
                            htmlFor="pt-active"
                            className="text-xs font-medium text-slate-800"
                        >
                            Active
                        </label>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {existing && (
                        <button
                            type="button"
                            onClick={remove}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Deactivate
                        </button>
                    )}
                    <div className="ml-auto flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            className="btn rounded-full px-4 py-1.5 text-xs"
                            disabled={saving || !canManage}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </form>
        </ResponsiveModal>


    )
}

/* ---------------------------------------------------
   PAYERS TAB
--------------------------------------------------- */

function PayersTab() {
    const canView = useCan('patients.masters.view')
    const canMastersView = useCan('patients.masters.view')
    const canPatientsView = useCan('patients.masters.manage')
    const canManage = canMastersView || canPatientsView
    const [payerTypeFilter, setPayerTypeFilter] = useState('all') // all | insurance | corporate | govt | other


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

        if (payerTypeFilter !== 'all') {
            data = data.filter((p) => p.payer_type === payerTypeFilter)
        }

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
        toast.success(
            mode === 'update' ? 'Payer updated successfully' : 'Payer created successfully'
        )
    }

    const onDeleted = () => {
        load()
        toast.success('Payer deactivated successfully')
    }

    return (
        <div className="space-y-4">
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-[11px] sm:text-xs text-slate-500 mr-1">
                    Payer type:
                </span>
                <FilterChip
                    label="All"
                    active={payerTypeFilter === 'all'}
                    onClick={() => setPayerTypeFilter('all')}
                />
                {PAYER_TYPES.map((t) => (
                    <FilterChip
                        key={t.value}
                        label={t.label}
                        active={payerTypeFilter === t.value}
                        onClick={() => setPayerTypeFilter(t.value)}
                    />
                ))}
            </div>

            {/* Top bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs text-slate-600 sm:text-sm">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-600" />
                    <span>
                        Payers used for{' '}
                        <span className="font-medium text-slate-800">
                            insurance, corporate and government schemes
                        </span>{' '}
                        in OPD/IPD billing.
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search code, name, type…"
                            className="w-52 max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-1.5 text-xs text-slate-800 outline-none ring-0 transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md active:scale-95 sm:text-sm"
                        >
                            <Plus className="h-4 w-4" />
                            New Payer
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 sm:text-sm">
                    {err}
                </div>
            )}

            {/* Mobile cards */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500 shadow-sm">
                        Loading payers…
                    </div>
                )}
                {!loading &&
                    filtered.map((p) => (
                        <div
                            key={p.id}
                            className="group rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900">
                                            {p.name}
                                        </span>
                                        {p.code && (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                                                {p.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-[11px] capitalize text-slate-500">
                                        {p.payer_type || '—'}
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(p)}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50"

                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                                {p.contact_person && (
                                    <div>
                                        <span className="font-medium text-slate-700">
                                            Contact:
                                        </span>{' '}
                                        {p.contact_person}
                                    </div>
                                )}
                                {p.phone && (
                                    <div>
                                        <span className="font-medium text-slate-700">
                                            Phone:
                                        </span>{' '}
                                        {p.phone}
                                    </div>
                                )}
                                {p.email && (
                                    <div>
                                        <span className="font-medium text-slate-700">
                                            Email:
                                        </span>{' '}
                                        {p.email}
                                    </div>
                                )}
                                {p.address && (
                                    <div className="line-clamp-2">
                                        <span className="font-medium text-slate-700">
                                            Address:
                                        </span>{' '}
                                        {p.address}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                        No payers found.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            <th className="p-2">#</th>
                            <th className="p-2">Code</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Contact</th>
                            <th className="p-2">Phone / Email</th>
                            <th className="p-2">Address</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="p-4 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    Loading payers…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((p, idx) => (
                                <tr
                                    key={p.id}
                                    className="border-t border-slate-100 text-xs text-slate-800 transition hover:bg-slate-50"
                                >
                                    <td className="p-2">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px] text-slate-700">
                                        {p.code}
                                    </td>
                                    <td className="p-2">{p.name}</td>
                                    <td className="p-2 capitalize text-slate-700">
                                        {p.payer_type || '—'}
                                    </td>
                                    <td className="p-2 text-slate-700">
                                        {p.contact_person || '—'}
                                    </td>
                                    <td className="p-2">
                                        <div>{p.phone || '—'}</div>
                                        <div className="text-[11px] text-slate-500">
                                            {p.email || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 max-w-xs">
                                        <div className="line-clamp-2 text-[11px] text-slate-600">
                                            {p.address || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(p)}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="p-6 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    No payers found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <PayerModal
                    onClose={() => {
                        setModalOpen(false)
                        setEditing(null)
                    }}
                    existing={editing}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    )
}

function PayerModal({ existing, onClose, onSaved, onDeleted }) {
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
                onSaved && onSaved('update')
            } else {
                await API.post('/patient-masters/payers', form)
                onSaved && onSaved('create')
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
            onDeleted && onDeleted()
            onClose && onClose()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate payer'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                            {existing ? 'Edit Payer' : 'New Payer'}
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                            Master record used for credit / insurance patients.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 sm:text-sm">
                        {err}
                    </div>
                )}

                <form onSubmit={save} className="space-y-3 text-xs sm:text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Code
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.code}
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Name
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Type
                            </label>
                            <select
                                className="input text-slate-800"
                                value={form.payer_type}
                                onChange={(e) =>
                                    setForm({ ...form, payer_type: e.target.value })
                                }
                            >
                                {PAYER_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Contact Person
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.contact_person}
                                onChange={(e) =>
                                    setForm({ ...form, contact_person: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Phone
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.phone}
                                onChange={(e) =>
                                    setForm({ ...form, phone: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Email
                            </label>
                            <input
                                className="input text-slate-800"
                                type="email"
                                value={form.email}
                                onChange={(e) =>
                                    setForm({ ...form, email: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-800">
                            Address
                        </label>
                        <textarea
                            className="input min-h-[80px] text-slate-800"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        {existing && (
                            <button
                                type="button"
                                onClick={remove}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deactivate
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                className="btn rounded-full px-4 py-1.5 text-[11px]"
                                disabled={saving || !canManage}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* ---------------------------------------------------
   TPAs TAB
--------------------------------------------------- */

function TpasTab() {
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
        toast.success(
            mode === 'update' ? 'TPA updated successfully' : 'TPA created successfully'
        )
    }

    const onDeleted = () => {
        load()
        toast.success('TPA deactivated successfully')
    }

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs text-slate-600 sm:text-sm">
                    <Shield className="mt-0.5 h-4 w-4 text-blue-600" />
                    <span>Third-party administrators (TPAs) linked to payers.</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search code, name, payer…"
                            className="w-52 max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-1.5 text-xs text-slate-800 outline-none ring-0 transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md active:scale-95 sm:text-sm"
                        >
                            <Plus className="h-4 w-4" />
                            New TPA
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 sm:text-sm">
                    {err}
                </div>
            )}

            {/* Mobile cards */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500 shadow-sm">
                        Loading TPAs…
                    </div>
                )}
                {!loading &&
                    filtered.map((t) => (
                        <div
                            key={t.id}
                            className="group rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900">
                                            {t.name}
                                        </span>
                                        {t.code && (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                                                {t.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                        Payer: {payerMap[t.payer_id]?.name || '—'}
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                                {t.contact_person && (
                                    <div>
                                        <span className="font-medium text-slate-700">
                                            Contact:
                                        </span>{' '}
                                        {t.contact_person}
                                    </div>
                                )}
                                {t.phone && (
                                    <div>
                                        <span className="font-medium text-slate-700">
                                            Phone:
                                        </span>{' '}
                                        {t.phone}
                                    </div>
                                )}
                                {t.email && (
                                    <div>
                                        <span className="font-medium text-slate-700">
                                            Email:
                                        </span>{' '}
                                        {t.email}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                        No TPAs found.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            <th className="p-2">#</th>
                            <th className="p-2">Code</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Payer</th>
                            <th className="p-2">Contact</th>
                            <th className="p-2">Phone / Email</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="p-4 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    Loading TPAs…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((t, idx) => (
                                <tr
                                    key={t.id}
                                    className="border-t border-slate-100 text-xs text-slate-800 transition hover:bg-slate-50"
                                >
                                    <td className="p-2 text-slate-800">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px] text-slate-700">
                                        {t.code}
                                    </td>
                                    <td className="p-2 text-slate-900">{t.name}</td>
                                    <td className="p-2 text-slate-800">
                                        {payerMap[t.payer_id]?.name || '—'}
                                    </td>
                                    <td className="p-2 text-slate-800">
                                        {t.contact_person || '—'}
                                    </td>
                                    <td className="p-2 text-slate-800">
                                        <div>{t.phone || '—'}</div>
                                        <div className="text-[11px] text-slate-500">
                                            {t.email || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(t)}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="p-6 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    No TPAs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <TpaModal
                    existing={editing}
                    onClose={() => {
                        setModalOpen(false)
                        setEditing(null)
                    }}
                    payers={payers}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    )
}

function TpaModal({ existing, payers, onClose, onSaved, onDeleted }) {
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
            const payload = {
                ...form,
                payer_id: form.payer_id ? Number(form.payer_id) : null,
            }
            if (existing) {
                await API.put(`/patient-masters/tpas/${existing.id}`, payload)
                onSaved && onSaved('update')
            } else {
                await API.post('/patient-masters/tpas', payload)
                onSaved && onSaved('create')
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
            onDeleted && onDeleted()
            onClose && onClose()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate TPA'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                            {existing ? 'Edit TPA' : 'New TPA'}
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                            Third-party administrator master, mapped to payer.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 sm:text-sm">
                        {err}
                    </div>
                )}

                <form onSubmit={save} className="space-y-3 text-xs sm:text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Code
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.code}
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Name
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-800">
                            Payer
                        </label>
                        <select
                            className="input text-slate-800"
                            value={form.payer_id || ''}
                            onChange={(e) =>
                                setForm({ ...form, payer_id: e.target.value || '' })
                            }
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

                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Contact Person
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.contact_person}
                                onChange={(e) =>
                                    setForm({ ...form, contact_person: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Phone
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.phone}
                                onChange={(e) =>
                                    setForm({ ...form, phone: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-800">
                            Email
                        </label>
                        <input
                            className="input text-slate-800"
                            type="email"
                            value={form.email}
                            onChange={(e) =>
                                setForm({ ...form, email: e.target.value })
                            }
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        {existing && (
                            <button
                                type="button"
                                onClick={remove}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deactivate
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                className="btn rounded-full px-4 py-1.5 text-[11px]"
                                disabled={saving || !canManage}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* ---------------------------------------------------
   CREDIT PLANS TAB
--------------------------------------------------- */

function CreditPlansTab() {
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
        toast.success(
            mode === 'update'
                ? 'Credit plan updated successfully'
                : 'Credit plan created successfully'
        )
    }

    const onDeleted = () => {
        load()
        toast.success('Credit plan deactivated successfully')
    }

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs text-slate-600 sm:text-sm">
                    <Layers className="mt-0.5 h-4 w-4 text-blue-600" />
                    <span>
                        Credit / insurance plans used for IPD/OPD billing & authorization.
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search code, name, payer, TPA…"
                            className="w-60 max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-1.5 text-xs text-slate-800 outline-none ring-0 transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md active:scale-95 sm:text-sm"
                        >
                            <Plus className="h-4 w-4" />
                            New Plan
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 sm:text-sm">
                    {err}
                </div>
            )}

            {/* Mobile cards */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500 shadow-sm">
                        Loading credit plans…
                    </div>
                )}
                {!loading &&
                    filtered.map((cp) => (
                        <div
                            key={cp.id}
                            className="group rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900">
                                            {cp.name}
                                        </span>
                                        {cp.code && (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                                                {cp.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                        Payer: {payerMap[cp.payer_id]?.name || '—'}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-slate-500">
                                        TPA: {tpaMap[cp.tpa_id]?.name || '—'}
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(cp)}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            {cp.description && (
                                <div className="mt-2 text-[11px] text-slate-600">
                                    {cp.description}
                                </div>
                            )}
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                        No credit plans found.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            <th className="p-2">#</th>
                            <th className="p-2">Code</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Payer</th>
                            <th className="p-2">TPA</th>
                            <th className="p-2">Description</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="p-4 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    Loading credit plans…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((cp, idx) => (
                                <tr
                                    key={cp.id}
                                    className="border-t border-slate-100 text-xs text-slate-800 transition hover:bg-slate-50"
                                >
                                    <td className="p-2">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px] text-slate-700">
                                        {cp.code}
                                    </td>
                                    <td className="p-2">{cp.name}</td>
                                    <td className="p-2">
                                        {payerMap[cp.payer_id]?.name || '—'}
                                    </td>
                                    <td className="p-2">
                                        {tpaMap[cp.tpa_id]?.name || '—'}
                                    </td>
                                    <td className="p-2 max-w-xs">
                                        <div className="line-clamp-2 text-[11px] text-slate-600">
                                            {cp.description || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(cp)}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="p-6 text-center text-xs text-slate-500 sm:text-sm"
                                >
                                    No credit plans found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <CreditPlanModal
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

function CreditPlanModal({ existing, payers, tpas, onClose, onSaved, onDeleted }) {
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
                onSaved && onSaved('update')
            } else {
                await API.post('/patient-masters/credit-plans', payload)
                onSaved && onSaved('create')
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
            onDeleted && onDeleted()
            onClose && onClose()
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to deactivate credit plan'
            setErr(msg)
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                            {existing ? 'Edit Credit Plan' : 'New Credit Plan'}
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                            Map plan to payer & optional TPA for billing workflows.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 sm:text-sm">
                        {err}
                    </div>
                )}

                <form onSubmit={save} className="space-y-3 text-xs sm:text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Code
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.code}
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Name
                            </label>
                            <input
                                className="input text-slate-800"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                Payer
                            </label>
                            <select
                                className="input text-slate-800"
                                value={form.payer_id || ''}
                                onChange={(e) =>
                                    setForm({ ...form, payer_id: e.target.value || '' })
                                }
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
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-800">
                                TPA (optional)
                            </label>
                            <select
                                className="input text-slate-800"
                                value={form.tpa_id || ''}
                                onChange={(e) =>
                                    setForm({ ...form, tpa_id: e.target.value || '' })
                                }
                            >
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
                        <label className="mb-1 block text-[11px] font-medium text-slate-800">
                            Description / Notes
                        </label>
                        <textarea
                            className="input min-h-[80px] text-slate-800"
                            value={form.description}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        {existing && (
                            <button
                                type="button"
                                onClick={remove}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deactivate
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                className="btn rounded-full px-4 py-1.5 text-[11px]"
                                disabled={saving || !canManage}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
