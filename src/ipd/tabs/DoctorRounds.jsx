import { useEffect, useState } from 'react'
import { listRounds, addRound } from '../../api/ipd'
import PermGate from '../../components/PermGate'

export default function DoctorRounds({ admissionId }) {
    const [rows, setRows] = useState([])
    const [err, setErr] = useState('')
    const [notes, setNotes] = useState('')

    const load = async () => {
        setErr('')
        try {
            const { data } = await listRounds(admissionId)
            setRows((data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load rounds')
        }
    }
    useEffect(() => { load() }, [admissionId])

    const submit = async (e) => {
        e.preventDefault()
        setErr('')
        try {
            await addRound(admissionId, { notes: notes || '' })
            setNotes('')
            await load()
        } catch (e1) {
            setErr(e1?.response?.data?.detail || 'Failed to add round')
        }
    }

    return (
        <div className="space-y-3">
            <PermGate anyOf={['ipd.doctor']}>
                <form onSubmit={submit} className="rounded-xl border bg-white p-3 text-sm space-y-2">
                    <div className="font-medium">Add Round Note</div>
                    <textarea className="input" rows={3} placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
                    <div className="flex justify-end"><button className="btn">Save</button></div>
                    {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">{err}</div>}
                </form>
            </PermGate>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(rows || []).map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                                <td className="px-3 py-2">{r.notes || '—'}</td>
                            </tr>
                        ))}
                        {!rows?.length && <tr><td className="p-3 text-sm text-gray-500" colSpan={2}>No rounds</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
