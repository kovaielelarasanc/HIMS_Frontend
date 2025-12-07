
// FILE: src/ipd/Masters.jsx
import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react'

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

// ----------------------------------------------
// ROOT COMPONENT
// ----------------------------------------------

export default function Masters() {
    return (
        <PermGate anyOf={['ipd.masters.manage', 'ipd.packages.manage']}>
            <div className="min-h-screen bg-slate-50 px-4 py-4 text-black md:px-6 md:py-6 space-y-6">
                <div className="mx-auto max-w-6xl space-y-1">
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                        IPD Masters
                    </h1>
                    <p className="text-sm text-slate-600">
                        Configure wards, rooms, beds and their tariffs. This setup drives
                        the Admission, Bedboard, Billing and Bed Occupancy workflows for
                        your hospital.
                    </p>
                </div>

                <div className="mx-auto max-w-6xl space-y-6">
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
            setError(e?.response?.data?.detail || 'Failed to load ward/room/bed data.')
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
        [rooms]
    )

    const allRoomTypes = useMemo(
        () =>
            Array.from(
                new Set([
                    ...PREDEFINED_ROOM_TYPES,
                    ...derivedRoomTypes,
                ])
            ),
        [derivedRoomTypes]
    )

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-slate-500" />
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Ward · Room · Bed
                        </h2>
                        <p className="text-xs text-slate-500">
                            Define the physical structure of the IPD: wards, room types and
                            individual beds. Room type drives bed tariffs and reporting.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                    {allRoomTypes.slice(0, 6).map((t) => (
                        <RoomTypeChip key={t} type={t} />
                    ))}
                    {allRoomTypes.length > 6 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                            +{allRoomTypes.length - 6} more types
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <ErrorBanner message={error} />
            )}

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
                    description="Add individual beds to rooms. Bed codes should be easy for staff to identify (e.g. GW-101-A)."
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

            {/* LISTS */}
            <div className="grid gap-6 md:grid-cols-3">
                <ListCard
                    title="Wards"
                    items={wards}
                    cols={[
                        ['code', 'Code'],
                        ['name', 'Name'],
                        ['floor', 'Floor'],
                    ]}
                    onDelete={(id) => deleteWard(id).then(load)}
                />

                <ListCard
                    title="Rooms"
                    items={rooms}
                    cols={[
                        ['ward_id', 'Ward ID'],
                        ['number', 'Room No'],
                        ['type', 'Room Type'],
                    ]}
                    renderValue={(key, val) =>
                        key === 'type' ? <RoomTypeChip type={val} /> : String(val ?? '—')
                    }
                    onDelete={(id) => deleteRoom(id).then(load)}
                />

                <ListCard
                    title="Beds"
                    items={beds}
                    cols={[
                        ['room_id', 'Room ID'],
                        ['code', 'Bed code'],
                        ['state', 'Status'],
                    ]}
                    renderValue={(key, val) =>
                        key === 'state' ? <BedStateChip state={val} /> : String(val ?? '—')
                    }
                    onDelete={(id) => deleteBed(id).then(load)}
                />
            </div>

            {loading && <LoadingBlock />}
        </section>
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
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid gap-3 md:grid-cols-4 text-sm"
        >
            <div className="md:col-span-4">
                <div className="text-sm font-medium text-slate-800">New Room</div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                    Link the room to a ward and assign a room type. Custom room types can
                    be created on the fly when needed.
                </p>
            </div>

            {/* Ward */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">Ward</label>
                <select
                    className="input rounded-xl"
                    value={form.ward_id}
                    onChange={(e) => handleChange('ward_id', e.target.value)}
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
                    onChange={(e) => handleChange('number', e.target.value)}
                    required
                />
            </div>

            {/* Room type selector */}
            <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-slate-500">Room type</label>
                <select
                    className="input rounded-xl"
                    value={form.typeChoice}
                    onChange={(e) => handleChange('typeChoice', e.target.value)}
                >
                    <option value="">(Optional) Select room type</option>
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
                        className="mt-2 input rounded-xl"
                        placeholder="Enter custom room type (e.g. Chemotherapy Day Care)"
                        value={form.customType}
                        onChange={(e) => handleChange('customType', e.target.value)}
                    />
                )}

                <p className="mt-1 text-[11px] text-slate-500">
                    Standard types include General Ward, Semi-Private, Private, Deluxe,
                    ICU, NICU, PICU, HDU, Isolation Room and Suite. Use custom type for
                    special units.
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
                    className="btn min-w-[120px]"
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
            setError(e?.response?.data?.detail || 'Failed to load bed rates.')
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
        return Array.from(new Set([...PREDEFINED_ROOM_TYPES, ...fromRooms, ...fromRates]))
    }, [rooms, rows])

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <BedDouble className="h-5 w-5 text-slate-500" />
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Bed Rates (Daily & Hourly)
                        </h2>
                        <p className="text-xs text-slate-500">
                            Configure bed tariffs for each room type. Support both daily
                            and hourly tariffs for day care, observation, emergency and
                            short-stay scenarios.
                        </p>
                    </div>
                </div>
            </div>

            {error && <ErrorBanner message={error} />}

            <BedRateCreateForm roomTypeOptions={roomTypeOptions} onCreated={load} />

            {/* Bed Rate listing: table on desktop, cards on mobile */}
            <ListCard
                title="Configured Bed Rates"
                items={rows}
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
                                <RoomTypeChip type={parsed.baseType || val} />
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
        </section>
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
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid gap-3 md:grid-cols-4 text-sm"
        >
            <div className="md:col-span-4">
                <div className="text-sm font-medium text-slate-800">New Bed Rate</div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                    Select a room type, choose whether this is a daily or hourly tariff,
                    and enter the amount and effective dates.
                </p>
            </div>

            {/* Room type dropdown */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">Room type</label>
                <select
                    className="input rounded-xl"
                    value={form.baseRoomType}
                    onChange={(e) => handleChange('baseRoomType', e.target.value)}
                >
                    <option value="">Select room type…</option>
                    {roomTypeOptions.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500">
                    Includes standard types like General Ward, Private, ICU, NICU, PICU,
                    HDU, Isolation, Suite and Day Care.
                </p>
            </div>

            {/* Basis toggle */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">Tariff basis</label>
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => handleChange('basis', 'daily')}
                        className={`px-3 py-1.5 rounded-full transition ${form.basis === 'daily'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        Daily
                    </button>
                    <button
                        type="button"
                        onClick={() => handleChange('basis', 'hourly')}
                        className={`px-3 py-1.5 rounded-full transition ${form.basis === 'hourly'
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
                    onChange={(e) => handleChange('amount', e.target.value)}
                />
                <p className="text-[11px] text-slate-500">
                    Base amount charged based on the selected tariff basis.
                </p>
            </div>

            {/* Effective from */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">Effective from</label>
                <input
                    type="date"
                    className="input rounded-xl"
                    value={form.effective_from}
                    onChange={(e) => handleChange('effective_from', e.target.value)}
                />
            </div>

            {/* Effective to */}
            <div className="space-y-1">
                <label className="text-xs text-slate-500">
                    Effective to <span className="text-slate-400">(optional)</span>
                </label>
                <input
                    type="date"
                    className="input rounded-xl"
                    value={form.effective_to}
                    onChange={(e) => handleChange('effective_to', e.target.value)}
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
                    className="btn min-w-[140px]"
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
// PACKAGES (left simple, just UX-polished)
// ----------------------------------------------

function Packages() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await listPackages()
            setRows(data || [])
        } catch (e) {
            setError(e?.response?.data?.detail || 'Failed to load packages.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Packages</h2>
                <p className="text-xs text-slate-500">
                    Define IPD packages like Normal Delivery, LSCS, Medical Management
                    with inclusive and exclusive items and package charges.
                </p>
            </div>

            {error && <ErrorBanner message={error} />}

            <CreateRow
                title="New Package"
                description="Create a new IPD package with overall charges and inclusions/exclusions."
                fields={[
                    { name: 'name', label: 'Package name', placeholder: 'e.g. Normal Delivery', required: true },
                    { name: 'included', label: 'Included', placeholder: 'e.g. bed, nursing, OT, routine labs' },
                    { name: 'excluded', label: 'Excluded', placeholder: 'e.g. blood, implants, high-value drugs' },
                    { name: 'charges', label: 'Package charges (₹)', placeholder: 'e.g. 25000', type: 'number' },
                ]}
                onSubmit={async (f) => {
                    await createPackage(f)
                    await load()
                }}
            />

            <ListCard
                title="Package List"
                items={rows}
                cols={[
                    ['name', 'Name'],
                    ['charges', 'Charges'],
                    ['included', 'Included'],
                    ['excluded', 'Excluded'],
                ]}
                onDelete={(id) => deletePackage(id).then(load)}
            />

            {loading && <LoadingBlock />}
        </section>
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
                (k) => payload[k] === '' && delete payload[k]
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
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid gap-3 md:grid-cols-4 text-sm"
        >
            <div className="md:col-span-4 space-y-1">
                <div className="text-sm font-medium text-slate-800">{title}</div>
                {description && (
                    <p className="text-[11px] text-slate-500">{description}</p>
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
                            onChange={(e) => handleChange(fld.name, e.target.value)}
                            required={fld.required}
                        >
                            <option value="">
                                {fld.placeholder || 'Select'}
                            </option>
                            {fld.options?.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            className="input rounded-xl"
                            type={fld.type || 'text'}
                            placeholder={fld.placeholder || fld.name}
                            value={f[fld.name] || ''}
                            onChange={(e) => handleChange(fld.name, e.target.value)}
                            required={fld.required}
                        />
                    )}
                </div>
            ))}
            <div className="md:col-span-4 flex justify-end pt-1">
                <button
                    type="submit"
                    className="btn min-w-[100px]"
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
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-xs text-slate-500">
                            {cols.map(([k, label]) => (
                                <th key={k} className="px-3 py-2 text-left font-medium">
                                    {label || k}
                                </th>
                            ))}
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} className="border-t hover:bg-slate-50">
                                {cols.map(([k]) => (
                                    <td key={k} className="px-3 py-2 align-middle">
                                        {renderValue
                                            ? renderValue(k, it[k], it)
                                            : String(it[k] ?? '—')}
                                    </td>
                                ))}
                                <td className="px-3 py-2 text-right">
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                                        onClick={() => onDelete(it.id)}
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
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2"
                    >
                        {cols.map(([k, label]) => (
                            <div key={k} className="text-xs">
                                <span className="text-slate-500">{label || k}: </span>
                                {renderValue
                                    ? renderValue(k, it[k], it)
                                    : <span className="text-slate-900">{String(it[k] ?? '—')}</span>}
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
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 border border-sky-200">
            {type}
        </span>
    )
}

// Bed state chip (Green – available, Yellow – reserved/cleaning, Red – occupied)
function BedStateChip({ state }) {
    if (!state) {
        return (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200">
                Unknown
            </span>
        )
    }

    const s = String(state).toLowerCase()
    let cls =
        'bg-slate-100 text-slate-700 border-slate-200'
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
        <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
        </div>
    )
}
