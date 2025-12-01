// FILE: src/pages/PharmacyRx.jsx
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import {
    listPharmacyPrescriptions,
    createPharmacyPrescription,
    getPharmacyPrescription,
} from '../api/pharmacyRx'
import { listPatients } from '../api/patients'
import { getBillingMasters } from '../api/billing'
import { listInventoryItems } from '../api/inventory'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
    Pill,
    ClipboardList,
    User,
    Search,
    Plus,
    ArrowLeft,
    Filter,
    Clock3,
    Stethoscope,
} from 'lucide-react'

const RX_TYPES = [
    { value: 'OPD', label: 'OPD' },
    { value: 'IPD', label: 'IPD' },
    { value: 'OT', label: 'OT' },
    { value: 'COUNTER', label: 'Counter' },
]

const PRIORITIES = [
    { value: 'ROUTINE', label: 'Routine' },
    { value: 'STAT', label: 'STAT / Urgent' },
    { value: 'PRN', label: 'PRN / As needed' },
]

function todayDateTimeLocal() {
    const d = new Date()
    const off = d.getTimezoneOffset()
    const local = new Date(d.getTime() - off * 60 * 1000)
    return local.toISOString().slice(0, 16)
}

const EMPTY_HEADER = {
    type: 'OPD',
    priority: 'ROUTINE',
    datetime: todayDateTimeLocal(),
    patient: null,
    doctorId: '',
    visitNo: '',
    admissionNo: '',
    otCaseNo: '',
    notes: '',
}

const EMPTY_LINE = {
    item: null,
    item_name: '',
    strength: '',
    route: 'PO',
    dose: '',
    frequency: '',
    duration_days: '',
    total_qty: '',
    instructions: '',
    is_prn: false,
    is_stat: false,
    requested_qty: '',
}

export default function PharmacyRx() {
    const [tab, setTab] = useState('list') // 'list' | 'new' | 'detail'

    // list / queue state
    const [rxTypeFilter, setRxTypeFilter] = useState('ALL')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    const [listLoading, setListLoading] = useState(false)
    const [rxList, setRxList] = useState([])
    const [selectedRx, setSelectedRx] = useState(null)

    // form state
    const [header, setHeader] = useState(EMPTY_HEADER)
    const [lines, setLines] = useState([])
    const [currentLine, setCurrentLine] = useState(EMPTY_LINE)
    const [submitting, setSubmitting] = useState(false)

    // patient search
    const [patientQuery, setPatientQuery] = useState('')
    const [patientResults, setPatientResults] = useState([])
    const [patientSearching, setPatientSearching] = useState(false)
    const [showPatientDropdown, setShowPatientDropdown] = useState(false)

    // doctor masters
    const [doctors, setDoctors] = useState([])
    const [mastersLoading, setMastersLoading] = useState(false)

    // medicine search
    const [medQuery, setMedQuery] = useState('')
    const [medResults, setMedResults] = useState([])
    const [medSearching, setMedSearching] = useState(false)
    const [showMedDropdown, setShowMedDropdown] = useState(false)

    // -------- Masters / initial data --------

    useEffect(() => {
        ; (async () => {
            try {
                setMastersLoading(true)
                const res = await getBillingMasters()
                const docs = res?.data?.doctors || []
                setDoctors(docs)
            } catch (e) {
                // toast handled by interceptor
            } finally {
                setMastersLoading(false)
            }
        })()
    }, [])

    useEffect(() => {
        fetchRxList()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rxTypeFilter, statusFilter])

    async function fetchRxList() {
        try {
            setListLoading(true)
            const params = {}
            if (rxTypeFilter !== 'ALL') params.type = rxTypeFilter
            if (statusFilter !== 'ALL') params.status = statusFilter
            if (search?.trim()) params.q = search.trim()
            params.limit = 100

            const res = await listPharmacyPrescriptions(params)
            setRxList(res?.data || [])
        } catch (e) {
            // toast via interceptor
        } finally {
            setListLoading(false)
        }
    }

    // -------- Patient search --------

    useEffect(() => {
        if (!patientQuery || patientQuery.trim().length < 2) {
            setPatientResults([])
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setPatientSearching(true)
                    const res = await listPatients(patientQuery.trim())
                    if (cancelled) return
                    setPatientResults(res?.data?.items || res?.data || [])
                    setShowPatientDropdown(true)
                } catch (e) {
                    // handled globally
                } finally {
                    if (!cancelled) setPatientSearching(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [patientQuery])

    function handleSelectPatient(p) {
        setHeader((prev) => ({
            ...prev,
            patient: p,
        }))
        setPatientQuery(
            `${p.uhid ? `${p.uhid} • ` : ''}${p.first_name || ''} ${p.last_name || ''
                }`.trim()
        )
        setShowPatientDropdown(false)
    }

    // -------- Medicine search --------

    useEffect(() => {
        if (!medQuery || medQuery.trim().length < 2) {
            setMedResults([])
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setMedSearching(true)
                    // Reuse inventory search; backend can filter to "pharmacy" items
                    const res = await listInventoryItems({
                        q: medQuery.trim(),
                        kind: 'MEDICINE',
                        limit: 15,
                    })
                    if (cancelled) return
                    const items = res?.data?.items || res?.data || []
                    setMedResults(items)
                    setShowMedDropdown(true)
                } catch (e) {
                    // global toast
                } finally {
                    if (!cancelled) setMedSearching(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [medQuery])

    function handleSelectMedicine(item) {
        setCurrentLine((prev) => ({
            ...prev,
            item,
            item_name: item.name || item.item_name || '',
        }))
        setMedQuery(item.name || item.item_name || '')
        setShowMedDropdown(false)
    }

    // -------- Form helpers --------

    function resetForm() {
        setHeader({
            ...EMPTY_HEADER,
            type: header.type || 'OPD',
        })
        setLines([])
        setCurrentLine(EMPTY_LINE)
        setPatientQuery('')
    }

    function startNewRx(initialType) {
        const t = initialType || 'OPD'
        setHeader((prev) => ({
            ...EMPTY_HEADER,
            type: t,
            datetime: todayDateTimeLocal(),
        }))
        setLines([])
        setCurrentLine(EMPTY_LINE)
        setPatientQuery('')
        setSelectedRx(null)
        setTab('new')
    }

    function autoQty(line) {
        const d = Number(line.duration_days || 0)
        const freqPattern = (line.frequency || '').trim()
        if (!d || !freqPattern) return ''
        // simple patterns like "1-0-1", "1-1-1"
        const parts = freqPattern.split('-').map((x) => Number(x || 0))
        const perDay = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
        if (!perDay) return ''
        return String(perDay * d)
    }

    function handleAddLine() {
        if (!currentLine.item && !currentLine.item_name) {
            toast.error('Select a medicine first')
            return
        }

        // calculate quantity – from total_qty or from freq + days
        const auto = autoQty(currentLine)
        const computedQty = currentLine.total_qty || auto

        if (!computedQty) {
            toast.error('Enter Total Qty or proper Frequency + Days')
            return
        }

        const withQty = {
            ...currentLine,
            total_qty: computedQty,
            requested_qty: currentLine.requested_qty || computedQty,
        }

        setLines((prev) => [...prev, withQty])
        setCurrentLine(EMPTY_LINE)
        setMedQuery('')
        setShowMedDropdown(false)
    }

    function handleRemoveLine(idx) {
        setLines((prev) => prev.filter((_, i) => i !== idx))
    }

    async function handleSubmitRx() {
        if (!header.patient && header.type !== 'COUNTER') {
            toast.error('Select a patient')
            return
        }
        if (!header.doctorId && header.type !== 'COUNTER') {
            toast.error('Select a doctor')
            return
        }
        if (!lines.length) {
            toast.error('Add at least one medicine')
            return
        }

        const payload = {
            type: header.type,
            priority: header.priority,
            rx_datetime: header.datetime,
            patient_id: header.patient?.id || null,
            doctor_user_id: header.doctorId || null,
            visit_id: header.type === 'OPD' ? header.visitNo || null : null,
            ipd_admission_id: header.type === 'IPD' ? header.admissionNo || null : null,
            ot_case_id: header.type === 'OT' ? header.otCaseNo || null : null,
            notes: header.notes || '',
            lines: lines.map((l) => {
                // re-compute quantity just in case
                const auto = autoQty(l)
                const qtyStr = l.total_qty || l.requested_qty || auto || ''
                const qty = qtyStr ? Number(qtyStr) : null

                return {
                    item_id: l.item?.id || l.item_id || null,
                    item_name: l.item?.name || l.item_name || '',
                    strength: l.strength || null,
                    route: l.route || null,
                    dose: l.dose || null,
                    frequency: l.frequency || null,
                    duration_days: l.duration_days ? Number(l.duration_days) : null,

                    // NEW: what backend expects
                    requested_qty: qty,

                    // keep total_qty in sync so old code / reports still work
                    total_qty: qty,

                    instructions: l.instructions || null,
                    is_prn: !!l.is_prn,
                    is_stat: !!l.is_stat,
                }
            }),
        }

        try {
            setSubmitting(true)
            const res = await createPharmacyPrescription(payload)
            toast.success('Prescription created & sent to Pharmacy')
            resetForm()
            setTab('list')
            fetchRxList()
            if (res?.data) setSelectedRx(res.data)
        } catch (e) {
            // toast via interceptor
        } finally {
            setSubmitting(false)
        }
    }

    async function handleOpenRx(row) {
        try {
            const res = await getPharmacyPrescription(row.id)
            const data = res?.data || row
            setSelectedRx(data)
            setTab('detail')
        } catch (e) {
            // handled globally
        }
    }

    const selectedRxLines = useMemo(() => {
        if (!selectedRx) return []
        return selectedRx.lines || selectedRx.items || []
    }, [selectedRx])

    // -------- Render --------

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                        Pharmacy Prescriptions
                    </h1>
                    <p className="text-sm text-slate-500">
                        Create and manage OPD, IPD, OT and Counter prescriptions linked to inventory & billing.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={header.type}
                        onValueChange={(val) =>
                            setHeader((prev) => ({
                                ...prev,
                                type: val,
                            }))
                        }
                    >
                        <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-full">
                            <SelectValue placeholder="Rx Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {RX_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        className="rounded-full"
                        onClick={() => startNewRx(header.type || 'OPD')}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Prescription
                    </Button>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="list">Queue / History</TabsTrigger>
                    <TabsTrigger value="new">New Rx</TabsTrigger>
                    <TabsTrigger value="detail" disabled={!selectedRx}>
                        Selected Rx
                    </TabsTrigger>
                </TabsList>

                {/* ---- LIST TAB ---- */}
                <TabsContent value="list" className="space-y-3">
                    <Card className="border-slate-200 rounded-2xl shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs uppercase tracking-wide text-slate-500">
                                        Filter by
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setRxTypeFilter('ALL')}
                                            className={`px-2.5 py-1 rounded-full text-xs border ${rxTypeFilter === 'ALL'
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-700 border-slate-200'
                                                }`}
                                        >
                                            All Types
                                        </button>
                                        {RX_TYPES.map((t) => (
                                            <button
                                                key={t.value}
                                                type="button"
                                                onClick={() => setRxTypeFilter(t.value)}
                                                className={`px-2.5 py-1 rounded-full text-xs border flex items-center gap-1.5 ${rxTypeFilter === t.value
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-700 border-slate-200'
                                                    }`}
                                            >
                                                <Pill className="w-3 h-3" />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-64">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search UHID / name / Rx no..."
                                            className="pl-8 text-sm bg-white border-slate-200 rounded-full"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') fetchRxList()
                                            }}
                                        />
                                    </div>
                                    <Select
                                        value={statusFilter}
                                        onValueChange={setStatusFilter}
                                    >
                                        <SelectTrigger className="w-[130px] bg-white border-slate-200 rounded-full text-xs">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">All status</SelectItem>
                                            <SelectItem value="DRAFT">Draft</SelectItem>
                                            <SelectItem value="PENDING">Pending</SelectItem>
                                            <SelectItem value="PARTIAL">Partial</SelectItem>
                                            <SelectItem value="DISPENSED">Dispensed</SelectItem>
                                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="rounded-full border-slate-200"
                                        onClick={fetchRxList}
                                    >
                                        <Filter className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                <div className="max-h-[420px] overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50/80 sticky top-0 z-10">
                                            <tr className="text-xs text-slate-500">
                                                <th className="text-left px-3 py-2.5 font-medium">
                                                    Rx No
                                                </th>
                                                <th className="text-left px-3 py-2.5 font-medium">
                                                    Patient
                                                </th>
                                                <th className="text-left px-3 py-2.5 font-medium">
                                                    Type / Doctor
                                                </th>
                                                <th className="text-left px-3 py-2.5 font-medium">
                                                    Items
                                                </th>
                                                <th className="text-left px-3 py-2.5 font-medium">
                                                    Created
                                                </th>
                                                <th className="text-left px-3 py-2.5 font-medium">
                                                    Status
                                                </th>
                                                <th className="text-right px-3 py-2.5 font-medium">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {listLoading && (
                                                <tr>
                                                    <td
                                                        colSpan={7}
                                                        className="px-3 py-6 text-center text-xs text-slate-500"
                                                    >
                                                        Loading prescriptions...
                                                    </td>
                                                </tr>
                                            )}
                                            {!listLoading && !rxList.length && (
                                                <tr>
                                                    <td
                                                        colSpan={7}
                                                        className="px-3 py-6 text-center text-xs text-slate-500"
                                                    >
                                                        No prescriptions found for the selected filters.
                                                    </td>
                                                </tr>
                                            )}
                                            {!listLoading &&
                                                rxList.map((row) => {
                                                    const status =
                                                        (row.status || '').toUpperCase() || 'PENDING'
                                                    const type = row.type || row.rx_type || 'OPD'
                                                    const createdAt =
                                                        row.created_at ||
                                                        row.rx_datetime ||
                                                        row.bill_date ||
                                                        null
                                                    const createdStr = createdAt
                                                        ? String(createdAt).slice(0, 16).replace('T', ' ')
                                                        : '—'
                                                    const patient =
                                                        row.patient ||
                                                        row.patient_name ||
                                                        row.patient_uhid ||
                                                        ''
                                                    const patientName =
                                                        typeof patient === 'string'
                                                            ? patient
                                                            : `${patient.first_name || ''} ${patient.last_name || ''
                                                                }`.trim()

                                                    const itemsCount =
                                                        row.items?.length ||
                                                        row.lines?.length ||
                                                        row.item_count ||
                                                        '—'

                                                    const doctorName =
                                                        row.doctor_name ||
                                                        row.doctor ||
                                                        row.doctor_display ||
                                                        ''

                                                    return (
                                                        <tr
                                                            key={row.id}
                                                            className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors"
                                                        >
                                                            <td className="px-3 py-2.5 align-middle">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-medium text-slate-900">
                                                                        {row.rx_number || `RX-${row.id}`}
                                                                    </span>
                                                                    {row.uhid && (
                                                                        <span className="text-[11px] text-slate-500">
                                                                            UHID: {row.uhid}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 align-middle">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-medium text-slate-700">
                                                                        <User className="w-3 h-3" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-slate-900">
                                                                            {patientName || '—'}
                                                                        </div>
                                                                        {row.patient_uhid && (
                                                                            <div className="text-[11px] text-slate-500">
                                                                                {row.patient_uhid}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 align-middle">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="border-slate-200 text-[11px] px-1.5 py-0.5"
                                                                        >
                                                                            {type}
                                                                        </Badge>
                                                                        {doctorName && (
                                                                            <span className="text-[11px] text-slate-600 flex items-center gap-1">
                                                                                <Stethoscope className="w-3 h-3" />
                                                                                {doctorName}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {row.context_label && (
                                                                        <span className="text-[11px] text-slate-500">
                                                                            {row.context_label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 align-middle text-xs text-slate-700">
                                                                {itemsCount}
                                                            </td>
                                                            <td className="px-3 py-2.5 align-middle text-xs text-slate-700">
                                                                <div className="flex items-center gap-1">
                                                                    <Clock3 className="w-3 h-3 text-slate-400" />
                                                                    <span>{createdStr}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 align-middle">
                                                                <StatusPill status={status} />
                                                            </td>
                                                            <td className="px-3 py-2.5 align-middle text-right">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs rounded-full border-slate-200"
                                                                    onClick={() => handleOpenRx(row)}
                                                                >
                                                                    <ClipboardList className="w-3 h-3 mr-1" />
                                                                    View
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---- NEW RX TAB ---- */}
                <TabsContent value="new">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)]">
                        {/* Header / context card */}
                        <Card className="border-slate-200 rounded-2xl shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                    <Pill className="w-4 h-4 text-slate-500" />
                                    Prescription Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Rx type + priority */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-600">
                                            Prescription Type
                                        </Label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {RX_TYPES.map((t) => (
                                                <button
                                                    key={t.value}
                                                    type="button"
                                                    onClick={() =>
                                                        setHeader((prev) => ({ ...prev, type: t.value }))
                                                    }
                                                    className={`px-2.5 py-1 rounded-full text-xs border flex items-center gap-1.5 ${header.type === t.value
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-white text-slate-700 border-slate-200'
                                                        }`}
                                                >
                                                    <Pill className="w-3 h-3" />
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-600">
                                            Priority
                                        </Label>
                                        <Select
                                            value={header.priority}
                                            onValueChange={(val) =>
                                                setHeader((prev) => ({ ...prev, priority: val }))
                                            }
                                        >
                                            <SelectTrigger className="w-full bg-white border-slate-200 rounded-full h-9 text-xs">
                                                <SelectValue placeholder="Select priority" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PRIORITIES.map((p) => (
                                                    <SelectItem key={p.value} value={p.value}>
                                                        {p.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Date/time */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">
                                        Date &amp; Time
                                    </Label>
                                    <Input
                                        type="datetime-local"
                                        value={header.datetime}
                                        onChange={(e) =>
                                            setHeader((prev) => ({
                                                ...prev,
                                                datetime: e.target.value,
                                            }))
                                        }
                                        className="h-9 text-xs bg-white border-slate-200 rounded-full"
                                    />
                                </div>

                                {/* Patient selection */}
                                <div className="space-y-1.5 relative">
                                    <Label className="text-xs text-slate-600 flex items-center gap-1.5">
                                        <User className="w-3 h-3" />
                                        Patient (UHID / name / phone)
                                    </Label>
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                        <Input
                                            value={patientQuery}
                                            onChange={(e) => {
                                                setPatientQuery(e.target.value)
                                                setShowPatientDropdown(true)
                                            }}
                                            placeholder={
                                                header.type === 'COUNTER'
                                                    ? 'Optional for counter sale'
                                                    : 'Search patient...'
                                            }
                                            className="pl-7 h-9 text-xs bg-white border-slate-200 rounded-full"
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {showPatientDropdown &&
                                            (patientResults.length > 0 || patientSearching) && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -4 }}
                                                    className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-auto text-xs"
                                                >
                                                    {patientSearching && (
                                                        <div className="px-3 py-2 text-slate-500">
                                                            Searching...
                                                        </div>
                                                    )}
                                                    {!patientSearching &&
                                                        !patientResults.length && (
                                                            <div className="px-3 py-2 text-slate-500">
                                                                No patients found
                                                            </div>
                                                        )}
                                                    {!patientSearching &&
                                                        patientResults.map((p) => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => handleSelectPatient(p)}
                                                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                                            >
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-medium text-slate-900">
                                                                        {`${p.first_name || ''} ${p.last_name || ''
                                                                            }`.trim() || p.name || `Patient #${p.id}`}
                                                                    </span>
                                                                    {p.uhid && (
                                                                        <span className="text-[10px] text-slate-500">
                                                                            UHID: {p.uhid}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    {p.age
                                                                        ? `${p.age}y • `
                                                                        : ''}
                                                                    {p.gender ? `${p.gender} • ` : ''}
                                                                    {p.phone || ''}
                                                                </div>
                                                            </button>
                                                        ))}
                                                </motion.div>
                                            )}
                                    </AnimatePresence>
                                </div>

                                {/* Context fields by type */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {header.type === 'OPD' && (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-600">
                                                    OPD Visit No (optional)
                                                </Label>
                                                <Input
                                                    value={header.visitNo}
                                                    onChange={(e) =>
                                                        setHeader((prev) => ({
                                                            ...prev,
                                                            visitNo: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="e.g., OPD-2025-0001"
                                                    className="h-9 text-xs bg-white border-slate-200 rounded-full"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {header.type === 'IPD' && (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-600">
                                                    Admission No
                                                </Label>
                                                <Input
                                                    value={header.admissionNo}
                                                    onChange={(e) =>
                                                        setHeader((prev) => ({
                                                            ...prev,
                                                            admissionNo: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="IPD admission number"
                                                    className="h-9 text-xs bg-white border-slate-200 rounded-full"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {header.type === 'OT' && (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-600">
                                                    OT Case No
                                                </Label>
                                                <Input
                                                    value={header.otCaseNo}
                                                    onChange={(e) =>
                                                        setHeader((prev) => ({
                                                            ...prev,
                                                            otCaseNo: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="OT / procedure case ID"
                                                    className="h-9 text-xs bg-white border-slate-200 rounded-full"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {/* doctor select (for all non-counter ideally) */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                                            <Stethoscope className="w-3 h-3" />
                                            Consultant / Prescriber
                                        </Label>
                                        <Select
                                            value={header.doctorId || ''}
                                            onValueChange={(val) =>
                                                setHeader((prev) => ({
                                                    ...prev,
                                                    doctorId: val,
                                                }))
                                            }
                                        >
                                            <SelectTrigger className="w-full bg-white border-slate-200 rounded-full h-9 text-xs">
                                                <SelectValue placeholder="Select doctor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {mastersLoading && (
                                                    <SelectItem value="__loading" disabled>
                                                        Loading...
                                                    </SelectItem>
                                                )}
                                                {!mastersLoading &&
                                                    (!doctors || !doctors.length) && (
                                                        <SelectItem value="__none" disabled>
                                                            No doctors configured
                                                        </SelectItem>
                                                    )}
                                                {!mastersLoading &&
                                                    doctors?.map((d) => (
                                                        <SelectItem
                                                            key={d.id}
                                                            value={String(d.id)}
                                                        >
                                                            {d.name || d.full_name || d.email}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">
                                        Clinical notes / instructions to pharmacist (optional)
                                    </Label>
                                    <Textarea
                                        value={header.notes}
                                        onChange={(e) =>
                                            setHeader((prev) => ({
                                                ...prev,
                                                notes: e.target.value,
                                            }))
                                        }
                                        rows={3}
                                        className="text-xs bg-white border-slate-200 resize-none rounded-xl"
                                        placeholder="Eg: Allergic to penicillin, avoid NSAIDs, taper dose after 5 days, etc."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Lines card */}
                        <Card className="border-slate-200 rounded-2xl shadow-sm">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-slate-500" />
                                    <CardTitle className="text-sm font-semibold">
                                        Medicines &amp; Instructions
                                    </CardTitle>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {lines.length ? `${lines.length} lines` : 'No lines added yet'}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* New line editor */}
                                <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/60">
                                    <div className="grid md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)] gap-3">
                                        <div className="space-y-2">
                                            {/* Medicine search */}
                                            <div className="space-y-1 relative">
                                                <Label className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                                    Medicine
                                                    <span className="text-[10px] text-slate-400">
                                                        (linked to Inventory)
                                                    </span>
                                                </Label>
                                                <div className="relative">
                                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                    <Input
                                                        value={medQuery}
                                                        onChange={(e) => {
                                                            setMedQuery(e.target.value)
                                                            setShowMedDropdown(true)
                                                        }}
                                                        placeholder="Search drug name, brand, generic..."
                                                        className="pl-7 h-9 text-xs bg-white border-slate-200 rounded-full"
                                                    />
                                                </div>
                                                <AnimatePresence>
                                                    {showMedDropdown &&
                                                        (medResults.length > 0 || medSearching) && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -4 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -4 }}
                                                                className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-auto text-xs"
                                                            >
                                                                {medSearching && (
                                                                    <div className="px-3 py-2 text-slate-500">
                                                                        Searching medicines...
                                                                    </div>
                                                                )}
                                                                {!medSearching &&
                                                                    !medResults.length && (
                                                                        <div className="px-3 py-2 text-slate-500">
                                                                            No items found
                                                                        </div>
                                                                    )}
                                                                {!medSearching &&
                                                                    medResults.map((it) => (
                                                                        <button
                                                                            key={it.id}
                                                                            type="button"
                                                                            onClick={() => handleSelectMedicine(it)}
                                                                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                        >
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="font-medium text-slate-900">
                                                                                    {it.name || it.item_name}
                                                                                </span>
                                                                                {it.code && (
                                                                                    <span className="text-[10px] text-slate-500">
                                                                                        {it.code}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-[11px] text-slate-500">
                                                                                {it.strength || it.form || ''}
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                            </motion.div>
                                                        )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Instructions: dose / freq / days */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-slate-600">
                                                        Dose
                                                    </Label>
                                                    <Input
                                                        value={currentLine.dose}
                                                        onChange={(e) =>
                                                            setCurrentLine((prev) => ({
                                                                ...prev,
                                                                dose: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="e.g. 500 mg"
                                                        className="h-8 text-[11px] bg-white border-slate-200 rounded-full"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-slate-600">
                                                        Frequency
                                                    </Label>
                                                    <Input
                                                        value={currentLine.frequency}
                                                        onChange={(e) =>
                                                            setCurrentLine((prev) => ({
                                                                ...prev,
                                                                frequency: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="e.g. 1-0-1"
                                                        className="h-8 text-[11px] bg-white border-slate-200 rounded-full"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-slate-600">
                                                        Days
                                                    </Label>
                                                    <Input
                                                        value={currentLine.duration_days}
                                                        onChange={(e) =>
                                                            setCurrentLine((prev) => ({
                                                                ...prev,
                                                                duration_days: e.target.value,
                                                                total_qty:
                                                                    prev.total_qty || autoQty({
                                                                        ...prev,
                                                                        duration_days: e.target.value,
                                                                    }),
                                                            }))
                                                        }
                                                        placeholder="e.g. 5"
                                                        className="h-8 text-[11px] bg-white border-slate-200 rounded-full"
                                                    />
                                                </div>
                                            </div>

                                            {/* Other info */}
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-slate-600">
                                                        Route
                                                    </Label>
                                                    <Input
                                                        value={currentLine.route}
                                                        onChange={(e) =>
                                                            setCurrentLine((prev) => ({
                                                                ...prev,
                                                                route: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="PO / IV / IM / etc"
                                                        className="h-8 text-[11px] bg-white border-slate-200 rounded-full"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-slate-600">
                                                        Total Qty
                                                    </Label>
                                                    <Input
                                                        value={currentLine.total_qty}
                                                        onChange={(e) =>
                                                            setCurrentLine((prev) => ({
                                                                ...prev,
                                                                total_qty: e.target.value,
                                                            }))
                                                        }
                                                        placeholder={
                                                            autoQty(currentLine)
                                                                ? `Suggested: ${autoQty(currentLine)}`
                                                                : 'eg. 10'
                                                        }
                                                        className="h-8 text-[11px] bg-white border-slate-200 rounded-full"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <Label className="text-[11px] text-slate-600">
                                                    Instructions to patient
                                                </Label>
                                                <Input
                                                    value={currentLine.instructions}
                                                    onChange={(e) =>
                                                        setCurrentLine((prev) => ({
                                                            ...prev,
                                                            instructions: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="After food, morning & night, etc."
                                                    className="h-8 text-[11px] bg-white border-slate-200 rounded-full"
                                                />
                                            </div>
                                        </div>

                                        {/* Add button */}
                                        <div className="flex flex-col justify-between gap-2">
                                            <div className="text-[11px] text-slate-500">
                                                <p>
                                                    Add medicine to this prescription. Quantity can be
                                                    auto-estimated from frequency &amp; days.
                                                </p>
                                            </div>
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="h-9 px-3 rounded-full"
                                                    onClick={handleAddLine}
                                                >
                                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                                    Add line
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lines list */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                    <ScrollArea className="max-h-[280px]">
                                        <table className="w-full text-[11px]">
                                            <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                <tr className="text-[11px] text-slate-500">
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        #
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        Medicine
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        Dose / Freq / Days
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        Route
                                                    </th>
                                                    <th className="text-right px-3 py-2 font-medium">
                                                        Qty
                                                    </th>
                                                    <th className="text-right px-3 py-2 font-medium">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {!lines.length && (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-3 py-4 text-center text-[11px] text-slate-500"
                                                        >
                                                            No lines added. Use the panel above to add
                                                            medicines to this prescription.
                                                        </td>
                                                    </tr>
                                                )}
                                                {lines.map((l, idx) => (
                                                    <tr
                                                        key={`${l.item_id || l.item?.id || idx}-${idx}`}
                                                        className="border-t border-slate-100"
                                                    >
                                                        <td className="px-3 py-2 align-top text-slate-500">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-medium text-slate-900">
                                                                    {l.item?.name ||
                                                                        l.item_name ||
                                                                        'Unnamed medicine'}
                                                                </span>
                                                                {l.strength && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {l.strength}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                            <div className="flex flex-col">
                                                                <span>
                                                                    {l.dose || '—'} •{' '}
                                                                    {l.frequency || '—'} •{' '}
                                                                    {l.duration_days
                                                                        ? `${l.duration_days} days`
                                                                        : '—'}
                                                                </span>
                                                                {l.instructions && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {l.instructions}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                            {l.route || '—'}
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                            {l.total_qty || autoQty(l) || '—'}
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-[11px] text-slate-500 hover:text-red-600"
                                                                onClick={() => handleRemoveLine(idx)}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </ScrollArea>
                                </div>

                                {/* Submit */}
                                <div className="flex justify-between items-center pt-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs text-slate-500"
                                        onClick={() => {
                                            resetForm()
                                            setTab('list')
                                        }}
                                    >
                                        <ArrowLeft className="w-3 h-3 mr-1" />
                                        Back to queue
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-9 px-4 rounded-full"
                                        onClick={handleSubmitRx}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            'Saving...'
                                        ) : (
                                            <>
                                                <ClipboardList className="w-3.5 h-3.5 mr-1" />
                                                Save &amp; Send to Pharmacy
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ---- DETAIL TAB ---- */}
                <TabsContent value="detail">
                    {!selectedRx ? (
                        <Card className="border-slate-200 rounded-2xl shadow-sm">
                            <CardContent className="py-8 text-center text-sm text-slate-500">
                                Select a prescription from the queue to view details.
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-slate-200 rounded-2xl shadow-sm">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4 text-slate-500" />
                                        Prescription #{selectedRx.rx_number || selectedRx.id}
                                    </CardTitle>
                                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                                        <span>
                                            Type:{' '}
                                            <Badge variant="outline" className="px-1.5 py-0.5">
                                                {selectedRx.type || selectedRx.rx_type || 'OPD'}
                                            </Badge>
                                        </span>
                                        {selectedRx.priority && (
                                            <span>Priority: {selectedRx.priority}</span>
                                        )}
                                        {selectedRx.doctor_name && (
                                            <span className="flex items-center gap-1">
                                                <Stethoscope className="w-3 h-3" />
                                                {selectedRx.doctor_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right text-[11px] text-slate-500">
                                    <div>
                                        UHID:{' '}
                                        {selectedRx.patient_uhid ||
                                            selectedRx.patient?.uhid ||
                                            '—'}
                                    </div>
                                    <div>
                                        Patient:{' '}
                                        {selectedRx.patient_name ||
                                            `${selectedRx.patient?.first_name || ''} ${selectedRx.patient?.last_name || ''
                                                }`.trim() ||
                                            '—'}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                    <ScrollArea className="max-h-[380px]">
                                        <table className="w-full text-[11px]">
                                            <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                <tr className="text-[11px] text-slate-500">
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        #
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        Medicine
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        Dose / Freq / Days
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium">
                                                        Route
                                                    </th>
                                                    <th className="text-right px-3 py-2 font-medium">
                                                        Qty
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {!selectedRxLines.length && (
                                                    <tr>
                                                        <td
                                                            colSpan={5}
                                                            className="px-3 py-4 text-center text-[11px] text-slate-500"
                                                        >
                                                            No lines found for this prescription.
                                                        </td>
                                                    </tr>
                                                )}
                                                {selectedRxLines.map((l, idx) => (
                                                    <tr
                                                        key={l.id || idx}
                                                        className="border-t border-slate-100"
                                                    >
                                                        <td className="px-3 py-2 align-top text-slate-500">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-medium text-slate-900">
                                                                    {l.item_name ||
                                                                        l.medicine_name ||
                                                                        'Unnamed medicine'}
                                                                </span>
                                                                {l.strength && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {l.strength}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                            <div className="flex flex-col">
                                                                <span>
                                                                    {l.dose || '—'} •{' '}
                                                                    {l.frequency || '—'} •{' '}
                                                                    {l.duration_days
                                                                        ? `${l.duration_days} days`
                                                                        : '—'}
                                                                </span>
                                                                {l.instructions && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {l.instructions}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                            {l.route || '—'}
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                            {l.total_qty ||
                                                                l.qty ||
                                                                l.quantity ||
                                                                autoQty(l) ||
                                                                '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </ScrollArea>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

function StatusPill({ status }) {
    const s = (status || '').toUpperCase()
    let label = s
    let cls =
        'bg-slate-50 text-slate-700 border border-slate-200'

    if (s === 'PENDING' || s === 'NEW') {
        label = 'Pending'
        cls = 'bg-amber-50 text-amber-700 border border-amber-200'
    } else if (s === 'PARTIAL') {
        label = 'Partial'
        cls = 'bg-blue-50 text-blue-700 border border-blue-200'
    } else if (s === 'DISPENSED' || s === 'COMPLETED') {
        label = 'Dispensed'
        cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    } else if (s === 'CANCELLED') {
        label = 'Cancelled'
        cls = 'bg-rose-50 text-rose-700 border border-rose-200'
    }

    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full ${cls}`}>
            {label}
        </span>
    )
}
