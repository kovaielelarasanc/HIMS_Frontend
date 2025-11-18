import { useEffect, useMemo, useState } from 'react'
import { searchPatients } from '../../api/opd'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

export default function PatientPagedPicker({ value, onChange }) {
    const [q, setQ] = useState('')
    const [list, setList] = useState([])
    const [page, setPage] = useState(0)

    useEffect(() => {
        let alive = true
        const run = async () => {
            const { data } = await searchPatients(q || '')
            if (!alive) return
            setList(data || [])
            setPage(0)
        }
        run()
        return () => { alive = false }
    }, [q])

    const pages = Math.max(1, Math.ceil((list?.length || 0) / PAGE_SIZE))
    const start = page * PAGE_SIZE
    const rows = useMemo(() => (list || []).slice(start, start + PAGE_SIZE), [list, start])

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

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                            <th className="px-3 py-2">UHID</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Phone</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(p => (
                            <tr key={p.id} className="border-t">
                                <td className="px-3 py-1">{p.uhid}</td>
                                <td className="px-3 py-1">{p.first_name} {p.last_name}</td>
                                <td className="px-3 py-1">{p.phone || '—'}</td>
                                <td className="px-3 py-1">
                                    <button
                                        className={["btn btn-sm", value === p.id ? "bg-emerald-600 hover:bg-emerald-700" : ""].join(' ')}
                                        onClick={() => onChange(p.id)}
                                    >
                                        {value === p.id ? 'Selected' : 'Select'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr><td className="px-3 py-3 text-sm text-gray-500" colSpan={4}>No results</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm">
                <button
                    className="px-2 py-1 rounded-lg border disabled:opacity-50"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                >
                    <ChevronLeft className="inline h-4 w-4" /> Prev
                </button>
                <div>Page {page + 1} / {pages}</div>
                <button
                    className="px-2 py-1 rounded-lg border disabled:opacity-50"
                    onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
                    disabled={page >= pages - 1}
                >
                    Next <ChevronRight className="inline h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
