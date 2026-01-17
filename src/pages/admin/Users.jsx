// FILE: frontend/src/admin/Users.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import API from '@/api/client'
import { useModulePerms } from '@/utils/perm'
import {
  Users as UsersIcon,
  UserPlus,
  Stethoscope,
  ShieldCheck,
  Filter,
  Search,
  X,
  KeyRound,
  Copy,
  Mail,
  Smartphone,
  BadgeCheck,
  BadgeX,
  RefreshCcw,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
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

const cx = (...a) => a.filter(Boolean).join(' ')

const pickArray = (data, keys = []) => {
  if (!data) return []
  for (const k of keys) {
    const v = data?.[k]
    if (Array.isArray(v)) return v
  }
  return Array.isArray(data) ? data : []
}

export default function Users() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } = useModulePerms('users')

  const [items, setItems] = useState([])
  const [roles, setRoles] = useState([])
  const [depts, setDepts] = useState([])

  const [form, setForm] = useState({
    name: '',
    password: '',
    email: '',
    two_fa_enabled: false,
    multi_login_enabled: true,
    department_id: '',
    role_ids: [],
    is_doctor: false,
    is_active: true,

    // ✅ NEW doctor optional fields
    doctor_qualification: '',
    doctor_registration_no: '',
  })

  const [editId, setEditId] = useState(null)
  const [editLoginId, setEditLoginId] = useState('')
  const [emailOtp, setEmailOtp] = useState({ open: false, userId: null, email: '' })

  const [loadingSave, setLoadingSave] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState('')

  const [filter, setFilter] = useState('all') // all | doctors
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

      const usersArr = pickArray(u?.data, ['items', 'users', 'data']) || []
      const rolesArr = pickArray(r?.data, ['items', 'roles', 'data']) || []
      const deptsArr = pickArray(d?.data, ['items', 'departments', 'data']) || []

      setItems(usersArr)
      setRoles(rolesArr)
      setDepts(deptsArr)
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
    depts.forEach((d) => (m[d.id] = d.name))
    return m
  }, [depts])

  const roleMap = useMemo(() => {
    const m = {}
    roles.forEach((r) => (m[r.id] = r.name))
    return m
  }, [roles])

  const toggleRole = (id) => {
    const rid = Number(id)
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(rid)
        ? f.role_ids.filter((x) => x !== rid)
        : [...f.role_ids, rid],
    }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      password: '',
      email: '',
      two_fa_enabled: false,
      multi_login_enabled: true,
      department_id: '',
      role_ids: [],
      is_doctor: false,
      is_active: true,

      // ✅ NEW
      doctor_qualification: '',
      doctor_registration_no: '',
    })
    setEditId(null)
    setEditLoginId('')
    setError('')
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (u) => {
    if (!canUpdate) return
    setEditId(u.id)
    setEditLoginId(u.login_id ?? '')
    setForm({
      name: u.name || '',
      password: '',
      email: u.email || '',
      two_fa_enabled: !!u.two_fa_enabled,
      multi_login_enabled: u.multi_login_enabled ?? true,
      department_id: u.department_id ? String(u.department_id) : '',
      role_ids: (u.role_ids || []).map((x) => Number(x)),
      is_doctor: !!u.is_doctor,
      is_active: u.is_active ?? true,

      // ✅ NEW (safe read)
      doctor_qualification: u.doctor_qualification || '',
      doctor_registration_no: u.doctor_registration_no || '',
    })
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => setIsModalOpen(false)

  const validate = () => {
    const name = (form.name || '').trim()
    if (!name) return 'Name is required.'

    if (!editId && !(form.password || '').trim()) {
      return 'Password is required for new user.'
    }

    if (form.is_doctor && !String(form.department_id || '').trim()) {
      return 'Department is mandatory when "Mark as doctor" is enabled.'
    }

    if (form.two_fa_enabled && !(form.email || '').trim()) {
      return 'Email is mandatory when 2FA is enabled.'
    }

    return ''
  }

  const save = async (e) => {
    e.preventDefault()
    if (!editId && !canCreate) return
    if (editId && !canUpdate) return

    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setLoadingSave(true)
    setError('')

    const pwd = (form.password || '').trim()
    const emailTrim = (form.email || '').trim()

    const qual = (form.doctor_qualification || '').trim()
    const regNo = (form.doctor_registration_no || '').trim()

    const payload = {
      name: (form.name || '').trim(),
      email: emailTrim ? emailTrim : null,
      two_fa_enabled: !!form.two_fa_enabled,
      multi_login_enabled: !!form.multi_login_enabled,
      department_id: form.department_id ? Number(form.department_id) : null,
      role_ids: (form.role_ids || []).map((x) => Number(x)),
      is_doctor: !!form.is_doctor,
      is_active: !!form.is_active,

      // ✅ NEW: doctor optional fields (send null when not doctor)
      doctor_qualification: form.is_doctor ? (qual || null) : null,
      doctor_registration_no: form.is_doctor ? (regNo || null) : null,

      ...(pwd ? { password: pwd } : {}), // ✅ omit password if blank
    }

    try {
      const res = editId ? await API.put(`/users/${editId}`, payload) : await API.post('/users/', payload)

      const data = res?.data?.data ?? res?.data

      // ✅ if backend says verify needed, open OTP modal
      if (data?.needs_email_verify) {
        setIsModalOpen(false)
        setEmailOtp({
          open: true,
          userId: data?.user?.id ?? editId,
          email: data?.otp_sent_to ?? payload.email ?? '',
        })
        await load()
        return
      }

      toast.success(editId ? 'User updated' : 'User created')
      resetForm()
      setIsModalOpen(false)
      await load()
    } catch (e2) {
      const s = e2?.response?.status
      if (s === 403) setError('Access denied.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e2?.response?.data?.detail || 'Failed to save user.')
    } finally {
      setLoadingSave(false)
    }
  }

  const remove = async (id) => {
    if (!canDelete) return
    if (!window.confirm('Deactivate this user?')) return
    try {
      await API.delete(`/users/${id}`)
      toast.success('User deactivated')
      await load()
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError('Access denied.')
      else if (s === 401) setError('Session expired. Please login again.')
      else setError(e?.response?.data?.detail || 'Failed to delete user.')
    }
  }

  const totalDoctors = useMemo(() => items.filter((u) => u.is_doctor).length, [items])
  const totalActive = useMemo(() => items.filter((u) => u.is_active).length, [items])

  const filteredItems = useMemo(() => {
    let list = items
    if (filter === 'doctors') list = list.filter((u) => u.is_doctor)

    if (q.trim()) {
      const query = q.toLowerCase()
      list = list.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(query) ||
          (u.email || '').toLowerCase().includes(query) ||
          String(u.login_id ?? '').toLowerCase().includes(query) ||
          String(u.doctor_registration_no ?? '').toLowerCase().includes(query),
      )
    }
    return list
  }, [items, filter, q])

  const copyLoginId = async (loginId) => {
    try {
      await navigator.clipboard.writeText(String(loginId ?? ''))
      toast.success('Login ID copied')
    } catch {
      // ignore
    }
  }

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
                <h1 className="text-lg md:text-xl font-semibold tracking-tight">Users & Doctors</h1>
                <p className="mt-1 text-xs sm:text-sm text-teal-50/90">
                  Centralised staff management for OPD, IPD, diagnostics and support.
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-amber-900">Access restricted</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 rounded-2xl">
                <AlertTitle className="font-semibold">You don’t have permission</AlertTitle>
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
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-5 lg:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium tracking-wide text-slate-700"
          >
            Admin · User management
          </Badge>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
            <span className="hidden sm:inline">Desktop workspace</span>
            <span className="sm:hidden">Responsive view</span>
          </div>
        </div>

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
                      Create staff accounts with system-generated <span className="font-semibold">6-digit Login ID</span>,
                      enable <span className="font-semibold">2FA</span> and control{' '}
                      <span className="font-semibold">Multi-Login</span>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto space-y-3">
                <div className="grid grid-cols-3 gap-2 md:min-w-[260px]">
                  <HeroSummaryTile label="Total users" value={items.length} />
                  <HeroSummaryTile label="Doctors" value={totalDoctors} />
                  <HeroSummaryTile label="Active users" value={totalActive} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div {...fadeIn}>
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-800">
              <AlertTitle className="font-semibold">Issue</AlertTitle>
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        <motion.div {...fadeIn}>
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold text-slate-900">User directory</CardTitle>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {filteredItems.length} of {items.length} records visible in this view.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search by name / email / login id / reg no"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    />
                  </div>

                  {canCreate && (
                    <Button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      New user
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
                  <Filter className="h-3 w-3" />
                  <span>Filter</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={cx(
                    'inline-flex items-center rounded-full px-3 py-1 text-[11px] sm:text-xs transition',
                    filter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  All users
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('doctors')}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] sm:text-xs transition',
                    filter === 'doctors'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
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
                  {filteredItems.map((u) => {
                    const roleNames = (u.role_ids || []).map((id) => roleMap[Number(id)]).filter(Boolean)

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
                        className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-800">
                                {initials}
                              </div>
                              {u.is_doctor && (
                                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-sm font-semibold text-slate-900">{u.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {roleNames.length ? roleNames.join(', ') : 'No roles'}
                              </div>

                              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-[10px] text-slate-700">
                                <KeyRound className="h-3 w-3 text-slate-400" />
                                <span className="tabular-nums tracking-[0.18em]">{String(u.login_id ?? '').padStart(6, '0')}</span>
                                <button
                                  type="button"
                                  onClick={() => copyLoginId(u.login_id)}
                                  className="rounded-full p-1 hover:bg-slate-100"
                                  title="Copy Login ID"
                                >
                                  <Copy className="h-3 w-3 text-slate-500" />
                                </button>
                              </div>
                            </div>
                          </div>

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

                        <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">DEPARTMENT</span>
                            <span className="font-medium text-slate-700">{deptMap[u.department_id] || '-'}</span>
                          </div>

                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">EMAIL</span>
                            <span className="max-w-[60%] truncate text-right">{u.email || '-'}</span>
                          </div>

                          {/* ✅ NEW doctor fields shown only for doctors */}
                          {u.is_doctor && (
                            <>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-400">QUALIFICATION</span>
                                <span className="max-w-[60%] truncate text-right font-medium text-slate-700">
                                  {u.doctor_qualification || '-'}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-400">REG. NO</span>
                                <span className="max-w-[60%] truncate text-right font-medium text-slate-700">
                                  {u.doctor_registration_no || '-'}
                                </span>
                              </div>
                            </>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={cx(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                u.two_fa_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
                              )}
                            >
                              <ShieldCheck className="h-3 w-3" />
                              2FA {u.two_fa_enabled ? 'ON' : 'OFF'}
                            </span>

                            {u.two_fa_enabled && (
                              <span
                                className={cx(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                  u.email_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800',
                                )}
                              >
                                {u.email_verified ? <BadgeCheck className="h-3 w-3" /> : <BadgeX className="h-3 w-3" />}
                                Email {u.email_verified ? 'Verified' : 'Not verified'}
                              </span>
                            )}

                            <span
                              className={cx(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                u.multi_login_enabled ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700',
                              )}
                            >
                              <Smartphone className="h-3 w-3" />
                              Multi-Login {u.multi_login_enabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-between gap-2">
                          {canUpdate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1 h-9 rounded-full border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
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
                              className="flex-1 h-9 rounded-full border border-rose-200 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                              onClick={() => remove(u.id)}
                            >
                              Deactivate
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
              editLoginId={editLoginId}
              toggleRole={toggleRole}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {emailOtp.open && (
            <EmailVerifyOtpModal
              userId={emailOtp.userId}
              email={emailOtp.email}
              onClose={() => setEmailOtp({ open: false, userId: null, email: '' })}
              onVerified={() => {
                setEmailOtp({ open: false, userId: null, email: '' })
                load()
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ------------------ Helper components ------------------ */
const DIGITS = 6

function EmailVerifyOtpModal({ userId, email, onClose, onVerified }) {
  const [digits, setDigits] = useState(Array(DIGITS).fill(''))
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const inputsRef = useRef([])
  const aliveRef = useRef(true)
  const closedRef = useRef(false)

  const otp = useMemo(() => digits.join(''), [digits])
  const maskedEmail = useMemo(() => {
    const e = String(email || '')
    if (!e.includes('@')) return e || 'registered email'
    const [name, dom] = e.split('@')
    if (name.length <= 2) return `${name[0]}***@${dom}`
    return `${name.slice(0, 2)}***@${dom}`
  }, [email])

  useEffect(() => {
    aliveRef.current = true
    setTimeout(() => inputsRef.current?.[0]?.focus?.(), 50)

    const onKey = (ev) => {
      if (ev.key === 'Escape') safeClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      aliveRef.current = false
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => {
      if (!aliveRef.current) return
      setCooldown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const safeClose = () => {
    if (closedRef.current) return
    closedRef.current = true
    onClose?.()
  }

  const setOtpFromString = (s) => {
    const clean = String(s || '').replace(/\D/g, '').slice(0, DIGITS)
    const next = Array(DIGITS).fill('')
    for (let i = 0; i < clean.length; i++) next[i] = clean[i]
    setDigits(next)
    const idx = Math.min(clean.length, DIGITS - 1)
    setTimeout(() => inputsRef.current?.[idx]?.focus?.(), 0)
  }

  const onChangeDigit = (idx, val) => {
    const v = String(val || '').replace(/\D/g, '')
    if (!v) {
      setDigits((d) => {
        const next = [...d]
        next[idx] = ''
        return next
      })
      return
    }

    if (v.length > 1) {
      setOtpFromString(v)
      return
    }

    setDigits((d) => {
      const next = [...d]
      next[idx] = v[0]
      return next
    })

    if (idx < DIGITS - 1) {
      setTimeout(() => inputsRef.current?.[idx + 1]?.focus?.(), 0)
    }
  }

  const onKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        setDigits((d) => {
          const next = [...d]
          next[idx] = ''
          return next
        })
        return
      }
      if (idx > 0) setTimeout(() => inputsRef.current?.[idx - 1]?.focus?.(), 0)
    }
    if (e.key === 'ArrowLeft' && idx > 0) setTimeout(() => inputsRef.current?.[idx - 1]?.focus?.(), 0)
    if (e.key === 'ArrowRight' && idx < DIGITS - 1) setTimeout(() => inputsRef.current?.[idx + 1]?.focus?.(), 0)
  }

  const verify = async (e) => {
    e.preventDefault()
    const code = otp.replace(/\D/g, '').slice(0, DIGITS)
    if (code.length !== DIGITS) return toast.error('Enter 6-digit OTP')

    setLoading(true)
    try {
      await API.post(`/users/${userId}/email/verify-otp`, { otp_code: code, otp: code })
      toast.success('Email verified', { icon: <CheckCircle2 className="h-4 w-4" /> })
      safeClose()
      await Promise.resolve(onVerified?.())
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Invalid OTP')
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setResending(true)
    try {
      await API.post(`/users/${userId}/email/resend-otp`)
      toast.success('OTP sent')
      setCooldown(30)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to resend OTP')
    } finally {
      if (aliveRef.current) setResending(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => e.target === e.currentTarget && safeClose()}
      aria-modal="true"
      role="dialog"
    >
      <motion.div
        onPointerDown={(e) => e.stopPropagation()}
        initial={{ y: 36, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 36, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full sm:max-w-md overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_30px_80px_-25px_rgba(0,0,0,0.45)]"
      >
        <div className="relative px-5 pt-5 pb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-700 via-teal-600 to-blue-600" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_#e0f2fe,_transparent_55%)]" />
          <div className="relative flex items-start justify-between gap-3 text-white">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold border border-white/15 backdrop-blur">
                <Mail className="h-3.5 w-3.5" />
                Email verification
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Enter OTP</h3>
              <p className="text-xs text-white/85">
                We sent a 6-digit code to <span className="font-semibold">{maskedEmail}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={safeClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 border border-white/15 hover:bg-white/15 active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">Security check</span>
              <span className="text-slate-400">•</span>
              <span>Enter the code exactly as received</span>
            </div>

            <form onSubmit={verify} className="space-y-4">
              <div
                className="flex justify-between gap-2"
                onPaste={(e) => {
                  e.preventDefault()
                  const text = e.clipboardData?.getData('text') || ''
                  setOtpFromString(text)
                }}
              >
                {digits.map((d, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputsRef.current[idx] = el)}
                    value={d}
                    onChange={(e) => onChangeDigit(idx, e.target.value)}
                    onKeyDown={(e) => onKeyDown(idx, e)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="h-12 w-11 sm:h-13 sm:w-12 rounded-2xl border border-slate-200 bg-slate-50 text-center text-lg font-semibold tabular-nums text-slate-900 outline-none transition
                               focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    aria-label={`OTP digit ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Tip: You can paste the full code.</span>
                <span className="tabular-nums">{cooldown > 0 ? `Resend in 0:${String(cooldown).padStart(2, '0')}` : ''}</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-blue-600 text-white py-3 text-sm font-semibold
                           hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                onClick={resend}
                disabled={resending || cooldown > 0}
                className="w-full rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800
                           hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                {resending ? 'Sending...' : 'Resend OTP'}
              </button>
            </form>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 text-center">
            Didn’t receive it? Check Spam/Promotions, then tap Resend.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function HeroSummaryTile({ label, value }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="rounded-2xl border border-white/40 bg-white/10 px-3 py-2 text-[11px] text-teal-50/90"
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-teal-100/90">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </motion.div>
  )
}

function EmptyState({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500">Try changing filters, clearing the search, or creating a new user.</p>
    </div>
  )
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-3xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-2xl bg-slate-100" />
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
            <Skeleton className="h-9 w-full rounded-full bg-slate-100" />
            <Skeleton className="h-9 w-full rounded-full bg-slate-100" />
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
  editLoginId,
  toggleRole,
}) {
  if (!isOpen) return null

  const emailRequired = !!form.two_fa_enabled
  const doctorNeedsDept = !!form.is_doctor

  const setDoctor = (checked) => {
    if (!checked) {
      setForm({
        ...form,
        is_doctor: false,
        department_id: '',
        doctor_qualification: '',
        doctor_registration_no: '',
      })
      return
    }
    setForm({ ...form, is_doctor: true })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">{editId ? 'Edit user' : 'Add new user'}</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Login ID is system-generated. Enable 2FA and Multi-Login per user.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <span className="font-semibold">Login ID</span>
              </div>
              <span className="text-xs tabular-nums tracking-[0.18em] text-slate-900">
                {editId ? String(editLoginId ?? '').padStart(6, '0') : 'Auto-generated after save'}
              </span>
            </div>
          </div>

          <Input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={!canEditOrCreate}
            className="h-10 rounded-2xl border-slate-200 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
          />

          <Input
            placeholder={editId ? 'Password (leave blank to keep)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editId}
            disabled={!canEditOrCreate}
            className="h-10 rounded-2xl border-slate-200 bg-slate-50 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={cx(
                'flex cursor-pointer items-center justify-between gap-3 rounded-3xl border px-3 py-3 transition',
                form.two_fa_enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className={cx('h-4 w-4', form.two_fa_enabled ? 'text-emerald-700' : 'text-slate-500')} />
                <div>
                  <div className="text-[12px] font-semibold text-slate-900">Two-Factor Auth</div>
                  <div className="text-[11px] text-slate-600">OTP to email</div>
                </div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.two_fa_enabled}
                onChange={(e) => setForm({ ...form, two_fa_enabled: e.target.checked })}
                disabled={!canEditOrCreate}
              />
            </label>

            <label
              className={cx(
                'flex cursor-pointer items-center justify-between gap-3 rounded-3xl border px-3 py-3 transition',
                form.multi_login_enabled ? 'border-sky-200 bg-sky-50' : 'border-rose-200 bg-rose-50',
              )}
            >
              <div className="flex items-center gap-2">
                <Smartphone className={cx('h-4 w-4', form.multi_login_enabled ? 'text-sky-700' : 'text-rose-700')} />
                <div>
                  <div className="text-[12px] font-semibold text-slate-900">Multi-Login</div>
                  <div className="text-[11px] text-slate-600">
                    {form.multi_login_enabled ? 'Multiple devices allowed' : 'Only one device allowed'}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.multi_login_enabled}
                onChange={(e) => setForm({ ...form, multi_login_enabled: e.target.checked })}
                disabled={!canEditOrCreate}
              />
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Email {emailRequired ? <span className="text-rose-600">*</span> : <span className="text-slate-400">(optional)</span>}
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Mail className="h-4 w-4 text-slate-400" />
              <input
                type="email"
                className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="user@hospital.org"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required={emailRequired}
                disabled={!canEditOrCreate}
              />
            </div>
            {emailRequired && (
              <p className="text-[11px] text-slate-500">
                When 2FA is enabled, email is mandatory and must be verified by OTP during login.
              </p>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-medium text-slate-700">
              Department {doctorNeedsDept ? <span className="text-rose-600">*</span> : <span className="text-slate-400">(optional)</span>}
            </label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              disabled={!canEditOrCreate}
              className={cx(
                'h-10 w-full rounded-2xl border bg-slate-50 px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500',
                doctorNeedsDept ? 'border-rose-200' : 'border-slate-200',
              )}
            >
              <option value="">No department</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {doctorNeedsDept && <p className="text-[11px] text-rose-600">Department is mandatory when Mark as Doctor is enabled.</p>}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <label
              className={cx(
                'inline-flex flex-1 min-w-[150px] cursor-pointer items-center gap-2 rounded-3xl border px-3 py-2 transition-colors',
                form.is_doctor ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.is_doctor}
                onChange={(e) => setDoctor(e.target.checked)}
                disabled={!canEditOrCreate}
              />
              <span className="inline-flex items-center gap-1 text-slate-700">
                <Stethoscope className="h-4 w-4 text-emerald-600" />
                <span>Mark as doctor</span>
              </span>
            </label>

            <label
              className={cx(
                'inline-flex flex-1 min-w-[150px] cursor-pointer items-center gap-2 rounded-3xl border px-3 py-2 transition-colors',
                form.is_active ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                disabled={!canEditOrCreate}
              />
              <span className="inline-flex items-center gap-1 text-slate-700">
                <ShieldCheck className="h-4 w-4 text-slate-700" />
                <span>Active user</span>
              </span>
            </label>
          </div>

          {/* ✅ NEW Doctor details section */}
          {form.is_doctor && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-900 inline-flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-emerald-700" />
                  Doctor details
                </div>
                <span className="text-[11px] text-slate-500">Optional</span>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Qualification</label>
                  <Input
                    placeholder="MBBS, MD (Gen Med)"
                    value={form.doctor_qualification}
                    onChange={(e) => setForm({ ...form, doctor_qualification: e.target.value })}
                    disabled={!canEditOrCreate}
                    className="h-10 rounded-2xl border-slate-200 bg-white text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Registration No</label>
                  <Input
                    placeholder="TNMC 12345"
                    value={form.doctor_registration_no}
                    onChange={(e) => setForm({ ...form, doctor_registration_no: e.target.value })}
                    disabled={!canEditOrCreate}
                    className="h-10 rounded-2xl border-slate-200 bg-white text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-100 focus-visible:border-teal-500"
                  />
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                These fields help in prescriptions, documents, and compliance reports.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-700">Roles</span>
              <span className="text-slate-400">{form.role_ids.length || 0} selected</span>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 px-2 py-2">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 rounded-3xl border px-2.5 py-2 text-[11px] transition-colors',
                    form.role_ids.includes(Number(r.id)) ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 hover:bg-white',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.role_ids.includes(Number(r.id))}
                    onChange={() => toggleRole(r.id)}
                    disabled={!canEditOrCreate}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-slate-800">{r.name}</span>
                </label>
              ))}

              {!roles.length && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  No roles configured yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:scale-95"
              disabled={loadingSave || !canEditOrCreate}
            >
              {loadingSave ? 'Saving…' : editId ? 'Update user' : 'Create user'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
