import API from '@/api/client'
import React, { useState, useEffect } from 'react'
import {
    FlaskConical,
    Activity,
    Wifi,
    Plug,
    FileDown,
    AlertTriangle,
    CheckCircle2,
    XCircle,
} from 'lucide-react'

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useCan } from '@/hooks/usePerm'

function ConnectionBadge({ type }) {
    if (!type) return null
    const t = type.toLowerCase()
    if (t === 'rs232') {
        return (
            <Badge
                variant="outline"
                className="gap-1 px-1.5 py-0.5 text-[10px] border-slate-500"
            >
                <Plug className="w-3 h-3 text-slate-500" />
                RS-232
            </Badge>
        )
    }
    if (t === 'tcp_ip') {
        return (
            <Badge
                variant="outline"
                className="gap-1 px-1.5 py-0.5 text-[10px] border-slate-500"
            >
                <Wifi className="w-3 h-3 text-slate-500" />
                TCP/IP
            </Badge>
        )
    }
    if (t === 'file_drop') {
        return (
            <Badge
                variant="outline"
                className="gap-1 px-1.5 py-0.5 text-[10px] border-slate-500"
            >
                <FileDown className="w-3 h-3 text-slate-500" />
                File Drop
            </Badge>
        )
    }
    return (
        <Badge
            variant="outline"
            className="gap-1 px-1.5 py-0.5 text-[10px] border-slate-500"
        >
            {type}
        </Badge>
    )
}

function HealthDot({ item }) {
    // Simple logic: red if recent error, amber if many staging, green otherwise
    const hasError = item.error_count > 0 || item.last_error_at
    const hasBacklog = item.staging_count > 10

    let color = 'bg-emerald-500'
    if (hasBacklog) color = 'bg-amber-400'
    if (hasError) color = 'bg-red-500'

    return (
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
    )
}

export default function AnalyzerStatusWidget() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const canView = useCan('lab.devices.view')

    useEffect(() => {
        if (!canView) return

        const fetchStatus = async () => {
            setLoading(true)
            setError(null)
            try {
                // If you don't implement /status, you can start with /api/lis/devices
                const res = await API.get('/api/lis/devices/status')
                // Fallback: if backend returns plain devices without stats
                const data = (res.data || []).map((d) => ({
                    staging_count: 0,
                    error_count: 0,
                    last_received_at: null,
                    last_error_at: null,
                    ...d,
                }))
                setItems(data)
            } catch (err) {
                console.error('Failed to load analyzer status', err)
                setError('Unable to load analyzer status')
            } finally {
                setLoading(false)
            }
        }

        fetchStatus()
    }, [canView])

    if (!canView) {
        return null // hide widget if no permission
    }

    return (
        <Card className="border-slate-500 shadow-sm h-full">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-sky-600" />
                            Analyzer Status
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Last data received, pending queue and errors per device.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            OK
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                            Queue
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                            Error
                        </span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-1">
                {error && (
                    <Alert variant="destructive" className="mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertTitle className="text-xs">Analyzer status error</AlertTitle>
                        <AlertDescription className="text-[11px]">
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

                {loading && (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                            >
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-32" />
                                    <Skeleton className="h-2.5 w-40" />
                                </div>
                                <div className="space-y-1 text-right">
                                    <Skeleton className="h-3 w-14 ml-auto" />
                                    <Skeleton className="h-2.5 w-16 ml-auto" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && items.length === 0 && !error && (
                    <div className="py-6 text-center text-xs text-slate-500">
                        No analyzers configured yet.
                    </div>
                )}

                {!loading && items.length > 0 && (
                    <div className="space-y-2">
                        {items.map((item) => {
                            const lastReceived = item.last_received_at
                                ? new Date(item.last_received_at).toLocaleString()
                                : 'No data'
                            const lastError = item.last_error_at
                                ? new Date(item.last_error_at).toLocaleString()
                                : null

                            return (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <HealthDot item={item} />
                                            <div className="text-xs font-semibold text-slate-900">
                                                {item.name}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-500">
                                                {item.code}
                                            </span>
                                            <ConnectionBadge type={item.connection_type} />
                                            {item.protocol && (
                                                <Badge
                                                    variant="outline"
                                                    className="px-1.5 py-0.5 text-[10px] border-slate-500"
                                                >
                                                    {item.protocol.toUpperCase()}
                                                </Badge>
                                            )}
                                            {!item.is_active && (
                                                <Badge
                                                    variant="outline"
                                                    className="px-1.5 py-0.5 text-[10px] border-amber-200 text-amber-700 bg-amber-50"
                                                >
                                                    Disabled
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            <span className="inline-flex items-center gap-1">
                                                <Activity className="w-3 h-3 text-slate-400" />
                                                Last data: <span className="font-semibold">{lastReceived}</span>
                                            </span>
                                            {lastError && (
                                                <span className="inline-flex items-center gap-1 ml-3 text-red-600">
                                                    <XCircle className="w-3 h-3" />
                                                    Last error: {lastError}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-right">
                                        <div className="text-[10px] text-slate-500">
                                            Staging
                                        </div>
                                        <div className="text-xs font-semibold text-slate-900">
                                            {item.staging_count ?? 0}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1">
                                            Errors
                                        </div>
                                        <div
                                            className={`text-xs font-semibold ${(item.error_count ?? 0) > 0
                                                ? 'text-red-600'
                                                : 'text-slate-800'
                                                }`}
                                        >
                                            {item.error_count ?? 0}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}




// import AnalyzerStatusWidget from './widgets/AnalyzerStatusWidget'

// // ...

// <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
//   {/* other cards… */}
//   <AnalyzerStatusWidget />
// </div>
