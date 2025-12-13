import { useEffect, useMemo, useState } from 'react'
import { Download, Search, AlertTriangle, Info, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'

import { getMonthlySummary, exportMonthlyExcel, downloadBlob } from '@/api/supplierLedger'
import { listSuppliers } from '@/api/inventory'
import { useCan } from '@/hooks/useCan' // ✅ add

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

export default function SupplierMonthlySummaryScreen() {
  // ✅ Permissions (same concept as OtCaseDetailPage)
  const canView = useCan('pharmacy.accounts.supplier_ledger.monthly_summary.view')
  const canExport = useCan('pharmacy.accounts.supplier_ledger.monthly_summary.export')

  const [month, setMonth] = useState(currentMonthStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [q, setQ] = useState('')
  const [showHelp, setShowHelp] = useState(true)

  // ✅ Load suppliers only if canView
  useEffect(() => {
    if (!canView) return
      ; (async () => {
        try {
          const res = await listSuppliers()
          setSuppliers(res.data || [])
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

  // ✅ Optional auto-load on month change, but only if canView
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

  // ✅ Block screen fully if no view permission (same as OT page)
  if (!canView) {
    return (
      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
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
    <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold text-slate-900">Monthly Summary</CardTitle>
          <p className="text-xs text-slate-500">
            Supplier-wise purchase vs paid vs pending for the selected month.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Input
            type="month"
            className="h-10 bg-white w-full sm:w-44"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />

          <Button
            size="sm"
            className="h-10"
            onClick={() => load(month)}
            disabled={loading || !month || !canView}
            title={!canView ? 'No permission to view' : undefined}
          >
            <RefreshCcw className="w-4 h-4 mr-1" />
            Load
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-10 gap-1"
            disabled={!month || !canExport}
            title={!canExport ? 'No permission to export' : undefined}
            onClick={() => month && downloadBlob(() => exportMonthlyExcel(month))}
          >
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Help / Description */}
        <div className="rounded-2xl border bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 rounded-lg border bg-slate-50 p-1.5">
                <Info className="h-4 w-4 text-slate-700" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">What is this screen?</div>
                <div className="text-xs text-slate-600">
                  It summarizes supplier invoices for one month:
                  <span className="font-medium"> Total Purchase</span>, <span className="font-medium">Paid</span>,
                  <span className="font-medium"> Pending</span> and <span className="font-medium">Overdue count</span>.
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
                <div className="text-[11px] text-slate-500">How to use</div>
                <div className="text-xs text-slate-700">Select month → Load → Export Excel if needed.</div>
              </div>
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">Validation</div>
                <div className="text-xs text-slate-700">Month is required (format: YYYY-MM).</div>
              </div>
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">Tip</div>
                <div className="text-xs text-slate-700">Use search to quickly find a supplier.</div>
              </div>
            </div>
          )}
        </div>

        {/* Search + Totals */}
        <div className="grid gap-2 lg:grid-cols-12">
          <div className="lg:col-span-5 min-w-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                className="h-10 pl-9 bg-white w-full"
                placeholder="Search supplier name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-2xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">Total purchase</div>
              <div className="font-semibold text-slate-900"><Money value={totals.purchase} /></div>
            </div>
            <div className="rounded-2xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">Total paid</div>
              <div className="font-semibold text-slate-900"><Money value={totals.paid} /></div>
            </div>
            <div className="rounded-2xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">Pending</div>
              <div className="font-semibold text-slate-900"><Money value={totals.pending} /></div>
            </div>
            <div className="rounded-2xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">Overdue</div>
              <div className="font-semibold text-slate-900">{totals.overdue}</div>
            </div>
          </div>
        </div>

        {/* Loading / Error / Empty / Cards */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Couldn’t load monthly summary</div>
              <div className="text-xs text-amber-800">{error}</div>
              <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => load(month)}>
                Retry
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500">
            No data found for this month. Try a different month or check if invoices exist.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <div key={r.supplier_id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{supplierName(r.supplier_id)}</div>
                    <div className="text-xs text-slate-500">Month: {r.month}</div>
                  </div>
                  <div className="text-xs rounded-lg border bg-slate-50 px-2 py-1 shrink-0">
                    Overdue: <span className="font-semibold">{r.overdue_invoices}</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3 border">
                    <div className="text-xs text-slate-500">Total purchase</div>
                    <div className="text-base font-semibold"><Money value={r.total_purchase} /></div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border">
                    <div className="text-xs text-slate-500">Total paid</div>
                    <div className="text-base font-semibold"><Money value={r.total_paid} /></div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border col-span-2">
                    <div className="text-xs text-slate-500">Pending</div>
                    <div className="text-base font-semibold"><Money value={r.pending_amount} /></div>
                    <div className="text-xs text-slate-500 mt-1">
                      Last payment: {r.last_payment_date ? fmtDate(r.last_payment_date) : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
