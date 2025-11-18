// frontend/src/admin/Permissions.jsx
import { useEffect, useState, useCallback } from 'react'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'

export default function Permissions() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('permissions')

  const [items, setItems] = useState([])
  const [form, setForm] = useState({ code: '', label: '', module: '' })
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!canView) return
    setError('')
    try { const r = await API.get('/permissions/'); setItems(r.data) }
    catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied for Permissions.')
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
      if (editId) await API.put(`/permissions/${editId}`, form)
      else await API.post('/permissions/', form)
      setForm({ code: '', label: '', module: '' }); setEditId(null)
      load()
    } catch (e) { setError(e?.response?.data?.detail || 'Failed to save') }
    finally { setLoading(false) }
  }

  const remove = async (id) => {
    if (!canDelete) return
    if (!confirm('Delete this permission?')) return
    try { await API.delete(`/permissions/${id}`); load() }
    catch (e) { setError(e?.response?.data?.detail || 'Failed to delete') }
  }

  const edit = (p) => {
    if (!canUpdate) return
    setEditId(p.id)
    setForm({ code: p.code, label: p.label, module: p.module })
  }

  if (!hasAny || !canView) {
    return <section className="card"><h3 className="text-lg font-semibold mb-2">Permissions</h3><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">You don’t have access to view this module.</div></section>
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Permissions</h3>
      </div>

      <form onSubmit={save} className="grid md:grid-cols-4 gap-3 mb-4">
        <input className="input" placeholder="code (e.g. users.view)"
          value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!(!editId ? canCreate : canUpdate)} />
        <input className="input" placeholder="label (Users — View)"
          value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required disabled={!(!editId ? canCreate : canUpdate)} />
        <input className="input" placeholder="module (users)"
          value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} required disabled={!(!editId ? canCreate : canUpdate)} />
        <button className="btn" disabled={loading || (!editId ? !canCreate : !canUpdate)}>
          {editId ? 'Update' : 'Create'}
        </button>
      </form>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="text-left"><th className="p-2">#</th><th className="p-2">Code</th><th className="p-2">Label</th><th className="p-2">Module</th><th className="p-2 text-right">Actions</th></tr></thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-mono text-xs">{p.code}</td>
                <td className="p-2">{p.label}</td>
                <td className="p-2">{p.module}</td>
                <td className="p-2 text-right space-x-2">
                  {canUpdate && <button className="px-3 py-2 rounded-xl border" onClick={() => edit(p)}>Edit</button>}
                  {canDelete && <button className="px-3 py-2 rounded-xl border" onClick={() => remove(p.id)}>Delete</button>}
                </td>
              </tr>
            ))}
            {!items.length && <tr><td className="p-4 text-sm text-gray-500" colSpan="5">No permissions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
