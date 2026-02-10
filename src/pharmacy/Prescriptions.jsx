// FILE: src/pharmacy/Prescriptions.jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import {
    listPrescriptions,
    updatePrescriptionItemStatus,
    updatePrescriptionStatus,
    dispensePrescription,
    getSalePdf,
} from '@/api/pharmacy'
import PatientPicker from '@/opd/components/patientpicker'
import PermGate from '@/components/PermGate'
import {
    Card, CardHeader, CardContent, CardTitle,
} from '@/components/ui/card'
import {
    Table, TableHeader, TableHead, TableRow, TableBody, TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select, SelectTrigger, SelectItem, SelectContent, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster, toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CheckCircle2, XCircle, RefreshCw, Filter, Printer,
} from 'lucide-react'

const STATUS = ['new', 'in_progress', 'dispensed', 'cancelled']

const statusTone = (s) => {
    switch (s) {
        case 'new': return { class: 'bg-blue-50 text-blue-700 border-blue-200', label: 'New' }
        case 'in_progress': return { class: 'bg-amber-50 text-amber-700 border-amber-200', label: 'In Progress' }
        case 'dispensed': return { class: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Dispensed' }
        case 'cancelled': return { class: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Cancelled' }
        default: return { class: 'bg-gray-50 text-gray-700 border-gray-200', label: s || '—' }
    }
}

function openPdfBlob(blob) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function Prescriptions() {
    const [rows, setRows] = useState([])
    const [q, setQ] = useState('')
    const [status, setStatus] = useState('')
    const [contextType, setContextType] = useState('') // '', 'opd', 'ipd'
    const [patientId, setPatientId] = useState(null)
    const [loading, setLoading] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [lastUpdated, setLastUpdated] = useState(null)
    const timerRef = useRef(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await listPrescriptions({
                q: q?.trim() || undefined,
                status: status || undefined,
                context_type: contextType || undefined,
                patient_id: patientId || undefined,
                limit: 200,
            })
            setRows(data || [])
            setLastUpdated(new Date())
        } catch (e) {
            toast.error('Failed to load prescriptions', {
                description: e?.response?.data?.detail || 'Retry',
            })
        } finally { setLoading(false) }
    }, [q, status, contextType, patientId])

    // initial + filter-driven loads
    useEffect(() => { load() }, [load])

    // realtime-ish polling
    useEffect(() => {
        if (!autoRefresh) return
        timerRef.current = setInterval(load, 10000)
        return () => clearInterval(timerRef.current)
    }, [autoRefresh, load])

    const toggleItem = async (itemId, nextStatus) => {
        try {
            await updatePrescriptionItemStatus(itemId, { status: nextStatus })
            toast.success('Item updated', { description: `Status → ${nextStatus}` })
            await load()
        } catch (e) {
            toast.error('Update failed', { description: e?.response?.data?.detail || 'Retry' })
        }
    }

    const bulkMark = async (prescriptionId, nextStatus) => {
        try {
            await updatePrescriptionStatus(prescriptionId, { status: nextStatus })
            toast.success('Prescription updated', { description: `Status → ${nextStatus}` })
            await load()
        } catch (e) {
            toast.error('Update failed', { description: e?.response?.data?.detail || 'Retry' })
        }
    }

    const handleDispense = async (prescriptionId, { withPrint } = { withPrint: false }) => {
        try {
            const { data } = await dispensePrescription(prescriptionId)
            toast.success('Prescription dispensed', {
                description: 'Stock consumed & bill generated (if configured).',
            })
            await load()

            if (withPrint) {
                const saleId = data?.sale_id || data?.invoice_id || data?.id
                if (!saleId) return
                try {
                    const blob = await getSalePdf(saleId)
                    openPdfBlob(blob)
                } catch (e) {
                    toast.error('Unable to open bill PDF', {
                        description: e?.response?.data?.detail || e.message || 'Bill created but PDF failed.',
                    })
                }
            }
        } catch (e) {
            toast.error('Dispense failed', {
                description: e?.response?.data?.detail || 'Retry',
            })
        }
    }

    const clearFilters = () => {
        setQ('')
        setStatus('')
        setContextType('')
        setPatientId(null)
    }

    const quickStatus = (val, label) => (
        <Button
            key={val}
            size="sm"
            variant={status === val ? 'default' : 'outline'}
            onClick={() => setStatus(val)}
        >
            {label}
        </Button>
    )

    const ALL = '__all__';
    const toSelect = (v) => (v === '' || v == null ? ALL : String(v));
    const fromSelect = (v) => (v === ALL ? '' : v);

    return (
        <div className="p-4 space-y-4">
            {/* If you already mount <Toaster /> globally, remove this one */}
            <Toaster richColors closeButton position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-semibold">Pharmacy · Prescriptions</h1>
                    {lastUpdated && (
                        <span className="hidden sm:inline text-xs text-gray-500">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
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
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-6 items-end">
                        <div className="md:col-span-2">
                            <Label>Search</Label>
                            <Input
                                placeholder="UHID, patient, medicine…"
                                value={q}
                                onChange={e => setQ(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={toSelect(status)} onValueChange={(v) => setStatus(fromSelect(v))}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Context</Label>
                            <Select value={toSelect(contextType)} onValueChange={(v) => setContextType(fromSelect(v))}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All</SelectItem>
                                    <SelectItem value="opd">OPD</SelectItem>
                                    <SelectItem value="ipd">IPD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="md:col-span-2">
                            <PatientPicker value={patientId} onChange={setPatientId} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="inline-flex items-center gap-1">
                                <Filter className="h-3.5 w-3.5" /> Quick status
                            </Badge>
                            {quickStatus('', 'All')}
                            {quickStatus('new', 'New')}
                            {quickStatus('in_progress', 'In-Progress')}
                            {quickStatus('dispensed', 'Dispensed')}
                            {quickStatus('cancelled', 'Cancelled')}
                        </div>
                        <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <div className="space-y-3">
                <AnimatePresence initial={false}>
                    {loading && rows.length === 0 && (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={`sk-${i}`} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <Skeleton className="h-4 w-44" />
                                    <Skeleton className="h-8 w-40 rounded-md" />
                                </div>
                                <Skeleton className="h-24 w-full" />
                            </Card>
                        ))
                    )}

                    {!loading && (rows || []).map(p => {
                        const total = (p.items || []).length
                        const disp = (p.items || []).filter(it => it.status === 'dispensed').length
                        const inprog = (p.items || []).filter(it => it.status === 'in_progress').length
                        const progressPct = total ? Math.round((disp / total) * 100) : 0
                        const sTone = statusTone(p.status)

                        return (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                            >
                                <Card className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <CardTitle className="text-sm">
                                                #{String(p.id).padStart(6, '0')} · {p.context_type?.toUpperCase()} · Patient: {p.patient?.uhid || `P-${p.patient_id}`}
                                            </CardTitle>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${sTone.class}`}>
                                                    {sTone.label}
                                                </span>
                                                <PermGate anyOf={['pharmacy.rx.dispense']}>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => bulkMark(p.id, 'in_progress')}
                                                    >
                                                        Start
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleDispense(p.id, { withPrint: false })}
                                                    >
                                                        Mark Dispensed
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDispense(p.id, { withPrint: true })}
                                                    >
                                                        <Printer className="h-4 w-4 mr-1" />
                                                        Dispense & Print
                                                    </Button>
                                                </PermGate>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-3">
                                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                                <span>{disp}/{total} dispensed</span>
                                                {inprog > 0 && <span>{inprog} in-progress</span>}
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                                                <div
                                                    className="h-2 bg-emerald-500 transition-all"
                                                    style={{ width: `${progressPct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Medicine</TableHead>
                                                    <TableHead>Dose</TableHead>
                                                    <TableHead>Qty</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(p.items || []).map(it => {
                                                    const tone = statusTone(it.status || p.status)
                                                    return (
                                                        <TableRow key={it.id}>
                                                            <TableCell>
                                                                <div className="font-medium">
                                                                    {it.medicine_name || it.medicine?.name || `#${it.medicine_id}`}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {it.medicine_code || it.medicine?.code}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{it.dose || '—'}</TableCell>
                                                            <TableCell>{it.qty || it.quantity || 1}</TableCell>
                                                            <TableCell>
                                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${tone.class}`}>
                                                                    {tone.label}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <PermGate anyOf={['pharmacy.rx.dispense']}>
                                                                    <div className="inline-flex flex-wrap gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => toggleItem(it.id, 'in_progress')}
                                                                        >
                                                                            In-Progress
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => toggleItem(it.id, 'dispensed')}
                                                                        >
                                                                            <CheckCircle2 className="h-4 w-4 mr-1" />
                                                                            Dispensed
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => toggleItem(it.id, 'cancelled')}
                                                                        >
                                                                            <XCircle className="h-4 w-4 mr-1" />
                                                                            Cancel
                                                                        </Button>
                                                                    </div>
                                                                </PermGate>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                                {(p.items || []).length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-6 text-sm text-gray-500">
                                                            No items
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}

                    {(rows || []).length === 0 && !loading && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-gray-500">
                                {patientId
                                    ? 'No prescriptions found for this patient.'
                                    : 'No prescriptions match your filters.'}
                            </CardContent>
                        </Card>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
