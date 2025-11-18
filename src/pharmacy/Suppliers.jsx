// src/pharmacy/Suppliers.jsx
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import {
    listSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
} from '../api/pharmacy'
import PermGate from '../components/PermGate'

import { Toaster, toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'

export default function Suppliers() {
    const [rows, setRows] = useState([])
    const [q, setQ] = useState('')
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)

    const [v, setV] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        gstin: '',
        address: '',
        payment_terms: '',
        is_active: true,
    })

    const load = async () => {
        try {
            const { data } = await listSuppliers({ q: q || undefined })
            setRows(data || [])
        } catch (e) {
            toast.error('Load failed', { description: e?.response?.data?.detail || 'Please retry.' })
        }
    }
    useEffect(() => { load() /* eslint-disable-next-line */ }, [q])

    const change = (k, val) => setV(s => ({ ...s, [k]: val }))

    const resetForm = () => {
        setEditing(null)
        setV({
            name: '',
            contact_person: '',
            phone: '',
            email: '',
            gstin: '',
            address: '',
            payment_terms: '',
            is_active: true,
        })
    }

    const onNew = () => { resetForm(); setOpen(true) }
    const onEdit = (row) => { setEditing(row); setV({ ...row }); setOpen(true) }

    const validate = () => {
        if (!v.name?.trim()) return 'Name is required'
        if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return 'Invalid email'
        if (v.phone && !/^[\d+\-\s()]{6,}$/.test(v.phone)) return 'Invalid phone'
        return null
    }

    const save = async () => {
        const err = validate()
        if (err) { toast.error('Validation error', { description: err }); return }

        setSaving(true)
        try {
            if (editing) await updateSupplier(editing.id, v)
            else await createSupplier(v)

            setOpen(false)
            setEditing(null)
            await load()
            toast.success('Saved', { description: 'Supplier saved successfully.' })
        } catch (e) {
            toast.error('Save failed', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setSaving(false)
        }
    }

    const del = async (row) => {
        if (!window.confirm(`Delete ${row.name}?`)) return
        try {
            await deleteSupplier(row.id)
            await load()
            toast.success('Deleted', { description: 'Supplier removed.' })
        } catch (e) {
            toast.error('Delete failed', { description: e?.response?.data?.detail || 'Please retry.' })
        }
    }

    return (
        <div className="p-4 space-y-4">
            {/* If you already have a global <Toaster />, you can remove this one */}
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Suppliers</h1>
                <PermGate anyOf={['pharmacy.masters.manage']}>
                    <Button onClick={onNew}>
                        <Plus className="h-4 w-4 mr-2" /> New
                    </Button>
                </PermGate>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
            >
                <Card>
                    <CardHeader><CardTitle>Suppliers</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Search</Label>
                                <Input
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    placeholder="Name, phone, email, GSTIN"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>GSTIN</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(rows || []).map((r, i) => (
                                            <motion.tr
                                                key={r.id}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.01 * i }}
                                                className="border-b"
                                            >
                                                <TableCell className="font-medium">{r.name}</TableCell>
                                                <TableCell>{r.contact_person || '—'} · {r.email || '—'}</TableCell>
                                                <TableCell>{r.phone || '—'}</TableCell>
                                                <TableCell>{r.gstin || '—'}</TableCell>
                                                <TableCell>
                                                    <span className={[
                                                        'rounded-md px-2 py-0.5 text-xs border',
                                                        r.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-gray-50 text-gray-600 border-gray-200',
                                                    ].join(' ')}>
                                                        {r.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <PermGate anyOf={['pharmacy.masters.manage']}>
                                                        <Button size="icon" variant="ghost" onClick={() => onEdit(r)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={() => del(r)}>
                                                            <Trash2 className="h-4 w-4 text-rose-600" />
                                                        </Button>
                                                    </PermGate>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                        {rows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-6 text-sm text-gray-500">
                                                    No suppliers
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div className="md:col-span-2">
                            <Label>Name</Label>
                            <Input value={v.name} onChange={e => change('name', e.target.value)} required />
                        </div>
                        <div>
                            <Label>Contact person</Label>
                            <Input value={v.contact_person} onChange={e => change('contact_person', e.target.value)} />
                        </div>
                        <div>
                            <Label>Phone</Label>
                            <Input value={v.phone} onChange={e => change('phone', e.target.value)} />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input value={v.email} onChange={e => change('email', e.target.value)} />
                        </div>
                        <div>
                            <Label>GSTIN</Label>
                            <Input value={v.gstin} onChange={e => change('gstin', e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Address</Label>
                            <Input value={v.address} onChange={e => change('address', e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Payment terms</Label>
                            <Input value={v.payment_terms} onChange={e => change('payment_terms', e.target.value)} />
                        </div>

                        <Separator className="md:col-span-2" />
                        <div className="flex gap-2 items-center md:col-span-2">
                            <input
                                id="sup-active"
                                type="checkbox"
                                className="h-4 w-4"
                                checked={!!v.is_active}
                                onChange={e => change('is_active', e.target.checked)}
                            />
                            <Label htmlFor="sup-active">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
