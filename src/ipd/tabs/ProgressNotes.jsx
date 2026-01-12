import { useEffect, useState } from 'react'
import { listProgress, addProgress } from '../../api/ipd'
import PermGate from '../../components/PermGate'
import { formatIST } from '../components/timeZONE'

export default function ProgressNotes({ admissionId }) {
    const [rows, setRows] = useState([])
    const [err, setErr] = useState('')
    const [f, setF] = useState({ observation: '', plan: '' })

    const load = async () => {
        setErr('')
        try {
            const { data } = await listProgress(admissionId)
            setRows((data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load progress notes')
        }
    }
    useEffect(() => { load() }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        setErr('')
        try {
            await addProgress(admissionId, { observation: f.observation || '', plan: f.plan || '' })
            setF({ observation: '', plan: '' })
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to add progress note')
        }
    }

    return (
        <div className="space-y-3">
            <PermGate anyOf={['ipd.doctor']}>
                <form onSubmit={submit} className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-2 text-sm">
                    <div className="md:col-span-2 font-medium">New Progress Note</div>
                    <textarea className="input" rows={3} placeholder="Observation" value={f.observation} onChange={e => setF(s => ({ ...s, observation: e.target.value }))} />
                    <textarea className="input" rows={3} placeholder="Plan" value={f.plan} onChange={e => setF(s => ({ ...s, plan: e.target.value }))} />
                    <div className="md:col-span-2 flex justify-end"><button className="btn">Save</button></div>
                    {err && <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">{err}</div>}
                </form>
            </PermGate>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Observation</th>
                            <th className="px-3 py-2">Plan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(rows || []).map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{formatIST(new Date(r.created_at).toLocaleString())}</td>
                                <td className="px-3 py-2">{r.observation || '—'}</td>
                                <td className="px-3 py-2">{r.plan || '—'}</td>
                            </tr>
                        ))}
                        {!rows?.length && <tr><td className="p-3 text-sm text-gray-500" colSpan={3}>No progress notes</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
