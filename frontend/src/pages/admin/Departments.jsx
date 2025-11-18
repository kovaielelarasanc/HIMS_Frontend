// frontend/src/admin/Departments.jsx
import { useEffect, useState, useCallback } from 'react'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'

export default function Departments() {
    const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('departments')

    const [items, setItems] = useState([])
    const [form, setForm] = useState({ name: '', description: '' })
    const [editId, setEditId] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const load = useCallback(async () => {
        if (!canView) return
        setError('')
        try {
            const { data } = await API.get('/departments/')
            setItems(data)
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied for Departments.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to load')
        }
    }, [canView])

    useEffect(() => { load() }, [load])

    const save = async (e) => {
        e.preventDefault()
        if (!editId && !canCreate) return
        if (editId && !canUpdate) return
        setLoading(true); setError('')
        try {
            if (editId) await API.put(`/departments/${editId}`, form)
            else await API.post('/departments/', form)
            setForm({ name: '', description: '' }); setEditId(null)
            load()
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to save')
        } finally {
            setLoading(false)
        }
    }

    const remove = async (id) => {
        if (!canDelete) return
        if (!confirm('Delete?')) return
        try {
            await API.delete(`/departments/${id}`)
            load()
        } catch (e) {
            const s = e?.response?.status
            if (s === 403) setError('Access denied.')
            else if (s === 401) setError('Session expired. Please login again.')
            else setError(e?.response?.data?.detail || 'Failed to delete')
        }
    }

    const edit = (d) => {
        if (!canUpdate) return
        setEditId(d.id)
        setForm({ name: d.name, description: d.description || '' })
    }

    if (!hasAny || !canView) {
        return (
            <section className="card">
                <h3 className="text-lg font-semibold mb-2">Departments</h3>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    You don’t have access to view this module.
                </div>
            </section>
        )
    }

    return (
        <section className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Departments</h3>
            </div>

            {/* Create/Update form */}
            <form onSubmit={save} className="grid md:grid-cols-3 gap-3 mb-6">
                <input className="input" placeholder="Name"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required disabled={!(!editId ? canCreate : canUpdate)} />
                <input className="input" placeholder="Description"
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} disabled={!(!editId ? canCreate : canUpdate)} />
                <button className="btn" disabled={loading || (!editId ? !canCreate : !canUpdate)}>
                    {editId ? 'Update' : 'Create'}
                </button>
            </form>

            {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="text-left">
                            <th className="p-2">#</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Desc</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((d, i) => (
                            <tr key={d.id} className="border-t">
                                <td className="p-2">{i + 1}</td>
                                <td className="p-2">{d.name}</td>
                                <td className="p-2">{d.description}</td>
                                <td className="p-2 text-right space-x-2">
                                    {canUpdate && (
                                        <button className="px-3 py-2 rounded-xl border" onClick={() => edit(d)}>Edit</button>
                                    )}
                                    {canDelete && (
                                        <button className="px-3 py-2 rounded-xl border" onClick={() => remove(d.id)}>Delete</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!items.length && (
                            <tr><td colSpan="4" className="p-4 text-sm text-gray-500">No departments yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
