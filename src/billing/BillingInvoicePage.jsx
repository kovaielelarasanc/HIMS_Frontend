import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
    getInvoice,
    updateInvoice,
    finalizeInvoice,
    cancelInvoice,
    addManualItem,
    addServiceItem,
    updateInvoiceItem,
    voidInvoiceItem,
    addPayment,
    deletePayment,
    fetchInvoicePdf,
    autoAddIpdBedCharges,
    autoAddOtCharges,

    // advances
    listAdvances,
    applyAdvanceToInvoice,
    listInvoiceAdvanceAdjustments,
    removeInvoiceAdvanceAdjustment,
    getBillingMasters,
} from '../api/billing'

import PatientPicker from '../components/PatientPicker'

const BILLING_TYPES = [
    { value: 'op_billing', label: 'OP Billing' },
    { value: 'ip_billing', label: 'IP Billing' },
    { value: 'ot', label: 'OT' },
    { value: 'pharmacy', label: 'Pharmacy' },
    { value: 'lab', label: 'Laboratory' },
    { value: 'radiology', label: 'Radiology' },
    { value: 'general', label: 'General' },
]

const PAYMENT_MODES = ['cash', 'card', 'upi', 'credit', 'cheque', 'neft', 'rtgs', 'wallet', 'other']

function money(x) {
    const n = Number(x || 0)
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function invNo(inv) {
    return inv?.invoice_number || inv?.invoice_uid || '—'
}

function patientName(p) {
    if (!p) return 'Patient'
    return (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient').trim()
}

function patientSub(p) {
    if (!p) return 'UHID —'
    const uhid = p.uhid || p.uhid_no || p.patient_uid || p.mrn
    const phone = p.phone || p.mobile || p.contact_no
    return `${uhid ? `UHID ${uhid}` : 'UHID —'}${phone ? ` • ${phone}` : ''}`
}

export default function BillingInvoicePage() {
    const { id } = useParams()
    const nav = useNavigate()

    const [masters, setMasters] = useState({ doctors: [], credit_providers: [] })

    const [invoice, setInvoice] = useState(null)
    const [loadingInvoice, setLoadingInvoice] = useState(false)
    const [savingHeader, setSavingHeader] = useState(false)

    // header state
    const [billingType, setBillingType] = useState('op_billing')
    const [contextType, setContextType] = useState('opd')
    const [consultantId, setConsultantId] = useState('')
    const [providerId, setProviderId] = useState('')
    const [remarks, setRemarks] = useState('')

    // add manual
    const [manualDesc, setManualDesc] = useState('')
    const [manualQty, setManualQty] = useState(1)
    const [manualPrice, setManualPrice] = useState('')
    const [manualTax, setManualTax] = useState('')

    // add service (kept as is; you can replace with pickers later)
    const [serviceType, setServiceType] = useState('lab')
    const [serviceRefId, setServiceRefId] = useState('')
    const [serviceDesc, setServiceDesc] = useState('')
    const [servicePrice, setServicePrice] = useState('')
    const [serviceTax, setServiceTax] = useState('')

    // payments
    const [payAmount, setPayAmount] = useState('')
    const [payMode, setPayMode] = useState('cash')
    const [payRef, setPayRef] = useState('')

    // advances
    const [advances, setAdvances] = useState([])
    const [advAdjustments, setAdvAdjustments] = useState([])
    const [advLoading, setAdvLoading] = useState(false)
    const [adjLoading, setAdjLoading] = useState(false)
    const [applyAmt, setApplyAmt] = useState('') // optional partial apply

    // auto billing
    const [autoAdmissionId, setAutoAdmissionId] = useState('')
    const [autoOtCaseId, setAutoOtCaseId] = useState('')
    const [autoBedMode, setAutoBedMode] = useState('mixed')
    const [autoLoading, setAutoLoading] = useState(false)

    const locked = invoice?.status === 'finalized'

    const totals = useMemo(() => {
        if (!invoice) return null
        return {
            gross: Number(invoice.gross_total || 0),
            tax: Number(invoice.tax_total || 0),
            net: Number(invoice.net_total || 0),
            paid: Number(invoice.amount_paid || 0),
            adv: Number(invoice.advance_adjusted || 0),
            balance: Number(invoice.balance_due || 0),
        }
    }, [invoice])

    const availableAdvanceTotal = useMemo(() => {
        return (advances || []).reduce((a, x) => a + Number(x.balance_remaining || 0), 0)
    }, [advances])

    // masters
    useEffect(() => {
        ; (async () => {
            try {
                const { data } = await getBillingMasters()
                setMasters(data || { doctors: [], credit_providers: [] })
            } catch (e) {
                console.error(e)
            }
        })()
    }, [])

    // load invoice
    useEffect(() => {
        if (!id) return
        loadInvoice(Number(id))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    async function loadInvoice(invoiceId) {
        setLoadingInvoice(true)
        try {
            const { data } = await getInvoice(invoiceId)
            setInvoice(data)

            setBillingType(data.billing_type || 'op_billing')
            setContextType(data.context_type || 'opd')
            setConsultantId(data.consultant_id || '')
            setProviderId(data.provider_id || '')
            setRemarks(data.remarks || '')

            // auto-fill for auto billing controls
            if (data.context_type === 'ipd' && data.context_id) setAutoAdmissionId(String(data.context_id))
            if (data.context_type === 'ot' && data.context_id) setAutoOtCaseId(String(data.context_id))

            // load advances + adjustments
            await Promise.all([loadAdvances(data.patient_id), loadAdjustments(data.id)])
        } catch (e) {
            console.error(e)
            toast.error('Invoice not found')
        } finally {
            setLoadingInvoice(false)
        }
    }

    async function loadAdvances(patientId) {
        if (!patientId) return
        setAdvLoading(true)
        try {
            const { data } = await listAdvances({ patient_id: patientId })
            // show only with balance + not voided (UI-safe)
            const list = (data || []).filter((a) => !a.is_voided && Number(a.balance_remaining || 0) > 0)
            setAdvances(list)
        } catch (e) {
            console.error(e)
        } finally {
            setAdvLoading(false)
        }
    }

    async function loadAdjustments(invoiceId) {
        if (!invoiceId) return
        setAdjLoading(true)
        try {
            const { data } = await listInvoiceAdvanceAdjustments(invoiceId)
            setAdvAdjustments(data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setAdjLoading(false)
        }
    }

    async function handleSaveHeader() {
        if (!invoice) return
        try {
            setSavingHeader(true)
            const payload = {
                billing_type: billingType,
                consultant_id: consultantId || null,
                provider_id: providerId || null,
                remarks: remarks || null,
            }
            const { data } = await updateInvoice(invoice.id, payload)
            setInvoice(data)
            toast.success('Header saved')
        } catch (e) {
            console.error(e)
            toast.error('Failed to update header')
        } finally {
            setSavingHeader(false)
        }
    }

    async function handleFinalize() {
        if (!invoice) return
        if (!window.confirm('Finalize this invoice?')) return
        try {
            const { data } = await finalizeInvoice(invoice.id)
            setInvoice(data)
            toast.success('Invoice finalized')
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Finalize failed')
        }
    }

    async function handleCancel() {
        if (!invoice) return
        if (!window.confirm('Cancel this invoice?')) return
        try {
            await cancelInvoice(invoice.id)
            toast.success('Invoice cancelled')
            nav('/billing')
        } catch (e) {
            console.error(e)
            toast.error('Cancel failed')
        }
    }

    async function handlePrint() {
        if (!invoice) return
        try {
            const res = await fetchInvoicePdf(invoice.id)
            const blob = new Blob([res.data], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (e) {
            console.error(e)
            toast.error('Failed to generate PDF')
        }
    }

    // items
    async function handleAddManualItem() {
        if (!invoice) return toast.error('Load invoice first')
        if (locked) return toast.error('Invoice is finalized')
        if (!manualDesc || !manualPrice) return toast.error('Description and price are required')

        try {
            const payload = {
                description: manualDesc,
                quantity: Number(manualQty) || 1,
                unit_price: Number(manualPrice),
                tax_rate: Number(manualTax) || 0,
            }
            const { data } = await addManualItem(invoice.id, payload)
            setInvoice(data)
            setManualDesc('')
            setManualQty(1)
            setManualPrice('')
            setManualTax('')
            toast.success('Item added')
        } catch (e) {
            console.error(e)
            toast.error('Failed to add manual item')
        }
    }

    async function handleAddServiceItem() {
        if (!invoice) return toast.error('Load invoice first')
        if (locked) return toast.error('Invoice is finalized')
        if (!serviceRefId) return toast.error('Service ref is required')

        try {
            const payload = {
                service_type: serviceType,
                service_ref_id: Number(serviceRefId),
                description: serviceDesc || null,
                quantity: 1,
                unit_price: servicePrice ? Number(servicePrice) : undefined,
                tax_rate: serviceTax ? Number(serviceTax) : 0,
            }
            const { data } = await addServiceItem(invoice.id, payload)
            setInvoice(data)
            setServiceRefId('')
            setServiceDesc('')
            setServicePrice('')
            setServiceTax('')
            toast.success('Service item added')
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Failed to add service item')
        }
    }

    async function handleUpdateLine(item, changes) {
        if (!invoice) return
        if (locked) return
        if (item.is_voided) return
        try {
            const { data } = await updateInvoiceItem(invoice.id, item.id, changes)
            setInvoice(data)
        } catch (e) {
            console.error(e)
            toast.error('Update failed')
        }
    }

    async function handleVoidLine(item) {
        if (!invoice) return
        if (locked) return toast.error('Invoice is finalized')
        if (item.is_voided) return
        if (!window.confirm('Void this line item?')) return

        try {
            const { data } = await voidInvoiceItem(invoice.id, item.id, { reason: 'Voided from UI' })
            setInvoice(data)
            toast.success('Item voided')
        } catch (e) {
            console.error(e)
            toast.error('Void failed')
        }
    }

    // payments
    async function handleAddPayment() {
        if (!invoice) return toast.error('Load invoice first')
        if (!payAmount) return toast.error('Amount is required')

        try {
            const payload = { amount: Number(payAmount), mode: payMode, reference_no: payRef || null }
            const { data } = await addPayment(invoice.id, payload)
            setInvoice(data)
            setPayAmount('')
            setPayRef('')
            toast.success('Payment added')
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Failed to add payment')
        }
    }

    async function handleDeletePayment(p) {
        if (!invoice) return
        if (!window.confirm('Delete this payment?')) return
        try {
            const { data } = await deletePayment(invoice.id, p.id)
            setInvoice(data)
            toast.success('Payment deleted')
        } catch (e) {
            console.error(e)
            toast.error('Delete payment failed')
        }
    }

    // advances apply
    async function handleApplyAdvance(auto = true) {
        if (!invoice) return
        if (invoice.balance_due <= 0) return toast.info('No balance due')

        try {
            const amt = applyAmt?.trim() ? Number(applyAmt) : null
            if (!auto && (!amt || amt <= 0)) return toast.error('Enter valid amount')

            const payload = auto ? {} : { amount: amt }
            const { data } = await applyAdvanceToInvoice(invoice.id, payload)

            toast.success(`Advance applied: ₹ ${money(data.applied_amount)}`)
            await loadInvoice(invoice.id) // reload invoice + advances + adjustments
            setApplyAmt('')
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Advance apply failed')
        }
    }

    async function handleRemoveAdjustment(adj) {
        if (!invoice) return
        if (!window.confirm('Remove this advance adjustment?')) return
        try {
            await removeInvoiceAdvanceAdjustment(invoice.id, adj.id)
            toast.success('Adjustment removed')
            await loadInvoice(invoice.id)
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Remove failed')
        }
    }

    // auto billing
    async function handleAutoIpdAndOt() {
        if (!invoice) return toast.error('Load invoice first')
        if (locked) return toast.error('Invoice is finalized')
        if (!autoAdmissionId && !autoOtCaseId) return toast.error('Enter Admission and/or OT Case')

        setAutoLoading(true)
        try {
            let latest = invoice

            if (autoAdmissionId) {
                const { data } = await autoAddIpdBedCharges(invoice.id, {
                    admission_id: Number(autoAdmissionId),
                    mode: autoBedMode || 'mixed',
                    skip_if_already_billed: true,
                    upto_ts: null,
                })
                latest = data
            }

            if (autoOtCaseId) {
                const { data } = await autoAddOtCharges(invoice.id, { case_id: Number(autoOtCaseId) })
                latest = data
            }

            setInvoice(latest)
            toast.success('Auto charges added')
        } catch (e) {
            console.error(e)
            toast.error(e?.response?.data?.detail || 'Auto billing failed')
        } finally {
            setAutoLoading(false)
        }
    }

    if (loadingInvoice || !invoice) {
        return (
            <div className="p-4">
                <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500">
                    {loadingInvoice ? 'Loading invoice…' : 'Invoice not loaded'}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-3 md:p-6 space-y-4">
            {/* Top Header */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="space-y-1">
                        <div className="text-sm text-slate-500">Invoice</div>
                        <div className="text-xl font-extrabold text-slate-900">{invNo(invoice)}</div>
                        <div className="text-sm font-semibold text-slate-700">{patientName(invoice.patient)}</div>
                        <div className="text-xs text-slate-500">{patientSub(invoice.patient)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="rounded-full border px-3 py-1 text-xs font-bold bg-slate-50 text-slate-700">
                            Status: {String(invoice.status || 'draft').toUpperCase()}
                        </span>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
                        >
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveHeader}
                            disabled={savingHeader}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            {savingHeader ? 'Saving…' : 'Save Header'}
                        </button>

                        <button
                            type="button"
                            onClick={handleFinalize}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                            Finalize
                        </button>

                        <button
                            type="button"
                            onClick={handleCancel}
                            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                        >
                            Cancel
                        </button>
                    </div>
                </div>

                {/* Totals */}
                {totals && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div className="rounded-xl border bg-slate-50 p-3">
                            <div className="text-[11px] text-slate-500">Net</div>
                            <div className="text-base font-extrabold text-slate-900">₹ {money(totals.net)}</div>
                        </div>
                        <div className="rounded-xl border bg-emerald-50 p-3">
                            <div className="text-[11px] text-emerald-700">Paid</div>
                            <div className="text-base font-extrabold text-emerald-900">₹ {money(totals.paid)}</div>
                        </div>
                        <div className="rounded-xl border bg-indigo-50 p-3">
                            <div className="text-[11px] text-indigo-700">Advance Used</div>
                            <div className="text-base font-extrabold text-indigo-900">₹ {money(totals.adv)}</div>
                        </div>
                        <div className="rounded-xl border bg-rose-50 p-3 md:col-span-2">
                            <div className="text-[11px] text-rose-700">Balance Due</div>
                            <div className="text-base font-extrabold text-rose-900">₹ {money(totals.balance)}</div>
                        </div>
                    </div>
                )}

                {/* Header fields */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs font-bold text-slate-700">Billing Type</label>
                        <select
                            value={billingType}
                            onChange={(e) => setBillingType(e.target.value)}
                            disabled={locked}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                            {BILLING_TYPES.map((bt) => (
                                <option key={bt.value} value={bt.value}>
                                    {bt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-700">Consultant</label>
                        <select
                            value={consultantId}
                            onChange={(e) => setConsultantId(e.target.value)}
                            disabled={locked}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                            <option value="">— None —</option>
                            {(masters.doctors || []).map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-700">Credit Provider</label>
                        <select
                            value={providerId}
                            onChange={(e) => setProviderId(e.target.value)}
                            disabled={locked}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                            <option value="">— Self / Cash —</option>
                            {(masters.credit_providers || []).map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.code ? `${p.code} – ` : ''}{p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-3">
                        <label className="text-xs font-bold text-slate-700">Remarks</label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            disabled={locked}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[84px]"
                            placeholder="Any note"
                        />
                    </div>
                </div>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
                {/* Items */}
                <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                            <div className="text-lg font-extrabold text-slate-900">Bill Items</div>
                            <div className="text-xs text-slate-500">Edit qty/price/tax before finalize.</div>
                        </div>

                        {/* Auto controls */}
                        <div className="flex flex-wrap items-center gap-2 text-[12px]">
                            <input
                                type="number"
                                value={autoAdmissionId}
                                onChange={(e) => setAutoAdmissionId(e.target.value)}
                                className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Admission ID"
                                disabled={locked}
                            />
                            <select
                                value={autoBedMode}
                                onChange={(e) => setAutoBedMode(e.target.value)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            >
                                <option value="daily">Daily</option>
                                <option value="hourly">Hourly</option>
                                <option value="mixed">Mixed</option>
                            </select>
                            <input
                                type="number"
                                value={autoOtCaseId}
                                onChange={(e) => setAutoOtCaseId(e.target.value)}
                                className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                placeholder="OT Case ID"
                                disabled={locked}
                            />
                            <button
                                type="button"
                                onClick={handleAutoIpdAndOt}
                                disabled={autoLoading || locked}
                                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {autoLoading ? 'Applying…' : 'Auto Charges'}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-auto rounded-xl border">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-700">
                                <tr>
                                    <th className="p-3 text-left text-xs font-extrabold">#</th>
                                    <th className="p-3 text-left text-xs font-extrabold">Description</th>
                                    <th className="p-3 text-right text-xs font-extrabold">Qty</th>
                                    <th className="p-3 text-right text-xs font-extrabold">Price</th>
                                    <th className="p-3 text-right text-xs font-extrabold">GST%</th>
                                    <th className="p-3 text-right text-xs font-extrabold">Tax</th>
                                    <th className="p-3 text-right text-xs font-extrabold">Total</th>
                                    <th className="p-3 text-right text-xs font-extrabold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(invoice.items || []).length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-6 text-center text-slate-500">No items yet.</td>
                                    </tr>
                                )}

                                {(invoice.items || []).map((it, idx) => (
                                    <tr key={it.id} className={`border-t ${it.is_voided ? 'bg-rose-50 text-slate-400' : ''}`}>
                                        <td className="p-3">{idx + 1}</td>
                                        <td className="p-3 font-semibold">{it.description}</td>

                                        <td className="p-3 text-right">
                                            <input
                                                type="number"
                                                min="1"
                                                value={it.quantity}
                                                onChange={(e) => handleUpdateLine(it, { quantity: Number(e.target.value) || 1 })}
                                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right"
                                                disabled={locked || it.is_voided}
                                            />
                                        </td>

                                        <td className="p-3 text-right">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={it.unit_price}
                                                onChange={(e) => handleUpdateLine(it, { unit_price: Number(e.target.value) || 0 })}
                                                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right"
                                                disabled={locked || it.is_voided}
                                            />
                                        </td>

                                        <td className="p-3 text-right">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={it.tax_rate}
                                                onChange={(e) => handleUpdateLine(it, { tax_rate: Number(e.target.value) || 0 })}
                                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right"
                                                disabled={locked || it.is_voided}
                                            />
                                        </td>

                                        <td className="p-3 text-right">{money(it.tax_amount)}</td>
                                        <td className="p-3 text-right font-extrabold">{money(it.line_total)}</td>

                                        <td className="p-3 text-right">
                                            {!it.is_voided && !locked ? (
                                                <button type="button" onClick={() => handleVoidLine(it)} className="text-rose-700 font-extrabold hover:underline">
                                                    Void
                                                </button>
                                            ) : it.is_voided ? (
                                                <span className="text-rose-700 font-extrabold">Voided</span>
                                            ) : (
                                                <span className="text-slate-400 font-bold">Locked</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add manual */}
                    <div className="rounded-2xl border bg-slate-50 p-4 space-y-3">
                        <div className="text-sm font-extrabold text-slate-900">Add Manual Item</div>

                        <div className="grid grid-cols-1 md:grid-cols-[2fr,0.7fr,0.8fr,0.7fr,auto] gap-2">
                            <input
                                value={manualDesc}
                                onChange={(e) => setManualDesc(e.target.value)}
                                placeholder="Description (e.g., Dressing charges)"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />
                            <input
                                type="number"
                                min="1"
                                value={manualQty}
                                onChange={(e) => setManualQty(e.target.value)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />
                            <input
                                type="number"
                                step="0.01"
                                value={manualPrice}
                                onChange={(e) => setManualPrice(e.target.value)}
                                placeholder="Unit Price"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />
                            <input
                                type="number"
                                step="0.1"
                                value={manualTax}
                                onChange={(e) => setManualTax(e.target.value)}
                                placeholder="GST%"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />
                            <button
                                type="button"
                                onClick={handleAddManualItem}
                                disabled={locked}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Add service */}
                    <div className="rounded-2xl border bg-slate-50 p-4 space-y-3">
                        <div className="text-sm font-extrabold text-slate-900">Add Service Item</div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,2fr,0.9fr,0.7fr,auto] gap-2">
                            <select
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            >
                                <option value="lab">Lab</option>
                                <option value="radiology">Radiology</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="ot">OT</option>
                                <option value="ipd">IPD</option>
                                <option value="opd">OPD</option>
                                <option value="manual">Manual (with ref)</option>
                                <option value="other">Other</option>
                            </select>

                            <input
                                value={serviceRefId}
                                onChange={(e) => setServiceRefId(e.target.value)}
                                placeholder="Service Ref"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />

                            <input
                                value={serviceDesc}
                                onChange={(e) => setServiceDesc(e.target.value)}
                                placeholder="Description (optional)"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />

                            <input
                                type="number"
                                step="0.01"
                                value={servicePrice}
                                onChange={(e) => setServicePrice(e.target.value)}
                                placeholder="Price"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />

                            <input
                                type="number"
                                step="0.1"
                                value={serviceTax}
                                onChange={(e) => setServiceTax(e.target.value)}
                                placeholder="GST%"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                disabled={locked}
                            />

                            <button
                                type="button"
                                onClick={handleAddServiceItem}
                                disabled={locked}
                                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-900 disabled:opacity-60"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right panel: Payments + Advances */}
                <div className="space-y-4">
                    {/* Payments */}
                    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-lg font-extrabold text-slate-900">Payments</div>
                                <div className="text-xs text-slate-500">Split payments supported.</div>
                            </div>
                        </div>

                        <div className="overflow-auto rounded-xl border">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-slate-700">
                                    <tr>
                                        <th className="p-3 text-left text-xs font-extrabold">Mode</th>
                                        <th className="p-3 text-left text-xs font-extrabold">Ref</th>
                                        <th className="p-3 text-right text-xs font-extrabold">Amount</th>
                                        <th className="p-3 text-right text-xs font-extrabold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(invoice.payments || []).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-6 text-center text-slate-500">No payments yet.</td>
                                        </tr>
                                    )}
                                    {(invoice.payments || []).map((p) => (
                                        <tr key={p.id} className="border-t">
                                            <td className="p-3 font-semibold">{String(p.mode || '').toUpperCase()}</td>
                                            <td className="p-3 text-slate-600">{p.reference_no || '—'}</td>
                                            <td className="p-3 text-right font-extrabold">₹ {money(p.amount)}</td>
                                            <td className="p-3 text-right">
                                                <button type="button" onClick={() => handleDeletePayment(p)} className="text-rose-700 font-extrabold hover:underline">
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {!locked && (
                            <div className="rounded-2xl border bg-slate-50 p-3 space-y-2">
                                <div className="text-sm font-extrabold text-slate-900">Add Payment</div>
                                <div className="grid grid-cols-1 gap-2">
                                    <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                                        {PAYMENT_MODES.map((m) => (
                                            <option key={m} value={m}>{m.toUpperCase()}</option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        step="0.01"
                                        value={payAmount}
                                        onChange={(e) => setPayAmount(e.target.value)}
                                        placeholder="Amount"
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />

                                    <input
                                        value={payRef}
                                        onChange={(e) => setPayRef(e.target.value)}
                                        placeholder="Reference (optional)"
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />

                                    <button type="button" onClick={handleAddPayment} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700">
                                        Add Payment
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Advances */}
                    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="text-lg font-extrabold text-slate-900">Advances</div>
                                <div className="text-xs text-slate-500">
                                    Available: <span className="font-extrabold text-slate-900">₹ {money(availableAdvanceTotal)}</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => loadAdvances(invoice.patient_id)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-100"
                            >
                                Refresh
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <button
                                type="button"
                                onClick={() => handleApplyAdvance(true)}
                                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-700"
                            >
                                Auto Apply Advance (Best)
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-2">
                                <input
                                    value={applyAmt}
                                    onChange={(e) => setApplyAmt(e.target.value)}
                                    placeholder="Apply partial amount (e.g., 500)"
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleApplyAdvance(false)}
                                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-800 hover:bg-emerald-100"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        {/* Adjustments */}
                        <div className="rounded-2xl border bg-slate-50 p-3">
                            <div className="text-sm font-extrabold text-slate-900">Applied Adjustments</div>
                            <div className="mt-2 space-y-2 max-h-56 overflow-auto">
                                {adjLoading ? (
                                    <div className="text-sm text-slate-500">Loading…</div>
                                ) : (advAdjustments || []).length === 0 ? (
                                    <div className="text-sm text-slate-500">No adjustments yet.</div>
                                ) : (
                                    advAdjustments.map((adj) => (
                                        <div key={adj.id} className="rounded-xl border bg-white p-3 flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-sm font-extrabold text-slate-900">₹ {money(adj.amount_applied)}</div>
                                                <div className="text-xs text-slate-500">
                                                    Applied at {adj.applied_at ? new Date(adj.applied_at).toLocaleString() : '—'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAdjustment(adj)}
                                                className="text-rose-700 font-extrabold hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Available advances list */}
                        <div className="rounded-2xl border bg-slate-50 p-3">
                            <div className="text-sm font-extrabold text-slate-900">Available Advances</div>
                            <div className="mt-2 space-y-2 max-h-56 overflow-auto">
                                {advLoading ? (
                                    <div className="text-sm text-slate-500">Loading…</div>
                                ) : (advances || []).length === 0 ? (
                                    <div className="text-sm text-slate-500">No available advance.</div>
                                ) : (
                                    advances.map((a) => (
                                        <div key={a.id} className="rounded-xl border bg-white p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-extrabold text-slate-900">{String(a.mode || '').toUpperCase()}</div>
                                                <div className="text-sm font-extrabold text-indigo-700">₹ {money(a.balance_remaining)}</div>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Received: {a.received_at ? new Date(a.received_at).toLocaleString() : '—'}
                                                {a.reference_no ? ` • Ref: ${a.reference_no}` : ''}
                                            </div>
                                            {a.remarks ? <div className="text-xs text-slate-600 mt-1">{a.remarks}</div> : null}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-500">
                            Tip: Advances can be applied to OP/IP/OT/Pharmacy/Lab/Radiology/General invoices by patient.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
