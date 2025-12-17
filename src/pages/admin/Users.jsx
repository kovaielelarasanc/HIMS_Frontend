// FILE: frontend/src/admin/Users.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'
import {
  Users as UsersIcon,
  UserPlus,
  Stethoscope,
  ShieldCheck,
  Filter,
  Search,
  X,
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
  const { hasAny, canView, canCreate, canUpdate, canDelete } =
    useModulePerms('users')

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

  const [isModalOpen, setIsModalOpen] = useState(false)

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
    depts.forEach((d) => {
      m[d.id] = d.name
    })
    return m
  }, [depts])

  const toggleRole = (id) => {
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(id)
        ? f.role_ids.filter((x) => x !== id)
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

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (u) => {
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
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
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
      setIsModalOpen(false)
      load()
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to save user.')
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
      const s = e?.response?.status
      if (s === 403) setError('Access denied.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to delete user.')
    }
  }

  const totalDoctors = useMemo(
    () => items.filter((u) => u.is_doctor).length,
    [items],
  )

  const totalActive = useMemo(
    () => items.filter((u) => u.is_active).length,
    [items],
  )

  const filteredItems = useMemo(() => {
    let list = items
    if (filter === 'doctors') list = list.filter((u) => u.is_doctor)

    if (q.trim()) {
      const query = q.toLowerCase()
      list = list.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(query) ||
          (u.email || '').toLowerCase().includes(query),
      )
    }
    return list
  }, [items, filter, q])

  // ---------------- PERMISSION DENIED ----------------
  if (!hasAny || !canView) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 text-white shadow-md">
            <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />
            <div className="relative px-5 py-6 sm:px-7 sm:py-7 md:px-9 md:py-8 flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-white/10 border border-white/20">
                <UsersIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                  Users & Doctors
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-teal-50/90">
                  Centralised staff management for OPD, IPD, diagnostics and support.
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-amber-900">
                Access restricted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 rounded-2xl">
                <AlertTitle className="font-semibold">
                  You don’t have permission
                </AlertTitle>
                <AlertDescription className="text-sm">
                  You don’t have permission to view the Users module. Contact your
                  administrator for access.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---------------- MAIN UI ----------------
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-4 md:px-6 md:py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-5 lg:space-y-6">
        {/* Top meta row */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <Badge
            variant="outline"
            className="rounded-full border-slate-500 bg-white px-2.5 py-1 text-[11px] font-medium tracking-wide text-slate-700"
          >
            Admin · User management
          </Badge>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
            <span className="hidden sm:inline">Desktop workspace</span>
            <span className="sm:hidden">Responsive view</span>
          </div>
        </div>

        {/* Hero header */}
        <motion.div {...fadeIn}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-blue-600 text-white shadow-md">
            <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 lg:px-10 lg:py-8">
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm border border-white/20">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px]">
                    <UsersIcon className="w-3.5 h-3.5" />
                  </span>
                  Staff & access directory
                </div>
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-3xl bg-white/10 text-white shadow-sm border border-white/20">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight">
                      Users & Doctors Management
                    </h1>
                    <p className="text-sm md:text-base text-teal-50/90 leading-relaxed">
                      Create staff accounts, map them to{' '}
                      <span className="font-semibold">departments</span>, attach{' '}
                      <span className="font-semibold">roles</span> and mark doctors for
                      OPD/IPD routing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto space-y-3">
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                  <Badge className="bg-white/15 text-xs font-semibold border border-white/25 text-white rounded-full px-3 py-1">
                    Multi-module access
                  </Badge>
                  <Badge className="bg-white/10 text-xs border border-white/20 text-teal-50 rounded-full px-3 py-1">
                    OPD / IPD ready
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 md:min-w-[260px]">
                  <HeroSummaryTile label="Total users" value={items.length} />
                  <HeroSummaryTile label="Doctors" value={totalDoctors} />
                  <HeroSummaryTile label="Active users" value={totalActive} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error alert */}
        {error && (
          <motion.div {...fadeIn}>
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-800">
              <AlertTitle className="font-semibold">Issue</AlertTitle>
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Listing card with toolbar + grid */}
        <motion.div {...fadeIn}>
          <Card className="rounded-3xl border-slate-500 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              {/* Toolbar row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold text-slate-900">
                    User directory
                  </CardTitle>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {filteredItems.length} of {items.length} records visible in
                    this view.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  {/* Search input (global pattern) */}
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search by name or email"
                      className="w-full rounded-xl border border-slate-500 bg-slate-50 pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    />
                  </div>

                  {/* Primary New button */}
                  {canCreate && (
                    <Button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      New user
                    </Button>
                  )}
                </div>
              </div>

              {/* Filter chips row */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
                  <Filter className="h-3 w-3" />
                  <span>Filter</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] sm:text-xs transition ${filter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  All users
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('doctors')}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] sm:text-xs transition ${filter === 'doctors'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Doctors only
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {loadingList ? (
                <CardGridSkeleton />
              ) : filteredItems.length === 0 ? (
                <EmptyState title="No users match this view" />
              ) : (
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredItems.map((u, index) => {
                    const roleNames = roles
                      .filter((r) => (u.role_ids || []).includes(r.id))
                      .map((r) => r.name)

                    const initials = (u.name || '?')
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()

                    return (
                      <motion.div
                        key={u.id}
                        whileHover={{ y: -2, scale: 1.01 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="flex flex-col justify-between rounded-2xl border border-slate-500 bg-slate-50 px-3.5 py-3.5 shadow-sm"
                      >
                        {/* Header row with avatar + name */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="relative">
                              <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-800">
                                {initials}
                              </div>
                              {u.is_doctor && (
                                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-50" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-sm font-semibold text-slate-900">
                                {u.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {roleNames.length
                                  ? roleNames.join(', ')
                                  : 'No roles'}
                              </div>
                            </div>
                          </div>

                          {/* Status pill */}
                          <div className="flex flex-col items-end gap-1">
                            {u.is_active ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                INACTIVE
                              </span>
                            )}
                            {u.is_admin && (
                              <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                                ADMIN
                              </span>
                            )}
                            {u.is_doctor && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                                <Stethoscope className="h-3 w-3" />
                                DOCTOR
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle info rows */}
                        <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">DEPARTMENT</span>
                            <span className="font-medium text-slate-700">
                              {deptMap[u.department_id] || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">EMAIL</span>
                            <span className="max-w-[60%] truncate text-right">
                              {u.email}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-3 flex justify-between gap-2">
                          {canUpdate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 rounded-full border-slate-500 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => openEditModal(u)}
                            >
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 rounded-full border border-rose-200 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                              onClick={() => remove(u.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Modal for create / edit user */}
        <AnimatePresence>
          {isModalOpen && (
            <ResponsiveUserModal
              isOpen={isModalOpen}
              onClose={closeModal}
              onSubmit={save}
              form={form}
              setForm={setForm}
              depts={depts}
              roles={roles}
              canEditOrCreate={canEditOrCreate}
              loadingSave={loadingSave}
              editId={editId}
              toggleRole={toggleRole}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ------------------ Helper components ------------------ */

function HeroSummaryTile({ label, value }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="rounded-2xl border border-white/40 bg-white/10 px-3 py-2 text-[11px] text-teal-50/90"
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-teal-100/90">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">
        {value}
      </div>
    </motion.div>
  )
}

function EmptyState({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
      <p className="text-sm font-semibold text-slate-700">
        {title}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Try changing filters, clearing the search, or creating a new user.
      </p>
    </div>
  )
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-500 bg-slate-50 px-3.5 py-3.5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2 rounded-full bg-slate-100" />
              <Skeleton className="h-2.5 w-2/3 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-2.5 w-full rounded-full bg-slate-100" />
            <Skeleton className="h-2.5 w-5/6 rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-8 w-full rounded-full bg-slate-100" />
            <Skeleton className="h-8 w-full rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------ Responsive Modal ------------------ */

function ResponsiveUserModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  depts,
  roles,
  canEditOrCreate,
  loadingSave,
  editId,
  toggleRole,
}) {
  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={handleOverlayClick}
    >
      <motion.div
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
      >
        {/* Modal header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              {editId ? 'Edit user' : 'Add new user'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Fill basic details, map department and attach roles.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-500 bg-white text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Modal body: form */}
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <div className="grid gap-2">
            <Input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={!canEditOrCreate}
              className="h-9 rounded-xl border-slate-500 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
            />
            <Input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              disabled={!canEditOrCreate}
              className="h-9 rounded-xl border-slate-500 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
            />
          </div>

          <Input
            placeholder={editId ? 'Password (leave blank to keep)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editId}
            disabled={!canEditOrCreate}
            className="h-9 rounded-xl border-slate-500 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
          />

          {/* Department */}
          <div className="space-y-1 text-xs">
            <label className="font-medium text-slate-700">Department</label>
            <select
              value={form.department_id}
              onChange={(e) =>
                setForm({ ...form, department_id: e.target.value })
              }
              disabled={!canEditOrCreate}
              className="h-9 w-full rounded-xl border border-slate-500 bg-slate-50 px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
            >
              <option value="">No department</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <label
              className={`inline-flex flex-1 min-w-[150px] cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 transition-colors ${form.is_doctor
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-500 bg-white hover:bg-slate-50'
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
              className={`inline-flex flex-1 min-w-[150px] cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 transition-colors ${form.is_active
                  ? 'border-slate-300 bg-slate-50'
                  : 'border-slate-500 bg-white hover:bg-slate-50'
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
            <div className="grid gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-2 py-2">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-2.5 py-2 text-[11px] transition-colors ${form.role_ids.includes(r.id)
                      ? 'border-slate-300 bg-white'
                      : 'border-slate-500 bg-slate-50 hover:bg-white'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={form.role_ids.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                    disabled={!canEditOrCreate}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  <span className="text-slate-800">{r.name}</span>
                </label>
              ))}
              {!roles.length && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  No roles configured yet.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-slate-500 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
              disabled={loadingSave || !canEditOrCreate}
            >
              {loadingSave
                ? 'Saving…'
                : editId
                  ? 'Update user'
                  : 'Create user'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
