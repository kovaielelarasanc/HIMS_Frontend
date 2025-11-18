import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
    ArrowLeft, Loader2, Plus, Pencil, Save, X, Trash2,
    Check, CreditCard, AlertOctagon
} from 'lucide-react'
import {
    getInvoice, addManualItem, updateInvoiceItem, voidInvoiceItem,
    bulkAddFromUnbilled, fetchUnbilledServices, finalizeInvoice, cancelInvoice, addPayment
} from '../api/billing'
import PermGate from '../components/PermGate'
import { money } from '../utils/format'
import UnbilledDrawer from './components/UnbilledDrawer'
import AddManualItemModal from './components/AddManualItemModal'
import PaymentModal from './components/PaymentModal'

export default function InvoiceDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const invoiceId = Number(id)

    const [inv, setInv] = useState(null)
    const [loading, setLoading] = useState(true)
    const [savingRowId, setSavingRowId] = useState(null)
    const [editRow, setEditRow] = useState(null) // item id
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [unbilled, setUnbilled] = useState([])
    const [pick, setPick] = useState({})
    const [showManual, setShowManual] = useState(false)
    const [showPay, setShowPay] = useState(false)

    const isDraft = inv?.status === 'draft'
    const isFinal = inv?.status === 'finalized'
    const isCancelled = inv?.status === 'cancelled'
    const anyOverlayOpen = drawerOpen || showManual || showPay
    useEffect(() => {
        const prev = document.body.style.overflow
        if (anyOverlayOpen) document.body.style.overflow = 'hidden'
        else document.body.style.overflow = prev || ''
        return () => { document.body.style.overflow = prev || '' }
    }, [anyOverlayOpen])
    const load = async () => {
        setLoading(true)
        try {
            const { data } = await getInvoice(invoiceId)
            setInv(data)
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Load failed')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [invoiceId])

    const openUnbilled = async () => {
        try {
            const { data } = await fetchUnbilledServices(inv.patient_id)
            setUnbilled(data || [])
            setPick({})
            setDrawerOpen(true)
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to fetch unbilled')
        }
    }

    const applyUnbilled = async () => {
        const uids = Object.entries(pick).filter(([, v]) => v).map(([k]) => k)
        if (uids.length === 0) {
            toast.message('Select at least one item')
            return
        }
        try {
            await bulkAddFromUnbilled(invoiceId, uids, inv.patient_id)
            toast.success(`Added ${uids.length} item(s)`)
            setDrawerOpen(false)
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Bulk add failed')
        }
    }

    const onManualAdd = async (payload) => {
        try {
            await addManualItem(invoiceId, payload)
            toast.success('Item added')
            setShowManual(false)
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Add failed')
        }
    }

    const onSaveRow = async (item) => {
        setSavingRowId(item.id)
        try {
            await updateInvoiceItem(invoiceId, item.id, {
                quantity: Number(item.quantity || 1),
                unit_price: Number(item.unit_price || 0),
                tax_rate: Number(item.tax_rate || 0)
            })
            toast.success('Item updated')
            setEditRow(null)
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Update failed')
        } finally {
            setSavingRowId(null)
        }
    }

    const onVoid = async (item) => {
        if (!confirm('Void this item?')) return
        try {
            await voidInvoiceItem(invoiceId, item.id, { reason: 'Voided' })
            toast.success('Item voided')
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Void failed')
        }
    }

    const onFinalize = async () => {
        try {
            await finalizeInvoice(invoiceId)
            toast.success('Invoice finalized')
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Finalize failed')
        }
    }

    const onCancel = async () => {
        if (!confirm('Cancel this invoice?')) return
        try {
            await cancelInvoice(invoiceId)
            toast.success('Invoice cancelled')
            navigate('/billing')
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Cancel failed')
        }
    }

    const onAddPayment = async (payload) => {
        try {
            await addPayment(invoiceId, payload)
            toast.success('Payment recorded')
            setShowPay(false)
            load()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Payment failed')
        }
    }

    const totals = useMemo(() => ({
        gross: inv?.gross_total || 0, tax: inv?.tax_total || 0, net: inv?.net_total || 0,
        paid: inv?.amount_paid || 0, due: inv?.balance_due || 0
    }), [inv])

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link to="/billing" className="btn-ghost inline-flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Link>
                    <h1 className="text-xl font-semibold">Invoice #{id}</h1>
                    {loading ? null : (
                        <span className={[
                            'text-xs px-2 py-1 rounded-full',
                            isDraft ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' :
                                isFinal ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                                    isCancelled ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-gray-50'
                        ].join(' ')}>{inv?.status}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <PermGate anyOf={['billing.items.add']}>
                        <button onClick={() => setShowManual(true)} disabled={!isDraft} className="btn">
                            <Plus className="h-4 w-4 mr-2" /> Add manual
                        </button>
                    </PermGate>
                    <PermGate anyOf={['billing.items.add']}>
                        <button onClick={openUnbilled} disabled={!isDraft} className="btn">
                            <Plus className="h-4 w-4 mr-2" /> Add from Unbilled
                        </button>
                    </PermGate>
                    <PermGate anyOf={['billing.finalize']}>
                        <button onClick={onFinalize} disabled={!isDraft || (inv?.items || []).every(i => i.is_voided)} className="btn">
                            <Check className="h-4 w-4 mr-2" /> Finalize
                        </button>
                    </PermGate>
                    <PermGate anyOf={['billing.payments.add']}>
                        <button onClick={() => setShowPay(true)} disabled={!isFinal || inv?.balance_due <= 0} className="btn">
                            <CreditCard className="h-4 w-4 mr-2" /> Payment
                        </button>
                    </PermGate>
                    <PermGate anyOf={['billing.cancel']}>
                        <button onClick={onCancel} disabled={isCancelled} className="btn-danger inline-flex items-center">
                            <AlertOctagon className="h-4 w-4 mr-2" /> Cancel
                        </button>
                    </PermGate>
                </div>
            </header>

            {/* Totals */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    ['Gross', totals.gross],
                    ['Tax', totals.tax],
                    ['Net', totals.net],
                    ['Paid', totals.paid],
                    ['Balance', totals.due],
                ].map(([label, val]) => (
                    <div key={label} className="rounded-xl border bg-white p-3">
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="text-lg font-semibold">{money(val)}</div>
                    </div>
                ))}
            </section>

            {/* Items */}
            <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Unit</th>
                            <th className="px-3 py-2 text-right">Tax %</th>
                            <th className="px-3 py-2 text-right">Tax</th>
                            <th className="px-3 py-2 text-right">Line Total</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (<tr><td className="px-3 py-6" colSpan={8}>Loading…</td></tr>)}
                        {!loading && (inv?.items || []).map(it => {
                            const editable = isDraft && !it.is_voided
                            const isEditing = editRow === it.id
                            return (
                                <tr key={it.id} className={['border-t', it.is_voided ? 'opacity-60' : ''].join(' ')}>
                                    <td className="px-3 py-2">{it.description}</td>
                                    <td className="px-3 py-2 capitalize">{it.service_type || 'manual'}</td>
                                    <td className="px-3 py-2 text-right">
                                        {isEditing
                                            ? <input defaultValue={it.quantity} className="input w-20 text-right" onChange={e => (it.quantity = e.target.value)} />
                                            : it.quantity}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {isEditing
                                            ? <input defaultValue={it.unit_price} className="input w-24 text-right" onChange={e => (it.unit_price = e.target.value)} />
                                            : money(it.unit_price)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {isEditing
                                            ? <input defaultValue={it.tax_rate} className="input w-20 text-right" onChange={e => (it.tax_rate = e.target.value)} />
                                            : (it.tax_rate ?? 0)}
                                    </td>
                                    <td className="px-3 py-2 text-right">{money(it.tax_amount)}</td>
                                    <td className="px-3 py-2 text-right">{money(it.line_total)}</td>
                                    <td className="px-3 py-2 text-right">
                                        {editable && !isEditing && (
                                            <>
                                                <PermGate anyOf={['billing.items.update']}>
                                                    <button className="btn-ghost" onClick={() => setEditRow(it.id)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                </PermGate>
                                                <PermGate anyOf={['billing.items.void']}>
                                                    <button className="btn-ghost text-rose-600" onClick={() => onVoid(it)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </PermGate>
                                            </>
                                        )}
                                        {editable && isEditing && (
                                            <>
                                                <button className="btn-ghost" onClick={() => onSaveRow(it)} disabled={savingRowId === it.id}>
                                                    {savingRowId === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                </button>
                                                <button className="btn-ghost" onClick={() => setEditRow(null)}>
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                        {!editable && it.is_voided && <span className="text-xs text-rose-600">Voided</span>}
                                    </td>
                                </tr>
                            )
                        })}
                        {!loading && (inv?.items || []).length === 0 && (
                            <tr><td className="px-3 py-8 text-center text-gray-500" colSpan={8}>No items yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Payments */}
            <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Payment #</th>
                            <th className="px-3 py-2 text-left">Mode</th>
                            <th className="px-3 py-2 text-left">Reference</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-left">Paid At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(inv?.payments || []).map(p => (
                            <tr key={p.id} className="border-t">
                                <td className="px-3 py-2">#{p.id}</td>
                                <td className="px-3 py-2 uppercase">{p.mode}</td>
                                <td className="px-3 py-2">{p.reference_no || '—'}</td>
                                <td className="px-3 py-2 text-right">{money(p.amount)}</td>
                                <td className="px-3 py-2">{p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}</td>
                            </tr>
                        ))}
                        {(inv?.payments || []).length === 0 && (
                            <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={5}>No payments</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Drawers / Modals */}
            <UnbilledDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                rows={unbilled}
                pick={pick}
                setPick={setPick}
                onApply={applyUnbilled}
                disabled={!isDraft}
            />

            <AddManualItemModal
                open={showManual}
                onClose={() => setShowManual(false)}
                onSubmit={onManualAdd}
                disabled={!isDraft}
            />

            <PaymentModal
                open={showPay}
                onClose={() => setShowPay(false)}
                onSubmit={onAddPayment}
                disabled={!isFinal || inv?.balance_due <= 0}
                maxAmount={inv?.balance_due || 0}
            />
        </div>
    )
}
