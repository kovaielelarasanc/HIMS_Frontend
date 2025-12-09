// FILE: src/pharmacy/GRN.jsx
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Loader2, ReceiptText, Printer } from 'lucide-react'
import {
    listGRN,
    createGRN,
    listSuppliers,
    listLocations,
    listMedicines,
    listPO,
    getGrnPdf,
} from '../api/pharmacy'
import PermGate from '../components/PermGate'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectTrigger, SelectItem, SelectContent, SelectValue } from '@/components/ui/select'

import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

function openPdfBlob(blob) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function GRN() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const [suppliers, setSuppliers] = useState([])
    const [locations, setLocations] = useState([])
    const [meds, setMeds] = useState([])
    const [pos, setPOs] = useState([])

    const [v, setV] = useState({
        supplier_id: '',
        location_id: '',
        po_id: '',
        items: [],
    })

    const addItem = () =>
        setV(s => ({
            ...s,
            items: [
                ...s.items,
                {
                    medicine_id: '',
                    batch: '',
                    expiry: '',
                    qty: 1,
                    unit_cost: '',
                    tax_percent: '',
                    sell_price: '',
                    mrp: '',
                },
            ],
        }))

    const setItem = (idx, patch) =>
        setV(s => ({
            ...s,
            items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
        }))

    const delItem = idx =>
        setV(s => ({
            ...s,
            items: s.items.filter((_, i) => i !== idx),
        }))

    const resetForm = () => {
        setV({ supplier_id: '', location_id: '', po_id: '', items: [] })
    }

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listGRN()
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load GRNs', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    useEffect(() => {
        ; (async () => {
            try {
                const [s, l, m, p] = await Promise.all([
                    listSuppliers().then(r => r.data || []),
                    listLocations().then(r => r.data || []),
                    listMedicines({ limit: 1000, is_active: true }).then(r => r.data || []),
                    listPO({ status: 'approved' }).then(r => r.data || []),
                ])
                setSuppliers(s)
                setLocations(l)
                setMeds(m)
                setPOs(p)
            } catch (e) {
                toast.error('Failed to load lookups', { description: e?.response?.data?.detail || 'Please refresh and try again.' })
            }
        })()
    }, [])

    // Calculated totals for the current GRN draft
    const totals = useMemo(() => {
        let qty = 0
        let subtotal = 0
        let tax = 0
        for (const it of v.items) {
            const q = Number(it.qty || 0)
            const uc = Number(it.unit_cost || 0)
            const tx = Number(it.tax_percent || 0)
            qty += q
            const line = q * uc
            subtotal += line
            tax += line * (tx / 100)
        }
        return {
            qty,
            subtotal,
            tax,
            grand: subtotal + tax,
        }
    }, [v.items])

    const validate = () => {
        if (!v.supplier_id) return 'Please select a supplier.'
        if (!v.location_id) return 'Please select a location.'
        if (!Array.isArray(v.items) || v.items.length === 0) return 'Add at least one item.'
        for (let i = 0; i < v.items.length; i++) {
            const it = v.items[i]
            if (!it.medicine_id) return `Row ${i + 1}: select a medicine.`
            if (!it.batch) return `Row ${i + 1}: enter batch.`
            if (!it.expiry) return `Row ${i + 1}: enter expiry date.`
            if (!(Number(it.qty) > 0)) return `Row ${i + 1}: quantity must be > 0.`
            if (!(Number(it.unit_cost) >= 0)) return `Row ${i + 1}: unit cost invalid.`
        }
        return null
    }

    const save = async () => {
        const err = validate()
        if (err) {
            toast.error('Cannot save GRN', { description: err })
            return
        }

        const payload = {
            supplier_id: Number(v.supplier_id),
            location_id: Number(v.location_id),
            po_id: v.po_id ? Number(v.po_id) : undefined,
            items: v.items.map(it => ({
                medicine_id: Number(it.medicine_id),
                batch: it.batch,
                expiry: it.expiry,
                qty: Number(it.qty || 1),
                unit_cost: Number(it.unit_cost || 0),
                tax_percent: it.tax_percent === '' ? null : Number(it.tax_percent),
                sell_price: it.sell_price === '' ? null : Number(it.sell_price),
                mrp: it.mrp === '' ? null : Number(it.mrp),
            })),
        }

        setSaving(true)
        try {
            const res = await createGRN(payload)
            const id = res?.data?.id
            setOpen(false)
            resetForm()
            await load()
            toast.success('GRN created', {
                description: id
                    ? `GRN-${String(id).padStart(6, '0')} • ${payload.items.length} line(s) • ${totals.qty} units`
                    : 'Stock received.',
            })
        } catch (e) {
            toast.error('Save failed', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setSaving(false)
        }
    }

    const NONE = '__none__';
    const toSel = (v) => (v === '' || v == null ? NONE : String(v));
    const fromSel = (v) => (v === NONE ? '' : Number(v));

    const printGrn = async (id) => {
        if (!id) return
        try {
            const blob = await getGrnPdf(id)
            openPdfBlob(blob)
        } catch (e) {
            toast.error('Unable to open GRN PDF', {
                description: e?.response?.data?.detail || e.message || 'Please try again.',
            })
        }
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Goods Receipt (GRN)</h1>
                <PermGate anyOf={['pharmacy.procure.manage']}>
                    <Button onClick={() => setOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> New GRN
                    </Button>
                </PermGate>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <ReceiptText className="h-5 w-5" />
                        Recent GRNs
                    </CardTitle>
                    {loading && (
                        <span className="inline-flex items-center text-xs text-gray-500">
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Loading…
                        </span>
                    )}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>PO</TableHead>
                                <TableHead>Received</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(rows || []).map(r => (
                                <TableRow key={r.id} className="hover:bg-gray-50">
                                    <TableCell>GRN-{String(r.id).padStart(6, '0')}</TableCell>
                                    <TableCell>{r.supplier_name || r.supplier_id}</TableCell>
                                    <TableCell>{r.location_code || r.location_id}</TableCell>
                                    <TableCell>{r.po_id ? `PO-${String(r.po_id).padStart(6, '0')}` : '—'}</TableCell>
                                    <TableCell>{new Date(r.received_at).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => printGrn(r.id)}
                                            title="Print GRN / PDF"
                                        >
                                            <Printer className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!loading && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-6 text-sm text-gray-500">
                                        No GRNs yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {loading && (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="py-4"><div className="h-4 w-24 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-36 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-28 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-40 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-16 animate-pulse rounded bg-gray-200 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm() }}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>New GRN</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-3 md:grid-cols-3 text-sm">
                        <div>
                            <Label>Supplier</Label>
                            <Select
                                value={v.supplier_id ? String(v.supplier_id) : undefined}
                                onValueChange={(val) => setV(s => ({ ...s, supplier_id: Number(val) }))}
                            >
                                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Location</Label>
                            <Select
                                value={v.location_id ? String(v.location_id) : undefined}
                                onValueChange={(val) => setV(s => ({ ...s, location_id: Number(val) }))}
                            >
                                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                    {locations.map(l => (
                                        <SelectItem key={l.id} value={String(l.id)}>{l.code} — {l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>PO (optional)</Label>
                            <Select
                                value={toSel(v.po_id)}
                                onValueChange={(val) => setV(s => ({ ...s, po_id: fromSel(val) }))}
                            >
                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>—</SelectItem>
                                    {pos.map(p => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {`PO-${String(p.id).padStart(6, '0')} (${p.supplier_name || p.supplier_id})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-[13px] uppercase tracking-wide text-gray-600">Items</Label>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={addItem}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>

                        <div className="mt-2 space-y-2">
                            <AnimatePresence initial={false}>
                                {v.items.map((it, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="grid gap-2 md:grid-cols-8 items-end rounded-xl border p-2"
                                    >
                                        <div className="md:col-span-3">
                                            <Label>Medicine</Label>
                                            <Select
                                                value={String(it.medicine_id)}
                                                onValueChange={val => setItem(idx, { medicine_id: Number(val) })}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                                                <SelectContent>
                                                    {meds.map(m => (
                                                        <SelectItem key={m.id} value={String(m.id)}>{m.code} — {m.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Batch</Label>
                                            <Input value={it.batch} onChange={e => setItem(idx, { batch: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Expiry</Label>
                                            <Input type="date" value={it.expiry} onChange={e => setItem(idx, { expiry: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Qty</Label>
                                            <Input type="number" min={1} value={it.qty} onChange={e => setItem(idx, { qty: Number(e.target.value || 1) })} />
                                        </div>
                                        <div>
                                            <Label>Unit cost</Label>
                                            <Input type="number" step="0.01" value={it.unit_cost} onChange={e => setItem(idx, { unit_cost: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Tax %</Label>
                                            <Input type="number" step="0.01" value={it.tax_percent} onChange={e => setItem(idx, { tax_percent: e.target.value })} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <Label>Sell / MRP</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input placeholder="Sell" type="number" step="0.01" value={it.sell_price} onChange={e => setItem(idx, { sell_price: e.target.value })} />
                                                <Input placeholder="MRP" type="number" step="0.01" value={it.mrp} onChange={e => setItem(idx, { mrp: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="md:col-span-8 flex justify-end">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => delItem(idx)}
                                                className="text-rose-600 hover:text-rose-700"
                                                title="Remove row"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {v.items.length === 0 && <div className="text-xs text-gray-500">No items yet.</div>}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="mt-4 rounded-xl border bg-gray-50 p-3 text-sm">
                        <div className="grid gap-2 md:grid-cols-4">
                            <div><span className="text-gray-500">Lines:</span> {v.items.length}</div>
                            <div><span className="text-gray-500">Total Qty:</span> {totals.qty}</div>
                            <div><span className="text-gray-500">Subtotal:</span> {totals.subtotal.toFixed(2)}</div>
                            <div><span className="text-gray-500">Tax:</span> {totals.tax.toFixed(2)}</div>
                        </div>
                        <div className="mt-1 font-medium">
                            Grand Total: {totals.grand.toFixed(2)}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
