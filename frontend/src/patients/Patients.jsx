// frontend/src/patients/Patients.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import API from '../api/client'
import { useCan } from '../hooks/useCan'
import { format } from 'date-fns'
import {
  FilePlus2, File as FileIcon, ClipboardList, Plus, Search, X, ShieldCheck,
  Trash2, Upload, Link as LinkIcon, CheckCircle2, Clock, Image, UserRound,
  MapPin, Building2, Home, Globe2, Mail, Phone, Pencil
} from 'lucide-react'
import { useAuth } from '../store/authStore'
/**
 * Patient module page:
 * - Search + list (responsive: table on md+, cards on <md)
 * - Create new patient (modal)
 * - Drawer with tabs (Overview | Addresses | Documents | Consents | ABHA Link)
 * - Permission-aware actions:
 *   - patients.view, patients.create, patients.update, patients.deactivate
 *   - patients.attachments.manage, patients.consents.view, patients.consents.create
 *   - Address add uses patients.update (as per backend)
 */

export default function Patients() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const canView = useCan('patients.view')
  const canCreate = useCan('patients.create')
  const modules = useAuth.getState().modules || {}
  const can = (code) => {
    const list = modules['patients'] || []
    return list.some(p => p.code === code)
  }
  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true); setErr('')
    try {
      const { data } = await API.get('/patients/', { params: { q } })
      setItems(data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to load patients')
    } finally {
      setLoading(false)
    }
  }, [q, canView])

  useEffect(() => { load() }, [load])

  const [openCreate, setOpenCreate] = useState(false)
  const [selected, setSelected] = useState(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <UserRound className="h-5 w-5" />
          Patients
        </h2>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by UHID, phone, email or name…"
              className="pl-9 pr-10 py-2 rounded-xl border w-72 max-w-full"
            />
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {q && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setQ('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={load}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            title="Refresh"
          >
            Reload
          </button>
          {canCreate && (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95"
              onClick={() => setOpenCreate(true)}
            >
              <Plus className="h-4 w-4" />
              New Patient
            </button>
          )}
        </div>
      </div>

      {/* Errors */}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* Responsive List: Cards (mobile) */}
      <div className="grid gap-3 sm:hidden">
        {loading && <div className="rounded-xl border bg-white p-4 text-center text-gray-500">Loading…</div>}
        {!loading && items.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{p.first_name} {p.last_name || ''}</div>
                <div className="text-xs text-gray-500 font-mono">UHID: {p.uhid}</div>
              </div>
              <button
                className="rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50"
                onClick={() => setSelected(p)}
              >
                View
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><span className="capitalize">{p.gender}</span></div>
              <div>{p.dob ? format(new Date(p.dob), 'yyyy-MM-dd') : '—'}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> <span>{p.phone || '—'}</span></div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> <span className="truncate">{p.email || '—'}</span></div>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border bg-white p-4 text-center text-gray-500">No patients found</div>
        )}
      </div>

      {/* Table (md+) */}
      <div className="overflow-x-auto rounded-xl border bg-white hidden sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-2 text-left">#</th>
              <th className="p-2 text-left">UHID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Gender</th>
              <th className="p-2 text-left">DOB</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && items.map((p, i) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-mono">{p.uhid}</td>
                <td className="p-2">{p.first_name} {p.last_name || ''}</td>
                <td className="p-2 capitalize">{p.gender}</td>
                <td className="p-2">{p.dob ? format(new Date(p.dob), 'yyyy-MM-dd') : '—'}</td>
                <td className="p-2">{p.phone || '—'}</td>
                <td className="p-2">{p.email || '—'}</td>
                <td className="p-2 text-right">
                  <button
                    className="rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50"
                    onClick={() => setSelected(p)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">No patients found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {openCreate && (
        <PatientCreateModal
          onClose={() => setOpenCreate(false)}
          onCreated={(p) => { setOpenCreate(false); setSelected(p); load() }}
        />
      )}

      {/* Drawer */}
      {selected && (
        <PatientDrawer
          patient={selected}
          onClose={() => setSelected(null)}
          onUpdated={(p) => { setSelected(p); load() }}
          onDeactivated={() => { setSelected(null); load() }}
        />
      )}
    </div>
  )
}

/* ------------------------ Create Modal ------------------------ */

function PatientCreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', gender: 'male', dob: '',
    phone: '', email: '', aadhar_last4: ''
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const payload = { ...form }
      if (!payload.dob) delete payload.dob
      const { data } = await API.post('/patients/', payload)
      onCreated?.(data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to create patient')
    } finally {
      setLoading(false)
    }
    {
      err && err.includes('Phone') && (
        <div className="text-xs text-rose-600">This phone number is already in use.</div>
      )
    }
    {
      err && err.includes('Email') && (
        <div className="text-xs text-rose-600">This email is already in use.</div>
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl animate-in fade-in zoom-in-95">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">New Patient</h3>
          <button className="rounded-xl p-2 hover:bg-gray-50" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {err && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input className="input" placeholder="First name" value={form.first_name}
            onChange={e => setForm({ ...form, first_name: e.target.value })} required />
          <input className="input" placeholder="Last name (optional)" value={form.last_name}
            onChange={e => setForm({ ...form, last_name: e.target.value })} />
          <select className="input" value={form.gender}
            onChange={e => setForm({ ...form, gender: e.target.value })}>
            <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
          <input className="input" type="date" value={form.dob}
            onChange={e => setForm({ ...form, dob: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" type="email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Aadhaar last 4" maxLength={4} value={form.aadhar_last4}
            onChange={e => setForm({ ...form, aadhar_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} />

          <div className="md:col-span-2 mt-2 flex items-center justify-end gap-2">
            <button type="button" className="rounded-xl border px-4 py-2" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={loading}>{loading ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------ Patient Drawer with Tabs ------------------------ */

function PatientDrawer({ patient, onClose, onUpdated, onDeactivated }) {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(patient)
  const canUpdate = useCan('patients.update')
  const canDeactivate = useCan('patients.deactivate')

  const reloadOne = useCallback(async () => {
    try {
      const { data } = await API.get(`/patients/${patient.id}`)
      setData(data)
      onUpdated?.(data)
    } catch (e) {
      // ignore
    }
  }, [patient.id, onUpdated])

  useEffect(() => { setData(patient) }, [patient])

  const deactivate = async () => {
    if (!confirm('Deactivate this patient?')) return
    await API.patch(`/patients/${patient.id}/deactivate`)
    onDeactivated?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* overlay */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* panel */}
      <div className="h-full w-full max-w-3xl bg-white shadow-2xl animate-in slide-in-from-right">
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <div>
            <div className="text-lg font-semibold">{data.first_name} {data.last_name || ''}</div>
            <div className="text-xs text-gray-500">UHID: <span className="font-mono">{data.uhid}</span></div>
          </div>
          <div className="flex items-center gap-2">
            {canDeactivate && (
              <button onClick={deactivate} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 text-rose-600">
                <Trash2 className="h-4 w-4" /> Deactivate
              </button>
            )}
            <button className="rounded-xl p-2 hover:bg-gray-50" onClick={onClose}><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-2 border-b px-4">
          <TabBtn label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
          <TabBtn label="Addresses" active={tab === 'addresses'} onClick={() => setTab('addresses')} />
          <TabBtn label="Documents" active={tab === 'docs'} onClick={() => setTab('docs')} />
          <TabBtn label="Consents" active={tab === 'consents'} onClick={() => setTab('consents')} />
          <TabBtn label="ABHA Link" active={tab === 'abha'} onClick={() => setTab('abha')} />
        </div>

        <div className="p-4">
          {tab === 'overview' && <OverviewTab data={data} canUpdate={canUpdate} onSaved={reloadOne} />}
          {tab === 'addresses' && <AddressesTab patient={data} onAdded={reloadOne} />}
          {tab === 'docs' && <DocumentsTab id={data.id} />}
          {tab === 'consents' && <ConsentsTab id={data.id} />}
          {tab === 'abha' && <AbhaTab patient={data} onLinked={reloadOne} />}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      className={`px-3 py-2 text-sm transition ${active ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

/* ------------------------ Overview ------------------------ */

function OverviewTab({ data, canUpdate, onSaved }) {
  const [form, setForm] = useState({
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    gender: data.gender || 'male',
    dob: data.dob || '',
    phone: data.phone || '',
    email: data.email || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async (e) => {
    e.preventDefault()
    if (!canUpdate) return
    setSaving(true); setMsg('')
    try {
      await API.put(`/patients/${data.id}`, form)
      setMsg('Saved!')
      onSaved?.()
      setTimeout(() => setMsg(''), 1200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <input className="input" placeholder="First name" value={form.first_name}
        onChange={e => setForm({ ...form, first_name: e.target.value })} disabled={!canUpdate} />
      <input className="input" placeholder="Last name" value={form.last_name}
        onChange={e => setForm({ ...form, last_name: e.target.value })} disabled={!canUpdate} />
      <select className="input" value={form.gender}
        onChange={e => setForm({ ...form, gender: e.target.value })} disabled={!canUpdate}>
        <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
      </select>
      <input className="input" type="date" value={form.dob || ''}
        onChange={e => setForm({ ...form, dob: e.target.value })} disabled={!canUpdate} />
      <input className="input" placeholder="Phone" value={form.phone}
        onChange={e => setForm({ ...form, phone: e.target.value })} disabled={!canUpdate} />
      <input className="input" placeholder="Email" type="email" value={form.email}
        onChange={e => setForm({ ...form, email: e.target.value })} disabled={!canUpdate} />

      <div className="md:col-span-2 mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>Created: {data.created_at ? format(new Date(data.created_at), 'yyyy-MM-dd HH:mm') : '—'}</span>
        <span>Updated: {data.updated_at ? format(new Date(data.updated_at), 'yyyy-MM-dd HH:mm') : '—'}</span>
      </div>

      {canUpdate && (
        <div className="md:col-span-2 mt-2 flex justify-end">
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      )}
      {msg && <div className="md:col-span-2 text-green-600 text-sm">{msg}</div>}
    </form>
  )
}

/* ------------------------ Addresses (NEW) ------------------------ */

function AddressesTab({ patient, onAdded }) {
  const modules = useAuth(s => s.modules) || {}
  const can = useMemo(() => {
    const list = modules['patients'] || []
    return (code) => list.some(p => p.code === code)
  }, [modules])

  const canView = can('patients.addresses.view')
  const canCreate = can('patients.addresses.create')
  const canUpdate = can('patients.addresses.update')
  const canDelete = can('patients.addresses.delete')

  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // Create form
  const [form, setForm] = useState({
    type: 'current',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  })
  const [saving, setSaving] = useState(false)

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editAddr, setEditAddr] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr] = useState('')

  const load = async () => {
    if (!patient?.id || !canView) {
      setAddresses([])
      return
    }
    setLoading(true); setErr('')
    try {
      const { data } = await API.get(`/patients/${patient.id}/addresses`)
      setAddresses(data || [])
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setErr('You do not have permission to view addresses.')
      else if (s === 401) setErr('Session expired. Please login again.')
      else setErr(e?.response?.data?.detail || 'Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [patient?.id, canView])

  const addedRefresh = async () => {
    await load()
    onChanged?.()  // notify parent (optional)
  }

  // Create
  const add = async (e) => {
    e.preventDefault()
    if (!canCreate) return
    setSaving(true); setErr('')
    try {
      await API.post(`/patients/${patient.id}/addresses`, form)
      setForm({
        type: 'current', line1: '', line2: '', city: '',
        state: '', pincode: '', country: 'India'
      })
      await addedRefresh()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'address added')
    } finally {
      setSaving(false)
    }
  }

  // Open edit modal
  const openEdit = (a) => {
    if (!canUpdate) return
    setEditErr('')
    setEditAddr({ ...a })
    setEditOpen(true)
  }
  const closeEdit = () => {
    setEditOpen(false)
    setEditAddr(null)
  }

  // Save edit
  const saveEdit = async (e) => {
    e.preventDefault()
    if (!canUpdate || !editAddr?.id) return
    setEditSaving(true); setEditErr('')
    try {
      const payload = {
        type: editAddr.type || 'current',
        line1: editAddr.line1 || '',
        line2: editAddr.line2 || '',
        city: editAddr.city || '',
        state: editAddr.state || '',
        pincode: editAddr.pincode || '',
        country: editAddr.country || 'India',
      }
      await API.put(`/patients/addresses/${editAddr.id}`, payload)
      closeEdit()
      await addedRefresh()
    } catch (e) {
      setEditErr(e?.response?.data?.detail || 'Failed to update address')
    } finally {
      setEditSaving(false)
    }
  }

  // Delete
  const remove = async (id) => {
    if (!canDelete) return
    if (!confirm('Delete this address?')) return
    try {
      await API.delete(`/patients/addresses/${id}`)
      await addedRefresh()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to delete')
    }
  }

  // UI helpers
  const TypeIcon = ({ type }) => (
    type === 'office' ? <Building2 className="h-4 w-4" /> : <Home className="h-4 w-4" />
  )

  return (
    <div className="space-y-4">
      {/* Permission banner when no view */}
      {!canView && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          You do not have permission to view addresses.
        </div>
      )}

      {/* Add form */}
      {canCreate && (
        <form
          onSubmit={add}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-4 transition hover:shadow-sm"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4" /> Add Address
          </div>

          {err && (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              className="input"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              <option value="current">Current</option>
              <option value="permanent">Permanent</option>
              <option value="office">Office</option>
              <option value="other">Other</option>
            </select>

            <input
              className="input md:col-span-2"
              placeholder="Address line 1"
              value={form.line1}
              onChange={e => setForm({ ...form, line1: e.target.value })}
              required
            />

            <input
              className="input md:col-span-3"
              placeholder="Address line 2 (optional)"
              value={form.line2}
              onChange={e => setForm({ ...form, line2: e.target.value })}
            />

            <input
              className="input"
              placeholder="City"
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
            />
            <input
              className="input"
              placeholder="State"
              value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })}
            />
            <input
              className="input"
              placeholder="Pincode"
              value={form.pincode}
              onChange={e =>
                setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })
              }
            />
            <input
              className="input"
              placeholder="Country"
              value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value })}
            />
          </div>

          <div className="mt-3 flex justify-end">
            <button className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Add Address'}
            </button>
          </div>
        </form>
      )}

      {/* Address list */}
      {canView && (
        <div className="grid gap-3 sm:grid-cols-2">
          {loading && (
            <div className="rounded-2xl border p-4 text-sm text-gray-500">Loading addresses…</div>
          )}

          {!loading && addresses.length === 0 && (
            <div className="rounded-2xl border bg-white p-4 text-center text-gray-500">
              No addresses yet
            </div>
          )}

          {!loading && addresses.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TypeIcon type={a.type} />
                  <span className="capitalize">{a.type || 'address'}</span>
                </div>

                <div className="shrink-0 space-x-2">
                  <button
                    className={`rounded-lg border px-2 py-1 text-xs hover:bg-gray-50 ${!canUpdate ? 'cursor-not-allowed opacity-40' : ''
                      }`}
                    onClick={() => canUpdate && openEdit(a)}
                    disabled={!canUpdate}
                    title={canUpdate ? 'Edit address' : 'No permission'}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className={`rounded-lg border px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 ${!canDelete ? 'cursor-not-allowed opacity-40' : ''
                      }`}
                    onClick={() => canDelete && remove(a.id)}
                    disabled={!canDelete}
                    title={canDelete ? 'Delete address' : 'No permission'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                <div>{a.line1}</div>
                {a.line2 && <div>{a.line2}</div>}
                <div className="flex flex-wrap gap-x-2">
                  {a.city && <span>{a.city},</span>}
                  {a.state && <span>{a.state}</span>}
                  {a.pincode && <span>{a.pincode}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Globe2 className="h-3.5 w-3.5" />
                  <span>{a.country || 'India'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/30" onClick={closeEdit} />
          <form
            onSubmit={saveEdit}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4" />
                Edit Address
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-gray-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editErr && (
              <div className="mb-2 rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {editErr}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                className="input"
                value={editAddr?.type || 'current'}
                onChange={e => setEditAddr({ ...editAddr, type: e.target.value })}
              >
                <option value="current">Current</option>
                <option value="permanent">Permanent</option>
                <option value="office">Office</option>
                <option value="other">Other</option>
              </select>

              <input
                className="input md:col-span-2"
                placeholder="Address line 1"
                value={editAddr?.line1 || ''}
                onChange={e => setEditAddr({ ...editAddr, line1: e.target.value })}
                required
              />

              <input
                className="input md:col-span-3"
                placeholder="Address line 2 (optional)"
                value={editAddr?.line2 || ''}
                onChange={e => setEditAddr({ ...editAddr, line2: e.target.value })}
              />

              <input
                className="input"
                placeholder="City"
                value={editAddr?.city || ''}
                onChange={e => setEditAddr({ ...editAddr, city: e.target.value })}
              />
              <input
                className="input"
                placeholder="State"
                value={editAddr?.state || ''}
                onChange={e => setEditAddr({ ...editAddr, state: e.target.value })}
              />
              <input
                className="input"
                placeholder="Pincode"
                value={editAddr?.pincode || ''}
                onChange={e =>
                  setEditAddr({
                    ...editAddr,
                    pincode: (e.target.value || '').replace(/\D/g, '').slice(0, 6),
                  })
                }
              />
              <input
                className="input"
                placeholder="Country"
                value={editAddr?.country || 'India'}
                onChange={e => setEditAddr({ ...editAddr, country: e.target.value })}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="btn" disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

/* ------------------------ Documents ------------------------ */

function DocumentsTab({ id }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [type, setType] = useState('other')
  const [file, setFile] = useState(null)

  const canManage = useCan('patients.attachments.manage')
  const canView = useCan('patients.view')

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true); setErr('')
    try {
      const { data } = await API.get(`/patients/${id}/documents`)
      setFiles(data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [id, canView])

  useEffect(() => { load() }, [load])

  const upload = async () => {
    if (!file) return
    const fd = new FormData()
    fd.append('type', type)
    fd.append('file', file)
    await API.post(`/patients/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    setFile(null); setType('other'); load()
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-2xl border bg-gray-50 p-3">
          <div className="mb-2 text-sm font-medium">Upload document</div>
          <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="id">ID Proof</option>
              <option value="consent">Consent</option>
              <option value="report">Report</option>
              <option value="other">Other</option>
            </select>
            <label className="input flex items-center gap-2">
              <Image className="h-4 w-4 text-gray-400" />
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <span className="truncate text-gray-500">{file ? file.name : 'Choose file…'}</span>
            </label>
            <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={upload} disabled={!file}>
              <Upload className="h-4 w-4" /> Upload
            </button>
          </div>
        </div>
      )}

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* Cards (mobile) */}
      <div className="grid gap-3 sm:hidden">
        {loading && <div className="rounded-xl border bg-white p-4 text-center text-gray-500">Loading…</div>}
        {!loading && files.map((f, i) => (
          <div key={f.id} className="rounded-2xl border bg-white p-4 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2 text-sm">
              <FileIcon className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{f.filename}</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="capitalize">Type: {f.type}</div>
              <div>{(f.size / 1024).toFixed(1)} KB</div>
              <div className="col-span-2">{f.mime || '—'}</div>
            </div>
          </div>
        ))}
        {!loading && files.length === 0 && (
          <div className="rounded-xl border bg-white p-4 text-center text-gray-500">No documents</div>
        )}
      </div>

      {/* Table (md+) */}
      <div className="overflow-x-auto rounded-xl border bg-white hidden sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">#</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Filename</th>
              <th className="p-2 text-left">Size</th>
              <th className="p-2 text-left">MIME</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-4 text-center text-gray-500">Loading…</td></tr>}
            {!loading && files.map((f, i) => (
              <tr key={f.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 capitalize">{f.type}</td>
                <td className="p-2 flex items-center gap-2"><FileIcon className="h-4 w-4 text-gray-400" /> {f.filename}</td>
                <td className="p-2">{(f.size / 1024).toFixed(1)} KB</td>
                <td className="p-2">{f.mime || '—'}</td>
              </tr>
            ))}
            {!loading && files.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">No documents</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------ Consents ------------------------ */

function ConsentsTab({ id }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: 'general', text: '' })
  const [saving, setSaving] = useState(false)

  const canView = useCan('patients.consents.view')
  const canCreate = useCan('patients.consents.create')

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true); setErr('')
    try {
      const { data } = await API.get(`/patients/${id}/consents`)
      setItems(data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to load consents')
    } finally {
      setLoading(false)
    }
  }, [id, canView])

  useEffect(() => { load() }, [load])

  const create = async (e) => {
    e.preventDefault()
    if (!canCreate) return
    setSaving(true); setErr('')
    try {
      await API.post(`/patients/${id}/consents`, form)
      setOpen(false)
      setForm({ type: 'general', text: '' })
      load()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to create consent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Consents
        </div>
        {canCreate && (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95"
            onClick={() => setOpen(true)}
          >
            <FilePlus2 className="h-4 w-4" /> New Consent
          </button>
        )}
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* Cards (mobile) */}
      <div className="grid gap-3 sm:hidden">
        {loading && <div className="rounded-xl border bg-white p-4 text-center text-gray-500">Loading…</div>}
        {!loading && items.map((c, i) => (
          <div key={c.id} className="rounded-2xl border bg-white p-4 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between text-sm">
              <div className="capitalize font-medium">{c.type}</div>
              <div className="text-xs text-gray-500">{c.captured_at ? format(new Date(c.captured_at), 'yyyy-MM-dd HH:mm') : '—'}</div>
            </div>
            <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{c.text}</div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border bg-white p-4 text-center text-gray-500">No consents</div>
        )}
      </div>

      {/* Table (md+) */}
      <div className="overflow-x-auto rounded-xl border bg-white hidden sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">#</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Text</th>
              <th className="p-2 text-left">Captured At</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="p-4 text-center text-gray-500">Loading…</td></tr>}
            {!loading && items.map((c, i) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 capitalize">{c.type}</td>
                <td className="p-2">{c.text}</td>
                <td className="p-2">{c.captured_at ? format(new Date(c.captured_at), 'yyyy-MM-dd HH:mm') : '—'}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-500">No consents</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Consent</h3>
              <button className="rounded-xl p-2 hover:bg-gray-50" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={create} className="space-y-3">
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="general">General Treatment</option>
                <option value="surgery">Surgery/Procedure</option>
                <option value="anesthesia">Anesthesia</option>
                <option value="data">Data Sharing</option>
                <option value="other">Other</option>
              </select>
              <textarea className="input min-h-[120px]" placeholder="Consent text / remarks"
                value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} required />
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------ ABHA Link ------------------------ */

function AbhaTab({ patient, onLinked }) {
  const [mobile, setMobile] = useState(patient.phone || '')
  const [txn, setTxn] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('start') // start -> sent -> linked
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const hasAbha = !!patient.abha_number

  const sendOtp = async () => {
    setLoading(true); setMsg('')
    try {
      const { data } = await API.post('/abha/generate', null, {
        params: {
          name: `${patient.first_name} ${patient.last_name || ''}`.trim(),
          dob: patient.dob || '',
          mobile
        }
      })
      setTxn(data.txnId)
      setStep('sent')
      setMsg(`OTP sent. (dev: ${data.debug_otp})`)
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setLoading(true); setMsg('')
    try {
      await API.post('/abha/verify-otp', null, {
        params: { txnId: txn, otp, patient_id: patient.id }
      })
      setStep('linked')
      setMsg('ABHA linked successfully.')
      onLinked?.()
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Invalid/expired OTP')
    } finally {
      setLoading(false)
    }
  }

  if (hasAbha) {
    return (
      <div className="rounded-xl border bg-green-50 p-4 text-green-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <div>
            <div className="font-semibold">ABHA Linked</div>
            <div className="text-sm">Number: {patient.abha_number}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">Link ABHA number for this patient (demo flow).</div>

      <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
        <label className="input">
          <span className="text-xs text-gray-500">Mobile</span>
          <input
            className="w-full border-0 bg-transparent p-0 outline-none"
            value={mobile}
            onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile"
          />
        </label>
        {step === 'start' && (
          <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={sendOtp} disabled={!mobile || loading}>
            <LinkIcon className="h-4 w-4" /> Send OTP
          </button>
        )}
      </div>

      {step === 'sent' && (
        <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
          <label className="input">
            <span className="text-xs text-gray-500">Enter OTP</span>
            <input
              className="w-full border-0 bg-transparent p-0 outline-none"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              inputMode="numeric"
            />
          </label>
          <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={verify} disabled={otp.length !== 6 || loading}>
            <CheckCircle2 className="h-4 w-4" /> Verify & Link
          </button>
        </div>
      )}

      {msg && (
        <div className={`rounded-xl border p-3 text-sm ${step === 'linked'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          {msg}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4 animate-spin" /> Processing…
        </div>
      )}
    </div>
  )
}
