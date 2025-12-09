// FILE: src/pharmacy/Inventory.jsx
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Toaster, toast } from 'sonner'
import { motion } from 'framer-motion'
import { listLots, listLocations, listMedicines } from '../api/pharmacy'
import { RotateCw, Search } from 'lucide-react'
import { useDebounce } from '../shared/useDebounce'

export default function Inventory() {
    const [rows, setRows] = useState([])
    const [locations, setLocations] = useState([])
    const [meds, setMeds] = useState([])
    const [q, setQ] = useState('')
    const [locationId, setLocationId] = useState('')
    const [medicineId, setMedicineId] = useState('')
    const [loading, setLoading] = useState(false)
    const debQ = useDebounce(q, 250)

    const ALL = '__all__'
    const toSelect = (v) => (v === '' || v == null ? ALL : String(v))
    const fromSelect = (v) => (v === ALL ? '' : v)

    useEffect(() => {
        ; (async () => {
            try {
                const [l, m] = await Promise.all([
                    listLocations().then((r) => r.data || []),
                    listMedicines({ limit: 500, is_active: true }).then((r) => r.data || []),
                ])
                setLocations(l)
                setMeds(m)
            } catch (e) {
                toast.error('Failed to load lookups', {
                    description: e?.response?.data?.detail || 'Retry.',
                })
            }
        })()
    }, [])

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listLots({
                q: debQ || undefined,
                location_id: locationId || undefined,
                medicine_id: medicineId || undefined,
                limit: 500,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load inventory', {
                description: e?.response?.data?.detail || 'Retry.',
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debQ, locationId, medicineId])

    const resetFilters = () => {
        setQ('')
        setLocationId('')
        setMedicineId('')
    }

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Inventory</h1>
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
                                        placeholder="Medicine, batch…"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Location</Label>
                                <Select
                                    value={toSelect(locationId)}
                                    onValueChange={(v) => setLocationId(fromSelect(v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
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
                                <Select
                                    value={toSelect(medicineId)}
                                    onValueChange={(v) => setMedicineId(fromSelect(v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
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
                                <Button type="button" variant="outline" onClick={resetFilters}>
                                    Reset
                                </Button>
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
                    <CardHeader>
                        <CardTitle>Current stock (lots)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Medicine</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Batch</TableHead>
                                        <TableHead>Expiry</TableHead>
                                        <TableHead className="text-right">On-hand</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((r, i) => (
                                        <motion.tr
                                            key={r.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.01 * i }}
                                            className="border-b"
                                        >
                                            <TableCell>
                                                <div className="font-medium">
                                                    {r.medicine_name || r.medicine?.name || `#${r.medicine_id}`}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {r.medicine_code || r.medicine?.code}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {r.location_code || r.location?.code} ·{' '}
                                                {r.location_name || r.location?.name}
                                            </TableCell>
                                            <TableCell>{r.batch || r.batch_no}</TableCell>
                                            <TableCell>{r.expiry ? new Date(r.expiry).toLocaleDateString() : '—'}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {r.on_hand ?? r.qty_on_hand ?? 0}
                                            </TableCell>
                                        </motion.tr>
                                    ))}

                                    {rows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="text-center py-6 text-sm text-gray-500"
                                            >
                                                No stock records
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
