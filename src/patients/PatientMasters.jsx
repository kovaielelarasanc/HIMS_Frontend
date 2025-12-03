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
} from 'lucide-react'

const PAYER_TYPES = [
    { value: 'insurance', label: 'Insurance' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'govt', label: 'Govt Scheme' },
    { value: 'other', label: 'Other' },
]

export default function PatientMasters() {
    const [tab, setTab] = useState('payers')
    const canView = useCan('patients.masters.view')

    if (!canView) {
        return (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                You do not have permission to view patient masters.
            </div>
        )
    }

    return (
        <div className="space-y-4 bg-white p-3 rounded">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <div>
                        <h2 className="text-xl font-semibold text-black">Patient Masters</h2>
                        <p className="text-xs text-gray-500">
                            Configure patient types, payers, TPAs and credit plans used in registration & billing.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b">
                <MastersTabButton
                    label="Patient Types"
                    active={tab === 'types'}
                    onClick={() => setTab('types')}
                />
                <MastersTabButton
                    label="Payers"
                    active={tab === 'payers'}
                    onClick={() => setTab('payers')}
                />
                <MastersTabButton
                    label="TPAs"
                    active={tab === 'tpas'}
                    onClick={() => setTab('tpas')}
                />
                <MastersTabButton
                    label="Credit Plans"
                    active={tab === 'plans'}
                    onClick={() => setTab('plans')}
                />
            </div>

            {/* Body */}
            <div>
                {tab === 'types' && <PatientTypesTab />}
                {tab === 'payers' && <PayersTab />}
                {tab === 'tpas' && <TpasTab />}
                {tab === 'plans' && <CreditPlansTab />}
            </div>
        </div>
    )
}

function MastersTabButton({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-2 text-sm transition ${active
                    ? 'border-b-2 border-blue-600 font-medium text-blue-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
        >
            {label}
        </button>
    )
}

/* ---------------------------------------------------
   PATIENT TYPES TAB
--------------------------------------------------- */

function PatientTypesTab() {
    // Backend uses patients.view / patients.update
    const canView = useCan('patients.view') || useCan('patients.masters.view')
    const canManage = useCan('patients.update') || useCan('patients.masters.manage')

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
            setErr(e?.response?.data?.detail || 'Failed to load patient types')
        } finally {
            setLoading(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        if (!q) return items
        const ql = q.toLowerCase()
        return items.filter(
            (t) =>
                t.name?.toLowerCase().includes(ql) ||
                t.code?.toLowerCase().includes(ql) ||
                t.description?.toLowerCase().includes(ql)
        )
    }, [items, q])

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }

    const openEdit = (item) => {
        if (!canManage) return
        setEditing(item)
        setModalOpen(true)
    }

    const onSaved = () => {
        setModalOpen(false)
        setEditing(null)
        load()
    }

    const onDeleted = () => {
        load()
    }

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ShieldCheck className="h-4 w-4" />
                    <span>
                        Patient types used in registration: Emergency, OPD, IPD, Health Checkup, etc.
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search code, name, description…"
                            className="w-60 max-w-full rounded-xl border px-8 py-1.5 text-sm"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            New Patient Type
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {err}
                </div>
            )}

            {/* Mobile cards */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        Loading…
                    </div>
                )}
                {!loading &&
                    filtered.map((t) => (
                        <div
                            key={t.id}
                            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold">
                                        {t.name}{' '}
                                        {t.code && (
                                            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600">
                                                {t.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${t.is_active
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                                                }`}
                                        >
                                            {t.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-[11px] text-gray-400">
                                            Sort: {t.sort_order ?? 0}
                                        </span>
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-gray-50"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            {t.description && (
                                <div className="mt-2 text-xs text-gray-600">
                                    {t.description}
                                </div>
                            )}
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        No patient types found.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-medium text-gray-600">
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
                                <td colSpan={7} className="p-4 text-center text-sm text-gray-500">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((t, idx) => (
                                <tr
                                    key={t.id}
                                    className={`border-t text-xs ${t.is_active ? 'text-black' : 'text-gray-400 bg-gray-50'
                                        }`}
                                >
                                    <td className="p-2">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px]">{t.code}</td>
                                    <td className="p-2">{t.name}</td>
                                    <td className="p-2 max-w-xs">
                                        <div className="line-clamp-2 text-[11px] text-gray-600">
                                            {t.description || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2">{t.sort_order ?? 0}</td>
                                    <td className="p-2">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${t.is_active
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                                                }`}
                                        >
                                            {t.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(t)}
                                                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] bg-green-300 hover:bg-gray-50"
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
                                    className="p-6 text-center text-sm text-gray-500"
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
            } else {
                await API.post('/patient-types', payload)
            }
            onSaved && onSaved()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to save patient type')
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
            setErr(e?.response?.data?.detail || 'Failed to deactivate patient type')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-black">
                            {existing ? 'Edit Patient Type' : 'New Patient Type'}
                        </h3>
                        <p className="text-xs text-gray-500">
                            Define master types like Emergency, OPD, IPD, Health Checkup, etc.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {err}
                    </div>
                )}

                <form onSubmit={save} className="space-y-3 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">
                                Code
                            </label>
                            <input
                                className="input text-gray-800"
                                value={form.code}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        code: e.target.value.toUpperCase(),
                                    })
                                }
                                required
                            />
                            <p className="mt-0.5 text-[10px] text-gray-400">
                                Example: EMERGENCY, OPD, IPD, HC
                            </p>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">
                                Name
                            </label>
                            <input
                                className="input text-gray-800"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-black">
                            Description (optional)
                        </label>
                        <textarea
                            className="input min-h-[80px] text-gray-800"
                            value={form.description}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                        />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 items-center">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">
                                Sort Order
                            </label>
                            <input
                                className="input text-gray-800"
                                type="number"
                                value={form.sort_order}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        sort_order: e.target.value,
                                    })
                                }
                            />
                            <p className="mt-0.5 text-[10px] text-gray-400">
                                Lower number shows earlier in dropdowns.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-4 md:mt-7">
                            <input
                                id="pt-active"
                                type="checkbox"
                                className="h-4 w-4"
                                checked={form.is_active}
                                onChange={(e) =>
                                    setForm({ ...form, is_active: e.target.checked })
                                }
                            />
                            <label
                                htmlFor="pt-active"
                                className="text-xs font-medium text-black"
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
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deactivate
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border px-4 py-1.5 text-xs hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button className="btn" disabled={saving || !canManage}>
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
   PAYERS TAB
--------------------------------------------------- */

function PayersTab() {
    const canView = useCan('patients.masters.view')
    const canManage = useCan('patients.masters.manage')

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
            setErr(e?.response?.data?.detail || 'Failed to load payers')
        } finally {
            setLoading(false)
        }
    }, [canView])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        if (!q) return items
        const ql = q.toLowerCase()
        return items.filter(
            (p) =>
                p.name?.toLowerCase().includes(ql) ||
                p.code?.toLowerCase().includes(ql) ||
                p.payer_type?.toLowerCase().includes(ql)
        )
    }, [items, q])

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }

    const openEdit = (item) => {
        if (!canManage) return
        setEditing(item)
        setModalOpen(true)
    }

    const onSaved = () => {
        setModalOpen(false)
        setEditing(null)
        load()
    }

    const onDeleted = () => {
        load()
    }

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Payers (Insurance / Corporate / Govt schemes)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search code, name, type…"
                            className="w-52 max-w-full rounded-xl border px-8 py-1.5 text-sm"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            New Payer
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {err}
                </div>
            )}

            {/* Mobile cards */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        Loading…
                    </div>
                )}
                {!loading &&
                    filtered.map((p) => (
                        <div
                            key={p.id}
                            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold ">
                                        {p.name}{' '}
                                        {p.code && (
                                            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600">
                                                {p.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500 capitalize">
                                        {p.payer_type || '—'}
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(p)}
                                        className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-gray-50"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-gray-600">
                                {p.contact_person && <div>Contact: {p.contact_person}</div>}
                                {p.phone && <div>Phone: {p.phone}</div>}
                                {p.email && <div>Email: {p.email}</div>}
                                {p.address && (
                                    <div className="line-clamp-2">Address: {p.address}</div>
                                )}
                            </div>
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        No payers found.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-medium text-gray-600">
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
                                <td colSpan={8} className="p-4 text-center text-sm text-gray-500">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((p, idx) => (
                                <tr key={p.id} className="border-t text-xs text-black">
                                    <td className="p-2">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px]">{p.code}</td>
                                    <td className="p-2">{p.name}</td>
                                    <td className="p-2 capitalize">{p.payer_type || '—'}</td>
                                    <td className="p-2">{p.contact_person || '—'}</td>
                                    <td className="p-2">
                                        <div>{p.phone || '—'}</div>
                                        <div className="text-[11px] text-gray-500">
                                            {p.email || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 max-w-xs">
                                        <div className="line-clamp-2 text-[11px] text-gray-600">
                                            {p.address || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(p)}
                                                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] bg-green-300 hover:bg-gray-50"
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
                                    className="p-6 text-center text-sm text-gray-500"
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
            } else {
                await API.post('/patient-masters/payers', form)
            }
            onSaved && onSaved()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to save payer')
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
            setErr(e?.response?.data?.detail || 'Failed to deactivate payer')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-black">
                            {existing ? 'Edit Payer' : 'New Payer'}
                        </h3>
                        <p className="text-xs text-gray-500">
                            Master record used for credit / insurance patients.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 bg-yellow-300 hover:bg-gray-100 text-black"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {err}
                    </div>
                )}

                <form onSubmit={save} className="space-y-3 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">Code</label>
                            <input
                                className="input text-gray-800"
                                value={form.code}
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">Name</label>
                            <input
                                className="input text-gray-800"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">Type</label>
                            <select
                                className="input text-gray-800"
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
                            <label className="mb-1 block text-xs font-medium text-black">
                                Contact Person
                            </label>
                            <input
                                className="input text-gray-800"
                                value={form.contact_person}
                                onChange={(e) =>
                                    setForm({ ...form, contact_person: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">Phone</label>
                            <input
                                className="input text-gray-800"
                                value={form.phone}
                                onChange={(e) =>
                                    setForm({ ...form, phone: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-black">Email</label>
                            <input
                                className="input text-gray-800"
                                type="email"
                                value={form.email}
                                onChange={(e) =>
                                    setForm({ ...form, email: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-black">Address</label>
                        <textarea
                            className="input min-h-[80px] text-gray-800"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        {existing && (
                            <button
                                type="button"
                                onClick={remove}
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deactivate
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border px-4 py-1.5 text-xs bg-red-700 hover:bg-red-500"
                            >
                                Cancel
                            </button>
                            <button className="btn" disabled={saving || !canManage}>
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
            setErr(e?.response?.data?.detail || 'Failed to load TPAs')
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

    const onSaved = () => {
        setModalOpen(false)
        setEditing(null)
        load()
    }

    const onDeleted = () => {
        load()
    }

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Third-party administrators (TPAs) linked to payers.</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search code, name, payer…"
                            className="w-52 max-w-full rounded-xl border px-8 py-1.5 text-sm"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            New TPA
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {err}
                </div>
            )}

            {/* Mobile cards */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        Loading…
                    </div>
                )}
                {!loading &&
                    filtered.map((t) => (
                        <div
                            key={t.id}
                            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold">
                                        {t.name}{' '}
                                        {t.code && (
                                            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600">
                                                {t.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        Payer: {payerMap[t.payer_id]?.name || '—'}
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-gray-50"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-gray-600">
                                {t.contact_person && (
                                    <div>Contact: {t.contact_person}</div>
                                )}
                                {t.phone && <div>Phone: {t.phone}</div>}
                                {t.email && <div>Email: {t.email}</div>}
                            </div>
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        No TPAs found.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-medium text-gray-600">
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
                                <td colSpan={7} className="p-4 text-center text-sm text-gray-500">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((t, idx) => (
                                <tr key={t.id} className="border-t text-xs">
                                    <td className="p-2 text-gray-800">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px] text-gray-800">
                                        {t.code}
                                    </td>
                                    <td className="p-2 text-gray-800">{t.name}</td>
                                    <td className="p-2 text-gray-800">
                                        {payerMap[t.payer_id]?.name || '—'}
                                    </td>
                                    <td className="p-2 text-gray-800">
                                        {t.contact_person || '—'}
                                    </td>
                                    <td className="p-2 text-gray-800">
                                        <div>{t.phone || '—'}</div>
                                        <div className="text-[11px] text-gray-500">
                                            {t.email || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(t)}
                                                className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] hover:bg-gray-500 bg-green-300"
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
                                    className="p-6 text-center text-sm text-gray-500"
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
            } else {
                await API.post('/patient-masters/tpas', payload)
            }
            onSaved && onSaved()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to save TPA')
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
            setErr(e?.response?.data?.detail || 'Failed to deactivate TPA')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">
                            {existing ? 'Edit TPA' : 'New TPA'}
                        </h3>
                        <p className="text-xs text-gray-500">
                            Third-party administrator master, mapped to payer.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {err}
                    </div>
                )}

                <form onSubmit={save} className="space-y-3 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium">Code</label>
                            <input
                                className="input"
                                value={form.code}
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium">Name</label>
                            <input
                                className="input"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium">Payer</label>
                        <select
                            className="input"
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
                            <label className="mb-1 block text-xs font-medium">
                                Contact Person
                            </label>
                            <input
                                className="input"
                                value={form.contact_person}
                                onChange={(e) =>
                                    setForm({ ...form, contact_person: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium">Phone</label>
                            <input
                                className="input"
                                value={form.phone}
                                onChange={(e) =>
                                    setForm({ ...form, phone: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium">Email</label>
                        <input
                            className="input"
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
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deactivate
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border px-4 py-1.5 text-xs hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button className="btn" disabled={saving || !canManage}>
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
            setErr(e?.response?.data?.detail || 'Failed to load credit plans')
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

    const onSaved = () => {
        setModalOpen(false)
        setEditing(null)
        load()
    }

    const onDeleted = () => {
        load()
    }

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Layers className="h-4 w-4" />
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
                            className="w-60 max-w-full rounded-xl border px-8 py-1.5 text-sm"
                        />
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            New Plan
                        </button>
                    )}
                </div>
            </div>

            {err && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {err}
                </div>
            )}

            {/* Mobile cards */}
            <div className="grid gap-3 sm:hidden">
                {loading && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        Loading…
                    </div>
                )}
                {!loading &&
                    filtered.map((cp) => (
                        <div
                            key={cp.id}
                            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold">
                                        {cp.name}{' '}
                                        {cp.code && (
                                            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600">
                                                {cp.code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        Payer: {payerMap[cp.payer_id]?.name || '—'}
                                    </div>
                                    <div className="mt-0.5 text-xs text-gray-500">
                                        TPA: {tpaMap[cp.tpa_id]?.name || '—'}
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => openEdit(cp)}
                                        className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-gray-50"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                )}
                            </div>
                            {cp.description && (
                                <div className="mt-2 text-xs text-gray-600">
                                    {cp.description}
                                </div>
                            )}
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl border bg-white p-4 text-center text-sm text-gray-500">
                        No credit plans found.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border bg-white sm:block">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-medium text-gray-600">
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
                                <td colSpan={7} className="p-4 text-center text-sm text-gray-500">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((cp, idx) => (
                                <tr key={cp.id} className="border-t text-xs text-black">
                                    <td className="p-2">{idx + 1}</td>
                                    <td className="p-2 font-mono text-[11px]">{cp.code}</td>
                                    <td className="p-2">{cp.name}</td>
                                    <td className="p-2">
                                        {payerMap[cp.payer_id]?.name || '—'}
                                    </td>
                                    <td className="p-2">
                                        {tpaMap[cp.tpa_id]?.name || '—'}
                                    </td>
                                    <td className="p-2 max-w-xs">
                                        <div className="line-clamp-2 text-[11px] text-gray-600">
                                            {cp.description || '—'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-right">
                                        {canManage && (
                                            <button
                                                onClick={() => openEdit(cp)}
                                                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] bg-green-300 hover:bg-gray-50"
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
                                    className="p-6 text-center text-sm text-gray-500"
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
            } else {
                await API.post('/patient-masters/credit-plans', payload)
            }
            onSaved && onSaved()
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to save credit plan')
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
            setErr(e?.response?.data?.detail || 'Failed to deactivate credit plan')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">
                            {existing ? 'Edit Credit Plan' : 'New Credit Plan'}
                        </h3>
                        <p className="text-xs text-gray-500">
                            Map plan to payer & optional TPA for billing workflows.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {err}
                    </div>
                )}

                <form onSubmit={save} className="space-y-3 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium">Code</label>
                            <input
                                className="input"
                                value={form.code}
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium">Name</label>
                            <input
                                className="input"
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
                            <label className="mb-1 block text-xs font-medium">Payer</label>
                            <select
                                className="input"
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
                            <label className="mb-1 block text-xs font-medium">
                                TPA (optional)
                            </label>
                            <select
                                className="input"
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
                        <label className="mb-1 block text-xs font-medium">
                            Description / Notes
                        </label>
                        <textarea
                            className="input min-h-[80px]"
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
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deactivate
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border px-4 py-1.5 text-xs hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button className="btn" disabled={saving || !canManage}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
