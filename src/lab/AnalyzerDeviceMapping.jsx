
// FILE: frontend/src/lis/AnalyzerDeviceMapping.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import API from '../api/client'
import { useCan } from '../hooks/useCan'

import {
    Beaker,
    Settings2,
    Filter,
    Search,
    ChevronDown,
    Plus,
    Pencil,
    Trash2,
    Hash,
    Link2,
    AlertTriangle,
    CheckCircle2,
    XCircle,
} from 'lucide-react'

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Alert,
    AlertTitle,
    AlertDescription,
} from '@/components/ui/alert'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'



// Small toast
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
            icon: <Settings2 className="w-4 h-4 text-sky-600" />,
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

function ActiveToggle({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${checked
                ? "bg-emerald-500 border-emerald-500"
                : "bg-slate-200 border-slate-300"
                }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-1"
                    }`}
            />
        </button>
    );
}

// Status chip
function ActiveBadge({ active }) {
    if (active) {
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold">
                Active
            </span>
        )
    }
    return (
        <span className="inline-flex items-center rounded-full bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold">
            Inactive
        </span>
    )
}

// Optional LIS Test search (change endpoint to your real lab test API)
function LisTestPicker({ value, onChange }) {
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [options, setOptions] = useState([])

    const handleSearch = useCallback(
        async (text) => {
            setQuery(text)
            if (!text || text.trim().length < 2) {
                setOptions([])
                return
            }
            setLoading(true)
            try {
                // TODO: adjust to your real test master API
                // Example: /api/lab/tests?search=...
                const res = await API.get('/api/lab/tests', {
                    params: { search: text.trim(), limit: 10 },
                })
                setOptions(res.data || [])
            } catch (err) {
                console.error('Failed to search tests', err)
            } finally {
                setLoading(false)
            }
        },
        []
    )

    const selectedLabel = useMemo(() => {
        if (!value) return 'Not mapped'
        // If you have test in options, show code+name
        const found = options.find((t) => t.id === value)
        if (found) {
            return `${found.code || found.id} – ${found.name || ''}`
        }
        return `Test ID: ${value}`
    }, [value, options])

    return (
        <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">
                LIS Test Mapping
            </Label>
            <div className="space-y-1">
                <Input
                    placeholder="Search LIS test (code / name)…"
                    className="text-xs"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                <div className="border border-slate-200 rounded-lg bg-slate-50/60 px-2 py-1 text-[11px] text-slate-600">
                    Current: <span className="font-semibold">{selectedLabel}</span>
                </div>
            </div>
            {loading && (
                <div className="mt-1 text-[11px] text-slate-500">Searching…</div>
            )}
            {!loading && options.length > 0 && (
                <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {options.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className={`w-full text-left px-2 py-1.5 text-[11px] hover:bg-sky-50 ${value === t.id ? 'bg-sky-50/70' : ''
                                }`}
                            onClick={() => onChange(t.id)}
                        >
                            <div className="font-semibold text-slate-800">
                                {t.code || t.id}{' '}
                                {t.name && (
                                    <span className="font-normal text-slate-600">– {t.name}</span>
                                )}
                            </div>
                            {t.category && (
                                <div className="text-[10px] text-slate-500">
                                    {t.category}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
            {/* fallback manual entry if test search API isn't ready */}
            <div className="pt-2 border-t border-dashed border-slate-200 mt-2">
                <Label className="text-[11px] font-medium text-slate-600">
                    Or manual LIS Test ID
                </Label>
                <Input
                    type="number"
                    placeholder="Enter test ID"
                    className="mt-1 h-8 text-xs"
                    value={value || ''}
                    onChange={(e) =>
                        onChange(e.target.value ? Number(e.target.value) : null)
                    }
                />
            </div>
        </div>
    )
}

export default function AnalyzerDeviceMapping() {
    const [devices, setDevices] = useState([])
    const [selectedDeviceId, setSelectedDeviceId] = useState(null)
    const [channels, setChannels] = useState([])

    const [searchText, setSearchText] = useState('')
    const [activeFilter, setActiveFilter] = useState('all') // all | active | inactive

    const [loadingDevices, setLoadingDevices] = useState(false)
    const [loadingChannels, setLoadingChannels] = useState(false)

    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)

    const [editOpen, setEditOpen] = useState(false)
    const [editingChannel, setEditingChannel] = useState(null)
    const [form, setForm] = useState({
        external_test_code: '',
        external_test_name: '',
        lis_test_id: null,
        default_unit: '',
        reference_range: '',
        is_active: true,
    })
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState(null)

    const canView = useCan('lab.devices.view')
    const canManage = useCan('lab.devices.manage')

    const showToast = useCallback((kind, title, message) => {
        setToast({ kind, title, message })
        setTimeout(() => setToast(null), 3500)
    }, [])

    // Fetch devices
    useEffect(() => {
        if (!canView) return
        const fetchDevices = async () => {
            setLoadingDevices(true)
            setError(null)
            try {
                const res = await API.get('/api/lis/devices')
                setDevices(res.data || [])
                if (res.data && res.data.length > 0) {
                    setSelectedDeviceId(res.data[0].id)
                }
            } catch (err) {
                console.error(err)
                setError('Failed to load analyzer devices')
                showToast(
                    'error',
                    'Load failed',
                    'Unable to fetch devices. Please try again.'
                )
            } finally {
                setLoadingDevices(false)
            }
        }
        fetchDevices()
    }, [canView, showToast])

    // Fetch channels
    const loadChannels = useCallback(
        async (deviceId) => {
            if (!deviceId) return
            setLoadingChannels(true)
            setError(null)
            try {
                const res = await API.get(`/api/lis/devices/${deviceId}/channels`)
                setChannels(res.data || [])
            } catch (err) {
                console.error(err)
                setError('Failed to load channel mappings')
                showToast(
                    'error',
                    'Load failed',
                    'Unable to load device channels. Check backend.'
                )
            } finally {
                setLoadingChannels(false)
            }
        },
        [showToast]
    )

    useEffect(() => {
        if (selectedDeviceId) {
            loadChannels(selectedDeviceId)
        }
    }, [selectedDeviceId, loadChannels])

    // Filters
    const filteredChannels = useMemo(() => {
        let rows = channels || []
        if (activeFilter === 'active') {
            rows = rows.filter((c) => c.is_active)
        } else if (activeFilter === 'inactive') {
            rows = rows.filter((c) => !c.is_active)
        }
        const s = searchText.trim().toLowerCase()
        if (s) {
            rows = rows.filter((c) => {
                const code = (c.external_test_code || '').toLowerCase()
                const name = (c.external_test_name || '').toLowerCase()
                return code.includes(s) || name.includes(s)
            })
        }
        return rows
    }, [channels, activeFilter, searchText])

    const selectedDevice = useMemo(
        () => devices.find((d) => d.id === selectedDeviceId) || null,
        [devices, selectedDeviceId]
    )

    // Open create modal
    const openCreate = () => {
        setEditingChannel(null)
        setForm({
            external_test_code: '',
            external_test_name: '',
            lis_test_id: null,
            default_unit: '',
            reference_range: '',
            is_active: true,
        })
        setEditOpen(true)
    }

    // Open edit modal
    const openEdit = (ch) => {
        setEditingChannel(ch)
        setForm({
            external_test_code: ch.external_test_code || '',
            external_test_name: ch.external_test_name || '',
            lis_test_id: ch.lis_test_id || null,
            default_unit: ch.default_unit || '',
            reference_range: ch.reference_range || '',
            is_active: ch.is_active ?? true,
        })
        setEditOpen(true)
    }

    const handleFormChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        if (!selectedDeviceId) return
        if (!form.external_test_code.trim()) {
            showToast('error', 'Validation', 'External test code is required.')
            return
        }
        setSaving(true)
        try {
            if (editingChannel) {
                // update
                await API.put(`/api/lis/channels/${editingChannel.id}`, {
                    external_test_name: form.external_test_name || null,
                    lis_test_id: form.lis_test_id || null,
                    default_unit: form.default_unit || null,
                    reference_range: form.reference_range || null,
                    is_active: form.is_active,
                })
                showToast('success', 'Updated', 'Mapping updated successfully.')
            } else {
                // create
                await API.post(`/api/lis/devices/${selectedDeviceId}/channels`, {
                    device_id: selectedDeviceId, // backend will override from path anyway
                    external_test_code: form.external_test_code.trim(),
                    external_test_name: form.external_test_name || null,
                    lis_test_id: form.lis_test_id || null,
                    default_unit: form.default_unit || null,
                    reference_range: form.reference_range || null,
                    is_active: form.is_active,
                })
                showToast('success', 'Created', 'New mapping added successfully.')
            }
            setEditOpen(false)
            await loadChannels(selectedDeviceId)
        } catch (err) {
            console.error(err)
            showToast(
                'error',
                'Save failed',
                'Unable to save mapping. Please check and try again.'
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (ch) => {
        if (!window.confirm(`Delete mapping ${ch.external_test_code}?`)) return
        setDeletingId(ch.id)
        try {
            await API.delete(`/api/lis/channels/${ch.id}`)
            showToast('success', 'Deleted', 'Mapping removed.')
            setChannels((prev) => prev.filter((x) => x.id !== ch.id))
        } catch (err) {
            console.error(err)
            showToast(
                'error',
                'Delete failed',
                'Unable to delete mapping. Please try again.'
            )
        } finally {
            setDeletingId(null)
        }
    }

    if (!canView) {
        return (
            <div className="px-4 py-6 sm:px-6 lg:px-8">
                <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle>Access denied</AlertTitle>
                    <AlertDescription className="text-xs">
                        You don’t have permission to view analyzer mapping. Contact admin.
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
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 border border-slate-200 text-xs font-semibold text-slate-700">
                        <Settings2 className="w-3.5 h-3.5" />
                        Analyzer Device Mapping
                    </div>
                    <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                        Device Test Code Mapping
                    </h1>
                    <p className="text-xs md:text-sm text-slate-600">
                        Map analyzer test codes to LIS tests. This ensures incoming results
                        are correctly attached to Lab Orders.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canManage && (
                        <Button
                            size="sm"
                            className="gap-1 text-xs font-semibold"
                            onClick={openCreate}
                            disabled={!selectedDeviceId}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Mapping
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters / Device select */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-500" />
                                Filters
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Choose analyzer device and filter channel mappings by code /
                                name / status.
                            </CardDescription>
                        </div>
                        {selectedDevice && (
                            <div className="flex flex-wrap items-center gap-2 justify-end text-xs">
                                <Badge variant="outline" className="gap-1 px-2 py-1">
                                    <Beaker className="w-3.5 h-3.5" />
                                    Device: <span className="font-semibold">{selectedDevice.name}</span>
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
                                        className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs md:text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 appearance-none pr-8"
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

                        {/* Search */}
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                                Search Code / Name
                            </Label>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <Input
                                    placeholder="e.g. WBC, GLU, HB…"
                                    className="pl-8 text-xs md:text-sm"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Active filter */}
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                                Status
                            </Label>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'active', label: 'Active' },
                                    { id: 'inactive', label: 'Inactive' },
                                ].map((f) => (
                                    <Button
                                        key={f.id}
                                        type="button"
                                        variant={activeFilter === f.id ? 'default' : 'outline'}
                                        size="xs"
                                        className={`text-[11px] font-semibold px-2.5 py-1 ${activeFilter === f.id
                                            ? 'bg-sky-600 hover:bg-sky-700'
                                            : 'bg-white'
                                            }`}
                                        onClick={() => setActiveFilter(f.id)}
                                    >
                                        {f.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Mapping table */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-slate-500" />
                            Device Test Code Mapping
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {loadingChannels
                                ? 'Loading mappings…'
                                : `Showing ${filteredChannels.length} mapping(s)${channels.length !== filteredChannels.length
                                    ? ` of ${channels.length}`
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
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Device Test Code
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Device Test Name
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        LIS Test
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Default Unit / Range
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                                        Status
                                    </th>
                                    <th className="px-3 py-2 text-right font-semibold text-slate-700">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingChannels &&
                                    Array.from({ length: 6 }).map((_, idx) => (
                                        <tr key={idx} className="border-b border-slate-100">
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-24" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-40" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-32" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-32" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Skeleton className="h-4 w-16" />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <Skeleton className="h-7 w-20 ml-auto" />
                                            </td>
                                        </tr>
                                    ))}

                                {!loadingChannels && filteredChannels.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-3 py-8 text-center text-xs text-slate-500"
                                        >
                                            No mappings found for current filters.
                                        </td>
                                    </tr>
                                )}

                                {!loadingChannels &&
                                    filteredChannels.map((ch) => (
                                        <tr
                                            key={ch.id}
                                            className="border-b border-slate-100 hover:bg-slate-50/70"
                                        >
                                            <td className="px-3 py-2 align-top">
                                                <div className="flex items-center gap-1">
                                                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="font-semibold text-xs text-slate-900">
                                                        {ch.external_test_code || '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="text-xs text-slate-800">
                                                    {ch.external_test_name || '—'}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="space-y-0.5 text-[11px] text-slate-600">
                                                    <div>
                                                        LIS Test ID:{' '}
                                                        <span className="font-semibold">
                                                            {ch.lis_test_id || 'Not mapped'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        (Mapping used by auto-mapper)
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="space-y-0.5 text-[11px] text-slate-600">
                                                    {ch.default_unit && (
                                                        <div>
                                                            Unit:{' '}
                                                            <span className="font-semibold">
                                                                {ch.default_unit}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {ch.reference_range && (
                                                        <div>
                                                            Range:{' '}
                                                            <span className="font-semibold">
                                                                {ch.reference_range}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <ActiveBadge active={ch.is_active} />
                                            </td>
                                            <td className="px-3 py-2 align-top text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    {canManage && (
                                                        <>
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                className="text-[11px] font-semibold"
                                                                onClick={() => openEdit(ch)}
                                                            >
                                                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                className="text-[11px] font-semibold text-red-600 border-red-200 hover:bg-red-50"
                                                                onClick={() => handleDelete(ch)}
                                                                disabled={deletingId === ch.id}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                                                {deletingId === ch.id ? 'Deleting…' : 'Delete'}
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                        {loadingChannels &&
                            Array.from({ length: 4 }).map((_, idx) => (
                                <Card
                                    key={idx}
                                    className="border-slate-200 shadow-sm rounded-xl"
                                >
                                    <CardContent className="p-3 space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-5 w-full" />
                                    </CardContent>
                                </Card>
                            ))}

                        {!loadingChannels && filteredChannels.length === 0 && (
                            <div className="py-8 text-center text-xs text-slate-500">
                                No mappings found.
                            </div>
                        )}

                        {!loadingChannels &&
                            filteredChannels.map((ch) => (
                                <Card
                                    key={ch.id}
                                    className="border-slate-200 shadow-sm rounded-xl"
                                >
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-1">
                                                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-900">
                                                        {ch.external_test_code || '—'}
                                                    </span>
                                                </div>
                                                {ch.external_test_name && (
                                                    <div className="text-[11px] text-slate-600">
                                                        {ch.external_test_name}
                                                    </div>
                                                )}
                                            </div>
                                            <ActiveBadge active={ch.is_active} />
                                        </div>

                                        <div className="text-[11px] text-slate-600 space-y-0.5">
                                            <div>
                                                LIS Test:{' '}
                                                <span className="font-semibold">
                                                    {ch.lis_test_id || 'Not mapped'}
                                                </span>
                                            </div>
                                            {ch.default_unit && (
                                                <div>
                                                    Unit:{' '}
                                                    <span className="font-semibold">
                                                        {ch.default_unit}
                                                    </span>
                                                </div>
                                            )}
                                            {ch.reference_range && (
                                                <div>
                                                    Range:{' '}
                                                    <span className="font-semibold">
                                                        {ch.reference_range}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {canManage && (
                                            <div className="flex justify-end gap-1 pt-1">
                                                <Button
                                                    size="xs"
                                                    variant="outline"
                                                    className="text-[11px] font-semibold"
                                                    onClick={() => openEdit(ch)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    variant="outline"
                                                    className="text-[11px] font-semibold text-red-600 border-red-200 hover:bg-red-50"
                                                    onClick={() => handleDelete(ch)}
                                                    disabled={deletingId === ch.id}
                                                >
                                                    {deletingId === ch.id ? '...' : 'Del'}
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
                            <Link2 className="w-4 h-4 text-sky-600" />
                            {editingChannel ? 'Edit Mapping' : 'New Mapping'}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Map analyzer test code to LIS test. Auto-mapper will use this
                            configuration when linking results.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {!editingChannel && (
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">
                                    Device Test Code *
                                </Label>
                                <Input
                                    placeholder="e.g. WBC, GLU, HB…"
                                    className="text-xs"
                                    value={form.external_test_code}
                                    onChange={(e) =>
                                        handleFormChange('external_test_code', e.target.value)
                                    }
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                                Device Test Name
                            </Label>
                            <Input
                                placeholder="e.g. White Blood Cell Count"
                                className="text-xs"
                                value={form.external_test_name}
                                onChange={(e) =>
                                    handleFormChange('external_test_name', e.target.value)
                                }
                            />
                        </div>

                        <LisTestPicker
                            value={form.lis_test_id}
                            onChange={(val) => handleFormChange('lis_test_id', val)}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">
                                    Default Unit
                                </Label>
                                <Input
                                    placeholder="e.g. 10^3/uL, mmol/L"
                                    className="text-xs"
                                    value={form.default_unit}
                                    onChange={(e) =>
                                        handleFormChange('default_unit', e.target.value)
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">
                                    Reference Range
                                </Label>
                                <Input
                                    placeholder="e.g. 4.0-11.0"
                                    className="text-xs"
                                    value={form.reference_range}
                                    onChange={(e) =>
                                        handleFormChange('reference_range', e.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold text-slate-700">
                                    Active
                                </Label>
                                <p className="text-[11px] text-slate-500">
                                    Inactive mappings are ignored by auto-mapper.
                                </p>
                            </div>
                            <ActiveToggle
                                checked={form.is_active}
                                onChange={(v) => handleFormChange("is_active", v)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setEditOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="text-xs font-semibold"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
