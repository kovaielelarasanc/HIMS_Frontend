// src/pharmacy/Pharmacy.jsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { listAlerts, listTxns, listPO } from '@/api/pharmacy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster, toast } from 'sonner'
import {
    AlertTriangle,
    CalendarClock,
    ShoppingCart,
    Package,
    Activity,
    Pill,
    RefreshCw
} from 'lucide-react'
import PermGate from '@/components/PermGate'

export default function Pharmacy() {
    const nav = useNavigate()
    const [kpi, setKpi] = useState({ low: 0, exp: 0, todayTxns: 0, openPO: 0 })
    const [loading, setLoading] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [lastUpdated, setLastUpdated] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const today = new Date().toISOString().slice(0, 10)
            const [{ data: alerts }, { data: txns }, { data: pos }] = await Promise.all([
                listAlerts(),
                listTxns({ date: today }),
                listPO({ status: 'approved' }),
            ])

            const low = (alerts?.low || []).length
            const exp = (alerts?.expiry || []).length
            const todayTxns = (txns || []).length
            const openPO = (pos || []).filter(p => p.status !== 'closed' && p.status !== 'cancelled').length
            setKpi({ low, exp, todayTxns, openPO })
            setLastUpdated(new Date())
        } catch (e) {
            toast.error('Failed to load pharmacy dashboard', {
                description: e?.response?.data?.detail || 'Please try again.',
            })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    // Light "realtime" feel: auto-refresh every 30s (can be toggled)
    useEffect(() => {
        if (!autoRefresh) return
        const id = setInterval(load, 30000)
        return () => clearInterval(id)
    }, [autoRefresh, load])

    const cards = [
        { title: 'Low stock', value: kpi.low, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', to: '/pharmacy/alerts' },
        { title: 'Expiring soon', value: kpi.exp, icon: CalendarClock, color: 'text-rose-600', bg: 'bg-rose-50', to: '/pharmacy/alerts' },
        { title: 'Today transactions', value: kpi.todayTxns, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', to: '/pharmacy/transactions' },
        { title: 'Open POs', value: kpi.openPO, icon: Package, color: 'text-emerald-700', bg: 'bg-emerald-50', to: '/pharmacy/po' },
    ]

    return (
        <div className="p-4 space-y-6">
            {/* If you already mount <Toaster /> globally, you can remove this one */}
            <Toaster richColors closeButton position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-semibold">Pharmacy</h1>
                    <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                        {lastUpdated && <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>}
                        <span className="inline-flex items-center gap-1">
                            <span className="relative inline-flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            </span>
                            Live
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600 border rounded-lg px-2 py-1">
                        <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                    <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <PermGate anyOf={['pharmacy.dispense.manage', 'pharmacy.dispense.create']}>
                        <Button onClick={() => nav('/pharmacy/dispense')}>
                            <ShoppingCart className="h-4 w-4 mr-2" /> Dispense
                        </Button>
                    </PermGate>
                    <PermGate anyOf={['pharmacy.masters.manage']}>
                        <Button variant="outline" onClick={() => nav('/pharmacy/medicines')}>
                            <Pill className="h-4 w-4 mr-2" /> Medicines
                        </Button>
                    </PermGate>
                </div>
            </div>

            {/* KPI grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <Card key={`sk-${i}`} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-6 w-10 rounded-md" />
                            </div>
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-8 w-8 rounded-md" />
                                <Skeleton className="h-6 w-12" />
                            </div>
                        </Card>
                    ))
                    : cards.map((c, i) => {
                        const Ico = c.icon
                        return (
                            <motion.div
                                key={c.title}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 * i }}
                            >
                                <Link to={c.to}>
                                    <Card className="hover:shadow-md transition">
                                        <CardHeader className="pb-2 flex items-center justify-between">
                                            <CardTitle className="text-sm">{c.title}</CardTitle>
                                            <span className={`rounded-md px-2 py-1 text-xs ${c.bg} ${c.color}`}>Live</span>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-3">
                                                <Ico className={`h-8 w-8 ${c.color}`} />
                                                <div className="text-2xl font-semibold">{c.value}</div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </motion.div>
                        )
                    })}
            </div>

            <Separator />

            {/* Quick actions */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:shadow-sm">
                    <CardHeader className="pb-1"><CardTitle className="text-sm">Procurement</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <PermGate anyOf={['pharmacy.procure.manage']}>
                            <Button onClick={() => nav('/pharmacy/po')}>Purchase Orders</Button>
                        </PermGate>
                        <PermGate anyOf={['pharmacy.procure.manage']}>
                            <Button variant="outline" onClick={() => nav('/pharmacy/grn')}>GRN</Button>
                        </PermGate>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-sm">
                    <CardHeader className="pb-1"><CardTitle className="text-sm">Inventory</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button onClick={() => nav('/pharmacy/inventory')}>Lots</Button>
                        <Button variant="outline" onClick={() => nav('/pharmacy/transactions')}>Transactions</Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-sm">
                    <CardHeader className="pb-1"><CardTitle className="text-sm">Masters</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <PermGate anyOf={['pharmacy.masters.manage']}>
                            <Button onClick={() => nav('/pharmacy/medicines')}>Medicines</Button>
                        </PermGate>
                        <PermGate anyOf={['pharmacy.masters.manage']}>
                            <Button variant="outline" onClick={() => nav('/pharmacy/suppliers')}>Suppliers</Button>
                        </PermGate>
                        <PermGate anyOf={['pharmacy.masters.manage']}>
                            <Button variant="outline" onClick={() => nav('/pharmacy/locations')}>Locations</Button>
                        </PermGate>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
