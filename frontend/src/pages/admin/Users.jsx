// frontend/src/admin/Users.jsx
import { useEffect, useState, useCallback } from 'react'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'

export default function Users() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('users')

  const [items, setItems] = useState([])
  const [roles, setRoles] = useState([])
  const [depts, setDepts] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '', department_id: '', role_ids: [] })
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!canView) return
    setError('')
    try {
      const [u, r, d] = await Promise.all([
        API.get('/users/'),
        API.get('/roles/').catch(()=>({ data: [] })),        // in case no permission to roles
        API.get('/departments/').catch(()=>({ data: [] })),  // in case no permission to departments
      ])
      setItems(u.data); setRoles(r.data); setDepts(d.data)
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied for Users.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to load')
    }
  }, [canView])

  useEffect(() => { load() }, [load])

  const toggleRole = (id) => {
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(id) ? f.role_ids.filter(x => x !== id) : [...f.role_ids, id]
    }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (!editId && !canCreate) return
    if (editId && !canUpdate) return
    setLoading(true); setError('')
    const payload = { ...form, department_id: form.department_id ? Number(form.department_id) : null }
    try {
      if (editId) await API.put(`/users/${editId}`, payload)
      else await API.post('/users/', payload)
      setForm({ name: '', email: '', password: '', department_id: '', role_ids: [] })
      setEditId(null); load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save')
    } finally { setLoading(false) }
  }

  const remove = async (id) => {
    if (!canDelete) return
    if (!confirm('Delete this user?')) return
    try { await API.delete(`/users/${id}`); load() }
    catch (e) { setError(e?.response?.data?.detail || 'Failed to delete') }
  }

  const edit = (u) => {
    if (!canUpdate) return
    setEditId(u.id)
    setForm({ name: u.name, email: u.email, password: '', department_id: u.department_id || '', role_ids: u.role_ids || [] })
  }

  if (!hasAny || !canView) {
    return <section className="card"><h3 className="text-lg font-semibold mb-2">Users</h3><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">You don’t have access to view this module.</div></section>
  }

  return (
    <section className="card">
      <h3 className="text-lg font-semibold mb-4">Users</h3>

      <form onSubmit={save} className="space-y-4 mb-6">
        <div className="grid md:grid-cols-4 gap-3">
          <input className="input" placeholder="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!(!editId ? canCreate : canUpdate)} />
          <input className="input" placeholder="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!(!editId ? canCreate : canUpdate)} />
          <input className="input" placeholder="Password" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} disabled={!(!editId ? canCreate : canUpdate)} />
          <select className="input" value={form.department_id}
            onChange={(e) => setForm({ ...form, department_id: e.target.value })} disabled={!(!editId ? canCreate : canUpdate)}>
            <option value="">No Department</option>
            {depts.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          {roles.map((r) => (
            <label key={r.id}
              className={`flex items-center gap-2 p-3 rounded-xl border ${
                form.role_ids.includes(r.id) ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
              }`}>
              <input type="checkbox" checked={form.role_ids.includes(r.id)}
                onChange={() => toggleRole(r.id)} disabled={!(!editId ? canCreate : canUpdate)} />
              <span className="text-sm">{r.name}</span>
            </label>
          ))}
          {!roles.length && <div className="text-sm text-gray-500">No roles yet.</div>}
        </div>

        <button className="btn" disabled={loading || (!editId ? !canCreate : !canUpdate)}>
          {editId ? 'Update' : 'Create'}
        </button>
      </form>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="text-left"><th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Dept</th><th className="p-2">Roles</th><th className="p-2 text-right">Actions</th></tr></thead>
          <tbody>
            {items.map((u, i) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.department_id || '-'}</td>
                <td className="p-2 text-sm text-gray-600">{u.role_ids?.length || 0} roles</td>
                <td className="p-2 text-right space-x-2">
                  {canUpdate && <button className="px-3 py-2 rounded-xl border" onClick={() => edit(u)}>Edit</button>}
                  {canDelete && <button className="px-3 py-2 rounded-xl border" onClick={() => remove(u.id)}>Delete</button>}
                </td>
              </tr>
            ))}
            {!items.length && <tr><td className="p-4 text-sm text-gray-500" colSpan="6">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
