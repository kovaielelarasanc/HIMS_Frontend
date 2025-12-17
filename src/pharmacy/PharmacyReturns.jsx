import { useEffect, useState } from 'react'
import { listPharmacyReturns } from '../api/pharmacy'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    RotateCcw,
    Search,
    Loader2,
    User,
    Clock3,
} from 'lucide-react'

function formatDateTime(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function PharmacyReturns() {
    const [q, setQ] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    const loadReturns = async () => {
        try {
            setLoading(true)
            const params = {}
            if (q) params.q = q
            if (dateFrom) params.date_from = dateFrom
            if (dateTo) params.date_to = dateTo
            const res = await listPharmacyReturns(params)
            setRows(res.data || [])
        } catch (err) {
            // interceptor
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadReturns()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const totalRefund = rows.reduce((sum, r) => sum + (r.total_amount || 0), 0)

    return (
        <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 sm:gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
                        Pharmacy Returns
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">
                        Shows Pharmacy bills treated as returns (negative amounts). Later you can connect this to a dedicated return workflow.
                    </p>
                </div>
            </div>

            <Card className="border-slate-500 rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="UHID / Name / Phone"
                                    className="pl-7 h-9 w-40 sm:w-52"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                            <Input
                                type="date"
                                className="h-9 w-32"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                            <Input
                                type="date"
                                className="h-9 w-32"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 text-xs"
                                onClick={loadReturns}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                Apply
                            </Button>
                        </div>

                        <div className="flex flex-col items-end gap-1 text-right">
                            <div className="text-[11px] text-slate-500">
                                Returns in view{' '}
                                <Badge variant="secondary" className="ml-1 h-5 px-2 text-[10px]">
                                    {rows.length}
                                </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Total refund{' '}
                                <span className="font-semibold text-slate-900">
                                    ₹{totalRefund.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    <div className="border-t border-slate-100 mt-2 mb-2" />

                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                        <table className="min-w-full text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                                    <th className="py-2 pl-3 pr-2 text-left font-medium">Return</th>
                                    <th className="py-2 px-2 text-left font-medium">Patient</th>
                                    <th className="py-2 px-2 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && !loading && (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="py-10 text-center text-xs text-slate-500"
                                        >
                                            No Pharmacy returns detected (no negative Pharmacy bills).
                                        </td>
                                    </tr>
                                )}

                                {loading && (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center">
                                            <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
                                        </td>
                                    </tr>
                                )}

                                {!loading &&
                                    rows.map((r) => (
                                        <tr
                                            key={r.id}
                                            className="border-t border-slate-100 hover:bg-slate-50/60"
                                        >
                                            <td className="py-2.5 pl-3 pr-2 align-top">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="font-medium text-[11px] text-slate-800">
                                                            Return #{r.id}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                        <Clock3 className="h-3 w-3" />
                                                        <span>{formatDateTime(r.created_at)}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-2 align-top">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-[11px] font-medium text-slate-900">
                                                        {r.patient_name || '—'}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 text-[10px] text-slate-500 flex flex-wrap gap-1">
                                                    {r.patient_uhid && (
                                                        <Badge
                                                            variant="outline"
                                                            className="h-4 px-1.5 text-[9px]"
                                                        >
                                                            {r.patient_uhid}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-2 align-top text-right">
                                                <div className="text-[11px] font-semibold text-red-600">
                                                    ₹{(r.total_amount || 0).toFixed(2)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
