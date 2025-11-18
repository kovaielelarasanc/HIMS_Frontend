// src/ipd/tabs/Vitals.jsx
import { useEffect, useState } from 'react'
import { listVitals, createVital } from '../../api/ipd'
import { useCan } from '../../hooks/usePerm'

export default function Vitals({ admissionId, canWrite }) {
    const canPost = canWrite ?? useCan('ipd.nursing')
    const [items, setItems] = useState([])
    const [f, setF] = useState({ recorded_at: '', bp_systolic: '', bp_diastolic: '', temp_c: '', rr: '', spo2: '', pulse: '' })
    const [err, setErr] = useState('')

    const load = async () => {
        try { const { data } = await listVitals(admissionId); setItems(data || []) }
        catch (e) { setErr(e?.response?.data?.detail || 'Failed to load') }
    }
    useEffect(() => { load() }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        setErr('')
        try {
            const payload = {
                recorded_at: f.recorded_at ? new Date(f.recorded_at).toISOString() : undefined,
                bp_systolic: f.bp_systolic ? Number(f.bp_systolic) : undefined,
                bp_diastolic: f.bp_diastolic ? Number(f.bp_diastolic) : undefined,
                temp_c: f.temp_c ? Number(f.temp_c) : undefined,
                rr: f.rr ? Number(f.rr) : undefined,
                spo2: f.spo2 ? Number(f.spo2) : undefined,
                pulse: f.pulse ? Number(f.pulse) : undefined,
            }
            await createVital(admissionId, payload)
            setF({ recorded_at: '', bp_systolic: '', bp_diastolic: '', temp_c: '', rr: '', spo2: '', pulse: '' })
            load()
        } catch (e1) { setErr(e1?.response?.data?.detail || 'Save failed') }
    }

    return (
        <div className="space-y-4">
            {!canPost && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
                    View-only. You don’t have permission to record vitals.
                </div>
            )}

            {canPost && (
                <form onSubmit={submit} className="rounded-xl border bg-white p-3 space-y-2">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="text-xs text-gray-500">Recorded at</label>
                            <input type="datetime-local" className="input" value={f.recorded_at} onChange={e => setF(s => ({ ...s, recorded_at: e.target.value }))} />
                        </div>
                        <input className="input" placeholder="BP (Systolic)" value={f.bp_systolic} onChange={e => setF(s => ({ ...s, bp_systolic: e.target.value }))} />
                        <input className="input" placeholder="BP (Diastolic)" value={f.bp_diastolic} onChange={e => setF(s => ({ ...s, bp_diastolic: e.target.value }))} />
                        <input className="input" placeholder="Temp °C" value={f.temp_c} onChange={e => setF(s => ({ ...s, temp_c: e.target.value }))} />
                        <input className="input" placeholder="RR" value={f.rr} onChange={e => setF(s => ({ ...s, rr: e.target.value }))} />
                        <input className="input" placeholder="SpO₂" value={f.spo2} onChange={e => setF(s => ({ ...s, spo2: e.target.value }))} />
                        <input className="input" placeholder="Pulse" value={f.pulse} onChange={e => setF(s => ({ ...s, pulse: e.target.value }))} />
                    </div>
                    <button className="btn">Record</button>
                </form>
            )}

            <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left">Time</th>
                            <th className="px-3 py-2 text-left">BP</th>
                            <th className="px-3 py-2 text-left">Temp</th>
                            <th className="px-3 py-2 text-left">RR</th>
                            <th className="px-3 py-2 text-left">SpO₂</th>
                            <th className="px-3 py-2 text-left">Pulse</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(items || []).map(v => (
                            <tr key={v.id} className="border-t">
                                <td className="px-3 py-2">{new Date(v.recorded_at).toLocaleString()}</td>
                                <td className="px-3 py-2">{[v.bp_systolic, v.bp_diastolic].filter(Boolean).join('/') || '—'}</td>
                                <td className="px-3 py-2">{v.temp_c ?? '—'}</td>
                                <td className="px-3 py-2">{v.rr ?? '—'}</td>
                                <td className="px-3 py-2">{v.spo2 ?? '—'}</td>
                                <td className="px-3 py-2">{v.pulse ?? '—'}</td>
                            </tr>
                        ))}
                        {(!items || items.length === 0) && (
                            <tr><td className="px-3 py-3 text-gray-500" colSpan={6}>No vitals yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 text-sm">{err}</div>}
        </div>
    )
}
