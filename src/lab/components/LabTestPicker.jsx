// FILE: src/lab/components/LabTestPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { listLabTests } from '../../api/lab'
import { X, Search, CheckCircle2, ChevronDown } from 'lucide-react'

/**
 * Props:
 *  value: number[]    -> selected test IDs
 *  onChange(nextIds)
 */
export default function LabTestPicker({ value = [], onChange }) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    listLabTests({ q, active: true, page_size: 80 })
      .then((r) => {
        if (!alive) return
        setList(Array.isArray(r?.data) ? r.data : [])
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [q])

  const selectedSet = useMemo(() => new Set(value || []), [value])

  const selectedItems = useMemo(() => {
    // Prefer selected items from current list; fallback if list doesn't contain them
    const inList = (list || []).filter((t) => selectedSet.has(t.id))
    return inList
  }, [list, selectedSet])

  const toggle = (id) => {
    const next = new Set(selectedSet)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange?.([...next])
  }

  const clearAll = () => onChange?.([])

  const normalized = useMemo(() => {
    const arr = Array.isArray(list) ? list : []
    // NUTRYAH-ish behavior: selected tests shown on top (stable)
    const selected = []
    const rest = []
    for (const t of arr) {
      if (selectedSet.has(t.id)) selected.push(t)
      else rest.push(t)
    }
    return [...selected, ...rest]
  }, [list, selectedSet])

  const visible = useMemo(() => {
    const base = normalized || []
    const limit = showAll ? 40 : 12
    return base.slice(0, limit)
  }, [normalized, showAll])

  const fmtMoney = (v) => {
    const n = Number(v || 0)
    return n.toFixed(2)
  }

  return (
    <div className="space-y-3 text-slate-900">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">Select Tests</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Search and pick required lab investigations.
          </div>
        </div>

        <div className="shrink-0 text-xs text-slate-500">
          Selected:{' '}
          <span className="font-semibold text-slate-900">{value?.length || 0}</span>
        </div>
      </div>

      {/* Search (NUTRYAH premium) */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by code / name"
          className={[
            'h-11 w-full rounded-2xl border bg-white/80 px-3 pl-10 pr-10 text-sm',
            'border-slate-200 shadow-sm',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300',
            'backdrop-blur supports-[backdrop-filter]:bg-white/60',
          ].join(' ')}
        />
        {!!q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl hover:bg-slate-100"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        )}
      </div>

      {/* Selected chips (sticky feel) */}
      {(value?.length || 0) > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-slate-600">Selected tests</div>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Clear all
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {selectedItems.slice(0, 14).map((t) => (
              <span
                key={t.id}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 shadow-sm"
              >
                <span className="truncate font-medium">{t.code}</span>
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-100"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}

            {(selectedItems.length || 0) > 14 ? (
              <span className="self-center text-[11px] text-slate-500">
                +{selectedItems.length - 14} more
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* List grid */}
      <div className="grid gap-2 md:grid-cols-2">
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[76px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </>
        ) : (
          <>
            {visible.map((t) => {
              const active = selectedSet.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={[
                    'group relative rounded-2xl border p-3 text-left shadow-sm transition',
                    'bg-white hover:bg-slate-50',
                    active
                      ? 'border-slate-900/20 ring-2 ring-slate-900/10'
                      : 'border-slate-200',
                    'focus:outline-none focus:ring-2 focus:ring-slate-900/10',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {t.code}{' '}
                        <span className="font-medium text-slate-600">— {t.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          ₹{fmtMoney(t.price)}
                        </span>
                        {t.department ? (
                          <span className="text-[11px] text-slate-500">{t.department}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Selected
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 group-hover:bg-slate-200">
                          Add
                        </span>
                      )}
                    </div>
                  </div>

                  {/* subtle bottom divider */}
                  <div className="mt-3 h-px w-full bg-slate-100" />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">Code: {t.code}</span>
                    <span className="font-medium text-slate-600">Tap to toggle</span>
                  </div>
                </button>
              )
            })}

            {!visible.length && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
                <div className="text-sm font-semibold text-slate-900">No tests found</div>
                <div className="mt-1 text-xs text-slate-500">
                  Try a different keyword (code or name).
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Show more */}
      {!loading && (normalized?.length || 0) > 12 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {showAll ? 'Show less' : `Show more (${Math.min(40, normalized.length)} shown)`}
            <ChevronDown className={['h-4 w-4 transition', showAll ? 'rotate-180' : ''].join(' ')} />
          </button>
        </div>
      )}
    </div>
  )
}
