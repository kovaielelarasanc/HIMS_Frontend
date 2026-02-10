// FILE: src/pharmacy/Suppliers.jsx
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import {
    listSuppliers,
    createSupplier,
    updateSupplier,
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

import { Truck, Plus, Edit3, Search, RefreshCcw } from 'lucide-react'
import PermGate from '@/components/PermGate'

const EMPTY_SUP = {
    code: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    gst_no: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    is_active: true,
}

export default function Suppliers() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState('')
    const debQ = useDebounce(q, 300)

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(EMPTY_SUP)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listSuppliers({
                q: debQ || undefined,
                limit: 300,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load suppliers', {
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
        setForm(EMPTY_SUP)
        setModalOpen(true)
    }

    const openEdit = (s) => {
        setEditing(s)
        setForm({
            code: s.code || '',
            name: s.name || '',
            contact_person: s.contact_person || '',
            phone: s.phone || '',
            email: s.email || '',
            gst_no: s.gst_no || '',
            address: s.address || '',
            city: s.city || '',
            state: s.state || '',
            pincode: s.pincode || '',
            is_active: s.is_active !== false,
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

        const payload = { ...form }
        try {
            if (editing) {
                await updateSupplier(editing.id, payload)
                toast.success('Supplier updated')
            } else {
                await createSupplier(payload)
                toast.success('Supplier created')
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
                    <Truck className="h-5 w-5 text-slate-800" />
                    <h1 className="text-lg font-semibold">Pharmacy · Suppliers</h1>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <PermGate anyOf={['pharmacy.inventory.suppliers.manage']}>
                        <Button size="sm" onClick={openNew}>
                            <Plus className="h-4 w-4 mr-1" />
                            New supplier
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
                                    placeholder="Code, name, city, GST…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex items-end justify-end text-xs text-slate-500 md:col-span-2">
                            {loading ? 'Loading…' : `${rows.length} supplier(s)`}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm">Supplier master</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code / Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>City / State</TableHead>
                                    <TableHead>GST</TableHead>
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
                                                <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    )}

                                    {rows.map((s, idx) => (
                                        <motion.tr
                                            key={s.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            transition={{ delay: idx * 0.01 }}
                                            className="border-b"
                                        >
                                            <TableCell>
                                                <div className="text-sm font-medium">
                                                    {s.code} — {s.name}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {s.address}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    {s.contact_person || '—'}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {s.phone} {s.email ? `· ${s.email}` : ''}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {s.city} {s.state ? `· ${s.state}` : ''}
                                                <div className="text-[11px] text-slate-500">
                                                    {s.pincode}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {s.gst_no || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={s.is_active !== false ? 'outline' : 'destructive'}
                                                    className="text-[10px]"
                                                >
                                                    {s.is_active !== false ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <PermGate anyOf={['pharmacy.inventory.suppliers.manage']}>
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-8 w-8"
                                                        onClick={() => openEdit(s)}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                </PermGate>
                                            </TableCell>
                                        </motion.tr>
                                    ))}

                                    {!loading && rows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                                                No suppliers found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit supplier' : 'New supplier'}</DialogTitle>
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
                                <Label>Name</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Contact person</Label>
                                <Input
                                    value={form.contact_person}
                                    onChange={(e) => updateField('contact_person', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    value={form.phone}
                                    onChange={(e) => updateField('phone', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateField('email', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Address</Label>
                            <Input
                                value={form.address}
                                onChange={(e) => updateField('address', e.target.value)}
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>City</Label>
                                <Input
                                    value={form.city}
                                    onChange={(e) => updateField('city', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>State</Label>
                                <Input
                                    value={form.state}
                                    onChange={(e) => updateField('state', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Pincode</Label>
                                <Input
                                    value={form.pincode}
                                    onChange={(e) => updateField('pincode', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>GST No</Label>
                            <Input
                                value={form.gst_no}
                                onChange={(e) => updateField('gst_no', e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                id="sup_active"
                                type="checkbox"
                                className="h-4 w-4 accent-slate-900"
                                checked={form.is_active}
                                onChange={(e) => updateField('is_active', e.target.checked)}
                            />
                            <Label htmlFor="sup_active">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Cancel
                        </Button>
                        <PermGate anyOf={['pharmacy.inventory.suppliers.manage']}>
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
