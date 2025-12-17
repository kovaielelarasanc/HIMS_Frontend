// FILE: frontend/src/admin/Roles.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import API from '../../api/client'
import { useModulePerms } from '../../utils/perm'
import {
  ShieldCheck,
  KeyRound,
  Search,
  Plus,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
} from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const fadeIn = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
}

const UI = {
  glass:
    'rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
  glassSoft:
    'rounded-3xl border border-black/50 bg-white/70 backdrop-blur-xl shadow-[0_6px_22px_rgba(2,6,23,0.08)]',
  chip:
    'inline-flex items-center rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700',
  chipBtn:
    'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03] active:scale-[0.99] transition',
  input:
    'w-full rounded-2xl border border-black/50 bg-white/85 px-3 py-2 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
  pill:
    'inline-flex items-center rounded-full border border-black/50 bg-black/[0.03] px-2.5 py-0.5 text-[11px] font-semibold text-slate-700',
}

function cx(...xs) {
  return xs.filter(Boolean).join(' ')
}

function titleCase(s) {
  if (!s) return ''
  return String(s)
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function getModuleKey(p) {
  const code = String(p?.code || '')
  const parts = code.split('.').filter(Boolean)
  return parts[0] || 'general'
}

function getLastAction(code) {
  const parts = String(code || '').split('.').filter(Boolean)
  return parts[parts.length - 1] || ''
}

function codeEndsWithAction(code, action) {
  const last = getLastAction(code)
  return last === action
}

function highlightText(text, query) {
  const t = String(text || '')
  const q = String(query || '').trim()
  if (!q) return t
  const idx = t.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return t
  const before = t.slice(0, idx)
  const match = t.slice(idx, idx + q.length)
  const after = t.slice(idx + q.length)
  return (
    <>
      {before}
      <mark className="rounded bg-amber-100 px-1 py-0.5 text-slate-900">
        {match}
      </mark>
      {after}
    </>
  )
}

/** Heuristic presets that adapt to whatever permission codes exist in your DB */
function presetMatchers() {
  const hasAny = (code, arr) => arr.some((k) => code.includes(k))

  const baseActions = (allowed) => (p) => allowed.includes(getLastAction(p.code))

  const match = (keywords, actions = ['view', 'create', 'update']) => (p) => {
    const code = String(p.code || '').toLowerCase()
    const label = String(p.label || '').toLowerCase()
    const okKeyword = hasAny(code, keywords) || hasAny(label, keywords)
    const okAction = actions.includes(getLastAction(code))
    return okKeyword && okAction
  }

  return {
    doctor: {
      label: 'Doctor preset',
      description: 'OPD/Visits/Vitals/Prescriptions/Orders (adaptive)',
      pick: (p) =>
        match(
          [
            'patients',
            'opd',
            'visits',
            'visit',
            'vitals',
            'prescription',
            'rx',
            'orders',
            'lab',
            'ris',
            'radiology',
            'appointments',
            'queue',
            'emr',
            'soap',
          ],
          ['view', 'create', 'update', 'esign']
        )(p) || match(['dashboard'], ['view'])(p),
    },
    nurse: {
      label: 'Nurse preset',
      description: 'IPD/Vitals/Nursing/Drug chart (adaptive)',
      pick: (p) =>
        match(
          [
            'patients',
            'ipd',
            'admission',
            'beds',
            'ward',
            'nursing',
            'notes',
            'vitals',
            'drug',
            'chart',
            'medication',
            'admin',
            'iv',
            'fluids',
          ],
          ['view', 'create', 'update']
        )(p),
    },
    reception: {
      label: 'Reception preset',
      description: 'Registration/Appointments/Billing view (adaptive)',
      pick: (p) =>
        match(
          [
            'patients',
            'registration',
            'opd',
            'appointments',
            'queue',
            'billing',
            'invoice',
            'payments',
          ],
          ['view', 'create', 'update']
        )(p),
    },
    lab: {
      label: 'Lab preset',
      description: 'LIS/Orders/Results/Attachments (adaptive)',
      pick: (p) =>
        match(
          ['lab', 'lis', 'orders', 'result', 'results', 'attachments', 'specimen'],
          ['view', 'create', 'update']
        )(p),
    },
    pharmacy: {
      label: 'Pharmacy preset',
      description: 'Inventory/RX/Dispense/Billing view (adaptive)',
      pick: (p) =>
        match(
          ['pharmacy', 'inventory', 'stock', 'rx', 'dispense', 'bill', 'billing'],
          ['view', 'create', 'update']
        )(p),
    },
    admin: {
      label: 'Admin preset',
      description: 'Broad configuration access (adaptive)',
      pick: (p) =>
        match(
          ['roles', 'permissions', 'users', 'departments', 'masters', 'settings'],
          ['view', 'create', 'update', 'delete']
        )(p),
    },
  }
}

export default function Roles() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } =
    useModulePerms('roles')

  const [roles, setRoles] = useState([])
  const [perms, setPerms] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // list filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterChip, setFilterChip] = useState('all') // all | withPerms | noPerms

  // modal state (full screen)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // create | edit
  const [editId, setEditId] = useState(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    permission_ids: [],
  })

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

  const openCreate = () => {
    if (!canCreate) return
    setModalMode('create')
    setEditId(null)
    setForm({ name: '', description: '', permission_ids: [] })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    if (!canUpdate) return
    setModalMode('edit')
    setEditId(r.id)
    setForm({
      name: r.name || '',
      description: r.description || '',
      permission_ids: r.permission_ids || [],
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
  }

  const saveRole = async () => {
    if (!modalOpen) return
    if (!form.name?.trim()) {
      setError('Role name is required.')
      return
    }

    if (modalMode === 'create' && !canCreate) return
    if (modalMode === 'edit' && !canUpdate) return

    setSaving(true)
    setError('')
    try {
      if (modalMode === 'edit' && editId) {
        await API.put(`/roles/${editId}`, form)
      } else {
        await API.post('/roles/', form)
      }
      setModalOpen(false)
      setEditId(null)
      setForm({ name: '', description: '', permission_ids: [] })
      load()
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to save role.')
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async () => {
    if (!canDelete) return
    if (!editId) return
    if (!window.confirm('Delete this role?')) return
    try {
      await API.delete(`/roles/${editId}`)
      setModalOpen(false)
      setEditId(null)
      setForm({ name: '', description: '', permission_ids: [] })
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
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-5 md:px-8 md:py-8">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-black/50 bg-white/70 backdrop-blur-xl shadow-[0_10px_32px_rgba(2,6,23,0.12)]">
            <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%)]" />
            <div className="relative px-6 py-6 md:px-8 md:py-7 flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                <ShieldCheck className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                  Roles & Permissions
                </h1>
                <p className="mt-1 text-sm text-slate-600">
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
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-5 md:px-8 md:py-8">
      <div className="space-y-4 md:space-y-5">
        {/* Top meta row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge
            variant="outline"
            className="rounded-full border-black/50 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-700"
          >
            Admin · Roles & permissions
          </Badge>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
            <span className="hidden sm:inline">Workspace</span>
            <span className="sm:hidden">Responsive</span>
          </div>
        </div>

        {/* Header */}
        <motion.div {...fadeIn}>
          <div className={cx(UI.glass, 'relative overflow-hidden')}>
            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.18),_transparent_60%)]" />
            <div className="relative px-5 py-5 md:px-7 md:py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.04] border border-black/50">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-700" />
                  </span>
                  Centralised access control
                </div>

                <div className="mt-3 flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                    <KeyRound className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                      Roles & Permission Sets
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      Create roles and assign permissions grouped by module — faster review, easier audit.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto flex flex-col gap-2 items-start md:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={UI.chip}>
                    Roles <span className="ml-1 tabular-nums">{roles.length}</span>
                  </span>
                  <span className={UI.chip}>
                    Permissions <span className="ml-1 tabular-nums">{perms.length}</span>
                  </span>
                </div>

                {canCreate && (
                  <Button
                    type="button"
                    onClick={openCreate}
                    className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New role
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div {...fadeIn}>
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-800">
              <AlertTitle className="font-semibold text-sm">Issue</AlertTitle>
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* List */}
        <motion.div {...fadeIn}>
          <Card className={cx('rounded-3xl border-black/50 bg-white/75 backdrop-blur-xl')}>
            <CardHeader className="border-b border-black/50 pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                    Role list
                  </CardTitle>
                  <p className="mt-1 text-[12px] text-slate-600">
                    Search roles and open full-screen editor to manage permissions.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search roles by name / description"
                      className={cx(UI.input, 'pl-10')}
                    />
                  </div>

                  {canCreate && (
                    <Button
                      type="button"
                      onClick={openCreate}
                      className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'withPerms', label: 'With permissions' },
                  { key: 'noPerms', label: 'No permissions' },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setFilterChip(chip.key)}
                    className={cx(
                      'inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold transition border',
                      filterChip === chip.key
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white/80 text-slate-700 border-black/50 hover:bg-black/[0.03]'
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="pt-5">
              {loadingList ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-black/50 bg-white/70 px-4 py-3"
                    >
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-1/3 rounded-full bg-slate-100" />
                        <Skeleton className="h-3 w-1/4 rounded-full bg-slate-100" />
                      </div>
                      <Skeleton className="h-9 w-28 rounded-2xl bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto rounded-3xl border border-black/50 bg-white/70">
                      <table className="min-w-full text-sm">
                        <thead className="bg-black/[0.02] text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                          <tr>
                            <th className="p-3 text-left">#</th>
                            <th className="p-3 text-left">Role name</th>
                            <th className="p-3 text-left">Description</th>
                            <th className="p-3 text-left">Permissions</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRoles.map((r, i) => (
                            <tr
                              key={r.id}
                              className="border-t border-black/5 text-slate-800 hover:bg-black/[0.02] transition-colors"
                            >
                              <td className="p-3 align-top text-slate-500">{i + 1}</td>
                              <td className="p-3 align-top">
                                <div className="font-semibold text-slate-900">{r.name}</div>
                              </td>
                              <td className="p-3 align-top text-slate-600">
                                <span className="line-clamp-2">{r.description || '—'}</span>
                              </td>
                              <td className="p-3 align-top">
                                {(r.permission_ids?.length || 0) === 0 ? (
                                  <span className="inline-flex items-center rounded-full bg-black/[0.03] px-3 py-1 text-[11px] font-semibold text-slate-700 border border-black/50">
                                    No permissions
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-800 border border-teal-200">
                                    {r.permission_ids.length} permissions
                                  </span>
                                )}
                              </td>
                              <td className="p-3 align-top text-right">
                                <div className="inline-flex gap-2">
                                  {canUpdate && (
                                    <Button
                                      type="button"
                                      className="h-9 rounded-2xl bg-slate-900 px-4 text-[12px] font-semibold text-white hover:bg-slate-800"
                                      onClick={() => openEdit(r)}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}

                          {!filteredRoles.length && (
                            <tr>
                              <td colSpan={5} className="p-6">
                                <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-5 py-7 text-center">
                                  <p className="text-sm font-semibold text-slate-800">
                                    No roles match your filters.
                                  </p>
                                  <p className="mt-1 text-[12px] text-slate-500">
                                    Change search/filter or create a new role.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="grid gap-3 md:hidden">
                    {filteredRoles.map((r, i) => (
                      <div
                        key={r.id}
                        className="rounded-3xl border border-black/50 bg-white/75 backdrop-blur px-4 py-4 shadow-[0_8px_24px_rgba(2,6,23,0.10)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.04] border border-black/50 text-[11px] font-semibold text-slate-700">
                                {i + 1}
                              </span>
                              <div className="font-semibold text-slate-900">{r.name}</div>
                            </div>
                            <div className="mt-1 text-[12px] text-slate-600 line-clamp-2">
                              {r.description || 'No description'}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={cx(UI.pill, 'tabular-nums')}>
                              {r.permission_ids?.length || 0} perms
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end">
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {!filteredRoles.length && (
                      <div className="rounded-3xl border border-dashed border-black/20 bg-black/[0.02] px-5 py-7 text-center">
                        <p className="text-sm font-semibold text-slate-800">
                          No roles match your filters.
                        </p>
                        <p className="mt-1 text-[12px] text-slate-500">
                          Change search/filter or create a new role.
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

      {/* Full screen editor */}
      <RoleModal
        open={modalOpen}
        mode={modalMode}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onClose={closeModal}
        onSave={saveRole}
        onDelete={deleteRole}
        saving={saving}
        form={form}
        setForm={setForm}
        perms={perms}
      />
    </div>
  )
}

/* ------------------------- Fullscreen Role Modal ------------------------- */

function RoleModal({
  open,
  mode, // 'create' | 'edit'
  canCreate,
  canUpdate,
  canDelete,
  onClose,
  onSave,
  onDelete,
  saving,
  form,
  setForm,
  perms,
}) {
  const editorDisabled = mode === 'edit' ? !canUpdate : !canCreate

  const [permQuery, setPermQuery] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [moduleFilter, setModuleFilter] = useState('all')
  const [openModules, setOpenModules] = useState({})

  // collapsible sections
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(true)

  // presets
  const presets = useMemo(() => presetMatchers(), [])
  const [presetKey, setPresetKey] = useState('')

  // reset modal-only controls when opening
  useEffect(() => {
    if (!open) return
    setPermQuery('')
    setShowSelectedOnly(false)
    setModuleFilter('all')
    setOpenModules({})
    setDetailsOpen(true)
    setFiltersOpen(true)
    setPresetKey('')
  }, [open])

  const allModules = useMemo(() => {
    const set = new Set((perms || []).map(getModuleKey))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [perms])

  const visiblePerms = useMemo(() => {
    let list = perms || []
    const q = permQuery.toLowerCase().trim()

    if (q) {
      list = list.filter((p) => {
        const code = String(p.code || '').toLowerCase()
        const label = String(p.label || '').toLowerCase()
        return `${label} ${code}`.includes(q)
      })
    }

    if (moduleFilter !== 'all') {
      list = list.filter((p) => getModuleKey(p) === moduleFilter)
    }

    if (showSelectedOnly) {
      const sel = new Set(form.permission_ids || [])
      list = list.filter((p) => sel.has(p.id))
    }

    return [...list].sort((a, b) => {
      const ma = getModuleKey(a)
      const mb = getModuleKey(b)
      if (ma !== mb) return ma.localeCompare(mb)
      const la = String(a.label || '')
      const lb = String(b.label || '')
      if (la !== lb) return la.localeCompare(lb)
      return String(a.code || '').localeCompare(String(b.code || ''))
    })
  }, [perms, permQuery, moduleFilter, showSelectedOnly, form.permission_ids])

  const groupedPerms = useMemo(() => {
    const map = {}
    for (const p of visiblePerms) {
      const k = getModuleKey(p)
      if (!map[k]) map[k] = []
      map[k].push(p)
    }
    return map
  }, [visiblePerms])

  const selectedSet = useMemo(
    () => new Set(form.permission_ids || []),
    [form.permission_ids]
  )

  const selectedByModule = useMemo(() => {
    const counter = new Map()
    for (const p of perms || []) {
      const mk = getModuleKey(p)
      if (selectedSet.has(p.id)) counter.set(mk, (counter.get(mk) || 0) + 1)
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, n]) => ({ key: k, count: n }))
  }, [perms, selectedSet])

  const ensureOpenIfSearching = !!permQuery.trim()

  const isOpenModule = (moduleKey) => {
    if (openModules[moduleKey] !== undefined) return !!openModules[moduleKey]
    const list = groupedPerms[moduleKey] || []
    const selCount = list.filter((p) => selectedSet.has(p.id)).length
    return ensureOpenIfSearching || selCount > 0
  }

  const toggleModuleOpen = (moduleKey) =>
    setOpenModules((prev) => ({ ...prev, [moduleKey]: !isOpenModule(moduleKey) }))

  const togglePerm = (id) => {
    setForm((f) => {
      const set = new Set(f.permission_ids || [])
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...f, permission_ids: Array.from(set) }
    })
  }

  const setAllVisible = (checked) => {
    const ids = visiblePerms.map((p) => p.id)
    setForm((f) => {
      const set = new Set(f.permission_ids || [])
      if (checked) ids.forEach((id) => set.add(id))
      else ids.forEach((id) => set.delete(id))
      return { ...f, permission_ids: Array.from(set) }
    })
  }

  const setModuleAll = (moduleKey, checked) => {
    const ids = (groupedPerms[moduleKey] || []).map((p) => p.id)
    setForm((f) => {
      const set = new Set(f.permission_ids || [])
      if (checked) ids.forEach((id) => set.add(id))
      else ids.forEach((id) => set.delete(id))
      return { ...f, permission_ids: Array.from(set) }
    })
  }

  const moduleActionIds = (moduleKey, action) => {
    const list = groupedPerms[moduleKey] || []
    return list.filter((p) => codeEndsWithAction(p.code, action)).map((p) => p.id)
  }

  const toggleModuleAction = (moduleKey, action) => {
    const ids = moduleActionIds(moduleKey, action)
    if (!ids.length) return
    setForm((f) => {
      const set = new Set(f.permission_ids || [])
      const selected = ids.filter((id) => set.has(id)).length
      const shouldSelect = selected !== ids.length
      if (shouldSelect) ids.forEach((id) => set.add(id))
      else ids.forEach((id) => set.delete(id))
      return { ...f, permission_ids: Array.from(set) }
    })
  }

  const actionState = (moduleKey, action) => {
    const ids = moduleActionIds(moduleKey, action)
    if (!ids.length) return { state: 'none', disabled: true }
    const sel = ids.filter((id) => selectedSet.has(id)).length
    if (sel === 0) return { state: 'none', disabled: false }
    if (sel === ids.length) return { state: 'all', disabled: false }
    return { state: 'some', disabled: false }
  }

  const expandAll = () => {
    const next = {}
    Object.keys(groupedPerms).forEach((k) => (next[k] = true))
    setOpenModules(next)
  }
  const collapseAll = () => {
    const next = {}
    Object.keys(groupedPerms).forEach((k) => (next[k] = false))
    setOpenModules(next)
  }

  const jumpToModule = (moduleKey) => {
    setModuleFilter(moduleKey)
    setOpenModules((prev) => ({ ...prev, [moduleKey]: true }))
  }

  const applyPreset = (key) => {
    if (editorDisabled) return
    const preset = presets[key]
    if (!preset) return

    const picked = (perms || []).filter((p) => preset.pick(p)).map((p) => p.id)
    setForm((f) => ({
      ...f,
      permission_ids: Array.from(new Set([...(f.permission_ids || []), ...picked])),
    }))
    setPresetKey(key)
  }

  const clearAll = () => {
    if (editorDisabled) return
    setForm((f) => ({ ...f, permission_ids: [] }))
  }

  const headerTitle = mode === 'edit' ? 'Edit role' : 'Create new role'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ y: 18, opacity: 0, scale: 0.995 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.995 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div className="h-full flex flex-col min-h-0">
              {/* Sticky header */}
              <div className="sticky top-0 z-30 border-b border-black/50 bg-white/80 backdrop-blur-xl">
                <div className="px-4 md:px-8 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/[0.04] border border-black/50">
                          <KeyRound className="h-5 w-5 text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[16px] md:text-[18px] font-semibold text-slate-900 tracking-tight">
                            {headerTitle}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate-500">
                            Permissions are grouped by module for fast review.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Section toggles */}
                      <button
                        type="button"
                        onClick={() => setDetailsOpen((v) => !v)}
                        className="h-10 px-3 rounded-2xl border border-black/50 bg-white/85 text-[12px] font-semibold text-slate-700 hover:bg-black/[0.03] inline-flex items-center gap-2"
                        disabled={editorDisabled}
                        title="Toggle role details"
                      >
                        <ChevronDown
                          className={cx(
                            'h-4 w-4 transition',
                            detailsOpen ? 'rotate-0' : '-rotate-90'
                          )}
                        />
                        Details
                      </button>

                      <button
                        type="button"
                        onClick={() => setFiltersOpen((v) => !v)}
                        className="h-10 px-3 rounded-2xl border border-black/50 bg-white/85 text-[12px] font-semibold text-slate-700 hover:bg-black/[0.03] inline-flex items-center gap-2"
                        disabled={editorDisabled}
                        title="Toggle permission filters"
                      >
                        <ChevronDown
                          className={cx(
                            'h-4 w-4 transition',
                            filtersOpen ? 'rotate-0' : '-rotate-90'
                          )}
                        />
                        Filters
                      </button>

                      {mode === 'edit' && canDelete && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onDelete}
                          className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}

                      <Button
                        type="button"
                        onClick={onClose}
                        variant="outline"
                        className="rounded-2xl"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Close
                      </Button>

                      <Button
                        type="button"
                        onClick={onSave}
                        disabled={saving || editorDisabled}
                        className="rounded-2xl bg-blue-600 hover:bg-blue-700"
                      >
                        {saving ? 'Saving…' : mode === 'edit' ? 'Update role' : 'Create role'}
                      </Button>
                    </div>
                  </div>

                  {/* Collapsible: Role fields */}
                  <AnimatePresence initial={false}>
                    {detailsOpen ? (
                      <motion.div
                        key="details-open"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-slate-600">
                              Role name <span className="text-rose-500">*</span>
                            </label>
                            <Input
                              value={form.name}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, name: e.target.value }))
                              }
                              placeholder="e.g., OPD Doctor, IPD Nurse"
                              disabled={editorDisabled}
                              className="h-11 rounded-2xl border-black/50 bg-white/85"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-slate-600">
                              Description
                            </label>
                            <Input
                              value={form.description}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, description: e.target.value }))
                              }
                              placeholder="Optional short description"
                              disabled={editorDisabled}
                              className="h-11 rounded-2xl border-black/50 bg-white/85"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="details-closed"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="mt-4"
                      >
                        <div className="rounded-2xl border border-black/50 bg-black/[0.02] px-3 py-2 text-[12px] text-slate-700 flex flex-wrap items-center gap-2">
                          <span className="font-semibold">Role:</span>
                          <span className="font-semibold text-slate-900">
                            {form.name?.trim() ? form.name : 'Untitled role'}
                          </span>
                          {form.description?.trim() && (
                            <>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600 line-clamp-1">
                                {form.description}
                              </span>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Always-visible quick row */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={UI.chip}>
                      Selected{' '}
                      <span className="ml-1 tabular-nums">
                        {(form.permission_ids || []).length}
                      </span>
                    </span>
                    <span className={UI.chip}>
                      Visible{' '}
                      <span className="ml-1 tabular-nums">{visiblePerms.length}</span>
                    </span>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={expandAll}
                        className={UI.chipBtn}
                        disabled={editorDisabled}
                      >
                        <ChevronDown className="h-4 w-4" />
                        Expand all
                      </button>
                      <button
                        type="button"
                        onClick={collapseAll}
                        className={UI.chipBtn}
                        disabled={editorDisabled}
                      >
                        <ChevronRight className="h-4 w-4" />
                        Collapse all
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllVisible(true)}
                        className={UI.chipBtn}
                        disabled={editorDisabled || visiblePerms.length === 0}
                      >
                        <CheckSquare className="h-4 w-4" />
                        Select visible
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllVisible(false)}
                        className={UI.chipBtn}
                        disabled={editorDisabled || visiblePerms.length === 0}
                      >
                        <Square className="h-4 w-4" />
                        Clear visible
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        className={UI.chipBtn}
                        disabled={editorDisabled || (form.permission_ids || []).length === 0}
                      >
                        <Square className="h-4 w-4" />
                        Clear all
                      </button>
                    </div>
                  </div>

                  {/* Collapsible: Filters + presets */}
                  <AnimatePresence initial={false}>
                    {filtersOpen ? (
                      <motion.div
                        key="filters-open"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="mt-3"
                      >
                        {/* Presets */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                            <Sparkles className="h-4 w-4" />
                            Quick presets (adaptive)
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {Object.entries(presets).map(([k, p]) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => applyPreset(k)}
                                className={cx(
                                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                                  presetKey === k
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white/85 text-slate-700 border-black/50 hover:bg-black/[0.03]'
                                )}
                                disabled={editorDisabled}
                                title={p.description}
                              >
                                <Sparkles className="h-4 w-4" />
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {selectedByModule.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              Jump to selected modules:
                            </span>
                            {selectedByModule.map((m) => (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => jumpToModule(m.key)}
                                className="inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03]"
                                disabled={editorDisabled}
                                title="Jump / filter to module"
                              >
                                {titleCase(m.key)}
                                <span className="rounded-full bg-black/[0.05] px-2 py-0.5 tabular-nums">
                                  {m.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className={cx(UI.glassSoft, 'p-3 mt-3')}>
                          <div className="grid gap-2 lg:grid-cols-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <input
                                className={cx(UI.input, 'pl-10')}
                                value={permQuery}
                                onChange={(e) => setPermQuery(e.target.value)}
                                placeholder="Search permissions by label or code…"
                                disabled={editorDisabled}
                              />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                              <button
                                type="button"
                                onClick={() => setShowSelectedOnly((v) => !v)}
                                className={cx(
                                  'h-10 px-3 rounded-2xl border border-black/50 bg-white/85 text-[12px] font-semibold text-slate-700 hover:bg-black/[0.03] inline-flex items-center gap-2',
                                  showSelectedOnly && 'bg-black/[0.04]'
                                )}
                                disabled={editorDisabled}
                              >
                                {showSelectedOnly ? (
                                  <CheckSquare className="h-4 w-4" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                                Selected only
                              </button>

                              <select
                                className={cx(UI.input, 'h-10')}
                                value={moduleFilter}
                                onChange={(e) => setModuleFilter(e.target.value)}
                                disabled={editorDisabled}
                              >
                                <option value="all">All modules</option>
                                {allModules.map((m) => (
                                  <option key={m} value={m}>
                                    {titleCase(m)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="filters-closed"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="mt-3"
                      >
                        <div className="rounded-2xl border border-black/50 bg-black/[0.02] px-3 py-2 text-[12px] text-slate-700">
                          Filters collapsed.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ONLY permissions scroll */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-4">
                {visiblePerms.length === 0 ? (
                  <div className={cx(UI.glass, 'p-8 text-center')}>
                    <div className="mx-auto h-12 w-12 rounded-3xl bg-black/[0.04] border border-black/50 grid place-items-center">
                      <KeyRound className="h-6 w-6 text-slate-400" />
                    </div>
                    <div className="mt-3 font-semibold text-slate-900">
                      No permissions match
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      Adjust search, module filter, or disable “Selected only”.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.keys(groupedPerms)
                      .sort((a, b) => a.localeCompare(b))
                      .map((moduleKey) => {
                        const list = groupedPerms[moduleKey] || []
                        const selectedInModule = list.filter((p) =>
                          selectedSet.has(p.id)
                        ).length
                        const total = list.length

                        const openNow = isOpenModule(moduleKey)
                        const actions = ['view', 'create', 'update', 'delete']

                        return (
                          <div
                            key={moduleKey}
                            className="rounded-3xl border border-black/50 bg-white/75 backdrop-blur overflow-hidden shadow-[0_10px_28px_rgba(2,6,23,0.10)]"
                          >
                            <button
                              type="button"
                              onClick={() => toggleModuleOpen(moduleKey)}
                              className="w-full px-4 py-3 border-b border-black/50 bg-white/70 text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-[13px] font-semibold text-slate-900 truncate">
                                      {titleCase(moduleKey)}
                                    </div>
                                    <span className={UI.pill}>
                                      <span className="tabular-nums">{selectedInModule}</span>/
                                      {total}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 text-[12px] text-slate-500">
                                    Module permissions
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div
                                    className={cx(
                                      'h-9 w-9 rounded-full border border-black/50 bg-white/85 grid place-items-center',
                                      openNow && 'bg-black/[0.03]'
                                    )}
                                  >
                                    <ChevronRight
                                      className={cx(
                                        'h-4 w-4 text-slate-600 transition',
                                        openNow && 'rotate-90'
                                      )}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setModuleAll(moduleKey, true)
                                  }}
                                  className={UI.chipBtn}
                                  disabled={editorDisabled}
                                >
                                  <CheckSquare className="h-4 w-4" />
                                  Select module
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setModuleAll(moduleKey, false)
                                  }}
                                  className={UI.chipBtn}
                                  disabled={editorDisabled}
                                >
                                  <Square className="h-4 w-4" />
                                  Clear module
                                </button>

                                <div className="ml-auto flex flex-wrap items-center gap-2">
                                  {actions.map((a) => {
                                    const st = actionState(moduleKey, a)
                                    return (
                                      <ActionPill
                                        key={a}
                                        label={titleCase(a)}
                                        state={st.state}
                                        disabled={editorDisabled || st.disabled}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleModuleAction(moduleKey, a)
                                        }}
                                      />
                                    )
                                  })}
                                </div>
                              </div>
                            </button>

                            {openNow && (
                              <div className="p-3 sm:p-4">
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                                  {list.map((p) => {
                                    const checked = selectedSet.has(p.id)
                                    return (
                                      <label
                                        key={p.id}
                                        className={cx(
                                          'flex items-start gap-2 rounded-2xl border border-black/50 bg-white/85 px-3 py-2 transition',
                                          checked &&
                                          'shadow-[0_6px_18px_rgba(2,6,23,0.10)]'
                                        )}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => togglePerm(p.id)}
                                          disabled={editorDisabled}
                                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600"
                                        />
                                        <span className="min-w-0">
                                          <span className="block text-[13px] font-semibold text-slate-900 leading-snug">
                                            {highlightText(p.label || 'Permission', permQuery)}
                                          </span>
                                          <span className="block text-[11px] text-slate-500 font-mono break-all">
                                            {highlightText(p.code || '', permQuery)}
                                          </span>
                                        </span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                <div className="h-10" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ActionPill({ label, state, disabled, onClick }) {
  const base =
    'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border transition'
  const cls =
    state === 'all'
      ? 'bg-emerald-600 text-white border-emerald-600'
      : state === 'some'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-white/85 text-slate-700 border-black/50 hover:bg-black/[0.03]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(base, cls, disabled && 'opacity-50 cursor-not-allowed')}
      title={
        state === 'all'
          ? 'All selected'
          : state === 'some'
            ? 'Partially selected'
            : 'None selected'
      }
    >
      {label}
    </button>
  )
}
