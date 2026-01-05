import { useEffect, useMemo, useState } from 'react'
import {
  listSupplierInvoices,
  listSupplierPayments,
  exportLedgerExcel,
  downloadBlob,
} from '@/api/supplierLedger'
import { Money, fmtDate, StatusBadge } from './_ui'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, RefreshCcw, Search } from 'lucide-react'
import { listSuppliers } from '@/api/inventory'
import { useCan } from '@/hooks/useCan'
import { toast } from 'sonner'

const NONE = '__none__'
const toSel = (v) => (v === '' || v == null ? NONE : String(v))
const fromSel = (v) => (v === NONE ? '' : v)

function GlassShell({ children }) {
  return (
    <div className="rounded-[28px] border border-slate-500/70 bg-gradient-to-b from-white to-slate-50 shadow-[0_18px_50px_rgba(2,6,23,0.08)] overflow-hidden">
      {children}
    </div>
  )
}

function KpiTile({ label, children, tone = 'default' }) {
  const base =
    'rounded-3xl border bg-white/80 backdrop-blur p-3'
  const toneCls =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/70'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/70'
        : 'border-slate-500'
  return (
    <div className={`${base} ${toneCls}`}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900 leading-none">{children}</div>
    </div>
  )
}

function Segmented({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-full border border-slate-500 bg-white/70 backdrop-blur p-1">
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={[
              'px-3 py-1.5 text-xs rounded-full transition',
              active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
            ].join(' ')}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

export default function SupplierStatementScreen() {
  const canView = useCan('pharmacy.accounts.supplier_ledger.view')
  const canExport = useCan('pharmacy.accounts.supplier_ledger.export')

  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [invLoading, setInvLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])

  const [view, setView] = useState('both') // invoices | payments | both
  const [q, setQ] = useState('')

  const busy = invLoading || payLoading

  useEffect(() => {
    if (!canView) return
      ; (async () => {
        try {
          const res = await listSuppliers()
          setSuppliers(res || [])
        } catch {
          // interceptor toast
        }
      })()
  }, [canView])

  const supplierName =
    suppliers.find((s) => String(s.id) === String(supplierId))?.name || '—'

  const load = async () => {
    if (!canView) return
    if (!supplierId) return

    setInvLoading(true)
    setPayLoading(true)
    try {
      const [invRes, payRes] = await Promise.all([
        listSupplierInvoices({ supplier_id: Number(supplierId) }),
        listSupplierPayments({ supplier_id: Number(supplierId) }),
      ])
      setInvoices(invRes.data || [])
      setPayments(payRes.data || [])
    } catch (err) {
      setInvoices([])
      setPayments([])
      const msg = err?.response?.data?.detail || 'Failed to load supplier statement.'
      toast.error('Supplier Statement load failed', { description: msg })
    } finally {
      setInvLoading(false)
      setPayLoading(false)
    }
  }

  useEffect(() => {
    setInvoices([])
    setPayments([])
    if (supplierId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, canView])

  const filteredInvoices = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return invoices
    return (invoices || []).filter((inv) => {
      const s = [
        inv.invoice_number,
        inv.grn_number,
        fmtDate(inv.invoice_date),
        fmtDate(inv.due_date),
        inv.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return s.includes(term)
    })
  }, [invoices, q])

  const filteredPayments = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return payments
    return (payments || []).filter((p) => {
      const s = [
        fmtDate(p.payment_date),
        p.payment_method,
        p.reference_no,
        p.remarks,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return s.includes(term)
    })
  }, [payments, q])

  const totals = useMemo(() => {
    const totalInv = (invoices || []).reduce((a, x) => a + Number(x.invoice_amount || 0), 0)
    const totalPaid = (invoices || []).reduce((a, x) => a + Number(x.paid_amount || 0), 0)
    const totalOut = (invoices || []).reduce((a, x) => a + Number(x.outstanding_amount || 0), 0)
    const adv = (payments || []).reduce((a, p) => a + Number(p.advance_amount || 0), 0)
    const netPayable = Math.max(totalOut - adv, 0)
    return { totalInv, totalPaid, totalOut, adv, netPayable }
  }, [invoices, payments])

  if (!canView) {
    return (
      <Card className="rounded-3xl border-slate-500 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-sm font-semibold text-slate-900">Supplier Statement</CardTitle>
          <p className="text-xs text-slate-500">Permission required.</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You do not have permission to view Supplier Statement.
            <div className="mt-2 text-xs">
              Ask Admin to enable:{' '}
              <span className="font-mono">pharmacy.accounts.supplier_ledger.view</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <GlassShell>
      {/* Premium header */}
      <div className="px-4 sm:px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-slate-500/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-base sm:text-lg font-semibold text-slate-900">
              Supplier Statement
            </div>
            <div className="text-xs text-slate-500">
              Invoices + Payments + Net balance — perfect for reconciliation.
            </div>
            {!!supplierId && (
              <div className="text-xs text-slate-500 mt-1">
                Supplier: <span className="font-medium text-slate-700">{supplierName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Select value={toSel(supplierId)} onValueChange={(v) => setSupplierId(fromSel(v))}>
              <SelectTrigger className="h-10 bg-white rounded-full w-full sm:w-80 border-slate-500">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Select supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="h-10 rounded-full gap-2"
              onClick={load}
              disabled={!supplierId || busy}
            >
              <RefreshCcw className="w-4 h-4" />
              Load
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-10 rounded-full gap-2 border-slate-500 bg-white/70 backdrop-blur"
              disabled={!supplierId || !canExport}
              title={!canExport ? 'No permission to export' : undefined}
              onClick={() =>
                downloadBlob(() => exportLedgerExcel({ supplier_id: Number(supplierId) }))
              }
            >
              <Download className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <KpiTile label="Total purchase">
            <Money value={totals.totalInv} />
          </KpiTile>
          <KpiTile label="Total paid">
            <Money value={totals.totalPaid} />
          </KpiTile>
          <KpiTile label="Outstanding" tone="amber">
            <Money value={totals.totalOut} />
          </KpiTile>
          <KpiTile label="Advance" tone="emerald">
            <Money value={totals.adv} />
          </KpiTile>
          <KpiTile label="Net payable">
            <Money value={totals.netPayable} />
          </KpiTile>
        </div>

        {/* Search + segmented view */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              className="h-10 pl-9 bg-white rounded-full border-slate-500"
              placeholder="Search invoice / GRN / method / ref / remark…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <Segmented
            value={view}
            onChange={setView}
            items={[
              { value: 'both', label: 'Both' },
              { value: 'invoices', label: 'Invoices' },
              { value: 'payments', label: 'Payments' },
            ]}
          />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-3">
        {/* Loading states */}
        {busy && (
          <div className="grid gap-2 lg:grid-cols-2">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        )}

        {/* Content */}
        {!busy && !supplierId && (
          <div className="rounded-3xl border border-slate-500 bg-white/80 backdrop-blur p-4 text-sm text-slate-500">
            Select a supplier to load statement.
          </div>
        )}

        {!busy && supplierId && (
          <div
            className={[
              'grid gap-3',
              view === 'both' ? 'lg:grid-cols-2' : 'grid-cols-1',
            ].join(' ')}
          >
            {(view === 'both' || view === 'invoices') && (
              <div className="rounded-3xl border border-slate-500 bg-white/85 backdrop-blur overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-500 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">Invoices</div>
                  <div className="text-xs text-slate-500">
                    {filteredInvoices.length} item(s)
                  </div>
                </div>

                {filteredInvoices.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No invoices.</div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block">
                      <div className="grid grid-cols-[1.3fr,0.9fr,1fr,1fr,1fr,0.9fr] px-4 py-2 text-[11px] font-semibold text-slate-500">
                        <span>Invoice / GRN</span>
                        <span>Date</span>
                        <span>Amount</span>
                        <span>Paid</span>
                        <span>Outstanding</span>
                        <span>Status</span>
                      </div>
                      <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                        {filteredInvoices.slice(0, 50).map((inv) => (
                          <div
                            key={inv.id}
                            className="grid grid-cols-[1.3fr,0.9fr,1fr,1fr,1fr,0.9fr] px-4 py-3 text-xs hover:bg-slate-50/60 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">
                                {inv.invoice_number || inv.grn_number || `#${inv.id}`}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                Due: {fmtDate(inv.due_date)}
                              </div>
                            </div>
                            <div className="text-slate-700">{fmtDate(inv.invoice_date)}</div>
                            <Money value={inv.invoice_amount} />
                            <Money value={inv.paid_amount} />
                            <Money value={inv.outstanding_amount} />
                            <StatusBadge inv={inv} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden max-h-[520px] overflow-auto p-3 space-y-2">
                      {filteredInvoices.slice(0, 50).map((inv) => (
                        <div key={inv.id} className="rounded-3xl border border-slate-500 bg-white p-4">
                          <div className="font-semibold text-slate-900">
                            {inv.invoice_number || inv.grn_number || `#${inv.id}`}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {fmtDate(inv.invoice_date)} • Due {fmtDate(inv.due_date)}
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-2xl border bg-slate-50 p-3">
                              <div className="text-[11px] text-slate-500">Amount</div>
                              <div className="font-semibold"><Money value={inv.invoice_amount} /></div>
                            </div>
                            <div className="rounded-2xl border bg-slate-50 p-3">
                              <div className="text-[11px] text-slate-500">Outstanding</div>
                              <div className="font-semibold"><Money value={inv.outstanding_amount} /></div>
                            </div>
                            <div className="col-span-2 flex items-center justify-between">
                              <div className="text-xs text-slate-500">Paid: <Money value={inv.paid_amount} /></div>
                              <StatusBadge inv={inv} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {(view === 'both' || view === 'payments') && (
              <div className="rounded-3xl border border-slate-500 bg-white/85 backdrop-blur overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-500 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">Payments</div>
                  <div className="text-xs text-slate-500">
                    {filteredPayments.length} item(s)
                  </div>
                </div>

                {filteredPayments.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No payments.</div>
                ) : (
                  <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
                    {filteredPayments.slice(0, 50).map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-3 text-xs hover:bg-slate-50/60 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {fmtDate(p.payment_date)} • {p.payment_method}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {p.reference_no || '—'} {p.remarks ? `• ${p.remarks}` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold"><Money value={p.amount} /></div>
                          <div className="text-[11px] text-slate-500">
                            Alloc <Money value={p.allocated_amount} /> • Adv <Money value={p.advance_amount} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile sticky actions */}
        <div className="sm:hidden sticky bottom-0 -mx-4 px-4 py-3 bg-white/70 backdrop-blur-xl border-t border-slate-500/60 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-11 rounded-full w-full border-slate-500 bg-white"
            onClick={load}
            disabled={!supplierId || busy}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Load
          </Button>
          <Button
            size="sm"
            className="h-11 rounded-full w-full"
            disabled={!supplierId || !canExport}
            onClick={() =>
              downloadBlob(() => exportLedgerExcel({ supplier_id: Number(supplierId) }))
            }
          >
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>
    </GlassShell>
  )
}
