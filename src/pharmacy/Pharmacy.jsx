// FILE: src/pharmacy/Pharmacy.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { motion } from 'framer-motion'

import { getPharmacyDashboard } from '@/api/pharmacy'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

import {
    Pill,
    ShoppingCart,
    ClipboardList,
    AlertTriangle,
    Boxes,
    Truck,
    Activity,
} from 'lucide-react'

export default function Pharmacy() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await getPharmacyDashboard()
            setData(data || {})
        } catch (e) {
            toast.error('Failed to load pharmacy dashboard', {
                description: e?.response?.data?.detail || 'Retry.',
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const totals = data?.totals || {}
    const cards = [
        {
            label: 'Today bills',
            value: totals.daily_bills ?? 0,
            meta: 'Pharmacy bills today',
        },
        {
            label: 'Today revenue',
            value: totals.daily_revenue ?? 0,
            meta: '₹ collected today',
            prefix: '₹',
        },
        {
            label: 'Pending prescriptions',
            value: totals.pending_rx_count ?? 0,
            meta: 'Need dispensing',
        },
        {
            label: 'Low stock items',
            value: totals.low_stock_count ?? 0,
            meta: 'Below reorder level',
        },
        {
            label: 'Expiry alerts',
            value: totals.expiry_count ?? 0,
            meta: 'Expired / expiring',
        },
    ]

    return (
        <div className="p-4 space-y-4">
            <Toaster richColors closeButton position="top-right" />

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Pill className="h-5 w-5 text-slate-900" />
                    <h1 className="text-lg font-semibold">
                        Pharmacy · Dashboard
                    </h1>
                </div>
                <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                    <Activity className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* KPI cards */}
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                {cards.map((c, idx) => (
                    <motion.div
                        key={c.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                    >
                        <Card className="rounded-2xl">
                            <CardContent className="p-3">
                                <div className="text-[11px] text-slate-500">{c.label}</div>
                                {loading ? (
                                    <Skeleton className="h-6 w-20 mt-1" />
                                ) : (
                                    <div className="text-xl font-semibold mt-1">
                                        {c.prefix}{c.value}
                                    </div>
                                )}
                                <div className="text-[11px] text-slate-400 mt-1">
                                    {c.meta}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Quick navigation */}
            <div className="grid gap-3 md:grid-cols-3">
                <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Prescriptions & Dispensing
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="text-xs text-slate-500">
                            Manage doctor & pharmacy prescriptions, accept, dispense and generate bills.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/prescriptions">View prescriptions</Link>
                            </Button>
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/prescriptions/new">New prescription</Link>
                            </Button>
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/dispense">Dispense Rx</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" />
                            Billing & Returns
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="text-xs text-slate-500">
                            Counter sales, prescription-linked billing and patient returns.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/billing">Billing console</Link>
                            </Button>
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/returns">Returns</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Boxes className="h-4 w-4" />
                            Inventory & Procurement
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="text-xs text-slate-500">
                            Manage stock, lots, POs, GRNs and safety alerts (low stock / expiry).
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/inventory">Inventory lots</Link>
                            </Button>
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/transactions">Transactions</Link>
                            </Button>
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/alerts">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Alerts
                                </Link>
                            </Button>
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/po">Purchase orders</Link>
                            </Button>
                            <Button asChild size="xs" variant="outline">
                                <Link to="/pharmacy/grn">GRN</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Masters section */}
            <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Masters
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-sm">
                    <Button asChild size="xs" variant="outline">
                        <Link to="/pharmacy/medicines">Medicines</Link>
                    </Button>
                    <Button asChild size="xs" variant="outline">
                        <Link to="/pharmacy/suppliers">Suppliers</Link>
                    </Button>
                    <Button asChild size="xs" variant="outline">
                        <Link to="/pharmacy/locations">Stores / Locations</Link>
                    </Button>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                        Pharmacy module · NABH-aligned
                    </Badge>
                </CardContent>
            </Card>
        </div>
    )
}
