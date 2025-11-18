// src/pharmacy/Transactions.jsx
import { useEffect, useState } from 'react'
import { listTxns, listLocations, listMedicines } from '../api/pharmacy'
import { Search, RotateCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectTrigger, SelectItem, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useDebounce } from '../shared/useDebounce'
import { Toaster, toast } from 'sonner'

const TYPE_OPTIONS = ['', 'grn', 'po_return', 'dispense', 'sale_return', 'adjust_in', 'adjust_out', 'transfer_in', 'transfer_out']

const typeBadge = (t) => {
    const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs border'
    switch (t) {
        case 'grn': return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
        case 'po_return': return `${base} bg-rose-50 text-rose-700 border-rose-200`
        case 'dispense': return `${base} bg-rose-50 text-rose-700 border-rose-200`
        case 'sale_return': return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
        case 'adjust_in': return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
        case 'adjust_out': return `${base} bg-amber-50 text-amber-800 border-amber-200`
        case 'transfer_in': return `${base} bg-blue-50 text-blue-700 border-blue-200`
        case 'transfer_out': return `${base} bg-amber-50 text-amber-800 border-amber-200`
        default: return `${base} bg-gray-50 text-gray-700 border-gray-200`
    }
}

export default function Transactions() {
    const [rows, setRows] = useState([])
    const [q, setQ] = useState('')
    const [type, setType] = useState('')
    const [locationId, setLocationId] = useState('')
    const [medicineId, setMedicineId] = useState('')
    const [locations, setLocations] = useState([])
    const [meds, setMeds] = useState([])
    const [loading, setLoading] = useState(false)
    const debQ = useDebounce(q, 250)
    const ALL = '__all__';
    const toSelect = (v) => (v === '' || v == null ? ALL : String(v));
    const fromSelect = (v) => (v === ALL ? '' : v);

    const TYPES = [
        'grn', 'po_return', 'dispense', 'sale_return',
        'adjust_in', 'adjust_out', 'transfer_in', 'transfer_out'
    ];


    useEffect(() => {
        ; (async () => {
            try {
                const [l, m] = await Promise.all([
                    listLocations().then(r => r.data || []),
                    listMedicines({ limit: 500 }).then(r => r.data || []),
                ])
                setLocations(l); setMeds(m)
            } catch (e) {
                toast.error('Failed to load filters', { description: e?.response?.data?.detail || 'Retry.' })
            }
        })()
    }, [])

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listTxns({
                q: debQ || undefined,
                type: type || undefined,
                location_id: locationId || undefined,
                medicine_id: medicineId || undefined,
                limit: 500,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load transactions', { description: e?.response?.data?.detail || 'Retry.' })
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() /* eslint-disable-next-line */ }, [debQ, type, locationId, medicineId])

    const resetFilters = () => {
        setQ(''); setType(''); setLocationId(''); setMedicineId('')
    }

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Transactions</h1>
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    <RotateCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Reload
                </Button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
            >
                <Card>
                    <CardContent className="p-4">
                        <div className="grid gap-3 md:grid-cols-6 items-end">
                            <div className="md:col-span-2">
                                <Label>Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Ref, note, batch…"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Type</Label>
                                <Select value={toSelect(type)} onValueChange={(v) => setType(fromSelect(v))}>
                                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>All</SelectItem>
                                        {TYPES.map((t) => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Location</Label>
                                <Select value={toSelect(locationId)} onValueChange={(v) => setLocationId(fromSelect(v))}>
                                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>All</SelectItem>
                                        {locations.map((l) => (
                                            <SelectItem key={l.id} value={String(l.id)}>
                                                {l.code} — {l.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Medicine</Label>
                                <Select value={toSelect(medicineId)} onValueChange={(v) => setMedicineId(fromSelect(v))}>
                                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>All</SelectItem>
                                        {meds.map((m) => (
                                            <SelectItem key={m.id} value={String(m.id)}>
                                                {m.code} — {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
                                <Button type="button" onClick={load} disabled={loading}>
                                    {loading ? 'Loading…' : 'Apply'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: 0.04 }}
            >
                <Card>
                    <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Medicine</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">Δ Qty</TableHead>
                                        <TableHead>Ref</TableHead>
                                        <TableHead>Note</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((t, i) => (
                                        <motion.tr
                                            key={t.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.01 * i }}
                                            className="border-b"
                                        >
                                            <TableCell>{new Date(t.ts).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <span className={typeBadge(t.type)}>{t.type}</span>
                                            </TableCell>
                                            <TableCell>{t.medicine_name || t.medicine_id}</TableCell>
                                            <TableCell>{t.location_code || t.location_id}</TableCell>
                                            <TableCell>#{t.lot_id}</TableCell>
                                            <TableCell className={`text-right font-medium ${t.qty_change < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                {t.qty_change > 0 ? `+${t.qty_change}` : t.qty_change}
                                            </TableCell>
                                            <TableCell>{t.ref_type || '—'} {t.ref_id || ''}</TableCell>
                                            <TableCell className="max-w-[26ch] truncate" title={t.note || ''}>
                                                {t.note || '—'}
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-6 text-sm text-gray-500">
                                                No transactions
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
    )
}
