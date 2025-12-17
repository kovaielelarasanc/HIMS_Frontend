// FILE: frontend/src/ot/OtMastersPage.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    listOtSpecialities,
    createOtSpeciality,
    updateOtSpeciality,
    deleteOtSpeciality,
    listOtProcedures,
    createOtProcedure,
    updateOtProcedure,
    deleteOtProcedure,
} from '../api/ot'

import {
    Beaker,
    Sparkles,
    Search,
    Plus,
    Pencil,
    Trash2,
    X,
    AlertTriangle,
} from 'lucide-react'

// small helper
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1'

// ---------------------------------------------------------------------
// Generic modal shell
// ---------------------------------------------------------------------
function ModalShell({ open, title, subtitle, onClose, children }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b px-5 py-3.5">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                        {subtitle && (
                            <p className="text-xs text-slate-500">{subtitle}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------
// Specialities Tab  (NO frontend permission checks)
// ---------------------------------------------------------------------
function OtSpecialitiesTab() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState(null)
    const [form, setForm] = useState({
        name: '',
        code: '',
        description: '',
        is_active: true,
    })

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return items
        return items.filter((it) =>
            (it.name || '').toLowerCase().includes(term) ||
            (it.code || '').toLowerCase().includes(term)
        )
    }, [items, search])

    const load = async () => {
        try {
            setLoading(true)
            setError(null)
            const res = await listOtSpecialities({})
            setItems(res.data || [])
        } catch (err) {
            console.error('Failed to load OT specialities', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to load OT specialities'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const openCreate = () => {
        setEditing(null)
        setForm({
            name: '',
            code: '',
            description: '',
            is_active: true,
        })
        setFormError(null)
        setModalOpen(true)
    }

    const openEdit = (item) => {
        setEditing(item)
        setForm({
            name: item.name || '',
            code: item.code || '',
            description: item.description || '',
            is_active: toBool(item.is_active),
        })
        setFormError(null)
        setModalOpen(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!form.name) {
            setFormError('Please enter speciality name')
            return
        }
        if (!form.code) {
            setFormError('Please enter code')
            return
        }
        setSaving(true)
        setFormError(null)
        try {
            const payload = {
                name: form.name,
                code: form.code,
                description: form.description || null,
                is_active: !!form.is_active,
            }
            if (editing) {
                await updateOtSpeciality(editing.id, payload)
            } else {
                await createOtSpeciality(payload)
            }
            setModalOpen(false)
            setEditing(null)
            load()
        } catch (err) {
            console.error('Failed to save OT speciality', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save speciality'
            setFormError(msg)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (item) => {
        if (!window.confirm(`Delete speciality "${item.name}"?`)) return
        try {
            await deleteOtSpeciality(item.id)
            load()
        } catch (err) {
            console.error('Failed to delete OT speciality', err)
            alert('Failed to delete')
        }
    }

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-700">
                        <Beaker className="h-4 w-4" />
                        <span className="text-sm font-semibold">OT Specialities</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                className="w-44 rounded-lg border border-slate-500 bg-white pl-7 pr-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="overflow-hidden rounded-2xl border bg-white">
                    <table className="min-w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Code
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Name
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Description
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Active
                                </th>
                                <th className="px-4 py-2 text-right text-[11px] font-semibold text-slate-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <>
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <tr key={idx} className="animate-pulse border-t">
                                            {Array.from({ length: 5 }).map((__, cIdx) => (
                                                <td key={cIdx} className="px-4 py-2">
                                                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </>
                            )}

                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-6 text-center text-xs text-slate-500"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            <span>No OT specialities found.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filtered.map((it) => (
                                    <tr key={it.id} className="border-t">
                                        <td className="px-4 py-2 text-xs font-medium text-slate-800">
                                            {it.code}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-800">
                                            {it.name}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-600">
                                            {it.description || '—'}
                                        </td>
                                        <td className="px-4 py-2 text-xs">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${it.is_active
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-500'
                                                    }`}
                                            >
                                                {it.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right text-xs">
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(it)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-500 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-400 hover:text-sky-700"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(it)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <ModalShell
                open={modalOpen}
                title={editing ? 'Edit OT Speciality' : 'New OT Speciality'}
                subtitle="Map OT workload by speciality for scheduling and reporting."
                onClose={() => setModalOpen(false)}
            >
                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-1 gap-3 px-5 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Code <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.code}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, code: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, name: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Description
                            </label>
                            <textarea
                                rows={2}
                                className="w-full resize-none rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, description: e.target.value }))
                                }
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="ot_spec_active"
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={!!form.is_active}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                                }
                            />
                            <label
                                htmlFor="ot_spec_active"
                                className="text-xs text-slate-700"
                            >
                                Active
                            </label>
                        </div>

                        {formError && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                {formError}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                        <button
                            type="button"
                            onClick={() => setModalOpen(false)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-500 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                            disabled={saving}
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Save
                        </button>
                    </div>
                </form>
            </ModalShell>
        </>
    )
}

// ---------------------------------------------------------------------
// Procedures Tab (NO frontend permission checks)
// ---------------------------------------------------------------------
function OtProceduresTab() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')

    // For speciality dropdown
    const [specialities, setSpecialities] = useState([])
    const [specLoading, setSpecLoading] = useState(false)

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState(null)
    const [form, setForm] = useState({
        code: '',
        name: '',
        speciality_id: '',
        duration_hours: '',
        duration_minutes: '',
        rate_per_hour: '',
        description: '',
        is_active: true,
    })

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return items
        return items.filter((it) => {
            const name = (it.name || '').toLowerCase()
            const code = (it.code || '').toLowerCase()
            const specName = (it.speciality?.name || '').toLowerCase()
            return (
                name.includes(term) ||
                code.includes(term) ||
                specName.includes(term)
            )
        })
    }, [items, search])

    const loadProcedures = async () => {
        try {
            setLoading(true)
            setError(null)
            const res = await listOtProcedures({})
            setItems(res.data || [])
        } catch (err) {
            console.error('Failed to load OT procedures', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to load OT procedures'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const loadSpecialities = async () => {
        try {
            setSpecLoading(true)
            const res = await listOtSpecialities({})
            setSpecialities(res.data || [])
        } catch (err) {
            console.error('Failed to load OT specialities for procedures', err)
        } finally {
            setSpecLoading(false)
        }
    }

    useEffect(() => {
        loadProcedures()
        loadSpecialities()
    }, [])

    const openCreate = () => {
        setEditing(null)
        setForm({
            code: '',
            name: '',
            speciality_id: '',
            duration_hours: '',
            duration_minutes: '',
            rate_per_hour: '',
            description: '',
            is_active: true,
        })
        setFormError(null)
        setModalOpen(true)
    }

    const openEdit = (item) => {
        const totalMin = item.default_duration_min ?? null
        const h = totalMin != null ? Math.floor(totalMin / 60) : ''
        const m = totalMin != null ? totalMin % 60 : ''
        setEditing(item)
        setForm({
            code: item.code || '',
            name: item.name || '',
            speciality_id: item.speciality_id || '',
            duration_hours: h === 0 && m === 0 ? '' : String(h || ''),
            duration_minutes: m === 0 && h === 0 ? '' : String(m || ''),
            rate_per_hour:
                item.rate_per_hour != null ? String(item.rate_per_hour) : '',
            description: item.description || '',
            is_active: !!item.is_active,
        })
        setFormError(null)
        setModalOpen(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!form.code) return setFormError('Please enter procedure code')
        if (!form.name) return setFormError('Please enter procedure name')

        const h = form.duration_hours ? Number(form.duration_hours) : 0
        const m = form.duration_minutes ? Number(form.duration_minutes) : 0
        const totalMinutes = h * 60 + m
        const default_duration_min = totalMinutes > 0 ? totalMinutes : null

        const rate =
            form.rate_per_hour === '' || form.rate_per_hour === null
                ? null
                : Number(form.rate_per_hour)

        setSaving(true)
        setFormError(null)
        try {
            const payload = {
                code: form.code,
                name: form.name,
                speciality_id: form.speciality_id ? Number(form.speciality_id) : null,
                default_duration_min,
                rate_per_hour: rate,
                description: form.description || null,
                is_active: !!form.is_active,
            }

            if (editing) {
                await updateOtProcedure(editing.id, payload)
            } else {
                await createOtProcedure(payload)
            }
            setModalOpen(false)
            setEditing(null)
            loadProcedures()
        } catch (err) {
            console.error('Failed to save OT procedure', err)
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                'Failed to save procedure'
            setFormError(msg)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (item) => {
        if (!window.confirm(`Delete procedure "${item.name}"?`)) return
        try {
            await deleteOtProcedure(item.id)
            loadProcedures()
        } catch (err) {
            console.error('Failed to delete OT procedure', err)
            alert('Failed to delete procedure')
        }
    }

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-700">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm font-semibold">OT Procedures</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                className="w-56 rounded-lg border border-slate-500 bg-white pl-7 pr-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Search by code, name, speciality..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="overflow-x-auto rounded-2xl border bg-white">
                    <table className="min-w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Code
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Name
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Speciality
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Default Duration
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Rate / hour
                                </th>
                                <th className="px-4 py-2 text-[11px] font-semibold text-slate-500">
                                    Active
                                </th>
                                <th className="px-4 py-2 text-right text-[11px] font-semibold text-slate-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <>
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <tr key={idx} className="animate-pulse border-t">
                                            {Array.from({ length: 7 }).map((__, cIdx) => (
                                                <td key={cIdx} className="px-4 py-2">
                                                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </>
                            )}

                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-6 text-center text-xs text-slate-500"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            <span>No OT procedures found.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filtered.map((it) => {
                                    const total = it.default_duration_min ?? null
                                    let durLabel = '—'
                                    if (total != null && total > 0) {
                                        const h = Math.floor(total / 60)
                                        const m = total % 60
                                        durLabel =
                                            h > 0 && m > 0
                                                ? `${h}h ${m}min`
                                                : h > 0
                                                    ? `${h}h`
                                                    : `${m}min`
                                    }
                                    return (
                                        <tr key={it.id} className="border-t">
                                            <td className="px-4 py-2 text-xs font-medium text-slate-800">
                                                {it.code}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-slate-800">
                                                {it.name}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-slate-600">
                                                {it.speciality?.name ||
                                                    (it.speciality_id && `#${it.speciality_id}`) ||
                                                    '—'}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-slate-600">
                                                {durLabel}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-slate-600">
                                                {it.rate_per_hour != null
                                                    ? `₹ ${Number(it.rate_per_hour).toFixed(2)}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${it.is_active
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-slate-100 text-slate-500'
                                                        }`}
                                                >
                                                    {it.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right text-xs">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(it)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-500 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-400 hover:text-sky-700"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(it)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <ModalShell
                open={modalOpen}
                title={editing ? 'Edit OT Procedure' : 'New OT Procedure'}
                subtitle="Define procedures with default duration and hour-based rate for billing."
                onClose={() => setModalOpen(false)}
            >
                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-1 gap-3 px-5 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Code <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.code}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, code: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, name: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Default speciality (optional)
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={form.speciality_id}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, speciality_id: e.target.value }))
                                }
                            >
                                <option value="">Not mapped</option>
                                {specialities.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {(s.code ? `${s.code} – ` : '') + s.name}
                                    </option>
                                ))}
                            </select>
                            {specLoading && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                    Loading specialities...
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Default duration – hours
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.duration_hours}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            duration_hours: e.target.value,
                                        }))
                                    }
                                    placeholder="e.g., 2"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700">
                                    Default duration – minutes
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={form.duration_minutes}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            duration_minutes: e.target.value,
                                        }))
                                    }
                                    placeholder="e.g., 30"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Rate per hour (₹)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={form.rate_per_hour}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        rate_per_hour: e.target.value,
                                    }))
                                }
                                placeholder="e.g., 5000"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                                Description / notes
                            </label>
                            <textarea
                                rows={2}
                                className="w-full resize-none rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, description: e.target.value }))
                                }
                                placeholder="E.g., Includes surgeon charges only; anaesthesia separate."
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="ot_proc_active"
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={!!form.is_active}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                                }
                            />
                            <label
                                htmlFor="ot_proc_active"
                                className="text-xs text-slate-700"
                            >
                                Active
                            </label>
                        </div>

                        {formError && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                {formError}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                        <button
                            type="button"
                            onClick={() => setModalOpen(false)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-500 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                            disabled={saving}
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Save
                        </button>
                    </div>
                </form>
            </ModalShell>
        </>
    )
}

// ---------------------------------------------------------------------
// MAIN PAGE WRAPPER with ONLY TWO TABS
// ---------------------------------------------------------------------

const TABS = [
    { id: 'specialities', label: 'Specialities' },
    { id: 'procedures', label: 'Procedures' },
]

export default function OtMastersPage() {
    const [tab, setTab] = useState('specialities')

    return (
        <div className="flex h-full flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-slate-900">
                        OT Masters
                    </h1>
                    <p className="text-xs text-slate-500">
                        Configure OT specialities and procedures as per NABH.
                    </p>
                </div>
            </div>

            <div className="flex gap-2 border-b border-slate-500">
                {TABS.map((t) => {
                    const active = t.id === tab
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${active
                                    ? 'text-sky-700'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            {t.label}
                            {active && (
                                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sky-600" />
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 overflow-auto pt-2">
                {tab === 'specialities' && <OtSpecialitiesTab />}
                {tab === 'procedures' && <OtProceduresTab />}
            </div>
        </div>
    )
}
