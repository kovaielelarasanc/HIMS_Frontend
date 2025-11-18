// src/pharmacy/Locations.jsx
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { listLocations, createLocation, updateLocation, deleteLocation } from '../api/pharmacy'
import PermGate from '../components/PermGate'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useDebounce } from '../shared/useDebounce'

export default function Locations() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const [q, setQ] = useState('')
    const debQ = useDebounce(q, 250)

    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [v, setV] = useState({ code: '', name: '', is_active: true })
    const [saving, setSaving] = useState(false)

    const change = (k, val) => setV(s => ({ ...s, [k]: val }))

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listLocations({ q: debQ || undefined })
            setRows(data || [])
        } catch (e) {
            toast.error('Load failed', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() /* eslint-disable-next-line */ }, [debQ])

    const openNew = () => {
        setEditing(null)
        setV({ code: '', name: '', is_active: true })
        setOpen(true)
    }
    const openEdit = (row) => {
        setEditing(row)
        setV({ code: row.code || '', name: row.name || '', is_active: !!row.is_active })
        setOpen(true)
    }

    const save = async () => {
        if (!v.code?.trim() || !v.name?.trim()) {
            toast.error('Missing fields', { description: 'Code and Name are required.' })
            return
        }
        setSaving(true)
        try {
            if (editing) await updateLocation(editing.id, v)
            else await createLocation(v)
            setOpen(false)
            setEditing(null)
            await load()
            toast.success('Saved', { description: 'Location saved successfully.' })
        } catch (e) {
            toast.error('Save failed', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setSaving(false)
        }
    }

    const del = async (row) => {
        if (!window.confirm(`Delete location "${row.name}"? This cannot be undone.`)) return
        try {
            await deleteLocation(row.id)
            await load()
            toast.success('Deleted', { description: 'Location removed.' })
        } catch (e) {
            toast.error('Delete failed', { description: e?.response?.data?.detail || 'Please retry.' })
        }
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Locations</h1>
                <PermGate anyOf={['pharmacy.masters.manage']}>
                    <Button onClick={openNew}>
                        <Plus className="h-4 w-4 mr-2" /> New
                    </Button>
                </PermGate>
            </div>

            <Card>
                <CardHeader><CardTitle>Locations</CardTitle></CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    className="pl-9"
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    placeholder="Code, name…"
                                />
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="mt-4 overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white">
                                <TableRow>
                                    <TableHead className="w-[160px]">Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="w-[140px]">Status</TableHead>
                                    <TableHead className="w-[120px]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Skeletons while loading */}
                                {loading && Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={`sk-${i}`}>
                                        <TableCell><div className="h-4 w-28 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-64 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-5 w-20 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell />
                                    </TableRow>
                                ))}

                                {!loading && rows.map(r => (
                                    <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <TableCell className="font-mono">{r.code}</TableCell>
                                        <TableCell className="font-medium">{r.name}</TableCell>
                                        <TableCell>
                                            {r.is_active
                                                ? <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50">Active</Badge>
                                                : <Badge variant="outline" className="text-gray-600">Inactive</Badge>
                                            }
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <PermGate anyOf={['pharmacy.masters.manage']}>
                                                <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => del(r)} title="Delete">
                                                        <Trash2 className="h-4 w-4 text-rose-600" />
                                                    </Button>
                                                </div>
                                            </PermGate>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {!loading && rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6 text-sm text-gray-500">No locations</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Location' : 'New Location'}</DialogTitle>
                    </DialogHeader>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={editing ? 'edit' : 'new'}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                            className="grid gap-3 md:grid-cols-2 text-sm"
                        >
                            <div>
                                <Label>Code</Label>
                                <Input
                                    value={v.code}
                                    onChange={e => change('code', e.target.value)}
                                    placeholder="e.g. MAIN, ICU, SAT1"
                                />
                            </div>
                            <div>
                                <Label>Name</Label>
                                <Input
                                    value={v.name}
                                    onChange={e => change('name', e.target.value)}
                                    placeholder="Main Pharmacy"
                                />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-2 pt-1">
                                <input
                                    id="loc-active"
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={!!v.is_active}
                                    onChange={e => change('is_active', e.target.checked)}
                                />
                                <Label htmlFor="loc-active">Active</Label>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
