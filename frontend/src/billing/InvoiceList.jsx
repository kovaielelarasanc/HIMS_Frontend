import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Loader2, Receipt, IndianRupee } from 'lucide-react'
import { listInvoices, createInvoice } from '../api/billing'
import PatientPicker from '../opd/components/patientPicker'
import { money, fmtDT, pid } from '../utils/format'
import PermGate from '../components/PermGate'

export default function InvoiceList() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [patientId, setPatientId] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listInvoices()
            setRows(data || [])
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load invoices')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const onCreate = async () => {
        if (!patientId) {
            toast.warning('Select a patient first')
            return
        }
        setCreating(true)
        try {
            const { data } = await createInvoice({ patient_id: patientId, context_type: null, context_id: null })
            toast.success('Invoice created')
            window.location.assign(`/billing/invoices/${data.id}`)
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Create failed')
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> Billing
                </h1>
                <div className="flex items-center gap-3">
                    <div className="w-72">
                        <PatientPicker value={patientId} onChange={setPatientId} />
                    </div>
                    <PermGate anyOf={['billing.create']}>
                        <button onClick={onCreate} disabled={creating} className="btn inline-flex items-center">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} New Invoice
                        </button>
                    </PermGate>
                </div>
            </header>

            <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Invoice #</th>
                            <th className="px-3 py-2 text-left">Patient</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Net</th>
                            <th className="px-3 py-2 text-left">Paid</th>
                            <th className="px-3 py-2 text-left">Balance</th>
                            <th className="px-3 py-2 text-left">Context</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (<tr><td className="px-3 py-6" colSpan={8}>Loading…</td></tr>)}
                        {!loading && rows.map(inv => (
                            <tr key={inv.id} className="border-t">
                                <td className="px-3 py-2 font-medium">#{inv.id}</td>
                                <td className="px-3 py-2">{pid(inv.patient_id)}</td>
                                <td className="px-3 py-2 capitalize">{inv.status}</td>
                                <td className="px-3 py-2">{money(inv.net_total)}</td>
                                <td className="px-3 py-2">{money(inv.amount_paid)}</td>
                                <td className="px-3 py-2">{money(inv.balance_due)}</td>
                                <td className="px-3 py-2">{inv.context_type ? `${inv.context_type}#${inv.context_id}` : '—'}</td>
                                <td className="px-3 py-2 text-right">
                                    <Link to={`/billing/invoices/${inv.id}`} className="btn-ghost inline-flex items-center">
                                        <IndianRupee className="h-4 w-4 mr-1" /> Open
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td className="px-3 py-8 text-center text-gray-500" colSpan={8}>No invoices</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
