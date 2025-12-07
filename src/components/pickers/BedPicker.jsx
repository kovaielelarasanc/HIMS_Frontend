// #src/components/pickers/BedPicker.jsx
import { useEffect, useState } from 'react'
import { listWards, listRooms, listBeds } from '../../api/ipd'

export default function WardRoomBedPicker({ value, onChange }) {
    const [wards, setWards] = useState([])
    const [wardId, setWardId] = useState('')
    const [rooms, setRooms] = useState([])
    const [roomId, setRoomId] = useState('')
    const [beds, setBeds] = useState([])

    useEffect(() => { listWards().then(r => setWards(r.data || [])) }, [])

    useEffect(() => {
        setRooms([]); setRoomId(''); setBeds([])
        if (!wardId) return
        listRooms({ ward_id: wardId }).then(r => setRooms(r.data || []))
    }, [wardId])

    useEffect(() => {
        setBeds([])
        if (!roomId) return
        listBeds({ room_id: roomId }).then(r => setBeds(r.data || []))
    }, [roomId])

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Allocate Bed (Ward → Room → Bed)</label>
            <div className="grid gap-3 md:grid-cols-3">
                <select className="input" value={wardId} onChange={e => setWardId(e.target.value)}>
                    <option value="">Select ward</option>
                    {wards.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
                <select className="input" value={roomId} onChange={e => setRoomId(e.target.value)} disabled={!wardId}>
                    <option value="">Select room</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.number} • {r.type}</option>)}
                </select>
                <select
                    className="input"
                    value={value || ''}
                    onChange={e => onChange(Number(e.target.value))}
                    disabled={!roomId}
                >
                    <option value="">Select bed</option>
                    {beds.map(b => (
                        <option key={b.id} value={b.id}>
                            {b.code} {b.state !== 'vacant' ? `• ${b.state}` : ''}
                        </option>
                    ))}
                </select>
            </div>
            {!!value && (() => {
                const b = beds.find(x => x.id === value)
                if (!b) return null
                return (
                    <div className="text-xs text-gray-500">
                        Selected: <span className="font-medium">{b.code}</span> ({b.state})
                    </div>
                )
            })()}
        </div>
    )
}
