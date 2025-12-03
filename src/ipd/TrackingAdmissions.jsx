import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAdmissions, listBeds, getPatient } from '../api/ipd'

export default function TrackingAdmissions() {
    const [rows, setRows] = useState([])
    const [beds, setBeds] = useState([])
    const [pmap, setPmap] = useState({})
    const [loading, setLoading] = useState(false)

    const code = (id) => `ADM-${String(id).padStart(6, '0')}`

    useEffect(() => {
        let alive = true
        const run = async () => {
            setLoading(true)
            const [a, b] = await Promise.all([
                listAdmissions({ status: 'admitted' }),
                listBeds()
            ])
            if (!alive) return
            setRows(a.data || [])
            setBeds(b.data || [])
            const ids = [...new Set((a.data || []).map(x => x.patient_id))].slice(0, 50)
            const m = {}
            await Promise.all(ids.map(async pid => {
                try { const { data } = await getPatient(pid); m[pid] = data?.uhid || `P-${pid}` } catch { m[pid] = `P-${pid}` }
            }))
            if (alive) setPmap(m)
            setLoading(false)
        }
        run()
        return () => { alive = false }
    }, [])

    if (loading) return <div className="p-4">Loading…</div>

    return (
        <div className="p-4 space-y-3 text-black">
            <h1 className="text-lg font-semibold">Tracking Admissions (All)</h1>
            <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">Admission</th>
                            <th className="px-3 py-2">Patient</th>
                            <th className="px-3 py-2">Bed</th>
                            <th className="px-3 py-2">Admitted</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {(rows || []).map(r => {
                            const bedCode = beds.find(b => b.id === r.current_bed_id)?.code || '—'
                            return (
                                <tr className="border-t" key={r.id}>
                                    <td className="px-3 py-2">{code(r.id)}</td>
                                    <td className="px-3 py-2">{pmap[r.patient_id] || `P-${r.patient_id}`}</td>
                                    <td className="px-3 py-2">{bedCode}</td>
                                    <td className="px-3 py-2">{new Date(r.admitted_at).toLocaleString()}</td>
                                    <td className="px-3 py-2">
                                        <Link to={`/ipd/admission/${r.id}`} state={{ admission: r }} className="text-blue-600">Open</Link>
                                    </td>
                                </tr>
                            )
                        })}
                        {!rows?.length && <tr><td className="p-4 text-sm text-gray-500" colSpan={5}>No active admissions</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
