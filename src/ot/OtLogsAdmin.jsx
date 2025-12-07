// FILE: frontend/src/ot/OtLogsAdmin.jsx
import { useEffect, useState, useCallback } from 'react'
import {
    Thermometer,
    Sparkles,
    Filter,
    Plus,
    X,
    Edit2,
    Trash2,
} from 'lucide-react'
import { useCan } from '../hooks/useCan'
import {
    listCleaningLogs,
    createCleaningLog,
    updateCleaningLog,
    deleteCleaningLog,
    listEnvironmentLogs,
    createEnvironmentLog,
    updateEnvironmentLog,
    deleteEnvironmentLog,
    // ⬇️ NEW: use OT theatre masters
    listOtTheatres,
} from '../api/ot'

const SESSION_OPTIONS = [
    { value: '', label: 'All sessions' },
    { value: 'pre-list', label: 'Pre-list' },
    { value: 'between-cases', label: 'Between cases' },
    { value: 'end-of-day', label: 'End of day' },
]

// small helper
const toDateInput = (val) => (val ? val.slice(0, 10) : '')

export default function OtLogsAdmin() {
    const [tab, setTab] = useState('cleaning')

    // 🔹 Load OT theatres from master (once here, reuse everywhere)
    const [theatres, setTheatres] = useState([])
    const [thLoading, setThLoading] = useState(false)
    const [thError, setThError] = useState(null)

    useEffect(() => {
        const loadTheatres = async () => {
            try {
                setThLoading(true)
                setThError(null)
                const res = await listOtTheatres({})
                setTheatres(res.data || [])
            } catch (err) {
                console.error('Failed to load OT theatres for logs', err)
                setThError('Failed to load OT theatres (for dropdowns)')
                setTheatres([])
            } finally {
                setThLoading(false)
            }
        }
        loadTheatres()
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-slate-900">
                        OT Logs – Cleaning & Environment
                    </h1>
                    <p className="text-xs text-slate-500">
                        Statutory OT cleaning / turnover and environment monitoring logs
                        (NABH).
                    </p>
                    {thError && (
                        <p className="mt-1 text-[11px] text-amber-600">
                            {thError} – theatre names may not show.
                        </p>
                    )}
                </div>

                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs">
                    <button
                        type="button"
                        onClick={() => setTab('cleaning')}
                        className={`rounded-full px-3 py-1 font-medium transition ${tab === 'cleaning'
                                ? 'bg-white text-sky-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Cleaning / Sterility
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('environment')}
                        className={`rounded-full px-3 py-1 font-medium transition ${tab === 'environment'
                                ? 'bg-white text-sky-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Environment (T/H/P)
                    </button>
                </div>
            </div>

            {tab === 'cleaning' ? (
                <CleaningLogsSection theatreOptions={theatres} theatresLoading={thLoading} />
            ) : (
                <EnvironmentLogsSection theatreOptions={theatres} theatresLoading={thLoading} />
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* CLEANING LOGS SECTION                                              */
/* ------------------------------------------------------------------ */

function CleaningLogsSection({ theatreOptions, theatresLoading }) {
    const canView =
        useCan('ot.logs.cleaning.view') || useCan('ot.logs.view') || useCan('ot.case.view')
    const canManage = useCan('ot.logs.cleaning.manage') || useCan('ot.logs.manage')

    const [filters, setFilters] = useState({
        theatreId: '',
        caseId: '',
        date: '',
        fromDate: '',
        toDate: '',
        session: '',
    })

    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)

    // map theatre id -> label for display
    const theatreLabelById = useCallback(
        (id) => {
            if (!id) return ''
            const t = theatreOptions?.find((th) => th.id === id)
            if (!t) return `#${id}`
            const code = t.code || `TH-${t.id}`
            return `${code} – ${t.name || ''}`.trim()
        },
        [theatreOptions]
    )

    const load = useCallback(async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await listCleaningLogs({
                theatreId: filters.theatreId || undefined,
                caseId: filters.caseId || undefined,
                date: filters.date || undefined,
                fromDate: filters.fromDate || undefined,
                toDate: filters.toDate || undefined,
                session: filters.session || undefined,
            })
            setLogs(res.data || [])
        } catch (err) {
            console.error('Failed to load cleaning logs', err)
            setError('Failed to load cleaning logs')
            setLogs([])
        } finally {
            setLoading(false)
        }
    }, [canView, filters])

    useEffect(() => {
        load()
    }, [load])

    const resetModal = () => {
        setEditing(null)
        setModalOpen(false)
    }

    const handleEdit = (log) => {
        setEditing(log)
        setModalOpen(true)
    }

    const handleCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }

    const handleDelete = async (log) => {
        if (!canManage) return
        if (!window.confirm('Delete this cleaning log entry?')) return
        try {
            await deleteCleaningLog(log.id)
            await load()
        } catch (err) {
            console.error('Failed to delete cleaning log', err)
            alert('Failed to delete cleaning log entry')
        }
    }

    const handleSave = async (form) => {
        if (!canManage) return
        setSaving(true)
        try {
            const payload = {
                theatre_id: form.theatre_id ? Number(form.theatre_id) : null,
                date: form.date || null,
                session: form.session || null,
                case_id: form.case_id ? Number(form.case_id) : null,
                method: form.method || null,
                done_by_user_id: form.done_by_user_id
                    ? Number(form.done_by_user_id)
                    : null,
                remarks: form.remarks || null,
            }

            if (editing?.id) {
                await updateCleaningLog(editing.id, payload)
            } else {
                await createCleaningLog(payload)
            }
            await load()
            resetModal()
        } catch (err) {
            console.error('Failed to save cleaning log', err)
            alert(
                err?.response?.data?.detail ||
                'Failed to save cleaning log. Please check required fields.'
            )
        } finally {
            setSaving(false)
        }
    }

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view OT cleaning logs.
            </div>
        )
    }

    return (
        <>
            <div className="space-y-3 rounded-2xl border bg-white p-4 text-xs">
                {/* Header + Add */}
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                            OT Cleaning / Sterility Logs
                        </span>
                    </div>
                    {canManage && (
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                        >
                            <Plus className="h-3 w-3" />
                            New cleaning log
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                        <Filter className="h-3 w-3" />
                        Filters
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">
                                Theatre
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.theatreId}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, theatreId: e.target.value }))
                                }
                            >
                                <option value="">All theatres</option>
                                {theatreOptions?.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {(t.code || `TH-${t.id}`) + (t.name ? ` – ${t.name}` : '')}
                                    </option>
                                ))}
                            </select>
                            {theatresLoading && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                    Loading theatres...
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">Case ID</label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.caseId}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, caseId: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">Date</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.date}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, date: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">From</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.fromDate}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, fromDate: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">To</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.toDate}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, toDate: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                            className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                            value={filters.session}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, session: e.target.value }))
                            }
                        >
                            {SESSION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={load}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setFilters({
                                    theatreId: '',
                                    caseId: '',
                                    date: '',
                                    fromDate: '',
                                    toDate: '',
                                    session: '',
                                })
                            }
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="text-xs text-slate-500">Loading cleaning logs...</div>
                )}

                {error && (
                    <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="max-h-80 overflow-auto rounded-xl border bg-slate-50">
                    <table className="min-w-full text-left text-[11px] text-slate-700">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-1.5">Date</th>
                                <th className="px-3 py-1.5">Theatre</th>
                                <th className="px-3 py-1.5">Session</th>
                                <th className="px-3 py-1.5">Case ID</th>
                                <th className="px-3 py-1.5">Method</th>
                                <th className="px-3 py-1.5">Done by (user id)</th>
                                <th className="px-3 py-1.5">Remarks</th>
                                {canManage && (
                                    <th className="px-3 py-1.5 text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && logs.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={canManage ? 8 : 7}
                                        className="px-3 py-2 text-center text-[11px] text-slate-500"
                                    >
                                        No cleaning logs found for the selected filters.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                logs.map((l) => (
                                    <tr key={l.id} className="border-t border-slate-100">
                                        <td className="px-3 py-1.5">{toDateInput(l.date) || '—'}</td>
                                        <td className="px-3 py-1.5">
                                            {theatreLabelById(l.theatre_id) || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">{l.session || '—'}</td>
                                        <td className="px-3 py-1.5">{l.case_id || '—'}</td>
                                        <td className="px-3 py-1.5">{l.method || '—'}</td>
                                        <td className="px-3 py-1.5">{l.done_by_user_id || '—'}</td>
                                        <td className="px-3 py-1.5">{l.remarks || '—'}</td>
                                        {canManage && (
                                            <td className="px-3 py-1.5 text-right">
                                                <div className="inline-flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(l)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(l)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <CleaningLogModal
                    initial={editing}
                    onClose={resetModal}
                    onSave={handleSave}
                    saving={saving}
                    theatreOptions={theatreOptions}
                />
            )}
        </>
    )
}

function CleaningLogModal({ initial, onClose, onSave, saving, theatreOptions }) {
    const [form, setForm] = useState({
        theatre_id: initial?.theatre_id ?? '',
        date: initial?.date ? toDateInput(initial.date) : '',
        session: initial?.session ?? '',
        case_id: initial?.case_id ?? '',
        method: initial?.method ?? '',
        done_by_user_id: initial?.done_by_user_id ?? '',
        remarks: initial?.remarks ?? '',
    })

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(form)
    }

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-2">
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 text-xs shadow-xl">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-sky-600" />
                        <span className="text-sm font-semibold text-slate-900">
                            {initial ? 'Edit cleaning log' : 'New cleaning log'}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Theatre *
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.theatre_id}
                                required
                                onChange={(e) => handleChange('theatre_id', e.target.value)}
                            >
                                <option value="">Select theatre</option>
                                {theatreOptions?.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {(t.code || `TH-${t.id}`) + (t.name ? ` – ${t.name}` : '')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Date *
                            </label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.date}
                                required
                                onChange={(e) => handleChange('date', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Session
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.session}
                                onChange={(e) => handleChange('session', e.target.value)}
                            >
                                {SESSION_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label || '—'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Case ID (optional)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.case_id}
                                onChange={(e) => handleChange('case_id', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-700">
                            Method / Type *
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                            placeholder="Mopping, fumigation, UV, etc."
                            value={form.method}
                            required
                            onChange={(e) => handleChange('method', e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-700">
                            Done by (User ID) *
                        </label>
                        <input
                            type="number"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                            value={form.done_by_user_id}
                            required
                            onChange={(e) =>
                                handleChange('done_by_user_id', e.target.value)
                            }
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-700">
                            Remarks
                        </label>
                        <textarea
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                            value={form.remarks}
                            onChange={(e) => handleChange('remarks', e.target.value)}
                        />
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* ENVIRONMENT LOGS SECTION                                           */
/* ------------------------------------------------------------------ */

function EnvironmentLogsSection({ theatreOptions, theatresLoading }) {
    const canView =
        useCan('ot.logs.environment.view') || useCan('ot.logs.view') || useCan('ot.case.view')
    const canManage = useCan('ot.logs.environment.manage') || useCan('ot.logs.manage')

    const [filters, setFilters] = useState({
        theatreId: '',
        date: '',
        fromDate: '',
        toDate: '',
    })

    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)

    const theatreLabelById = useCallback(
        (id) => {
            if (!id) return ''
            const t = theatreOptions?.find((th) => th.id === id)
            if (!t) return `#${id}`
            const code = t.code || `TH-${t.id}`
            return `${code} – ${t.name || ''}`.trim()
        },
        [theatreOptions]
    )

    const load = useCallback(async () => {
        if (!canView) return
        try {
            setLoading(true)
            setError(null)
            const res = await listEnvironmentLogs({
                theatreId: filters.theatreId || undefined,
                date: filters.date || undefined,
                fromDate: filters.fromDate || undefined,
                toDate: filters.toDate || undefined,
            })
            setLogs(res.data || [])
        } catch (err) {
            console.error('Failed to load environment logs', err)
            setError('Failed to load environment logs')
            setLogs([])
        } finally {
            setLoading(false)
        }
    }, [canView, filters])

    useEffect(() => {
        load()
    }, [load])

    const resetModal = () => {
        setEditing(null)
        setModalOpen(false)
    }

    const handleCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }

    const handleEdit = (log) => {
        setEditing(log)
        setModalOpen(true)
    }

    const handleDelete = async (log) => {
        if (!canManage) return
        if (!window.confirm('Delete this environment log entry?')) return
        try {
            await deleteEnvironmentLog(log.id)
            await load()
        } catch (err) {
            console.error('Failed to delete environment log', err)
            alert('Failed to delete environment log entry')
        }
    }

    const handleSave = async (form) => {
        if (!canManage) return
        setSaving(true)
        try {
            const payload = {
                theatre_id: form.theatre_id ? Number(form.theatre_id) : null,
                date: form.date || null,
                time: form.time || null,
                temperature_c:
                    form.temperature_c === '' ? null : Number(form.temperature_c),
                humidity_percent:
                    form.humidity_percent === '' ? null : Number(form.humidity_percent),
                pressure_diff_pa:
                    form.pressure_diff_pa === '' ? null : Number(form.pressure_diff_pa),
                logged_by_user_id: form.logged_by_user_id
                    ? Number(form.logged_by_user_id)
                    : null,
            }

            if (editing?.id) {
                await updateEnvironmentLog(editing.id, payload)
            } else {
                await createEnvironmentLog(payload)
            }
            await load()
            resetModal()
        } catch (err) {
            console.error('Failed to save environment log', err)
            alert(
                err?.response?.data?.detail ||
                'Failed to save environment log. Please check required fields.'
            )
        } finally {
            setSaving(false)
        }
    }

    if (!canView) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You do not have permission to view environment logs.
            </div>
        )
    }

    return (
        <>
            <div className="space-y-3 rounded-2xl border bg-white p-4 text-xs">
                {/* Header + Add */}
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Thermometer className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                            OT Environment Logs (Temperature / Humidity / Pressure)
                        </span>
                    </div>
                    {canManage && (
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                        >
                            <Plus className="h-3 w-3" />
                            New environment log
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                        <Filter className="h-3 w-3" />
                        Filters
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">
                                Theatre
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.theatreId}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, theatreId: e.target.value }))
                                }
                            >
                                <option value="">All theatres</option>
                                {theatreOptions?.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {(t.code || `TH-${t.id}`) + (t.name ? ` – ${t.name}` : '')}
                                    </option>
                                ))}
                            </select>
                            {theatresLoading && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                    Loading theatres...
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">Date</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.date}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, date: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">From</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.fromDate}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, fromDate: e.target.value }))
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">To</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                                value={filters.toDate}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, toDate: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={load}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setFilters({
                                    theatreId: '',
                                    date: '',
                                    fromDate: '',
                                    toDate: '',
                                })
                            }
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="text-xs text-slate-500">
                        Loading environment logs...
                    </div>
                )}

                {error && (
                    <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                    </div>
                )}

                <div className="max-h-80 overflow-auto rounded-xl border bg-slate-50">
                    <table className="min-w-full text-left text-[11px] text-slate-700">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-1.5">Date</th>
                                <th className="px-3 py-1.5">Time</th>
                                <th className="px-3 py-1.5">Theatre</th>
                                <th className="px-3 py-1.5">Temp (°C)</th>
                                <th className="px-3 py-1.5">Humidity (%)</th>
                                <th className="px-3 py-1.5">Pressure (Pa)</th>
                                <th className="px-3 py-1.5">Logged by (user id)</th>
                                {canManage && (
                                    <th className="px-3 py-1.5 text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && logs.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={canManage ? 8 : 7}
                                        className="px-3 py-2 text-center text-[11px] text-slate-500"
                                    >
                                        No environment logs found for the selected filters.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                logs.map((l) => (
                                    <tr key={l.id} className="border-t border-slate-100">
                                        <td className="px-3 py-1.5">{toDateInput(l.date) || '—'}</td>
                                        <td className="px-3 py-1.5">
                                            {l.time ? l.time.slice(0, 5) : '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {theatreLabelById(l.theatre_id) || '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {l.temperature_c !== null && l.temperature_c !== undefined
                                                ? l.temperature_c
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {l.humidity_percent !== null &&
                                                l.humidity_percent !== undefined
                                                ? l.humidity_percent
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {l.pressure_diff_pa !== null &&
                                                l.pressure_diff_pa !== undefined
                                                ? l.pressure_diff_pa
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {l.logged_by_user_id || '—'}
                                        </td>
                                        {canManage && (
                                            <td className="px-3 py-1.5 text-right">
                                                <div className="inline-flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(l)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(l)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <EnvironmentLogModal
                    initial={editing}
                    onClose={resetModal}
                    onSave={handleSave}
                    saving={saving}
                    theatreOptions={theatreOptions}
                />
            )}
        </>
    )
}

function EnvironmentLogModal({
    initial,
    onClose,
    onSave,
    saving,
    theatreOptions,
}) {
    const [form, setForm] = useState({
        theatre_id: initial?.theatre_id ?? '',
        date: initial?.date ? toDateInput(initial.date) : '',
        time: initial?.time ?? '',
        temperature_c:
            initial?.temperature_c !== null && initial?.temperature_c !== undefined
                ? String(initial.temperature_c)
                : '',
        humidity_percent:
            initial?.humidity_percent !== null &&
                initial?.humidity_percent !== undefined
                ? String(initial.humidity_percent)
                : '',
        pressure_diff_pa:
            initial?.pressure_diff_pa !== null &&
                initial?.pressure_diff_pa !== undefined
                ? String(initial.pressure_diff_pa)
                : '',
        logged_by_user_id: initial?.logged_by_user_id ?? '',
    })

    const handleChange = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(form)
    }

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-2">
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 text-xs shadow-xl">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-sky-600" />
                        <span className="text-sm font-semibold text-slate-900">
                            {initial ? 'Edit environment log' : 'New environment log'}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Theatre *
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.theatre_id}
                                required
                                onChange={(e) => handleChange('theatre_id', e.target.value)}
                            >
                                <option value="">Select theatre</option>
                                {theatreOptions?.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {(t.code || `TH-${t.id}`) + (t.name ? ` – ${t.name}` : '')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Date *
                            </label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.date}
                                required
                                onChange={(e) => handleChange('date', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-700">
                            Time *
                        </label>
                        <input
                            type="time"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                            value={form.time}
                            required
                            onChange={(e) => handleChange('time', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Temp (°C)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.temperature_c}
                                onChange={(e) =>
                                    handleChange('temperature_c', e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Humidity (%)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.humidity_percent}
                                onChange={(e) =>
                                    handleChange('humidity_percent', e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-700">
                                Pressure (Pa)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={form.pressure_diff_pa}
                                onChange={(e) =>
                                    handleChange('pressure_diff_pa', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-700">
                            Logged by (User ID) *
                        </label>
                        <input
                            type="number"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                            value={form.logged_by_user_id}
                            required
                            onChange={(e) =>
                                handleChange('logged_by_user_id', e.target.value)
                            }
                        />
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                        >
                            {saving && (
                                <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-white border-b-transparent" />
                            )}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
