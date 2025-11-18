import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Upload, Download, Pencil, Trash2 } from 'lucide-react'
import { useDebounce } from '../shared/useDebounce'
import PermGate from '../components/PermGate'

import {
    listMedicines, createMedicine, updateMedicine, deleteMedicine,
    downloadMedicineSample, importMedicines
} from '../api/pharmacy'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Toaster, toast } from 'sonner'

const FORMS = ['tablet', 'injection', 'syrup', 'capsule', 'ointment', 'drops', 'tonic', 'other']
const ALL = '__all__'
const fromSelect = (v) => (v === ALL ? '' : v)

export default function Medicines() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    // Filters
    const [q, setQ] = useState('')
    const [formFilter, setFormFilter] = useState('')
    const [classFilter, setClassFilter] = useState('')
    const [activeOnly, setActiveOnly] = useState(true)
    const debQ = useDebounce(q, 250)

    // Create/Edit dialog
    const [editing, setEditing] = useState(null)
    const [showForm, setShowForm] = useState(false)

    // Import wizard
    const [showImport, setShowImport] = useState(false)
    const [file, setFile] = useState(null)
    const [importFormat, setImportFormat] = useState('xlsx') // for sample download only
    const [importing, setImporting] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listMedicines({
                q: debQ || undefined,
                form: formFilter || undefined,
                class_name: classFilter || undefined,
                is_active: activeOnly ? true : undefined,
                limit: 200,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load medicines', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() /* eslint-disable-next-line */ }, [debQ, formFilter, classFilter, activeOnly])

    const onSave = async (payload) => {
        try {
            if (editing?.id) await updateMedicine(editing.id, payload)
            else await createMedicine(payload)
            setShowForm(false)
            setEditing(null)
            await load()
            toast.success('Saved', { description: 'Medicine saved successfully.' })
        } catch (e) {
            toast.error('Save failed', { description: e?.response?.data?.detail || 'Try again.' })
        }
    }

    const onDelete = async (row) => {
        if (!window.confirm(`Delete ${row.name}?`)) return
        try {
            await deleteMedicine(row.id)
            await load()
            toast.success('Deleted', { description: 'Medicine removed.' })
        } catch (e) {
            toast.error('Delete failed', { description: e?.response?.data?.detail || 'Try again.' })
        }
    }

    const downloadSample = async () => {
        try {
            const blob = await downloadMedicineSample(importFormat) // uses /sample.{fmt}
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = importFormat === 'xlsx' ? 'medicine_import_sample.xlsx' : 'medicine_import_sample.csv'
            a.click()
            URL.revokeObjectURL(url)
        } catch (e) {
            toast.error('Could not download sample', { description: e?.response?.data?.detail || 'Try again.' })
        }
    }

    const doImport = async () => {
        if (!file) {
            toast.error('Choose a file', { description: 'Select an .xlsx or .csv file to continue.' })
            return
        }
        setImporting(true)
        try {
            // Backend detects format by filename; upsert kept true by default
            await importMedicines(file, true)
            setFile(null)
            setShowImport(false)
            toast.success('Imported', { description: 'Medicines imported successfully.' })
            await load()
        } catch (e) {
            toast.error('Import failed', { description: e?.response?.data?.detail || 'Please check the format and retry.' })
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Medicines</h1>
                <div className="flex gap-2">
                    <PermGate anyOf={['pharmacy.masters.manage']}>
                        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
                            <Plus className="h-4 w-4 mr-2" /> New
                        </Button>
                        <Button variant="outline" onClick={() => setShowImport(true)}>
                            <Upload className="h-4 w-4 mr-2" /> Import
                        </Button>
                    </PermGate>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid gap-3 md:grid-cols-5 items-end">
                        <div className="md:col-span-2">
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Code, brand, generic, manufacturer…"
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Form</Label>
                            <Select value={formFilter} onValueChange={(v) => setFormFilter(fromSelect(v))}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    {FORMS.map(f => (
                                        <SelectItem key={f} value={f}>{f}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Therapeutic class</Label>
                            <Input placeholder="e.g. Antibiotic" value={classFilter} onChange={e => setClassFilter(e.target.value)} />
                        </div>
                        <div className="flex gap-2 items-center">
                            <input
                                id="activeOnly"
                                type="checkbox"
                                className="h-4 w-4"
                                checked={activeOnly}
                                onChange={e => setActiveOnly(e.target.checked)}
                            />
                            <Label htmlFor="activeOnly">Active only</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Catalog */}
            <Card>
                <CardHeader><CardTitle>Catalog</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="max-h-[65vh]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white">
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Form</TableHead>
                                    <TableHead>Strength</TableHead>
                                    <TableHead>Pack</TableHead>
                                    <TableHead>Default Price</TableHead>
                                    <TableHead>Reorder</TableHead>
                                    <TableHead className="w-[120px]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && Array.from({ length: 8 }).map((_, i) => (
                                    <TableRow key={`sk-${i}`}>
                                        <TableCell><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell>
                                            <div className="h-4 w-48 animate-pulse rounded bg-gray-200 mb-1" />
                                            <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                                        </TableCell>
                                        <TableCell><div className="h-4 w-16 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-16 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-16 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-16 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-12 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell />
                                    </TableRow>
                                ))}

                                {!loading && rows.map(r => (
                                    <AnimatePresence key={r.id}>
                                        <motion.tr
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            transition={{ duration: 0.15 }}
                                            className="border-b"
                                        >
                                            <TableCell className="font-mono">{r.code}</TableCell>
                                            <TableCell>
                                                <div className="font-medium flex items-center gap-2">
                                                    {r.name}
                                                    {!!r.lasa_flag && (
                                                        <Badge variant="secondary" className="bg-amber-50 text-amber-800">
                                                            LASA
                                                        </Badge>
                                                    )}
                                                    {r.is_active === false && (
                                                        <Badge variant="outline" className="text-gray-600">Inactive</Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">{r.generic_name || '—'}</div>
                                            </TableCell>
                                            <TableCell className="capitalize">{r.form}</TableCell>
                                            <TableCell>{r.strength || '—'}</TableCell>
                                            <TableCell>{r.pack_size || 1} {r.unit}</TableCell>
                                            <TableCell>{r.default_price ?? '—'}</TableCell>
                                            <TableCell>{r.reorder_level ?? 0}</TableCell>
                                            <TableCell className="text-right">
                                                <PermGate anyOf={['pharmacy.masters.manage']}>
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setShowForm(true) }} title="Edit">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={() => onDelete(r)} title="Delete">
                                                            <Trash2 className="h-4 w-4 text-rose-600" />
                                                        </Button>
                                                    </div>
                                                </PermGate>
                                            </TableCell>
                                        </motion.tr>
                                    </AnimatePresence>
                                ))}

                                {!loading && rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-6 text-sm text-gray-500">No records</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Create/Edit dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader><DialogTitle>{editing ? 'Edit Medicine' : 'New Medicine'}</DialogTitle></DialogHeader>
                    <MedicineForm
                        initial={editing}
                        onCancel={() => setShowForm(false)}
                        onSave={onSave}
                    />
                </DialogContent>
            </Dialog>

            {/* Import Wizard */}
            <Dialog open={showImport} onOpenChange={setShowImport}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Import Medicines</DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="howto" className="w-full">
                        <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="howto">How it works</TabsTrigger>
                            <TabsTrigger value="upload">Upload</TabsTrigger>
                        </TabsList>

                        <TabsContent value="howto" className="space-y-3 text-sm">
                            <p>Download a sample file that matches the exact columns supported by your backend.</p>
                            <div className="flex gap-2">
                                <Select value={importFormat} onValueChange={setImportFormat}>
                                    <SelectTrigger className="w-40"><SelectValue placeholder="Format" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                                        <SelectItem value="csv">CSV (.csv)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" onClick={downloadSample}>
                                    <Download className="h-4 w-4 mr-2" /> Sample
                                </Button>
                            </div>
                            <Separator />
                            <div>
                                <div className="text-xs text-gray-500 mb-2">Expected columns (order can vary; header names must match):</div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                    {[
                                        'code', 'name', 'generic_name', 'form', 'strength', 'unit', 'pack_size',
                                        'manufacturer', 'class_name', 'atc_code', 'lasa_flag',
                                        'default_tax_percent', 'default_price', 'default_mrp',
                                        'reorder_level', 'is_active'
                                    ].map(k => (
                                        <Badge key={k} variant="secondary" className="justify-start">{k}</Badge>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="upload" className="space-y-3 text-sm">
                            <Label>Upload file</Label>
                            <Input type="file" accept=".xlsx,.csv" onChange={e => setFile(e.target.files?.[0] || null)} />
                            <div className="text-xs text-gray-500">
                                Tips: Keep booleans as <code>true/false</code>, and empty numeric fields as blank.
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
                                <Button onClick={doImport} disabled={importing}>
                                    <Upload className="h-4 w-4 mr-2" /> {importing ? 'Importing…' : 'Import'}
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div >
    )
}

function MedicineForm({ initial, onCancel, onSave }) {
    const [v, setV] = useState({
        code: '', name: '', generic_name: '', form: 'tablet', strength: '',
        unit: 'unit', pack_size: 1, manufacturer: '', class_name: '', atc_code: '',
        lasa_flag: false, default_tax_percent: '', default_price: '', default_mrp: '',
        reorder_level: 0, is_active: true
    })

    useEffect(() => {
        if (!initial) return
        setV({
            code: initial.code || '',
            name: initial.name || '',
            generic_name: initial.generic_name || '',
            form: initial.form || 'tablet',
            strength: initial.strength || '',
            unit: initial.unit || 'unit',
            pack_size: initial.pack_size ?? 1,
            manufacturer: initial.manufacturer || '',
            class_name: initial.class_name || '',
            atc_code: initial.atc_code || '',
            lasa_flag: !!initial.lasa_flag,
            default_tax_percent: initial.default_tax_percent ?? '',
            default_price: initial.default_price ?? '',
            default_mrp: initial.default_mrp ?? '',
            reorder_level: initial.reorder_level ?? 0,
            is_active: initial.is_active !== false
        })
    }, [initial])

    const change = (k, val) => setV(s => ({ ...s, [k]: val }))

    const submit = (e) => {
        e.preventDefault()
        const payload = {
            ...v,
            default_tax_percent: v.default_tax_percent === '' ? null : Number(v.default_tax_percent),
            default_price: v.default_price === '' ? null : Number(v.default_price),
            default_mrp: v.default_mrp === '' ? null : Number(v.default_mrp),
            pack_size: Number(v.pack_size || 1),
            reorder_level: Number(v.reorder_level || 0),
        }
        onSave(payload)
    }

    return (
        <AnimatePresence mode="wait">
            <motion.form
                key={initial?.id ? 'edit' : 'new'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                onSubmit={submit}
                className="space-y-3 text-sm"
            >
                <div className="grid gap-3 md:grid-cols-3">
                    <div><Label>Code</Label><Input value={v.code} onChange={e => change('code', e.target.value)} required /></div>
                    <div className="md:col-span-2"><Label>Name (Brand)</Label><Input value={v.name} onChange={e => change('name', e.target.value)} required /></div>
                    <div className="md:col-span-3"><Label>Generic name</Label><Input value={v.generic_name} onChange={e => change('generic_name', e.target.value)} /></div>

                    <div>
                        <Label>Form</Label>
                        <Select value={v.form} onValueChange={val => change('form', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div><Label>Strength</Label><Input value={v.strength} onChange={e => change('strength', e.target.value)} placeholder="500mg / 5mg/ml" /></div>
                    <div><Label>Unit</Label><Input value={v.unit} onChange={e => change('unit', e.target.value)} placeholder="tablet/ml/vial" /></div>

                    <div><Label>Pack size</Label><Input type="number" value={v.pack_size} onChange={e => change('pack_size', e.target.value)} /></div>
                    <div className="md:col-span-2"><Label>Manufacturer</Label><Input value={v.manufacturer} onChange={e => change('manufacturer', e.target.value)} /></div>

                    <div><Label>Therapeutic class</Label><Input value={v.class_name} onChange={e => change('class_name', e.target.value)} /></div>
                    <div><Label>ATC code</Label><Input value={v.atc_code} onChange={e => change('atc_code', e.target.value)} /></div>

                    <div className="flex gap-2 items-center mt-2">
                        <input id="lasa" type="checkbox" className="h-4 w-4" checked={v.lasa_flag} onChange={e => change('lasa_flag', e.target.checked)} />
                        <Label htmlFor="lasa">LASA (Look-Alike / Sound-Alike)</Label>
                    </div>

                    <div><Label>Default tax %</Label><Input type="number" step="0.01" value={v.default_tax_percent} onChange={e => change('default_tax_percent', e.target.value)} /></div>
                    <div><Label>Default price</Label><Input type="number" step="0.01" value={v.default_price} onChange={e => change('default_price', e.target.value)} /></div>
                    <div><Label>Default MRP</Label><Input type="number" step="0.01" value={v.default_mrp} onChange={e => change('default_mrp', e.target.value)} /></div>

                    <div><Label>Reorder level</Label><Input type="number" value={v.reorder_level} onChange={e => change('reorder_level', e.target.value)} /></div>
                    <div className="flex gap-2 items-center mt-2">
                        <input id="active" type="checkbox" className="h-4 w-4" checked={v.is_active} onChange={e => change('is_active', e.target.checked)} />
                        <Label htmlFor="active">Active</Label>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save</Button>
                </div>
            </motion.form>
        </AnimatePresence>
    )
}
