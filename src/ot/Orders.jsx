import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOtOrders } from '../api/ot'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import CreateOrderSheet from './CreateOrderSheet'
import PatientRef from '../components/PatientRef'
import { useCan } from '../hooks/usePerm'

const STATUSES = ['planned', 'scheduled', 'in_progress', 'completed', 'cancelled']

const fmtDT = (s) => {
    if (!s) return '—'
    try {
        const d = new Date(s)
        return d.toLocaleString()
    } catch { return s }
}

export default function OtOrders() {
    const [rows, setRows] = useState([])
    const [status, setStatus] = useState('planned')
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [openCreate, setOpenCreate] = useState(false)

    const canCreate = useCan('ot.cases.create') || useCan('ipd.manage')

    const fetchRows = async () => {
        setLoading(true)
        try {
            const params = { status, limit: 200 }
            if (q) params.q = q
            const { data } = await listOtOrders(params)
            setRows(Array.isArray(data) ? data : [])
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to load OT orders')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRows()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    const total = useMemo(() => rows.length, [rows])

    return (
        <div className="p-4 space-y-6 text-black">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">OT Orders</h1>
                    <p className="text-xs text-gray-500">Plan, schedule and track surgical cases</p>
                </div>
                <div className="flex items-center gap-2">
                    {canCreate && (
                        <button className="btn" onClick={() => setOpenCreate(true)}>
                            <Plus className="h-4 w-4 mr-2" /> New OT Order
                        </button>
                    )}
                </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        className="input pl-9"
                        placeholder="Search text (test name/code not indexed here, use status filters)"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchRows()}
                    />
                </div>
                <div className="flex gap-2">
                    <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn-ghost" onClick={fetchRows}>Refresh</button>
                </div>
            </div>

            <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Case #</th>
                            <th className="px-3 py-2 text-left">Patient</th>
                            <th className="px-3 py-2 text-left">Surgery</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Scheduled</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td className="px-3 py-3" colSpan={6}>Loading…</td></tr>
                        )}
                        {!loading && rows.map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">#{r.id}</td>
                                <td className="px-3 py-2"><PatientRef id={r.patient_id} /></td>
                                <td className="px-3 py-2">{r.surgery_name || '—'}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{r.status}</span>
                                </td>
                                <td className="px-3 py-2">{fmtDT(r.scheduled_start)}</td>
                                <td className="px-3 py-2 text-right">
                                    <Link to={`/ot/orders/${r.id}`} className="btn-ghost">View</Link>
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={6}>No OT orders</td></tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="px-3 py-2 text-xs text-gray-500" colSpan={6}>Total: {total}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <CreateOrderSheet open={openCreate} onClose={() => setOpenCreate(false)} />
        </div>
    )
}
