// src/lab/OrderDetail.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    getLisOrder,
    collectLisSamples,
    enterLisResults,
    validateLisItem,
    finalizeLisReport,
    addLisAttachment,
} from '../api/lab'
import { uploadFile } from '../api/files'
import { toast } from 'sonner'
import { Check, Upload } from 'lucide-react'
import PermGate from '../components/PermGate'
import PatientBadge from '../components/PatientBadge'
const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—')

export default function OrderDetail() {
    const { id } = useParams()
    const [loading, setLoading] = useState(false)
    const [order, setOrder] = useState(null)

    // sample collection
    const [barcode, setBarcode] = useState('')

    // results buffer: { [itemId]: { result_value, is_critical } }
    const [results, setResults] = useState({})

    const fetchOrder = async () => {
        setLoading(true)
        try {
            const { data } = await getLisOrder(id)
            setOrder(data)
            setResults(() => {
                const r = {}
                    ; (data?.items || []).forEach(it => {
                        r[it.id] = {
                            result_value: it.result_value ?? '',
                            is_critical: !!it.is_critical,
                        }
                    })
                return r
            })
        } catch (e) {
            toast.error('Failed to load order')
        } finally { setLoading(false) }
    }

    useEffect(() => { fetchOrder() }, [id])

    const canFinalize = useMemo(() => {
        const items = order?.items || []
        return items.length > 0 && items.every(it => (it.status || '').toLowerCase() === 'validated')
    }, [order])

    const onCollect = async () => {
        if (!barcode.trim()) { toast.error('Barcode required'); return }
        try {
            await collectLisSamples(id, barcode.trim())
            toast.success('Sample collected')
            setBarcode('')
            fetchOrder()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Collect failed')
        }
    }

    const saveResults = async () => {
        const payload = Object.entries(results).map(([item_id, v]) => ({
            item_id: Number(item_id),
            result_value: v.result_value,
            is_critical: !!v.is_critical,
        }))
        try {
            await enterLisResults(id, payload)
            toast.success('Results saved')
            fetchOrder()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Save failed')
        }
    }

    const onValidate = async (itemId) => {
        try {
            await validateLisItem(itemId)
            toast.success('Item validated')
            fetchOrder()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Validate failed')
        }
    }

    const onFinalize = async () => {
        try {
            await finalizeLisReport(id)
            toast.success('Report finalized')
            fetchOrder()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Finalize failed')
        }
    }

    const onAttach = async (itemId, file) => {
        try {
            const url = await uploadFile(file)
            await addLisAttachment(itemId, url, file.name)
            toast.success('Attachment added')
            fetchOrder()
        } catch (e) {
            toast.error('Attachment failed')
        }
    }

    if (loading && !order) return <div className="p-6">Loading…</div>
    if (!order) return <div className="p-6">Order not found</div>

    return (
        <div className="p-4 md:p-6 space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">Lab Order #{order.id}</h1>

                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                        <PatientBadge
                            patient={order?.patient}
                            patientId={order?.patient_id}
                            className="border-blue-100 bg-blue-50"
                        />
                        <span>· Created: {fmtDT(order.created_at || order.createdAt)}</span>
                    </div>

                    <div className="text-xs text-gray-500">
                        Priority: <span className="capitalize">{order.priority || 'routine'}</span> · Status: {order.status}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <PermGate anyOf={['lab.results.enter', 'lab.orders.create']}>
                        <button className="btn" onClick={saveResults}>Save Results</button>
                    </PermGate>
                    <PermGate anyOf={['lab.results.validate', 'lab.results.report', 'lab.results.approve']}>
                        <button className="btn" disabled={!canFinalize} onClick={onFinalize}>
                            <Check className="h-4 w-4 mr-2" /> Finalize
                        </button>
                    </PermGate>
                </div>
            </header>


            {/* Sample collection */}
            <PermGate anyOf={['lab.samples.collect']}>
                <section className="rounded-xl border bg-white p-4">
                    <h2 className="font-semibold mb-3">Sample Collection</h2>
                    <div className="flex flex-wrap items-end gap-2">
                        <div>
                            <label className="text-sm">Barcode</label>
                            <input className="input" placeholder="Scan/enter barcode" value={barcode} onChange={e => setBarcode(e.target.value)} />
                        </div>
                        <button className="btn" onClick={onCollect}>Collect</button>
                        <div className="text-xs text-gray-500 ml-auto">
                            Collected at: {fmtDT(order.collected_at || order.collectedAt)}
                        </div>
                    </div>
                </section>
            </PermGate>

            {/* Items & Results */}
            <section className="rounded-xl border bg-white">
                <div className="p-4 border-b">
                    <h2 className="font-semibold">Results</h2>
                </div>
                <div className="divide-y">
                    {(order.items || []).map(it => {
                        const buf = results[it.id] || { result_value: '', is_critical: false }
                        const validated = (it.status || '').toLowerCase() === 'validated'
                        return (
                            <div key={it.id} className="p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium">{it.test_code || it.code} — {it.test_name || it.name}</div>
                                        <div className="text-xs text-gray-500">
                                            Range: {it.reference_range || '—'} · Unit: {it.unit || '—'}
                                        </div>
                                    </div>
                                    <div className="text-xs">
                                        Status: <span className={validated ? 'text-emerald-600' : 'text-gray-600'}>{validated ? 'Validated' : (it.status || 'Pending')}</span>
                                    </div>
                                </div>

                                <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                                    <input
                                        className="input"
                                        placeholder="Result value"
                                        value={buf.result_value}
                                        onChange={e => setResults(s => ({ ...s, [it.id]: { ...s[it.id], result_value: e.target.value } }))}
                                    />
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={!!buf.is_critical}
                                            onChange={e => setResults(s => ({ ...s, [it.id]: { ...s[it.id], is_critical: e.target.checked } }))}
                                        />
                                        <span className="text-sm">Critical</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button className="btn-ghost" onClick={() => onValidate(it.id)} disabled={validated}>Validate</button>
                                    </div>
                                </div>

                                {/* Attachments */}
                                <div className="mt-3 flex items-center gap-3">
                                    <label className="btn-ghost inline-flex items-center gap-2 cursor-pointer">
                                        <Upload className="h-4 w-4" />
                                        <span>Attach</span>
                                        <input type="file" hidden onChange={e => e.target.files?.[0] && onAttach(it.id, e.target.files[0])} />
                                    </label>
                                    <div className="text-xs text-gray-500">
                                        {(it.attachments || []).length ? `${it.attachments.length} attachment(s)` : 'No attachments'}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {(order.items || []).length === 0 && (
                        <div className="p-6 text-sm text-gray-500">No items</div>
                    )}
                </div>
            </section>
        </div>
    )
}
