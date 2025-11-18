// src/opd/Visit.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/authStore'
import {
    fetchVisit, updateVisit, savePrescription, esignPrescription,
    fetchMedicines, fetchLabTests, fetchRadiologyTests,
    createLabOrder, createRadOrder, updateAppointmentStatus,
} from '../api/opd'
import {
    CheckCircle2, XCircle, Ban, FileCheck2, ClipboardList, Stethoscope,
    Activity, HeartPulse, Thermometer, Scale, Ruler, Droplets, Clock3, FileDown
} from 'lucide-react'

/* ----------------------------- helpers/ui bits ---------------------------- */

function parseErr(e) {
    const d = e?.response?.data
    if (!d) return 'Failed'
    if (typeof d === 'string') return d
    if (d.detail) {
        if (typeof d.detail === 'string') return d.detail
        if (Array.isArray(d.detail)) {
            return d.detail.map(x => (x?.loc ? `${x.loc.join('.')}: ${x.msg}` : x.msg)).join(', ')
        }
    }
    return 'Error'
}

function StatusPill({ status }) {
    const s = (status || '').toLowerCase()
    const map = {
        booked: 'bg-blue-50 text-blue-700 ring-blue-100',
        checked_in: 'bg-amber-50 text-amber-700 ring-amber-100',
        in_progress: 'bg-purple-50 text-purple-700 ring-purple-100',
        completed: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        cancelled: 'bg-rose-50 text-rose-700 ring-rose-100',
        no_show: 'bg-gray-50 text-gray-600 ring-gray-100',
    }
    const cls = map[s] ?? 'bg-gray-50 text-gray-600 ring-gray-100'
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ${cls}`}>
            <Clock3 className="h-3.5 w-3.5" />
            {(status || '—').replace('_', ' ')}
        </span>
    )
}

/* --------------------------------- page ---------------------------------- */

export default function Visit() {
    const { id } = useParams()
    const navigate = useNavigate()
    const me = useAuth(s => s.user)

    const [v, setV] = useState(null)
    const [tab, setTab] = useState('soap')
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')
    const [statusMsg, setStatusMsg] = useState('')

    const load = async () => {
        const { data } = await fetchVisit(id)
        setV(data)
    }
    useEffect(() => { load() }, [id])

    const saveSOAP = async (e) => {
        e.preventDefault()
        setSaving(true); setErr('')
        try {
            await updateVisit(id, {
                chief_complaint: v.chief_complaint || '',
                symptoms: v.symptoms || '',
                soap_subjective: v.soap_subjective || '',
                soap_objective: v.soap_objective || '',
                soap_assessment: v.soap_assessment || '',
                plan: v.plan || '',
            })
            await load()
        } catch (e) {
            setErr(parseErr(e))
        } finally {
            setSaving(false)
        }
    }

    // Assigned doctor or admin can manually change status (checked_in remains auto on start visit)
    const canEditStatus = useMemo(() => {
        if (!v || !me) return false
        return !!(me.is_admin || me.id === v.doctor_id)
    }, [v, me])

    const setStatus = async (status) => {
        if (!v?.appointment_id) return
        setStatusMsg('')
        try {
            await updateAppointmentStatus(v.appointment_id, status)
            setStatusMsg(`Status set to ${status.replace('_', ' ')}`)
            await load()
        } catch (e) {
            setStatusMsg(parseErr(e))
        }
    }

    const printVisit = () => {
        // minimal — rely on browser print; replace with your own export later
        window.print()
    }

    if (!v) return <div>Loading…</div>

    return (
        <div className="space-y-4">
            {/* Header Card */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                        <div className="text-xs text-gray-500">UHID</div>
                        <div className="text-sm font-medium">{v.uhid}</div>
                        <div className="text-lg font-semibold">{v.patient_name}</div>
                        <div className="text-sm text-gray-500">Dept: <span className="font-medium">{v.department_name}</span></div>
                    </div>

                    <div className="space-y-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                            <StatusPill status={v.appointment_status} />
                            <button className="btn-outline hidden md:inline-flex" onClick={printVisit}>
                                <FileDown className="h-4 w-4" /> Print / PDF
                            </button>
                        </div>

                        {/* Doctor/Admin-only status actions */}
                        {canEditStatus && v.appointment_id && (
                            <div className="flex flex-wrap justify-end gap-2">
                                <button
                                    className="px-2 py-1 rounded-xl border text-xs hover:bg-gray-50"
                                    onClick={() => setStatus('completed')}
                                >
                                    <FileCheck2 className="mr-1 inline h-3.5 w-3.5" />
                                    Mark Completed
                                </button>
                                <button
                                    className="px-2 py-1 rounded-xl border text-xs hover:bg-gray-50"
                                    onClick={() => setStatus('cancelled')}
                                >
                                    <Ban className="mr-1 inline h-3.5 w-3.5" />
                                    Cancel
                                </button>
                                <button
                                    className="px-2 py-1 rounded-xl border text-xs hover:bg-gray-50"
                                    onClick={() => setStatus('no_show')}
                                >
                                    <XCircle className="mr-1 inline h-3.5 w-3.5" />
                                    No-show
                                </button>
                            </div>
                        )}

                        {statusMsg && <div className="text-[11px] text-gray-500">{statusMsg}</div>}

                        <div className="text-xs text-gray-500">
                            {v.visit_at} · Dr: <span className="font-medium">{v.doctor_name}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Card */}
            <div className="rounded-2xl border bg-white">
                {/* Tab Nav */}
                <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b bg-white/80 p-2 backdrop-blur">
                    {[
                        ['soap', 'SOAP Notes', <ClipboardList key="i" className="h-4 w-4" />],
                        ['vitals', 'Vitals', <Stethoscope key="i" className="h-4 w-4" />],
                        ['rx', 'Prescription', <CheckCircle2 key="i" className="h-4 w-4" />],
                        ['lab', 'Lab Orders', <Activity key="i" className="h-4 w-4" />],
                        ['ris', 'Radiology Orders', <Activity key="i" className="h-4 w-4" />],
                        ['summary', 'Summary', <FileCheck2 key="i" className="h-4 w-4" />],
                    ].map(([k, label, Icon]) => (
                        <button
                            key={k}
                            onClick={() => setTab(k)}
                            className={[
                                'px-3 py-2 text-sm rounded-xl inline-flex items-center gap-2',
                                tab === k ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                            ].join(' ')}
                        >
                            {Icon} {label}
                        </button>
                    ))}
                </div>

                {/* SOAP */}
                {tab === 'soap' && (
                    <form onSubmit={saveSOAP} className="p-4 grid gap-3 md:grid-cols-2">
                        {[
                            ['chief_complaint', 'Chief Complaint'],
                            ['symptoms', 'Symptoms'],
                            ['soap_subjective', 'Subjective'],
                            ['soap_objective', 'Objective'],
                            ['soap_assessment', 'Assessment'],
                            ['plan', 'Plan'],
                        ].map(([k, label]) => (
                            <div key={k} className="space-y-1 md:col-span-2">
                                <label className="text-sm">{label}</label>
                                <textarea
                                    className="input min-h-[90px]"
                                    value={v[k] || ''}
                                    onChange={e => setV(prev => ({ ...prev, [k]: e.target.value }))}
                                />
                            </div>
                        ))}
                        {err && (
                            <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {err}
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end">
                            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save Notes'}</button>
                        </div>
                    </form>
                )}

                {/* Vitals */}
                {tab === 'vitals' && (
                    <VitalsTab vitals={v.current_vitals} patientId={v.patient_id} />
                )}

                {/* Rx */}
                {tab === 'rx' && <PrescriptionTab visitId={id} />}

                {/* Orders */}
                {tab === 'lab' && <OrderTab visitId={id} kind="lab" />}
                {tab === 'ris' && <OrderTab visitId={id} kind="ris" />}

                {/* Summary */}
                {tab === 'summary' && <Summary v={v} />}
            </div>

            {/* Footer utility */}
            <div className="flex justify-between text-xs text-gray-500">
                <div>Episode: <span className="font-medium">{v.episode_id}</span></div>
                <button
                    className="hover:underline"
                    onClick={() => navigate(`/opd/triage?patient_id=${v.patient_id}`)}
                >
                    Go to Triage
                </button>
            </div>
        </div>
    )
}

/* --------------------------------- tabs ---------------------------------- */

function VitalsTab({ vitals, patientId }) {
    const navigate = useNavigate()
    const goTriage = () => navigate(`/opd/triage?patient_id=${patientId}`)

    if (!vitals) {
        return (
            <div className="p-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">No vitals recorded yet.</div>
                <button className="btn" onClick={goTriage}>Record Vitals</button>
            </div>
        )
    }

    const cards = [
        { label: 'Height', value: vitals.height_cm ? `${vitals.height_cm} cm` : '—', Icon: Ruler },
        { label: 'Weight', value: vitals.weight_kg ? `${vitals.weight_kg} kg` : '—', Icon: Scale },
        { label: 'BMI', value: vitals.bmi ?? '—', Icon: Activity },
        {
            label: 'BP',
            value: (vitals.bp_systolic && vitals.bp_diastolic) ? `${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg` : '—',
            Icon: HeartPulse
        },
        { label: 'Pulse', value: vitals.pulse ? `${vitals.pulse} bpm` : '—', Icon: HeartPulse },
        { label: 'RR', value: vitals.rr ? `${vitals.rr} /min` : '—', Icon: Activity },
        { label: 'Temp', value: vitals.temp_c ? `${vitals.temp_c} °C` : '—', Icon: Thermometer },
        { label: 'SpO₂', value: vitals.spo2 ? `${vitals.spo2} %` : '—', Icon: Droplets },
    ]

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    Recorded at:{' '}
                    <span className="font-medium">
                        {new Date(vitals.created_at).toLocaleString()}
                    </span>
                </div>
                <button className="btn" onClick={goTriage}>Record New Vitals</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map(({ label, value, Icon }) => (
                    <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Icon className="h-4 w-4" /> {label}
                        </div>
                        <div className="mt-1 text-lg font-semibold">{value}</div>
                    </div>
                ))}
            </div>

            {vitals.notes && (
                <div className="rounded-2xl border bg-amber-50 p-3 text-sm">
                    <span className="font-medium">Notes:</span> {vitals.notes}
                </div>
            )}
        </div>
    )
}

function PrescriptionTab({ visitId }) {
    const [q, setQ] = useState('')
    const [options, setOptions] = useState([])
    const [items, setItems] = useState([])
    const [msg, setMsg] = useState('')
    const [err, setErr] = useState('')

    useEffect(() => {
        let alive = true
        const run = async () => {
            try {
                const { data } = await fetchMedicines(q)
                if (alive) setOptions(data || [])
            } catch {
                if (alive) setOptions([])
            }
        }
        run()
        return () => { alive = false }
    }, [q])

    const add = (m) => {
        setItems(prev => [
            ...prev,
            {
                drug_name: m.name,
                strength: '',
                frequency: '',
                duration_days: '',
                quantity: 0,
                unit_price: Number(m.price_per_unit ?? 0),
                _form: m.form,
                _unit: m.unit,
            }
        ])
    }
    const setField = (i, k, val) => setItems(arr => arr.map((x, j) => j === i ? { ...x, [k]: val } : x))
    const remove = (i) => setItems(arr => arr.filter((_, j) => j !== i))

    const save = async () => {
        setMsg(''); setErr('')
        try {
            const payload = {
                notes: '',
                items: items.map(it => ({
                    drug_name: it.drug_name,
                    strength: it.strength || '',
                    frequency: it.frequency || '',
                    duration_days: Number(it.duration_days || 0),
                    quantity: Number(it.quantity || 0),
                    unit_price: Number(it.unit_price || 0),
                }))
            }
            await savePrescription(visitId, payload)
            setMsg('Prescription saved.')
        } catch (e) {
            setErr(parseErr(e))
        }
    }

    const sign = async () => {
        setMsg(''); setErr('')
        try {
            await esignPrescription(visitId, {})
            setMsg('e-Signed.')
        } catch (e) {
            setErr(parseErr(e))
        }
    }

    return (
        <div className="p-4 grid gap-4 md:grid-cols-2">
            {/* Left: search & add */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Search medicine</label>
                <input
                    className="input"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Type to search…"
                />
                <div className="max-h-64 overflow-y-auto rounded-xl border">
                    {options.map(m => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => add(m)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50"
                        >
                            <div className="text-sm font-medium">{m.name}</div>
                            <div className="text-xs text-gray-500">{m.form} — {m.unit} — ₹{m.price_per_unit}</div>
                        </button>
                    ))}
                    {options.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">No matches.</div>
                    )}
                </div>
            </div>

            {/* Right: current Rx */}
            <div className="space-y-2">
                <div className="text-sm font-medium">Prescription</div>
                <div className="grid gap-2">
                    {items.map((it, i) => (
                        <div key={i} className="rounded-2xl border p-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-semibold">{it.drug_name}</div>
                                    <div className="text-[11px] text-gray-500">{it._form || '—'} · {it._unit || '—'}</div>
                                </div>
                                <button className="text-xs text-rose-600 hover:underline" onClick={() => remove(i)}>
                                    Remove
                                </button>
                            </div>

                            <div className="mt-2 grid gap-2 sm:grid-cols-5">
                                <input className="input" placeholder="Strength" value={it.strength}
                                    onChange={e => setField(i, 'strength', e.target.value)} />
                                <input className="input" placeholder="Frequency" value={it.frequency}
                                    onChange={e => setField(i, 'frequency', e.target.value)} />
                                <input className="input" placeholder="Days" value={it.duration_days}
                                    onChange={e => setField(i, 'duration_days', e.target.value.replace(/\D/g, ''))} />
                                <input className="input" placeholder="Qty" value={it.quantity}
                                    onChange={e => setField(i, 'quantity', e.target.value.replace(/\D/g, ''))} />
                                <input className="input" placeholder="Unit Price" value={it.unit_price}
                                    onChange={e => setField(i, 'unit_price', e.target.value.replace(/[^\d.]/g, ''))} />
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="text-sm text-gray-500">No items yet.</div>
                    )}
                </div>

                {(msg || err) && (
                    <div className={`rounded-xl p-3 text-sm ${err ? 'bg-red-50 text-red-700 border border-red-200' : 'text-emerald-700'}`}>
                        {err || msg}
                    </div>
                )}

                <div className="flex gap-2 justify-end">
                    <button className="px-3 py-2 rounded-xl border" onClick={save}>Save</button>
                    <button className="btn" onClick={sign}>e-Sign</button>
                </div>
            </div>
        </div>
    )
}

function OrderTab({ visitId, kind }) {
    const [q, setQ] = useState('')
    const [options, setOptions] = useState([])
    const [msg, setMsg] = useState('')
    const [err, setErr] = useState('')

    useEffect(() => {
        let alive = true
        const run = async () => {
            try {
                const fn = kind === 'lab' ? fetchLabTests : fetchRadiologyTests
                const { data } = await fn(q)
                if (alive) setOptions(data || [])
            } catch {
                if (alive) setOptions([])
            }
        }
        run()
        return () => { alive = false }
    }, [q, kind])

    const order = async (t) => {
        setMsg(''); setErr('')
        try {
            // backend expects { test_ids: [id] }
            const payload = { test_ids: [t.id] }
            if (kind === 'lab') await createLabOrder(visitId, payload)
            else await createRadOrder(visitId, payload)
            setMsg('Order placed.')
        } catch (e) {
            setErr(parseErr(e))
        }
    }

    return (
        <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">{kind === 'lab' ? 'Lab' : 'Radiology'} tests</div>
                <input
                    className="input w-48"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Search…"
                />
            </div>

            {(msg || err) && (
                <div className={`mb-2 rounded-xl p-3 text-sm ${err ? 'bg-red-50 text-red-700 border border-red-200' : 'text-emerald-700'}`}>
                    {err || msg}
                </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
                {options.map(t => (
                    <div key={t.id} className="rounded-2xl border p-3">
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-gray-500">₹{t.price}</div>
                        <div className="mt-2 flex justify-end">
                            <button className="btn" onClick={() => order(t)}>Order</button>
                        </div>
                    </div>
                ))}
                {options.length === 0 && (
                    <div className="text-sm text-gray-500">No tests.</div>
                )}
            </div>
        </div>
    )
}

function Summary({ v }) {
    return (
        <div className="p-4 space-y-2 text-sm">
            <div><span className="font-medium">UHID:</span> {v.uhid}</div>
            <div><span className="font-medium">Doctor:</span> {v.doctor_name}</div>
            <div><span className="font-medium">Date/Time:</span> {v.visit_at}</div>
            <div><span className="font-medium">Status:</span> {(v.appointment_status || '—').replace('_', ' ')}</div>
            <div className="mt-2 text-gray-700">
                Use Print/PDF to export a summary with your letterhead.
            </div>
        </div>
    )
}
