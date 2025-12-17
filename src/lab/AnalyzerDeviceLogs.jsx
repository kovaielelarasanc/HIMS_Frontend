import { useEffect, useMemo, useState, useCallback } from 'react';
import API from '../api/client'
import { useCan } from '../hooks/useCan'

import {
    Beaker,
    Filter,
    Search,
    ChevronDown,
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    Network,
    Cpu,
    Info,
    History as HistoryIcon, // 👈 IMPORTANT: alias History icon
} from 'lucide-react'

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Alert,
    AlertTitle,
    AlertDescription,
} from '@/components/ui/alert'
import { Label } from '@/components/ui/label'

// ------------- Small Toast (same style as mapping) -------------
function Toast({ kind = 'success', title, message, onClose }) {
    const map = {
        success: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-900',
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-900',
            icon: <XCircle className="w-4 h-4 text-red-600" />,
        },
        info: {
            bg: 'bg-sky-50',
            border: 'border-sky-200',
            text: 'text-sky-900',
            icon: <Info className="w-4 h-4 text-sky-600" />,
        },
    }

    const v = map[kind] ?? map.info

    return (
        <div className="fixed top-4 right-4 z-40">
            <div
                className={`flex items-start gap-3 rounded-xl border shadow-sm px-4 py-3 ${v.bg} ${v.border} ${v.text}`}
            >
                <div className="mt-0.5">{v.icon}</div>
                <div className="space-y-0.5">
                    {title && <div className="font-semibold text-sm">{title}</div>}
                    {message && (
                        <div className="text-xs leading-snug text-slate-700">{message}</div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="ml-2 text-xs text-slate-500 hover:text-slate-700"
                >
                    ✕
                </button>
            </div>
        </div>
    )
}

// ------------- Helper: format date/time -------------
function formatDateTime(value) {
    if (!value) return '—'
    try {
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return value
        return d.toLocaleString()
    } catch {
        return value
    }
}

// ------------- Helper: analyze error (where is problem?) -------------
function analyzeError(err) {
    const status = err?.response?.status
    const detail = err?.response?.data?.detail

    if (!err.response) {
        return 'Network error from frontend → backend. Check backend is running and CORS / base URL in API client.'
    }

    if (status === 401) {
        return 'Unauthorized: check user login, token expiry, or permission interceptor.'
    }
    if (status === 403) {
        return 'Forbidden: current user does not have lab.device_logs.view or lab.devices.view permission.'
    }
    if (status === 404) {
        return (
            detail ||
            'Not found: for this device / tenant there are no logs or device mapping not created.'
        )
    }
    if (status === 500) {
        return (
            detail ||
            'Backend error: check tenant DB (lab_devices / lab_device_message_logs tables) or connector header values.'
        )
    }
    return detail || 'Unexpected error while fetching analyzer logs.'
}

export default function AnalyzerDeviceLogs() {
    const [devices, setDevices] = useState([])
    const [selectedDeviceId, setSelectedDeviceId] = useState(null)

    const [logs, setLogs] = useState([])
    const [loadingDevices, setLoadingDevices] = useState(false)
    const [loadingLogs, setLoadingLogs] = useState(false)

    const [searchText, setSearchText] = useState('')
    const [limit, setLimit] = useState(100)

    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)

    const canLogs = useCan('lab.device_logs.view')
    const canDevices = useCan('lab.devices.view')
    const canView = canLogs || canDevices

    const showToast = useCallback((kind, title, message) => {
        setToast({ kind, title, message })
        setTimeout(() => setToast(null), 4000)
    }, [])

    // -------- Fetch devices (same endpoint as mapping) --------
    useEffect(() => {
        if (!canView) return
        const fetchDevices = async () => {
            setLoadingDevices(true)
            setError(null)
            try {
                const res = await API.get('/lis/devices')
                const list = res.data || []
                setDevices(list)
                if (list.length > 0) {
                    setSelectedDeviceId(list[0].id)
                }
            } catch (err) {
                console.error('Analyzer Logs – load devices error', err)
                setError(analyzeError(err))
                showToast(
                    'error',
                    'Failed to load devices',
                    'Could not fetch analyzer devices. Check login / permissions / backend.'
                )
            } finally {
                setLoadingDevices(false)
            }
        }
        fetchDevices()
    }, [canView, showToast])

    // -------- Fetch logs for selected device --------
    const loadLogs = useCallback(
        async (deviceId) => {
            if (!deviceId) return
            setLoadingLogs(true)
            setError(null)
            try {
                const res = await API.get(`/lis/devices/${deviceId}/logs`, {
                    params: { limit: limit || 100 },
                })
                setLogs(res.data || [])
            } catch (err) {
                console.error('Analyzer Logs – load logs error', err)
                const msg = analyzeError(err)
                setError(msg)
                showToast('error', 'Failed to load logs', msg)
            } finally {
                setLoadingLogs(false)
            }
        },
        [limit, showToast]
    )

    useEffect(() => {
        if (selectedDeviceId) {
            loadLogs(selectedDeviceId)
        }
    }, [selectedDeviceId, loadLogs])

    // -------- Filters --------
    const filteredLogs = useMemo(() => {
        const s = searchText.trim().toLowerCase()
        if (!s) return logs || []
        return (logs || []).filter((log) => {
            const fields = [
                log.id,
                log.direction,
                log.status,
                log.error_message,
                log.sample_ids,
                log.raw_preview,
                log.source_ip,
            ]
            return fields
                .filter(Boolean)
                .map((x) => String(x).toLowerCase())
                .some((txt) => txt.includes(s))
        })
    }, [logs, searchText])

    const selectedDevice =
        devices.find((d) => d.id === selectedDeviceId) || null

    // -------- Permission gate --------
    if (!canView) {
        return (
            <div className="px-4 py-6 sm:px-6 lg:px-8">
                <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle>Access denied</AlertTitle>
                    <AlertDescription className="text-xs">
                        You don’t have permission to view analyzer logs. Ask admin to
                        enable <code className="font-mono text-[11px]">lab.device_logs.view</code>{' '}
                        or <code className="font-mono text-[11px]">lab.devices.view</code>.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="px-4 py-6 sm:px-6 lg:px-8 space-y-4">
            {toast && (
                <Toast
                    kind={toast.kind}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 border border-slate-500 text-xs font-semibold text-slate-700">
                        <Beaker className="w-3.5 h-3.5" />
                        Analyzer Logs
                    </div>
                    <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                        Device Communication Logs
                    </h1>
                    <p className="text-xs md:text-sm text-slate-600">
                        View raw messages received from analyzers and connector status.
                        Use this screen to debug header, tenant or API key issues.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs font-semibold"
                        onClick={() => selectedDeviceId && loadLogs(selectedDeviceId)}
                        disabled={!selectedDeviceId || loadingLogs}
                    >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        {loadingLogs ? 'Refreshing…' : 'Refresh'}
                    </Button>
                </div>
            </div>

            {/* Filters card */}
            <Card className="border-slate-500 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-500" />
                                Filters
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Choose analyzer device, adjust log limit, and search in raw
                                message / status.
                            </CardDescription>
                        </div>
                        {selectedDevice && (
                            <div className="flex flex-wrap items-center gap-2 justify-end text-xs">
                                <Badge variant="outline" className="gap-1 px-2 py-1">
                                    <Cpu className="w-3.5 h-3.5" />
                                    Device:{' '}
                                    <span className="font-semibold">{selectedDevice.name}</span>
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="text-[11px] px-2 py-1 text-slate-600"
                                >
                                    Code: {selectedDevice.code}
                                </Badge>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Device select */}
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                                Analyzer Device
                            </Label>
                            {loadingDevices ? (
                                <Skeleton className="h-9 w-full rounded-lg" />
                            ) : (
                                <div className="relative">
                                    <select
                                        className="block w-full rounded-lg border border-slate-500 bg-white px-3 py-2.5 text-xs md:text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 appearance-none pr-8"
                                        value={selectedDeviceId || ''}
                                        onChange={(e) =>
                                            setSelectedDeviceId(
                                                e.target.value ? Number(e.target.value) : null
                                            )
                                        }
                                    >
                                        {devices.length === 0 && (
                                            <option value="">No devices configured</option>
                                        )}
                                        {devices.length > 0 &&
                                            devices.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name} ({d.code})
                                                </option>
                                            ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                            )}
                        </div>

                        {/* Limit */}
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                                Number of logs
                            </Label>
                            <Input
                                type="number"
                                min={10}
                                max={500}
                                step={10}
                                className="text-xs md:text-sm"
                                value={limit}
                                onChange={(e) =>
                                    setLimit(
                                        e.target.value ? Math.min(500, Number(e.target.value)) : 100
                                    )
                                }
                            />
                            <p className="text-[11px] text-slate-500">
                                Higher values are useful for debugging but may load slower.
                            </p>
                        </div>

                        {/* Search */}
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                                Search in message / error
                            </Label>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <Input
                                    placeholder="sample id, error, IP, status…"
                                    className="pl-8 text-xs md:text-sm"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertTitle>Analyzer log error</AlertTitle>
                            <AlertDescription className="text-xs whitespace-pre-line">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Logs table */}
            <Card className="border-slate-500 shadow-sm">
                <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            {/* 👇 Fixed: use HistoryIcon, not History */}
                            <HistoryIcon className="w-4 h-4 text-slate-500" />
                            Recent Analyzer Messages
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {loadingLogs
                                ? 'Loading logs…'
                                : `Showing ${filteredLogs.length} log(s)${logs.length !== filteredLogs.length
                                    ? ` of ${logs.length}`
                                    : ''
                                }`}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-500 bg-slate-50">
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Time
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Direction / Source
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Status
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Message / Error
                                    </th>
                                    <th className="px-3 py-2 text-right font-semibold text-slate-700">
                                        Raw Preview
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingLogs &&
                                    Array.from({ length: 8 }).map((_, idx) => (
                                        <tr key={idx} className="border-b border-slate-100">
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-32" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-40" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-24" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-64" />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <Skeleton className="h-4 w-40 ml-auto" />
                                            </td>
                                        </tr>
                                    ))}

                                {!loadingLogs && filteredLogs.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-8 text-center text-xs text-slate-500"
                                        >
                                            No logs for current filters.
                                        </td>
                                    </tr>
                                )}

                                {!loadingLogs &&
                                    filteredLogs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className="border-b border-slate-100 hover:bg-slate-50/70"
                                        >
                                            <td className="px-3 py-2 align-top">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="font-medium text-xs text-slate-900">
                                                        {formatDateTime(log.created_at)}
                                                    </span>
                                                </div>
                                                {log.sample_ids && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        Samples: {log.sample_ids}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="text-xs text-slate-800">
                                                    {log.direction || 'INBOUND'}
                                                </div>
                                                {log.source_ip && (
                                                    <div className="text-[10px] text-slate-500">
                                                        {log.source_ip}:{log.source_port ?? ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                {log.error_message ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] border-red-200 text-red-700 bg-red-50"
                                                    >
                                                        Error
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50"
                                                    >
                                                        OK
                                                    </Badge>
                                                )}
                                                {log.status && (
                                                    <div className="text-[10px] text-slate-600 mt-0.5">
                                                        {log.status}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 align-top max-w-md">
                                                {log.error_message ? (
                                                    <div className="text-[11px] text-red-700">
                                                        {log.error_message}
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-slate-700">
                                                        {log.info_message || 'No explicit error.'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 align-top text-right max-w-xs">
                                                <div className="text-[11px] text-slate-600 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {log.raw_preview || log.raw_payload?.slice(0, 120) || '—'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                        {loadingLogs &&
                            Array.from({ length: 4 }).map((_, idx) => (
                                <Card
                                    key={idx}
                                    className="border-slate-500 shadow-sm rounded-xl"
                                >
                                    <CardContent className="p-3 space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-5 w-full" />
                                    </CardContent>
                                </Card>
                            ))}

                        {!loadingLogs && filteredLogs.length === 0 && (
                            <div className="py-8 text-center text-xs text-slate-500">
                                No logs for current filters.
                            </div>
                        )}

                        {!loadingLogs &&
                            filteredLogs.map((log) => (
                                <Card
                                    key={log.id}
                                    className="border-slate-500 shadow-sm rounded-xl"
                                >
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-900">
                                                        {formatDateTime(log.created_at)}
                                                    </span>
                                                </div>
                                                {log.source_ip && (
                                                    <div className="text-[10px] text-slate-500">
                                                        {log.source_ip}:{log.source_port ?? ''}
                                                    </div>
                                                )}
                                            </div>
                                            {log.error_message ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] border-red-200 text-red-700 bg-red-50"
                                                >
                                                    Error
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50"
                                                >
                                                    OK
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="text-[11px] text-slate-700 line-clamp-3">
                                            {log.error_message || log.info_message || 'No explicit error.'}
                                        </div>

                                        <div className="text-[10px] text-slate-500 font-mono whitespace-nowrap overflow-hidden text-ellipsis border-t border-dashed border-slate-500 pt-1 mt-1">
                                            {log.raw_preview || log.raw_payload?.slice(0, 80) || '—'}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
