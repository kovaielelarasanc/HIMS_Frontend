import { useEffect, useMemo, useState } from 'react'
import { searchPatients } from '../../api/opd'
import { Search } from 'lucide-react'

export default function PatientPicker({ value, onChange }) {
    const [q, setQ] = useState('')
    const [list, setList] = useState([])
    useEffect(() => {
        let alive = true
        const run = async () => {
            const { data } = await searchPatients(q || '')
            if (!alive) return
            setList(data || [])
        }
        run()
        return () => { alive = false }
    }, [q])

    const chosen = useMemo(() => list.find(p => p.id === value), [list, value])

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Patient</label>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                    className="input pl-9"
                    placeholder="Search by UHID, name, phone, email…"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                {list.slice(0, 8).map(p => (
                    <button
                        key={p.id}
                        onClick={() => onChange(p.id)}
                        className={[
                            "rounded-xl border p-3 text-left transition",
                            value === p.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                        ].join(' ')}
                    >
                        <div className="font-medium">{p.uhid} — {p.first_name} {p.last_name}</div>
                        <div className="text-xs text-gray-500">{p.phone} · {p.email || '—'}</div>
                    </button>
                ))}
            </div>
            {chosen && (
                <div className="rounded-xl border bg-emerald-50 px-3 py-2 text-sm">
                    Selected: <span className="font-medium">{chosen.uhid}</span>
                </div>
            )}
        </div>
    )
}
