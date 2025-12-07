
// FILE: src/ipd/Bedboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { listWards, listRooms, listBeds, setBedState } from '../api/ipd'
import {
    Search,
    Loader2,
    AlertCircle,
    RotateCcw,
    BedDouble,
    Building2,
    DoorClosed,
    CheckCircle2,
} from 'lucide-react'

export default function BedBoard() {
    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const [dialog, setDialog] = useState(null) // { id, code, action, dt, note }
    const [search, setSearch] = useState('')
    const [saving, setSaving] = useState(false)
    const [dialogErr, setDialogErr] = useState('')

    const load = async () => {
        setLoading(true)
        setErr('')
        try {
            const [w, r, b] = await Promise.all([
                listWards(),
                listRooms(),
                listBeds(),
            ])
            setWards(w.data || [])
            setRooms(r.data || [])
            setBeds(b.data || [])
        } catch (e) {
            setErr(e?.response?.data?.detail || 'Failed to load bedboard.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const wardRooms = useMemo(() => {
        const map = {}
        rooms.forEach((r) => {
            ; (map[r.ward_id] ||= []).push(r)
        })
        return map
    }, [rooms])

    const roomBeds = useMemo(() => {
        const map = {}
        beds.forEach((b) => {
            ; (map[b.room_id] ||= []).push(b)
        })
        return map
    }, [beds])

    const StateBadge = ({ s }) => {
        const cls =
            s === 'vacant'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : s === 'occupied'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : s === 'reserved'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : s === 'preoccupied'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'

        return (
            <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] capitalize ${cls}`}
            >
                {s || 'unknown'}
            </span>
        )
    }

    const bedCardClass = (state) => {
        if (state === 'vacant')
            return 'border-emerald-200 bg-emerald-50/60'
        if (state === 'occupied')
            return 'border-rose-200 bg-rose-50/70'
        if (state === 'reserved')
            return 'border-amber-200 bg-amber-50/70'
        if (state === 'preoccupied')
            return 'border-sky-200 bg-sky-50/70'
        return 'border-slate-200 bg-white'
    }

    const quickAction = (id, code, action) => {
        setDialog({ id, code, action, dt: '', note: '' })
        setDialogErr('')
    }

    const doSet = async () => {
        if (!dialog) return
        setDialogErr('')

        if (dialog.action === 'reserved' && !dialog.dt) {
            setDialogErr('Please select a "Reserved until" date & time.')
            return
        }

        try {
            setSaving(true)
            const payload = { state: dialog.action }
            if (dialog.action === 'reserved') {
                payload.reserved_until = dialog.dt
                    ? dialog.dt.length === 16
                        ? `${dialog.dt}:00`
                        : dialog.dt
                    : null
            }
            if (dialog.note) payload.note = dialog.note
            await setBedState(dialog.id, payload)
            setDialog(null)
            await load()
        } catch (e) {
            setDialogErr(
                e?.response?.data?.detail || 'Failed to update bed state.'
            )
        } finally {
            setSaving(false)
        }
    }

    // Search filter across ward / room / bed / state
    const q = search.trim().toLowerCase()

    const filteredWardIds = useMemo(() => {
        if (!q) return wards.map((w) => w.id)
        const ids = new Set()

        wards.forEach((w) => {
            const wardMatch =
                w.code?.toLowerCase().includes(q) ||
                w.name?.toLowerCase().includes(q)

            const wRooms = wardRooms[w.id] || []
            let hasMatch = wardMatch

            wRooms.forEach((r) => {
                const roomMatch =
                    String(r.number || '')
                        .toLowerCase()
                        .includes(q) || String(r.type || '').toLowerCase().includes(q)

                const rBeds = roomBeds[r.id] || []
                const bedMatch = rBeds.some((b) => {
                    const state = (b.state || '').toLowerCase()
                    return (
                        b.code?.toLowerCase().includes(q) ||
                        state.includes(q)
                    )
                })

                if (roomMatch || bedMatch) hasMatch = true
            })

            if (hasMatch) ids.add(w.id)
        })

        return Array.from(ids)
    }, [q, wards, wardRooms, roomBeds])

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-4 text-black md:px-6 md:py-6">
            {/* Header + description */}
            <div className="mx-auto mb-4 flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                        Bedboard
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">
                        Live overview of <span className="font-semibold">IPD bed occupancy</span>{' '}
                        by ward and room. Colours help you quickly spot which beds are
                        vacant, occupied, reserved or preoccupied. Use the quick actions
                        to reserve or vacate beds in real time.
                    </p>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="leading-tight text-emerald-800">
                            <span className="font-semibold">Vacant</span>
                            <br />
                            Ready to allocate
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        <span className="leading-tight text-rose-800">
                            <span className="font-semibold">Occupied</span>
                            <br />
                            Patient in bed
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="leading-tight text-amber-800">
                            <span className="font-semibold">Reserved</span>
                            <br />
                            Booked for patient
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        <span className="leading-tight text-sky-800">
                            <span className="font-semibold">Preoccupied</span>
                            <br />
                            Pending admission
                        </span>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-6xl space-y-4">
                {/* Search + refresh */}
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="w-full md:max-w-md">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                placeholder="Search by ward, room, bed code or state (vacant, occupied, reserved)…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                            Example: type <span className="font-mono">VACANT</span>, ward code like{' '}
                            <span className="font-mono">W1</span>, or bed code like{' '}
                            <span className="font-mono">B-102</span>.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-700">
                            <BedDouble className="h-3.5 w-3.5 text-slate-500" />
                            <span>
                                Total beds:{' '}
                                <span className="font-semibold text-slate-900">
                                    {beds.length}
                                </span>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={load}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Error / loading */}
                {err && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <span>{err}</span>
                    </div>
                )}

                {loading && !beds.length && (
                    <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-10 text-sm text-slate-600 shadow-sm">
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            Loading bedboard…
                        </span>
                    </div>
                )}

                {/* Ward / room / bed grid */}
                {!loading && (
                    <div className="space-y-4">
                        {wards
                            .filter((w) => filteredWardIds.includes(w.id))
                            .map((w) => (
                                <div
                                    key={w.id}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                                >
                                    {/* Ward header */}
                                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                                        <Building2 className="h-4 w-4 text-slate-500" />
                                        <span>
                                            {w.code} — {w.name}
                                        </span>
                                    </div>

                                    {/* Rooms */}
                                    {(wardRooms[w.id] || []).length === 0 ? (
                                        <div className="px-3 py-3 text-sm text-slate-500">
                                            No rooms configured for this ward.
                                        </div>
                                    ) : (
                                        (wardRooms[w.id] || []).map((r) => {
                                            const bedsForRoom = (roomBeds[r.id] || []).filter(
                                                (b) => {
                                                    if (!q) return true
                                                    const state = (b.state || '').toLowerCase()
                                                    return (
                                                        b.code?.toLowerCase().includes(q) ||
                                                        state.includes(q)
                                                    )
                                                }
                                            )

                                            if (!bedsForRoom.length && q) {
                                                // If searching, hide rooms without matching beds
                                                const roomMatch =
                                                    String(r.number || '')
                                                        .toLowerCase()
                                                        .includes(q) ||
                                                    String(r.type || '')
                                                        .toLowerCase()
                                                        .includes(q)
                                                if (!roomMatch) return null
                                            }

                                            return (
                                                <div
                                                    key={r.id}
                                                    className="border-t border-slate-100 px-3 py-3"
                                                >
                                                    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-600">
                                                        <div className="flex items-center gap-2">
                                                            <DoorClosed className="h-3.5 w-3.5 text-slate-400" />
                                                            <span className="font-medium">
                                                                Room {r.number}
                                                            </span>
                                                            <span className="text-[11px] text-slate-500">
                                                                • {r.type}
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] text-slate-500">
                                                            Beds: {roomBeds[r.id]?.length || 0}
                                                        </span>
                                                    </div>

                                                    {/* Beds for this room */}
                                                    {bedsForRoom.length === 0 ? (
                                                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                                                            No beds match your search in this room.
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {bedsForRoom.map((b) => (
                                                                <div
                                                                    key={b.id}
                                                                    className={`flex w-full flex-col justify-between rounded-2xl border px-3 py-2 text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[calc(50%-0.25rem)] lg:w-[calc(25%-0.375rem)] ${bedCardClass(
                                                                        b.state
                                                                    )}`}
                                                                >
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="font-semibold text-slate-900">
                                                                            {b.code}
                                                                        </div>
                                                                        <StateBadge s={b.state} />
                                                                    </div>

                                                                    {b.note && (
                                                                        <div className="mt-1 text-[11px] text-slate-600 line-clamp-2">
                                                                            {b.note}
                                                                        </div>
                                                                    )}

                                                                    {b.reserved_until && (
                                                                        <div className="mt-1 text-[11px] text-slate-500">
                                                                            Reserved until:{' '}
                                                                            {new Date(
                                                                                b.reserved_until
                                                                            ).toLocaleString()}
                                                                        </div>
                                                                    )}

                                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex flex-1 items-center justify-center rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                                                                            onClick={() =>
                                                                                quickAction(
                                                                                    b.id,
                                                                                    b.code,
                                                                                    'reserved'
                                                                                )
                                                                            }
                                                                        >
                                                                            Reserve
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex flex-1 items-center justify-center rounded-full bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
                                                                            onClick={() =>
                                                                                quickAction(
                                                                                    b.id,
                                                                                    b.code,
                                                                                    'preoccupied'
                                                                                )
                                                                            }
                                                                        >
                                                                            Preoccupy
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                                                                            onClick={() =>
                                                                                quickAction(
                                                                                    b.id,
                                                                                    b.code,
                                                                                    'vacant'
                                                                                )
                                                                            }
                                                                        >
                                                                            Vacate
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            ))}

                        {!loading && filteredWardIds.length === 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                                No beds match your search. Try clearing the filter or
                                searching with a different ward, room or bed code.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Dialog for bed state change */}
            {dialog && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-4 text-sm shadow-xl">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Update bed state
                                </div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {dialog.code} → {dialog.action}
                                </div>
                            </div>
                            <StateBadge s={dialog.action} />
                        </div>

                        {dialog.action === 'reserved' && (
                            <div className="mt-2 space-y-1">
                                <label className="text-xs text-slate-500">
                                    Reserved until
                                </label>
                                <input
                                    type="datetime-local"
                                    className="input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                    value={dialog.dt}
                                    onChange={(e) =>
                                        setDialog((d) => ({
                                            ...d,
                                            dt: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        )}

                        <div className="mt-3 space-y-1">
                            <label className="text-xs text-slate-500">
                                Note (optional)
                            </label>
                            <input
                                className="input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                placeholder="Reason for change, patient reference, etc."
                                value={dialog.note}
                                onChange={(e) =>
                                    setDialog((d) => ({
                                        ...d,
                                        note: e.target.value,
                                    }))
                                }
                            />
                        </div>

                        {dialogErr && (
                            <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                <AlertCircle className="mt-0.5 h-4 w-4" />
                                <span>{dialogErr}</span>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                onClick={() => setDialog(null)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={doSet}
                                disabled={saving}
                            >
                                {saving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
