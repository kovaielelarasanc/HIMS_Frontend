// FILE: src/lab/Orders.jsx
import { useEffect, useMemo, useState } from 'react'
import { listLisOrders, createLisOrder } from '../api/lab'
import { toast } from 'sonner'
import { Plus, Search, FlaskConical, Filter } from 'lucide-react'
import PatientPicker from '../opd/components/patientPicker'
import LabTestPicker from './components/LabTestPicker'
import { Link, useNavigate } from 'react-router-dom'
import PermGate from '../components/PermGate'
import OrderBadge from '../components/OrderBadge'
import PatientBadge from '../components/PatientBadge'
import StatusBadge from '../components/StatusBadge'

const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—')

const formatOrderNo = (id) => {
    if (!id) return '—'
    const s = String(id)
    return `LAB-${s.padStart(6, '0')}`
}

export default function Orders() {
    const [q, setQ] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    // create form
    const [patientId, setPatientId] = useState(null)
    const [testIds, setTestIds] = useState([])
    const [priority, setPriority] = useState('routine')

    // advanced filters (client-side)
    const [statusFilter, setStatusFilter] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')

    const navigate = useNavigate()

    const fetchRows = async () => {
        setLoading(true)
        try {
            // keep API simple; we’ll filter client-side
            const { data } = await listLisOrders({ page_size: 200 })
            setRows(Array.isArray(data) ? data : data?.items || [])
        } catch (e) {
            console.error(e)
            toast.error('Failed to load orders')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRows()
    }, [])

    const onCreate = async () => {
        if (!patientId || testIds.length === 0) {
            toast.error('Select patient and at least one test')
            return
        }
        try {
            const { data } = await createLisOrder({
                patient_id: patientId,
                priority,
                test_ids: testIds,
            })
            toast.success('Order created')
            setCreateOpen(false)
            setPatientId(null)
            setTestIds([])
            setPriority('routine')
            const orderId = data?.id || data?.order_id
            if (orderId) {
                navigate(`/lab/orders/${orderId}`)
            } else {
                fetchRows()
            }
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Create failed')
        }
    }

    // client-side advanced filtering
    const filteredRows = useMemo(() => {
        return rows.filter((o) => {
            const search = (q || '').trim().toLowerCase()
            if (search) {
                const name =
                    o.patient?.full_name ||
                    o.patient?.first_name ||
                    '' + o.patient?.last_name ||
                    ''
                const uhid = o.patient?.uhid || ''
                const labNo = formatOrderNo(o.id)
                const haystack = `${name} ${uhid} ${labNo}`.toLowerCase()
                if (!haystack.includes(search)) return false
            }

            if (statusFilter !== 'all') {
                if ((o.status || '').toLowerCase() !== statusFilter) return false
            }

            if (priorityFilter !== 'all') {
                if ((o.priority || '').toLowerCase() !== priorityFilter) return false
            }

            if (fromDate || toDate) {
                const created = o.created_at || o.createdAt
                if (!created) return false
                const d = new Date(created).setHours(0, 0, 0, 0)

                if (fromDate) {
                    const fd = new Date(fromDate).setHours(0, 0, 0, 0)
                    if (d < fd) return false
                }
                if (toDate) {
                    const td = new Date(toDate).setHours(0, 0, 0, 0)
                    if (d > td) return false
                }
            }

            return true
        })
    }, [rows, q, statusFilter, priorityFilter, fromDate, toDate])

    const total = filteredRows.length

    return (
        <div className="p-3 md:p-6 text-black space-y-4">
            {/* HEADER */}
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-sky-600" />
                    <div>
                        <h1 className="text-lg md:text-xl font-semibold">
                            Lab Orders
                        </h1>
                        <p className="text-xs text-gray-500">
                            Create, track, and finalize LIS orders (NABH aligned)
                        </p>
                    </div>
                </div>
                <PermGate anyOf={['lab.orders.create', 'orders.lab.create']}>
                    <button
                        className="btn-primary flex items-center gap-1 text-sm"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">New Lab Order</span>
                        <span className="sm:hidden">New</span>
                    </button>
                </PermGate>
            </header>

            {/* SEARCH + FILTERS */}
            <section className="rounded-xl border bg-white p-3 md:p-4 space-y-3">
                {/* Search row */}
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            className="input pl-9 text-sm"
                            placeholder="Search by UHID, patient name, or Lab No (e.g., LAB-000123)"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={fetchRows}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                        <Filter className="h-4 w-4" />
                        Refresh
                    </button>
                </div>

                {/* Advanced filters row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 text-xs">
                    <div>
                        <label className="block text-[11px] text-gray-500 mb-1">
                            Status
                        </label>
                        <select
                            className="input h-8 text-xs"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="ordered">Ordered</option>
                            <option value="collected">Collected</option>
                            <option value="in_progress">In Progress</option>
                            <option value="validated">Validated</option>
                            <option value="reported">Reported</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] text-gray-500 mb-1">
                            Priority
                        </label>
                        <select
                            className="input h-8 text-xs"
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="routine">Routine</option>
                            <option value="urgent">Urgent</option>
                            <option value="stat">STAT</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] text-gray-500 mb-1">
                            From Date
                        </label>
                        <input
                            type="date"
                            className="input h-8 text-xs"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] text-gray-500 mb-1">
                            To Date
                        </label>
                        <input
                            type="date"
                            className="input h-8 text-xs"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            type="button"
                            className="text-[11px] text-gray-500 underline"
                            onClick={() => {
                                setStatusFilter('all')
                                setPriorityFilter('all')
                                setFromDate('')
                                setToDate('')
                            }}
                        >
                            Clear filters
                        </button>
                    </div>
                </div>
            </section>

            {/* LIST – MOBILE CARDS + DESKTOP TABLE */}
            <section className="rounded-xl border bg-white p-2 md:p-0">
                {/* Mobile: Cards */}
                <div className="space-y-2 md:hidden">
                    {loading && (
                        <div className="px-3 py-4 text-xs text-gray-500">
                            Loading…
                        </div>
                    )}
                    {!loading && filteredRows.length === 0 && (
                        <div className="px-3 py-6 text-xs text-gray-500 text-center">
                            No lab orders found.
                        </div>
                    )}

                    {!loading &&
                        filteredRows.map((o) => (
                            <div
                                key={o.id}
                                className="border rounded-xl p-3 flex flex-col gap-2 bg-slate-50/60"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-slate-800">
                                        {formatOrderNo(o.id)}
                                    </div>
                                    <StatusBadge status={o.status} />
                                </div>

                                <div className="text-xs">
                                    <PatientBadge
                                        patient={o.patient}
                                        patientId={o.patient_id}
                                    />
                                </div>

                                <div className="flex justify-between text-[11px] text-gray-600">
                                    <div>
                                        <div>
                                            Priority:{' '}
                                            <span className="font-medium capitalize">
                                                {o.priority || 'routine'}
                                            </span>
                                        </div>
                                        <div>
                                            Created:{' '}
                                            <span>{fmtDT(o.created_at || o.createdAt)}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <button
                                            className="btn-ghost text-xs px-2 py-1"
                                            onClick={() => navigate(`/lab/orders/${o.id}`)}
                                        >
                                            Open
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs">Lab No</th>
                                <th className="px-3 py-2 text-left text-xs">Patient</th>
                                <th className="px-3 py-2 text-left text-xs">Priority</th>
                                <th className="px-3 py-2 text-left text-xs">Status</th>
                                <th className="px-3 py-2 text-left text-xs">Created</th>
                                <th className="px-3 py-2 text-right text-xs">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td
                                        className="px-3 py-3 text-sm text-gray-500"
                                        colSpan={6}
                                    >
                                        Loading…
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filteredRows.map((o) => (
                                    <tr key={o.id} className="border-t hover:bg-slate-50/80">
                                        <td className="px-3 py-2">
                                            {/* No raw id – use OrderBadge or formatted number */}
                                            <OrderBadge
                                                order={{
                                                    ...o,
                                                    display_no: formatOrderNo(o.id),
                                                }}
                                                to={`/lab/orders/${o.id}`}
                                            />
                                        </td>

                                        <td className="px-3 py-2">
                                            <PatientBadge
                                                patient={o.patient}
                                                patientId={o.patient_id}
                                            />
                                        </td>

                                        <td className="px-3 py-2 capitalize text-xs">
                                            {o.priority || 'routine'}
                                        </td>

                                        <td className="px-3 py-2">
                                            <StatusBadge status={o.status} />
                                        </td>

                                        <td className="px-3 py-2 text-xs">
                                            {fmtDT(o.created_at || o.createdAt)}
                                        </td>

                                        <td className="px-3 py-2 text-right">
                                            <Link
                                                to={`/lab/orders/${o.id}`}
                                                className="btn-ghost text-xs"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}

                            {!loading && filteredRows.length === 0 && (
                                <tr>
                                    <td
                                        className="px-3 py-6 text-center text-gray-500"
                                        colSpan={6}
                                    >
                                        No orders
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    className="px-3 py-2 text-xs text-gray-500"
                                    colSpan={6}
                                >
                                    Total: {total}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            {/* Create order drawer */}
            {createOpen && (
                <div className="fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-black/30"
                        onClick={() => setCreateOpen(false)}
                    />
                    <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-4 overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4">New Lab Order</h2>
                        <div className="space-y-4 text-sm">
                            <PatientPicker value={patientId} onChange={setPatientId} />
                            <LabTestPicker value={testIds} onChange={setTestIds} />
                            <div>
                                <label className="text-sm block mb-1">Priority</label>
                                <select
                                    className="input"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    <option value="routine">Routine</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="stat">STAT</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    className="btn-ghost"
                                    onClick={() => setCreateOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button className="btn-primary" onClick={onCreate}>
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
