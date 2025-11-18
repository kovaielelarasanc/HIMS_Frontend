// src/lab/components/LabTestPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { listLabTests } from '../../api/lab'
import { X, Search } from 'lucide-react'

/**
 * Props:
 *  value: number[]    -> selected test IDs
 *  onChange(nextIds)
 */
export default function LabTestPicker({ value = [], onChange }) {
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [list, setList] = useState([])

    useEffect(() => {
        let alive = true
        setLoading(true)
        listLabTests({ q, active: true, page_size: 50 })
            .then(r => { if (alive) setList(r.data || []) })
            .finally(() => alive && setLoading(false))
        return () => { alive = false }
    }, [q])

    const selectedSet = useMemo(() => new Set(value || []), [value])
    const selectedItems = useMemo(() => list.filter(t => selectedSet.has(t.id)), [list, selectedSet])

    const toggle = (id) => {
        const next = new Set(selectedSet)
        next.has(id) ? next.delete(id) : next.add(id)
        onChange?.([...next])
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Select Tests</label>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                    className="input pl-9"
                    placeholder="Search by code/name"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
                {(list || []).slice(0, 10).map(t => {
                    const active = selectedSet.has(t.id)
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => toggle(t.id)}
                            className={[
                                'rounded-xl border p-3 text-left transition',
                                active ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                            ].join(' ')}
                        >
                            <div className="font-medium">{t.code} — {t.name}</div>
                            <div className="text-xs text-gray-500">₹{Number(t.price || 0).toFixed(2)}</div>
                        </button>
                    )
                })}
            </div>

            {selectedItems.length > 0 && (
                <div className="rounded-xl border p-3">
                    <div className="text-xs font-medium mb-2">Selected</div>
                    <div className="flex flex-wrap gap-2">
                        {selectedItems.map(t => (
                            <span
                                key={t.id}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs"
                            >
                                {t.code}
                                <button onClick={() => toggle(t.id)} className="ml-1 rounded-full p-0.5 hover:bg-blue-100">
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {loading && <div className="text-xs text-gray-500">Loading…</div>}
        </div>
    )
}
