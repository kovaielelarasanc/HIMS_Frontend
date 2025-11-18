// src/pages/opd/Appointments.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    fetchDepartments,
    fetchRolesByDepartment,
    fetchDepartmentUsers,
    searchPatients,
    getFreeSlots,
    createAppointment,
    fetchAppointments,
} from '../api/opd'
import { useToast } from '../components/Toast'
import { CalendarDays, Clock3, Stethoscope, User2, Search, CheckCircle2, XCircle } from 'lucide-react'

function formatDateISO(d) {
    const dt = d instanceof Date ? d : new Date(d)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}
function toDateTime(dateStr, hhmm) {
    const [H, M] = (hhmm || '00:00').split(':').map(n => parseInt(n || '0', 10))
    const dt = new Date(dateStr + 'T00:00:00')
    dt.setHours(H, M, 0, 0)
    return dt
}
const BLOCKING_STATUSES = new Set(['booked', 'checked_in', 'in_progress'])

function StatusPill({ status }) {
    const map = {
        booked: 'bg-blue-50 text-blue-700 ring-blue-100',
        checked_in: 'bg-amber-50 text-amber-700 ring-amber-100',
        in_progress: 'bg-purple-50 text-purple-700 ring-purple-100',
        completed: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        no_show: 'bg-gray-50 text-gray-600 ring-gray-100',
        cancelled: 'bg-rose-50 text-rose-700 ring-rose-100',
    }
    const cls = map[status] ?? map.booked
    return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ${cls}`}>{String(status || '').replace('_', ' ')}</span>
}

function VitalsTag({ has }) {
    return has ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" /> vitals done
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-100">
            <XCircle className="h-3.5 w-3.5" /> vitals pending
        </span>
    )
}

/** Department → Role → User (doctor) picker
 * onSelect({ doctorId, departmentId })
 */
function DeptRoleUserPicker({ value, onSelect }) {
    const [depts, setDepts] = useState([])
    const [deptId, setDeptId] = useState('')
    const [roles, setRoles] = useState([])
    const [roleId, setRoleId] = useState('')
    const [users, setUsers] = useState([])
    const [busy, setBusy] = useState(false)

    useEffect(() => { fetchDepartments().then(r => setDepts(r.data || [])) }, [])

    useEffect(() => {
        if (!deptId) { setRoles([]); setRoleId(''); setUsers([]); onSelect?.({ doctorId: null, departmentId: null }); return }
        setBusy(true)
        fetchRolesByDepartment(deptId)
            .then(r => setRoles(r.data || []))
            .finally(() => setBusy(false))
    }, [deptId])

    useEffect(() => {
        if (!deptId) { setUsers([]); return }
        setBusy(true)
        fetchDepartmentUsers(deptId, roleId || undefined)
            .then(r => setUsers(r.data || []))
            .finally(() => setBusy(false))
    }, [deptId, roleId])

    const onDept = (id) => {
        setDeptId(id)
        onSelect?.({ doctorId: null, departmentId: id ? Number(id) : null })
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Doctor selection</label>
            <div className="grid gap-2 md:grid-cols-3">
                <select className="input" value={deptId} onChange={e => onDept(e.target.value)}>
                    <option value="">Select department</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select className="input" value={roleId} onChange={e => setRoleId(e.target.value)} disabled={!deptId || busy}>
                    <option value="">All roles</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select
                    className="input"
                    value={value || ''}
                    onChange={e => onSelect?.({ doctorId: Number(e.target.value), departmentId: deptId ? Number(deptId) : null })}
                    disabled={!deptId || busy}
                >
                    <option value="">Select user</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
            </div>
        </div>
    )
}

export default function Appointments() {
    const toast = useToast()

    // Filters
    const [dateStr, setDateStr] = useState(() => formatDateISO(new Date()))
    const [doctorId, setDoctorId] = useState(null)
    const [departmentId, setDepartmentId] = useState(null)

    // Booking form
    const [patientQ, setPatientQ] = useState('')
    const [patientList, setPatientList] = useState([])
    const [patientId, setPatientId] = useState(null)
    const [purpose, setPurpose] = useState('Consultation')
    const [slots, setSlots] = useState([])   // [{start,end,status?}]
    const [slot, setSlot] = useState('')     // "HH:MM"

    // Data
    const [items, setItems] = useState([])   // appointment rows (for page list)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')
    const [dupAppt, setDupAppt] = useState(null) // active appointment for same patient/date (if any)

    const todayISO = formatDateISO(new Date())

    // Patient search
    useEffect(() => {
        const t = setTimeout(() => {
            if (!patientQ) { setPatientList([]); return }
            searchPatients(patientQ).then(r => setPatientList(r.data || []))
        }, 250)
        return () => clearTimeout(t)
    }, [patientQ])

    // Load slots for selected doctor/date
    useEffect(() => {
        setSlots([]); setSlot('')
        if (!doctorId || !dateStr) return
        const run = async () => {
            const { data } = await getFreeSlots(doctorId, dateStr)
            // Accept any of: {slots:[{start,end,status}]}, [{start,end}], ["HH:MM", ...]
            let raw = []
            if (data && Array.isArray(data.slots)) raw = data.slots
            else if (Array.isArray(data)) raw = data
            const norm = raw.map(s => {
                if (typeof s === 'string') return { start: s, end: '', status: 'free' }
                return { start: s.start, end: s.end || '', status: s.status || 'free' }
            })
            setSlots(norm)
        }
        run()
    }, [doctorId, dateStr])

    // Day’s list (filtered by doctor when chosen)
    const loadList = async () => {
        setLoading(true)
        try {
            const { data } = await fetchAppointments({ date_str: dateStr, doctor_id: doctorId || undefined })
            setItems(data || [])
        } finally { setLoading(false) }
    }
    useEffect(() => { loadList() }, [dateStr, doctorId])

    // 🔒 Duplicate booking check for same patient & date (across ALL doctors)
    useEffect(() => {
        const checkDup = async () => {
            setDupAppt(null)
            if (!patientId || !dateStr) return
            try {
                // Fetch all appointments for the date (no doctor filter), then match by patient
                const { data } = await fetchAppointments({ date_str: dateStr })
                const list = Array.isArray(data) ? data : []
                const match = list.find(a => {
                    const pid = a.patient_id ?? a.patientId ?? a.patient?.id
                    return pid === patientId && BLOCKING_STATUSES.has(a.status)
                })
                if (match) {
                    setDupAppt(match)
                    // Optional: toast once when found
                    toast.warn(`This patient already has an active appointment at ${match.slot_start}. Cancel or complete it before booking another.`)
                }
            } catch {
                /* ignore dup check errors */
            }
        }
        checkDup()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, dateStr])

    // Build fast lookup of booked slot starts for this doctor/date
    const bookedSet = useMemo(() => {
        const s = new Set()
        for (const row of items || []) {
            if ((doctorId ? row.doctor_user_id === doctorId : true) && row.status !== 'cancelled') {
                if (row.slot_start) s.add(row.slot_start)
            }
        }
        return s
    }, [items, doctorId])

    // Combine: backend status + booked + past-time for today
    const computedSlots = useMemo(() => {
        const now = new Date()
        return (slots || []).map(s => {
            let status = s.status || 'free'
            if (bookedSet.has(s.start)) status = 'booked'
            if (dateStr < todayISO) status = 'past'
            if (dateStr === todayISO) {
                const dt = toDateTime(dateStr, s.start)
                if (dt < now && status === 'free') status = 'past'
            }
            return { ...s, status }
        })
    }, [slots, bookedSet, dateStr, todayISO])

    // Guard changing to a past date
    const onDateChange = (v) => {
        if (v && v < todayISO) {
            toast.warn('Past dates are not allowed')
            setDateStr(todayISO)
            return
        }
        setDateStr(v || todayISO)
    }

    // Booking
    const book = async (e) => {
        e.preventDefault()
        setMsg('')

        if (!patientId || !doctorId || !departmentId || !slot) {
            setMsg('Please complete all fields')
            toast.warn('Please fill all the fields')
            return
        }
        // block past date/time
        if (dateStr < todayISO) {
            toast.warn('Cannot book on a past date')
            return
        }
        if (dateStr === todayISO && toDateTime(dateStr, slot) < new Date()) {
            toast.warn('Selected time is already past')
            return
        }
        // block if UI somehow let a non-free slot through
        const selected = computedSlots.find(s => s.start === slot)
        if (!selected || selected.status !== 'free') {
            toast.warn('Selected slot is not available')
            return
        }
        // 🔒 duplicate block
        if (dupAppt && BLOCKING_STATUSES.has(dupAppt.status)) {
            toast.error(`Duplicate booking blocked. Patient already has an active appointment at ${dupAppt.slot_start}.`)
            return
        }

        setSaving(true)
        try {
            await createAppointment({
                patient_id: patientId,
                department_id: departmentId,
                doctor_user_id: doctorId,
                date: dateStr,
                slot_start: slot,
                purpose: purpose || 'Consultation',
            })
            setMsg('Appointment booked.')
            toast.success('Appointment booked successfully')
            // reset form minimal
            setPatientQ(''); setPatientList([]); setPatientId(null)
            setPurpose('Consultation'); setSlot('')
            await loadList()
            // refresh slots
            const { data } = await getFreeSlots(doctorId, dateStr)
            const raw = data?.slots ?? data ?? []
            const norm = raw.map(s => (typeof s === 'string'
                ? { start: s, end: '', status: 'free' }
                : { start: s.start, end: s.end || '', status: s.status || 'free' }))
            setSlots(norm)
            setDupAppt(null) // safe to reset
        } catch (err) {
            const detail = err?.response?.data?.detail || err?.response?.data?.message || 'Booking failed'
            setMsg(detail)
            toast.error(detail)
        } finally { setSaving(false) }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-semibold">OPD Appointments</h1>
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-gray-500" />
                    <input
                        type="date"
                        className="input"
                        value={dateStr}
                        min={todayISO}
                        onChange={e => onDateChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Booking Card */}
            <form onSubmit={book} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" /> Book appointment
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <DeptRoleUserPicker
                        value={doctorId}
                        onSelect={({ doctorId: did, departmentId: depId }) => {
                            setDoctorId(did || null)
                            setDepartmentId(depId || null)
                        }}
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Patient</label>
                        <div className="relative">
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-gray-400" />
                                <input
                                    className="input w-full"
                                    placeholder="Search by UHID, name, phone…"
                                    value={patientQ}
                                    onChange={e => setPatientQ(e.target.value)}
                                />
                            </div>
                            {patientQ && patientList.length > 0 && (
                                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
                                    {patientList.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => { setPatientId(p.id); setPatientQ(`${p.uhid} — ${p.first_name} ${p.last_name || ''}`.trim()) }}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                        >
                                            <div className="font-medium">{p.uhid} — {p.first_name} {p.last_name || ''}</div>
                                            <div className="text-xs text-gray-500">{p.phone || p.email || ''}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Duplicate warning chip */}
                        {dupAppt && BLOCKING_STATUSES.has(dupAppt.status) && (
                            <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-100">
                                <Clock3 className="h-3.5 w-3.5" />
                                Patient already has an active appointment at <span className="font-semibold">{dupAppt.slot_start}</span> on this date.
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Purpose</label>
                        <input className="input" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Consultation" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Available slot</label>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {computedSlots.map(s => {
                                const disabled = s.status !== 'free'
                                const label = s.start
                                const cls = [
                                    'rounded-xl border px-2.5 py-1.5 text-sm',
                                    disabled ? 'opacity-40 cursor-not-allowed' : '',
                                    !disabled && (slot === s.start ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50')
                                ].join(' ')
                                const onClick = () => {
                                    if (disabled) {
                                        if (s.status === 'booked') toast.warn(`Slot ${s.start} is already booked`)
                                        else if (s.status === 'past') toast.warn(`Slot ${s.start} has already passed`)
                                        else toast.warn(`Slot ${s.start} is not available`)
                                        return
                                    }
                                    setSlot(s.start)
                                }
                                return (
                                    <button
                                        key={s.start}
                                        type="button"
                                        onClick={onClick}
                                        disabled={disabled}
                                        className={cls}
                                        title={s.status === 'booked' ? 'Booked' : s.status === 'past' ? 'Past time' : 'Free'}
                                    >
                                        <div className="flex items-center gap-1 justify-center">
                                            <Clock3 className="h-4 w-4" />
                                            <span>{label}</span>
                                        </div>
                                    </button>
                                )
                            })}
                            {(!computedSlots || computedSlots.length === 0) && (
                                <div className="col-span-3 sm:col-span-6 text-sm text-gray-500">No slots for the selected day.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-500">{msg}</div>
                    <button
                        className="btn"
                        disabled={saving || !patientId || !doctorId || !departmentId || !slot || (dupAppt && BLOCKING_STATUSES.has(dupAppt.status))}
                        title={dupAppt && BLOCKING_STATUSES.has(dupAppt.status) ? 'Duplicate booking blocked for this patient on this date' : ''}
                    >
                        {saving ? 'Booking…' : 'Book Appointment'}
                    </button>
                </div>
            </form>

            {/* Day’s Appointments — Card layout */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold">Today’s schedule</div>

                {loading ? (
                    <div className="text-sm text-gray-500">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="text-sm text-gray-500">No appointments.</div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map(row => (
                            <div key={row.id} className="rounded-2xl border p-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock3 className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-semibold">{row.slot_start} – {row.slot_end}</span>
                                    </div>
                                    <StatusPill status={row.status} />
                                </div>

                                <div className="space-y-1 text-sm">
                                    <div className="flex items-center gap-2">
                                        <User2 className="h-4 w-4 text-gray-500" />
                                        <span className="font-medium">{row.patient_name}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">UHID: <span className="font-medium">{row.uhid}</span></div>
                                    <div className="text-xs text-gray-500">Doctor: <span className="font-medium">{row.doctor_name}</span></div>
                                    <div className="text-xs text-gray-500">Department: <span className="font-medium">{row.department_name}</span></div>
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                    <VitalsTag has={row.vitals_registered} />
                                    <span className="text-[11px] text-gray-500">{row.purpose || 'Consultation'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
