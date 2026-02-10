// FILE: src/pharmacy/Billing.jsx
import { useEffect, useMemo, useState } from 'react'
import {
    listMedicines,
    listSales,
    createSale,
    getSalePdf,
    getPharmacyActiveContext,
} from '@/api/pharmacy'

import PatientPicker from '@/opd/components/patientpicker'
import PermGate from '@/components/PermGate'

import { Toaster, toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

import {
    Plus,
    Trash2,
    RotateCw,
    Printer,
    ReceiptIndianRupee,
} from 'lucide-react'

function openPdfBlob(blob) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const NEW_ITEM = () => ({
    medicine_id: '',
    qty: 1,
    unit_price: '',
    tax_percent: '',
    discount_percent: '',
})

const CONTEXT_TYPES = [
    { value: 'opd', label: 'OPD' },
    { value: 'ipd', label: 'IPD' },
    { value: 'counter', label: 'Counter sale' },
]

const PAYMENT_MODES = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'upi', label: 'UPI' },
    { value: 'credit', label: 'Credit' },
]

export default function PharmacyBilling() {
    const [patientId, setPatientId] = useState(null)
    const [context, setContext] = useState(null) // auto OPD/IPD if available

    const [meds, setMeds] = useState([])
    const [sale, setSale] = useState({
        context_type: 'opd',
        payment_mode: 'cash',
        notes: '',
        items: [NEW_ITEM()],
    })
    const [saving, setSaving] = useState(false)

    const [recent, setRecent] = useState([])
    const [loadingRecent, setLoadingRecent] = useState(false)

    // Lookups
    useEffect(() => {
        let ok = true
            ; (async () => {
                try {
                    const data = await listMedicines({ limit: 500, is_active: true }).then(r => r.data || [])
                    if (!ok) return
                    setMeds(data)
                } catch (e) {
                    toast.error('Failed to load medicines', {
                        description: e?.response?.data?.detail || 'Retry.',
                    })
                }
            })()
        return () => { ok = false }
    }, [])

    // Auto context (active OPD/IPD) for chosen patient
    useEffect(() => {
        let ok = true
        if (!patientId) {
            setContext(null)
            return
        }
        ; (async () => {
            try {
                const { data } = await getPharmacyActiveContext(patientId).catch(() => ({ data: null }))
                if (!ok) return
                setContext(data || null)
                if (data?.type === 'ipd') {
                    setSale(s => ({ ...s, context_type: 'ipd' }))
                } else if (data?.type === 'opd') {
                    setSale(s => ({ ...s, context_type: 'opd' }))
                }
            } catch {
                if (!ok) return
                setContext(null)
            }
        })()
        return () => { ok = false }
    }, [patientId])

    // Recent bills
    const loadRecent = async () => {
        setLoadingRecent(true)
        try {
            const { data } = await listSales({ limit: 20 })
            setRecent(data || [])
        } catch (e) {
            toast.error('Failed to load pharmacy bills', {
                description: e?.response?.data?.detail || 'Retry.',
            })
        } finally {
            setLoadingRecent(false)
        }
    }

    useEffect(() => {
        loadRecent()
    }, [])

    const setItem = (idx, patch) =>
        setSale(s => ({
            ...s,
            items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
        }))

    const addItem = () =>
        setSale(s => ({
            ...s,
            items: [...s.items, NEW_ITEM()],
        }))

    const delItem = (idx) =>
        setSale(s => ({
            ...s,
            items: s.items.filter((_, i) => i !== idx),
        }))

    const totals = useMemo(() => {
        let subtotal = 0
        let discount = 0
        let tax = 0
        let totalQty = 0

        for (const it of sale.items) {
            const qty = Number(it.qty || 0)
            const rate = Number(it.unit_price || 0)
            const discPct = Number(it.discount_percent || 0)
            const taxPct = Number(it.tax_percent || 0)

            if (!qty || !rate) continue

            const lineBase = qty * rate
            const lineDisc = lineBase * (discPct / 100)
            const lineAfterDisc = lineBase - lineDisc
            const lineTax = lineAfterDisc * (taxPct / 100)

            subtotal += lineBase
            discount += lineDisc
            tax += lineTax
            totalQty += qty
        }

        const net = subtotal - discount + tax

        return {
            subtotal,
            discount,
            tax,
            net,
            totalQty,
        }
    }, [sale.items])

    const validate = () => {
        if (!patientId && sale.context_type !== 'counter') {
            toast.error('Select patient (for OPD/IPD bills)')
            return false
        }
        if (!sale.items || sale.items.length === 0) {
            toast.error('Add at least one medicine')
            return false
        }
        for (let i = 0; i < sale.items.length; i++) {
            const it = sale.items[i]
            if (!it.medicine_id) {
                toast.error(`Select medicine in row ${i + 1}`)
                return false
            }
            if (!(Number(it.qty) > 0)) {
                toast.error(`Quantity must be > 0 in row ${i + 1}`)
                return false
            }
            if (!(Number(it.unit_price) >= 0)) {
                toast.error(`Unit price invalid in row ${i + 1}`)
                return false
            }
        }
        return true
    }

    const doSave = async ({ withPrint } = { withPrint: false }) => {
        if (!validate()) return
        const payload = {
            patient_id: sale.context_type === 'counter' ? null : (patientId ? Number(patientId) : null),
            context_type: sale.context_type,
            payment_mode: sale.payment_mode,
            notes: sale.notes || '',
            items: sale.items.map(it => ({
                medicine_id: Number(it.medicine_id),
                qty: Number(it.qty || 1),
                unit_price: it.unit_price === '' ? null : Number(it.unit_price),
                tax_percent: it.tax_percent === '' ? null : Number(it.tax_percent),
                discount_percent: it.discount_percent === '' ? null : Number(it.discount_percent),
            })),
        }

        setSaving(true)
        try {
            const { data } = await createSale(payload)
            toast.success('Pharmacy bill created', {
                description: data?.invoice_no
                    ? `Invoice #${data.invoice_no}`
                    : 'Saved successfully.',
            })

            // reload recent
            await loadRecent()

            // reset items but keep patient & context/payment
            setSale(s => ({
                ...s,
                notes: '',
                items: [NEW_ITEM()],
            }))

            if (withPrint) {
                const saleId = data?.id || data?.sale_id
                if (saleId) {
                    try {
                        const blob = await getSalePdf(saleId)
                        openPdfBlob(blob)
                    } catch (e) {
                        toast.error('Unable to open bill PDF', {
                            description: e?.response?.data?.detail || e.message || 'Bill created but PDF failed.',
                        })
                    }
                }
            }
        } catch (e) {
            toast.error('Failed to create pharmacy bill', {
                description: e?.response?.data?.detail || 'Retry.',
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ReceiptIndianRupee className="h-5 w-5 text-slate-700" />
                    <h1 className="text-lg font-semibold">Pharmacy · Billing</h1>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={loadRecent}
                    disabled={loadingRecent}
                >
                    <RotateCw className={`h-4 w-4 mr-2 ${loadingRecent ? 'animate-spin' : ''}`} />
                    Refresh bills
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Left: Create bill */}
                <PermGate anyOf={['pharmacy.billing.create']}>
                    <motion.div
                        className="lg:col-span-2"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Create pharmacy bill</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Patient + meta */}
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="md:col-span-2">
                                        <Label>Patient</Label>
                                        <PatientPicker
                                            value={patientId}
                                            onChange={setPatientId}
                                            disabled={sale.context_type === 'counter'}
                                        />
                                        {sale.context_type === 'counter' && (
                                            <p className="mt-1 text-xs text-slate-500">
                                                Counter sale: patient is optional.
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Context</Label>
                                        <Select
                                            value={sale.context_type}
                                            onValueChange={(v) => setSale(s => ({ ...s, context_type: v }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CONTEXT_TYPES.map(c => (
                                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            disabled
                                            className="mt-1 text-xs"
                                            value={
                                                context
                                                    ? (context.type === 'ipd'
                                                        ? `Active IPD · Admission ${context.admission_id}`
                                                        : `Active OPD · Visit ${context.visit_id}`)
                                                    : 'No active visit detected'
                                            }
                                        />
                                    </div>
                                </div>

                                {/* Payment + notes */}
                                <div className="grid gap-3 md:grid-cols-3 items-end">
                                    <div>
                                        <Label>Payment mode</Label>
                                        <Select
                                            value={sale.payment_mode}
                                            onValueChange={(v) => setSale(s => ({ ...s, payment_mode: v }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PAYMENT_MODES.map(p => (
                                                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label>Notes (optional)</Label>
                                        <Input
                                            placeholder="Remark on bill (e.g., insurance, credit note, etc.)"
                                            value={sale.notes}
                                            onChange={e => setSale(s => ({ ...s, notes: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="flex items-center justify-between mt-2">
                                    <Label className="text-base">Items</Label>
                                    <Button size="sm" variant="outline" type="button" onClick={addItem}>
                                        <Plus className="h-4 w-4 mr-1" /> Add medicine
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {sale.items.map((it, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 8 }}
                                                className="grid gap-2 md:grid-cols-12 items-end rounded-xl border p-2"
                                            >
                                                <div className="md:col-span-4">
                                                    <Label>Medicine</Label>
                                                    <Select
                                                        value={String(it.medicine_id || '')}
                                                        onValueChange={(v) => setItem(idx, { medicine_id: Number(v) })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select medicine…" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {meds.map(m => (
                                                                <SelectItem key={m.id} value={String(m.id)}>
                                                                    {m.code} — {m.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <Label>Qty</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={it.qty}
                                                        onChange={e => setItem(idx, { qty: Number(e.target.value || 1) })}
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <Label>Unit price</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={it.unit_price}
                                                        onChange={e => setItem(idx, { unit_price: e.target.value })}
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <Label>Tax %</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={it.tax_percent}
                                                        onChange={e => setItem(idx, { tax_percent: e.target.value })}
                                                    />
                                                </div>
                                                <div className="md:col-span-1">
                                                    <Label>Disc %</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={it.discount_percent}
                                                        onChange={e => setItem(idx, { discount_percent: e.target.value })}
                                                    />
                                                </div>
                                                <div className="md:col-span-1 flex justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => delItem(idx)}
                                                        className="text-rose-600 hover:text-rose-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {sale.items.length === 0 && (
                                        <div className="text-xs text-slate-500">No items. Click “Add medicine”.</div>
                                    )}
                                </div>

                                {/* Totals */}
                                <div className="mt-2 rounded-xl border bg-slate-50 p-3 text-sm">
                                    <div className="grid gap-2 md:grid-cols-4">
                                        <div>
                                            <span className="text-slate-500">Lines:</span> {sale.items.length}
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Total qty:</span> {totals.totalQty}
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Subtotal:</span> ₹{totals.subtotal.toFixed(2)}
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Discount:</span> ₹{totals.discount.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                        <div>
                                            <span className="text-slate-500">Tax:</span> ₹{totals.tax.toFixed(2)}
                                        </div>
                                        <div className="text-base font-semibold">
                                            Net: ₹{totals.net.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={saving}
                                        onClick={() => {
                                            setSale(s => ({
                                                ...s,
                                                notes: '',
                                                items: [NEW_ITEM()],
                                            }))
                                        }}
                                    >
                                        Clear
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => doSave({ withPrint: false })}
                                    >
                                        {saving ? 'Saving…' : 'Save'}
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => doSave({ withPrint: true })}
                                    >
                                        <Printer className="h-4 w-4 mr-1" />
                                        {saving ? 'Saving…' : 'Save & Print'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </PermGate>

                {/* Right: Recent bills */}
                <motion.div
                    className="lg:col-span-1"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Recent pharmacy bills</CardTitle>
                            {loadingRecent && (
                                <span className="text-[11px] text-slate-500">Loading…</span>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[480px] overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Patient</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(recent || []).map(r => (
                                            <TableRow key={r.id} className="hover:bg-slate-50">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-xs">
                                                            {r.invoice_no || `PB-${String(r.id).padStart(6, '0')}`}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium">
                                                            {r.patient_name || r.patient?.name || (r.patient_id ? `P-${r.patient_id}` : 'Counter sale')}
                                                        </span>
                                                        {r.context_type && (
                                                            <Badge variant="outline" className="w-fit mt-0.5">
                                                                {r.context_type.toUpperCase()}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-semibold">
                                                    ₹{(r.net_amount ?? r.total ?? 0).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                        {(!recent || recent.length === 0) && !loadingRecent && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-6 text-center text-xs text-slate-500">
                                                    No pharmacy bills yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
