// FILE: src/pharmacy/PurchaseOrders.jsx
import { useEffect, useMemo, useState } from 'react'
import { Plus, Loader2, Printer } from 'lucide-react'
import {
    listPO,
    createPO,
    approvePO,
    cancelPO,
    listSuppliers,
    listLocations,
    listMedicines,
    getPurchaseOrderPdf,
} from '../api/pharmacy'
import PermGate from '../components/PermGate'

import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    Select, SelectTrigger, SelectItem, SelectContent, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const statusTone = (s) => {
    switch (s) {
        case 'draft': return 'bg-gray-50 text-gray-700 border-gray-200'
        case 'approved': return 'bg-blue-50 text-blue-700 border-blue-200'
        case 'closed': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        case 'cancelled': return 'bg-rose-50 text-rose-700 border-rose-200'
        default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
}

function openPdfBlob(blob) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function PurchaseOrders() {
    const [rows, setRows] = useState([])
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [actionId, setActionId] = useState(null) // which PO is acting (approve/cancel/print)

    const [open, setOpen] = useState(false)
    const [suppliers, setSuppliers] = useState([])
    const [locations, setLocations] = useState([])
    const [meds, setMeds] = useState([])
    const [v, setV] = useState({ supplier_id: '', location_id: '', items: [] })

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listPO({ q: q || undefined })
            setRows(data || [])
        } catch (e) {
            toast.error('Load failed', { description: e?.response?.data?.detail || 'Retry' })
        } finally { setLoading(false) }
    }
    useEffect(() => { load() /* eslint-disable-next-line */ }, [q])

    useEffect(() => {
        ; (async () => {
            try {
                const [s, l, m] = await Promise.all([
                    listSuppliers().then(r => r.data || []),
                    listLocations().then(r => r.data || []),
                    listMedicines({ limit: 500 }).then(r => r.data || []),
                ])
                setSuppliers(s); setLocations(l); setMeds(m)
            } catch (e) {
                toast.error('Failed to load lookups', { description: e?.response?.data?.detail || 'Retry' })
            }
        })()
    }, [])

    const addItem = () => setV(s => ({ ...s, items: [...s.items, { medicine_id: '', qty: 1 }] }))
    const setItem = (idx, patch) => setV(s => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }))
    const delItem = (idx) => setV(s => ({ ...s, items: s.items.filter((_, i) => i !== idx) }))

    const canSave = useMemo(() => {
        if (!v.supplier_id || !v.location_id) return false
        const validLines = v.items.filter(it => Number(it.medicine_id) && Number(it.qty) > 0)
        return validLines.length > 0
    }, [v])

    const totalLines = v.items.length
    const totalQty = v.items.reduce((a, b) => a + Number(b.qty || 0), 0)

    const save = async () => {
        try {
            const payload = {
                supplier_id: Number(v.supplier_id),
                location_id: Number(v.location_id),
                items: v.items
                    .filter(it => Number(it.medicine_id) && Number(it.qty) > 0)
                    .map(it => ({ medicine_id: Number(it.medicine_id), qty: Number(it.qty || 1) })),
            }
            await createPO(payload)
            setOpen(false)
            setV({ supplier_id: '', location_id: '', items: [] })
            await load()
            toast.success('PO created', { description: 'Purchase order saved' })
        } catch (e) {
            toast.error('Save failed', { description: e?.response?.data?.detail || 'Retry' })
        }
    }

    const approve = async (id) => {
        try {
            setActionId(id)
            await approvePO(id)
            await load()
            toast.success('Approved')
        } catch (e) {
            toast.error('Approve failed', { description: e?.response?.data?.detail || 'Retry' })
        } finally { setActionId(null) }
    }

    const cancel = async (id) => {
        if (!window.confirm('Cancel this purchase order?')) return
        try {
            setActionId(id)
            await cancelPO(id)
            await load()
            toast.success('Cancelled')
        } catch (e) {
            toast.error('Cancel failed', { description: e?.response?.data?.detail || 'Retry' })
        } finally { setActionId(null) }
    }

    const printPo = async (id) => {
        if (!id) return
        try {
            setActionId(id)
            const blob = await getPurchaseOrderPdf(id)
            openPdfBlob(blob)
        } catch (e) {
            toast.error('Print failed', {
                description: e?.response?.data?.detail || e.message || 'Unable to open PO PDF',
            })
        } finally {
            setActionId(null)
        }
    }

    return (
        <div className="p-4 space-y-4">
            {/* If you already mount a global Toaster, remove the next line */}
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Purchase Orders</h1>
                <PermGate anyOf={['pharmacy.procure.manage']}>
                    <Button onClick={() => setOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> New PO
                    </Button>
                </PermGate>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid gap-3 md:grid-cols-3 items-end">
                        <div className="md:col-span-1">
                            <Label>Search</Label>
                            <Input
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Supplier, location, code…"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <Card>
                <CardHeader><CardTitle>PO List</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence initial={false}>
                                    {loading && rows.length === 0 && (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <TableRow key={`sk-${i}`}>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-6 w-24 rounded-md" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-8 w-28 rounded-md ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    )}

                                    {(rows || []).map(r => (
                                        <motion.tr
                                            key={r.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 8 }}
                                            className="border-b"
                                        >
                                            <TableCell>PO-{String(r.id).padStart(6, '0')}</TableCell>
                                            <TableCell>{r.supplier_name || r.supplier_id}</TableCell>
                                            <TableCell>{r.location_code || r.location_id}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${statusTone(r.status)}`}>
                                                    {r.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <PermGate anyOf={['pharmacy.procure.manage']}>
                                                    <div className="inline-flex gap-2 items-center">
                                                        {/* Print is allowed for any status */}
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => printPo(r.id)}
                                                            title="Print / PDF"
                                                            disabled={actionId === r.id && loading}
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </Button>

                                                        {r.status === 'draft' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => approve(r.id)}
                                                                disabled={actionId === r.id}
                                                            >
                                                                {actionId === r.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                                                Approve
                                                            </Button>
                                                        )}
                                                        {r.status !== 'cancelled' && r.status !== 'closed' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => cancel(r.id)}
                                                                disabled={actionId === r.id}
                                                            >
                                                                {actionId === r.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                                                Cancel
                                                            </Button>
                                                        )}
                                                    </div>
                                                </PermGate>
                                            </TableCell>
                                        </motion.tr>
                                    ))}

                                    {!loading && rows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-sm text-gray-500">
                                                No purchase orders
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create PO dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>

                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div>
                            <Label>Supplier</Label>
                            <Select
                                value={String(v.supplier_id)}
                                onValueChange={(val) => setV(s => ({ ...s, supplier_id: Number(val) }))}
                            >
                                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Location</Label>
                            <Select
                                value={String(v.location_id)}
                                onValueChange={(val) => setV(s => ({ ...s, location_id: Number(val) }))}
                            >
                                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                    {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.code} — {l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="mt-1">
                        <div className="flex items-center justify-between">
                            <Label>Items</Label>
                            <div className="flex items-center gap-3">
                                <div className="text-xs text-gray-600">
                                    Lines: <span className="font-medium">{totalLines}</span> · Qty: <span className="font-medium">{totalQty}</span>
                                </div>
                                <Button size="sm" variant="outline" onClick={addItem}>
                                    <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                            </div>
                        </div>

                        <div className="mt-2 space-y-2">
                            {v.items.map((it, idx) => (
                                <div key={idx} className="grid gap-2 md:grid-cols-6 items-end">
                                    <div className="md:col-span-4">
                                        <Label>Medicine</Label>
                                        <Select
                                            value={String(it.medicine_id)}
                                            onValueChange={(val) => setItem(idx, { medicine_id: Number(val) })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                                            <SelectContent>
                                                {meds.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.code} — {m.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Qty</Label>
                                        <Input
                                            type="number"
                                            value={it.qty}
                                            onChange={e => setItem(idx, { qty: Number(e.target.value || 1) })}
                                        />
                                    </div>
                                    <div className="flex">
                                        <Button size="sm" variant="outline" onClick={() => delItem(idx)}>Remove</Button>
                                    </div>
                                </div>
                            ))}
                            {v.items.length === 0 && (
                                <div className="text-xs text-gray-500">No items yet.</div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={!canSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
