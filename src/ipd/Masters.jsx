import { useEffect, useState } from 'react'
import PermGate from '../components/PermGate'
import {
    listWards, createWard, updateWard, deleteWard,
    listRooms, createRoom, updateRoom, deleteRoom,
    listBeds, createBed, updateBed, deleteBed,
    listPackages, createPackage, updatePackage, deletePackage,
    listBedRates, createBedRate, updateBedRate, deleteBedRate
} from '../api/ipd'

export default function Masters() {
    return (
        <PermGate anyOf={['ipd.masters.manage', 'ipd.packages.manage']}>
            <div className="p-4 space-y-6">
                <h1 className="text-lg font-semibold text-black">IPD Masters</h1>
                <WardRoomBed />
                <Packages />
                <BedRates />
            </div>
        </PermGate>
    )
}

function WardRoomBed() {
    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])
    const [err, setErr] = useState('')
    const load = async () => {
        setErr('')
        try {
            const [w, r, b] = await Promise.all([listWards(), listRooms(), listBeds()])
            setWards(w.data || []); setRooms(r.data || []); setBeds(b.data || [])
        } catch (e) { setErr(e?.response?.data?.detail || 'Failed to load') }
    }
    useEffect(() => { load() }, [])

    return (
        <div className="rounded-xl border bg-white p-3 space-y-4 text-black">
            <div className="font-medium">Ward · Room · Bed</div>
            {err && <div className="text-rose-700 text-sm">{err}</div>}

            {/* Create Ward */}
            <CreateRow title="New Ward" onSubmit={async (f) => { await createWard(f); await load() }} fields={[
                { name: 'code', placeholder: 'Code', required: true },
                { name: 'name', placeholder: 'Name', required: true },
                { name: 'floor', placeholder: 'Floor' },
            ]} />

            {/* Create Room */}
            <CreateRow title="New Room" onSubmit={async (f) => { await createRoom(f); await load() }} fields={[
                { name: 'ward_id', type: 'select', options: wards.map(w => ({ value: w.id, label: `${w.code} — ${w.name}` })), required: true },
                { name: 'number', placeholder: 'Room number', required: true },
                { name: 'type', placeholder: 'Type (General/Private/ICU)', required: true },
            ]} />

            {/* Create Bed */}
            <CreateRow title="New Bed" onSubmit={async (f) => { await createBed(f); await load() }} fields={[
                { name: 'room_id', type: 'select', options: rooms.map(r => ({ value: r.id, label: `Ward ${r.ward_id} • Room ${r.number} (${r.type})` })), required: true },
                { name: 'code', placeholder: 'Bed code', required: true },
            ]} />

            {/* Lists */}
            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <div className="text-sm font-medium mb-2">Wards</div>
                    <SimpleTable items={wards} cols={[['code'], ['name'], ['floor']]} onDelete={async (id) => { await deleteWard(id); await load() }} />
                </div>
                <div>
                    <div className="text-sm font-medium mb-2">Rooms</div>
                    <SimpleTable items={rooms} cols={[['ward_id', 'Ward'], ['number', 'Room'], ['type', 'Type']]} onDelete={async (id) => { await deleteRoom(id); await load() }} />
                </div>
                <div>
                    <div className="text-sm font-medium mb-2">Beds</div>
                    <SimpleTable items={beds} cols={[['room_id', 'RoomId'], ['code', 'Code'], ['state', 'State']]} onDelete={async (id) => { await deleteBed(id); await load() }} />
                </div>
            </div>
        </div>
    )
}

function Packages() {
    const [rows, setRows] = useState([])
    const load = async () => { const { data } = await listPackages(); setRows(data || []) }
    useEffect(() => { load() }, [])
    return (
        <div className="rounded-xl border bg-white p-3 space-y-3 text-black">
            <div className="font-medium">Packages</div>
            <CreateRow title="New Package" onSubmit={async (f) => { await createPackage(f); await load() }} fields={[
                { name: 'name', placeholder: 'Name', required: true },
                { name: 'included', placeholder: 'Included' },
                { name: 'excluded', placeholder: 'Excluded' },
                { name: 'charges', placeholder: 'Charges', type: 'number' },
            ]} />
            <SimpleTable items={rows} cols={[['name'], ['charges'], ['included'], ['excluded']]} onDelete={async (id) => { await deletePackage(id); await load() }} />
        </div>
    )
}

function BedRates() {
    const [rows, setRows] = useState([])
    const load = async () => { const { data } = await listBedRates(); setRows(data || []) }
    useEffect(() => { load() }, [])
    return (
        <div className="rounded-xl border bg-white p-3 space-y-3 text-black">
            <div className="font-medium">Bed Rates</div>
            <CreateRow title="New Bed Rate" onSubmit={async (f) => { await createBedRate(f); await load() }} fields={[
                { name: 'room_type', placeholder: 'General/Private/ICU', required: true },
                { name: 'daily_rate', placeholder: 'Daily rate', type: 'number', required: true },
                { name: 'effective_from', type: 'date', required: true },
                { name: 'effective_to', type: 'date' },
            ]} />
            <SimpleTable items={rows} cols={[['room_type', 'Room'], ['daily_rate', 'Rate'], ['effective_from', 'From'], ['effective_to', 'To'], ['is_active', 'Active']]} onDelete={async (id) => { await deleteBedRate(id); await load() }} />
        </div>
    )
}

function CreateRow({ title, fields, onSubmit }) {
    const [f, setF] = useState({})
    const submit = async (e) => {
        e.preventDefault()
        const payload = { ...f }
        Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k])
        await onSubmit(payload); setF({})
    }
    return (
        <form onSubmit={submit} className="rounded-lg border bg-gray-50 p-3 grid gap-3 md:grid-cols-4">
            <div className="md:col-span-4 text-sm font-medium">{title}</div>
            {fields.map((fld) => fld.type === 'select' ? (
                <select key={fld.name} className="input" value={f[fld.name] || ''} onChange={e => setF(s => ({ ...s, [fld.name]: e.target.value }))} required={fld.required}>
                    <option value="">{fld.placeholder || 'Select'}</option>
                    {fld.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            ) : (
                <input key={fld.name} className="input" type={fld.type || 'text'} placeholder={fld.placeholder || fld.name} value={f[fld.name] || ''} onChange={e => setF(s => ({ ...s, [fld.name]: e.target.value }))} required={fld.required} />
            ))}
            <div className="md:col-span-4 flex justify-end">
                <button className="btn">Save</button>
            </div>
        </form>
    )
}

function SimpleTable({ items = [], cols = [], onDelete }) {
    return (
        <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-xs text-gray-500 bg-gray-50">
                        {cols.map(([k, label]) => <th key={k} className="px-3 py-2">{label || k}</th>)}
                        <th className="px-3 py-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(it => (
                        <tr className="border-t" key={it.id}>
                            {cols.map(([k]) => <td key={k} className="px-3 py-2">{String(it[k] ?? '—')}</td>)}
                            <td className="px-3 py-2">
                                <button className="btn btn-sm bg-rose-600 hover:bg-rose-700" onClick={() => onDelete(it.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                    {!items.length && <tr><td className="p-3 text-sm text-gray-500" colSpan={cols.length + 1}>No items</td></tr>}
                </tbody>
            </table>
        </div>
    )
}
