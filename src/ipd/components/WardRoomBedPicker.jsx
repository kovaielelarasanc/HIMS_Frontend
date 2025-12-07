
// frontend/src/ipd/components/WardRoomBedPicker.jsx
import { useEffect, useMemo, useState } from 'react';
import { listWards, listRooms, listBeds } from '../../api/ipd'
import {
    Building2,
    DoorClosed,
    BedDouble,
    Loader2,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react'

/**
 * Props:
 *   value: bed_id (number | null | '')
 *   onChange: (bedId: number | null) => void
 */
export default function WardRoomBedPicker({
    value,
    onChange,
    label = 'Allocate Bed (Ward → Room → Bed)',
}) {
    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])

    const [wardId, setWardId] = useState('') // string for <select>
    const [roomId, setRoomId] = useState('') // string for <select>

    const [loadingWards, setLoadingWards] = useState(false)
    const [loadingRooms, setLoadingRooms] = useState(false)
    const [loadingBeds, setLoadingBeds] = useState(false)
    const [err, setErr] = useState('')

    // ---------- Load wards on mount ----------
    useEffect(() => {
        let alive = true
        const run = async () => {
            setLoadingWards(true)
            setErr('')
            try {
                const { data } = await listWards()
                if (!alive) return
                setWards(data || [])
            } catch (e) {
                if (!alive) return
                console.error('listWards error', e)
                setErr(
                    e?.response?.data?.detail ||
                        'Failed to load wards. Please refresh and try again.'
                )
                setWards([])
            } finally {
                alive && setLoadingWards(false)
            }
        }
        run()
        return () => {
            alive = false
        }
    }, [])

    // ---------- When ward changes: reset room & beds, notify parent (bed cleared), load rooms ----------
    useEffect(() => {
        let alive = true

        // clear dependent state
        setRooms([])
        setRoomId('')
        setBeds([])
        setErr('')

        // bed is no longer valid for new ward
        onChange?.(null)

        if (!wardId) return

        const run = async () => {
            setLoadingRooms(true)
            try {
                const { data } = await listRooms({ ward_id: Number(wardId) })
                if (!alive) return
                setRooms(data || [])
            } catch (e) {
                if (!alive) return
                console.error('listRooms error', e)
                setErr(
                    e?.response?.data?.detail ||
                        'Failed to load rooms for this ward.'
                )
                setRooms([])
            } finally {
                alive && setLoadingRooms(false)
            }
        }
        run()

        return () => {
            alive = false
        }
        // ⚠️ Do NOT include `onChange` here, or it will keep resetting.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wardId])

    // ---------- When room changes: reset beds, notify parent (bed cleared), load beds ----------
    useEffect(() => {
        let alive = true

        setBeds([])
        setErr('')
        onChange?.(null)

        if (!roomId) return

        const run = async () => {
            setLoadingBeds(true)
            try {
                const { data } = await listBeds({ room_id: Number(roomId) })
                if (!alive) return
                setBeds(data || [])
            } catch (e) {
                if (!alive) return
                console.error('listBeds error', e)
                setErr(
                    e?.response?.data?.detail ||
                        'Failed to load beds for this room.'
                )
                setBeds([])
            } finally {
                alive && setLoadingBeds(false)
            }
        }
        run()

        return () => {
            alive = false
        }
        // ⚠️ Same reason: keep deps only on roomId.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId])

    const selectedBed = useMemo(() => {
        const idNum = value ? Number(value) : null
        if (!idNum) return null
        return beds.find((b) => b.id === idNum) || null
    }, [beds, value])

    const handleWardChange = (e) => {
        setWardId(e.target.value)
    }

    const handleRoomChange = (e) => {
        setRoomId(e.target.value)
    }

    const handleBedChange = (e) => {
        const val = e.target.value
        const num = val ? Number(val) : null
        onChange?.(num)
    }

    return (
        <div className="space-y-3">
            {/* Header + helper text */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Bed Allocation
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                        {label}
                    </span>
                </div>
                <p className="text-[11px] text-slate-500">
                    Select ward, then room, then an available bed for this admission.
                </p>
            </div>

            {/* Ward / Room / Bed selects */}
            <div className="grid gap-3 md:grid-cols-3">
                {/* Ward */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">Ward</span>
                    </div>
                    <div className="relative">
                        {loadingWards && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}
                        <select
                            className="input w-full rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            value={wardId}
                            onChange={handleWardChange}
                            disabled={loadingWards}
                        >
                            <option value="">
                                {loadingWards ? 'Loading wards…' : 'Select ward'}
                            </option>
                            {wards.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.code} — {w.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Room */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <DoorClosed className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">Room</span>
                    </div>
                    <div className="relative">
                        {loadingRooms && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}
                        <select
                            className="input w-full rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            value={roomId}
                            onChange={handleRoomChange}
                            disabled={!wardId || loadingRooms || wards.length === 0}
                        >
                            <option value="">
                                {!wardId
                                    ? 'Select ward first'
                                    : loadingRooms
                                    ? 'Loading rooms…'
                                    : rooms.length === 0
                                    ? 'No rooms in this ward'
                                    : 'Select room'}
                            </option>
                            {rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.number} • {r.type}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Bed */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <BedDouble className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">Bed</span>
                    </div>
                    <div className="relative">
                        {loadingBeds && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}
                        <select
                            className="input w-full rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            value={value || ''}
                            onChange={handleBedChange}
                            disabled={!roomId || loadingBeds || rooms.length === 0}
                        >
                            <option value="">
                                {!roomId
                                    ? 'Select room first'
                                    : loadingBeds
                                    ? 'Loading beds…'
                                    : beds.length === 0
                                    ? 'No beds in this room'
                                    : 'Select bed'}
                            </option>
                            {beds.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.code}
                                    {b.state && b.state !== 'vacant'
                                        ? ` • ${b.state}`
                                        : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Selected bed summary */}
            {selectedBed && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-semibold">Selected bed:</span>
                    <span className="font-medium">{selectedBed.code}</span>
                    {selectedBed.state && (
                        <span className="text-emerald-700">· {selectedBed.state}</span>
                    )}
                </div>
            )}

            {/* Error bar */}
            {err && (
                <div className="mt-1 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{err}</span>
                </div>
            )}
        </div>
    )
}
