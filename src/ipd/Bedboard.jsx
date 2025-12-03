import { useEffect, useMemo, useState } from 'react'
import { listWards, listRooms, listBeds, setBedState } from '../api/ipd'

export default function BedBoard() {
    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [dialog, setDialog] = useState(null) // { id, code, action }

    const load = async () => {
        setLoading(true); setErr('')
        try {
            const [w, r, b] = await Promise.all([listWards(), listRooms(), listBeds()])
            setWards(w.data || []); setRooms(r.data || []); setBeds(b.data || [])
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load beds')
        } finally { setLoading(false) }
    }
    useEffect(() => { load() }, [])

    const wardRooms = useMemo(() => {
        const map = {}
        rooms.forEach(r => { (map[r.ward_id] ||= []).push(r) })
        return map
    }, [rooms])

    const roomBeds = useMemo(() => {
        const map = {}
        beds.forEach(b => { (map[b.room_id] ||= []).push(b) })
        return map
    }, [beds])

    const StateBadge = ({ s }) => {
        const cls = s === 'vacant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : s === 'occupied' ? 'bg-rose-50 text-rose-700 border-rose-200'
                : s === 'reserved' ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
        return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{s}</span>
    }

    const quickAction = async (id, code, action) => {
        setDialog({ id, code, action, dt: '', note: '' })
    }

    const doSet = async () => {
        try {
            const payload = { state: dialog.action }
            if (dialog.action === 'reserved') payload.reserved_until = dialog.dt ? (dialog.dt.length === 16 ? `${dialog.dt}:00` : dialog.dt) : null
            if (dialog.note) payload.note = dialog.note
            await setBedState(dialog.id, payload)
            setDialog(null)
            await load()
        } catch (e) {
            alert(e?.response?.data?.detail || 'Failed to set state')
        }
    }

    return (
        <div className="p-4 space-y-3 text-black">
            <h1 className="text-lg font-semibold">Bedboard</h1>
            {loading ? <div>Loading…</div> : err ? <div className="text-rose-700">{err}</div> : null}
            <div className="space-y-4">
                {wards.map(w => (
                    <div key={w.id} className="rounded-xl border bg-white overflow-hidden">
                        <div className="px-3 py-2 text-sm font-semibold">{w.code} — {w.name}</div>
                        {(wardRooms[w.id] || []).map(r => (
                            <div key={r.id} className="border-t px-3 py-2">
                                <div className="text-xs text-gray-600 mb-2">Room {r.number} • {r.type}</div>
                                <div className="flex flex-wrap gap-2">
                                    {(roomBeds[r.id] || []).map(b => (
                                        <div key={b.id} className="rounded-lg border px-3 py-2 text-sm">
                                            <div className="font-medium">{b.code}</div>
                                            <div className="mt-1"><StateBadge s={b.state} /></div>
                                            <div className="mt-2 flex gap-2">
                                                <button className="btn btn-sm" onClick={() => quickAction(b.id, b.code, 'reserved')}>Reserve</button>
                                                <button className="btn btn-sm" onClick={() => quickAction(b.id, b.code, 'preoccupied')}>Preoccupy</button>
                                                <button className="btn btn-sm" onClick={() => quickAction(b.id, b.code, 'vacant')}>Vacate</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {!(wardRooms[w.id] || []).length && <div className="px-3 py-2 text-sm text-gray-500">No rooms</div>}
                    </div>
                ))}
            </div>

            {dialog && (
                <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
                    <div className="w-full max-w-md rounded-xl bg-white p-4 space-y-3">
                        <div className="text-sm font-semibold">Set {dialog.action} — {dialog.code}</div>
                        {dialog.action === 'reserved' && (
                            <div>
                                <label className="text-xs text-gray-500">Reserved until</label>
                                <input type="datetime-local" className="input" value={dialog.dt} onChange={e => setDialog(d => ({ ...d, dt: e.target.value }))} />
                            </div>
                        )}
                        <input className="input" placeholder="Note (optional)" value={dialog.note} onChange={e => setDialog(d => ({ ...d, note: e.target.value }))} />
                        <div className="flex justify-end gap-2">
                            <button className="btn" onClick={doSet}>Save</button>
                            <button className="btn bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => setDialog(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
