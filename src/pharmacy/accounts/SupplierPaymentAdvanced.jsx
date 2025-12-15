import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCcw, CheckCircle2, Wand2, Info, Search } from 'lucide-react'
import { toast } from 'sonner'

import { listSupplierInvoices, createSupplierPayment } from '@/api/supplierLedger'
import { listSuppliers } from '@/api/inventory'
import { useCan } from '@/hooks/useCan'
import { Money, fmtDate, StatusBadge } from './_ui'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

const NONE = '__none__'
const toSel = (v) => (v === '' || v == null ? NONE : String(v))
const fromSel = (v) => (v === NONE ? '' : v)

function GlassShell({ children }) {
  return (
    <div className="rounded-[28px] border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 shadow-[0_18px_50px_rgba(2,6,23,0.08)] overflow-hidden">
      {children}
    </div>
  )
}

function KpiTile({ label, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900 leading-none">{children}</div>
    </div>
  )
}

export default function SupplierPaymentsScreen() {
  const canView = useCan('pharmacy.accounts.supplier_payments.view')
  const canManage = useCan('pharmacy.accounts.supplier_payments.manage')

  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState([])

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [pay, setPay] = useState({
    payment_date: '',
    payment_method: 'CASH',
    reference_no: '',
    amount: '',
    remarks: '',
    auto_allocate: true,
  })

  const [selected, setSelected] = useState({}) // invoice_id -> amount
  const [q, setQ] = useState('')

  const loadSuppliers = async () => {
    if (!canView) return
    try {
      const res = await listSuppliers()
      setSuppliers(res.data || [])
    } catch {
      // interceptor toast
    }
  }

  const loadPending = async () => {
    if (!canView) return
    if (!supplierId) return

    setLoading(true)
    try {
      const res = await listSupplierInvoices({
        supplier_id: Number(supplierId),
        status: 'UNPAID',
      })
      const res2 = await listSupplierInvoices({
        supplier_id: Number(supplierId),
        status: 'PARTIAL',
      })
      const list = [...(res.data || []), ...(res2.data || [])]
      list.sort((a, b) => new Date(a.invoice_date || 0) - new Date(b.invoice_date || 0))
      setInvoices(list)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to load invoices.'
      setInvoices([])
      toast.error('Failed to load pending invoices', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView])

  useEffect(() => {
    setInvoices([])
    setSelected({})
    if (supplierId) loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, canView])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return invoices
    return (invoices || []).filter((inv) => {
      const s = [
        inv.invoice_number,
        inv.grn_number,
        fmtDate(inv.invoice_date),
        fmtDate(inv.due_date),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return s.includes(term)
    })
  }, [invoices, q])

  const totalSelected = useMemo(() => {
    return Object.values(selected).reduce((a, b) => a + Number(b || 0), 0)
  }, [selected])

  const totalOutstanding = useMemo(() => {
    return (filtered || []).reduce((a, inv) => a + Number(inv.outstanding_amount || 0), 0)
  }, [filtered])

  const toggle = (inv) => {
    if (!canManage) return
    setSelected((s) => {
      const n = { ...s }
      if (n[inv.id]) {
        delete n[inv.id]
        return n
      }
      n[inv.id] = Number(inv.outstanding_amount || 0)
      return n
    })
  }

  const setAlloc = (id, val) => {
    if (!canManage) return
    setSelected((s) => ({ ...s, [id]: val }))
  }

  const autoPreviewAllocate = () => {
    if (!canManage) return toast.error('You do not have permission to allocate payments.')
    const amt = Number(pay.amount || 0)
    if (!(amt > 0)) return toast.error('Enter payment amount first')

    let remaining = amt
    const next = {}
    for (const inv of invoices) {
      if (remaining <= 0) break
      const need = Number(inv.outstanding_amount || 0)
      if (need <= 0) continue
      const use = Math.min(need, remaining)
      next[inv.id] = use
      remaining -= use
    }
    setSelected(next)
    toast.success('Auto allocation prepared (oldest first)')
  }

  const submit = async () => {
    if (!canManage) return toast.error('You do not have permission to create supplier payments.')
    if (!supplierId) return toast.error('Select supplier')

    const amt = Number(pay.amount || 0)
    if (!(amt > 0)) return toast.error('Enter payment amount')

    const allocations = Object.entries(selected)
      .map(([invoice_id, amount]) => ({
        invoice_id: Number(invoice_id),
        amount: Number(amount || 0),
      }))
      .filter((a) => a.amount > 0)

    if (!pay.auto_allocate && allocations.length === 0) {
      return toast.error('Select invoices or enable Auto allocate')
    }

    if (!pay.auto_allocate && totalSelected - amt > 0.009) {
      return toast.error(`Allocated ₹${totalSelected.toFixed(2)} but payment is ₹${amt.toFixed(2)}`)
    }

    setSaving(true)
    try {
      await createSupplierPayment({
        supplier_id: Number(supplierId),
        amount: amt,
        payment_date: pay.payment_date || undefined,
        payment_method: pay.payment_method,
        reference_no: pay.reference_no || undefined,
        remarks: pay.remarks || '',
        auto_allocate: !!pay.auto_allocate,
        allocations: pay.auto_allocate ? undefined : allocations,
      })

      toast.success('Payment saved')
      setOpen(false)
      setPay({
        payment_date: '',
        payment_method: 'CASH',
        reference_no: '',
        amount: '',
        remarks: '',
        auto_allocate: true,
      })
      setSelected({})
      loadPending()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to save payment.'
      toast.error('Save failed', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  if (!canView) {
    return (
      <Card className="rounded-3xl border-slate-200 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-sm font-semibold text-slate-900">Supplier Payments</CardTitle>
          <p className="text-xs text-slate-500">Permission required.</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You do not have permission to view Supplier Payments.
            <div className="mt-2 text-xs">
              Ask Admin to enable:{' '}
              <span className="font-mono">pharmacy.accounts.supplier_payments.view</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedSupplierName =
    suppliers.find((s) => String(s.id) === String(supplierId))?.name || '—'

  return (
    <GlassShell>
      {/* Glass header */}
      <div className="px-4 sm:px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">
                  Supplier Payments
                </div>
                <div className="text-xs text-slate-500">
                  Select supplier → view pending invoices → record payment (full/partial/advance).
                </div>
              </div>
            </div>

            {!!supplierId && (
              <div className="mt-2 text-xs text-slate-500">
                Active supplier:{' '}
                <span className="font-medium text-slate-700">{selectedSupplierName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-10 rounded-full gap-2 border-slate-200 bg-white/70 backdrop-blur"
              onClick={loadPending}
              disabled={!supplierId}
            >
              <RefreshCcw className="w-4 h-4" /> Refresh
            </Button>

            <Button
              size="sm"
              className="h-10 rounded-full gap-2"
              onClick={() => setOpen(true)}
              disabled={!supplierId || !canManage}
              title={!canManage ? 'No permission to add payments' : undefined}
            >
              <Plus className="w-4 h-4" /> Add Payment
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <KpiTile label="Pending invoices">{filtered.length}</KpiTile>
          <KpiTile label="Outstanding total"><Money value={totalOutstanding} /></KpiTile>
          <KpiTile label="Selected allocation"><Money value={totalSelected} /></KpiTile>
          <KpiTile label="Mode">{canManage ? 'Manage' : 'View only'}</KpiTile>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-3">
        {/* Supplier + Search */}
        <div className="grid gap-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="text-[11px] text-slate-500 mb-1">Supplier</div>
            <Select value={toSel(supplierId)} onValueChange={(v) => setSupplierId(fromSel(v))}>
              <SelectTrigger className="h-10 bg-white rounded-full border-slate-200">
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
          </div>

          <div className="lg:col-span-8">
            <div className="text-[11px] text-slate-500 mb-1">Search</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                className="h-10 pl-9 bg-white rounded-full border-slate-200"
                placeholder="Search invoice / GRN / date…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-3xl border border-slate-200 bg-white/80 backdrop-blur overflow-hidden">
          <div className="grid grid-cols-[0.25fr,1.2fr,1.1fr,0.9fr,0.9fr,0.8fr] px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
            <span />
            <span>Invoice</span>
            <span>Date / Due</span>
            <span>Amount</span>
            <span>Outstanding</span>
            <span>Status</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full rounded-2xl" />
              <Skeleton className="h-10 w-full rounded-2xl" />
            </div>
          ) : !supplierId ? (
            <div className="p-6 text-sm text-slate-500">Select a supplier to view pending invoices.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No unpaid/partial invoices.</div>
          ) : (
            <div className="max-h-[520px] overflow-auto divide-y divide-slate-100">
              {filtered.map((inv) => (
                <div
                  key={inv.id}
                  className="grid grid-cols-[0.25fr,1.2fr,1.1fr,0.9fr,0.9fr,0.8fr] items-center px-4 py-3 text-xs hover:bg-slate-50/60 transition-colors"
                >
                  <Checkbox checked={!!selected[inv.id]} onCheckedChange={() => toggle(inv)} disabled={!canManage} />
                  <div>
                    <div className="font-medium text-slate-900">
                      {inv.invoice_number || inv.grn_number || `#${inv.id}`}
                    </div>
                    <div className="text-[11px] text-slate-500">GRN: {inv.grn_number || '—'}</div>
                  </div>
                  <div className="text-slate-700">
                    <div>{fmtDate(inv.invoice_date)}</div>
                    <div className="text-[11px] text-slate-500">Due: {fmtDate(inv.due_date)}</div>
                  </div>
                  <Money value={inv.invoice_amount} />
                  <Money value={inv.outstanding_amount} />
                  <StatusBadge inv={inv} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-3xl" />
              <Skeleton className="h-24 w-full rounded-3xl" />
            </div>
          ) : !supplierId ? (
            <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-4 text-sm text-slate-500">
              Select a supplier to view pending invoices.
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-4 text-sm text-slate-500">
              No unpaid/partial invoices.
            </div>
          ) : (
            filtered.map((inv) => (
              <div key={inv.id} className="rounded-3xl border border-slate-200 bg-white/85 backdrop-blur p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {inv.invoice_number || inv.grn_number || `#${inv.id}`}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      GRN: {inv.grn_number || '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {fmtDate(inv.invoice_date)} • Due {fmtDate(inv.due_date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Checkbox checked={!!selected[inv.id]} onCheckedChange={() => toggle(inv)} disabled={!canManage} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Amount</div>
                    <div className="font-semibold"><Money value={inv.invoice_amount} /></div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">Outstanding</div>
                    <div className="font-semibold"><Money value={inv.outstanding_amount} /></div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <StatusBadge inv={inv} />
                    <div className="text-[11px] text-slate-500">
                      Select to allocate
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Mobile sticky actions (iOS style) */}
        <div className="md:hidden sticky bottom-0 -mx-4 px-4 py-3 bg-white/70 backdrop-blur-xl border-t border-slate-200/60 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-11 rounded-full w-full border-slate-200 bg-white"
            onClick={loadPending}
            disabled={!supplierId}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-11 rounded-full w-full"
            onClick={() => setOpen(true)}
            disabled={!supplierId || !canManage}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Payment modal (premium sheet) */}
        <Dialog open={open} onOpenChange={(v) => (canManage ? setOpen(v) : null)}>
          <DialogContent className="sm:max-w-3xl w-[calc(100vw-20px)] sm:w-full rounded-[28px] bg-white/90 backdrop-blur-xl border-slate-200 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Record Payment</DialogTitle>
            </DialogHeader>

            {!canManage ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                You do not have permission to create supplier payments.
                <div className="mt-2 text-xs">
                  Ask Admin to enable:{' '}
                  <span className="font-mono">pharmacy.accounts.supplier_payments.manage</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500">Payment date</div>
                    <Input
                      type="date"
                      className="h-10 bg-white rounded-full border-slate-200"
                      value={pay.payment_date}
                      onChange={(e) => setPay((s) => ({ ...s, payment_date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500">Method</div>
                    <Select value={pay.payment_method} onValueChange={(v) => setPay((s) => ({ ...s, payment_method: v }))}>
                      <SelectTrigger className="h-10 bg-white rounded-full border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="BANK">Bank</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500">Reference No</div>
                    <Input
                      className="h-10 bg-white rounded-full border-slate-200"
                      value={pay.reference_no}
                      onChange={(e) => setPay((s) => ({ ...s, reference_no: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="text-xs text-slate-500">Remarks</div>
                    <Input
                      className="h-10 bg-white rounded-full border-slate-200"
                      value={pay.remarks}
                      onChange={(e) => setPay((s) => ({ ...s, remarks: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500">Amount</div>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-10 bg-white rounded-full border-slate-200"
                      value={pay.amount}
                      onChange={(e) => setPay((s) => ({ ...s, amount: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Allocation card */}
                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-semibold text-slate-900">Allocation</div>

                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-600 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={pay.auto_allocate}
                          onChange={(e) => setPay((s) => ({ ...s, auto_allocate: e.target.checked }))}
                        />
                        Auto allocate (oldest first)
                      </label>

                      {!pay.auto_allocate && (
                        <Button size="sm" variant="outline" className="h-9 rounded-full gap-2" onClick={autoPreviewAllocate}>
                          <Wand2 className="w-4 h-4" /> Auto preview
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">
                    Payment: <span className="font-semibold"><Money value={pay.amount} /></span> •
                    Selected: <span className="font-semibold"><Money value={totalSelected} /></span>
                  </div>

                  {!pay.auto_allocate && (
                    <div className="mt-3 max-h-[240px] overflow-auto rounded-2xl border border-slate-200 bg-white">
                      <div className="grid grid-cols-[0.2fr,1.4fr,0.8fr,0.8fr] px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0">
                        <span />
                        <span>Invoice</span>
                        <span>Outstanding</span>
                        <span>Pay now</span>
                      </div>

                      <div className="divide-y">
                        {invoices.map((inv) => {
                          const checked = !!selected[inv.id]
                          return (
                            <div
                              key={inv.id}
                              className="grid grid-cols-[0.2fr,1.4fr,0.8fr,0.8fr] items-center px-3 py-2 text-xs"
                            >
                              <Checkbox checked={checked} onCheckedChange={() => toggle(inv)} />
                              <div className="text-slate-900 font-medium truncate">
                                {inv.invoice_number || inv.grn_number || `#${inv.id}`}
                              </div>
                              <Money value={inv.outstanding_amount} />
                              <Input
                                disabled={!checked}
                                type="number"
                                step="0.01"
                                className="h-9 bg-white rounded-full border-slate-200"
                                value={checked ? String(selected[inv.id] ?? '') : ''}
                                onChange={(e) => {
                                  const v = Number(e.target.value || 0)
                                  const max = Number(inv.outstanding_amount || 0)
                                  setAlloc(inv.id, Math.min(Math.max(v, 0), max))
                                }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-xs text-slate-500">
                    Any extra amount becomes <span className="font-medium">Advance</span>.
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)} className="h-10 rounded-full">
                    Cancel
                  </Button>
                  <Button onClick={submit} disabled={saving} className="h-10 rounded-full gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {saving ? 'Saving…' : 'Save Payment'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </GlassShell>
  )
}
