// FILE: src/pages/PharmacyBilling.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
    listPharmacyBills,
    getPharmacyBill,
    updatePharmacyBillStatus,
    listPharmacyReturns,
    createPharmacyReturn,
    createPharmacyIpdConsolidatedInvoice,
    openPharmacyBillPdfInNewTab,
} from '../api/pharmacyBilling'

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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'

import {
    ReceiptIndianRupee,
    Search,
    Filter,
    Download,
    IndianRupee,
    User,
    Clock3,
    CheckCircle2,
    RotateCcw,
    Hospital,
} from 'lucide-react'

const BILL_TYPES = [
    { value: 'ALL', label: 'All types' },
    { value: 'OPD', label: 'OPD' },
    { value: 'IPD', label: 'IPD' },
    { value: 'OT', label: 'OT' },
    { value: 'COUNTER', label: 'Counter' },
]

const BILL_STATUS = [
    { value: 'ALL', label: 'All' },
    { value: 'UNPAID', label: 'Unpaid' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'PAID', label: 'Paid' },
    { value: 'CANCELLED', label: 'Cancelled' },
]

const PAYMENT_MODES = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'UPI', label: 'UPI' },
    { value: 'NET_BANKING', label: 'Net Banking' },
    { value: 'OTHER', label: 'Other' },
]

function formatINR(value) {
    const num = Number(value ?? 0)
    if (!Number.isFinite(num)) return '₹0.00'
    return `₹${num.toFixed(2)}`
}

// Best-effort bill type mapping using context_type / fields from backend
function getBillType(row = {}) {
    const explicit = (row.type || row.bill_type || '').toUpperCase()
    if (explicit === 'OPD' || explicit === 'IPD' || explicit === 'OT' || explicit === 'COUNTER') {
        return explicit
    }

    const ctx = (row.context_type || '').toUpperCase()
    if (ctx === 'OPD') return 'OPD'
    if (ctx === 'IPD') return 'IPD'
    if (ctx === 'PHARM_COUNTER' || ctx === 'COUNTER') return 'COUNTER'

    // Fallback default
    return 'OPD'
}

// Normalize various backend status values to a small set
function normalizeStatus(raw) {
    const s = (raw || '').toUpperCase()
    if (!s) return 'UNPAID'
    if (s === 'PARTIALLY_PAID') return 'PARTIAL'
    if (s === 'DRAFT') return 'UNPAID'
    return s
}

export default function PharmacyBilling() {
    const [tab, setTab] = useState('bills')

    // -------- Bills tab state --------
    const [bills, setBills] = useState([])
    const [billsLoading, setBillsLoading] = useState(false)
    const [billTypeFilter, setBillTypeFilter] = useState('ALL')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [selectedBill, setSelectedBill] = useState(null)

    // -------- Payment dialog state --------
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
    const [paymentBill, setPaymentBill] = useState(null)
    const [paymentMode, setPaymentMode] = useState('CASH')
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentSaving, setPaymentSaving] = useState(false)

    // -------- Returns tab state --------
    const [returns, setReturns] = useState([])
    const [returnsLoading, setReturnsLoading] = useState(false)
    const [returnSearch, setReturnSearch] = useState('')
    const [returnSourceBill, setReturnSourceBill] = useState(null)
    const [returnLines, setReturnLines] = useState([])
    const [returnReason, setReturnReason] = useState('')
    const [returnSaving, setReturnSaving] = useState(false)

    // -------- IPD consolidated state --------
    const [ipdPatientId, setIpdPatientId] = useState('')
    const [ipdAdmissionId, setIpdAdmissionId] = useState('')
    const [ipdLoading, setIpdLoading] = useState(false)
    const [ipdBills, setIpdBills] = useState([])
    const [ipdSummary, setIpdSummary] = useState(null)

    // -------- Initial & filter-based loads --------

    useEffect(() => {
        fetchBills()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    useEffect(() => {
        if (tab === 'returns') {
            fetchReturns()
        }
        if (tab === 'ipd') {
            fetchIpdBills()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab])

    // -------- API calls --------

    async function fetchBills() {
        try {
            setBillsLoading(true)
            const params = {
                limit: 100,
            }
            // Status is backend-filtered
            if (statusFilter !== 'ALL') params.status = statusFilter
            if (search.trim()) params.q = search.trim()
            if (dateFrom) params.date_from = dateFrom
            if (dateTo) params.date_to = dateTo

            const res = await listPharmacyBills(params)
            setBills(res?.data || [])
        } catch (e) {
            // toast handled globally
        } finally {
            setBillsLoading(false)
        }
    }

    async function handleSelectBill(row) {
        try {
            const res = await getPharmacyBill(row.id)
            setSelectedBill(res?.data || row)
        } catch (e) {
            // handled globally
        }
    }

    async function fetchReturns() {
        try {
            setReturnsLoading(true)
            const res = await listPharmacyReturns({ limit: 50 })
            setReturns(res?.data || [])
        } catch (e) {
            // handled globally
        } finally {
            setReturnsLoading(false)
        }
    }

    async function fetchIpdBills() {
        try {
            // Fetch recent pharmacy bills and locally filter IPD
            const res = await listPharmacyBills({
                limit: 100,
            })
            const all = res?.data || []
            const onlyIpd = all.filter((row) => getBillType(row) === 'IPD')
            setIpdBills(onlyIpd)
        } catch (e) {
            // handled globally
        }
    }

    // -------- Derived: filtered bills by bill type (client-side) --------

    const filteredBills = useMemo(() => {
        if (!bills?.length) return []
        if (billTypeFilter === 'ALL') return bills
        return bills.filter((row) => getBillType(row) === billTypeFilter)
    }, [bills, billTypeFilter])

    // -------- Payment flow --------

    function openPaymentDialogForBill(bill) {
        const total = Number(bill.total_amount ?? bill.gross_total ?? bill.net_amount ?? 0)
        const paid = Number(bill.paid_amount ?? 0)
        const balance =
            Number(bill.balance_amount ?? (total - paid)) || 0

        setPaymentBill(bill)
        setPaymentAmount(
            balance > 0 ? String(balance.toFixed(2)) : String(total.toFixed(2))
        )
        setPaymentMode('CASH')
        setPaymentDialogOpen(true)
    }

    async function submitPayment() {
        if (!paymentBill) return
        const amt = Number(paymentAmount)
        if (!amt || amt <= 0) {
            toast.error('Enter a valid payment amount')
            return
        }

        const total = Number(
            paymentBill.total_amount ??
            paymentBill.gross_total ??
            paymentBill.net_amount ??
            0
        )
        const alreadyPaid = Number(paymentBill.paid_amount ?? 0)
        const newPaid = alreadyPaid + amt
        const remaining = Math.max(total - newPaid, 0)

        let newStatus = 'PARTIAL'
        if (remaining <= 0.01) {
            newStatus = 'PAID'
        } else if (newPaid <= 0.01) {
            newStatus = 'UNPAID'
        }

        try {
            setPaymentSaving(true)

            // ✅ Use pharmacy billing status endpoint so Invoice + Payments stay in sync
            await updatePharmacyBillStatus(paymentBill.id, {
                payment_status: newStatus,
                paid_amount: amt, // incremental payment
                note: null,
            })

            toast.success('Payment recorded successfully')

            setPaymentDialogOpen(false)
            setPaymentBill(null)
            setPaymentAmount('')

            await fetchBills()
            if (selectedBill && selectedBill.id === paymentBill.id) {
                const res = await getPharmacyBill(selectedBill.id)
                setSelectedBill(res?.data || selectedBill)
            }
        } catch (e) {
            // handled globally
        } finally {
            setPaymentSaving(false)
        }
    }

    // -------- Returns flow --------

    async function handleSearchReturnSource() {
        if (!returnSearch.trim()) {
            toast.error('Enter bill no / patient / UHID to search')
            return
        }
        try {
            const res = await listPharmacyBills({
                q: returnSearch.trim(),
                limit: 1,
            })
            const list = res?.data || []
            if (!list.length) {
                toast.error('No matching pharmacy bill found')
                return
            }
            const bill = list[0]
            const detailRes = await getPharmacyBill(bill.id)
            const detail = detailRes?.data || bill

            const items = detail.items || detail.lines || []
            const mappedLines = items.map((it) => ({
                ...it,
                return_qty: '',
            }))

            setReturnSourceBill(detail)
            setReturnLines(mappedLines)
        } catch (e) {
            // handled globally
        }
    }

    function handleReturnQtyChange(idx, val) {
        setReturnLines((prev) =>
            prev.map((l, i) =>
                i === idx
                    ? {
                        ...l,
                        return_qty: val,
                    }
                    : l
            )
        )
    }

    async function submitReturn() {
        if (!returnSourceBill) {
            toast.error('Select a source bill first')
            return
        }

        const selected = returnLines.filter(
            (l) => Number(l.return_qty || 0) > 0
        )
        if (!selected.length) {
            toast.error('Enter return quantity for at least one item')
            return
        }

        const payload = {
            source_invoice_id: returnSourceBill.id,
            reason: returnReason || null,
            lines: selected.map((l) => ({
                bill_line_id: l.id,
                qty_to_return: Number(l.return_qty || 0),
            })),
        }

        try {
            setReturnSaving(true)
            await createPharmacyReturn(payload)
            toast.success('Return note created successfully')

            setReturnReason('')
            setReturnSourceBill(null)
            setReturnLines([])
            setReturnSearch('')
            fetchReturns()
        } catch (e) {
            // handled globally
        } finally {
            setReturnSaving(false)
        }
    }

    // -------- IPD consolidated flow --------

    async function handleGenerateIpdConsolidated() {
        if (!ipdPatientId && !ipdAdmissionId) {
            toast.error('Enter Patient ID or Admission ID')
            return
        }

        const payload = {}
        if (ipdPatientId) payload.patient_id = Number(ipdPatientId)
        if (ipdAdmissionId) payload.admission_id = Number(ipdAdmissionId)

        try {
            setIpdLoading(true)
            const res = await createPharmacyIpdConsolidatedInvoice(payload)
            const summary = res?.data || res || null

            if (!summary) {
                toast.error('No consolidated data returned')
                return
            }

            setIpdSummary(summary)
            toast.success('IPD consolidated pharmacy summary generated')
        } catch (e) {
            // handled globally
        } finally {
            setIpdLoading(false)
        }
    }

    // -------- Derived: selected bill items --------

    const selectedBillItems = useMemo(() => {
        if (!selectedBill) return []
        return selectedBill.items || selectedBill.lines || []
    }, [selectedBill])

    // -------- Render --------

    return (
        <>
            <div className="p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                            Pharmacy Billing Console
                        </h1>
                        <p className="text-sm text-slate-500">
                            Manage pharmacy invoices, payments, returns &amp; IPD consolidated bills.
                        </p>
                    </div>
                </div>

                <Tabs value={tab} onValueChange={setTab}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="bills">Bills</TabsTrigger>
                        <TabsTrigger value="returns">Returns</TabsTrigger>
                        <TabsTrigger value="ipd">IPD Consolidated</TabsTrigger>
                    </TabsList>

                    {/* ---------------- BILLS TAB ---------------- */}
                    <TabsContent value="bills" className="space-y-3">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
                            {/* Bills list card */}
                            <Card className="border-slate-200 rounded-2xl shadow-sm">
                                <CardHeader className="pb-3">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                <ReceiptIndianRupee className="w-4 h-4 text-slate-500" />
                                                Pharmacy Bills
                                            </CardTitle>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 rounded-full border-slate-200"
                                                onClick={fetchBills}
                                            >
                                                <Filter className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        {/* Filters */}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="relative flex-1 min-w-[180px]">
                                                    <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                                                    <Input
                                                        value={search}
                                                        onChange={(e) => setSearch(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') fetchBills()
                                                        }}
                                                        placeholder="Search bill no / UHID / patient / phone"
                                                        className="pl-8 h-9 text-xs bg-white border-slate-200 rounded-full"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="date"
                                                        value={dateFrom}
                                                        onChange={(e) => setDateFrom(e.target.value)}
                                                        className="h-9 text-[11px] bg-white border-slate-200 rounded-full w-[130px]"
                                                    />
                                                    <Input
                                                        type="date"
                                                        value={dateTo}
                                                        onChange={(e) => setDateTo(e.target.value)}
                                                        className="h-9 text-[11px] bg-white border-slate-200 rounded-full w-[130px]"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-3 rounded-full text-[11px]"
                                                        onClick={fetchBills}
                                                    >
                                                        Apply
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Select
                                                    value={billTypeFilter}
                                                    onValueChange={setBillTypeFilter}
                                                >
                                                    <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-full h-8 text-[11px]">
                                                        <SelectValue placeholder="Bill type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {BILL_TYPES.map((t) => (
                                                            <SelectItem
                                                                key={t.value}
                                                                value={t.value}
                                                            >
                                                                {t.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                <Select
                                                    value={statusFilter}
                                                    onValueChange={setStatusFilter}
                                                >
                                                    <SelectTrigger className="w-[130px] bg-white border-slate-200 rounded-full h-8 text-[11px]">
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {BILL_STATUS.map((s) => (
                                                            <SelectItem
                                                                key={s.value}
                                                                value={s.value}
                                                            >
                                                                {s.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                        <ScrollArea className="max-h-[480px]">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                    <tr className="text-[11px] text-slate-500">
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Bill
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Patient
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Type
                                                        </th>
                                                        <th className="text-right px-3 py-2 font-medium">
                                                            Amount
                                                        </th>
                                                        <th className="text-right px-3 py-2 font-medium">
                                                            Paid / Balance
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Date
                                                        </th>
                                                        <th className="text-right px-3 py-2 font-medium">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {billsLoading && (
                                                        <tr>
                                                            <td
                                                                colSpan={7}
                                                                className="px-3 py-6 text-center text-[11px] text-slate-500"
                                                            >
                                                                Loading bills...
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {!billsLoading && !filteredBills.length && (
                                                        <tr>
                                                            <td
                                                                colSpan={7}
                                                                className="px-3 py-6 text-center text-[11px] text-slate-500"
                                                            >
                                                                No pharmacy bills found for selected filters.
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {!billsLoading &&
                                                        filteredBills.map((row) => {
                                                            const total = Number(
                                                                row.total_amount ??
                                                                row.gross_total ??
                                                                row.net_amount ??
                                                                0
                                                            )
                                                            const paid = Number(
                                                                row.paid_amount ?? 0
                                                            )
                                                            const balance =
                                                                Number(
                                                                    row.balance_amount ?? total - paid
                                                                ) || 0

                                                            const status = normalizeStatus(row.status)
                                                            const createdAt =
                                                                row.bill_date ||
                                                                row.created_at ||
                                                                row.invoice_date ||
                                                                null
                                                            const createdStr = createdAt
                                                                ? String(createdAt)
                                                                    .slice(0, 16)
                                                                    .replace('T', ' ')
                                                                : '—'

                                                            const type = getBillType(row)
                                                            const patientName =
                                                                row.patient_name ||
                                                                `${row.patient?.first_name || ''} ${row.patient?.last_name || ''
                                                                    }`.trim() ||
                                                                '—'

                                                            const uhid =
                                                                row.patient_uhid ||
                                                                row.patient?.uhid

                                                            const canCollect =
                                                                status !== 'PAID' &&
                                                                status !== 'CANCELLED' &&
                                                                total > 0

                                                            return (
                                                                <tr
                                                                    key={row.id}
                                                                    className="border-t border-slate-100 hover:bg-slate-50/70 cursor-pointer"
                                                                    onClick={() => handleSelectBill(row)}
                                                                >
                                                                    <td className="px-3 py-2 align-middle">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[11px] font-medium text-slate-900">
                                                                                {row.bill_number ||
                                                                                    row.invoice_number ||
                                                                                    `PB-${row.id}`}
                                                                            </span>
                                                                            {row.rx_number && (
                                                                                <span className="text-[10px] text-slate-500">
                                                                                    Rx: {row.rx_number}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 align-middle">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] text-slate-700">
                                                                                <User className="w-3 h-3" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[11px] text-slate-900">
                                                                                    {patientName}
                                                                                </div>
                                                                                {uhid && (
                                                                                    <div className="text-[10px] text-slate-500">
                                                                                        UHID: {uhid}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 align-middle">
                                                                        <div className="flex flex-col gap-1">
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="border-slate-200 text-[10px] px-1.5 py-0.5 w-max"
                                                                            >
                                                                                {type}
                                                                            </Badge>
                                                                            <StatusChip status={status} />
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 align-middle text-right">
                                                                        <div className="text-[11px] text-slate-900">
                                                                            {formatINR(total)}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 align-middle text-right">
                                                                        <div className="flex flex-col items-end gap-0.5">
                                                                            <span className="text-[11px] text-emerald-700">
                                                                                Paid: {formatINR(paid)}
                                                                            </span>
                                                                            <span className="text-[11px] text-rose-700">
                                                                                Bal: {formatINR(balance)}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 align-middle text-[11px] text-slate-700">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Clock3 className="w-3 h-3 text-slate-400" />
                                                                            <span>{createdStr}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        className="px-3 py-2 align-middle text-right"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <div className="flex justify-end gap-1.5">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon"
                                                                                className="h-7 w-7 rounded-full border-slate-200"
                                                                                onClick={() => {
                                                                                    const id =
                                                                                        row.id ||
                                                                                        row.invoice_id
                                                                                    if (id) {
                                                                                        openPharmacyBillPdfInNewTab(
                                                                                            id
                                                                                        )
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <Download className="w-3 h-3" />
                                                                            </Button>
                                                                            {canCollect && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-7 px-3 rounded-full text-[11px]"
                                                                                    onClick={() =>
                                                                                        openPaymentDialogForBill(
                                                                                            row
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <IndianRupee className="w-3 h-3 mr-1" />
                                                                                    Collect
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                </tbody>
                                            </table>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Bill detail card */}
                            <Card className="border-slate-200 rounded-2xl shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <ReceiptIndianRupee className="w-4 h-4 text-slate-500" />
                                        Bill Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-xs">
                                    {!selectedBill ? (
                                        <div className="py-10 text-center text-[11px] text-slate-500">
                                            Select a pharmacy bill from the list to view details.
                                        </div>
                                    ) :
                                        (
                                            <>
                                                {/* Header */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-0.5">
                                                        <div className="text-[11px] font-semibold text-slate-900">
                                                            {selectedBill.patient_name ||
                                                                `${selectedBill.patient?.first_name || ''} ${selectedBill.patient?.last_name || ''
                                                                    }`.trim() ||
                                                                '—'}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            UHID:{' '}
                                                            {selectedBill.patient_uhid ||
                                                                selectedBill.patient?.uhid ||
                                                                '—'}
                                                        </div>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <Badge
                                                                variant="outline"
                                                                className="border-slate-200 text-[10px] px-1.5 py-0.5"
                                                            >
                                                                {getBillType(selectedBill)}
                                                            </Badge>
                                                            {selectedBill.location && (
                                                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                                    <Hospital className="w-3 h-3" />
                                                                    {selectedBill.location}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-[11px] text-slate-500">
                                                        <div>
                                                            Bill:{' '}
                                                            {selectedBill.bill_number ||
                                                                selectedBill.invoice_number ||
                                                                `PB-${selectedBill.id}`}
                                                        </div>
                                                        <div>
                                                            Date:{' '}
                                                            {(selectedBill.bill_date ||
                                                                selectedBill.created_at ||
                                                                '')
                                                                ?.toString()
                                                                ?.slice(0, 10) || '—'}
                                                        </div>
                                                        <div className="mt-1">
                                                            <StatusChip status={normalizeStatus(selectedBill.status)} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Amount summary */}
                                                <div className="border border-slate-100 rounded-xl px-3 py-2.5 flex flex-col gap-1.5 bg-slate-50/60">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-600">
                                                            Total
                                                        </span>
                                                        <span className="text-[12px] font-semibold text-slate-900">
                                                            {formatINR(
                                                                selectedBill.total_amount ??
                                                                selectedBill.gross_total ??
                                                                selectedBill.net_amount
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-600">
                                                            Paid
                                                        </span>
                                                        <span className="text-[11px] text-emerald-700">
                                                            {formatINR(selectedBill.paid_amount)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-600">
                                                            Balance
                                                        </span>
                                                        <span className="text-[11px] text-rose-700">
                                                            {formatINR(
                                                                selectedBill.balance_amount ??
                                                                (Number(
                                                                    selectedBill.total_amount ??
                                                                    selectedBill.gross_total ??
                                                                    selectedBill.net_amount ??
                                                                    0
                                                                ) -
                                                                    Number(
                                                                        selectedBill.paid_amount ?? 0
                                                                    ))
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Item lines */}
                                                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                                    <ScrollArea className="max-h-[260px]">
                                                        <table className="w-full text-[11px]">
                                                            <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                                <tr className="text-[11px] text-slate-500">
                                                                    <th className="text-left px-3 py-2 font-medium">
                                                                        #
                                                                    </th>
                                                                    <th className="text-left px-3 py-2 font-medium">
                                                                        Medicine
                                                                    </th>
                                                                    <th className="text-right px-3 py-2 font-medium">
                                                                        Qty
                                                                    </th>
                                                                    <th className="text-right px-3 py-2 font-medium">
                                                                        Rate
                                                                    </th>
                                                                    <th className="text-right px-3 py-2 font-medium">
                                                                        Amount
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {!selectedBillItems.length && (
                                                                    <tr>
                                                                        <td
                                                                            colSpan={5}
                                                                            className="px-3 py-4 text-center text-[11px] text-slate-500"
                                                                        >
                                                                            No items found for this bill.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                {selectedBillItems.map((it, idx) => (
                                                                    <tr
                                                                        key={it.id || idx}
                                                                        className="border-t border-slate-100"
                                                                    >
                                                                        <td className="px-3 py-2 align-top text-slate-500">
                                                                            {idx + 1}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[11px] font-medium text-slate-900">
                                                                                    {it.item_name ||
                                                                                        it.medicine_name ||
                                                                                        '—'}
                                                                                </span>
                                                                                {it.batch_no && (
                                                                                    <span className="text-[10px] text-slate-500">
                                                                                        Batch: {it.batch_no}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                                            {it.qty || it.quantity || '—'}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                                            {formatINR(it.rate || it.unit_price)}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                                            {formatINR(it.amount || it.line_total)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </ScrollArea>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center justify-between pt-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-3 rounded-full text-[11px]"
                                                        onClick={() => {
                                                            const id =
                                                                selectedBill.id ||
                                                                selectedBill.invoice_id
                                                            if (id) openPharmacyBillPdfInNewTab(id)
                                                        }}
                                                    >
                                                        <Download className="w-3 h-3 mr-1" />
                                                        Download PDF
                                                    </Button>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 px-3 rounded-full text-[11px]"
                                                            onClick={() =>
                                                                openPaymentDialogForBill(selectedBill)
                                                            }
                                                        >
                                                            <IndianRupee className="w-3 h-3 mr-1" />
                                                            Add Payment
                                                        </Button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ---------------- RETURNS TAB ---------------- */}
                    <TabsContent value="returns" className="space-y-3">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)]">
                            {/* New return */}
                            <Card className="border-slate-200 rounded-2xl shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <RotateCcw className="w-4 h-4 text-slate-500" />
                                        New Pharmacy Return
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-xs">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] text-slate-600">
                                            Source bill (search by bill no / UHID / patient)
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                                                <Input
                                                    value={returnSearch}
                                                    onChange={(e) =>
                                                        setReturnSearch(e.target.value)
                                                    }
                                                    placeholder="Eg. PB-0001, UHID, patient name"
                                                    className="pl-8 h-9 text-xs bg-white border-slate-200 rounded-full"
                                                />
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-9 px-3 rounded-full text-[11px]"
                                                onClick={handleSearchReturnSource}
                                            >
                                                Search
                                            </Button>
                                        </div>
                                    </div>

                                    {returnSourceBill && (
                                        <>
                                            <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/60 space-y-1.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="text-[11px] font-semibold text-slate-900">
                                                            {returnSourceBill.patient_name ||
                                                                `${returnSourceBill.patient?.first_name || ''} ${returnSourceBill.patient?.last_name || ''
                                                                    }`.trim() ||
                                                                '—'}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            UHID:{' '}
                                                            {returnSourceBill.patient_uhid ||
                                                                returnSourceBill.patient?.uhid ||
                                                                '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-[11px] text-slate-500">
                                                        Bill:{' '}
                                                        {returnSourceBill.bill_number ||
                                                            returnSourceBill.invoice_number ||
                                                            `PB-${returnSourceBill.id}`}
                                                        <br />
                                                        Date:{' '}
                                                        {(returnSourceBill.bill_date ||
                                                            returnSourceBill.created_at ||
                                                            '')
                                                            ?.toString()
                                                            ?.slice(0, 10) || '—'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-[11px] text-slate-600">
                                                    Items &amp; return quantity
                                                </Label>
                                                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                                    <ScrollArea className="max-h-[250px]">
                                                        <table className="w-full text-[11px]">
                                                            <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                                <tr className="text-[11px] text-slate-500">
                                                                    <th className="text-left px-3 py-2 font-medium">
                                                                        #
                                                                    </th>
                                                                    <th className="text-left px-3 py-2 font-medium">
                                                                        Medicine
                                                                    </th>
                                                                    <th className="text-right px-3 py-2 font-medium">
                                                                        Sold Qty
                                                                    </th>
                                                                    <th className="text-right px-3 py-2 font-medium">
                                                                        Return Qty
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {!returnLines.length && (
                                                                    <tr>
                                                                        <td
                                                                            colSpan={4}
                                                                            className="px-3 py-4 text-center text-[11px] text-slate-500"
                                                                        >
                                                                            No items found for this bill.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                {returnLines.map((l, idx) => (
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
                                                                                        '—'}
                                                                                </span>
                                                                                {l.batch_no && (
                                                                                    <span className="text-[10px] text-slate-500">
                                                                                        Batch: {l.batch_no}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                                            {l.qty || l.quantity || '—'}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top text-right">
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                value={l.return_qty ?? ''}
                                                                                onChange={(e) =>
                                                                                    handleReturnQtyChange(
                                                                                        idx,
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                className="h-8 w-20 ml-auto text-[11px] text-right bg-white border-slate-200 rounded-full"
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </ScrollArea>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-[11px] text-slate-600">
                                                    Reason for return
                                                </Label>
                                                <Textarea
                                                    value={returnReason}
                                                    onChange={(e) =>
                                                        setReturnReason(e.target.value)
                                                    }
                                                    rows={3}
                                                    className="text-[11px] bg-white border-slate-200 rounded-xl resize-none"
                                                    placeholder="Eg. Patient mismatch, wrong strength, expiry, doctor changed prescription, etc."
                                                />
                                            </div>

                                            <div className="flex justify-end pt-1">
                                                <Button
                                                    size="sm"
                                                    className="h-9 px-4 rounded-full text-[11px]"
                                                    onClick={submitReturn}
                                                    disabled={returnSaving}
                                                >
                                                    {returnSaving ? (
                                                        'Creating return...'
                                                    ) : (
                                                        <>
                                                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                                            Create Return Note
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Returns list */}
                            <Card className="border-slate-200 rounded-2xl shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <RotateCcw className="w-4 h-4 text-slate-500" />
                                        Recent Pharmacy Returns
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                        <ScrollArea className="max-h-[420px]">
                                            <table className="w-full text-[11px]">
                                                <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                    <tr className="text-[11px] text-slate-500">
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Return
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Patient
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Source bill
                                                        </th>
                                                        <th className="text-right px-3 py-2 font-medium">
                                                            Refund
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Date
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {returnsLoading && (
                                                        <tr>
                                                            <td
                                                                colSpan={5}
                                                                className="px-3 py-6 text-center text-[11px] text-slate-500"
                                                            >
                                                                Loading returns...
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {!returnsLoading && !returns.length && (
                                                        <tr>
                                                            <td
                                                                colSpan={5}
                                                                className="px-3 py-6 text-center text-[11px] text-slate-500"
                                                            >
                                                                No pharmacy returns found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {!returnsLoading &&
                                                        returns.map((r) => {
                                                            // net_amount is negative for returns; show absolute value
                                                            const refund = Math.abs(
                                                                Number(
                                                                    r.net_amount ??
                                                                    r.total_amount ??
                                                                    0
                                                                )
                                                            )
                                                            const createdStr = (r.created_at || '')
                                                                .toString()
                                                                .slice(0, 16)
                                                                .replace('T', ' ')
                                                            const patientName =
                                                                r.patient_name ||
                                                                `${r.patient?.first_name || ''} ${r.patient?.last_name || ''
                                                                    }`.trim() ||
                                                                '—'
                                                            const source =
                                                                r.source_bill_number ||
                                                                r.source_invoice_number ||
                                                                '—'

                                                            return (
                                                                <tr
                                                                    key={r.id}
                                                                    className="border-t border-slate-100"
                                                                >
                                                                    <td className="px-3 py-2 align-top">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[11px] font-medium text-slate-900">
                                                                                {r.return_number ||
                                                                                    r.bill_number ||
                                                                                    `PR-${r.id}`}
                                                                            </span>
                                                                            {r.reason && (
                                                                                <span className="text-[10px] text-slate-500">
                                                                                    {r.reason}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 align-top">
                                                                        <div className="text-[11px] text-slate-900">
                                                                            {patientName}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                                        {source}
                                                                    </td>
                                                                    <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                                        {formatINR(refund)}
                                                                    </td>
                                                                    <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                                        {createdStr || '—'}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                </tbody>
                                            </table>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ---------------- IPD CONSOLIDATED TAB ---------------- */}
                    <TabsContent value="ipd" className="space-y-3">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)]">
                            {/* Generate consolidated */}
                            <Card className="border-slate-200 rounded-2xl shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Hospital className="w-4 h-4 text-slate-500" />
                                        Generate IPD Pharmacy Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-xs">
                                    <p className="text-[11px] text-slate-500">
                                        Generate consolidated pharmacy summary for all UNPAID / PARTIALLY_PAID
                                        IPD pharmacy invoices for a given admission. Use this for final IPD
                                        discharge billing.
                                    </p>

                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-slate-600">
                                                Patient ID (internal PK)
                                            </Label>
                                            <Input
                                                value={ipdPatientId}
                                                onChange={(e) =>
                                                    setIpdPatientId(e.target.value)
                                                }
                                                placeholder="Eg. 123 (required)"
                                                className="h-9 text-xs bg-white border-slate-200 rounded-full"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-slate-600">
                                                IPD Admission ID (optional filter)
                                            </Label>
                                            <Input
                                                value={ipdAdmissionId}
                                                onChange={(e) =>
                                                    setIpdAdmissionId(e.target.value)
                                                }
                                                placeholder="Eg. 45 – IPD admission table ID"
                                                className="h-9 text-xs bg-white border-slate-200 rounded-full"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button
                                            size="sm"
                                            className="h-9 px-4 rounded-full text-[11px]"
                                            onClick={handleGenerateIpdConsolidated}
                                            disabled={ipdLoading}
                                        >
                                            {ipdLoading ? (
                                                'Generating...'
                                            ) : (
                                                <>
                                                    <ReceiptIndianRupee className="w-3.5 h-3.5 mr-1" />
                                                    Generate Summary
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {ipdSummary && (
                                        <div className="mt-3 border border-slate-100 rounded-xl p-3 bg-slate-50/60 space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[11px] font-semibold text-slate-900">
                                                        {ipdSummary.patient_name || '—'}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        UHID:{' '}
                                                        {ipdSummary.patient_uhid || '—'}
                                                    </div>
                                                    {ipdSummary.admission_id && (
                                                        <div className="text-[11px] text-slate-500">
                                                            Admission ID: {ipdSummary.admission_id}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="border border-slate-100 rounded-lg px-3 py-2 bg-white space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-600">
                                                        Gross Total
                                                    </span>
                                                    <span className="text-[11px] font-semibold text-slate-900">
                                                        {formatINR(ipdSummary.total_amount)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-600">
                                                        Tax
                                                    </span>
                                                    <span className="text-[11px] text-slate-900">
                                                        {formatINR(ipdSummary.total_tax)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-600">
                                                        Net Amount
                                                    </span>
                                                    <span className="text-[11px] font-semibold text-slate-900">
                                                        {formatINR(ipdSummary.net_amount)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="border border-slate-100 rounded-lg overflow-hidden bg-white">
                                                <ScrollArea className="max-h-[220px]">
                                                    <table className="w-full text-[11px]">
                                                        <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                            <tr className="text-[11px] text-slate-500">
                                                                <th className="text-left px-3 py-2 font-medium">
                                                                    Medicine
                                                                </th>
                                                                <th className="text-right px-3 py-2 font-medium">
                                                                    Qty
                                                                </th>
                                                                <th className="text-right px-3 py-2 font-medium">
                                                                    Amount
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {!ipdSummary.items?.length && (
                                                                <tr>
                                                                    <td
                                                                        colSpan={3}
                                                                        className="px-3 py-4 text-center text-[11px] text-slate-500"
                                                                    >
                                                                        No pharmacy items found in this summary.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            {ipdSummary.items?.map((it, idx) => (
                                                                <tr
                                                                    key={idx}
                                                                    className="border-t border-slate-100"
                                                                >
                                                                    <td className="px-3 py-2 align-top text-slate-900">
                                                                        {it.medicine_name || '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2 align-top text-right text-slate-700">
                                                                        {it.qty}
                                                                    </td>
                                                                    <td className="px-3 py-2 align-top text-right text-slate-700">
                                                                        {formatINR(it.amount)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </ScrollArea>
                                            </div>

                                            <p className="text-[10px] text-slate-500">
                                                Use this summary while generating the final IPD discharge
                                                invoice in the main Billing module. Each contributing pharmacy
                                                bill ID is available in <code>sale_ids</code> if needed.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* IPD bills list */}
                            <Card className="border-slate-200 rounded-2xl shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Hospital className="w-4 h-4 text-slate-500" />
                                        Recent IPD Pharmacy Bills
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                        <ScrollArea className="max-h-[420px]">
                                            <table className="w-full text-[11px]">
                                                <thead className="bg-slate-50/80 sticky top-0 z-10">
                                                    <tr className="text-[11px] text-slate-500">
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Bill
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Patient
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Status
                                                        </th>
                                                        <th className="text-right px-3 py-2 font-medium">
                                                            Amount
                                                        </th>
                                                        <th className="text-left px-3 py-2 font-medium">
                                                            Date
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {!ipdBills.length && (
                                                        <tr>
                                                            <td
                                                                colSpan={5}
                                                                className="px-3 py-6 text-center text-[11px] text-slate-500"
                                                            >
                                                                No IPD pharmacy bills found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {ipdBills.map((row) => {
                                                        const total = Number(
                                                            row.total_amount ??
                                                            row.gross_total ??
                                                            row.net_amount ??
                                                            0
                                                        )
                                                        const status = normalizeStatus(row.status)
                                                        const createdStr = (row.bill_date ||
                                                            row.created_at ||
                                                            '')
                                                            .toString()
                                                            .slice(0, 16)
                                                            .replace('T', ' ')
                                                        const patientName =
                                                            row.patient_name ||
                                                            `${row.patient?.first_name || ''} ${row.patient?.last_name || ''
                                                                }`.trim() ||
                                                            '—'

                                                        return (
                                                            <tr
                                                                key={row.id}
                                                                className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer"
                                                                onClick={() => {
                                                                    const id =
                                                                        row.id || row.invoice_id
                                                                    if (id)
                                                                        openPharmacyBillPdfInNewTab(
                                                                            id
                                                                        )
                                                                }}
                                                            >
                                                                <td className="px-3 py-2 align-top">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] font-medium text-slate-900">
                                                                            {row.bill_number ||
                                                                                row.invoice_number ||
                                                                                `PB-${row.id}`}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                                    {patientName}
                                                                </td>
                                                                <td className="px-3 py-2 align-top">
                                                                    <StatusChip status={status} />
                                                                </td>
                                                                <td className="px-3 py-2 align-top text-right text-[11px] text-slate-700">
                                                                    {formatINR(total)}
                                                                </td>
                                                                <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                                                                    {createdStr || '—'}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div >

            {/* -------- PAYMENT DIALOG -------- */}
            < Dialog
                open={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
            >
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                            <IndianRupee className="w-4 h-4 text-slate-600" />
                            Collect Pharmacy Payment
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Record payment for this pharmacy invoice. You can add
                            multiple payments later (partial payments supported).
                        </DialogDescription>
                    </DialogHeader>
                    {paymentBill && (
                        <div className="space-y-3 text-xs">
                            <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/60 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="text-[11px] font-semibold text-slate-900">
                                            {paymentBill.patient_name ||
                                                `${paymentBill.patient?.first_name || ''} ${paymentBill.patient?.last_name || ''
                                                    }`.trim() ||
                                                '—'}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            UHID:{' '}
                                            {paymentBill.patient_uhid ||
                                                paymentBill.patient?.uhid ||
                                                '—'}
                                        </div>
                                    </div>
                                    <div className="text-right text-[11px] text-slate-500">
                                        Bill:{' '}
                                        {paymentBill.bill_number ||
                                            paymentBill.invoice_number ||
                                            `PB-${paymentBill.id}`}
                                        <br />
                                        Date:{' '}
                                        {(paymentBill.bill_date ||
                                            paymentBill.created_at ||
                                            '')
                                            ?.toString()
                                            ?.slice(0, 10) || '—'}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-slate-200">
                                    <div className="text-[11px] text-slate-600">
                                        Total / Paid / Balance
                                    </div>
                                    <div className="text-right text-[11px]">
                                        <div className="text-slate-900">
                                            {formatINR(
                                                paymentBill.total_amount ??
                                                paymentBill.gross_total ??
                                                paymentBill.net_amount
                                            )}
                                        </div>
                                        <div className="text-emerald-700">
                                            {formatINR(paymentBill.paid_amount)}
                                        </div>
                                        <div className="text-rose-700">
                                            {formatINR(
                                                paymentBill.balance_amount ??
                                                (Number(
                                                    paymentBill.total_amount ??
                                                    paymentBill.gross_total ??
                                                    paymentBill.net_amount ??
                                                    0
                                                ) -
                                                    Number(
                                                        paymentBill.paid_amount ?? 0
                                                    ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-600">
                                        Payment mode
                                    </Label>
                                    <Select
                                        value={paymentMode}
                                        onValueChange={setPaymentMode}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-white border-slate-200 rounded-full text-[11px]">
                                            <SelectValue placeholder="Select mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PAYMENT_MODES.map((m) => (
                                                <SelectItem
                                                    key={m.value}
                                                    value={m.value}
                                                >
                                                    {m.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-600">
                                        Amount
                                    </Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={paymentAmount}
                                        onChange={(e) =>
                                            setPaymentAmount(e.target.value)
                                        }
                                        className="h-9 text-xs bg-white border-slate-200 rounded-full"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-full text-[11px]"
                            onClick={() => setPaymentDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="h-8 px-4 rounded-full text-[11px]"
                            onClick={submitPayment}
                            disabled={paymentSaving}
                        >
                            {paymentSaving ? (
                                'Saving...'
                            ) : (
                                <>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Save Payment
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </>
    )
}

function StatusChip({ status }) {
    const s = (status || '').toUpperCase()
    let label = s || '—'
    let cls =
        'bg-slate-50 text-slate-700 border border-slate-200'

    if (s === 'UNPAID' || s === 'PENDING' || s === 'DRAFT') {
        label = 'Unpaid'
        cls = 'bg-amber-50 text-amber-700 border border-amber-200'
    } else if (s === 'PARTIAL' || s === 'PARTIALLY_PAID') {
        label = 'Partially paid'
        cls = 'bg-blue-50 text-blue-700 border border-blue-200'
    } else if (s === 'PAID') {
        label = 'Paid'
        cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    } else if (s === 'CANCELLED') {
        label = 'Cancelled'
        cls = 'bg-rose-50 text-rose-700 border border-rose-200'
    } else if (s === 'FINALIZED') {
        label = 'Finalized'
        cls = 'bg-slate-50 text-slate-700 border border-slate-300'
    }

    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 text-[10px] rounded-full ${cls}`}
        >
            {label}
        </span>
    )
}
