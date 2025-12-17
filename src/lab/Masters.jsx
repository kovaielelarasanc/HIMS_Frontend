// FILE: src/lab/Masters.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react'

import PermGate from '../components/PermGate'
import { listLabTests, createLabTest, updateLabTest, deleteLabTest } from '../api/lab'

// ------------------------------------
// Helpers
// ------------------------------------
const INR = (n) => `₹${Number(n || 0).toFixed(2)}`

function safeNumber(v, fallback = 0) {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(x) ? x : fallback
}

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

// ✅ Keep is_active internally but never show in UI
const EMPTY_FORM = Object.freeze({
  id: null,
  code: '',
  name: '',
  price_ui: '', // string => cursor never jumps
  is_active: true, // hidden but preserved
})

// ------------------------------------
// Memo UI blocks
// ------------------------------------
const GlassShell = React.memo(function GlassShell({ children }) {
  return (
    <div className="min-h-[calc(100vh-56px)] w-full text-slate-900">
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/70 shadow-[0_12px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_-20%,rgba(15,23,42,0.10),transparent_55%),radial-gradient(900px_circle_at_95%_0%,rgba(59,130,246,0.10),transparent_55%)]" />
          <div className="relative p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  )
})

const Header = React.memo(function Header({ loading, onRefresh, onCreate }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-slate-200 bg-white shadow-sm grid place-items-center">
            <span className="text-sm font-semibold text-slate-900">LAB</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
              Lab Masters
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Manage test catalogue (Code · Name · Price)
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <PermGate anyOf={['lab.masters.manage', 'masters.lab.manage']}>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            New Test
          </button>
        </PermGate>
      </div>
    </div>
  )
})

const SearchBar = React.memo(function SearchBar({ q, setQ, total }) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white/80 px-9 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
          placeholder="Search by code or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <button
            onClick={() => setQ('')}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-xl hover:bg-slate-100"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3">
        <div className="text-xs text-slate-500">
          Total: <span className="font-semibold text-slate-700">{total}</span>
        </div>
      </div>
    </div>
  )
})

const TestsCardGrid = React.memo(function TestsCardGrid({
  rows,
  loading,
  deletingId,
  onEdit,
  onDelete,
}) {
  if (loading) {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 min-w-0">
                <div className="h-6 w-20 rounded-xl bg-slate-100" />
                <div className="h-5 w-full max-w-[280px] rounded bg-slate-100" />
                <div className="h-4 w-24 rounded bg-slate-100" />
              </div>
              <div className="h-9 w-20 rounded-2xl bg-slate-100" />
            </div>
            <div className="mt-4 h-10 w-full rounded-2xl bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="mt-4 rounded-[26px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No tests found.
      </div>
    )
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)]"
        >
          <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(900px_circle_at_20%_-30%,rgba(15,23,42,0.10),transparent_55%),radial-gradient(800px_circle_at_110%_0%,rgba(59,130,246,0.10),transparent_60%)]" />

          <div className="relative p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
                    {r.code}
                  </span>
                  <span className="text-[11px] text-slate-500">ID: {r.id}</span>
                </div>

                <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">
                  {r.name}
                </div>

                <div className="mt-3 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm">
                  {INR(r.price)}
                </div>
              </div>

              <PermGate anyOf={['lab.masters.manage', 'masters.lab.manage']}>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    onClick={() => onEdit(r)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
                    aria-label="Edit"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-60 active:scale-[0.99]"
                    aria-label="Delete"
                    title="Delete"
                  >
                    {deletingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </PermGate>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <span className="truncate">Code: <span className="font-semibold text-slate-800">{r.code}</span></span>
              <span className="font-semibold text-slate-800">{INR(r.price)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})

// ------------------------------------
// Main
// ------------------------------------
export default function Masters() {
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q, 350)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  // drawer state
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // ✅ single-form object
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM }))
  const initialFormRef = useRef({ ...EMPTY_FORM })

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => {
      if (prev[field] === value) return prev
      return { ...prev, [field]: value }
    })
  }, [])

  // focus once per open
  const codeInputRef = useRef(null)
  const drawerRef = useRef(null)
  const openSeqRef = useRef(0)
  const [openSeq, setOpenSeq] = useState(0)

  const abortRef = useRef(null)

  const stopHotkeys = useCallback((e) => {
    e.stopPropagation()
    if (e.key === 'Enter') e.preventDefault()
  }, [])

  const isDirty = useCallback(() => {
    const a = initialFormRef.current
    const b = form
    return (
      (a.id ?? null) !== (b.id ?? null) ||
      String(a.code ?? '') !== String(b.code ?? '') ||
      String(a.name ?? '') !== String(b.name ?? '') ||
      String(a.price_ui ?? '') !== String(b.price_ui ?? '') ||
      !!a.is_active !== !!b.is_active
    )
  }, [form])

  const resetForm = useCallback(() => {
    const fresh = { ...EMPTY_FORM }
    initialFormRef.current = fresh
    setForm(fresh)
  }, [])

  const attemptClose = useCallback(() => {
    if (saving) return
    if (panelOpen && isDirty()) {
      const ok = window.confirm('You have unsaved changes. Close anyway?')
      if (!ok) return
    }
    setPanelOpen(false)
    resetForm()
  }, [panelOpen, isDirty, resetForm, saving])

  const openCreate = useCallback(() => {
    const fresh = { ...EMPTY_FORM }
    initialFormRef.current = fresh
    setForm(fresh)
    setPanelOpen(true)
    openSeqRef.current += 1
    setOpenSeq(openSeqRef.current)
  }, [])

  const openEdit = useCallback((row) => {
    const p = safeNumber(row?.price, 0)
    const next = {
      id: row?.id ?? null,
      code: row?.code ?? '',
      name: row?.name ?? '',
      price_ui: String(p),
      // ✅ preserve existing value silently (not shown)
      is_active: row?.is_active ?? true,
    }
    initialFormRef.current = { ...next }
    setForm(next)
    setPanelOpen(true)
    openSeqRef.current += 1
    setOpenSeq(openSeqRef.current)
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const id = window.requestAnimationFrame(() => {
      codeInputRef.current?.focus?.()
      codeInputRef.current?.select?.()
    })
    return () => window.cancelAnimationFrame(id)
  }, [panelOpen, openSeq])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (ev) => {
      if (ev.key === 'Escape') attemptClose()
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, attemptClose])

  useEffect(() => {
    if (!panelOpen) return
    const shield = (e) => {
      const drawer = drawerRef.current
      if (!drawer) return
      const active = document.activeElement
      if (!active || !drawer.contains(active)) return
      e.stopPropagation()
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()
      if (e.key === 'Enter') e.preventDefault()
    }
    document.addEventListener('keydown', shield, true)
    return () => document.removeEventListener('keydown', shield, true)
  }, [panelOpen])

  const fetchRows = useCallback(async () => {
    abortRef.current?.abort?.()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    try {
      const { data } = await listLabTests({
        q: qDebounced,
        page_size: 200,
        signal: ac.signal, // if your axios doesn't support, remove signal
      })
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
      toast.error(e?.response?.data?.detail || 'Failed to load lab tests')
    } finally {
      setLoading(false)
    }
  }, [qDebounced])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const total = useMemo(() => rows.length, [rows])

  const validate = useCallback(() => {
    const code = (form.code || '').trim()
    const name = (form.name || '').trim()
    const price = safeNumber(form.price_ui, 0)
    if (!code) return 'Code is required'
    if (!name) return 'Name is required'
    if (code.length > 32) return 'Code is too long'
    if (name.length > 200) return 'Name is too long'
    if (price < 0) return 'Price cannot be negative'
    return null
  }, [form])

  const onSave = useCallback(async () => {
    const err = validate()
    if (err) return toast.error(err)

    setSaving(true)
    try {
      const payload = {
        code: (form.code || '').trim(),
        name: (form.name || '').trim(),
        price: safeNumber(form.price_ui, 0),
        // ✅ keep existing value, but no UI control
        is_active: !!form.is_active,
      }

      if (form.id) {
        await updateLabTest(form.id, payload)
        toast.success('Updated')
      } else {
        await createLabTest(payload)
        toast.success('Created')
      }

      setPanelOpen(false)
      resetForm()
      fetchRows()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [form, validate, fetchRows, resetForm])

  const onDelete = useCallback(
    async (id) => {
      if (!window.confirm('Delete this test?')) return
      setDeletingId(id)
      try {
        await deleteLabTest(id)
        toast.success('Deleted')
        fetchRows()
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Delete failed')
      } finally {
        setDeletingId(null)
      }
    },
    [fetchRows]
  )

  const Drawer = panelOpen ? (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={attemptClose} />

      <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[520px]">
        <div
          ref={drawerRef}
          className="relative h-[92vh] sm:h-full rounded-t-3xl sm:rounded-none sm:rounded-l-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          onKeyDownCapture={(e) => {
            stopHotkeys(e)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onSave()
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_circle_at_20%_-20%,rgba(15,23,42,0.10),transparent_55%),radial-gradient(900px_circle_at_100%_0%,rgba(59,130,246,0.10),transparent_60%)]" />

          <div className="relative flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900">
                {form.id ? 'Edit Test' : 'New Test'}
              </div>
              <div className="text-xs text-slate-500">
                {form.id ? `Update test #${form.id}` : 'Add a new lab test'}
              </div>
            </div>
            <button
              onClick={attemptClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          <div className="relative h-[calc(92vh-140px)] sm:h-[calc(100%-140px)] overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Code</label>
                  <input
                    ref={codeInputRef}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                    value={form.code}
                    onChange={(e) => handleFormChange('code', e.target.value)}
                    placeholder="e.g. CBC"
                    maxLength={32}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                    value={form.price_ui}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) handleFormChange('price_ui', v)
                    }}
                    onPaste={(e) => {
                      const text = (e.clipboardData?.getData('text') || '').trim()
                      const cleaned = text.replace(/[^\d.]/g, '')
                      if (cleaned === '' || /^[0-9]*\.?[0-9]*$/.test(cleaned)) {
                        e.preventDefault()
                        handleFormChange('price_ui', cleaned)
                      }
                    }}
                    placeholder="0.00"
                  />
                  <div className="text-[11px] text-slate-500">
                    Preview: <span className="font-semibold">{INR(safeNumber(form.price_ui, 0))}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Name</label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g. Complete Blood Count"
                  maxLength={200}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-700">Keyboard</div>
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-semibold">ESC</span> close ·{' '}
                  <span className="font-semibold">Ctrl/⌘ + Enter</span> save
                </div>
              </div>
            </div>
          </div>

          <div className="relative border-t border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {isDirty() ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Unsaved changes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Saved state
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={attemptClose}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  ) : null

  return (
    <div>
      <GlassShell>
        <Header loading={loading} onRefresh={fetchRows} onCreate={openCreate} />
        <SearchBar q={q} setQ={setQ} total={total} />

        <TestsCardGrid
          rows={rows}
          loading={loading}
          deletingId={deletingId}
          onEdit={openEdit}
          onDelete={onDelete}
        />

        {!loading && rows.length > 0 ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            Showing up to 200 results. Refine search for faster access.
          </div>
        ) : null}
      </GlassShell>

      {Drawer}
    </div>
  )
}
