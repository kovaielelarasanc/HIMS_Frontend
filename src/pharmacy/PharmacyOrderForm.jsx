// FILE: src/pharmacy/PharmacyOrderForm.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { createPharmacyPrescription } from '../api/pharmacy'
import { listInventoryLocations, listInventoryItems } from '../api/inventory'
import PatientPicker from '../opd/components/PatientPicker'

import {
    Card,
    CardHeader,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

import {
    Pill,
    User,
    Building2,
    Stethoscope,
    Search,
    Plus,
    Trash2,
    Loader2,
} from 'lucide-react'

const makeEmptyLine = () => ({
    _id: Math.random().toString(36).slice(2),
    item: null,
    requestedQty: '',
    doseText: '',
    frequency: '',
    timing: '',
    durationDays: '',
    instructions: '',
    searchQ: '',
    searchResults: [],
    searching: false,
    showDropdown: false,
})

function getItemDisplayName(item) {
    if (!item) return ''
    return (
        item.name ||
        item.item_name ||
        item.brand_name ||
        item.code ||
        `#${item.id}`
    )
}

function getItemSecondaryText(item) {
    if (!item) return ''
    const bits = []
    if (item.code) bits.push(item.code)
    if (item.generic_name) bits.push(item.generic_name)
    if (item.form) bits.push(item.form)
    if (item.strength) bits.push(item.strength)
    if (item.pack_size) bits.push(`Pack: ${item.pack_size}`)
    if (item.manufacturer) bits.push(item.manufacturer)
    return bits.join(' • ')
}

export default function PharmacyOrderForm({
    orderType, // 'OPD' | 'IPD' | 'COUNTER' | 'OT_CONSUMABLE'
    title,
    subtitle,
    variant = 'page', // 'page' or 'embedded'

    // Auto-fill props
    initialPatientId = null,
    initialPatient = null,
    lockPatient = false,
    initialLocationId = '',
    initialDoctorUserId = '',
    initialVisitId = '',
    initialIpdAdmissionId = '',
    initialContextRef = '',
}) {
    const tagLabel = useMemo(() => {
        switch (orderType) {
            case 'OPD':
                return 'OPD'
            case 'IPD':
                return 'IPD Ward'
            case 'COUNTER':
                return 'Counter / OTC'
            case 'OT_CONSUMABLE':
                return 'OT Consumables'
            default:
                return orderType || 'Pharmacy'
        }
    }, [orderType])

    // ---- State ----
    const [locations, setLocations] = useState([])
    const [locationId, setLocationId] = useState(initialLocationId || '')

    const [patientId, setPatientId] = useState(initialPatientId)
    const [patient, setPatient] = useState(initialPatient)

    const [doctorUserId, setDoctorUserId] = useState(initialDoctorUserId || '')
    const [visitId, setVisitId] = useState(initialVisitId || '')
    const [ipdAdmissionId, setIpdAdmissionId] = useState(initialIpdAdmissionId || '')
    const [contextRef, setContextRef] = useState(initialContextRef || '')

    const [notes, setNotes] = useState('')
    const [lines, setLines] = useState([makeEmptyLine()])
    const [saving, setSaving] = useState(false)

    // Sync initial props → state once
    useEffect(() => {
        if (initialPatientId && !patientId) setPatientId(initialPatientId)
    }, [initialPatientId, patientId])
    useEffect(() => {
        if (initialPatient && !patient) setPatient(initialPatient)
    }, [initialPatient, patient])

    // Load locations
    useEffect(() => {
        let alive = true
            ; (async () => {
                try {
                    const res = await listInventoryLocations()
                    if (!alive) return
                    const locs = res.data || []
                    setLocations(locs)
                    if (!locationId && locs.length === 1) {
                        setLocationId(String(locs[0].id))
                    }
                } catch {
                    if (!alive) return
                    setLocations([])
                }
            })()
        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ---- Lines helpers ----
    const updateLine = (rowId, patch) => {
        setLines((prev) => prev.map((ln) => (ln._id === rowId ? { ...ln, ...patch } : ln)))
    }

    const addLine = () => setLines((prev) => [...prev, makeEmptyLine()])

    const removeLine = (rowId) => {
        setLines((prev) => {
            if (prev.length === 1) return prev
            return prev.filter((ln) => ln._id !== rowId)
        })
    }

    // ---- Item search ----
    const handleItemSearchChange = async (rowId, value) => {
        updateLine(rowId, {
            searchQ: value,
            item: null,
        })

        if (!value || value.length < 2) {
            updateLine(rowId, {
                searchResults: [],
                showDropdown: false,
            })
            return
        }

        updateLine(rowId, {
            searching: true,
            showDropdown: true,
        })

        try {
            const res = await listInventoryItems({ q: value, page_size: 10 })
            const items = res.data?.items || res.data || []
            updateLine(rowId, { searchResults: items })
        } catch {
            updateLine(rowId, { searchResults: [] })
        } finally {
            updateLine(rowId, { searching: false })
        }
    }

    const chooseItemForRow = (rowId, item) => {
        updateLine(rowId, {
            item,
            searchQ: '',
            showDropdown: false,
            searchResults: [],
        })
    }

    const blurSearch = (rowId) => {
        setTimeout(() => {
            updateLine(rowId, { showDropdown: false })
        }, 150)
    }

    const locationName = useMemo(() => {
        const id = Number(locationId)
        const found = locations.find((l) => l.id === id)
        return found?.name || '—'
    }, [locations, locationId])

    const validLinesForPayload = useMemo(
        () =>
            lines
                .filter(
                    (ln) => ln.item && ln.item.id && Number(ln.requestedQty || 0) > 0
                )
                .map((ln) => {
                    const qty = Number(ln.requestedQty || 0)
                    const duration = ln.durationDays ? Number(ln.durationDays) : null
                    return {
                        item_id: ln.item.id,
                        requested_qty: qty,
                        dose_text: ln.doseText || null,
                        frequency_code: ln.frequency || null,
                        timing: ln.timing || null,
                        duration_days: duration,
                        instructions: ln.instructions || null,
                    }
                }),
        [lines]
    )

    const hasPendingLines = validLinesForPayload.length > 0

    // ---- Submit ----
    const handleSubmit = async () => {
        if (!patientId) {
            toast.error('Please select a patient')
            return
        }
        if (!locationId) {
            toast.error('Please select Pharmacy location')
            return
        }
        if (!hasPendingLines) {
            toast.error('Add at least one item with quantity')
            return
        }

        const notesPieces = []
        if (notes.trim()) notesPieces.push(notes.trim())
        if (orderType === 'COUNTER' && contextRef.trim()) {
            notesPieces.push(`Counter ref: ${contextRef.trim()}`)
        }
        if (orderType === 'OT_CONSUMABLE' && contextRef.trim()) {
            notesPieces.push(`OT case: ${contextRef.trim()}`)
        }

        const payload = {
            type: orderType,
            patient_id: patientId,
            location_id: Number(locationId),
            lines: validLinesForPayload,
        }

        if (doctorUserId.trim()) {
            const docId = Number(doctorUserId.trim())
            if (!Number.isNaN(docId)) payload.doctor_user_id = docId
        }

        if (notesPieces.length > 0) payload.notes = notesPieces.join(' | ')

        if (orderType === 'OPD' && visitId.trim()) {
            const vId = Number(visitId.trim())
            if (!Number.isNaN(vId)) payload.visit_id = vId
        }

        if ((orderType === 'IPD' || orderType === 'OT_CONSUMABLE') && ipdAdmissionId.trim()) {
            const ipdId = Number(ipdAdmissionId.trim())
            if (!Number.isNaN(ipdId)) payload.ipd_admission_id = ipdId
        }

        try {
            setSaving(true)
            const res = await createPharmacyPrescription(payload)
            const rx = res.data || {}
            const rxNumber = rx.prescription_number || rx.id || 'created'
            toast.success(`Pharmacy order created (Rx ${rxNumber})`)

            // Soft reset: keep patient & location
            setLines([makeEmptyLine()])
            setNotes('')
            setContextRef(initialContextRef || '')
            if (!initialVisitId) setVisitId('')
            if (!initialIpdAdmissionId) setIpdAdmissionId('')
        } catch {
            // interceptor will show error
        } finally {
            setSaving(false)
        }
    }

    // ---- Body (Card) ----
    const body = (
        <Card className="border-slate-500 rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className="h-6 px-2 text-[10px] uppercase tracking-wide"
                        >
                            {tagLabel}
                        </Badge>
                        <span className="text-xs text-slate-500">
                            Creates a PharmacyPrescription visible in the Pharmacy Rx Explorer.
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Location:</span>
                        <select
                            className="h-7 rounded-xl border border-slate-500 bg-white px-2 text-[11px] text-slate-700"
                            value={locationId}
                            onChange={(e) => setLocationId(e.target.value)}
                        >
                            <option value="">Select</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                    {loc.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Patient + context */}
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]">
                    {/* Patient */}
                    <div>
                        <Card className="border-slate-500 rounded-2xl bg-slate-50/70">
                            <CardContent className="p-3 sm:p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-500" />
                                    <span className="text-xs font-semibold text-slate-800">
                                        Patient
                                    </span>
                                </div>

                                {!lockPatient && (
                                    <PatientPicker
                                        value={patientId}
                                        onChange={(id, p) => {
                                            setPatientId(id)
                                            setPatient(p)
                                        }}
                                        label="Select patient"
                                    />
                                )}

                                {lockPatient && patient && (
                                    <div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-700">
                                        <div className="font-semibold text-slate-900">
                                            {patient.first_name} {patient.last_name}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-500 flex flex-wrap gap-1">
                                            {patient.uhid && (
                                                <Badge
                                                    variant="outline"
                                                    className="h-4 px-1.5 text-[9px]"
                                                >
                                                    UHID {patient.uhid}
                                                </Badge>
                                            )}
                                            {patient.phone && <span>• {patient.phone}</span>}
                                            <span>• Patient fixed from context</span>
                                        </div>
                                    </div>
                                )}

                                {!lockPatient && patient && (
                                    <div className="rounded-xl border bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                                        Selected:{' '}
                                        <span className="font-semibold">
                                            {patient.first_name} {patient.last_name}
                                        </span>{' '}
                                        {patient.uhid && <>• UHID {patient.uhid}</>}
                                        {patient.phone && <> • {patient.phone}</>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Context */}
                    <div className="space-y-2">
                        <Card className="border-slate-500 rounded-2xl bg-slate-50/70">
                            <CardContent className="p-3 sm:p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Stethoscope className="h-4 w-4 text-slate-500" />
                                    <span className="text-xs font-semibold text-slate-800">
                                        Clinical context
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {orderType === 'OPD' && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-700">
                                                OPD Visit ID (optional)
                                            </label>
                                            <Input
                                                placeholder="e.g., 1234"
                                                className="h-8 text-xs"
                                                value={visitId}
                                                onChange={(e) => setVisitId(e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {(orderType === 'IPD' || orderType === 'OT_CONSUMABLE') && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-700">
                                                IPD Admission ID (optional)
                                            </label>
                                            <Input
                                                placeholder="e.g., 5678"
                                                className="h-8 text-xs"
                                                value={ipdAdmissionId}
                                                onChange={(e) => setIpdAdmissionId(e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {orderType === 'COUNTER' && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-700">
                                                Counter ref / token (optional)
                                            </label>
                                            <Input
                                                placeholder="e.g., Token #15"
                                                className="h-8 text-xs"
                                                value={contextRef}
                                                onChange={(e) => setContextRef(e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {orderType === 'OT_CONSUMABLE' && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-700">
                                                OT case ref (optional)
                                            </label>
                                            <Input
                                                placeholder="e.g., OT-2025-001"
                                                className="h-8 text-xs"
                                                value={contextRef}
                                                onChange={(e) => setContextRef(e.target.value)}
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-700">
                                            Doctor user ID (optional)
                                        </label>
                                        <Input
                                            placeholder="e.g., 10"
                                            className="h-8 text-xs"
                                            value={doctorUserId}
                                            onChange={(e) => setDoctorUserId(e.target.value)}
                                        />
                                        <p className="text-[10px] text-slate-500">
                                            Later you can auto-fill from logged-in doctor / visit.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {patient && (
                            <div className="rounded-2xl border border-slate-500 bg-white px-3 py-2 text-[11px] text-slate-700 flex flex-wrap items-center gap-2">
                                <span className="font-semibold">
                                    {patient.first_name} {patient.last_name}
                                </span>
                                {patient.uhid && (
                                    <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                                        UHID {patient.uhid}
                                    </Badge>
                                )}
                                {patient.phone && <span>• {patient.phone}</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lines table */}
                <div className="rounded-2xl border border-slate-500 bg-slate-50/70 p-2 sm:p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <Pill className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-800">
                                Order lines (medicines / consumables)
                            </span>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={addLine}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add line
                        </Button>
                    </div>

                    <div className="overflow-x-auto -mx-1 sm:mx-0">
                        <table className="min-w-full text-[11px]">
                            <thead>
                                <tr className="border-b border-slate-500 text-[10px] uppercase tracking-wide text-slate-500">
                                    <th className="py-1.5 pr-2 text-left font-medium">Item</th>
                                    <th className="py-1.5 px-2 text-left font-medium">Dose / Frequency</th>
                                    <th className="py-1.5 px-2 text-left font-medium">Duration</th>
                                    <th className="py-1.5 px-2 text-right font-medium">Qty</th>
                                    <th className="py-1.5 pl-2 text-right font-medium w-10" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((ln) => (
                                    <tr
                                        key={ln._id}
                                        className="border-b border-slate-100 align-top"
                                    >
                                        {/* Item picker */}
                                        <td className="py-2 pr-2 min-w-[220px]">
                                            <div className="space-y-1">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                                                    <Input
                                                        className="pl-6 h-8 text-xs"
                                                        placeholder={
                                                            ln.item
                                                                ? getItemDisplayName(ln.item)
                                                                : 'Search item (name / code / generic)'
                                                        }
                                                        value={
                                                            ln.item
                                                                ? getItemDisplayName(ln.item)
                                                                : ln.searchQ
                                                        }
                                                        onChange={(e) =>
                                                            handleItemSearchChange(ln._id, e.target.value)
                                                        }
                                                        onFocus={() =>
                                                            ln.searchQ?.length >= 2 &&
                                                            updateLine(ln._id, { showDropdown: true })
                                                        }
                                                        onBlur={() => blurSearch(ln._id)}
                                                    />
                                                    {ln.showDropdown &&
                                                        (ln.searching || ln.searchResults.length > 0) && (
                                                            <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-500 bg-white shadow-lg">
                                                                {ln.searching && (
                                                                    <div className="px-3 py-2 text-[11px] text-slate-500 flex items-center gap-2">
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                                                                        Searching…
                                                                    </div>
                                                                )}
                                                                {!ln.searching &&
                                                                    ln.searchResults.length === 0 && (
                                                                        <div className="px-3 py-2 text-[11px] text-slate-500">
                                                                            No items found.
                                                                        </div>
                                                                    )}
                                                                {!ln.searching &&
                                                                    ln.searchResults.map((it) => (
                                                                        <button
                                                                            key={it.id}
                                                                            type="button"
                                                                            className="w-full px-3 py-1.5 text-left hover:bg-slate-50"
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => chooseItemForRow(ln._id, it)}
                                                                        >
                                                                            <div className="font-medium text-[11px] text-slate-900">
                                                                                {getItemDisplayName(it)}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500">
                                                                                {getItemSecondaryText(it)}
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        )}
                                                </div>

                                                {ln.item && (
                                                    <div className="rounded-xl bg-white border border-slate-500 px-2 py-1 text-[10px] text-slate-600">
                                                        {getItemSecondaryText(ln.item) ||
                                                            'Selected from inventory'}
                                                    </div>
                                                )}

                                                <Textarea
                                                    className="h-14 text-[11px]"
                                                    placeholder="Special instructions (optional)"
                                                    value={ln.instructions}
                                                    onChange={(e) =>
                                                        updateLine(ln._id, { instructions: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </td>

                                        {/* Dose / frequency */}
                                        <td className="py-2 px-2 min-w-[190px]">
                                            <div className="space-y-1">
                                                <Input
                                                    className="h-8 text-xs"
                                                    placeholder="Dose text (e.g., 1-0-1)"
                                                    value={ln.doseText}
                                                    onChange={(e) =>
                                                        updateLine(ln._id, { doseText: e.target.value })
                                                    }
                                                />
                                                <Input
                                                    className="h-8 text-xs"
                                                    placeholder="Frequency (e.g., TDS, BD, HS)"
                                                    value={ln.frequency}
                                                    onChange={(e) =>
                                                        updateLine(ln._id, { frequency: e.target.value })
                                                    }
                                                />
                                                <Input
                                                    className="h-8 text-xs"
                                                    placeholder="Timing (e.g., after food)"
                                                    value={ln.timing}
                                                    onChange={(e) =>
                                                        updateLine(ln._id, { timing: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </td>

                                        {/* Duration */}
                                        <td className="py-2 px-2 min-w-[120px]">
                                            <Input
                                                className="h-8 text-xs"
                                                type="number"
                                                min={0}
                                                placeholder="Days"
                                                value={ln.durationDays}
                                                onChange={(e) =>
                                                    updateLine(ln._id, { durationDays: e.target.value })
                                                }
                                            />
                                            <p className="mt-1 text-[10px] text-slate-500">
                                                Later you can auto-calc qty from dose × days.
                                            </p>
                                        </td>

                                        {/* Qty + actions */}
                                        <td className="py-2 px-2 text-right align-top min-w-[80px]">
                                            <Input
                                                className="h-8 text-xs text-right"
                                                type="number"
                                                min={0}
                                                placeholder="Qty"
                                                value={ln.requestedQty}
                                                onChange={(e) =>
                                                    updateLine(ln._id, { requestedQty: e.target.value })
                                                }
                                            />
                                        </td>
                                        <td className="py-2 pl-2 pr-1 align-top text-right">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-slate-400 hover:text-red-600"
                                                onClick={() => removeLine(ln._id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                        <span>
                            Valid lines:{' '}
                            <span className="font-semibold">
                                {validLinesForPayload.length}
                            </span>
                        </span>
                        <span>•</span>
                        <span>
                            Location:{' '}
                            <span className="font-semibold">{locationName}</span>
                        </span>
                    </div>
                </div>

                {/* Notes + submit */}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-start">
                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-700">
                            Overall notes (optional)
                        </label>
                        <Textarea
                            className="min-h-[60px] text-[11px]"
                            placeholder="Any clinical notes for Pharmacy…"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col sm:items-end gap-2">
                        <div className="text-[11px] text-slate-500">
                            This will create a{' '}
                            <span className="font-semibold">PharmacyPrescription</span> which
                            appears in the Pharmacy Rx Explorer for dispensing & billing.
                        </div>
                        <Button
                            className="h-9 px-4 text-[11px]"
                            disabled={saving}
                            onClick={handleSubmit}
                        >
                            {saving ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                                <Pill className="mr-1 h-4 w-4" />
                            )}
                            Save {tagLabel} order
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )

    // ---- Variant wrapper ----
    if (variant === 'embedded') {
        return body
    }

    return (
        <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 sm:gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Pill className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
                        {title}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">{subtitle}</p>
                </div>
            </div>
            {body}
        </div>
    )
}
