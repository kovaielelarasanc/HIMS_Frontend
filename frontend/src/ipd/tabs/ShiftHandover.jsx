import { useEffect, useState } from 'react'
import { listHandovers, addHandover } from '../../api/ipd'
import PermGate from '../../components/PermGate'

export default function ShiftHandover({ admissionId }) {
    const [rows, setRows] = useState([])
    const [err, setErr] = useState('')
    const [f, setF] = useState({
        vital_signs: '',
        procedure_undergone: '',
        todays_diagnostics: '',
        current_condition: '',
        recent_changes: '',
        ongoing_treatment: '',
        possible_changes: '',
        other_info: '',
    })

    const load = async () => {
        setErr('')
        try {
            const { data } = await listHandovers(admissionId)
            setRows((data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load handovers')
        }
    }
    useEffect(() => { load() }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        setErr('')
        try {
            await addHandover(admissionId, { ...f })
            setF({ vital_signs: '', procedure_undergone: '', todays_diagnostics: '', current_condition: '', recent_changes: '', ongoing_treatment: '', possible_changes: '', other_info: '' })
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to add handover')
        }
    }

    return (
        <div className="space-y-3">
            <PermGate anyOf={['ipd.nursing']}>
                <form onSubmit={submit} className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-2 text-sm">
                    <div className="md:col-span-2 font-medium">Shift Handover</div>
                    <input className="input" placeholder="Vital signs" value={f.vital_signs} onChange={e => setF(s => ({ ...s, vital_signs: e.target.value }))} />
                    <input className="input" placeholder="Procedure undergone" value={f.procedure_undergone} onChange={e => setF(s => ({ ...s, procedure_undergone: e.target.value }))} />
                    <input className="input md:col-span-2" placeholder="Today's diagnostics/procedures" value={f.todays_diagnostics} onChange={e => setF(s => ({ ...s, todays_diagnostics: e.target.value }))} />
                    <input className="input" placeholder="Current condition" value={f.current_condition} onChange={e => setF(s => ({ ...s, current_condition: e.target.value }))} />
                    <input className="input" placeholder="Recent changes" value={f.recent_changes} onChange={e => setF(s => ({ ...s, recent_changes: e.target.value }))} />
                    <input className="input" placeholder="Ongoing treatment" value={f.ongoing_treatment} onChange={e => setF(s => ({ ...s, ongoing_treatment: e.target.value }))} />
                    <input className="input" placeholder="Possible changes/complications" value={f.possible_changes} onChange={e => setF(s => ({ ...s, possible_changes: e.target.value }))} />
                    <input className="input md:col-span-2" placeholder="Other info" value={f.other_info} onChange={e => setF(s => ({ ...s, other_info: e.target.value }))} />
                    <div className="md:col-span-2 flex justify-end"><button className="btn">Save</button></div>
                    {err && <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">{err}</div>}
                </form>
            </PermGate>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Vitals</th>
                            <th className="px-3 py-2">Procedure</th>
                            <th className="px-3 py-2">Diagnostics</th>
                            <th className="px-3 py-2">Condition</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(rows || []).map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                                <td className="px-3 py-2">{r.vital_signs || '—'}</td>
                                <td className="px-3 py-2">{r.procedure_undergone || '—'}</td>
                                <td className="px-3 py-2">{r.todays_diagnostics || '—'}</td>
                                <td className="px-3 py-2">{r.current_condition || '—'}</td>
                            </tr>
                        ))}
                        {!rows?.length && <tr><td className="p-3 text-sm text-gray-500" colSpan={5}>No handovers</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
