// frontend/src/ipd/components/WardRoomBedPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { listWards, listRooms, listBeds } from '../../api/ipd'
import {
    Building2,
    DoorClosed,
    BedDouble,
    Loader2,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

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

    const [wardId, setWardId] = useState('') // '' => none
    const [roomId, setRoomId] = useState('') // '' => none

    const [loadingWards, setLoadingWards] = useState(false)
    const [loadingRooms, setLoadingRooms] = useState(false)
    const [loadingBeds, setLoadingBeds] = useState(false)
    const [err, setErr] = useState('')

    // ---------- Load wards on mount ----------
    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoadingWards(true)
                setErr('')
                try {
                    const { data } = await listWards()
                    if (!alive) return
                    setWards(data || [])
                } catch (e) {
                    if (!alive) return
                    console.error('listWards error', e)
                    setErr(e?.response?.data?.detail || 'Failed to load wards. Please refresh and try again.')
                    setWards([])
                } finally {
                    alive && setLoadingWards(false)
                }
            })()
        return () => {
            alive = false
        }
    }, [])

    // ---------- When ward changes: reset room & beds, notify parent (bed cleared), load rooms ----------
    useEffect(() => {
        let alive = true

        setRooms([])
        setRoomId('')
        setBeds([])
        setErr('')
        onChange?.(null)

        if (!wardId) return

            ; (async () => {
                setLoadingRooms(true)
                try {
                    const { data } = await listRooms({ ward_id: Number(wardId) })
                    if (!alive) return
                    setRooms(data || [])
                } catch (e) {
                    if (!alive) return
                    console.error('listRooms error', e)
                    setErr(e?.response?.data?.detail || 'Failed to load rooms for this ward.')
                    setRooms([])
                } finally {
                    alive && setLoadingRooms(false)
                }
            })()

        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wardId])

    // ---------- When room changes: reset beds, notify parent (bed cleared), load beds ----------
    useEffect(() => {
        let alive = true

        setBeds([])
        setErr('')
        onChange?.(null)

        if (!roomId) return

            ; (async () => {
                setLoadingBeds(true)
                try {
                    const { data } = await listBeds({ room_id: Number(roomId) })
                    if (!alive) return
                    setBeds(data || [])
                } catch (e) {
                    if (!alive) return
                    console.error('listBeds error', e)
                    setErr(e?.response?.data?.detail || 'Failed to load beds for this room.')
                    setBeds([])
                } finally {
                    alive && setLoadingBeds(false)
                }
            })()

        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId])

    const selectedBed = useMemo(() => {
        const idNum = value ? Number(value) : null
        if (!idNum) return null
        return beds.find((b) => b.id === idNum) || null
    }, [beds, value])

    // Radix Select needs string values
    const wardSelectValue = wardId ? String(wardId) : 'none'
    const roomSelectValue = roomId ? String(roomId) : 'none'
    const bedSelectValue = value ? String(value) : 'none'

    const wardDisabled = loadingWards
    const roomDisabled = !wardId || loadingRooms || wards.length === 0
    const bedDisabled = !roomId || loadingBeds || rooms.length === 0

    const commonTrigger =
        'h-10 w-full rounded-2xl border border-black/10 bg-white/90 px-3 text-[12px] font-semibold text-slate-900 shadow-sm ' +
        'focus:border-sky-500 focus:ring-2 focus:ring-sky-100'

    const contentCls =
        'z-[200] w-[--radix-select-trigger-width] max-h-[280px] overflow-auto ' +
        'rounded-2xl border border-black/10 bg-white/95 backdrop-blur-xl p-1 ' +
        'shadow-[0_18px_40px_rgba(2,6,23,0.18)]'

    return (
        <div className="space-y-3">
            {/* Header + helper text */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Bed Allocation
                    </span>
                    <span className="text-sm font-medium text-slate-900">{label}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                    Select ward, then room, then an available bed for this admission.
                </p>
            </div>

            {/* Ward / Room / Bed */}
            <div className="grid gap-3 md:grid-cols-3">
                {/* Ward */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">Ward</span>
                    </div>

                    <div className="relative">
                        {loadingWards && (
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}

                        <Select
                            value={wardSelectValue}
                            onValueChange={(v) => setWardId(v === 'none' ? '' : v)}
                            disabled={wardDisabled}
                        >
                            <SelectTrigger className={commonTrigger}>
                                <SelectValue
                                    placeholder={loadingWards ? 'Loading wards…' : 'Select ward'}
                                />
                            </SelectTrigger>

                            <SelectContent position="popper" sideOffset={6} className={contentCls}>
                                <SelectItem value="none" className="text-[12px] font-semibold">
                                    {loadingWards ? 'Loading wards…' : 'Select ward'}
                                </SelectItem>

                                {wards.map((w) => (
                                    <SelectItem
                                        key={w.id}
                                        value={String(w.id)}
                                        className="text-[12px] whitespace-normal break-words leading-snug"
                                    >
                                        {w.code} — {w.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}

                        <Select
                            value={roomSelectValue}
                            onValueChange={(v) => setRoomId(v === 'none' ? '' : v)}
                            disabled={roomDisabled}
                        >
                            <SelectTrigger className={commonTrigger + (roomDisabled ? ' opacity-60' : '')}>
                                <SelectValue
                                    placeholder={
                                        !wardId
                                            ? 'Select ward first'
                                            : loadingRooms
                                                ? 'Loading rooms…'
                                                : rooms.length === 0
                                                    ? 'No rooms in this ward'
                                                    : 'Select room'
                                    }
                                />
                            </SelectTrigger>

                            <SelectContent position="popper" sideOffset={6} className={contentCls}>
                                <SelectItem value="none" className="text-[12px] font-semibold">
                                    {!wardId
                                        ? 'Select ward first'
                                        : loadingRooms
                                            ? 'Loading rooms…'
                                            : rooms.length === 0
                                                ? 'No rooms in this ward'
                                                : 'Select room'}
                                </SelectItem>

                                {rooms.map((r) => (
                                    <SelectItem
                                        key={r.id}
                                        value={String(r.id)}
                                        className="text-[12px] whitespace-normal break-words leading-snug"
                                    >
                                        {r.number} • {r.type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}

                        <Select
                            value={bedSelectValue}
                            onValueChange={(v) => onChange?.(v === 'none' ? null : Number(v))}
                            disabled={bedDisabled}
                        >
                            <SelectTrigger className={commonTrigger + (bedDisabled ? ' opacity-60' : '')}>
                                <SelectValue
                                    placeholder={
                                        !roomId
                                            ? 'Select room first'
                                            : loadingBeds
                                                ? 'Loading beds…'
                                                : beds.length === 0
                                                    ? 'No beds in this room'
                                                    : 'Select bed'
                                    }
                                />
                            </SelectTrigger>

                            <SelectContent position="popper" sideOffset={6} className={contentCls}>
                                <SelectItem value="none" className="text-[12px] font-semibold">
                                    {!roomId
                                        ? 'Select room first'
                                        : loadingBeds
                                            ? 'Loading beds…'
                                            : beds.length === 0
                                                ? 'No beds in this room'
                                                : 'Select bed'}
                                </SelectItem>

                                {beds.map((b) => (
                                    <SelectItem
                                        key={b.id}
                                        value={String(b.id)}
                                        className="text-[12px] whitespace-normal break-words leading-snug"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate">{b.code}</span>
                                            {b.state && b.state !== 'vacant' ? (
                                                <span className="shrink-0 rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                                    {b.state}
                                                </span>
                                            ) : null}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Selected bed summary */}
            {selectedBed && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-semibold">Selected bed:</span>
                    <span className="font-medium">{selectedBed.code}</span>
                    {selectedBed.state && <span className="text-emerald-700">· {selectedBed.state}</span>}
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
