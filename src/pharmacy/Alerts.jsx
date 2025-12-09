// FILE: src/pharmacy/Alerts.jsx
import { useEffect, useState } from 'react'
import { listLowStock, listExpiryAlerts, listLocations } from '../api/pharmacy'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from '@/components/ui/select'
import { Toaster, toast } from 'sonner'
import { motion } from 'framer-motion'
import { AlertTriangle, RotateCw } from 'lucide-react'

export default function Alerts() {
    const [type, setType] = useState('low')
    const [rows, setRows] = useState([])
    const [locations, setLocations] = useState([])
    const [locationId, setLocationId] = useState('')
    const [loading, setLoading] = useState(false)

    const ALL = '__all__'
    const toSelect = (v) => (v === '' || v == null ? ALL : String(v))
    const fromSelect = (v) => (v === ALL ? '' : v)

    useEffect(() => {
        ; (async () => {
            try {
                const locs = await listLocations().then((r) => r.data || [])
                setLocations(locs)
            } catch (e) {
                toast.error('Failed to load locations', {
                    description: e?.response?.data?.detail || 'Retry.',
                })
            }
        })()
    }, [])

    const load = async () => {
        setLoading(true)
        try {
            const fn = type === 'expiry' ? listExpiryAlerts : listLowStock
            const { data } = await fn({
                location_id: locationId || undefined,
                limit: 500,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load alerts', {
                description: e?.response?.data?.detail || 'Retry.',
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, locationId])

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <h1 className="text-lg font-semibold">Pharmacy · Alerts</h1>
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    <RotateCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Reload
                </Button>
            </div>

            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-4 items-end">
                        <div>
                            <Label>Alert type</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low stock</SelectItem>
                                    <SelectItem value="expiry">Expiry</SelectItem>
                                </SelectContent>
                            </Select>
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
                    </div>
                </CardContent>
            </Card>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {type === 'low' ? 'Low stock items' : 'Expiry-risk items'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Medicine</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Batch</TableHead>
                                        {type === 'expiry' ? (
                                            <>
                                                <TableHead>Expiry</TableHead>
                                                <TableHead className="text-right">On-hand</TableHead>
                                            </>
                                        ) : (
                                            <>
                                                <TableHead className="text-right">On-hand</TableHead>
                                                <TableHead className="text-right">Reorder level</TableHead>
                                            </>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((r, i) => (
                                        <motion.tr
                                            key={r.id || `${r.medicine_id}-${r.location_id}-${i}`}
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
                                            <TableCell>{r.batch || r.batch_no || '—'}</TableCell>
                                            {type === 'expiry' ? (
                                                <>
                                                    <TableCell>
                                                        {r.expiry ? new Date(r.expiry).toLocaleDateString() : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {r.on_hand ?? r.qty_on_hand ?? 0}
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell className="text-right font-medium">
                                                        {r.on_hand ?? r.qty_on_hand ?? 0}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-slate-500">
                                                        {r.reorder_level ?? r.medicine?.reorder_level ?? '—'}
                                                    </TableCell>
                                                </>
                                            )}
                                        </motion.tr>
                                    ))}

                                    {rows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="text-center py-6 text-sm text-gray-500"
                                            >
                                                No alerts
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
