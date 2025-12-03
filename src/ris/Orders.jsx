// src/ris/Orders.jsx
import { useEffect, useState } from 'react'
import { listRisOrders } from '../api/ris'
import OrderBadge from '../components/OrderBadge'
import PatientBadge from '../components/PatientBadge'
import StatusBadge from '../components/StatusBadge'
import ModalityBadge from '../components/ModalityBadge'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import PermGate from '../components/PermGate'
import RisOrderForm from './components/RisOrderForm'

function Modal({ open, onClose, children }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl">{children}</div>
            <button className="absolute inset-0 -z-10" onClick={onClose} aria-label="Close" />
        </div>
    )
}

export default function RisOrders() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')
    const [open, setOpen] = useState(false)

    useEffect(() => {
        let stop = false
        const run = async () => {
            setLoading(true)
            try {
                const { data } = await listRisOrders({ q })
                if (!stop) setRows(Array.isArray(data) ? data : [])
            } catch (e) {
                toast.error(e?.response?.data?.detail || 'Failed to load orders')
            } finally {
                if (!stop) setLoading(false)
            }
        }
        run()
        return () => { stop = true }
    }, [q])

    return (
        <div className="space-y-5 text-black">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">Radiology Orders</h1>
                    <p className="text-sm text-gray-500">Book, track, scan and report.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input className="input w-60" placeholder="Search test, UHID or name…" value={q} onChange={e => setQ(e.target.value)} />
                    <PermGate anyOf={['orders.ris.create', 'radiology.orders.create']}>
                        <button className="btn" onClick={() => setOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" /> New Order
                        </button>
                    </PermGate>
                </div>
            </header>

            <div className="rounded-xl border bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Order</th>
                            <th className="px-3 py-2 text-left">Patient</th>
                            <th className="px-3 py-2 text-left">Modality</th>
                            <th className="px-3 py-2 text-left">Priority</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Created</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (<tr><td className="px-3 py-3" colSpan={7}>Loading…</td></tr>)}
                        {!loading && rows.map(o => (
                            <tr key={o.id} className="border-t">
                                <td className="px-3 py-2">
                                    <OrderBadge order={o} to={`/ris/orders/${o.id}`} prefix="RAD" />
                                </td>
                                <td className="px-3 py-2">
                                    <PatientBadge patientId={o.patient_id} />
                                </td>
                                <td className="px-3 py-2"><ModalityBadge modality={o.modality} /></td>
                                <td className="px-3 py-2 capitalize">{o.priority || 'routine'}</td>
                                <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                                <td className="px-3 py-2">{new Date(o.created_at).toLocaleString()}</td>
                                <td className="px-3 py-2 text-right">
                                    <Link to={`/ris/orders/${o.id}`} className="btn-ghost">View</Link>
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={7}>No orders</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal open={open} onClose={() => setOpen(false)}>
                <RisOrderForm onClose={() => setOpen(false)} onCreated={() => setOpen(false)} />
            </Modal>
        </div>
    )
}
