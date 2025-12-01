// FILE: src/pages/PharmacyRxExplorer.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
    listPharmacyPrescriptions,
    dispensePharmacyPrescription,
    billPharmacyPrescription,
} from '../api/pharmacy'
import { listInventoryLocations } from '../api/inventory'

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
    Tabs,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'

import {
    Pill,
    Search,
    Loader2,
    User,
    Stethoscope,
    Building2,
    Clock3,
    MapPin,
    CheckCircle2,
    AlertCircle,
    XCircle,
    RefreshCcw,
} from 'lucide-react'

function formatDateTime(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })}`
}

function formatDate(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleDateString()
}

function statusChip(rxStatus) {
    switch (rxStatus) {
        case 'ISSUED':
            return {
                label: 'Issued',
                className:
                    'bg-amber-50 text-amber-700 border border-amber-100',
                icon: AlertCircle,
            }
        case 'PARTIALLY_DISPENSED':
            return {
                label: 'Partial',
                className:
                    'bg-blue-50 text-blue-700 border border-blue-100',
                icon: AlertCircle,
            }
        case 'DISPENSED':
            return {
                label: 'Dispensed',
                className:
                    'bg-emerald-50 text-emerald-700 border border-emerald-100',
                icon: CheckCircle2,
            }
        case 'CANCELLED':
            return {
                label: 'Cancelled',
                className:
                    'bg-red-50 text-red-700 border border-red-100',
                icon: XCircle,
            }
        default:
            return {
                label: rxStatus || 'Unknown',
                className:
                    'bg-slate-50 text-slate-700 border border-slate-100',
                icon: AlertCircle,
            }
    }
}

export default function PharmacyRxExplorer() {
    // Filters
    const [rxType, setRxType] = useState('ALL') // ALL | OPD | IPD | GENERAL
    const [status, setStatus] = useState('ACTIVE') // ACTIVE | ALL | ISSUED | PARTIALLY_DISPENSED | DISPENSED | CANCELLED
    const [locationId, setLocationId] = useState('all')
    const [patientIdFilter, setPatientIdFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    // Data
    const [locations, setLocations] = useState([])
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedId, setSelectedId] = useState(null)

    // Actions state
    const [dispensingId, setDispensingId] = useState(null)
    const [billingId, setBillingId] = useState(null)

    // ---------- Load locations ----------
    useEffect(() => {
        listInventoryLocations()
            .then((res) => {
                const locs = res.data || []
                setLocations(locs)
            })
            .catch(() => {
                setLocations([])
            })
    }, [])

    // ---------- Load prescriptions ----------
    const loadPrescriptions = async () => {
        try {
            setLoading(true)
            const params = {}

            if (rxType !== 'ALL') params.type = rxType

            if (status === 'ISSUED' ||
                status === 'PARTIALLY_DISPENSED' ||
                status === 'DISPENSED' ||
                status === 'CANCELLED'
            ) {
                params.status = status
            }
            // status = ACTIVE => filter on client (ISSUED + PARTIALLY_DISPENSED)
            // status = ALL => no status param

            if (patientIdFilter.trim()) {
                params.patient_id = patientIdFilter.trim()
            }
            if (dateFrom) params.from_date = dateFrom
            if (dateTo) params.to_date = dateTo

            const res = await listPharmacyPrescriptions(params)
            setRows(res.data || [])
        } catch (err) {
            // interceptor shows toast
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // auto reload when type/status changes
        loadPrescriptions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rxType, status])

    // ---------- Derived & selected ----------
    const filteredRows = useMemo(() => {
        let data = rows || []

        if (status === 'ACTIVE') {
            data = data.filter((r) =>
                r.status === 'ISSUED' ||
                r.status === 'PARTIALLY_DISPENSED'
            )
        }

        if (locationId !== 'all') {
            data = data.filter((r) =>
                String(r.location_id) === String(locationId)
            )
        }

        return data
    }, [rows, status, locationId])

    useEffect(() => {
        if (!filteredRows.length) {
            setSelectedId(null)
            return
        }
        if (!selectedId || !filteredRows.some((r) => r.id === selectedId)) {
            setSelectedId(filteredRows[0].id)
        }
    }, [filteredRows, selectedId])

    const selectedRx = useMemo(
        () => filteredRows.find((r) => r.id === selectedId) || null,
        [filteredRows, selectedId]
    )

    const totals = useMemo(() => {
        const total = filteredRows.length
        const active = filteredRows.filter(
            (r) =>
                r.status === 'ISSUED' ||
                r.status === 'PARTIALLY_DISPENSED'
        ).length
        const completed = filteredRows.filter(
            (r) => r.status === 'DISPENSED'
        ).length
        return { total, active, completed }
    }, [filteredRows])

    // ---------- Actions ----------
    const handleQuickDispense = async (rx) => {
        if (!rx) return

        const pendingLines = (rx.lines || []).filter(
            (ln) =>
                ln.status === 'WAITING' ||
                ln.status === 'PARTIAL' ||
                ln.status === 'PARTIALLY_DISPENSED'
        )

        const linesPayload = pendingLines
            .map((ln) => {
                const requested = Number(ln.requested_qty || 0)
                const dispensed = Number(ln.dispensed_qty || 0)
                const remaining = requested - dispensed
                return {
                    line_id: ln.id,
                    quantity: remaining,
                }
            })
            .filter((ln) => ln.quantity > 0)

        if (!linesPayload.length) {
            toast.info('No pending quantity to dispense for this prescription')
            return
        }

        if (
            !window.confirm(
                `Dispense all remaining quantities (${linesPayload.length} line(s)) for Rx #${rx.prescription_number || rx.id}?`
            )
        ) {
            return
        }

        try {
            setDispensingId(rx.id)
            await dispensePharmacyPrescription(rx.id, {
                lines: linesPayload,
                remark: `Quick dispense all remaining from Rx Explorer`,
            })
            toast.success('Prescription dispensed (remaining quantities)')
            await loadPrescriptions()
        } catch (err) {
            // toast handled by interceptor
        } finally {
            setDispensingId(null)
        }
    }

    const handleBill = async (rx) => {
        if (!rx) return

        if (
            !window.confirm(
                `Generate Pharmacy bill from dispensed lines for Rx #${rx.prescription_number || rx.id}?`
            )
        ) {
            return
        }

        try {
            setBillingId(rx.id)
            const res = await billPharmacyPrescription(rx.id)
            const sale = res.data
            toast.success(
                `Pharmacy bill created: ${sale.bill_number} (Net ${sale.net_amount})`
            )
        } catch (err) {
            // e.g. 400: No dispensed medicines to bill
            // interceptor already toasts details
        } finally {
            setBillingId(null)
        }
    }

    // ---------- Render ----------
    return (
        <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 sm:gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Pill className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
                        Pharmacy Rx Explorer (Inventory)
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">
                        View, filter, and dispense inventory-integrated prescriptions
                        across OPD/IPD/Counter. Uses FEFO batches and auto-billing.
                    </p>
                </div>
            </div>

            <Card className="border-slate-200 rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 sm:gap-4">
                        {/* Top row: filters */}
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            {/* Left: search / dates / patient ID */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Patient ID (optional)"
                                        className="pl-7 h-9 w-36 sm:w-40"
                                        value={patientIdFilter}
                                        onChange={(e) => setPatientIdFilter(e.target.value)}
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
                                    onClick={loadPrescriptions}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                                    )}
                                    Apply
                                </Button>
                            </div>

                            {/* Right: stats */}
                            <div className="flex flex-wrap items-center gap-2 justify-end text-[11px] text-slate-500">
                                <div>
                                    Total{' '}
                                    <Badge
                                        variant="secondary"
                                        className="h-5 px-2 text-[10px]"
                                    >
                                        {totals.total}
                                    </Badge>
                                </div>
                                <div>
                                    Active{' '}
                                    <Badge
                                        variant="outline"
                                        className="h-5 px-2 text-[10px]"
                                    >
                                        {totals.active}
                                    </Badge>
                                </div>
                                <div>
                                    Dispensed{' '}
                                    <Badge
                                        variant="outline"
                                        className="h-5 px-2 text-[10px]"
                                    >
                                        {totals.completed}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Second row: type + status + location */}
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                {/* Type tabs */}
                                <Tabs
                                    value={rxType}
                                    onValueChange={setRxType}
                                    className="hidden sm:block"
                                >
                                    <TabsList className="h-8">
                                        <TabsTrigger value="ALL" className="text-[11px]">
                                            All
                                        </TabsTrigger>
                                        <TabsTrigger value="OPD" className="text-[11px]">
                                            OPD
                                        </TabsTrigger>
                                        <TabsTrigger value="IPD" className="text-[11px]">
                                            IPD
                                        </TabsTrigger>
                                        <TabsTrigger value="GENERAL" className="text-[11px]">
                                            General
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                {/* Mobile type chips */}
                                <div className="sm:hidden flex gap-1 text-[11px]">
                                    {['ALL', 'OPD', 'IPD', 'GENERAL'].map((t) => (
                                        <Badge
                                            key={t}
                                            variant={rxType === t ? 'default' : 'outline'}
                                            className="cursor-pointer"
                                            onClick={() => setRxType(t)}
                                        >
                                            {t}
                                        </Badge>
                                    ))}
                                </div>

                                {/* Status chips */}
                                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                                    <Badge
                                        variant={status === 'ACTIVE' ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => setStatus('ACTIVE')}
                                    >
                                        Active
                                    </Badge>
                                    <Badge
                                        variant={status === 'ALL' ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => setStatus('ALL')}
                                    >
                                        All
                                    </Badge>
                                    <Badge
                                        variant={status === 'ISSUED' ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => setStatus('ISSUED')}
                                    >
                                        Issued
                                    </Badge>
                                    <Badge
                                        variant={
                                            status === 'PARTIALLY_DISPENSED'
                                                ? 'default'
                                                : 'outline'
                                        }
                                        className="cursor-pointer"
                                        onClick={() => setStatus('PARTIALLY_DISPENSED')}
                                    >
                                        Partial
                                    </Badge>
                                    <Badge
                                        variant={
                                            status === 'DISPENSED' ? 'default' : 'outline'
                                        }
                                        className="cursor-pointer"
                                        onClick={() => setStatus('DISPENSED')}
                                    >
                                        Dispensed
                                    </Badge>
                                    <Badge
                                        variant={
                                            status === 'CANCELLED' ? 'default' : 'outline'
                                        }
                                        className="cursor-pointer"
                                        onClick={() => setStatus('CANCELLED')}
                                    >
                                        Cancelled
                                    </Badge>
                                </div>
                            </div>

                            {/* Location filter */}
                            <div className="flex items-center gap-2 justify-end">
                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    Location
                                </span>
                                <select
                                    className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-[11px] text-slate-700"
                                    value={locationId}
                                    onChange={(e) => setLocationId(e.target.value)}
                                >
                                    <option value="all">All locations</option>
                                    {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    <div className="border-t border-slate-100 mt-2 mb-2" />

                    {/* Explorer layout: left list, right detail */}
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)] gap-3 lg:gap-4">
                        {/* LEFT: Rx list */}
                        <div className="border border-slate-100 rounded-2xl bg-slate-50/60 overflow-hidden flex flex-col">
                            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                                    <Pill className="h-3.5 w-3.5 text-slate-500" />
                                    Prescriptions
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    {filteredRows.length} in view
                                </span>
                            </div>

                            {loading && (
                                <div className="flex-1 flex items-center justify-center py-10">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                            )}

                            {!loading && filteredRows.length === 0 && (
                                <div className="flex-1 flex items-center justify-center py-10">
                                    <p className="text-xs text-slate-500">
                                        No prescriptions found for this filter.
                                    </p>
                                </div>
                            )}

                            {!loading && filteredRows.length > 0 && (
                                <div className="flex-1 overflow-y-auto max-h-[520px]">
                                    {filteredRows.map((rx) => {
                                        const chip = statusChip(rx.status)
                                        const isSelected = rx.id === selectedId
                                        const isActive =
                                            rx.status === 'ISSUED' ||
                                            rx.status === 'PARTIALLY_DISPENSED'

                                        return (
                                            <button
                                                key={rx.id}
                                                type="button"
                                                onClick={() => setSelectedId(rx.id)}
                                                className={[
                                                    'w-full text-left px-3 py-2.5 border-b border-slate-100',
                                                    'flex flex-col gap-1.5 hover:bg-slate-100/70',
                                                    isSelected ? 'bg-slate-100/80' : '',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-900">
                                                                {rx.prescription_number || `Rx #${rx.id}`}
                                                            </span>
                                                            <Badge
                                                                variant="outline"
                                                                className="h-4 px-1.5 text-[9px]"
                                                            >
                                                                {rx.type || '—'}
                                                            </Badge>
                                                            {isActive && (
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                            <Clock3 className="h-3 w-3" />
                                                            <span>
                                                                {formatDateTime(rx.created_at)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-1">
                                                        <div
                                                            className={[
                                                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]',
                                                                chip.className,
                                                            ].join(' ')}
                                                        >
                                                            <chip.icon className="h-3 w-3" />
                                                            <span>{chip.label}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            <span>{rx.location_name || '—'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-700">
                                                        <User className="h-3 w-3 text-slate-400" />
                                                        <span>{rx.patient_name || '—'}</span>
                                                    </div>
                                                    {rx.doctor_name && (
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                            <Stethoscope className="h-3 w-3 text-slate-400" />
                                                            <span>{rx.doctor_name}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                                    <span>
                                                        {rx.lines?.length || 0} item(s)
                                                    </span>
                                                    {rx.status === 'DISPENSED' && (
                                                        <span>• Fully dispensed</span>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Details panel */}
                        <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 flex flex-col min-h-[260px]">
                            {!selectedRx && (
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-xs text-slate-500">
                                        Select a prescription from the left to view details.
                                    </p>
                                </div>
                            )}

                            {selectedRx && (
                                <>
                                    {/* Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-900">
                                                    Rx {selectedRx.prescription_number || `#${selectedRx.id}`}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="h-5 px-2 text-[10px]"
                                                >
                                                    {selectedRx.type || '—'}
                                                </Badge>
                                            </div>
                                            <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1">
                                                <User className="h-3 w-3 text-slate-400" />
                                                <span>{selectedRx.patient_name || '—'}</span>
                                                <span className="mx-1">•</span>
                                                <Stethoscope className="h-3 w-3 text-slate-400" />
                                                <span>{selectedRx.doctor_name || '—'}</span>
                                                <span className="mx-1">•</span>
                                                <Building2 className="h-3 w-3 text-slate-400" />
                                                <span>{selectedRx.location_name || '—'}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2">
                                                <span>
                                                    Created: {formatDateTime(selectedRx.created_at)}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    Updated: {formatDateTime(selectedRx.updated_at)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-[11px]"
                                                disabled={
                                                    dispensingId === selectedRx.id ||
                                                    selectedRx.status === 'DISPENSED' ||
                                                    selectedRx.status === 'CANCELLED'
                                                }
                                                onClick={() => handleQuickDispense(selectedRx)}
                                            >
                                                {dispensingId === selectedRx.id ? (
                                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                                )}
                                                Quick dispense remaining
                                            </Button>

                                            <Button
                                                size="sm"
                                                className="h-8 text-[11px]"
                                                disabled={billingId === selectedRx.id}
                                                onClick={() => handleBill(selectedRx)}
                                            >
                                                {billingId === selectedRx.id ? (
                                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <ShoppingCartIcon className="mr-1 h-3.5 w-3.5" />
                                                )}
                                                Generate bill
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Lines table */}
                                    <div className="flex-1 rounded-2xl border border-slate-100 bg-slate-50/60 p-2 sm:p-3 overflow-y-auto max-h-[360px]">
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                                                    <th className="py-1.5 pr-2 text-left font-medium">
                                                        Item
                                                    </th>
                                                    <th className="py-1.5 px-2 text-right font-medium">
                                                        Req
                                                    </th>
                                                    <th className="py-1.5 px-2 text-right font-medium">
                                                        Disp
                                                    </th>
                                                    <th className="py-1.5 px-2 text-right font-medium">
                                                        Rem
                                                    </th>
                                                    <th className="py-1.5 pl-2 text-left font-medium">
                                                        Status
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedRx.lines || []).map((ln) => {
                                                    const req = Number(ln.requested_qty || 0)
                                                    const disp = Number(ln.dispensed_qty || 0)
                                                    const rem = req - disp

                                                    return (
                                                        <tr
                                                            key={ln.id}
                                                            className="border-b border-slate-100"
                                                        >
                                                            <td className="py-1.5 pr-2 align-top">
                                                                <div className="font-medium text-[11px] text-slate-900">
                                                                    {ln.item_name || '—'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    {ln.item_strength && (
                                                                        <span>{ln.item_strength} • </span>
                                                                    )}
                                                                    {ln.frequency_code || '—'}{' '}
                                                                    {ln.duration_days
                                                                        ? `• ${ln.duration_days} day(s)`
                                                                        : ''}
                                                                </div>
                                                            </td>
                                                            <td className="py-1.5 px-2 align-top text-right text-[10px] text-slate-700">
                                                                {req}
                                                            </td>
                                                            <td className="py-1.5 px-2 align-top text-right text-[10px] text-slate-700">
                                                                {disp}
                                                            </td>
                                                            <td className="py-1.5 px-2 align-top text-right text-[10px] text-slate-700">
                                                                {rem}
                                                            </td>
                                                            <td className="py-1.5 pl-2 align-top text-[10px]">
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 border border-slate-200 text-slate-700">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                                    {ln.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}

                                                {(!selectedRx.lines ||
                                                    selectedRx.lines.length === 0) && (
                                                        <tr>
                                                            <td
                                                                colSpan={5}
                                                                className="py-4 text-center text-[11px] text-slate-500"
                                                            >
                                                                No items found in this prescription.
                                                            </td>
                                                        </tr>
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Notes */}
                                    {selectedRx.notes && (
                                        <div className="mt-2 text-[11px] text-slate-600">
                                            <span className="font-semibold">Notes:</span>{' '}
                                            {selectedRx.notes}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// small helper icon (to avoid importing full shopping cart icon again if not needed elsewhere)
function ShoppingCartIcon(props) {
    return <svg viewBox="0 0 24 24" {...props}>
        <path
            d="M6 6h15l-1.5 9h-12z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <circle cx="9" cy="19" r="1" fill="currentColor" />
        <circle cx="17" cy="19" r="1" fill="currentColor" />
    </svg>
}
