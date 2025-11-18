// frontend/src/admin/Roles.jsx
import { useEffect, useState, useCallback } from 'react'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'

export default function Roles() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('roles')

  const [roles, setRoles] = useState([])
  const [perms, setPerms] = useState([])
  const [form, setForm] = useState({ name: '', description: '', permission_ids: [] })
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!canView) return
    setError('')
    try {
      const [rolesRes, permsRes] = await Promise.all([
        API.get('/roles/'),
        API.get('/permissions/')
      ])
      setRoles(rolesRes.data); setPerms(permsRes.data)
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied for Roles.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to load')
    }
  }, [canView])

  useEffect(() => { load() }, [load])

  const togglePerm = (id) => {
    setForm((f) => ({
      ...f,
      permission_ids: f.permission_ids.includes(id)
        ? f.permission_ids.filter((x) => x !== id)
        : [...f.permission_ids, id]
    }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (!editId && !canCreate) return
    if (editId && !canUpdate) return
    setLoading(true); setError('')
    try {
      if (editId) await API.put(`/roles/${editId}`, form)
      else await API.post('/roles/', form)
      setForm({ name: '', description: '', permission_ids: [] }); setEditId(null)
      load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const edit = (r) => {
    if (!canUpdate) return
    setEditId(r.id)
    setForm({
      name: r.name,
      description: r.description || '',
      permission_ids: r.permission_ids || []
    })
  }

  const remove = async (id) => {
    if (!canDelete) return
    if (!confirm('Delete this role?')) return
    try { await API.delete(`/roles/${id}`); load() }
    catch (e) { setError(e?.response?.data?.detail || 'Failed to delete') }
  }

  if (!hasAny || !canView) {
    return <section className="card"><h3 className="text-lg font-semibold mb-2">Roles</h3><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">You don’t have access to view this module.</div></section>
  }

  return (
    <section className="card">
      <h3 className="text-lg font-semibold mb-4">Roles</h3>

      {/* create/update */}
      <form onSubmit={save} className="space-y-4 mb-6">
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Role name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required
            disabled={!(!editId ? canCreate : canUpdate)} />
          <input className="input" placeholder="Description (optional)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={!(!editId ? canCreate : canUpdate)} />
          <button className="btn" disabled={loading || (!editId ? !canCreate : !canUpdate)}>
            {editId ? 'Update' : 'Create'}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {perms.map((p) => (
            <label key={p.id}
              className={`flex items-center gap-2 p-3 rounded-xl border ${
                form.permission_ids.includes(p.id) ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
              }`}>
              <input type="checkbox"
                checked={form.permission_ids.includes(p.id)}
                onChange={() => togglePerm(p.id)}
                disabled={!(!editId ? canCreate : canUpdate)} />
              <span><span className="block text-sm font-medium">{p.label}</span>
              <span className="block text-xs text-gray-500">{p.code}</span></span>
            </label>
          ))}
          {!perms.length && <div className="text-sm text-gray-500">No permissions yet.</div>}
        </div>
      </form>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="text-left"><th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Permissions</th><th className="p-2 text-right">Actions</th></tr></thead>
          <tbody>
            {roles.map((r, i) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2 text-sm text-gray-600">{r.permission_ids?.length || 0} perms</td>
                <td className="p-2 text-right space-x-2">
                  {canUpdate && <button className="px-3 py-2 rounded-xl border" onClick={() => edit(r)}>Edit</button>}
                  {canDelete && <button className="px-3 py-2 rounded-xl border" onClick={() => remove(r.id)}>Delete</button>}
                </td>
              </tr>
            ))}
            {!roles.length && <tr><td className="p-4 text-sm text-gray-500" colSpan="4">No roles yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
