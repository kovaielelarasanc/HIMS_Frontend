// FILE: frontend/src/components/pickers/OtTheatrePicker.jsx
import { useEffect, useState } from 'react'
import { listOtTheatres } from '../../api/ot'
import { Search } from 'lucide-react'

export default function OtTheatrePicker({ label = 'OT Theatre', value, onChange }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const res = await listOtTheatres({ active: true })
                setItems(res.data || [])
            } catch (err) {
                console.error('Failed to load OT theatres for picker', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const filtered = items.filter((t) => {
        const term = search.trim().toLowerCase()
        if (!term) return true
        return (
            (t.name || '').toLowerCase().includes(term) ||
            (t.code || '').toLowerCase().includes(term) ||
            (t.location || '').toLowerCase().includes(term)
        )
    })

    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
                {label} <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Search OT..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
                >
                    <option value="">Select theatre</option>
                    {filtered.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.code ? `${t.code} – ${t.name}` : t.name}
                            {t.location ? ` (${t.location})` : ''}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}
