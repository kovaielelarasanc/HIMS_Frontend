import { useEffect, useState } from 'react'
import { listIO, addIO } from '../../api/ipd'
import PermGate from '../../components/PermGate'

export default function IntakeOutput({ admissionId }) {
    const [rows, setRows] = useState([])
    const [err, setErr] = useState('')
    const [f, setF] = useState({
        recorded_at: '',
        intake_ml: '',
        urine_ml: '',
        drains_ml: '',
        stools_count: '',
        remarks: '',
    })

    const load = async () => {
        setErr('')
        try {
            const { data } = await listIO(admissionId)
            setRows((data || []).sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)))
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load I/O')
        }
    }
    useEffect(() => { load() }, [admissionId])

    const toISO = v => (!v ? undefined : (v.length === 16 ? `${v}:00` : v))

    const submit = async (e) => {
        e.preventDefault()
        setErr('')
        try {
            const payload = {
                recorded_at: toISO(f.recorded_at),
                intake_ml: f.intake_ml ? Number(f.intake_ml) : 0,
                urine_ml: f.urine_ml ? Number(f.urine_ml) : 0,
                drains_ml: f.drains_ml ? Number(f.drains_ml) : 0,
                stools_count: f.stools_count ? Number(f.stools_count) : 0,
                remarks: f.remarks || '',
            }
            await addIO(admissionId, payload)
            setF({ recorded_at: '', intake_ml: '', urine_ml: '', drains_ml: '', stools_count: '', remarks: '' })
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to add I/O')
        }
    }

    return (
        <div className="space-y-3">
            <PermGate anyOf={['ipd.nursing']}>
                <form onSubmit={submit} className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-6 text-sm">
                    <div className="md:col-span-6 font-medium">Record Intake / Output</div>
                    <input type="datetime-local" className="input" value={f.recorded_at} onChange={e => setF(s => ({ ...s, recorded_at: e.target.value }))} />
                    <input className="input" placeholder="Intake (ml)" value={f.intake_ml} onChange={e => setF(s => ({ ...s, intake_ml: e.target.value }))} />
                    <input className="input" placeholder="Urine (ml)" value={f.urine_ml} onChange={e => setF(s => ({ ...s, urine_ml: e.target.value }))} />
                    <input className="input" placeholder="Drains (ml)" value={f.drains_ml} onChange={e => setF(s => ({ ...s, drains_ml: e.target.value }))} />
                    <input className="input" placeholder="Stools count" value={f.stools_count} onChange={e => setF(s => ({ ...s, stools_count: e.target.value }))} />
                    <input className="input md:col-span-2" placeholder="Remarks" value={f.remarks} onChange={e => setF(s => ({ ...s, remarks: e.target.value }))} />
                    <div className="md:col-span-6 flex justify-end"><button className="btn">Save</button></div>
                    {err && <div className="md:col-span-6 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">{err}</div>}
                </form>
            </PermGate>

            <div className="rounded-xl border overflow-x-auto">
                <table className="min-w-[680px] w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Intake</th>
                            <th className="px-3 py-2">Urine</th>
                            <th className="px-3 py-2">Drains</th>
                            <th className="px-3 py-2">Stools</th>
                            <th className="px-3 py-2">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(rows || []).map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{new Date(r.recorded_at).toLocaleString()}</td>
                                <td className="px-3 py-2">{r.intake_ml}</td>
                                <td className="px-3 py-2">{r.urine_ml}</td>
                                <td className="px-3 py-2">{r.drains_ml}</td>
                                <td className="px-3 py-2">{r.stools_count}</td>
                                <td className="px-3 py-2">{r.remarks || '—'}</td>
                            </tr>
                        ))}
                        {!rows?.length && <tr><td className="p-3 text-sm text-gray-500" colSpan={6}>No I/O entries</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
