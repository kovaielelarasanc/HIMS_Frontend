// FILE: frontend/src/admin/Roles.jsx
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'
import { ShieldCheck, KeyRound } from 'lucide-react'

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

export default function Roles() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('roles')

  const [roles, setRoles] = useState([])
  const [perms, setPerms] = useState([])
  const [form, setForm] = useState({ name: '', description: '', permission_ids: [] })
  const [editId, setEditId] = useState(null)
  const [loadingSave, setLoadingSave] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!canView) return
    setError('')
    setLoadingList(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        API.get('/roles/'),
        API.get('/permissions/'),
      ])
      setRoles(rolesRes.data || [])
      setPerms(permsRes.data || [])
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied for Roles.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to load roles.')
    } finally {
      setLoadingList(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  const togglePerm = (id) => {
    setForm((f) => ({
      ...f,
      permission_ids: f.permission_ids.includes(id)
        ? f.permission_ids.filter((x) => x !== id)
        : [...f.permission_ids, id],
    }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (!editId && !canCreate) return
    if (editId && !canUpdate) return

    setLoadingSave(true)
    setError('')
    try {
      if (editId) await API.put(`/roles/${editId}`, form)
      else await API.post('/roles/', form)
      setForm({ name: '', description: '', permission_ids: [] })
      setEditId(null)
      load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save role.')
    } finally {
      setLoadingSave(false)
    }
  }

  const edit = (r) => {
    if (!canUpdate) return
    setEditId(r.id)
    setForm({
      name: r.name,
      description: r.description || '',
      permission_ids: r.permission_ids || [],
    })
  }

  const remove = async (id) => {
    if (!canDelete) return
    if (!window.confirm('Delete this role?')) return
    try {
      await API.delete(`/roles/${id}`)
      load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to delete role.')
    }
  }

  if (!hasAny || !canView) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-800">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription className="text-sm">
                  You don’t have permission to view the Roles module.
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
            Admin · Roles & permissions
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
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg text-slate-900">
                    Roles & Permissions
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-600">
                    Define role templates and attach permission sets for OPD, IPD, billing,
                    pharmacy, lab and other modules.
                  </p>
                </div>
              </div>
              <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                <SummaryTile
                  label="Roles"
                  value={roles.length}
                  hint="Reusable access profiles"
                />
                <SummaryTile
                  label="Permissions"
                  value={perms.length}
                  hint="Atomic permission codes"
                />
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Error */}
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

        {/* 2-column layout */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)]">
          {/* Left – form & permissions */}
          <motion.div {...fadeIn}>
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      {editId ? 'Edit role' : 'Create role'}
                    </CardTitle>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Group permissions into named roles and assign them to users.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <form onSubmit={save} className="space-y-3">
                  <div className="grid gap-2">
                    <Input
                      placeholder="Role name (e.g., OPD Doctor)"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      disabled={!(!editId ? canCreate : canUpdate)}
                      className="h-8 rounded-2xl border-slate-200 bg-slate-50 text-xs"
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      disabled={!(!editId ? canCreate : canUpdate)}
                      className="h-8 rounded-2xl border-slate-200 bg-slate-50 text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700">
                        Permissions
                      </span>
                      <span className="text-slate-400">
                        {form.permission_ids.length || 0} selected
                      </span>
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-2 py-2">
                      {perms.map((p) => (
                        <label
                          key={p.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-2xl px-2 py-1.5 text-[11px] ${
                            form.permission_ids.includes(p.id)
                              ? 'bg-white'
                              : 'bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.permission_ids.includes(p.id)}
                            onChange={() => togglePerm(p.id)}
                            disabled={!(!editId ? canCreate : canUpdate)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span>
                            <span className="block font-medium text-slate-800">
                              {p.label}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {p.code}
                            </span>
                          </span>
                        </label>
                      ))}
                      {!perms.length && !loadingList && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                          No permissions configured yet.
                        </div>
                      )}
                      {loadingList && (
                        <div className="space-y-2">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 rounded-2xl px-2 py-1.5"
                            >
                              <Skeleton className="h-3 w-3 rounded bg-slate-100" />
                              <div className="flex-1 space-y-1">
                                <Skeleton className="h-3 w-1/2 rounded-full bg-slate-100" />
                                <Skeleton className="h-2 w-1/3 rounded-full bg-slate-100" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {editId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(null)
                          setForm({ name: '', description: '', permission_ids: [] })
                        }}
                        className="text-[11px] text-slate-500 underline"
                      >
                        Cancel edit &amp; reset
                      </button>
                    )}
                    <Button
                      type="submit"
                      className="ml-auto rounded-2xl bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      disabled={loadingSave || (!editId ? !canCreate : !canUpdate)}
                    >
                      {loadingSave
                        ? 'Saving...'
                        : editId
                        ? 'Update role'
                        : 'Create role'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right – list */}
          <motion.div {...fadeIn}>
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Role list
                    </CardTitle>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Overview of all defined roles and number of attached permissions.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {loadingList ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-1/3 rounded-full bg-slate-100" />
                          <Skeleton className="h-2.5 w-1/4 rounded-full bg-slate-100" />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 text-[11px] font-medium text-slate-600">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">Role name</th>
                          <th className="p-2 text-left">Description</th>
                          <th className="p-2 text-left">Permissions</th>
                          <th className="p-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map((r, i) => (
                          <tr
                            key={r.id}
                            className="border-t border-slate-100 text-xs text-slate-800"
                          >
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2">{r.name}</td>
                            <td className="p-2 text-slate-500">
                              {r.description || '—'}
                            </td>
                            <td className="p-2 text-slate-600">
                              {r.permission_ids?.length || 0} permissions
                            </td>
                            <td className="p-2 text-right">
                              <div className="inline-flex gap-2">
                                {canUpdate && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-2xl border-slate-200 px-3 text-[11px]"
                                    onClick={() => edit(r)}
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
                                    onClick={() => remove(r.id)}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!roles.length && (
                          <tr>
                            <td colSpan={5} className="p-4">
                              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                                <p className="text-sm font-medium text-slate-700">
                                  No roles defined yet.
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Create a role on the left to start grouping permissions.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, hint }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600"
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
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
