// src/opd/Queue.jsx
import { useEffect, useMemo, useState, useRef } from 'react'
import { useAuth } from '../store/authStore'
import { fetchQueue, createVisit } from '../api/opd'
import { useNavigate } from 'react-router-dom'
import {
    Calendar, User2, Activity, ClipboardList, Stethoscope, Search,
    TimerReset, Download
} from 'lucide-react'

function parseError(err) {
    const d = err?.response?.data
    if (!d) return 'Failed'
    if (typeof d === 'string') return d
    if (d.detail) {
        if (typeof d.detail === 'string') return d.detail
        if (Array.isArray(d.detail)) {
            return d.detail.map(e => (e?.loc ? `${e.loc.join('.')}: ${e.msg}` : e.msg)).join(', ')
        }
    }
    return 'Error'
}

const STATUSES = ['booked', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled']

export default function Queue() {
    const me = useAuth(s => s.user)
    const navigate = useNavigate()

    const [doctorId, setDoctorId] = useState(null)
    const [forDate, setForDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')

    // advanced filters
    const [q, setQ] = useState('')
    const [status, setStatus] = useState('')           // one-of STATUSES or ''
    const [showMineOnly, setShowMineOnly] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(false)
    const timerRef = useRef(null)

    // default to current user as doctor (non-admin), but still allow viewing others
    useEffect(() => {
        if (me && !me.is_admin && me.id && doctorId == null) {
            setDoctorId(me.id)
        }
    }, [me])

    const load = async () => {
        setMsg('')
        if (!doctorId) { setRows([]); return }
        setLoading(true)
        try {
            const { data } = await fetchQueue({ doctor_user_id: doctorId, for_date: forDate })
            setRows(Array.isArray(data) ? data : [])
        } catch (err) {
            setMsg(parseError(err))
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [doctorId, forDate])

    // auto refresh every 15s
    useEffect(() => {
        if (!autoRefresh) { if (timerRef.current) clearInterval(timerRef.current); return }
        timerRef.current = setInterval(load, 15000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh, doctorId, forDate])

    // permissions/ownership logic for buttons (FE guard – BE still enforces)
    const isOwner = (a) => {
        if (!me) return false
        if (me.is_admin) return true
        // allow assigned doctor
        if (a?.doctor_user_id && a.doctor_user_id === me.id) return true
        // if backend provides who booked it, allow that user too
        if (a?.booked_by && a.booked_by === me.id) return true
        return false
    }

    // derived: waiting minutes (if in the past & not done/cancelled)
    const waitingMins = (a) => {
        try {
            if (!a?.time || !forDate) return null
            if (['completed', 'cancelled', 'no_show'].includes(a.status)) return null
            const start = new Date(`${forDate}T${a.time}:00`)
            const diff = Math.floor((Date.now() - start.getTime()) / 60000)
            return diff > 0 ? diff : null
        } catch { return null }
    }

    const filtered = useMemo(() => {
        let out = rows
        // search by uhid, name, phone
        if (q) {
            const s = q.toLowerCase()
            out = out.filter(a => {
                const p = a.patient || {}
                return (
                    String(p.uhid || '').toLowerCase().includes(s) ||
                    String(p.name || '').toLowerCase().includes(s) ||
                    String(p.phone || '').toLowerCase().includes(s)
                )
            })
        }
        if (status) out = out.filter(a => a.status === status)
        if (showMineOnly && me?.id) {
            out = out.filter(a => a.doctor_user_id === me.id || a.booked_by === me.id)
        }
        return out
    }, [rows, q, status, showMineOnly, me])

    // summary counters (on filtered set)
    const counters = useMemo(() => {
        const c = Object.fromEntries(STATUSES.map(s => [s, 0]))
        for (const a of filtered) { if (c[a.status] != null) c[a.status]++ }
        return c
    }, [filtered])

    // actions
    const startVisit = async (a) => {
        try {
            if (!a?.appointment_id) return
            const { data } = await createVisit({ appointment_id: a.appointment_id })
            if (data?.id) navigate(`/opd/visit/${data.id}`)
            else { setMsg('Could not start visit'); await load() }
        } catch (err) {
            setMsg(parseError(err))
        }
    }
    const openVisit = (a) => {
        if (!a?.visit_id) { setMsg('No visit created yet for this appointment'); return }
        navigate(`/opd/visit/${a.visit_id}`)
    }

    // export CSV (filtered)
    const exportCsv = () => {
        const cols = ['time', 'status', 'uhid', 'patient', 'phone', 'purpose']
        const lines = [cols.join(',')]
        filtered.forEach(a => {
            const p = a.patient || {}
            const row = [
                a.time || '',
                a.status || '',
                p.uhid || '',
                (p.name || '').replace(/,/g, ' '),
                p.phone || '',
                a.visit_purpose || '',
            ]
            lines.push(row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
        })
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `queue_${doctorId}_${forDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">OPD Queue</h1>
                <div className="text-sm text-gray-600">{msg}</div>
            </div>

            {/* Filters */}
            <div className="rounded-2xl border bg-white p-3">
                <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><User2 className="h-3.5 w-3.5" /> Doctor (User ID)</label>
                        <input className="input" placeholder="Enter doctor user id" value={doctorId || ''} onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Date</label>
                        <input type="date" className="input" value={forDate} onChange={e => setForDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><Search className="h-3.5 w-3.5" /> Search</label>
                        <input className="input" placeholder="UHID / name / phone" value={q} onChange={e => setQ(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-end">
                        <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="">All statuses</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                        <button className="btn" onClick={load} disabled={!doctorId || loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={showMineOnly} onChange={e => setShowMineOnly(e.target.checked)} />
                            Show mine only
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                            Auto-refresh
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="btn-outline flex items-center gap-2" onClick={exportCsv} title="Export current view to CSV">
                            <Download className="h-4 w-4" /> Export
                        </button>
                        <button type="button" className="px-3 py-2 rounded-xl border flex items-center gap-2" onClick={load} title="Force refresh">
                            <TimerReset className="h-4 w-4" /> Reload
                        </button>
                    </div>
                </div>

                {/* counters */}
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                    {STATUSES.map(s => (
                        <div key={s} className="rounded-xl border px-2 py-1 text-center">
                            <span className="font-medium">{s.replace('_', ' ')}</span>: {counters[s] || 0}
                        </div>
                    ))}
                </div>
            </div>

            {/* Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(a => {
                    const canAct = isOwner(a)
                    const wait = waitingMins(a)
                    return (
                        <div key={a.appointment_id} className="rounded-2xl border bg-white p-4 shadow-sm">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="text-sm font-semibold">{a.patient?.uhid || a.patient?.id} — {a.patient?.name}</div>
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{a.time}</span>
                            </div>

                            <div className="text-xs text-gray-600 space-y-1">
                                <div className="flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5" /> Purpose: {a.visit_purpose || 'Consultation'}</div>
                                <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Status: <span className="font-medium">{a.status}</span></div>
                                {/* <div className="flex items-center gap-2"><Stethoscope className="h-3.5 w-3.5" /> Vitals: {a.has_vitals ? <span className="text-emerald-700">Registered</span> : <span className="text-rose-700">Not registered</span>}</div> */}
                                {/* {wait != null && <div className="text-[11px] text-amber-700">Waiting ~ {wait} min</div>} */}
                            </div>

                            {canAct && (
                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        className="btn"
                                        onClick={() => startVisit(a)}
                                        disabled={!a.appointment_id || a.status === 'completed' || a.status === 'cancelled'}
                                        title={(!a.appointment_id ? 'Missing appointment' : (['completed', 'cancelled'].includes(a.status) ? 'Visit is finished' : 'Start or continue visit'))}
                                    >
                                        Start / Continue
                                    </button>
                                    <button
                                        className="btn-outline"
                                        onClick={() => openVisit(a)}
                                        disabled={!a.visit_id}
                                        title={a.visit_id ? 'Open existing visit' : 'No visit yet'}
                                    >
                                        Open Visit
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })}

                {!loading && filtered.length === 0 && (
                    <div className="text-sm text-gray-500">No appointments.</div>
                )}
            </div>
        </div>
    )
}
