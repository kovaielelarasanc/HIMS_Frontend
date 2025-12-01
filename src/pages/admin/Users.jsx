// FILE: frontend/src/admin/Users.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'
import {
  Users as UsersIcon,
  UserPlus,
  Stethoscope,
  ShieldCheck,
  Filter,
  Mail,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const fadeIn = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
}

export default function Users() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('users')

  const [items, setItems] = useState([])
  const [roles, setRoles] = useState([])
  const [depts, setDepts] = useState([])

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department_id: '',
    role_ids: [],
    is_doctor: false,
    is_active: true,
  })
  const [editId, setEditId] = useState(null)

  const [loadingSave, setLoadingSave] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'doctors'
  const [q, setQ] = useState('')

  const canEditOrCreate = !editId ? canCreate : canUpdate

  const load = useCallback(async () => {
    if (!canView) return
    setError('')
    setLoadingList(true)
    try {
      const [u, r, d] = await Promise.all([
        API.get('/users/'),
        API.get('/roles/').catch(() => ({ data: [] })),
        API.get('/departments/').catch(() => ({ data: [] })),
      ])
      setItems(u.data || [])
      setRoles(r.data || [])
      setDepts(d.data || [])
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied for Users.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to load users.')
    } finally {
      setLoadingList(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  const deptMap = useMemo(() => {
    const m = {}
    depts.forEach(d => {
      m[d.id] = d.name
    })
    return m
  }, [depts])

  const toggleRole = (id) => {
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(id)
        ? f.role_ids.filter(x => x !== id)
        : [...f.role_ids, id],
    }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      department_id: '',
      role_ids: [],
      is_doctor: false,
      is_active: true,
    })
    setEditId(null)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!editId && !canCreate) return
    if (editId && !canUpdate) return

    setLoadingSave(true)
    setError('')

    const payload = {
      ...form,
      department_id: form.department_id ? Number(form.department_id) : null,
    }

    try {
      if (editId) {
        await API.put(`/users/${editId}`, payload)
      } else {
        await API.post('/users/', payload)
      }
      resetForm()
      load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save user.')
    } finally {
      setLoadingSave(false)
    }
  }

  const remove = async (id) => {
    if (!canDelete) return
    if (!window.confirm('Delete this user?')) return
    try {
      await API.delete(`/users/${id}`)
      load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to delete user.')
    }
  }

  const edit = (u) => {
    if (!canUpdate) return
    setEditId(u.id)
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      department_id: u.department_id || '',
      role_ids: u.role_ids || [],
      is_doctor: !!u.is_doctor,
      is_active: u.is_active ?? true,
    })
  }

  const totalDoctors = useMemo(
    () => items.filter(u => u.is_doctor).length,
    [items],
  )

  const totalActive = useMemo(
    () => items.filter(u => u.is_active).length,
    [items],
  )

  const filteredItems = useMemo(() => {
    let list = items
    if (filter === 'doctors') {
      list = list.filter(u => u.is_doctor)
    }
    if (q.trim()) {
      const query = q.toLowerCase()
      list = list.filter(
        u =>
          (u.name || '').toLowerCase().includes(query) ||
          (u.email || '').toLowerCase().includes(query),
      )
    }
    return list
  }, [items, filter, q])

  if (!hasAny || !canView) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-800">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription className="text-sm">
                  You don’t have permission to view the Users module. Contact your administrator for access.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Top meta row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium tracking-wide text-slate-600"
          >
            Admin · User management
          </Badge>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
            <span>Desktop workspace</span>
          </div>
        </div>

        {/* Header card */}
        <motion.div {...fadeIn}>
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-900 text-slate-50">
                  <UsersIcon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg text-slate-900">
                    Users & Doctors
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-600">
                    Manage staff accounts, link them to departments, assign roles and mark doctors for OPD/IPD routing.
                  </p>
                </div>
              </div>

              {/* Snapshot metrics */}
              <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
                <SummaryTile
                  label="Total users"
                  value={items.length}
                  hint="All active & inactive staff"
                />
                <SummaryTile
                  label="Doctors"
                  value={totalDoctors}
                  icon={<Stethoscope className="h-3 w-3 text-emerald-600" />}
                  hint="Marked as doctor"
                />
                <SummaryTile
                  label="Active users"
                  value={totalActive}
                  hint="Can login today"
                />
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Error alert */}
        {error && (
          <motion.div {...fadeIn}>
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 text-red-800">
              <AlertTitle>Issue</AlertTitle>
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Main layout: filters/controls (left) + list (right) */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          {/* Left column – filters & form */}
          <motion.div {...fadeIn}>
            <Card className="sticky top-20 rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Filters & user form
                    </CardTitle>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Filter list and add/update staff users.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
                      <Filter className="h-3 w-3" />
                      <span>View</span>
                    </div>
                    <div className="inline-flex gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setFilter('all')}
                        className={`rounded-full px-3 py-1 ${filter === 'all'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        All users
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter('doctors')}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${filter === 'doctors'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        <Stethoscope className="h-3 w-3" />
                        Doctors
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">
                      Search
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Name or email"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Create / edit form */}
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
                    <div className="flex h-6 w-6 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
                      <UserPlus className="h-3.5 w-3.5" />
                    </div>
                    <span>{editId ? 'Edit user' : 'Create new user'}</span>
                  </div>

                  <form onSubmit={save} className="space-y-3">
                    <div className="grid gap-2">
                      <Input
                        placeholder="Full name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        disabled={!canEditOrCreate}
                        className="h-8 rounded-2xl border-slate-200 bg-slate-50 text-xs"
                      />
                      <Input
                        placeholder="Email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                        disabled={!canEditOrCreate}
                        className="h-8 rounded-2xl border-slate-200 bg-slate-50 text-xs"
                      />
                      <Input
                        placeholder={editId ? 'Password (leave blank to keep)' : 'Password'}
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required={!editId}
                        disabled={!canEditOrCreate}
                        className="h-8 rounded-2xl border-slate-200 bg-slate-50 text-xs"
                      />
                      <div className="space-y-1 text-[11px]">
                        <label className="font-medium text-slate-600">
                          Department
                        </label>
                        <select
                          value={form.department_id}
                          onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                          disabled={!canEditOrCreate}
                          className="h-8 w-full rounded-2xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        >
                          <option value="">No department</option>
                          {depts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <label
                        className={`inline-flex flex-1 min-w-[140px] cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 ${form.is_doctor
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-white'
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300"
                          checked={form.is_doctor}
                          onChange={(e) =>
                            setForm({ ...form, is_doctor: e.target.checked })
                          }
                          disabled={!canEditOrCreate}
                        />
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Mark as doctor</span>
                        </span>
                      </label>

                      <label
                        className={`inline-flex flex-1 min-w-[140px] cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 ${form.is_active
                            ? 'border-slate-300 bg-slate-50'
                            : 'border-slate-200 bg-white'
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300"
                          checked={form.is_active}
                          onChange={(e) =>
                            setForm({ ...form, is_active: e.target.checked })
                          }
                          disabled={!canEditOrCreate}
                        />
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <ShieldCheck className="h-3.5 w-3.5 text-slate-700" />
                          <span>Active user</span>
                        </span>
                      </label>
                    </div>

                    {/* Roles */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-700">Roles</span>
                        <span className="text-slate-400">
                          {form.role_ids.length || 0} selected
                        </span>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {roles.map((r) => (
                          <label
                            key={r.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-2.5 py-2 ${form.role_ids.includes(r.id)
                                ? 'border-slate-300 bg-slate-50'
                                : 'border-slate-200 bg-white'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.role_ids.includes(r.id)}
                              onChange={() => toggleRole(r.id)}
                              disabled={!canEditOrCreate}
                              className="h-3.5 w-3.5 rounded border-slate-300"
                            />
                            <span className="text-[11px] text-slate-800">
                              {r.name}
                            </span>
                          </label>
                        ))}
                        {!roles.length && (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                            No roles configured yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {editId && (
                        <button
                          type="button"
                          onClick={resetForm}
                          className="text-[11px] text-slate-500 underline"
                        >
                          Cancel edit &amp; clear form
                        </button>
                      )}
                      <Button
                        type="submit"
                        className="ml-auto rounded-2xl bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                        disabled={loadingSave || !canEditOrCreate}
                      >
                        {loadingSave
                          ? 'Saving...'
                          : editId
                            ? 'Update user'
                            : 'Create user'}
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right column – results / list */}
          <motion.div {...fadeIn}>
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      User directory
                    </CardTitle>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {filteredItems.length} of {items.length} records visible
                      in this view.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {loadingList ? (
                  <ListSkeleton />
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="grid gap-3 md:hidden">
                      {filteredItems.map((u, i) => {
                        const roleNames = roles
                          .filter(r => (u.role_ids || []).includes(r.id))
                          .map(r => r.name)
                        return (
                          <div
                            key={u.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {i + 1}. {u.name}
                                  </span>
                                  {u.is_doctor && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                      <Stethoscope className="h-3 w-3" />
                                      Doctor
                                    </span>
                                  )}
                                  {!u.is_active && (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                      Inactive
                                    </span>
                                  )}
                                  {u.is_admin && (
                                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                                      Admin
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {u.email}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Dept:{' '}
                                  <span className="font-medium text-slate-700">
                                    {deptMap[u.department_id] || '-'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Roles:{' '}
                                  {roleNames.length
                                    ? roleNames.join(', ')
                                    : 'No roles'}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end gap-2 text-[11px]">
                              {canUpdate && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-2xl border-slate-200 px-3 text-[11px]"
                                  onClick={() => edit(u)}
                                >
                                  Edit
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-2xl border border-rose-200 px-3 text-[11px] text-rose-700 hover:bg-rose-50"
                                  onClick={() => remove(u.id)}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {!filteredItems.length && (
                        <EmptyState title="No users match this view" />
                      )}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-[11px] font-medium text-slate-600">
                          <tr>
                            <th className="p-2 text-left">#</th>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Email</th>
                            <th className="p-2 text-left">Dept</th>
                            <th className="p-2 text-left">Roles</th>
                            <th className="p-2 text-left">Flags</th>
                            <th className="p-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((u, i) => {
                            const roleNames = roles
                              .filter(r => (u.role_ids || []).includes(r.id))
                              .map(r => r.name)
                            return (
                              <tr
                                key={u.id}
                                className="border-t border-slate-100 text-xs text-slate-800"
                              >
                                <td className="p-2">{i + 1}</td>
                                <td className="p-2">{u.name}</td>
                                <td className="p-2">{u.email}</td>
                                <td className="p-2">
                                  {deptMap[u.department_id] || '-'}
                                </td>
                                <td className="p-2">
                                  {roleNames.length ? (
                                    roleNames.join(', ')
                                  ) : (
                                    <span className="text-slate-400">
                                      No roles
                                    </span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <div className="flex flex-wrap gap-1">
                                    {u.is_doctor && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                                        <Stethoscope className="h-3 w-3" />
                                        Doctor
                                      </span>
                                    )}
                                    {!u.is_active && (
                                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                        Inactive
                                      </span>
                                    )}
                                    {u.is_admin && (
                                      <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                                        Admin
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-right">
                                  <div className="inline-flex gap-2">
                                    {canUpdate && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 rounded-2xl border-slate-200 px-3 text-[11px]"
                                        onClick={() => edit(u)}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 rounded-2xl border border-rose-200 px-3 text-[11px] text-rose-700 hover:bg-rose-50"
                                        onClick={() => remove(u.id)}
                                      >
                                        Delete
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                          {!filteredItems.length && (
                            <tr>
                              <td colSpan={7} className="p-4">
                                <EmptyState title="No users match this view" />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, icon, hint }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
        {icon && <span>{icon}</span>}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-slate-400">
          {hint}
        </div>
      )}
    </motion.div>
  )
}

function EmptyState({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
      <p className="text-sm font-medium text-slate-700">
        {title}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Try changing filters, clearing the search, or creating a new user.
      </p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3 rounded-full bg-slate-100" />
            <Skeleton className="h-2.5 w-1/2 rounded-full bg-slate-100" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  )
}
