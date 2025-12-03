// src/lab/Orders.jsx
import { useEffect, useMemo, useState } from 'react'
import { listLisOrders, createLisOrder } from '../api/lab'
import { toast } from 'sonner'
import { Plus, Search, FlaskConical } from 'lucide-react'
import PatientPicker from '../opd/components/patientPicker'
import LabTestPicker from './components/LabTestPicker'
import { Link, useNavigate } from 'react-router-dom'
import PermGate from '../components/PermGate'
import OrderBadge from '../components/OrderBadge'
import PatientBadge from '../components/PatientBadge'
import StatusBadge from '../components/StatusBadge' // optional

const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—')

export default function Orders() {
    const [q, setQ] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    // create form
    const [patientId, setPatientId] = useState(null)
    const [testIds, setTestIds] = useState([])
    const [priority, setPriority] = useState('routine')

    const fetchRows = async () => {
        setLoading(true)
        try {
            const { data } = await listLisOrders({ q, page_size: 100 })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load orders')
        } finally { setLoading(false) }
    }

    useEffect(() => { fetchRows() }, [q])

    const navigate = useNavigate()

    const onCreate = async () => {
        if (!patientId || testIds.length === 0) {
            toast.error('Select patient and at least one test')
            return
        }
        try {
            const { data } = await createLisOrder({ patient_id: patientId, priority, test_ids: testIds })
            toast.success('Order created')
            setCreateOpen(false)
            setPatientId(null)
            setTestIds([])
            setPriority('routine')
            navigate(`/lab/orders/${data?.id || data?.order_id}`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Create failed')
        }
    }

    const total = useMemo(() => rows.length, [rows])

    return (
        <div className="p-4 md:p-6 text-black">
            <header className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    <div>
                        <h1 className="text-xl font-semibold">Lab Orders</h1>
                        <p className="text-xs text-gray-500">Create, track, and report LIS orders</p>
                    </div>
                </div>
                <PermGate anyOf={['lab.orders.create', 'orders.lab.create']}>
                    <button className="btn-primary" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> New Order
                    </button>
                </PermGate>
            </header>

            <div className="mb-3">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        className="input pl-9"
                        placeholder="Search patient UHID/name or order id"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-xl border bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Order #</th>
                            <th className="px-3 py-2 text-left">Patient</th>
                            <th className="px-3 py-2 text-left">Priority</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Created</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td className="px-3 py-3 text-sm text-gray-500" colSpan={6}>Loading…</td>
                            </tr>
                        )}

                        {!loading && rows.map(o => (
                            <tr key={o.id} className="border-t">
                                <td className="px-3 py-2">
                                    {/* Friendly order number; no raw DB id shown */}
                                    <OrderBadge order={o} to={`/lab/orders/${o.id}`} />
                                </td>

                                <td className="px-3 py-2">
                                    <PatientBadge patient={o.patient} patientId={o.patient_id} />
                                </td>

                                <td className="px-3 py-2 capitalize">{o.priority || 'routine'}</td>

                                <td className="px-3 py-2">
                                    <StatusBadge status={o.status} />
                                </td>

                                <td className="px-3 py-2">{fmtDT(o.created_at || o.createdAt)}</td>

                                <td className="px-3 py-2 text-right">
                                    <Link to={`/lab/orders/${o.id}`} className="btn-ghost">View</Link>
                                </td>
                            </tr>
                        ))}

                        {!loading && rows.length === 0 && (
                            <tr>
                                <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>No orders</td>
                            </tr>
                        )}

                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="px-3 py-2 text-xs text-gray-500" colSpan={6}>Total: {total}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Create order drawer */}
            {createOpen && (
                <div className="fixed inset-0 z-40">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setCreateOpen(false)} />
                    <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-4 overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4">New Lab Order</h2>
                        <div className="space-y-4">
                            <PatientPicker value={patientId} onChange={setPatientId} />
                            <LabTestPicker value={testIds} onChange={setTestIds} />
                            <div>
                                <label className="text-sm">Priority</label>
                                <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
                                    <option value="routine">Routine</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="stat">STAT</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button className="btn-primary" onClick={onCreate}>Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
