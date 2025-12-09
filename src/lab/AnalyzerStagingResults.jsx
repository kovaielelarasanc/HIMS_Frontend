
// FILE: frontend/src/lis/AnalyzerStagingResults.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import API from '../api/client'
import { useCan } from '../hooks/useCan'
import {
  Activity,
  Beaker,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Bug,
  ChevronDown,
  FlaskConical,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui/alert'

// Small top-right toast (local, non-global)
function Toast({ kind = 'success', title, message, onClose }) {
  const map = {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      icon: <XCircle className="w-4 h-4 text-red-600" />,
    },
    info: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      text: 'text-sky-900',
      icon: <Activity className="w-4 h-4 text-sky-600" />,
    },
  }

  const v = map[kind] ?? map.info

  return (
    <div className="fixed top-4 right-4 z-40">
      <div
        className={`flex items-start gap-3 rounded-xl border shadow-sm px-4 py-3 ${v.bg} ${v.border} ${v.text}`}
      >
        <div className="mt-0.5">{v.icon}</div>
        <div className="space-y-0.5">
          {title && <div className="font-semibold text-sm">{title}</div>}
          {message && (
            <div className="text-xs leading-snug text-slate-700">{message}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-xs text-slate-500 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// Status pill
function StatusBadge({ status }) {
  const map = {
    staging: {
      label: 'Staging',
      className:
        'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200',
    },
    mapped: {
      label: 'Mapped',
      className:
        'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-200',
    },
    posted: {
      label: 'Posted',
      className:
        'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200',
    },
    error: {
      label: 'Error',
      className:
        'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200',
    },
  }

  const v = map[status] ?? {
    label: status || 'Unknown',
    className:
      'bg-slate-50 text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${v.className}`}
    >
      {v.label}
    </span>
  )
}

// Error indicator for row
function ErrorChip({ message }) {
  if (!message) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-[11px] font-medium"
      title={message}
    >
      <Bug className="w-3 h-3" />
      Error
    </span>
  )
}

export default function AnalyzerStagingResults() {
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [stagingRows, setStagingRows] = useState([])

  const [statusFilter, setStatusFilter] = useState('all') // all | staging | posted | error | mapped
  const [sampleSearch, setSampleSearch] = useState('')

  const [loadingDevices, setLoadingDevices] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)
  const [mappingLoading, setMappingLoading] = useState(false)

  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const canMap = useCan('lab.results.map')
  const canView = useCan('lab.devices.view')

  const showToast = useCallback((kind, title, message) => {
    setToast({ kind, title, message })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Fetch devices on mount
  useEffect(() => {
    if (!canView) return
    const fetchDevices = async () => {
      setLoadingDevices(true)
      setError(null)
      try {
        const res = await API.get('/api/lis/devices')
        setDevices(res.data || [])
        if (res.data && res.data.length > 0) {
          setSelectedDeviceId(res.data[0].id)
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load devices')
        showToast('error', 'Load failed', 'Unable to load analyzer devices.')
      } finally {
        setLoadingDevices(false)
      }
    }
    fetchDevices()
  }, [canView, showToast])

  // Fetch staging results when device changes
  const loadStagingRows = useCallback(
    async (deviceId) => {
      if (!deviceId) return
      setLoadingRows(true)
      setError(null)
      try {
        const res = await API.get(
          `/api/lis/devices/${deviceId}/results/staging`,
          {
            params: { limit: 200 },
          }
        )
        setStagingRows(res.data || [])
      } catch (err) {
        console.error(err)
        setError('Failed to load staging results')
        showToast(
          'error',
          'Load failed',
          'Unable to load staging results for this device.'
        )
      } finally {
        setLoadingRows(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    if (selectedDeviceId) {
      loadStagingRows(selectedDeviceId)
    }
  }, [selectedDeviceId, loadStagingRows])

  // Filters
  const filteredRows = useMemo(() => {
    let rows = stagingRows || []
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter)
    }
    const s = sampleSearch.trim()
    if (s) {
      const lower = s.toLowerCase()
      rows = rows.filter((r) =>
        (r.sample_id || '').toLowerCase().includes(lower)
      )
    }
    return rows
  }, [stagingRows, statusFilter, sampleSearch])

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  )

  // Actions
  const handleAutoMapDevice = async () => {
    if (!selectedDeviceId || !canMap) return
    setMappingLoading(true)
    try {
      await API.post(
        `/api/lis/mapping/devices/${selectedDeviceId}/auto-map`,
        null,
        { params: { limit: 500 } }
      )
      showToast(
        'success',
        'Mapping complete',
        'Auto mapping for this device is completed.'
      )
      await loadStagingRows(selectedDeviceId)
    } catch (err) {
      console.error(err)
      showToast(
        'error',
        'Mapping failed',
        'Something went wrong while mapping results.'
      )
    } finally {
      setMappingLoading(false)
    }
  }

  const handleAutoMapSample = async () => {
    const sampleId = sampleSearch.trim()
    if (!sampleId || !canMap) return
    setMappingLoading(true)
    try {
      await API.post(`/api/lis/mapping/samples/${encodeURIComponent(sampleId)}/auto-map`)
      showToast(
        'success',
        'Sample mapped',
        `Auto mapping completed for sample ${sampleId}.`
      )
      if (selectedDeviceId) {
        await loadStagingRows(selectedDeviceId)
      }
    } catch (err) {
      console.error(err)
      showToast(
        'error',
        'Mapping failed',
        'Unable to map this sample. Check if staging rows exist.'
      )
    } finally {
      setMappingLoading(false)
    }
  }

  const handleMapRow = async (rowId) => {
    if (!canMap) return
    setMappingLoading(true)
    try {
      const res = await API.post(`/api/lis/mapping/staging/${rowId}/map`)
      const updated = res.data
      setStagingRows((prev) =>
        prev.map((r) => (r.id === rowId ? updated : r))
      )
      showToast('success', 'Row mapped', 'Result mapped to lab order.')
    } catch (err) {
      console.error(err)
      showToast(
        'error',
        'Mapping failed',
        'Unable to map this result row. Check logs for details.'
      )
    } finally {
      setMappingLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (selectedDeviceId) {
      await loadStagingRows(selectedDeviceId)
      showToast('info', 'Refreshed', 'Staging results reloaded.')
    }
  }

  if (!canView) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            You don’t have permission to view analyzer devices. Contact admin.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      {toast && (
        <Toast
          kind={toast.kind}
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 border border-sky-100 text-xs font-semibold text-sky-700">
            <FlaskConical className="w-3.5 h-3.5" />
            Analyzer Integration
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Analyzer Staging Results
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-600">
            Review incoming results from lab analyzers before they are attached
            to orders. Use <span className="font-semibold">Auto Map</span> to
            link results to Lab Orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs font-semibold"
            onClick={handleRefresh}
            disabled={loadingRows}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1 text-xs font-semibold"
            onClick={handleAutoMapDevice}
            disabled={!canMap || !selectedDeviceId || mappingLoading}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Auto Map Device
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                Filters
              </CardTitle>
              <CardDescription className="text-xs">
                Choose analyzer, filter by sample ID and staging status.
              </CardDescription>
            </div>
            {selectedDevice && (
              <div className="flex flex-wrap items-center gap-2 justify-end text-xs">
                <Badge variant="outline" className="gap-1 px-2 py-1">
                  <Beaker className="w-3.5 h-3.5" />
                  Device: <span className="font-semibold">{selectedDevice.name}</span>
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[11px] px-2 py-1 text-slate-600"
                >
                  Code: {selectedDevice.code}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Device select */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Analyzer Device
              </label>
              {loadingDevices ? (
                <Skeleton className="h-9 w-full rounded-lg" />
              ) : (
                <div className="relative">
                  <select
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs md:text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 appearance-none pr-8"
                    value={selectedDeviceId || ''}
                    onChange={(e) =>
                      setSelectedDeviceId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  >
                    {devices.length === 0 && (
                      <option value="">No devices configured</option>
                    )}
                    {devices.length > 0 &&
                      devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              )}
            </div>

            {/* Sample search */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Sample / Barcode
              </label>
              <div className="flex gap-1">
                <Input
                  placeholder="Search by sample ID / barcode"
                  className="text-xs md:text-sm"
                  value={sampleSearch}
                  onChange={(e) => setSampleSearch(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleAutoMapSample}
                  disabled={!canMap || !sampleSearch.trim() || mappingLoading}
                  title="Auto map all results for this sample"
                >
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Status chips */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'staging', label: 'Staging' },
                  { id: 'mapped', label: 'Mapped' },
                  { id: 'posted', label: 'Posted' },
                  { id: 'error', label: 'Error' },
                ].map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant={statusFilter === s.id ? 'default' : 'outline'}
                    size="xs"
                    className={`text-[11px] font-semibold px-2.5 py-1 ${
                      statusFilter === s.id
                        ? 'bg-sky-600 hover:bg-sky-700'
                        : 'bg-white'
                    }`}
                    onClick={() => setStatusFilter(s.id)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Staging Results
            </CardTitle>
            <CardDescription className="text-xs">
              {loadingRows
                ? 'Loading staging results…'
                : `Showing ${filteredRows.length} row(s)${
                    stagingRows.length !== filteredRows.length
                      ? ` of ${stagingRows.length}`
                      : ''
                  }`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Staging
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Posted
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Error
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Sample ID
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Test Code
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Result
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Flags / Range
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Linked To
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingRows &&
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Skeleton className="h-7 w-20 ml-auto" />
                      </td>
                    </tr>
                  ))}

                {!loadingRows && filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-xs text-slate-500"
                    >
                      No staging results found for current filters.
                    </td>
                  </tr>
                )}

                {!loadingRows &&
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80"
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold text-slate-800 text-xs">
                          {row.sample_id || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Received:{' '}
                          {row.received_at
                            ? new Date(row.received_at).toLocaleString()
                            : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold text-xs text-slate-800">
                          {row.external_test_code || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {row.external_test_name || ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold text-xs text-slate-900">
                          {row.result_value}
                          {row.unit && (
                            <span className="ml-1 text-[11px] text-slate-600">
                              {row.unit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          {row.flag && (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-100">
                              {row.flag}
                            </span>
                          )}
                          {row.reference_range && (
                            <span className="text-[11px] text-slate-600">
                              Range: {row.reference_range}
                            </span>
                          )}
                          <ErrorChip message={row.error_message} />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="space-y-0.5 text-[11px] text-slate-600">
                          <div>
                            Order ID:{' '}
                            <span className="font-semibold">
                              {row.lis_order_id || '—'}
                            </span>
                          </div>
                          <div>
                            Test ID:{' '}
                            <span className="font-semibold">
                              {row.lis_test_id || '—'}
                            </span>
                          </div>
                          <div>
                            Patient:{' '}
                            <span className="font-semibold">
                              {row.patient_id || '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <Button
                          size="xs"
                          className="text-[11px] font-semibold"
                          variant="outline"
                          onClick={() => handleMapRow(row.id)}
                          disabled={
                            !canMap ||
                            mappingLoading ||
                            row.status === 'posted'
                          }
                        >
                          Map row
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {loadingRows &&
              Array.from({ length: 4 }).map((_, idx) => (
                <Card
                  key={idx}
                  className="border-slate-200 shadow-sm rounded-xl"
                >
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-full" />
                  </CardContent>
                </Card>
              ))}

            {!loadingRows && filteredRows.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500">
                No staging results found.
              </div>
            )}

            {!loadingRows &&
              filteredRows.map((row) => (
                <Card
                  key={row.id}
                  className="border-slate-200 shadow-sm rounded-xl"
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          Sample: {row.sample_id || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {row.external_test_code}{' '}
                          {row.external_test_name && (
                            <>· {row.external_test_name}</>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-900">
                        {row.result_value}
                        {row.unit && (
                          <span className="ml-1 text-[11px] text-slate-600">
                            {row.unit}
                          </span>
                        )}
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        className="text-[11px] font-semibold"
                        onClick={() => handleMapRow(row.id)}
                        disabled={
                          !canMap || mappingLoading || row.status === 'posted'
                        }
                      >
                        Map
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1 items-center">
                      {row.flag && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-100">
                          {row.flag}
                        </span>
                      )}
                      {row.reference_range && (
                        <span className="text-[11px] text-slate-600">
                          Range: {row.reference_range}
                        </span>
                      )}
                      <ErrorChip message={row.error_message} />
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>
                        Order:{' '}
                        <span className="font-semibold">
                          {row.lis_order_id || '—'}
                        </span>
                      </span>
                      <span>
                        Test:{' '}
                        <span className="font-semibold">
                          {row.lis_test_id || '—'}
                        </span>
                      </span>
                      <span>
                        Patient:{' '}
                        <span className="font-semibold">
                          {row.patient_id || '—'}
                        </span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
