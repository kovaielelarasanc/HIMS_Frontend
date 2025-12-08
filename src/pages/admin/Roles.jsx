// FILE: frontend/src/admin/Roles.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'
import { ShieldCheck, KeyRound, Search, Plus } from 'lucide-react'

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
  const { hasAny, canView, canCreate, canUpdate, canDelete } =
    useModulePerms('roles')

  const [roles, setRoles] = useState([])
  const [perms, setPerms] = useState([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    permission_ids: [],
  })
  const [editId, setEditId] = useState(null)
  const [loadingSave, setLoadingSave] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [filterChip, setFilterChip] = useState('all') // all | withPerms | noPerms

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

  const resetForm = () => {
    setEditId(null)
    setForm({ name: '', description: '', permission_ids: [] })
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
      resetForm()
      load()
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to save role.')
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
      const s = e?.response?.status
      if (s === 403) setError('Access denied.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to delete role.')
    }
  }

  const filteredRoles = useMemo(() => {
    return (roles || []).filter((r) => {
      if (!r) return false
      const name = (r.name || '').toLowerCase()
      const desc = (r.description || '').toLowerCase()
      const query = searchTerm.toLowerCase().trim()

      if (query && !(`${name} ${desc}`.includes(query))) return false

      const count = r.permission_ids?.length || 0
      if (filterChip === 'withPerms' && count === 0) return false
      if (filterChip === 'noPerms' && count > 0) return false

      return true
    })
  }, [roles, searchTerm, filterChip])

  // ----- permission denied state -----
  if (!hasAny || !canView) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 text-white shadow-md">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#e5e7eb,_transparent_55%)]" />
            <div className="relative px-5 py-6 sm:px-7 sm:py-7 md:px-9 md:py-8 flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 border border-white/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                  Roles & Permissions
                </h1>
                <p className="mt-1 text-sm text-slate-100/90">
                  Manage access profiles and permission sets across modules.
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-amber-900">
                Access restricted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 rounded-2xl">
                <AlertTitle className="font-semibold">
                  You don’t have permission
                </AlertTitle>
                <AlertDescription className="text-sm">
                  Your role does not currently include access to the Roles module.
                  Please contact the system administrator if you believe this is a mistake.
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
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-5 lg:space-y-6">
        {/* TOP META ROW */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-slate-700"
          >
            Admin · Roles & permissions
          </Badge>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
            <span className="hidden sm:inline">Desktop workspace</span>
            <span className="sm:hidden">Responsive view</span>
          </div>
        </div>

        {/* HERO HEADER (gradient) */}
        <motion.div {...fadeIn}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 text-white shadow-md">
            <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 lg:px-10 lg:py-8">
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm border border-white/20">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </span>
                  Centralised access control
                </div>

                <div className="flex items-start gap-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-white/10 text-white shadow-sm border border-white/20">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                      Roles & Permission Sets
                    </h1>
                    <p className="text-sm md:text-base text-teal-50/90 leading-relaxed">
                      Define reusable <span className="font-semibold">roles</span> and attach
                      granular <span className="font-semibold">permission codes</span> for OPD,
                      IPD, pharmacy, lab, billing, OT, and more.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto space-y-3">
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                  <Badge className="bg-white/15 text-xs font-semibold border border-white/25 text-white rounded-full px-3 py-1">
                    RBAC ready
                  </Badge>
                  <Badge className="bg-white/10 text-xs border border-white/20 text-teal-50 rounded-full px-3 py-1">
                    Multi-module permissions
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 md:min-w-[260px]">
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
              </div>
            </div>
          </div>
        </motion.div>

        {/* ERROR */}
        {error && (
          <motion.div {...fadeIn}>
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-800">
              <AlertTitle className="font-semibold text-sm">Issue</AlertTitle>
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* MAIN GRID: FORM + LIST */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* LEFT – FORM & PERMISSIONS */}
          <motion.div {...fadeIn}>
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-semibold text-slate-900">
                      {editId ? 'Edit role' : 'Create role'}
                    </CardTitle>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600">
                      Group permissions into named roles and assign them to users.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={save} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">
                      Role name<span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., OPD Doctor, IPD Nurse"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      disabled={!(!editId ? canCreate : canUpdate)}
                      className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">
                      Description
                      <span className="text-slate-400 font-normal"> (optional)</span>
                    </label>
                    <Input
                      placeholder="Short description (e.g., OPD-only consulting doctor)"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      disabled={!(!editId ? canCreate : canUpdate)}
                      className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">
                        Permissions
                      </span>
                      <span className="text-xs text-slate-500">
                        {form.permission_ids.length || 0} selected
                      </span>
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-2 py-2">
                      {perms.map((p) => (
                        <label
                          key={p.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-2xl px-2.5 py-1.5 text-xs transition-colors ${form.permission_ids.includes(p.id)
                              ? 'bg-white shadow-sm'
                              : 'bg-slate-50 hover:bg-white'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.permission_ids.includes(p.id)}
                            onChange={() => togglePerm(p.id)}
                            disabled={!(!editId ? canCreate : canUpdate)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-600"
                          />
                          <span>
                            <span className="block font-semibold text-slate-800">
                              {p.label}
                            </span>
                            <span className="block text-[11px] text-slate-500 font-mono">
                              {p.code}
                            </span>
                          </span>
                        </label>
                      ))}

                      {!perms.length && !loadingList && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
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
                        onClick={resetForm}
                        className="text-xs sm:text-sm text-slate-500 underline underline-offset-2 font-medium"
                      >
                        Cancel edit &amp; reset
                      </button>
                    )}
                    <Button
                      type="submit"
                      className="ml-auto rounded-full bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
                      disabled={loadingSave || (!editId ? !canCreate : !canUpdate)}
                    >
                      {loadingSave
                        ? 'Saving…'
                        : editId
                          ? 'Update role'
                          : 'Create role'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* RIGHT – ROLES LIST */}
          <motion.div {...fadeIn}>
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-semibold text-slate-900">
                      Role list
                    </CardTitle>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600">
                      Overview of all defined roles and number of attached permissions.
                    </p>
                  </div>

                  {/* Search + New button bar */}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                    {/* Search input */}
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by role name / description"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                      />
                    </div>

                    {/* Primary "New" button */}
                    {canCreate && (
                      <Button
                        type="button"
                        onClick={resetForm}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        New role
                      </Button>
                    )}
                  </div>
                </div>

                {/* Filter chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'withPerms', label: 'With permissions' },
                    { key: 'noPerms', label: 'No permissions' },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setFilterChip(chip.key)}
                      className={[
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition',
                        filterChip === chip.key
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      ].join(' ')}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                {/* LOADING LIST */}
                {loadingList ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3.5 w-1/3 rounded-full bg-slate-100" />
                          <Skeleton className="h-3 w-1/4 rounded-full bg-slate-100" />
                        </div>
                        <Skeleton className="h-8 w-24 rounded-full bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* DESKTOP/TABLET: TABLE VIEW */}
                    <div className="hidden md:block">
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            <tr>
                              <th className="p-2 text-left">#</th>
                              <th className="p-2 text-left">Role name</th>
                              <th className="p-2 text-left">Description</th>
                              <th className="p-2 text-left">Permissions</th>
                              <th className="p-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRoles.map((r, i) => (
                              <tr
                                key={r.id}
                                className="border-t border-slate-100 text-sm text-slate-800 hover:bg-slate-50/80 transition-colors"
                              >
                                <td className="p-2 align-top">{i + 1}</td>
                                <td className="p-2 align-top font-semibold text-slate-900">
                                  {r.name}
                                </td>
                                <td className="p-2 align-top text-slate-600">
                                  <span className="line-clamp-2 text-xs sm:text-sm">
                                    {r.description || '—'}
                                  </span>
                                </td>
                                <td className="p-2 align-top text-slate-700">
                                  {(r.permission_ids?.length || 0) === 0 ? (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                      No permissions
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-100">
                                      {(r.permission_ids?.length || 0)}{' '}
                                      <span className="ml-1 hidden sm:inline">
                                        permissions
                                      </span>
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 align-top text-right">
                                  <div className="inline-flex gap-2">
                                    {canUpdate && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                                        onClick={() => edit(r)}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700"
                                        onClick={() => remove(r.id)}
                                      >
                                        Delete
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}

                            {!filteredRoles.length && (
                              <tr>
                                <td colSpan={5} className="p-4">
                                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                                    <p className="text-sm font-semibold text-slate-700">
                                      No roles match your filters.
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Adjust search or filters, or create a new role using the form
                                      on the left.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* MOBILE: CARD VIEW */}
                    <div className="grid gap-3 md:hidden">
                      {filteredRoles.map((r, i) => (
                        <div
                          key={r.id}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                  {i + 1}
                                </span>
                                <h3 className="text-sm font-semibold text-slate-900">
                                  {r.name}
                                </h3>
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2">
                                {r.description || 'No description'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="text-xs text-slate-600">
                              {(r.permission_ids?.length || 0) === 0 ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium">
                                  No permissions
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-teal-700 border border-teal-100 font-semibold">
                                  {(r.permission_ids?.length || 0)} perms
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {canUpdate && (
                                <button
                                  type="button"
                                  onClick={() => edit(r)}
                                  className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                                >
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => remove(r.id)}
                                  className="inline-flex items-center rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {!filteredRoles.length && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                          <p className="text-sm font-semibold text-slate-700">
                            No roles match your filters.
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Adjust search or filters, or create a new role using the form above.
                          </p>
                        </div>
                      )}
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

function SummaryTile({ label, value, hint }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="rounded-2xl border border-white/40 bg-white/10 px-3 py-2 text-xs text-teal-50/90"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-100/90">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-white">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-teal-100/80">
          {hint}
        </div>
      )}
    </motion.div>
  )
}
