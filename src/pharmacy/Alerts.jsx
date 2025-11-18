// src/pharmacy/Alerts.jsx
import { useEffect, useState } from 'react'
import { listAlerts } from '../api/pharmacy'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { toast } from 'sonner'

export default function Alerts() {
    const [low, setLow] = useState([])
    const [expiry, setExpiry] = useState([])

    useEffect(() => {
        let alive = true
            ; (async () => {
                try {
                    const { data } = await listAlerts()
                    if (!alive) return
                    setLow(data?.low || [])
                    setExpiry(data?.expiry || [])
                } catch (e) {
                    const msg = e?.response?.data?.detail || 'Please retry'
                    toast.error('Failed to load alerts', { description: msg })
                }
            })()
        return () => { alive = false }
    }, [])

    return (
        <div className="p-4 space-y-4">
            {/* Toaster is rendered ONCE at app root. Do not include <Toaster /> here. */}
            <h1 className="text-lg font-semibold">Pharmacy · Alerts</h1>

            <Card>
                <CardHeader><CardTitle>Low Stock</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Medicine</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>On hand</TableHead>
                                <TableHead>Reorder</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {low.map(r => (
                                <TableRow key={`${r.medicine_id}-${r.location_id}`}>
                                    <TableCell>{r.medicine_name || r.medicine_id}</TableCell>
                                    <TableCell>{r.location_code || r.location_id}</TableCell>
                                    <TableCell>{r.on_hand}</TableCell>
                                    <TableCell>{r.reorder_level}</TableCell>
                                </TableRow>
                            ))}
                            {low.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-sm text-gray-500">
                                        All good 🎉
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Expiry (next 30 days / expired)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Medicine</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead>On hand</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expiry.map(l => (
                                <TableRow key={l.id}>
                                    <TableCell>{l.medicine_name || l.medicine_id}</TableCell>
                                    <TableCell>{l.batch}</TableCell>
                                    <TableCell>{l.location_code || l.location_id}</TableCell>
                                    <TableCell>{l.expiry}</TableCell>
                                    <TableCell>{l.on_hand}</TableCell>
                                </TableRow>
                            ))}
                            {expiry.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-6 text-sm text-gray-500">
                                        Nothing expiring soon 🎉
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
