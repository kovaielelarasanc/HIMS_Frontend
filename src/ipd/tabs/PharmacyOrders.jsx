// FILE: src/ipd/tabs/PharmacyOrders.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
    searchPharmacyItems,
    getAdmissionRx,
    saveAdmissionRx,
    signAdmissionRx,
} from '../../api/pharmacy'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from '@/components/ui/select'

import {
    Pill,
    Search,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    BedDouble,
    Receipt,
} from 'lucide-react'

const DOSE_PRESETS = ['0.5', '1', '1.5', '2', '3']

const FREQ_PRESETS = [
    { code: 'OD', label: 'OD · 1×/day', timesPerDay: 1 },
    { code: 'BD', label: 'BD · 2×/day', timesPerDay: 2 },
    { code: 'TDS', label: 'TDS · 3×/day', timesPerDay: 3 },
    { code: 'QID', label: 'QID · 4×/day', timesPerDay: 4 },
    { code: 'HS', label: 'HS · at bedtime', timesPerDay: 1 },
    { code: 'SOS', label: 'SOS · as needed', timesPerDay: 0 },
]

let tempIdCounter = 1
const makeTempId = () => `tmp-ipd-${tempIdCounter++}`

function computeQty(dose, timesPerDay, days) {
    const d = Number(dose) || 0
    const f = Number(timesPerDay) || 0
    const n = Number(days) || 0
    if (!d || !n) return 0
    if (f === 0) return d * n
    return d * f * n
}

function isNearExpiry(expiryDate) {
    if (!expiryDate) return false
    const d = new Date(expiryDate)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date()
    const diff = (d - now) / (1000 * 60 * 60 * 24)
    return diff <= 30
}

function normaliseIncomingLine(l) {
    const freqMeta =
        FREQ_PRESETS.find((f) => f.code === l.frequency_code) ||
        FREQ_PRESETS[1]

    return {
        tempId: makeTempId(),
        id: l.id,
        item_id: l.item_id,
        item_name: l.item_name,
        strength: l.strength,
        item_type: l.item_type || 'drug',
        dose: l.dose ?? 1,
        frequency_code: freqMeta.code,
        frequency_label: freqMeta.label,
        times_per_day: l.times_per_day ?? freqMeta.timesPerDay,
        days: l.days ?? 1,
        quantity:
            l.quantity ??
            computeQty(l.dose ?? 1, l.times_per_day ?? freqMeta.timesPerDay, l.days ?? 1),
        available_qty: l.available_qty ?? null,
        expiry_date: l.expiry_date ?? null,
        notes: l.notes || '',
    }
}

// Real-world text for sheet
function formatRegimenText(l) {
    const doseStr = l.dose ? `${l.dose}` : ''
    const freqStr = l.frequency_code || ''
    const daysStr = l.days ? `${l.days} day(s)` : ''
    const qtyStr = l.quantity ? `Qty ${l.quantity}` : ''

    const main = [doseStr && `${doseStr}`, freqStr, daysStr]
        .filter(Boolean)
        .join(' · ')
    const tail = [qtyStr, l.notes].filter(Boolean).join(' — ')

    return [main, tail].filter(Boolean).join(' • ')
}

export default function PharmacyOrdersTab({ admissionId, admission, patient, canWrite }) {
    const [lines, setLines] = useState([])
    const [loadingRx, setLoadingRx] = useState(false)
    const [saving, setSaving] = useState(false)
    const [signing, setSigning] = useState(false)

    const [q, setQ] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [catalog, setCatalog] = useState([])
    const [catalogLoading, setCatalogLoading] = useState(false)

    const consultantId = admission?.practitioner_user_id || null
    const todayStr = new Date().toLocaleDateString()

    const loadRx = async () => {
        if (!admissionId) return
        try {
            setLoadingRx(true)
            const { data } = await getAdmissionRx(admissionId)
            const incoming = data?.lines || []
            setLines(incoming.map(normaliseIncomingLine))
        } catch {
            setLines([])
        } finally {
            setLoadingRx(false)
        }
    }

    useEffect(() => {
        loadRx()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    useEffect(() => {
        let alive = true
        if (!q) {
            setCatalog([])
            return
        }
        setCatalogLoading(true)
        searchPharmacyItems({ q, type: typeFilter })
            .then((res) => {
                if (!alive) return
                setCatalog(res.data || [])
            })
            .catch(() => {
                if (!alive) return
                setCatalog([])
            })
            .finally(() => {
                if (!alive) return
                setCatalogLoading(false)
            })
        return () => {
            alive = false
        }
    }, [q, typeFilter])

    const addItemToRx = (item) => {
        const freq = FREQ_PRESETS[1]
        const days = 1
        const dose = 1
        const qty = computeQty(dose, freq.timesPerDay, days)

        setLines((prev) => [
            ...prev,
            {
                tempId: makeTempId(),
                id: item.rx_line_id || null,
                item_id: item.id,
                item_name: item.name,
                strength: item.strength || '',
                item_type: item.type || (typeFilter === 'consumable' ? 'consumable' : 'drug'),
                dose,
                frequency_code: freq.code,
                frequency_label: freq.label,
                times_per_day: freq.timesPerDay,
                days,
                quantity: qty,
                available_qty: item.available_qty ?? null,
                expiry_date: item.expiry_date ?? null,
                notes: '',
            },
        ])
        setQ('')
        setCatalog([])
    }

    const updateLine = (tempId, patch) => {
        setLines((prev) =>
            prev.map((l) => {
                if (l.tempId !== tempId) return l
                const merged = { ...l, ...patch }
                const freqMeta =
                    FREQ_PRESETS.find((f) => f.code === merged.frequency_code) ||
                    FREQ_PRESETS[1]
                merged.times_per_day = freqMeta.timesPerDay
                merged.frequency_label = freqMeta.label
                merged.quantity = computeQty(
                    merged.dose,
                    merged.times_per_day,
                    merged.days
                )
                return merged
            })
        )
    }

    const removeLine = (tempId) => {
        setLines((prev) => prev.filter((l) => l.tempId !== tempId))
    }

    const payloadLines = useMemo(
        () =>
            lines.map((l) => ({
                id: l.id,
                item_id: l.item_id,
                dose: Number(l.dose) || 0,
                frequency_code: l.frequency_code,
                times_per_day: l.times_per_day,
                days: Number(l.days) || 0,
                quantity: Number(l.quantity) || 0,
                notes: l.notes || '',
                item_type: l.item_type,
            })),
        [lines]
    )

    const saveDraft = async () => {
        if (!admissionId) return
        try {
            setSaving(true)
            await saveAdmissionRx(admissionId, {
                consultant_user_id: consultantId,
                lines: payloadLines,
            })
            toast.success('IPD pharmacy orders saved')
            await loadRx()
        } catch {
            // global
        } finally {
            setSaving(false)
        }
    }

    const signAndSend = async () => {
        if (!admissionId) return
        if (!lines.length) {
            toast.error('Add at least one item')
            return
        }
        try {
            setSigning(true)
            await signAdmissionRx(admissionId, {
                consultant_user_id: consultantId,
                lines: payloadLines,
            })
            toast.success('Orders sent to Pharmacy')
            await loadRx()
        } catch {
            // global
        } finally {
            setSigning(false)
        }
    }

    const patientName =
        patient
            ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
            : admission?.patient_name || 'Patient'

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="pb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Pill className="h-4 w-4" />
                    </div>
                    <div>
                        <CardTitle className="text-sm">
                            IPD Pharmacy Orders (Bed-side)
                        </CardTitle>
                        <p className="text-[11px] text-slate-500">
                            Ward orders (medicines &amp; consumables) for this admission.
                        </p>
                    </div>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                    Admission #{admissionId}{' '}
                    {admission?.current_bed_code && (
                        <>
                            <br />
                            <BedDouble className="inline h-3 w-3 mr-1" />
                            Bed: {admission.current_bed_code}
                        </>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-3">
                {/* search row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search medicine / consumable"
                                className="pl-7 h-9 w-48 sm:w-64"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                disabled={!canWrite}
                            />
                        </div>

                        <Select
                            value={typeFilter}
                            onValueChange={setTypeFilter}
                            disabled={!canWrite}
                        >
                            <SelectTrigger className="h-9 w-36 text-xs">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All items</SelectItem>
                                <SelectItem value="drug">Medicines only</SelectItem>
                                <SelectItem value="consumable">
                                    Consumables only
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2 text-[11px] text-slate-500">
                        <Badge variant="outline" className="h-5 px-2 text-[10px]">
                            {lines.length} item(s)
                        </Badge>
                        {loadingRx && (
                            <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading…
                            </span>
                        )}
                        {!canWrite && (
                            <span className="text-[10px] text-amber-700">
                                View only (no IPD doctor permission)
                            </span>
                        )}
                    </div>
                </div>

                {/* search results */}
                {q && (
                    <div className="rounded-2xl border bg-slate-50/70 max-h-48 overflow-y-auto">
                        {catalogLoading && (
                            <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Searching…
                            </div>
                        )}
                        {!catalogLoading && catalog.length === 0 && (
                            <div className="p-3 text-xs text-slate-500">
                                No matching items.
                            </div>
                        )}
                        {!catalogLoading &&
                            catalog.map((item) => {
                                const nearExp = isNearExpiry(item.expiry_date)
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={!canWrite}
                                        onClick={() => addItemToRx(item)}
                                        className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100/80 text-xs disabled:opacity-60"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-800">
                                                {item.name}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {item.strength || '—'} •{' '}
                                                {item.type || 'drug'}
                                            </div>
                                        </div>
                                        <div className="text-right text-[11px] text-slate-500 space-y-1">
                                            {item.available_qty != null && (
                                                <div>Avl: {item.available_qty}</div>
                                            )}
                                            {nearExp && (
                                                <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 border border-amber-100">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Near expiry
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                    </div>
                )}

                {/* lines */}
                <div className="rounded-2xl border border-slate-100 overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                                <th className="py-2 pl-3 pr-2 text-left font-medium">
                                    Item
                                </th>
                                <th className="py-2 px-2 text-left font-medium">Dose</th>
                                <th className="py-2 px-2 text-left font-medium">
                                    Frequency
                                </th>
                                <th className="py-2 px-2 text-left font-medium">Days</th>
                                <th className="py-2 px-2 text-right font-medium">Qty</th>
                                <th className="py-2 px-2 text-right font-medium">Stock</th>
                                <th className="py-2 px-2 text-right w-12" />
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="py-6 text-center text-[11px] text-slate-500"
                                    >
                                        No orders yet for this admission.
                                    </td>
                                </tr>
                            )}

                            {lines.map((l) => {
                                const nearExp = isNearExpiry(l.expiry_date)
                                const lowStock =
                                    l.available_qty != null &&
                                    Number(l.quantity) > Number(l.available_qty)

                                return (
                                    <tr
                                        key={l.tempId}
                                        className="border-t border-slate-100 align-top"
                                    >
                                        <td className="py-2.5 pl-3 pr-2">
                                            <div className="font-medium text-[11px] text-slate-900">
                                                {l.item_name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex flex-wrap gap-1 mt-0.5">
                                                {l.strength && <span>{l.strength}</span>}
                                                {l.item_type && (
                                                    <Badge
                                                        variant="outline"
                                                        className="h-4 px-1.5 text-[9px]"
                                                    >
                                                        {l.item_type}
                                                    </Badge>
                                                )}
                                                {nearExp && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] text-amber-700 border border-amber-100">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Near expiry
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="py-2.5 px-2">
                                            <div className="flex flex-col gap-1">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    disabled={!canWrite}
                                                    className="h-7 text-[11px]"
                                                    value={l.dose}
                                                    onChange={(e) =>
                                                        updateLine(l.tempId, {
                                                            dose: e.target.value,
                                                        })
                                                    }
                                                />
                                                <div className="flex flex-wrap gap-1">
                                                    {DOSE_PRESETS.map((d) => (
                                                        <button
                                                            key={d}
                                                            type="button"
                                                            disabled={!canWrite}
                                                            onClick={() =>
                                                                updateLine(l.tempId, { dose: d })
                                                            }
                                                            className={[
                                                                'px-2 py-0.5 rounded-full border text-[9px]',
                                                                String(l.dose) === d
                                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                                    : 'bg-white text-slate-700 border-slate-200',
                                                                !canWrite && 'opacity-50',
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' ')}
                                                        >
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-2.5 px-2">
                                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                                                {FREQ_PRESETS.map((f) => (
                                                    <button
                                                        key={f.code}
                                                        type="button"
                                                        disabled={!canWrite}
                                                        onClick={() =>
                                                            updateLine(l.tempId, {
                                                                frequency_code: f.code,
                                                            })
                                                        }
                                                        className={[
                                                            'px-2 py-0.5 rounded-full border text-[9px]',
                                                            l.frequency_code === f.code
                                                                ? 'bg-slate-900 text-white border-slate-900'
                                                                : 'bg-white text-slate-700 border-slate-200',
                                                            !canWrite && 'opacity-50',
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' ')}
                                                    >
                                                        {f.code}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>

                                        <td className="py-2.5 px-2">
                                            <Input
                                                type="number"
                                                min="0"
                                                disabled={!canWrite}
                                                className="h-7 w-16 text-[11px]"
                                                value={l.days}
                                                onChange={(e) =>
                                                    updateLine(l.tempId, {
                                                        days: e.target.value,
                                                    })
                                                }
                                            />
                                        </td>

                                        <td className="py-2.5 px-2 text-right">
                                            <Input
                                                type="number"
                                                min="0"
                                                disabled={!canWrite}
                                                className="h-7 w-20 text-[11px] text-right"
                                                value={l.quantity}
                                                onChange={(e) =>
                                                    updateLine(l.tempId, {
                                                        quantity: e.target.value,
                                                    })
                                                }
                                            />
                                            {lowStock && (
                                                <div className="mt-1 text-[9px] text-red-600 flex items-center justify-end gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Low stock for requested qty
                                                </div>
                                            )}
                                        </td>

                                        <td className="py-2.5 px-2 text-right text-[11px] text-slate-600">
                                            {l.available_qty != null ? (
                                                <div>
                                                    Avl: {l.available_qty}
                                                    {nearExp && (
                                                        <div className="text-[9px] text-amber-700">
                                                            Exp: {l.expiry_date}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400">
                                                    —
                                                </span>
                                            )}
                                        </td>

                                        <td className="py-2.5 px-2 text-right">
                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    className="text-[11px] text-red-600 hover:underline"
                                                    onClick={() => removeLine(l.tempId)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3">
                    <div className="text-[11px] text-slate-500">
                        Signed orders appear in the Pharmacy Rx queue under IPD context.
                    </div>
                    {canWrite && (
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={saveDraft}
                                disabled={saving}
                            >
                                {saving && (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                )}
                                Save draft
                            </Button>
                            <Button
                                size="sm"
                                onClick={signAndSend}
                                disabled={signing || !lines.length}
                            >
                                {signing && (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                )}
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Sign &amp; send
                            </Button>
                        </div>
                    )}
                </div>

                {/* ===== Bed-side prescription sheet preview at bottom ===== */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-800">
                                Bed-side prescription sheet (IPD)
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                            {todayStr} • {lines.length} item(s)
                        </span>
                    </div>

                    {lines.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-500">
                            Add ward medicines above to see the IPD prescription sheet here.
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 space-y-3">
                            {/* header */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="space-y-0.5">
                                    <div className="text-xs font-semibold text-slate-900">
                                        {patientName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-1">
                                        {patient?.uhid && (
                                            <span>UHID: {patient.uhid}</span>
                                        )}
                                        {patient?.age && <span>• Age: {patient.age}</span>}
                                        {patient?.gender && <span>• {patient.gender}</span>}
                                    </div>
                                </div>
                                <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                                    <div>Admission: {admissionId}</div>
                                    {admission?.current_bed_code && (
                                        <div>Bed: {admission.current_bed_code}</div>
                                    )}
                                    {admission?.practitioner_name && (
                                        <div>Consultant: {admission.practitioner_name}</div>
                                    )}
                                </div>
                            </div>

                            {/* lines */}
                            <ol className="mt-1 space-y-1.5 list-decimal pl-4">
                                {lines.map((l) => (
                                    <li key={l.tempId}>
                                        <div className="text-[11px] font-semibold text-slate-900">
                                            {l.item_name}{' '}
                                            {l.strength && (
                                                <span className="font-normal text-slate-700">
                                                    {l.strength}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-600">
                                            {formatRegimenText(l) || '—'}
                                        </div>
                                    </li>
                                ))}
                            </ol>

                            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                                <span>Nurse / Doctor signature: ________________________</span>
                                <span>Date: {todayStr}</span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
