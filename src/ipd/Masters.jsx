// FILE: src/ipd/Masters.jsx
import { useEffect, useMemo, useState } from 'react'
import PermGate from '../components/PermGate'
import {
    listWards,
    createWard,
    deleteWard,
    listRooms,
    createRoom,
    deleteRoom,
    listBeds,
    createBed,
    deleteBed,
    listPackages,
    createPackage,
    deletePackage,
    listBedRates,
    createBedRate,
    deleteBedRate,
} from '../api/ipd'
import {
    Building2,
    BedDouble,
    Loader2,
    Trash2,
    AlertCircle,
    Filter,
} from 'lucide-react'
import { motion } from 'framer-motion'

// ----------------------------------------------
// CONSTANTS
// ----------------------------------------------

const PREDEFINED_ROOM_TYPES = [
    'General Ward',
    'Semi-Private',
    'Private',
    'Deluxe',
    'Suite',
    'ICU',
    'HDU',
    'PICU',
    'NICU',
    'Isolation Room',
    'Day Care',
    'Observation',
    'Emergency / ER',
]

// small animation preset
const fadeIn = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18 },
}

// ----------------------------------------------
// ROOT COMPONENT
// ----------------------------------------------

export default function Masters() {
    return (
        <PermGate anyOf={['ipd.masters.manage', 'ipd.packages.manage']}>
            <div className="min-h-screen bg-slate-50 px-3 py-3 text-black md:px-6 md:py-6">
                <motion.div
                    {...fadeIn}
                    className="mx-auto flex max-w-6xl flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm md:px-4 md:py-4"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
                            <BedDouble className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">
                                IPD Masters – Wards · Rooms · Beds · Packages
                            </h1>
                            <p className="text-[11px] text-slate-600 md:text-xs">
                                Configure your in-patient structure and tariffs. These
                                settings drive Admission, Bedboard, Billing and Bed
                                Occupancy flows.
                            </p>
                        </div>
                        <div className="hidden gap-2 text-[11px] md:flex">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                Admin only
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                                Live impact on Billing & IPD
                            </span>
                        </div>
                    </div>
                </motion.div>

                <div className="mx-auto mt-4 flex max-w-6xl flex-col gap-5">
                    <WardRoomBed />
                    <BedRates />
                    <Packages />
                </div>
            </div>
        </PermGate>
    )
}

// ----------------------------------------------
// WARD · ROOM · BED MANAGEMENT
// ----------------------------------------------

function WardRoomBed() {
    const [wards, setWards] = useState([])
    const [rooms, setRooms] = useState([])
    const [beds, setBeds] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // small filters for better UX
    const [bedStateFilter, setBedStateFilter] = useState('all') // all | vacant | occupied | reserved | cleaning
    const [bedSearch, setBedSearch] = useState('')
    const [wardSearch, setWardSearch] = useState('')
    const [roomSearch, setRoomSearch] = useState('')

    const load = async () => {
        setLoading(true)
        setError('')
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
            setError(
                e?.response?.data?.detail ||
                'Failed to load ward/room/bed data.'
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const derivedRoomTypes = useMemo(
        () =>
            Array.from(
                new Set(
                    (rooms || [])
                        .map((r) => r.type)
                        .filter(Boolean)
                        .map((x) => x.trim())
                )
            ),
        [rooms],
    )

    const allRoomTypes = useMemo(
        () =>
            Array.from(
                new Set([
                    ...PREDEFINED_ROOM_TYPES,
                    ...derivedRoomTypes,
                ]),
            ),
        [derivedRoomTypes],
    )

    // apply filters for beds, wards, rooms (mobile friendly)
    const filteredWards = useMemo(() => {
        if (!wardSearch.trim()) return wards
        const q = wardSearch.toLowerCase()
        return wards.filter(
            (w) =>
                String(w.code || '').toLowerCase().includes(q) ||
                String(w.name || '').toLowerCase().includes(q) ||
                String(w.floor || '').toLowerCase().includes(q),
        )
    }, [wards, wardSearch])

    const filteredRooms = useMemo(() => {
        if (!roomSearch.trim()) return rooms
        const q = roomSearch.toLowerCase()
        return rooms.filter(
            (r) =>
                String(r.number || '').toLowerCase().includes(q) ||
                String(r.type || '').toLowerCase().includes(q) ||
                String(r.ward_id || '').toLowerCase().includes(q),
        )
    }, [rooms, roomSearch])

    const filteredBeds = useMemo(() => {
        let res = beds
        if (bedStateFilter !== 'all') {
            res = res.filter(
                (b) =>
                    String(b.state || '')
                        .toLowerCase() === bedStateFilter,
            )
        }
        if (bedSearch.trim()) {
            const q = bedSearch.toLowerCase()
            res = res.filter(
                (b) =>
                    String(b.code || '').toLowerCase().includes(q) ||
                    String(b.room_id || '').toLowerCase().includes(q),
            )
        }
        return res
    }, [beds, bedStateFilter, bedSearch])

    return (
        <motion.section
            {...fadeIn}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
                        <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 md:text-base">
                            Wards · Rooms · Beds
                        </h2>
                        <p className="text-[11px] text-slate-600 md:text-xs">
                            Define physical layout of the IPD. Room type drives bed
                            tariffs, occupancy dashboard and billing logic.
                        </p>
                    </div>
                </div>

                {/* Quick room-type chips (top-right) */}
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    {allRoomTypes.slice(0, 5).map((t) => (
                        <RoomTypeChip key={t} type={t} />
                    ))}
                    {allRoomTypes.length > 5 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                            +{allRoomTypes.length - 5} more
                        </span>
                    )}
                </div>
            </div>

            {error && <ErrorBanner message={error} />}

            {/* CREATE FORMS */}
            <div className="space-y-3">
                <CreateRow
                    title="New Ward"
                    description="Create a new ward or block (e.g. GW Block, ICU Block, Labour Ward)."
                    fields={[
                        {
                            name: 'code',
                            label: 'Ward code',
                            placeholder: 'e.g. GW-1',
                            required: true,
                        },
                        {
                            name: 'name',
                            label: 'Ward name',
                            placeholder: 'e.g. General Ward Block 1',
                            required: true,
                        },
                        {
                            name: 'floor',
                            label: 'Floor / Level',
                            placeholder: 'e.g. 1st Floor',
                        },
                    ]}
                    onSubmit={async (f) => {
                        await createWard(f)
                        await load()
                    }}
                />

                <RoomCreateForm
                    wards={wards}
                    allRoomTypes={allRoomTypes}
                    onCreated={load}
                />

                <CreateRow
                    title="New Bed"
                    description="Add individual beds to rooms. Bed codes should be intuitive (e.g. GW-101-A)."
                    fields={[
                        {
                            name: 'room_id',
                            label: 'Room',
                            type: 'select',
                            required: true,
                            options: rooms.map((r) => ({
                                value: r.id,
                                label: `Ward ${r.ward_id} • Room ${r.number} (${r.type || 'Unspecified'})`,
                            })),
                            placeholder: 'Select room',
                        },
                        {
                            name: 'code',
                            label: 'Bed code',
                            placeholder: 'e.g. GW-101-A',
                            required: true,
                        },
                    ]}
                    onSubmit={async (f) => {
                        await createBed(f)
                        await load()
                    }}
                />
            </div>

            {/* FILTER STRIP FOR LISTS */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-700">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-1 font-medium">
                        <Filter className="h-3.5 w-3.5" />
                        Quick filters
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-slate-500">Ward:</span>
                            <input
                                className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Search code / name…"
                                value={wardSearch}
                                onChange={(e) => setWardSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-slate-500">Room:</span>
                            <input
                                className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Search number / type…"
                                value={roomSearch}
                                onChange={(e) => setRoomSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                            <span className="text-slate-500">Beds:</span>
                            <input
                                className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Search bed code…"
                                value={bedSearch}
                                onChange={(e) => setBedSearch(e.target.value)}
                            />
                            <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
                                {['all', 'vacant', 'occupied', 'reserved'].map(
                                    (key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() =>
                                                setBedStateFilter(key)
                                            }
                                            className={`px-2.5 py-1 text-[10px] capitalize rounded-full transition ${bedStateFilter === key
                                                    ? 'bg-slate-900 text-white shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {key}
                                        </button>
                                    ),
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* LISTS */}
            <div className="grid gap-6 md:grid-cols-3">
                <ListCard
                    title="Wards"
                    items={filteredWards}
                    cols={[
                        ['code', 'Code'],
                        ['name', 'Name'],
                        ['floor', 'Floor'],
                    ]}
                    onDelete={(id) => deleteWard(id).then(load)}
                />

                <ListCard
                    title="Rooms"
                    items={filteredRooms}
                    cols={[
                        ['ward_id', 'Ward ID'],
                        ['number', 'Room No'],
                        ['type', 'Room Type'],
                    ]}
                    renderValue={(key, val) =>
                        key === 'type' ? (
                            <RoomTypeChip type={val} />
                        ) : (
                            String(val ?? '—')
                        )
                    }
                    onDelete={(id) => deleteRoom(id).then(load)}
                />

                <ListCard
                    title="Beds"
                    items={filteredBeds}
                    cols={[
                        ['room_id', 'Room ID'],
                        ['code', 'Bed code'],
                        ['state', 'Status'],
                    ]}
                    renderValue={(key, val) =>
                        key === 'state' ? (
                            <BedStateChip state={val} />
                        ) : (
                            String(val ?? '—')
                        )
                    }
                    onDelete={(id) => deleteBed(id).then(load)}
                />
            </div>

            {loading && <LoadingBlock />}
        </motion.section>
    )
}

// Custom Room create form with room-type dropdown + custom option
function RoomCreateForm({ wards = [], allRoomTypes = [], onCreated }) {
    const [form, setForm] = useState({
        ward_id: '',
        number: '',
        typeChoice: '',
        customType: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
        if (error) setError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!form.ward_id || !form.number) {
            setError('Ward and Room number are required.')
            return
        }

        let finalType = ''
        if (form.typeChoice === '__custom') {
            if (!form.customType.trim()) {
                setError('Please enter a custom room type.')
                return
            }
            finalType = form.customType.trim()
        } else if (form.typeChoice) {
            finalType = form.typeChoice
        }

        setSubmitting(true)
        try {
            const payload = {
                ward_id: form.ward_id,
                number: form.number,
                type: finalType || undefined,
            }
            await createRoom(payload)
            setForm({
                ward_id: '',
                number: '',
                typeChoice: '',
                customType: '',
            })
            onCreated?.()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4"
        >
            <div className="md:col-span-4">
                <div className="text-sm font-medium text-slate-800">
                    New Room
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                    Link the room to a ward and assign a room type. You can also
                    create custom room types for special units.
                </p>
            </div>

            {/* Ward */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">Ward</label>
                <select
                    className="input rounded-xl"
                    value={form.ward_id}
                    onChange={(e) =>
                        handleChange('ward_id', e.target.value)
                    }
                    required
                >
                    <option value="">Select ward</option>
                    {wards.map((w) => (
                        <option key={w.id} value={w.id}>
                            {w.code} – {w.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Room No */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">Room number</label>
                <input
                    className="input rounded-xl"
                    placeholder="e.g. 101"
                    value={form.number}
                    onChange={(e) =>
                        handleChange('number', e.target.value)
                    }
                    required
                />
            </div>

            {/* Room type selector */}
            <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-slate-500">Room type</label>
                <select
                    className="input rounded-xl"
                    value={form.typeChoice}
                    onChange={(e) =>
                        handleChange('typeChoice', e.target.value)
                    }
                >
                    <option value="">
                        (Optional) Select room type
                    </option>
                    {PREDEFINED_ROOM_TYPES.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                    {allRoomTypes
                        .filter((t) => !PREDEFINED_ROOM_TYPES.includes(t))
                        .map((t) => (
                            <option key={t} value={t}>
                                {t} (existing)
                            </option>
                        ))}
                    <option value="__custom">Other (custom)</option>
                </select>

                {form.typeChoice === '__custom' && (
                    <input
                        className="input mt-2 rounded-xl"
                        placeholder="Enter custom room type (e.g. Chemotherapy Day Care)"
                        value={form.customType}
                        onChange={(e) =>
                            handleChange('customType', e.target.value)
                        }
                    />
                )}

                <p className="mt-1 text-[11px] text-slate-500">
                    Standard: General, Semi-Private, Private, Deluxe, ICU,
                    NICU, PICU, HDU, Isolation, Suite, Day Care, etc.
                </p>
            </div>

            {error && (
                <div className="md:col-span-4 text-xs text-rose-600">
                    {error}
                </div>
            )}

            <div className="md:col-span-4 flex justify-end">
                <button
                    type="submit"
                    className="btn min-w-[120px] font-semibold"
                    disabled={submitting}
                >
                    {submitting ? 'Saving…' : 'Save room'}
                </button>
            </div>
        </form>
    )
}

// ----------------------------------------------
// BED RATES MANAGEMENT (Daily + Hourly)
// ----------------------------------------------

function BedRates() {
    const [rows, setRows] = useState([])
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [basisFilter, setBasisFilter] = useState('all') // all | daily | hourly
    const [rateSearch, setRateSearch] = useState('')

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const [rateResp, roomsResp] = await Promise.all([
                listBedRates(),
                listRooms(),
            ])
            setRows(rateResp.data || [])
            setRooms(roomsResp.data || [])
        } catch (e) {
            setError(
                e?.response?.data?.detail || 'Failed to load bed rates.',
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const roomTypeOptions = useMemo(() => {
        const fromRooms = (rooms || [])
            .map((r) => r.type)
            .filter(Boolean)
            .map((x) => x.trim())
        const fromRates = (rows || [])
            .map((r) => parseRoomType(r.room_type).baseType)
            .filter(Boolean)
        return Array.from(
            new Set([
                ...PREDEFINED_ROOM_TYPES,
                ...fromRooms,
                ...fromRates,
            ]),
        )
    }, [rooms, rows])

    const filteredRows = useMemo(() => {
        let res = rows
        if (basisFilter !== 'all') {
            res = res.filter((r) => {
                const parsed = parseRoomType(r.room_type)
                const b = (parsed.basis || 'Daily').toLowerCase()
                return b === basisFilter
            })
        }
        if (rateSearch.trim()) {
            const q = rateSearch.toLowerCase()
            res = res.filter(
                (r) =>
                    String(r.room_type || '')
                        .toLowerCase()
                        .includes(q) ||
                    String(r.daily_rate || '')
                        .toLowerCase()
                        .includes(q),
            )
        }
        return res
    }, [rows, basisFilter, rateSearch])

    return (
        <motion.section
            {...fadeIn}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
        >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
                        <BedDouble className="h-4 w-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 md:text-base">
                            Bed Rates (Daily & Hourly)
                        </h2>
                        <p className="text-[11px] text-slate-600 md:text-xs">
                            Configure bed tariffs for each room type. Supports
                            daily and hourly tariffs for short-stay and day
                            care scenarios.
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                        <Filter className="h-3 w-3" />
                        <span>Tariff basis</span>
                        <div className="inline-flex rounded-full bg-white p-0.5">
                            {['all', 'daily', 'hourly'].map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() =>
                                        setBasisFilter(k)
                                    }
                                    className={`px-2.5 py-1 rounded-full capitalize transition ${basisFilter === k
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Search room type / tariff…"
                        value={rateSearch}
                        onChange={(e) =>
                            setRateSearch(e.target.value)
                        }
                    />
                </div>
            </div>

            {error && <ErrorBanner message={error} />}

            <BedRateCreateForm
                roomTypeOptions={roomTypeOptions}
                onCreated={load}
            />

            {/* Bed Rate listing: table on desktop, cards on mobile */}
            <ListCard
                title="Configured Bed Rates"
                items={filteredRows}
                cols={[
                    ['room_type', 'Room type'],
                    ['daily_rate', 'Tariff (₹)'],
                    ['effective_from', 'From'],
                    ['effective_to', 'To'],
                    ['is_active', 'Active'],
                ]}
                renderValue={(key, val, row) => {
                    if (key === 'room_type') {
                        const parsed = parseRoomType(val)
                        return (
                            <div className="flex flex-wrap items-center gap-1">
                                <RoomTypeChip
                                    type={parsed.baseType || val}
                                />
                                <TariffBasisChip basis={parsed.basis} />
                            </div>
                        )
                    }
                    if (key === 'is_active') {
                        return (
                            <span className="text-xs">
                                {val ? 'Yes' : 'No'}
                            </span>
                        )
                    }
                    return String(val ?? '—')
                }}
                onDelete={(id) => deleteBedRate(id).then(load)}
            />

            {loading && <LoadingBlock />}
        </motion.section>
    )
}

// Bed Rate form with Daily / Hourly toggle and inline validation
function BedRateCreateForm({ roomTypeOptions = [], onCreated }) {
    const [form, setForm] = useState({
        baseRoomType: '',
        basis: 'daily', // 'daily' | 'hourly'
        amount: '',
        effective_from: '',
        effective_to: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
        if (error) setError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!form.baseRoomType) {
            setError('Please select a room type.')
            return
        }
        if (!form.amount || Number(form.amount) <= 0) {
            setError('Tariff amount must be greater than 0.')
            return
        }
        if (!form.effective_from) {
            setError('Please select the effective from date.')
            return
        }

        const basisLabel = form.basis === 'hourly' ? 'Hourly' : 'Daily'
        const room_type = `${form.baseRoomType} (${basisLabel})`

        const payload = {
            room_type,
            daily_rate: Number(form.amount),
            effective_from: form.effective_from,
            effective_to: form.effective_to || undefined,
        }

        setSubmitting(true)
        try {
            await createBedRate(payload)
            setForm({
                baseRoomType: '',
                basis: 'daily',
                amount: '',
                effective_from: '',
                effective_to: '',
            })
            onCreated?.()
        } finally {
            setSubmitting(false)
        }
    }

    const basisHelp =
        form.basis === 'hourly'
            ? 'Use hourly tariff for day care, observation, ER and short stays.'
            : 'Use daily tariff for standard in-patient stays (24 hours basis).'

    return (
        <form
            onSubmit={handleSubmit}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4"
        >
            <div className="md:col-span-4">
                <div className="text-sm font-medium text-slate-800">
                    New Bed Rate
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                    Select room type, choose daily / hourly, and set tariff
                    with effective dates.
                </p>
            </div>

            {/* Room type dropdown */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">
                    Room type
                </label>
                <select
                    className="input rounded-xl"
                    value={form.baseRoomType}
                    onChange={(e) =>
                        handleChange('baseRoomType', e.target.value)
                    }
                >
                    <option value="">Select room type…</option>
                    {roomTypeOptions.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500">
                    Includes standard types – General, Private, ICU, NICU,
                    HDU, Suite, Day Care, etc.
                </p>
            </div>

            {/* Basis toggle */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">
                    Tariff basis
                </label>
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => handleChange('basis', 'daily')}
                        className={`rounded-full px-3 py-1.5 transition ${form.basis === 'daily'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        Daily
                    </button>
                    <button
                        type="button"
                        onClick={() => handleChange('basis', 'hourly')}
                        className={`rounded-full px-3 py-1.5 transition ${form.basis === 'hourly'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        Hourly
                    </button>
                </div>
                <p className="text-[11px] text-slate-500">{basisHelp}</p>
            </div>

            {/* Amount */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">
                    Tariff amount (₹)
                </label>
                <input
                    type="number"
                    min="0"
                    className="input rounded-xl"
                    placeholder="e.g. 2500"
                    value={form.amount}
                    onChange={(e) =>
                        handleChange('amount', e.target.value)
                    }
                />
                <p className="text-[11px] text-slate-500">
                    Base amount charged as per selected basis.
                </p>
            </div>

            {/* Effective from */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">
                    Effective from
                </label>
                <input
                    type="date"
                    className="input rounded-xl"
                    value={form.effective_from}
                    onChange={(e) =>
                        handleChange('effective_from', e.target.value)
                    }
                />
            </div>

            {/* Effective to */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">
                    Effective to{' '}
                    <span className="text-slate-400">(optional)</span>
                </label>
                <input
                    type="date"
                    className="input rounded-xl"
                    value={form.effective_to}
                    onChange={(e) =>
                        handleChange('effective_to', e.target.value)
                    }
                />
            </div>

            {error && (
                <div className="md:col-span-4 text-xs text-rose-600">
                    {error}
                </div>
            )}

            <div className="md:col-span-4 flex justify-end">
                <button
                    type="submit"
                    className="btn min-w-[140px] font-semibold"
                    disabled={submitting}
                >
                    {submitting ? 'Saving…' : 'Save bed rate'}
                </button>
            </div>
        </form>
    )
}

// Helper to parse stored room_type string back into baseType + basis
function parseRoomType(raw) {
    if (!raw) return { baseType: '', basis: 'Daily' }
    const txt = String(raw)
    if (/\(hourly\)/i.test(txt)) {
        return {
            baseType: txt.replace(/\(hourly\)/i, '').trim(),
            basis: 'Hourly',
        }
    }
    if (/\(daily\)/i.test(txt)) {
        return {
            baseType: txt.replace(/\(daily\)/i, '').trim(),
            basis: 'Daily',
        }
    }
    return { baseType: txt.trim(), basis: 'Daily' }
}

// ----------------------------------------------
// PACKAGES ( UX-polished )
// ----------------------------------------------

function Packages() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await listPackages()
            setRows(data || [])
        } catch (e) {
            setError(
                e?.response?.data?.detail || 'Failed to load packages.',
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const filtered = useMemo(() => {
        if (!search.trim()) return rows
        const q = search.toLowerCase()
        return rows.filter((p) =>
            String(p.name || '').toLowerCase().includes(q),
        )
    }, [rows, search])

    return (
        <motion.section
            {...fadeIn}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
        >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 md:text-base">
                        IPD Packages
                    </h2>
                    <p className="text-[11px] text-slate-600 md:text-xs">
                        Define packages such as Normal Delivery, LSCS,
                        Medical Management, etc., with inclusions and
                        exclusions.
                    </p>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <input
                        className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Search package…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {error && <ErrorBanner message={error} />}

            <CreateRow
                title="New Package"
                description="Create a new IPD package with overall charges and inclusions/exclusions."
                fields={[
                    {
                        name: 'name',
                        label: 'Package name',
                        placeholder: 'e.g. Normal Delivery',
                        required: true,
                    },
                    {
                        name: 'included',
                        label: 'Included',
                        placeholder:
                            'e.g. bed, nursing, OT, routine labs',
                    },
                    {
                        name: 'excluded',
                        label: 'Excluded',
                        placeholder:
                            'e.g. blood, implants, high-value drugs',
                    },
                    {
                        name: 'charges',
                        label: 'Package charges (₹)',
                        placeholder: 'e.g. 25000',
                        type: 'number',
                    },
                ]}
                onSubmit={async (f) => {
                    await createPackage(f)
                    await load()
                }}
            />

            <ListCard
                title="Package List"
                items={filtered}
                cols={[
                    ['name', 'Name'],
                    ['charges', 'Charges'],
                    ['included', 'Included'],
                    ['excluded', 'Excluded'],
                ]}
                onDelete={(id) => deletePackage(id).then(load)}
            />

            {loading && <LoadingBlock />}
        </motion.section>
    )
}

// ----------------------------------------------
// REUSABLE COMPONENTS
// ----------------------------------------------

function ErrorBanner({ message }) {
    return (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>{message}</span>
        </div>
    )
}

// Generic create form row (simple use-cases)
function CreateRow({ title, description, fields, onSubmit }) {
    const [f, setF] = useState({})
    const [submitting, setSubmitting] = useState(false)

    const handleChange = (name, value) => {
        setF((prev) => ({ ...prev, [name]: value }))
    }

    const submit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const payload = { ...f }
            Object.keys(payload).forEach(
                (k) => payload[k] === '' && delete payload[k],
            )
            await onSubmit(payload)
            setF({})
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form
            onSubmit={submit}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4"
        >
            <div className="md:col-span-4 space-y-1">
                <div className="text-sm font-medium text-slate-800">
                    {title}
                </div>
                {description && (
                    <p className="text-[11px] text-slate-500">
                        {description}
                    </p>
                )}
            </div>
            {fields.map((fld) => (
                <div key={fld.name} className="space-y-1">
                    {fld.label && (
                        <label className="text-xs text-slate-500">
                            {fld.label}
                        </label>
                    )}
                    {fld.type === 'select' ? (
                        <select
                            className="input rounded-xl"
                            value={f[fld.name] || ''}
                            onChange={(e) =>
                                handleChange(
                                    fld.name,
                                    e.target.value,
                                )
                            }
                            required={fld.required}
                        >
                            <option value="">
                                {fld.placeholder || 'Select'}
                            </option>
                            {fld.options?.map((o) => (
                                <option
                                    key={o.value}
                                    value={o.value}
                                >
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            className="input rounded-xl"
                            type={fld.type || 'text'}
                            placeholder={
                                fld.placeholder || fld.name
                            }
                            value={f[fld.name] || ''}
                            onChange={(e) =>
                                handleChange(
                                    fld.name,
                                    e.target.value,
                                )
                            }
                            required={fld.required}
                        />
                    )}
                </div>
            ))}
            <div className="md:col-span-4 flex justify-end pt-1">
                <button
                    type="submit"
                    className="btn min-w-[100px] font-semibold"
                    disabled={submitting}
                >
                    {submitting ? 'Saving…' : 'Save'}
                </button>
            </div>
        </form>
    )
}

// Table on desktop, cards on mobile
function ListCard({ title, items = [], cols = [], onDelete, renderValue }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                    {title}
                </h3>
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-xs text-slate-500">
                            {cols.map(([k, label]) => (
                                <th
                                    key={k}
                                    className="px-3 py-2 text-left font-medium"
                                >
                                    {label || k}
                                </th>
                            ))}
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr
                                key={it.id}
                                className="border-t hover:bg-slate-50"
                            >
                                {cols.map(([k]) => (
                                    <td
                                        key={k}
                                        className="px-3 py-2 align-middle"
                                    >
                                        {renderValue
                                            ? renderValue(
                                                k,
                                                it[k],
                                                it,
                                            )
                                            : String(
                                                it[k] ??
                                                '—',
                                            )}
                                    </td>
                                ))}
                                <td className="px-3 py-2 text-right">
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                                        onClick={() =>
                                            onDelete(it.id)
                                        }
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!items.length && (
                            <tr>
                                <td
                                    className="p-3 text-sm text-slate-500"
                                    colSpan={cols.length + 1}
                                >
                                    No records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile: card list */}
            <div className="space-y-3 md:hidden">
                {items.map((it) => (
                    <div
                        key={it.id}
                        className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                        {cols.map(([k, label]) => (
                            <div key={k} className="text-xs">
                                <span className="text-slate-500">
                                    {label || k}:{' '}
                                </span>
                                {renderValue ? (
                                    renderValue(k, it[k], it)
                                ) : (
                                    <span className="text-slate-900">
                                        {String(
                                            it[k] ?? '—',
                                        )}
                                    </span>
                                )}
                            </div>
                        ))}
                        <div className="pt-1">
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                                onClick={() => onDelete(it.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
                {!items.length && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
                        No records yet.
                    </div>
                )}
            </div>
        </div>
    )
}

// Room type chip
function RoomTypeChip({ type }) {
    if (!type) return null
    return (
        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            {type}
        </span>
    )
}

// Bed state chip (Green – available, Yellow – reserved/cleaning, Red – occupied)
function BedStateChip({ state }) {
    if (!state) {
        return (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                Unknown
            </span>
        )
    }

    const s = String(state).toLowerCase()
    let cls = 'bg-slate-100 text-slate-700 border-slate-200'
    if (s === 'vacant' || s === 'available') {
        cls = 'bg-emerald-50 text-emerald-700 border-emerald-200'
    } else if (s === 'occupied') {
        cls = 'bg-rose-50 text-rose-700 border-rose-200'
    } else if (s === 'reserved' || s === 'cleaning') {
        cls = 'bg-amber-50 text-amber-700 border-amber-200'
    }

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] capitalize border ${cls}`}
        >
            {state}
        </span>
    )
}

// Chip for Daily / Hourly basis
function TariffBasisChip({ basis }) {
    const b = (basis || 'Daily').toLowerCase()
    const isHourly = b === 'hourly'
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${isHourly
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
        >
            {isHourly ? 'Hourly' : 'Daily'}
        </span>
    )
}

// Loading helper
function LoadingBlock() {
    return (
        <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
        </div>
    )
}
