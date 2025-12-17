// FILE: src/pharmacy/Locations.jsx
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import {
    listLocations,
    createLocation,
    updateLocation,
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

import { Boxes, Plus, Edit3, Search, RefreshCcw } from 'lucide-react'
import PermGate from '@/components/PermGate'

const EMPTY_LOC = {
    code: '',
    name: '',
    type: 'MAIN_STORE', // MAIN_STORE / SUB_STORE / WARD / OT / OP_PHARMACY / IP_PHARMACY
    is_default: false,
    is_active: true,
}

export default function Locations() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState('')
    const debQ = useDebounce(q, 300)

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(EMPTY_LOC)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listLocations({
                q: debQ || undefined,
                limit: 200,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load locations', {
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
        setForm(EMPTY_LOC)
        setModalOpen(true)
    }

    const openEdit = (loc) => {
        setEditing(loc)
        setForm({
            code: loc.code || '',
            name: loc.name || '',
            type: loc.type || 'MAIN_STORE',
            is_default: !!loc.is_default,
            is_active: loc.is_active !== false,
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
                await updateLocation(editing.id, payload)
                toast.success('Location updated')
            } else {
                await createLocation(payload)
                toast.success('Location created')
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
                    <Boxes className="h-5 w-5 text-slate-800" />
                    <h1 className="text-lg font-semibold">Pharmacy · Stores / Locations</h1>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <PermGate anyOf={['pharmacy.masters.manage']}>
                        <Button size="sm" onClick={openNew}>
                            <Plus className="h-4 w-4 mr-1" />
                            New location
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
                                    placeholder="Code, name, type…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex items-end justify-end text-xs text-slate-500 md:col-span-2">
                            {loading ? 'Loading…' : `${rows.length} location(s)`}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm">Location master</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code / Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Flags</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence initial={false}>
                                    {loading && rows.length === 0 && (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <TableRow key={`sk-${i}`}>
                                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    )}

                                    {rows.map((loc, idx) => (
                                        <motion.tr
                                            key={loc.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            transition={{ delay: idx * 0.01 }}
                                            className="border-b"
                                        >
                                            <TableCell>
                                                <div className="text-sm font-medium">
                                                    {loc.code} — {loc.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {loc.type || 'MAIN_STORE'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {loc.is_default && (
                                                        <Badge variant="outline" className="text-[10px]">
                                                            Default
                                                        </Badge>
                                                    )}
                                                    <Badge
                                                        variant={loc.is_active !== false ? 'outline' : 'destructive'}
                                                        className="text-[10px]"
                                                    >
                                                        {loc.is_active !== false ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <PermGate anyOf={['pharmacy.masters.manage']}>
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-8 w-8"
                                                        onClick={() => openEdit(loc)}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                </PermGate>
                                            </TableCell>
                                        </motion.tr>
                                    ))}

                                    {!loading && rows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">
                                                No locations found.
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit location' : 'New location'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <Label>Code</Label>
                                <Input
                                    value={form.code}
                                    onChange={(e) => updateField('code', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Name</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Type</Label>
                            <select
                                className="w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm"
                                value={form.type}
                                onChange={(e) => updateField('type', e.target.value)}
                            >
                                <option value="MAIN_STORE">MAIN_STORE</option>
                                <option value="SUB_STORE">SUB_STORE</option>
                                <option value="OP_PHARMACY">OP_PHARMACY</option>
                                <option value="IP_PHARMACY">IP_PHARMACY</option>
                                <option value="WARD">WARD</option>
                                <option value="OT">OT</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <input
                                    id="loc_default"
                                    type="checkbox"
                                    className="h-4 w-4 accent-slate-900"
                                    checked={form.is_default}
                                    onChange={(e) => updateField('is_default', e.target.checked)}
                                />
                                <Label htmlFor="loc_default">Default store</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="loc_active"
                                    type="checkbox"
                                    className="h-4 w-4 accent-slate-900"
                                    checked={form.is_active}
                                    onChange={(e) => updateField('is_active', e.target.checked)}
                                />
                                <Label htmlFor="loc_active">Active</Label>
                            </div>
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
