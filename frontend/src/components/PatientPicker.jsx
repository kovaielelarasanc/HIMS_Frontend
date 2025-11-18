import React, { useEffect, useState } from 'react'
import { lookupPatients } from '../api/emr'

export default function PatientPicker({ value, onSelect }) {
    const [q, setQ] = useState('')
    const [items, setItems] = useState([])

    useEffect(() => {
        const run = async () => {
            if ((q || '').trim().length < 2) { setItems([]); return }
            const { data } = await lookupPatients(q.trim())
            setItems(data.results || data.items || data || [])
        }
        const h = setTimeout(run, 300)
        return () => clearTimeout(h)
    }, [q])

    return (
        <div>
            <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search patient (UHID/Name/Phone)…"
                className="w-full border rounded px-3 py-2"
            />
            <div className="max-h-44 overflow-auto divide-y mt-2 rounded border bg-white">
                {items.map(p => (
                    <div key={p.id} className="p-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => onSelect && onSelect(p.id)}>
                        <div className="text-sm font-medium">{(p.uhid || `NH-${String(p.id).padStart(6, '0')}`)} — {p.name || `${p.first_name} ${p.last_name || ''}`}</div>
                        <div className="text-xs text-gray-500">{p.gender} • {p.phone}</div>
                    </div>
                ))}
                {items.length === 0 && <div className="p-2 text-xs text-gray-500">Type at least 2 characters…</div>}
            </div>
        </div>
    )
}
