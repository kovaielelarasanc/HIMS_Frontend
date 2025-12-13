// SupplierLedgerScreen.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Download,
    Search,
    RefreshCcw,
    Eye,
    X,
    AlertTriangle,
    SlidersHorizontal,
    Info,
} from 'lucide-react'
import { toast } from 'sonner'

import {
    listSupplierInvoices,
    exportLedgerExcel,
    listSupplierPayments,
    downloadBlob,
} from '@/api/supplierLedger'
import { listSuppliers } from '@/api/inventory'

import { Money, StatusBadge, fmtDate } from './_ui'
import { useCan } from '@/hooks/useCan' // ✅ same as OT page concept

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const NONE = '__none__'
const toSel = (v) => (v === '' || v == null ? NONE : String(v))
const fromSel = (v) => (v === NONE ? '' : v)

function useDebouncedValue(value, delay = 500) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

// ---- small helpers (safe number parsing) ----
const toNum = (v) => {
    if (v === '' || v == null) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
}
const isValidDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

export default function SupplierLedgerScreen() {
    // ✅ Permissions (same as OtCaseDetailPage)
    const canView = useCan('pharmacy.accounts.supplier_ledger.view','ipd.view')
    const canExport = useCan('pharmacy.accounts.supplier_ledger.export')
    // const canManage = useCan('pharmacy.accounts.supplier_ledger.manage') // (optional)

    // -------------------- Data --------------------
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [loadError, setLoadError] = useState('')

    // -------------------- Filters --------------------
    const [q, setQ] = useState('')
    const [filters, setFilters] = useState({
        supplier_id: '',
        status: '',
        from_date: '',
        to_date: '',
        overdue_only: false,
        min_amount: '',
        max_amount: '',
    })

    const [showMoreFilters, setShowMoreFilters] = useState(false)
    const [showHelp, setShowHelp] = useState(true)

    // -------------------- Preview --------------------
    const [previewOpen, setPreviewOpen] = useState(false)
    const [active, setActive] = useState(null)
    const [payments, setPayments] = useState([])
    const [payLoading, setPayLoading] = useState(false)
    const [payError, setPayError] = useState('')

    const debouncedFilters = useDebouncedValue(filters, 550)
    const initialLoaded = useRef(false)

    // -------------------- Filter validation --------------------
    const filterWarnings = useMemo(() => {
        const warns = []

        if (
            filters.from_date &&
            filters.to_date &&
            isValidDateStr(filters.from_date) &&
            isValidDateStr(filters.to_date)
        ) {
            if (filters.from_date > filters.to_date) warns.push('From date is after To date.')
        }

        const minA = toNum(filters.min_amount)
        const maxA = toNum(filters.max_amount)
        if (minA != null && minA < 0) warns.push('Min amount cannot be negative.')
        if (maxA != null && maxA < 0) warns.push('Max amount cannot be negative.')
        if (minA != null && maxA != null && minA > maxA) warns.push('Min amount is greater than Max amount.')

        return warns
    }, [filters])

    const normalizeFiltersForApi = (f) => ({
        supplier_id: f.supplier_id ? Number(f.supplier_id) : undefined,
        status: f.status || undefined,
        from_date: f.from_date || undefined,
        to_date: f.to_date || undefined,
        overdue_only: !!f.overdue_only,
        min_amount: toNum(f.min_amount),
        max_amount: toNum(f.max_amount),
    })

    const clearFilters = () => {
        setFilters({
            supplier_id: '',
            status: '',
            from_date: '',
            to_date: '',
            overdue_only: false,
            min_amount: '',
            max_amount: '',
        })
        setQ('')
        setShowMoreFilters(false)
    }

    // -------------------- API calls --------------------
    const loadSuppliers = async () => {
        if (!canView) return
        try {
            const res = await listSuppliers()
            setSuppliers(res.data || [])
        } catch {
            // interceptor toast
        }
    }

    const loadInvoices = async (f = filters) => {
        if (!canView) return
        if (filterWarnings.length > 0) return

        setLoading(true)
        setLoadError('')
        try {
            const res = await listSupplierInvoices(normalizeFiltersForApi(f))
            setRows(res.data || [])
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Failed to load invoices.'
            setRows([])
            setLoadError(msg)
            toast.error('Supplier Ledger load failed', { description: msg })
        } finally {
            setLoading(false)
        }
    }

    const loadPaymentsForSupplier = async (supplierId) => {
        if (!canView) return
        setPayLoading(true)
        setPayError('')
        try {
            const res = await listSupplierPayments({ supplier_id: supplierId })
            setPayments(res.data || [])
        } catch (err) {
            setPayments([])
            setPayError(err?.response?.data?.detail || 'Failed to load payments.')
        } finally {
            setPayLoading(false)
        }
    }

    // -------------------- Effects --------------------
    useEffect(() => {
        if (!canView) return
        loadSuppliers()
        loadInvoices()
        initialLoaded.current = true
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView])

    useEffect(() => {
        if (!canView) return
        if (!initialLoaded.current) return
        loadInvoices(debouncedFilters)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedFilters, canView])

    // -------------------- Search (local) --------------------
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase()
        if (!term) return rows
        return (rows || []).filter((r) => {
            const s = [r?.grn_number, r?.invoice_number, r?.supplier?.name, r?.location?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            return s.includes(term)
        })
    }, [rows, q])

    // -------------------- Preview --------------------
    const openPreview = async (inv) => {
        if (!canView) return
        setActive(inv)
        setPreviewOpen(true)
        setPayments([])
        setPayError('')
        if (inv?.supplier_id) {
            await loadPaymentsForSupplier(inv.supplier_id)
        }
    }

    const supplierAdvance = useMemo(() => {
        return (payments || []).reduce((a, p) => a + Number(p.advance_amount || 0), 0)
    }, [payments])

    // ✅ Same pattern as OT page: block screen if no view permission
    if (!canView) {
        return (
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-sm font-semibold text-slate-900">Supplier Ledger</CardTitle>
                    <p className="text-xs text-slate-500">Permission required.</p>
                </CardHeader>
                <CardContent>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        You do not have permission to view Supplier Ledger.
                        <div className="mt-2 text-xs">
                            Ask Admin to enable:{' '}
                            <span className="font-mono">pharmacy.accounts.supplier_ledger.view</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1"
                onClick={() => loadInvoices(filters)}
                disabled={loading || filterWarnings.length > 0}
            >
                <RefreshCcw className="w-4 h-4" /> Refresh
            </Button>

            <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1"
                onClick={() => downloadBlob(() => exportLedgerExcel(normalizeFiltersForApi(filters)))}
                disabled={!canExport || filterWarnings.length > 0}
                title={!canExport ? 'No permission: export' : undefined}
            >
                <Download className="w-4 h-4" /> Excel
            </Button>
        </div>
    )

    return (
        <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold text-slate-900">Supplier Ledger</CardTitle>
                    <p className="text-xs text-slate-500">
                        Track GRN-based supplier invoices, payment status, outstanding and overdue invoices. Export to Excel anytime.
                    </p>
                </div>

                {/* Desktop actions */}
                <div className="hidden sm:flex">{HeaderActions}</div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Help / Purpose panel */}
                <div className="rounded-2xl border bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                            <div className="mt-0.5 rounded-lg border bg-slate-50 p-1.5">
                                <Info className="h-4 w-4 text-slate-700" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-slate-900">What is this screen?</div>
                                <div className="text-xs text-slate-600">
                                    This shows <span className="font-medium">Supplier Invoices</span> automatically created from
                                    <span className="font-medium"> GRN (Goods Receipt Note)</span>. Use it to check pending/outstanding
                                    amounts and overdue invoices.
                                </div>
                            </div>
                        </div>

                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowHelp((s) => !s)}>
                            {showHelp ? 'Hide' : 'Show'}
                        </Button>
                    </div>

                    {showHelp && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border bg-slate-50 p-3">
                                <div className="text-[11px] text-slate-500">Purpose</div>
                                <div className="text-xs text-slate-700">Reconcile supplier bills: Invoice Amount vs Paid vs Outstanding.</div>
                            </div>
                            <div className="rounded-xl border bg-slate-50 p-3">
                                <div className="text-[11px] text-slate-500">How to use</div>
                                <div className="text-xs text-slate-700">Filter by supplier / status / date. Use “Overdue only” for urgent follow-up.</div>
                            </div>
                            <div className="rounded-xl border bg-slate-50 p-3">
                                <div className="text-[11px] text-slate-500">Validation rules</div>
                                <div className="text-xs text-slate-700">From date ≤ To date, Min amount ≤ Max amount. Invalid filters stop auto-loading.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="grid gap-2 lg:grid-cols-12">
                    <div className="lg:col-span-4 min-w-0">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <Input
                                className="h-10 pl-9 bg-white w-full"
                                placeholder="Search GRN / invoice / supplier..."
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-3 min-w-0">
                        <Select
                            value={toSel(filters.supplier_id)}
                            onValueChange={(v) => setFilters((s) => ({ ...s, supplier_id: fromSel(v) }))}
                        >
                            <SelectTrigger className="h-10 bg-white w-full">
                                <SelectValue placeholder="All suppliers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>All suppliers</SelectItem>
                                {suppliers.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="lg:col-span-2 min-w-0">
                        <Select
                            value={toSel(filters.status)}
                            onValueChange={(v) => setFilters((s) => ({ ...s, status: fromSel(v) }))}
                        >
                            <SelectTrigger className="h-10 bg-white w-full">
                                <SelectValue placeholder="All status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>All status</SelectItem>
                                <SelectItem value="UNPAID">Unpaid</SelectItem>
                                <SelectItem value="PARTIAL">Partial</SelectItem>
                                <SelectItem value="PAID">Paid</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-2 gap-2 min-w-0">
                        <div className="min-w-0">
                            <label className="block text-[11px] text-slate-500 mb-1">From date</label>
                            <Input
                                type="date"
                                className="h-10 w-full bg-white min-w-0"
                                value={filters.from_date}
                                onChange={(e) => setFilters((s) => ({ ...s, from_date: e.target.value }))}
                            />
                        </div>

                        <div className="min-w-0">
                            <label className="block text-[11px] text-slate-500 mb-1">To date</label>
                            <Input
                                type="date"
                                className="h-10 w-full bg-white min-w-0"
                                value={filters.to_date}
                                onChange={(e) => setFilters((s) => ({ ...s, to_date: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {filterWarnings.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                        <div className="flex-1">
                            <div className="font-semibold">Fix filters to continue</div>
                            <ul className="list-disc pl-4 mt-1 text-amber-800">
                                {filterWarnings.map((w, idx) => (
                                    <li key={idx}>{w}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
                    <div>{loading ? 'Loading…' : `${filtered.length} invoice(s)`}</div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant={filters.overdue_only ? 'default' : 'outline'}
                            className="h-8"
                            onClick={() => setFilters((s) => ({ ...s, overdue_only: !s.overdue_only }))}
                        >
                            Overdue only
                        </Button>

                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowMoreFilters((s) => !s)}>
                            <SlidersHorizontal className="w-4 h-4" /> More
                        </Button>

                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={clearFilters}>
                            <X className="w-4 h-4" /> Clear
                        </Button>

                        <Button size="sm" className="h-8" onClick={() => loadInvoices(filters)} disabled={loading || filterWarnings.length > 0}>
                            Apply
                        </Button>
                    </div>
                </div>

                {showMoreFilters && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
                        <div className="lg:col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">Min amount</label>
                            <Input
                                className="h-10 bg-white"
                                placeholder="0"
                                inputMode="decimal"
                                value={filters.min_amount}
                                onChange={(e) => setFilters((s) => ({ ...s, min_amount: e.target.value }))}
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">Max amount</label>
                            <Input
                                className="h-10 bg-white"
                                placeholder="0"
                                inputMode="decimal"
                                value={filters.max_amount}
                                onChange={(e) => setFilters((s) => ({ ...s, max_amount: e.target.value }))}
                            />
                        </div>
                        <div className="lg:col-span-8 text-[11px] text-slate-500 flex items-center">
                            Tip: Amount filters apply to <span className="font-medium ml-1">Invoice Amount</span> (not outstanding).
                        </div>
                    </div>
                )}

                {/* Desktop Table */}
                <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr,0.8fr,0.4fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                        <span>GRN</span>
                        <span>Supplier</span>
                        <span>Invoice</span>
                        <span>Amount</span>
                        <span>Outstanding</span>
                        <span>Status</span>
                        <span className="text-right">View</span>
                    </div>

                    {loading ? (
                        <div className="p-3 space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : loadError ? (
                        <div className="p-4 text-sm text-slate-700">
                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-700" />
                                <div className="flex-1">
                                    <div className="font-semibold">Couldn’t load invoices</div>
                                    <div className="text-xs text-amber-800">{loadError}</div>
                                    <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => loadInvoices(filters)}>
                                        Retry
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">No invoices found.</div>
                    ) : (
                        <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                            {filtered.map((inv) => (
                                <div
                                    key={inv.id}
                                    className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr,0.8fr,0.4fr] gap-2 px-3 py-3 text-xs hover:bg-slate-50"
                                >
                                    <div>
                                        <div className="font-medium text-slate-900">
                                            {inv.grn_number || `GRN-${inv.grn_id || inv.id}`}
                                        </div>
                                        <div className="text-slate-500">Date: {fmtDate(inv.invoice_date)}</div>
                                    </div>

                                    <div className="text-slate-900">
                                        {inv?.supplier?.name || `Supplier #${inv.supplier_id}`}
                                        <div className="text-[11px] text-slate-500">
                                            {inv?.supplier?.phone || inv?.supplier?.email || '—'}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-slate-900">{inv.invoice_number || '—'}</div>
                                        <div className="text-[11px] text-slate-500">Due: {fmtDate(inv.due_date)}</div>
                                    </div>

                                    <div><Money value={inv.invoice_amount} /></div>
                                    <div><Money value={inv.outstanding_amount} /></div>
                                    <div><StatusBadge inv={inv} /></div>

                                    <div className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(inv)}>
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-2">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : loadError ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                            <div className="flex-1">
                                <div className="font-semibold">Couldn’t load invoices</div>
                                <div className="text-xs text-amber-800">{loadError}</div>
                                <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => loadInvoices(filters)}>
                                    Retry
                                </Button>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">No invoices found.</div>
                    ) : (
                        filtered.map((inv) => (
                            <div key={inv.id} className="rounded-2xl border bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-slate-900 truncate">
                                            {inv?.supplier?.name || `Supplier #${inv.supplier_id}`}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {inv.grn_number || `GRN-${inv.grn_id || inv.id}`} • {fmtDate(inv.invoice_date)}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Inv: {inv.invoice_number || '—'} • Due: {fmtDate(inv.due_date)}
                                        </div>
                                    </div>

                                    <Button variant="outline" size="sm" className="h-8 gap-1 shrink-0" onClick={() => openPreview(inv)}>
                                        <Eye className="w-4 h-4" /> View
                                    </Button>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-xl bg-slate-50 border p-2">
                                        <div className="text-[11px] text-slate-500">Amount</div>
                                        <div className="font-semibold"><Money value={inv.invoice_amount} /></div>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 border p-2">
                                        <div className="text-[11px] text-slate-500">Outstanding</div>
                                        <div className="font-semibold"><Money value={inv.outstanding_amount} /></div>
                                    </div>

                                    <div className="col-span-2 flex items-center justify-between">
                                        <div className="text-[11px] text-slate-500">
                                            Location: {inv?.location?.name || '—'}
                                        </div>
                                        <StatusBadge inv={inv} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Mobile sticky bottom actions */}
                <div className="sm:hidden sticky bottom-0 -mx-6 px-6 py-3 bg-white/90 backdrop-blur border-t flex items-center justify-between">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1"
                        onClick={() => loadInvoices(filters)}
                        disabled={loading || filterWarnings.length > 0}
                    >
                        <RefreshCcw className="w-4 h-4" /> Refresh
                    </Button>

                    <Button
                        size="sm"
                        className="h-9 gap-1"
                        onClick={() => downloadBlob(() => exportLedgerExcel(normalizeFiltersForApi(filters)))}
                        disabled={!canExport || filterWarnings.length > 0}
                        title={!canExport ? 'No permission: export' : undefined}
                    >
                        <Download className="w-4 h-4" /> Excel
                    </Button>
                </div>

                {/* Preview dialog */}
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent className="sm:max-w-3xl w-[calc(100vw-24px)] sm:w-full rounded-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Invoice Details</DialogTitle>
                        </DialogHeader>

                        {!active ? null : (
                            <div className="space-y-3 text-sm">
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <div className="rounded-xl border p-3">
                                        <div className="text-xs text-slate-500">Supplier</div>
                                        <div className="font-medium">{active?.supplier?.name || `#${active.supplier_id}`}</div>
                                    </div>
                                    <div className="rounded-xl border p-3">
                                        <div className="text-xs text-slate-500">Invoice</div>
                                        <div className="font-medium">{active.invoice_number || '—'}</div>
                                        <div className="text-xs text-slate-500">{fmtDate(active.invoice_date)}</div>
                                    </div>
                                    <div className="rounded-xl border p-3">
                                        <div className="text-xs text-slate-500">Status</div>
                                        <div className="mt-1"><StatusBadge inv={active} /></div>
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-3">
                                    <div className="rounded-xl border p-3">
                                        <div className="text-xs text-slate-500">Invoice Amount</div>
                                        <div className="text-lg font-semibold"><Money value={active.invoice_amount} /></div>
                                    </div>
                                    <div className="rounded-xl border p-3">
                                        <div className="text-xs text-slate-500">Paid</div>
                                        <div className="text-lg font-semibold"><Money value={active.paid_amount} /></div>
                                    </div>
                                    <div className="rounded-xl border p-3">
                                        <div className="text-xs text-slate-500">Outstanding</div>
                                        <div className="text-lg font-semibold"><Money value={active.outstanding_amount} /></div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-semibold">Payment History</div>
                                        {supplierAdvance > 0 && (
                                            <div className="text-xs rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1">
                                                Advance: <Money value={supplierAdvance} />
                                            </div>
                                        )}
                                    </div>

                                    {payLoading ? (
                                        <div className="mt-2 space-y-2">
                                            <Skeleton className="h-6 w-full" />
                                            <Skeleton className="h-6 w-full" />
                                        </div>
                                    ) : payError ? (
                                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                                            <div className="flex-1">
                                                <div className="font-semibold">Payments not loaded</div>
                                                <div className="text-amber-800">{payError}</div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="mt-2 h-8"
                                                    onClick={() => loadPaymentsForSupplier(active.supplier_id)}
                                                >
                                                    Retry
                                                </Button>
                                            </div>
                                        </div>
                                    ) : payments.length === 0 ? (
                                        <div className="mt-2 text-xs text-slate-500">No payments found for this supplier.</div>
                                    ) : (
                                        <div className="mt-2 divide-y">
                                            {payments.slice(0, 12).map((p) => (
                                                <div key={p.id} className="py-2 text-xs flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-medium">{fmtDate(p.payment_date)} • {p.payment_method}</div>
                                                        <div className="text-slate-500 truncate">
                                                            {p.reference_no || '—'} {p.remarks ? `• ${p.remarks}` : ''}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="font-semibold"><Money value={p.amount} /></div>
                                                        <div className="text-[11px] text-slate-500">
                                                            Alloc: <Money value={p.allocated_amount} /> • Adv: <Money value={p.advance_amount} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="text-xs text-slate-500">
                                    Tip: Use the <span className="font-medium">Supplier Payments</span> screen to allocate payments to invoices.
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
