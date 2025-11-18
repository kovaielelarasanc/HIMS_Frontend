// src/pharmacy/Inventory.jsx
import { useEffect, useMemo, useState } from 'react'
import { listLots, adjustStock, transferStock, listLocations, listMedicines } from '../api/pharmacy'
import { Search } from 'lucide-react'
import PermGate from '../components/PermGate'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectItem, SelectContent, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

import { useDebounce } from '../shared/useDebounce'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

export default function Inventory() {
    // list + lookups
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const ALL = '__all__';
    const fromSelect = (v) => (v === ALL ? '' : v);
    // filters
    const [q, setQ] = useState('')
    const debQ = useDebounce(q, 250)
    const [locationId, setLocationId] = useState('')
    const [medicineId, setMedicineId] = useState('')
    const [onlyLow, setOnlyLow] = useState(false)
    const [expiryBefore, setExpiryBefore] = useState('')

    const [locations, setLocations] = useState([])
    const [medOptions, setMedOptions] = useState([])

    // dialogs
    const [adjOpen, setAdjOpen] = useState(false)
    const [xferOpen, setXferOpen] = useState(false)
    const [savingAdj, setSavingAdj] = useState(false)
    const [savingXfer, setSavingXfer] = useState(false)

    // selected lot + form
    const [lot, setLot] = useState(null)
    const [adjQty, setAdjQty] = useState(0)
    const [adjReason, setAdjReason] = useState('stock_take')
    const [toLocation, setToLocation] = useState('')
    const [xferQty, setXferQty] = useState(0)

    // helpers
    const expired = (d) => d && new Date(d) < new Date()
    const expSoon = (d) => {
        if (!d) return false
        const dt = new Date(d)
        const soon = new Date()
        soon.setDate(soon.getDate() + 30)
        return dt >= new Date() && dt <= soon
    }

    const isLow = (r) => {
        // if backend includes reorder_level in this list, we can use it
        const ro = Number(r?.reorder_level ?? NaN)
        return Number.isFinite(ro) && Number(r.on_hand) <= ro
    }

    // load list
    const load = async () => {
        setLoading(true)
        try {
            const { data } = await listLots({
                q: debQ || undefined,
                location_id: locationId || undefined,
                medicine_id: medicineId || undefined,
                expiry_before: expiryBefore || undefined,
                only_low: onlyLow ? true : undefined,
                limit: 500,
            })
            setRows(data || [])
        } catch (e) {
            toast.error('Failed to load inventory', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() /* eslint-disable-next-line */ }, [debQ, locationId, medicineId, expiryBefore, onlyLow])

    // load lookups
    useEffect(() => {
        ; (async () => {
            try {
                const [loc, meds] = await Promise.all([
                    listLocations().then(r => r.data || []),
                    listMedicines({ limit: 1000, is_active: true }).then(r => r.data || []),
                ])
                setLocations(loc)
                setMedOptions(meds)
            } catch (e) {
                toast.error('Failed to load filters', { description: e?.response?.data?.detail || 'Please refresh.' })
            }
        })()
    }, [])

    // dialog openers
    const beginAdjust = (row) => {
        setLot(row)
        setAdjQty(0)
        setAdjReason('stock_take')
        setAdjOpen(true)
    }
    const beginTransfer = (row) => {
        setLot(row)
        setToLocation('')
        setXferQty(0)
        setXferOpen(true)
    }

    // validations
    const validateAdjust = () => {
        const change = Number(adjQty || 0)
        if (!Number.isFinite(change)) return 'Enter a valid number.'
        if (change === 0) return 'Change cannot be 0.'
        const after = Number(lot?.on_hand || 0) + change
        if (after < 0) return `Cannot reduce below 0 (would be ${after}).`
        return null
    }
    const validateTransfer = () => {
        const qty = Number(xferQty || 0)
        if (!toLocation) return 'Select a destination.'
        if (!(qty > 0)) return 'Quantity must be > 0.'
        if (qty > Number(lot?.on_hand || 0)) return `Only ${lot?.on_hand} available.`
        return null
    }

    // actions
    const doAdjust = async () => {
        const err = validateAdjust()
        if (err) { toast.error('Cannot adjust', { description: err }); return }
        setSavingAdj(true)
        try {
            await adjustStock({ lot_id: lot.id, qty_change: Number(adjQty || 0), reason: adjReason })
            setAdjOpen(false)
            toast.success('Adjusted', { description: `Lot ${lot.batch}: on-hand updated.` })
            await load()
        } catch (e) {
            toast.error('Adjust failed', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setSavingAdj(false)
        }
    }

    const doTransfer = async () => {
        const err = validateTransfer()
        if (err) { toast.error('Cannot transfer', { description: err }); return }
        setSavingXfer(true)
        try {
            await transferStock({
                lot_id: lot.id,
                from_location_id: lot.location_id,
                to_location_id: Number(toLocation),
                qty: Number(xferQty || 0),
            })
            setXferOpen(false)
            toast.success('Transferred', { description: `Moved ${xferQty} unit(s) of ${lot.batch}.` })
            await load()
        } catch (e) {
            toast.error('Transfer failed', { description: e?.response?.data?.detail || 'Please retry.' })
        } finally {
            setSavingXfer(false)
        }
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Pharmacy · Inventory (Lots)</h1>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid gap-3 md:grid-cols-6 items-end">
                        <div className="md:col-span-2">
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Medicine code/name/batch…"
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Location</Label>
                            <Select
                                value={locationId || ALL}
                                onValueChange={(v) => setLocationId(fromSelect(v))}
                            >
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    {locations.map(l => (
                                        <SelectItem key={l.id} value={String(l.id)}>
                                            {l.code} — {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>


                        <div>
                            <Label>Medicine</Label>
                            <Select value={medicineId} onValueChange={(v) => setMedicineId(fromSelect(v))}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    {medOptions.map(m => (
                                        <SelectItem key={m.id} value={String(m.id)}>{m.code} — {m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Expiry before</Label>
                            <Input type="date" value={expiryBefore} onChange={e => setExpiryBefore(e.target.value)} />
                        </div>

                        <div className="flex gap-2 items-center pt-6 md:pt-0">
                            <input
                                id="onlyLow"
                                type="checkbox"
                                className="h-4 w-4"
                                checked={onlyLow}
                                onChange={e => setOnlyLow(e.target.checked)}
                            />
                            <Label htmlFor="onlyLow">Low stock only</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <Card>
                <CardHeader><CardTitle>Lots</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white">
                                <TableRow>
                                    <TableHead>Medicine</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead className="text-right">On Hand</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Loading skeleton */}
                                {loading && Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={`sk-${i}`}>
                                        <TableCell><div className="h-4 w-40 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-24 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell><div className="h-4 w-24 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell className="text-right"><div className="ml-auto h-4 w-10 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell className="text-right"><div className="ml-auto h-4 w-12 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell className="text-right"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-gray-200" /></TableCell>
                                        <TableCell />
                                    </TableRow>
                                ))}

                                {!loading && rows.map(r => {
                                    const rowExpired = expired(r.expiry)
                                    const rowSoon = expSoon(r.expiry)
                                    const rowLow = isLow(r)

                                    return (
                                        <TableRow
                                            key={r.id}
                                            className={[
                                                rowExpired ? 'bg-rose-50' : rowSoon ? 'bg-amber-50' : '',
                                                'hover:bg-gray-50 transition-colors'
                                            ].join(' ')}
                                        >
                                            <TableCell>
                                                <div className="font-medium">{r.medicine?.name || r.medicine_name || `#${r.medicine_id}`}</div>
                                                <div className="text-xs text-gray-500">{r.medicine?.code || r.code}</div>
                                            </TableCell>
                                            <TableCell>{r.location?.code || r.location_id}</TableCell>
                                            <TableCell>{r.batch}</TableCell>
                                            <TableCell>{r.expiry}</TableCell>
                                            <TableCell className="text-right">{r.on_hand}</TableCell>
                                            <TableCell className="text-right">{r.sell_price ?? '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="inline-flex flex-wrap justify-end gap-1">
                                                    {rowExpired && <Badge variant="destructive">Expired</Badge>}
                                                    {!rowExpired && rowSoon && <Badge variant="secondary">Expiring soon</Badge>}
                                                    {rowLow && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Low</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <PermGate anyOf={['pharmacy.inventory.manage']}>
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="outline" onClick={() => beginAdjust(r)}>Adjust</Button>
                                                        <Button size="sm" onClick={() => beginTransfer(r)}>Transfer</Button>
                                                    </div>
                                                </PermGate>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}

                                {!loading && rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-6 text-sm text-gray-500">
                                            No lots found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Adjust modal */}
            <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Adjust stock</DialogTitle></DialogHeader>

                    <AnimatePresence mode="wait">
                        {lot && (
                            <motion.div
                                key={lot.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3 text-sm"
                            >
                                <div className="rounded-lg border bg-gray-50 p-2">
                                    Lot <span className="font-medium">{lot.batch}</span> • On hand: <span className="font-medium">{lot.on_hand}</span> • Location: <span className="font-medium">{lot.location?.code || lot.location_id}</span>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <Label>Quantity change</Label>
                                        <Input
                                            type="number"
                                            value={adjQty}
                                            onChange={e => setAdjQty(e.target.value)}
                                            placeholder="e.g. -3, +5"
                                        />
                                        <div className="mt-1 text-[11px] text-gray-500">Use negative to decrease. Cannot reduce below 0.</div>
                                    </div>
                                    <div>
                                        <Label>Reason</Label>
                                        <Input value={adjReason} onChange={e => setAdjReason(e.target.value)} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdjOpen(false)}>Cancel</Button>
                        <Button onClick={doAdjust} disabled={savingAdj}>
                            {savingAdj ? 'Updating…' : 'Update'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer modal */}
            <Dialog open={xferOpen} onOpenChange={setXferOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Transfer stock</DialogTitle></DialogHeader>

                    <AnimatePresence mode="wait">
                        {lot && (
                            <motion.div
                                key={`x-${lot.id}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3 text-sm"
                            >
                                <div className="rounded-lg border bg-gray-50 p-2">
                                    From <span className="font-medium">{lot.location?.code || lot.location_id}</span> • Batch <span className="font-medium">{lot.batch}</span> • On hand <span className="font-medium">{lot.on_hand}</span>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <Label>To Location</Label>
                                        <Select value={toLocation} onValueChange={setToLocation}>
                                            <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                                            <SelectContent>
                                                {locations
                                                    .filter(l => String(l.id) !== String(lot?.location_id))
                                                    .map(l => (
                                                        <SelectItem key={l.id} value={String(l.id)}>{l.code} — {l.name}</SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Quantity</Label>
                                        <Input
                                            type="number"
                                            value={xferQty}
                                            onChange={e => setXferQty(e.target.value)}
                                            placeholder="e.g. 5"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setXferOpen(false)}>Cancel</Button>
                        <Button onClick={doTransfer} disabled={savingXfer}>
                            {savingXfer ? 'Transferring…' : 'Transfer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
