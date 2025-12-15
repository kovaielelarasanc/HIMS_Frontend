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
import { useCan } from '@/hooks/useCan'

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
  // ✅ Permissions
  const canView = useCan('pharmacy.accounts.supplier_ledger.view', 'ipd.view')
  const canExport = useCan('pharmacy.accounts.supplier_ledger.export')

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

  // -------------------- Premium KPIs (UI-only from filtered rows) --------------------
  const kpis = useMemo(() => {
    const list = filtered || []
    const total = list.length

    const unpaid = list.filter((x) => String(x.status || '').toUpperCase() === 'UNPAID').length
    const partial = list.filter((x) => String(x.status || '').toUpperCase() === 'PARTIAL').length
    const paid = list.filter((x) => String(x.status || '').toUpperCase() === 'PAID').length

    const now = new Date()
    const overdue = list.filter((x) => {
      const out = Number(x.outstanding_amount || 0) || 0
      if (out <= 0) return false
      if (!x.due_date) return false
      const d = new Date(x.due_date)
      return Number.isFinite(d.getTime()) && d < now
    }).length

    const outstandingSum = list.reduce((a, x) => a + (Number(x.outstanding_amount || 0) || 0), 0)
    return { total, unpaid, partial, paid, overdue, outstandingSum }
  }, [filtered])

  // ✅ Block screen if no permission
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
        className="h-10 rounded-full gap-2 border-slate-200 bg-white/70 backdrop-blur"
        onClick={() => loadInvoices(filters)}
        disabled={loading || filterWarnings.length > 0}
      >
        <RefreshCcw className="w-4 h-4" />
        Refresh
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="h-10 rounded-full gap-2 border-slate-200 bg-white/70 backdrop-blur"
        onClick={() => downloadBlob(() => exportLedgerExcel(normalizeFiltersForApi(filters)))}
        disabled={!canExport || filterWarnings.length > 0}
        title={!canExport ? 'No permission: export' : undefined}
      >
        <Download className="w-4 h-4" />
        Excel
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Apple-premium background + glass container */}
      <div className="rounded-[28px] border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 shadow-[0_18px_50px_rgba(2,6,23,0.08)] overflow-hidden">
        {/* HEADER (glass) */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-white/65 backdrop-blur-xl border-b border-slate-200/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">
                    Supplier Ledger
                  </div>
                  <div className="text-xs text-slate-500">
                    GRN → Supplier invoice tracking • Outstanding • Overdue • Export
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden sm:flex">{HeaderActions}</div>
          </div>

          {/* KPI strip */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <KpiCard label="Total" value={kpis.total} />
            <KpiCard label="Unpaid" value={kpis.unpaid} tone="amber" />
            <KpiCard label="Partial" value={kpis.partial} tone="blue" />
            <KpiCard label="Paid" value={kpis.paid} tone="emerald" />
            <KpiCard label="Overdue" value={kpis.overdue} tone="rose" />
            <KpiCardMoney label="Outstanding" value={kpis.outstandingSum} tone="slate" />
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-4 sm:p-6 space-y-3">
          {/* Help panel (premium) */}
          <div className="rounded-3xl border border-slate-200/70 bg-white/75 backdrop-blur p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  <Info className="h-4 w-4 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">How this works</div>
                  <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Supplier invoices are created automatically from <b>GRN</b>. Use filters to find unpaid/overdue bills,
                    open invoice details, and export the ledger.
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="h-9 rounded-full"
                onClick={() => setShowHelp((s) => !s)}
              >
                {showHelp ? 'Hide' : 'Show'}
              </Button>
            </div>

            {showHelp && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniInfo title="Purpose" text="Invoice amount vs paid vs outstanding, per supplier." />
                <MiniInfo title="Best filters" text="Supplier + Status + Overdue only for quick calls." />
                <MiniInfo title="Validation" text="From date ≤ To date, Min amount ≤ Max amount." />
              </div>
            )}
          </div>

          {/* FILTER BAR (glass pills) */}
          <div className="rounded-3xl border border-slate-200/70 bg-white/75 backdrop-blur p-3">
            <div className="grid gap-2 lg:grid-cols-12 items-end">
              <div className="lg:col-span-4 min-w-0">
                <label className="block text-[11px] text-slate-500 mb-1">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    className="h-10 pl-9 bg-white rounded-full border-slate-200"
                    placeholder="GRN / invoice / supplier / location..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

              <div className="lg:col-span-3 min-w-0">
                <label className="block text-[11px] text-slate-500 mb-1">Supplier</label>
                <Select
                  value={toSel(filters.supplier_id)}
                  onValueChange={(v) => setFilters((s) => ({ ...s, supplier_id: fromSel(v) }))}
                >
                  <SelectTrigger className="h-10 bg-white rounded-full border-slate-200">
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
                <label className="block text-[11px] text-slate-500 mb-1">Status</label>
                <Select
                  value={toSel(filters.status)}
                  onValueChange={(v) => setFilters((s) => ({ ...s, status: fromSel(v) }))}
                >
                  <SelectTrigger className="h-10 bg-white rounded-full border-slate-200">
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
                  <label className="block text-[11px] text-slate-500 mb-1">From</label>
                  <Input
                    type="date"
                    className="h-10 bg-white rounded-full border-slate-200"
                    value={filters.from_date}
                    onChange={(e) => setFilters((s) => ({ ...s, from_date: e.target.value }))}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[11px] text-slate-500 mb-1">To</label>
                  <Input
                    type="date"
                    className="h-10 bg-white rounded-full border-slate-200"
                    value={filters.to_date}
                    onChange={(e) => setFilters((s) => ({ ...s, to_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {filterWarnings.length > 0 && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
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

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs text-slate-500">
                {loading ? 'Loading…' : `${filtered.length} invoice(s)`}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={filters.overdue_only ? 'default' : 'outline'}
                  className="h-9 rounded-full"
                  onClick={() => setFilters((s) => ({ ...s, overdue_only: !s.overdue_only }))}
                >
                  Overdue only
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full gap-2"
                  onClick={() => setShowMoreFilters((s) => !s)}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  More
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full gap-2"
                  onClick={clearFilters}
                >
                  <X className="w-4 h-4" />
                  Clear
                </Button>

                <Button
                  size="sm"
                  className="h-9 rounded-full"
                  onClick={() => loadInvoices(filters)}
                  disabled={loading || filterWarnings.length > 0}
                >
                  Apply
                </Button>
              </div>
            </div>

            {showMoreFilters && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] text-slate-500 mb-1">Min amount</label>
                  <Input
                    className="h-10 bg-white rounded-full border-slate-200"
                    placeholder="0"
                    inputMode="decimal"
                    value={filters.min_amount}
                    onChange={(e) => setFilters((s) => ({ ...s, min_amount: e.target.value }))}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-[11px] text-slate-500 mb-1">Max amount</label>
                  <Input
                    className="h-10 bg-white rounded-full border-slate-200"
                    placeholder="0"
                    inputMode="decimal"
                    value={filters.max_amount}
                    onChange={(e) => setFilters((s) => ({ ...s, max_amount: e.target.value }))}
                  />
                </div>
                <div className="lg:col-span-8 text-[11px] text-slate-500 flex items-center">
                  Tip: Amount filters apply to <span className="font-medium ml-1">Invoice Amount</span>.
                </div>
              </div>
            )}
          </div>

          {/* Desktop Table (premium) */}
          <div className="hidden md:block rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur overflow-hidden">
            <div className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr,0.8fr,0.4fr] px-4 py-3 text-xs font-semibold text-slate-500 bg-slate-50/80">
              <span>GRN</span>
              <span>Supplier</span>
              <span>Invoice</span>
              <span>Amount</span>
              <span>Outstanding</span>
              <span>Status</span>
              <span className="text-right">View</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : loadError ? (
              <div className="p-4">
                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-700" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Couldn’t load invoices</div>
                    <div className="text-xs text-amber-800 mt-1">{loadError}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 h-9 rounded-full"
                      onClick={() => loadInvoices(filters)}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No invoices found.</div>
            ) : (
              <div className="max-h-[560px] overflow-auto divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <div
                    key={inv.id}
                    className="grid grid-cols-[1.1fr,1.2fr,1.2fr,0.9fr,0.9fr,0.8fr,0.4fr] gap-2 px-4 py-3 text-xs hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {inv.grn_number || `GRN-${inv.grn_id || inv.id}`}
                      </div>
                      <div className="text-slate-500 mt-0.5">Date: {fmtDate(inv.invoice_date)}</div>
                    </div>

                    <div className="text-slate-900">
                      <div className="font-medium">{inv?.supplier?.name || `Supplier #${inv.supplier_id}`}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {inv?.supplier?.phone || inv?.supplier?.email || '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-900 font-medium">{inv.invoice_number || '—'}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Due: {fmtDate(inv.due_date)}</div>
                    </div>

                    <div className="font-semibold"><Money value={inv.invoice_amount} /></div>
                    <div className="font-semibold"><Money value={inv.outstanding_amount} /></div>
                    <div><StatusBadge inv={inv} /></div>

                    <div className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full border-slate-200 bg-white"
                        onClick={() => openPreview(inv)}
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile cards (premium) */}
          <div className="md:hidden space-y-2">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full rounded-3xl" />
                <Skeleton className="h-24 w-full rounded-3xl" />
              </div>
            ) : loadError ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">Couldn’t load invoices</div>
                  <div className="text-xs text-amber-800 mt-1">{loadError}</div>
                  <Button size="sm" variant="outline" className="mt-3 h-9 rounded-full" onClick={() => loadInvoices(filters)}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-4 text-sm text-slate-500">
                No invoices found.
              </div>
            ) : (
              filtered.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-4 shadow-[0_10px_30px_rgba(2,6,23,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {inv?.supplier?.name || `Supplier #${inv.supplier_id}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {inv.grn_number || `GRN-${inv.grn_id || inv.id}`} • {fmtDate(inv.invoice_date)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Inv: {inv.invoice_number || '—'} • Due: {fmtDate(inv.due_date)}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full gap-2 shrink-0 border-slate-200 bg-white"
                      onClick={() => openPreview(inv)}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] text-slate-500">Amount</div>
                      <div className="font-semibold mt-1"><Money value={inv.invoice_amount} /></div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] text-slate-500">Outstanding</div>
                      <div className="font-semibold mt-1"><Money value={inv.outstanding_amount} /></div>
                    </div>

                    <div className="col-span-2 flex items-center justify-between pt-1">
                      <div className="text-[11px] text-slate-500">
                        Location: <span className="text-slate-700">{inv?.location?.name || '—'}</span>
                      </div>
                      <StatusBadge inv={inv} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mobile sticky actions */}
          <div className="sm:hidden sticky bottom-0 -mx-4 px-4 py-3 bg-white/70 backdrop-blur-xl border-t border-slate-200/70 flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              className="h-10 rounded-full gap-2 border-slate-200 bg-white"
              onClick={() => loadInvoices(filters)}
              disabled={loading || filterWarnings.length > 0}
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>

            <Button
              size="sm"
              className="h-10 rounded-full gap-2"
              onClick={() => downloadBlob(() => exportLedgerExcel(normalizeFiltersForApi(filters)))}
              disabled={!canExport || filterWarnings.length > 0}
              title={!canExport ? 'No permission: export' : undefined}
            >
              <Download className="w-4 h-4" />
              Excel
            </Button>
          </div>

          {/* Preview dialog */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="sm:max-w-3xl w-[calc(100vw-24px)] sm:w-full rounded-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Invoice Details</span>
                  {active ? <span className="text-xs text-slate-500">{active.invoice_number || '—'}</span> : null}
                </DialogTitle>
              </DialogHeader>

              {!active ? null : (
                <div className="space-y-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <GlassBox title="Supplier" value={active?.supplier?.name || `#${active.supplier_id}`} />
                    <GlassBox
                      title="Invoice"
                      value={active.invoice_number || '—'}
                      sub={fmtDate(active.invoice_date)}
                    />
                    <div className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-4">
                      <div className="text-xs text-slate-500">Status</div>
                      <div className="mt-2"><StatusBadge inv={active} /></div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <GlassMoney title="Invoice Amount" value={active.invoice_amount} />
                    <GlassMoney title="Paid" value={active.paid_amount} />
                    <GlassMoney title="Outstanding" value={active.outstanding_amount} />
                  </div>

                  <div className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">Payment History</div>
                      {supplierAdvance > 0 && (
                        <div className="text-xs rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1">
                          Advance: <Money value={supplierAdvance} />
                        </div>
                      )}
                    </div>

                    {payLoading ? (
                      <div className="mt-3 space-y-2">
                        <Skeleton className="h-7 w-full" />
                        <Skeleton className="h-7 w-full" />
                      </div>
                    ) : payError ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-semibold">Payments not loaded</div>
                          <div className="text-amber-800 mt-1">{payError}</div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 h-9 rounded-full"
                            onClick={() => loadPaymentsForSupplier(active.supplier_id)}
                          >
                            Retry
                          </Button>
                        </div>
                      </div>
                    ) : payments.length === 0 ? (
                      <div className="mt-3 text-xs text-slate-500">No payments found for this supplier.</div>
                    ) : (
                      <div className="mt-3 divide-y divide-slate-100">
                        {payments.slice(0, 12).map((p) => (
                          <div key={p.id} className="py-3 text-xs flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium">
                                {fmtDate(p.payment_date)} • {p.payment_method}
                              </div>
                              <div className="text-slate-500 truncate mt-0.5">
                                {p.reference_no || '—'} {p.remarks ? `• ${p.remarks}` : ''}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-semibold"><Money value={p.amount} /></div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
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

          {/* Desktop actions (only when header hidden) */}
          <div className="sm:hidden" />
        </div>

        {/* Desktop actions remain in header; for small screens show actions row */}
        <div className="sm:hidden px-4 pb-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-10 rounded-full gap-2 border-slate-200 bg-white/70 backdrop-blur w-full"
              onClick={() => loadInvoices(filters)}
              disabled={loading || filterWarnings.length > 0}
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-10 rounded-full gap-2 border-slate-200 bg-white/70 backdrop-blur w-full"
              onClick={() => downloadBlob(() => exportLedgerExcel(normalizeFiltersForApi(filters)))}
              disabled={!canExport || filterWarnings.length > 0}
              title={!canExport ? 'No permission: export' : undefined}
            >
              <Download className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Premium UI bits ------------------------------ */

function KpiCard({ label, value, tone = 'slate' }) {
  const toneCls =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-900'
        : tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : tone === 'rose'
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <div className={`rounded-3xl border ${toneCls} p-3`}>
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none">{value ?? 0}</div>
    </div>
  )
}

function KpiCardMoney({ label, value, tone = 'slate' }) {
  const toneCls =
    tone === 'slate'
      ? 'border-slate-200 bg-slate-50 text-slate-900'
      : 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <div className={`rounded-3xl border ${toneCls} p-3`}>
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none">
        <Money value={value} />
      </div>
    </div>
  )
}

function MiniInfo({ title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] text-slate-500">{title}</div>
      <div className="text-xs text-slate-700 mt-1 leading-relaxed">{text}</div>
    </div>
  )
}

function GlassBox({ title, value, sub }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="font-medium mt-1 text-slate-900">{value}</div>
      {sub ? <div className="text-xs text-slate-500 mt-1">{sub}</div> : null}
    </div>
  )
}

function GlassMoney({ title, value }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-lg font-semibold mt-1 text-slate-900"><Money value={value} /></div>
    </div>
  )
}
