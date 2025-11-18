import { useEffect, useState } from 'react'
import { searchPatients, recordVitals } from '../api/opd'
import { HeartPulse, Thermometer, Droplet, Ruler, Scale, Activity, Search } from 'lucide-react'

function parseError(err) {
    const d = err?.response?.data
    if (!d) return 'Failed'
    if (typeof d === 'string') return d
    if (d.detail) {
        if (typeof d.detail === 'string') return d.detail
        if (Array.isArray(d.detail)) {
            // pydantic error array -> "field: message"
            return d.detail.map(e => (e?.loc ? `${e.loc.join('.')}: ${e.msg}` : e.msg)).join(', ')
        }
    }
    return 'Validation error'
}

export default function Triage() {
    const [q, setQ] = useState('')
    const [list, setList] = useState([])
    const [patient, setPatient] = useState(null)

    const [form, setForm] = useState({
        height_cm: '', weight_kg: '', temp_c: '',
        pulse: '', rr: '', spo2: '', bp_systolic: '', bp_diastolic: '', notes: ''
    })

    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        const t = setTimeout(() => {
            if (!q) { setList([]); return }
            searchPatients(q).then(r => setList(r.data || []))
        }, 250)
        return () => clearTimeout(t)
    }, [q])

    const submit = async (e) => {
        e.preventDefault()
        if (!patient) { setMsg('Select a patient'); return }
        setSaving(true); setMsg('')
        try {
            // Convert numeric fields safely
            const payload = {
                height_cm: form.height_cm ? Number(form.height_cm) : undefined,
                weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
                temp_c: form.temp_c ? Number(form.temp_c) : undefined,
                pulse: form.pulse ? Number(form.pulse) : undefined,
                rr: form.rr ? Number(form.rr) : undefined,
                spo2: form.spo2 ? Number(form.spo2) : undefined,
                bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : undefined,
                bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : undefined,
                notes: form.notes || undefined,
            }
            await recordVitals(patient.id, payload)
            setMsg('Vitals saved')
            setForm({ height_cm: '', weight_kg: '', temp_c: '', pulse: '', rr: '', spo2: '', bp_systolic: '', bp_diastolic: '', notes: '' })
        } catch (err) {
            setMsg(parseError(err))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-semibold">Vitals (Triage)</h1>

            {/* Patient search / pick */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-2 text-sm font-semibold">Select patient</div>
                <div className="relative">
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-gray-400" />
                        <input className="input w-full" placeholder="Search by UHID, name, phone…" value={q} onChange={e => setQ(e.target.value)} />
                    </div>
                    {q && list.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
                            {list.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { setPatient(p); setQ(`${p.uhid} — ${p.first_name} ${p.last_name || ''}`) }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                >
                                    <div className="font-medium">{p.uhid} — {p.first_name} {p.last_name || ''}</div>
                                    <div className="text-xs text-gray-500">{p.phone || p.email || ''}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {patient && (
                    <div className="mt-2 rounded-xl border bg-emerald-50 px-3 py-2 text-sm">
                        Selected: <span className="font-medium">{patient.uhid}</span> — {patient.first_name} {patient.last_name || ''}
                    </div>
                )}
            </div>

            {/* Vitals form */}
            <form onSubmit={submit} className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm font-semibold">Enter vitals</div>
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> Height (cm)</label>
                        <input className="input" value={form.height_cm} onChange={e => setForm({ ...form, height_cm: e.target.value.replace(/[^\d.]/g, '') })} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><Scale className="h-3.5 w-3.5" /> Weight (kg)</label>
                        <input className="input" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value.replace(/[^\d.]/g, '') })} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><Thermometer className="h-3.5 w-3.5" /> Temp (°C)</label>
                        <input className="input" value={form.temp_c} onChange={e => setForm({ ...form, temp_c: e.target.value.replace(/[^\d.]/g, '') })} />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Pulse (bpm)</label>
                        <input className="input" value={form.pulse} onChange={e => setForm({ ...form, pulse: e.target.value.replace(/[^\d]/g, '') })} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600">Respiratory Rate (rr)</label>
                        <input className="input" value={form.rr} onChange={e => setForm({ ...form, rr: e.target.value.replace(/[^\d]/g, '') })} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600 flex items-center gap-1"><Droplet className="h-3.5 w-3.5" /> SpO₂ (%)</label>
                        <input className="input" value={form.spo2} onChange={e => setForm({ ...form, spo2: e.target.value.replace(/[^\d]/g, '') })} />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-gray-600">BP Systolic</label>
                        <input className="input" value={form.bp_systolic} onChange={e => setForm({ ...form, bp_systolic: e.target.value.replace(/[^\d]/g, '') })} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-600">BP Diastolic</label>
                        <input className="input" value={form.bp_diastolic} onChange={e => setForm({ ...form, bp_diastolic: e.target.value.replace(/[^\d]/g, '') })} />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                        <label className="text-xs text-gray-600">Notes</label>
                        <textarea className="input min-h-[80px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">{msg}</div>
                    <button className="btn" disabled={!patient || saving}>{saving ? 'Saving…' : 'Save Vitals'}</button>
                </div>
            </form>
        </div>
    )
}
