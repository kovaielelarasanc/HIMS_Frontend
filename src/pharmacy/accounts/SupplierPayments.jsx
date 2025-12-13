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
import { Skeleton } from '@/components/ui/skeleton'
import { Download } from 'lucide-react'
import { listSuppliers } from '@/api/inventory'
import { useCan } from '@/hooks/useCan' // ✅ add

const NONE = '__none__'
const toSel = (v) => (v === '' || v == null ? NONE : String(v))
const fromSel = (v) => (v === NONE ? '' : v)

export default function SupplierStatementScreen() {
  // ✅ Permissions (same module as Supplier Ledger)
  const canView = useCan('pharmacy.accounts.supplier_ledger.view')
  const canExport = useCan('pharmacy.accounts.supplier_ledger.export')

  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [invLoading, setInvLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])

  useEffect(() => {
    if (!canView) return
    ;(async () => {
      try {
        const res = await listSuppliers()
        setSuppliers(res.data || [])
      } catch {
        // interceptor toast
      }
    })()
  }, [canView])

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

  const totals = useMemo(() => {
    const totalInv = invoices.reduce((a, x) => a + Number(x.invoice_amount || 0), 0)
    const totalPaid = invoices.reduce((a, x) => a + Number(x.paid_amount || 0), 0)
    const totalOut = invoices.reduce((a, x) => a + Number(x.outstanding_amount || 0), 0)
    const adv = payments.reduce((a, p) => a + Number(p.advance_amount || 0), 0)
    return { totalInv, totalPaid, totalOut, adv }
  }, [invoices, payments])

  // ✅ Block page if no permission
  if (!canView) {
    return (
      <Card className="rounded-3xl border-slate-200 shadow-sm">
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
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold text-slate-900">Supplier Statement</CardTitle>
          <p className="text-xs text-slate-500">
            One screen: invoices + payments + balance. Great for month-end reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={toSel(supplierId)} onValueChange={(v) => setSupplierId(fromSel(v))}>
            <SelectTrigger className="h-9 bg-white w-72">
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

          <Button size="sm" className="h-9" onClick={load} disabled={!supplierId || invLoading || payLoading}>
            Load
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1"
            disabled={!supplierId || !canExport}
            title={!canExport ? 'No permission to export' : undefined}
            onClick={() => downloadBlob(() => exportLedgerExcel({ supplier_id: Number(supplierId) }))}
          >
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Supplier summary */}
        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-2xl border bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total purchase</div>
            <div className="text-lg font-semibold">
              <Money value={totals.totalInv} />
            </div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total paid</div>
            <div className="text-lg font-semibold">
              <Money value={totals.totalPaid} />
            </div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Outstanding</div>
            <div className="text-lg font-semibold">
              <Money value={totals.totalOut} />
            </div>
          </div>
          <div className="rounded-2xl border bg-emerald-50 p-3">
            <div className="text-xs text-emerald-700">Advance</div>
            <div className="text-lg font-semibold text-emerald-800">
              <Money value={totals.adv} />
            </div>
          </div>
        </div>

        {/* Invoices */}
        <div className="rounded-2xl border overflow-hidden bg-white">
          <div className="px-3 py-2 text-xs font-semibold bg-slate-50 text-slate-600">Invoices</div>
          {invLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No invoices.</div>
          ) : (
            <div className="divide-y">
              {invoices.slice(0, 25).map((inv) => (
                <div key={inv.id} className="px-3 py-2 text-xs grid md:grid-cols-6 gap-2">
                  <div className="font-medium">
                    {inv.invoice_number || inv.grn_number || `#${inv.id}`}
                  </div>
                  <div>{fmtDate(inv.invoice_date)}</div>
                  <div><Money value={inv.invoice_amount} /></div>
                  <div><Money value={inv.paid_amount} /></div>
                  <div><Money value={inv.outstanding_amount} /></div>
                  <div><StatusBadge inv={inv} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="rounded-2xl border overflow-hidden bg-white">
          <div className="px-3 py-2 text-xs font-semibold bg-slate-50 text-slate-600">Payments</div>
          {payLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : payments.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No payments.</div>
          ) : (
            <div className="divide-y">
              {payments.slice(0, 25).map((p) => (
                <div key={p.id} className="px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {fmtDate(p.payment_date)} • {p.payment_method}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {p.reference_no || '—'} {p.remarks ? `• ${p.remarks}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
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
      </CardContent>
    </Card>
  )
}
