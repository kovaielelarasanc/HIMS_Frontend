// src/ipd/tabs/BedCharges.jsx
import { useEffect, useMemo, useState } from 'react'
import { previewBedCharges, getAdmission, listBeds } from '../../api/ipd'
import { useCan } from '../../hooks/usePerm'

export default function BedCharges({ admissionId /* canWrite is not needed here */ }) {
    const canView = useCan('ipd.view') || useCan('ipd.manage') // safety; page already gates ipd.view
    const [from_date, setFromDate] = useState('')
    const [to_date, setToDate] = useState('')
    const [data, setData] = useState(null)
    const [err, setErr] = useState('')
    const [beds, setBeds] = useState([])

    // bedId -> code map
    const bedCodeById = useMemo(() => {
        const m = new Map()
        for (const b of beds || []) m.set(b.id, b.code)
        return m
    }, [beds])

    useEffect(() => {
        let alive = true
            ; (async () => {
                try {
                    // preload beds for code lookup
                    const b = await listBeds()
                    if (alive) setBeds(b?.data || [])
                } catch { /* ignore */ }

                // default date range: admitted_at → today
                try {
                    const { data: a } = await getAdmission(admissionId)
                    if (!alive) return
                    const start = a?.admitted_at ? new Date(a.admitted_at).toISOString().slice(0, 10) : ''
                    const today = new Date().toISOString().slice(0, 10)
                    setFromDate(start)
                    setToDate(today)
                } catch { /* ignore */ }
            })()
        return () => { alive = false }
    }, [admissionId])

    const run = async () => {
        setErr(''); setData(null)
        try {
            const { data } = await previewBedCharges(admissionId, {
                ...(from_date ? { from_date } : {}),
                ...(to_date ? { to_date } : {}),
            })
            setData(data)
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to preview charges')
        }
    }

    if (!canView) {
        return <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">Access denied (need ipd.view).</div>
    }

    return (
        <div className="space-y-3">
            <div className="rounded-xl border bg-white p-3 grid gap-3 md:grid-cols-5 text-sm">
                <div className="md:col-span-5 font-medium">Bed Charge Preview</div>

                <div>
                    <label className="text-xs text-gray-500">From</label>
                    <input type="date" className="input" value={from_date} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div>
                    <label className="text-xs text-gray-500">To</label>
                    <input type="date" className="input" value={to_date} onChange={e => setToDate(e.target.value)} />
                </div>
                <div className="md:col-span-3 flex items-end justify-end">
                    <button className="btn" onClick={run}>Preview</button>
                </div>

                {err && <div className="md:col-span-5 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">{err}</div>}
            </div>

            {data && (
                <div className="rounded-xl border overflow-hidden bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 bg-gray-50">
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Room Type</th>
                                <th className="px-3 py-2">Bed</th>
                                <th className="px-3 py-2">Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.days || []).map((d, idx) => (
                                <tr key={idx} className="border-t">
                                    <td className="px-3 py-2">{new Date(d.date).toLocaleDateString()}</td>
                                    <td className="px-3 py-2">{d.room_type || '—'}</td>
                                    <td className="px-3 py-2">{d.bed_id ? (bedCodeById.get(d.bed_id) || '—') : '—'}</td>
                                    <td className="px-3 py-2">{Number(d.rate).toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50 font-medium">
                                <td className="px-3 py-2" colSpan={3}>Total</td>
                                <td className="px-3 py-2">{Number(data.total_amount || 0).toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {!!data.missing_rate_days && (
                        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-t">
                            Note: {data.missing_rate_days} day(s) had no bed rate set for the room type.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
