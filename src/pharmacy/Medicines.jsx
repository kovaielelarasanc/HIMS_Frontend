// FILE: src/pharmacy/Medicines.jsx
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import {
    listMedicines,
    createMedicine,
    updateMedicine,
} from '@/api/pharmacy'
import { useDebounce } from '@/shared/useDebounce'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
    Table,
    TableHeader,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

import { Pill, Plus, Edit3, Search, RefreshCcw } from 'lucide-react'
import PermGate from '@/components/PermGate'

const EMPTY_MED = {
    code: '',
    name: '',
    generic_name: '',
    form: '',
    strength: '',
    unit: '',
    pack_size: '',
    manufacturer: '',
    class_name: '',
    atc_code: '',
    lasa_flag: false,
    default_tax_percent: '',
    default_price: '',
    default_mrp: '',
    reorder_level: '',
    is_active: true,
}

export default function Medicines() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState('')
    const debQ = useDebounce(q, 300)

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(EMPTY_MED)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listMedicines({
                q: debQ || undefined,
                limit: 300,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load medicines', {
                description: e?.response?.data?.detail || 'Retry.',
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debQ])

    const openNew = () => {
        setEditing(null)
        setForm(EMPTY_MED)
        setModalOpen(true)
    }

    const openEdit = (med) => {
        setEditing(med)
        setForm({
            code: med.code || '',
            name: med.name || '',
            generic_name: med.generic_name || '',
            form: med.form || '',
            strength: med.strength || '',
            unit: med.unit || '',
            pack_size: med.pack_size || '',
            manufacturer: med.manufacturer || '',
            class_name: med.class_name || '',
            atc_code: med.atc_code || '',
            lasa_flag: !!med.lasa_flag,
            default_tax_percent: med.default_tax_percent ?? '',
            default_price: med.default_price ?? '',
            default_mrp: med.default_mrp ?? '',
            reorder_level: med.reorder_level ?? '',
            is_active: med.is_active !== false,
        })
        setModalOpen(true)
    }

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const onSave = async () => {
        if (!form.code || !form.name) {
            toast.error('Code & Name are mandatory')
            return
        }

        const payload = {
            ...form,
            default_tax_percent: form.default_tax_percent === '' ? null : Number(form.default_tax_percent),
            default_price: form.default_price === '' ? null : Number(form.default_price),
            default_mrp: form.default_mrp === '' ? null : Number(form.default_mrp),
            reorder_level: form.reorder_level === '' ? null : Number(form.reorder_level),
        }

        try {
            if (editing) {
                await updateMedicine(editing.id, payload)
                toast.success('Medicine updated')
            } else {
                await createMedicine(payload)
                toast.success('Medicine created')
            }
            setModalOpen(false)
            await load()
        } catch (e) {
            toast.error('Save failed', {
                description: e?.response?.data?.detail || 'Check payload mapping.',
            })
        }
    }

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Pill className="h-5 w-5 text-slate-800" />
                    <h1 className="text-lg font-semibold">Pharmacy · Medicines</h1>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <PermGate anyOf={['pharmacy.masters.manage']}>
                        <Button size="sm" onClick={openNew}>
                            <Plus className="h-4 w-4 mr-1" />
                            New medicine
                        </Button>
                    </PermGate>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-3 text-sm">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Code, name, generic…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex items-end justify-end text-xs text-slate-500 md:col-span-2">
                            {loading ? 'Loading…' : `${rows.length} medicine(s)`}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm">Medicine master</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code / Name</TableHead>
                                    <TableHead>Generic / Class</TableHead>
                                    <TableHead>Form / Strength</TableHead>
                                    <TableHead>Pack / MRP</TableHead>
                                    <TableHead>Reorder</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence initial={false}>
                                    {loading && rows.length === 0 && (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <TableRow key={`sk-${i}`}>
                                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    )}

                                    {rows.map((m, idx) => (
                                        <motion.tr
                                            key={m.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            transition={{ delay: idx * 0.01 }}
                                            className="border-b"
                                        >
                                            <TableCell>
                                                <div className="text-sm font-medium">
                                                    {m.code} — {m.name}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {m.manufacturer}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    {m.generic_name || '—'}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {m.class_name || '—'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    {m.form || '—'} {m.strength || ''}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {m.unit || ''} · {m.atc_code || ''}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                Pack {m.pack_size || '—'}
                                                <div className="text-[11px] text-slate-500">
                                                    MRP ₹{(m.default_mrp ?? 0).toFixed(2)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {m.reorder_level ?? 0}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge
                                                        variant={m.is_active !== false ? 'outline' : 'destructive'}
                                                        className="text-[10px] w-fit"
                                                    >
                                                        {m.is_active !== false ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                    {m.lasa_flag && (
                                                        <Badge variant="destructive" className="text-[10px] w-fit">
                                                            LASA
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <PermGate anyOf={['pharmacy.masters.manage']}>
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-8 w-8"
                                                        onClick={() => openEdit(m)}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                </PermGate>
                                            </TableCell>
                                        </motion.tr>
                                    ))}

                                    {!loading && rows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">
                                                No medicines found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create / Edit dialog */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Edit medicine' : 'New medicine'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Code</Label>
                                <Input
                                    value={form.code}
                                    onChange={(e) => updateField('code', e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Name (Brand)</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Generic name</Label>
                                <Input
                                    value={form.generic_name}
                                    onChange={(e) => updateField('generic_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Form</Label>
                                <Input
                                    placeholder="tablet, syrup…"
                                    value={form.form}
                                    onChange={(e) => updateField('form', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Strength</Label>
                                <Input
                                    placeholder="500 mg / 5 mg/ml"
                                    value={form.strength}
                                    onChange={(e) => updateField('strength', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                            <div>
                                <Label>Unit</Label>
                                <Input
                                    placeholder="tablet, ml…"
                                    value={form.unit}
                                    onChange={(e) => updateField('unit', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Pack size</Label>
                                <Input
                                    placeholder="10, 100 ml…"
                                    value={form.pack_size}
                                    onChange={(e) => updateField('pack_size', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Default tax %</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.default_tax_percent}
                                    onChange={(e) => updateField('default_tax_percent', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Reorder level</Label>
                                <Input
                                    type="number"
                                    value={form.reorder_level}
                                    onChange={(e) => updateField('reorder_level', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Default price</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.default_price}
                                    onChange={(e) => updateField('default_price', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Default MRP</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.default_mrp}
                                    onChange={(e) => updateField('default_mrp', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Manufacturer</Label>
                                <Input
                                    value={form.manufacturer}
                                    onChange={(e) => updateField('manufacturer', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Therapeutic class</Label>
                                <Input
                                    value={form.class_name}
                                    onChange={(e) => updateField('class_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>ATC code</Label>
                                <Input
                                    value={form.atc_code}
                                    onChange={(e) => updateField('atc_code', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-6">
                                <input
                                    id="lasa_flag"
                                    type="checkbox"
                                    className="h-4 w-4 accent-slate-900"
                                    checked={form.lasa_flag}
                                    onChange={(e) => updateField('lasa_flag', e.target.checked)}
                                />
                                <Label htmlFor="lasa_flag">LASA (Look-Alike / Sound-Alike)</Label>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="is_active"
                                type="checkbox"
                                className="h-4 w-4 accent-slate-900"
                                checked={form.is_active}
                                onChange={(e) => updateField('is_active', e.target.checked)}
                            />
                            <Label htmlFor="is_active">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Cancel
                        </Button>
                        <PermGate anyOf={['pharmacy.masters.manage']}>
                            <Button onClick={onSave}>
                                {editing ? 'Update' : 'Save'}
                            </Button>
                        </PermGate>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
