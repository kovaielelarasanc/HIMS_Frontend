import { useEffect, useMemo, useState } from 'react'
import { Download, Search, AlertTriangle, Info, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'

import { getMonthlySummary, exportMonthlyExcel, downloadBlob } from '@/api/supplierLedger'
import { listSuppliers } from '@/api/inventory'
import { useCan } from '@/hooks/useCan'

import { Money, fmtDate } from './_ui'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

function currentMonthStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function KpiTile({ label, children, tone = 'slate' }) {
  const toneCls =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-950'
          : 'border-slate-500 bg-slate-50 text-slate-950'

  return (
    <div className={`rounded-3xl border ${toneCls} p-3`}>
      <div className="text-[11px] text-slate-600">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none">{children}</div>
    </div>
  )
}

export default function SupplierMonthlySummaryScreen() {
  const canView = useCan('pharmacy.accounts.supplier_ledger.monthly_summary.view')
  const canExport = useCan('pharmacy.accounts.supplier_ledger.monthly_summary.export')

  const [month, setMonth] = useState(currentMonthStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [q, setQ] = useState('')
  const [showHelp, setShowHelp] = useState(true)

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

  const supplierName = (id) =>
    suppliers.find((s) => String(s.id) === String(id))?.name || `Supplier #${id}`

  const load = async (m = month) => {
    if (!canView) return
    if (!m) {
      toast.warning('Select a month first')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await getMonthlySummary(m)
      setRows(res.data?.rows || [])
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to load monthly summary.'
      setRows([])
      setError(msg)
      toast.error('Monthly Summary load failed', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canView) return
    load(month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, canView])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return (rows || []).filter((r) => supplierName(r.supplier_id).toLowerCase().includes(term))
  }, [rows, q, suppliers])

  const totals = useMemo(() => {
    const sum = (k) => (filtered || []).reduce((a, r) => a + Number(r?.[k] || 0), 0)
    return {
      purchase: sum('total_purchase'),
      paid: sum('total_paid'),
      pending: sum('pending_amount'),
      overdue: (filtered || []).reduce((a, r) => a + Number(r?.overdue_invoices || 0), 0),
    }
  }, [filtered])

  if (!canView) {
    return (
      <Card className="rounded-3xl border-slate-500 shadow-sm overflow-hidden">
        <CardHeader className="space-y-1">
          <CardTitle className="text-sm font-semibold text-slate-900">Monthly Summary</CardTitle>
          <p className="text-xs text-slate-500">Permission required.</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You do not have permission to view Supplier Monthly Summary.
            <div className="mt-2 text-xs">
              Ask Admin to enable:{' '}
              <span className="font-mono">
                pharmacy.accounts.supplier_ledger.monthly_summary.view
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* NUTRYAH-glass container */}
      <div className="rounded-[28px] border border-slate-500/70 bg-gradient-to-b from-white to-slate-50 shadow-[0_18px_50px_rgba(2,6,23,0.08)] overflow-hidden">
        {/* Glass Header */}
        <div className="px-4 sm:px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-slate-500/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">
                    Supplier Monthly Summary
                  </div>
                  <div className="text-xs text-slate-500">
                    Supplier-wise purchase vs paid vs pending for the selected month.
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Input
                type="month"
                className="h-10 bg-white rounded-full border-slate-500 w-full sm:w-44"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />

              <Button
                size="sm"
                className="h-10 rounded-full"
                onClick={() => load(month)}
                disabled={loading || !month || !canView}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Load
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-10 rounded-full gap-2 border-slate-500 bg-white/70 backdrop-blur"
                disabled={!month || !canExport}
                title={!canExport ? 'No permission to export' : undefined}
                onClick={() => month && downloadBlob(() => exportMonthlyExcel(month))}
              >
                <Download className="w-4 h-4" />
                Excel
              </Button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KpiTile label="Total purchase"><Money value={totals.purchase} /></KpiTile>
            <KpiTile label="Total paid" tone="emerald"><Money value={totals.paid} /></KpiTile>
            <KpiTile label="Pending" tone="amber"><Money value={totals.pending} /></KpiTile>
            <KpiTile label="Overdue invoices" tone="rose">{totals.overdue}</KpiTile>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          {/* Help panel */}
          <div className="rounded-3xl border border-slate-500/70 bg-white/75 backdrop-blur p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl border border-slate-500 bg-slate-50 p-2">
                  <Info className="h-4 w-4 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">What is this screen?</div>
                  <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    One-month supplier summary: <b>Total Purchase</b>, <b>Paid</b>, <b>Pending</b>, and <b>Overdue count</b>.
                  </div>
                </div>
              </div>

              <Button size="sm" variant="ghost" className="h-9 rounded-full" onClick={() => setShowHelp((s) => !s)}>
                {showHelp ? 'Hide' : 'Show'}
              </Button>
            </div>

            {showHelp && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-500 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">How to use</div>
                  <div className="text-xs text-slate-700 mt-1">Select month → Load → Export Excel.</div>
                </div>
                <div className="rounded-2xl border border-slate-500 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Validation</div>
                  <div className="text-xs text-slate-700 mt-1">Month required (YYYY-MM).</div>
                </div>
                <div className="rounded-2xl border border-slate-500 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Tip</div>
                  <div className="text-xs text-slate-700 mt-1">Use search to jump to a supplier.</div>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="rounded-3xl border border-slate-500/70 bg-white/75 backdrop-blur p-3">
            <label className="block text-[11px] text-slate-500 mb-1">Search supplier</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                className="h-10 pl-9 bg-white rounded-full border-slate-500"
                placeholder="Type supplier name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {/* Loading / Error / Empty / Cards */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-28 w-full rounded-3xl" />
              <Skeleton className="h-28 w-full rounded-3xl" />
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">Couldn’t load monthly summary</div>
                <div className="text-xs text-amber-800 mt-1">{error}</div>
                <Button size="sm" variant="outline" className="mt-3 h-9 rounded-full" onClick={() => load(month)}>
                  Retry
                </Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-slate-500/70 bg-white/80 backdrop-blur p-4 text-sm text-slate-500">
              No data found for this month.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((r) => (
                <div
                  key={r.supplier_id}
                  className="rounded-3xl border border-slate-500/70 bg-white/80 backdrop-blur p-4 shadow-[0_10px_30px_rgba(2,6,23,0.06)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {supplierName(r.supplier_id)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Month: {r.month}</div>
                    </div>
                    <div className="text-xs rounded-full border border-slate-500 bg-slate-50 px-3 py-1 shrink-0">
                      Overdue: <span className="font-semibold">{r.overdue_invoices}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3 border border-slate-500">
                      <div className="text-xs text-slate-500">Total purchase</div>
                      <div className="text-base font-semibold mt-1"><Money value={r.total_purchase} /></div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 border border-slate-500">
                      <div className="text-xs text-slate-500">Total paid</div>
                      <div className="text-base font-semibold mt-1"><Money value={r.total_paid} /></div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 border border-slate-500 col-span-2">
                      <div className="text-xs text-slate-500">Pending</div>
                      <div className="text-base font-semibold mt-1"><Money value={r.pending_amount} /></div>
                      <div className="text-xs text-slate-500 mt-2">
                        Last payment: {r.last_payment_date ? fmtDate(r.last_payment_date) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile sticky bottom bar (premium) */}
        <div className="sm:hidden sticky bottom-0 px-4 py-3 bg-white/70 backdrop-blur-xl border-t border-slate-500/60 flex items-center gap-2">
          <Button
            size="sm"
            className="h-10 rounded-full w-full"
            onClick={() => load(month)}
            disabled={loading || !month}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Load
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-10 rounded-full w-full border-slate-500 bg-white"
            disabled={!month || !canExport}
            onClick={() => month && downloadBlob(() => exportMonthlyExcel(month))}
          >
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>
    </div>
  )
}
