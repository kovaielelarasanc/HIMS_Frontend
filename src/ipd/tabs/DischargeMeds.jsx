// FILE: frontend/src/ipd/DischargeMedsTab.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
    Check,
    ChevronDown,
    ClipboardList,
    Loader2,
    Pill,
    Plus,
    Search,
    Send,
    Trash2,
    X,
} from 'lucide-react'

// ✅ Your existing IPD API
import { listDischargeMeds, saveDischargeMeds } from '../../api/ipd'

// ✅ Use this API for search drug (as you shared)
// ⚠️ Change import path if your file is different:
import { searchItemBatches } from '../../api/inventory'

// ✅ Pharmacy Rx API (create prescription once with multiple lines)
// ⚠️ Change import path if your file is different:
import { createPharmacyPrescription } from '../../api/pharmacy'

const cx = (...a) => a.filter(Boolean).join(' ')

const DOSE_UNITS = ['mg', 'g', 'ml', 'units', 'drops', 'puff', 'tab', 'cap', 'sachet']
const FREQ_TEMPLATES = ['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'PRN']
const DURATION_TEMPLATES = [3, 5, 7, 10, 14]

const toInt = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const freqToCode = (freqRaw) => {
    const f = String(freqRaw || '').trim().toUpperCase()
    // already in slots format
    if (/^\d-\d-\d-\d$/.test(f)) return f

    // common templates
    if (f === 'OD') return '1-0-0-0'
    if (f === 'BD') return '1-0-1-0'
    if (f === 'TDS') return '1-1-1-0'
    if (f === 'QID') return '1-1-1-1'
    if (f === 'HS') return '0-0-0-1'
    if (f === 'SOS' || f === 'PRN') return '0-0-0-0'

    // unknown → keep blank (pharmacy can still accept if optional)
    return ''
}

const calcQtyFromFreqAndDuration = (freqCode, durationDays) => {
    const d = Number(durationDays || 0)
    if (!d || !Number.isFinite(d) || d <= 0) return 0
    const code = String(freqCode || '')
    const parts = code.split('-').map((x) => Number(x || 0))
    const dosesPerDay = parts.length === 4 && parts.every((n) => Number.isFinite(n)) ? parts.reduce((a, b) => a + b, 0) : 0
    if (!dosesPerDay) return 0
    return dosesPerDay * d
}

function MiniPill({ children }) {
    return (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm">
            {children}
        </span>
    )
}

function SoftButton({ className = '', ...props }) {
    return (
        <button
            className={cx(
                'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur hover:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

function PrimaryButton({ className = '', ...props }) {
    return (
        <button
            className={cx(
                'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

function DangerButton({ className = '', ...props }) {
    return (
        <button
            className={cx(
                'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

function Segmented({ value, onChange, items }) {
    return (
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur">
            {items.map((it) => {
                const active = it.value === value
                return (
                    <button
                        key={it.value}
                        type="button"
                        onClick={() => onChange(it.value)}
                        className={cx(
                            'rounded-xl px-3 py-1.5 text-[12px] font-semibold transition',
                            active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-white'
                        )}
                    >
                        {it.label}
                    </button>
                )
            })}
        </div>
    )
}

function ConfirmSheet({ open, title, desc, confirmText, cancelText, onConfirm, onCancel, loading }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[80]">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-3xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-base font-semibold text-slate-900">{title}</div>
                        <div className="mt-1 text-sm text-slate-600">{desc}</div>
                    </div>
                    <button
                        type="button"
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                        onClick={loading ? undefined : onCancel}
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
                    <SoftButton type="button" onClick={loading ? undefined : onCancel}>
                        {cancelText}
                    </SoftButton>
                    <PrimaryButton type="button" onClick={loading ? undefined : onConfirm}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {confirmText}
                    </PrimaryButton>
                </div>
            </div>
        </div>
    )
}





/**
 * Props you can pass from parent (recommended):
 * - admissionId (required)
 * - canWrite (default true)
 * - locationId (Pharmacy location/store id for search + Rx)
 * - patientId, doctorUserId (optional but best for Pharmacy Rx)
 * - onRxCreated(optional): callback(res.data)
 */
export default function DischargeMedsTab({
    admission,
    admissionId,
    canWrite = true,
    locationId = "1",
    patient,
    doctorUserId = null,
    onRxCreated,
}) {
    console.log(admission, "ddvbjdsbvjsbvkbskvbsdkjb");
    const [serverRows, setServerRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')
    const finalizeLock = useRef(false)
    const [pendingRxLines, setPendingRxLines] = useState([])
    // UI view
    const [view, setView] = useState('draft') // draft | saved

    // Draft lines to save ONCE
    const [draftLines, setDraftLines] = useState([])

    // Search
    const [q, setQ] = useState('')
    const [searching, setSearching] = useState(false)
    const [hits, setHits] = useState([])
    const [openHits, setOpenHits] = useState(false)
    const searchRef = useRef(null)

    const [selected, setSelected] = useState(null) // PharmacyBatchPickOut

    // Form
    const [form, setForm] = useState({
        doseValue: '',
        doseUnit: 'mg',
        frequency: '',
        durationDays: '',
        instructions: '',
        dispenseQty: '', // optional: used for pharmacy dispensing
    })

    const [editingId, setEditingId] = useState(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [finalizing, setFinalizing] = useState(false)

    const hasServerRows = useMemo(() => Array.isArray(serverRows) && serverRows.length > 0, [serverRows])
    const hasDraft = useMemo(() => Array.isArray(draftLines) && draftLines.length > 0, [draftLines])

    const fieldBase =
        'w-full rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm backdrop-blur placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-sky-100'

    const load = async () => {
        if (!admissionId) return
        setLoading(true)
        setErr('')
        try {
            const { data } = await listDischargeMeds(admissionId)
            setServerRows(Array.isArray(data) ? data : [])
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to load discharge medicines'
            setErr(msg)
            toast.error(apiErrorText(e))
        } finally {
            setLoading(false)
        }
    }

    const pydanticErrToText = (x) => {
        if (!x) return "Something went wrong"
        if (typeof x === "string") return x
        if (Array.isArray(x)) {
            return x
                .map((e) => {
                    const loc = Array.isArray(e?.loc) ? e.loc.join(".") : ""
                    const msg = e?.msg || "Invalid"
                    return loc ? `${loc}: ${msg}` : msg
                })
                .join(" • ")
        }
        if (typeof x === "object") return x?.msg ? String(x.msg) : JSON.stringify(x)
        return String(x)
    }

    const apiErrorText = (err) => {
        const data = err?.response?.data
        const detail = data?.detail ?? data?.error ?? data
        return pydanticErrToText(detail) || err?.message || "Something went wrong"
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionId])

    // Close dropdown on outside click
    useEffect(() => {
        const onDoc = (e) => {
            if (!searchRef.current) return
            if (!searchRef.current.contains(e.target)) setOpenHits(false)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    // Debounced search
    useEffect(() => {
        let t = null
        const run = async () => {
            const term = String(q || '').trim()
            if (!term || term.length < 2) {
                setHits([])
                return
            }
            if (!locationId) {
                setHits([])
                return
            }
            setSearching(true)
            try {
                const res = await searchItemBatches({
                    location_id: locationId,
                    q: term,
                    limit: 15,
                    only_in_stock: true,
                    exclude_expired: true,
                    active_only: true,
                    type: 'drug',
                })
                const list = res?.data?.data || res?.data || []
                setHits(Array.isArray(list) ? list : [])
                setOpenHits(true)
            } catch (e) {
                setHits([])
            } finally {
                setSearching(false)
            }
        }

        t = setTimeout(run, 250)
        return () => clearTimeout(t)
    }, [q, locationId])

    const resetForm = () => {
        setQ('')
        setSelected(null)
        setOpenHits(false)
        setEditingId(null)
        setForm({
            doseValue: '',
            doseUnit: 'mg',
            frequency: '',
            durationDays: '',
            instructions: '',
            dispenseQty: '',
        })
    }

    const pickHit = (h) => {
        setSelected(h)
        setQ(h?.name ? `${h.name}${h.strength ? ` ${h.strength}` : ''}` : '')
        setOpenHits(false)
    }

    const quickFreq = (f) => setForm((s) => ({ ...s, frequency: f }))
    const quickDur = (d) => setForm((s) => ({ ...s, durationDays: String(d) }))

    const validateLine = () => {
        if (!canWrite) return { ok: false, msg: 'Not permitted' }
        if (!admissionId) return { ok: false, msg: 'Admission missing' }
        if (!selected?.item_id && !selected?.itemId && !selected?.id) return { ok: false, msg: 'Please select a drug from search' }

        const doseNum = form.doseValue.trim() ? Number(form.doseValue) : null
        if (form.doseValue && Number.isNaN(doseNum)) return { ok: false, msg: 'Dose must be a number (e.g. 500)' }

        const durNum = form.durationDays.trim() ? Number(form.durationDays) : null
        if (form.durationDays && (Number.isNaN(durNum) || !Number.isInteger(durNum))) {
            return { ok: false, msg: 'Duration must be a whole number of days' }
        }

        const qtyNum = form.dispenseQty.trim() ? Number(form.dispenseQty) : null
        if (form.dispenseQty && (Number.isNaN(qtyNum) || qtyNum < 0)) return { ok: false, msg: 'Dispense qty must be a number' }

        return { ok: true, doseNum, durNum, qtyNum }
    }

    const upsertDraft = () => {
        const v = validateLine()
        if (!v.ok) {
            toast.error(apiErrorText(v.msg))
            return
        }

        const item_id = toInt(selected?.item_id ?? selected?.itemId ?? selected?.id)
        const batch_id = toInt(selected?.batch_id ?? selected?.batchId)

        const freq = String(form.frequency || '').trim()
        const duration_days = v.durNum

        const line = {
            _local_id: editingId || `L${Date.now()}${Math.random().toString(16).slice(2)}`,
            item_id,
            batch_id,
            drug_name: selected?.name || '',
            generic_name: selected?.generic_name || '',
            form: selected?.form || '',
            strength: selected?.strength || '',
            unit: selected?.unit || 'unit',
            batch_no: selected?.batch_no || '',
            expiry_date: selected?.expiry_date || null,
            available_qty: selected?.available_qty ?? null,

            dose: v.doseNum,
            dose_unit: form.doseUnit || '',
            route: '',

            frequency: freq,
            duration_days,
            advice_text: String(form.instructions || '').trim(),

            // for Pharmacy
            dispense_qty: v.qtyNum,
            mrp: selected?.mrp ?? null,
            tax_percent: selected?.tax_percent ?? null,
        }

        setDraftLines((prev) => {
            const idx = prev.findIndex((x) => x._local_id === line._local_id)
            if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = line
                return copy
            }
            return [line, ...prev]
        })

        toast.success(editingId ? 'Updated in draft' : 'Added to draft')
        resetForm()
    }

    const editDraft = (l) => {
        setEditingId(l._local_id)
        setSelected({
            item_id: l.item_id,
            batch_id: l.batch_id,
            name: l.drug_name,
            generic_name: l.generic_name,
            form: l.form,
            strength: l.strength,
            unit: l.unit,
            batch_no: l.batch_no,
            expiry_date: l.expiry_date,
            available_qty: l.available_qty,
            mrp: l.mrp,
            tax_percent: l.tax_percent,
        })
        setQ(l.drug_name || '')
        setForm({
            doseValue: l.dose == null ? '' : String(l.dose),
            doseUnit: l.dose_unit || 'mg',
            frequency: l.frequency || '',
            durationDays: l.duration_days == null ? '' : String(l.duration_days),
            instructions: l.advice_text || '',
            dispenseQty: l.dispense_qty == null ? '' : String(l.dispense_qty),
        })
        setView('draft')
    }

    const removeDraft = (id) => setDraftLines((prev) => prev.filter((x) => x._local_id !== id))

    const formatDose = (r) => {
        if (r?.dose == null && !r?.dose_unit) return '—'
        if (r?.dose == null) return r?.dose_unit || '—'
        return `${r.dose} ${r.dose_unit || ''}`.trim()
    }

    const formatDuration = (r) => {
        if (r?.duration_days == null) return '—'
        if (r?.duration_days === 0) return '0 days'
        return `${r.duration_days} days`
    }

    const buildDischargeBulkPayload = (lines) => {
        // Preferred single-call payload
        return {
            mode: 'replace',
            lines: lines.map((l) => ({
                drug_name: l.drug_name,
                dose: l.dose,
                dose_unit: l.dose_unit || '',
                route: l.route || '',
                frequency: l.frequency || '',
                duration_days: l.duration_days,
                advice_text: l.advice_text || '',
                // optional: include references for audit/merge later
                item_id: l.item_id,
                batch_id: l.batch_id,
                batch_no: l.batch_no,
            })),
        }
    }



    const toNumOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }

    const toIntOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null
        const n = Number(v)
        return Number.isInteger(n) ? n : null
    }
    const cleanText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
    const saveDischargeOnce = async (lines) => {
        const list = Array.isArray(lines) ? lines : []
        if (!list.length) return { used: 'legacy', count: 0 }

        for (const l of list) {
            const drug_name = cleanText(l?.drug_name)

            // ✅ must be present
            if (!drug_name) continue

            const payload = {
                drug_name,
                dose: toNumOrNull(l?.dose),
                dose_unit: cleanText(l?.dose_unit || ''),
                route: cleanText(l?.route || ''),
                frequency: cleanText(l?.frequency || ''),
                duration_days: toIntOrNull(l?.duration_days),
                advice_text: cleanText(l?.advice_text || ''),
            }

            // ✅ sequential, safe (no parallel)
            // eslint-disable-next-line no-await-in-loop
            await saveDischargeMeds(admissionId, payload)
        }

        return { used: 'legacy', count: list.length }
    }

    const buildPharmacyPayload = (lines) => {
        const rx_datetime = new Date().toISOString()

        const rxLines = lines?.map((l, idx) => {
            const frequency_code = freqToCode(l.frequency)

            // prevent 422 if empty / invalid
            if (!frequency_code) {
                throw new Error(`Frequency invalid for: ${l.drug_name || `Line ${idx + 1}`}`)
            }

            const duration_days = Number.isFinite(Number(l.duration_days)) ? Number(l.duration_days) : 0

            const autoQty = calcQtyFromFreqAndDuration(frequency_code, duration_days)
            let qty = Number.isFinite(Number(l.dispense_qty)) ? Number(l.dispense_qty) : autoQty

            // avoid qty = 0 causing 422
            if (!qty || qty <= 0) qty = 1

            return {
                item_id: toInt(l.item_id),
                item_name: l?.drug_name || '',
                strength: l.strength || null,
                route: l.route || null,

                frequency_code,
                duration_days,

                requested_qty: qty,
                total_qty: qty,

                dose: l.dose ?? null,
                instructions: l.advice_text || null,
                is_prn: String(l.frequency || '').toUpperCase().includes('PRN') || String(l.frequency || '').toUpperCase() === 'SOS',
                is_stat: false,
            }
        })

        return {
            type: 'IPD',
            priority: 'ROUTINE',       // ✅ add
            rx_datetime,               // ✅ add
            patient_id: patient.id ? toInt(patient.id) : null,
            doctor_user_id: admission?.practitioner_user_id ? toInt(admission?.practitioner_user_id) : null,
            ipd_admission_id: admissionId ? toInt(admissionId) : null,
            ot_case_id: null,          // ✅ add (safe)
            location_id: locationId ? toInt(locationId) : null,
            notes: 'Auto-generated from Discharge Medications',
            lines: rxLines,
        }
    }

    const finalizeNow = async () => {
        // ✅ hard lock prevents double-click / double-trigger
        if (finalizeLock.current) return

        // if there is nothing to do
        const hasPending = Array.isArray(pendingRxLines) && pendingRxLines.length > 0
        const hasDraftNow = Array.isArray(draftLines) && draftLines.length > 0
        if (!hasPending && !hasDraftNow) return

        finalizeLock.current = true
        setFinalizing(true)

        // ✅ snapshot so state changes won’t affect the in-flight request
        const linesSnapshot = (hasPending ? pendingRxLines : draftLines).map((x) => ({ ...x }))

        let dischargeSavedThisRun = false

        try {
            // 1) Discharge meds FIRST (only if not already saved)
            if (!hasPending) {
                const r = await saveDischargeOnce(linesSnapshot)
                dischargeSavedThisRun = true
                toast.success(r.used === "bulk" ? "Discharge meds saved (single call)" : "Discharge meds saved")

                // ✅ After discharge saved, store snapshot for Pharmacy retry flow
                setPendingRxLines(linesSnapshot)

                // ✅ Prevent duplicate discharge save if Pharmacy fails
                setDraftLines([])
                resetForm()
            }

            // 2) Pharmacy Rx AFTER discharge save (or retry pending)
            if (!locationId) {
                toast.message("Discharge meds saved. Pharmacy skipped (missing locationId).")

                // finished fully
                setPendingRxLines([])
                await load()
                setView("saved")
                setConfirmOpen(false)
                return
            }

            const payload = buildPharmacyPayload(linesSnapshot)
            const res = await createPharmacyPrescription(payload)

            toast.success("Sent to Pharmacy (single Rx)")
            if (res?.data && onRxCreated) onRxCreated(res.data)

            // ✅ success → clear pending
            setPendingRxLines([])
            await load()
            setView("saved")
            setConfirmOpen(false)
        } catch (e) {
            // ✅ never pass object/array to toast
            toast.error(apiErrorText(e))

            // If discharge succeeded but pharmacy failed, we keep pendingRxLines for retry
            if (dischargeSavedThisRun) {
                toast.message("Discharge saved. Pharmacy failed — tap Finalize again to retry Pharmacy only.")
            }
        } finally {
            setFinalizing(false)
            finalizeLock.current = false
        }
    }

    return (
        <div className="space-y-4 text-slate-900">
            {/* Premium Header */}
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="rounded-2xl border border-white/60 bg-white/60 p-2 shadow-sm backdrop-blur">
                            <Pill className="h-5 w-5 text-slate-900" />
                        </div>
                        <div>
                            <div className="text-[12px] font-semibold uppercase tracking-wide text-sky-900">
                                Discharge Medications
                            </div>
                            <div className="mt-0.5 text-sm text-slate-700">
                                Add multiple discharge meds → save once → send once to Pharmacy.
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <MiniPill>Draft: {draftLines.length}</MiniPill>
                                <MiniPill>Saved: {serverRows.length}</MiniPill>
                                {locationId ? <MiniPill>Location #{locationId}</MiniPill> : <MiniPill>Location not set</MiniPill>}
                            </div>
                        </div>
                    </div>

                    <Segmented
                        value={view}
                        onChange={setView}
                        items={[
                            { value: 'draft', label: 'Draft' },
                            { value: 'saved', label: 'Saved' },
                        ]}
                    />
                </div>
            </div>

            {err ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {err}
                </div>
            ) : null}

            {/* Draft Builder */}
            {view === 'draft' && (
                <div className="grid gap-4 lg:grid-cols-5">
                    {/* Left: Form */}
                    <div className="lg:col-span-2">
                        <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-900">
                                    {editingId ? 'Edit draft line' : 'Add to draft'}
                                </div>
                                <div className="text-[12px] text-slate-500">
                                    {canWrite ? 'Ready' : 'Read-only'}
                                </div>
                            </div>

                            {/* Drug Search */}
                            <div className="mt-3" ref={searchRef}>
                                <label className="mb-1 block text-[12px] font-medium text-slate-700">
                                    Drug search <span className="text-rose-500">*</span>
                                </label>

                                <div className="relative">
                                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm focus-within:ring-4 focus-within:ring-sky-100">
                                        <Search className="h-4 w-4 text-slate-500" />
                                        <input
                                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                                            value={q}
                                            onChange={(e) => {
                                                setQ(e.target.value)
                                                setSelected(null)
                                            }}
                                            onFocus={() => hits.length && setOpenHits(true)}
                                            placeholder={locationId ? 'Type at least 2 letters… (e.g., para, amox)' : 'Set locationId to search'}
                                            disabled={!canWrite}
                                        />
                                        {searching ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
                                        <button
                                            type="button"
                                            className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
                                            onClick={() => setOpenHits((s) => !s)}
                                            disabled={!canWrite}
                                            aria-label="Toggle results"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {/* Dropdown */}
                                    {openHits && canWrite && (
                                        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                                            {hits.length ? (
                                                <div className="max-h-72 overflow-auto">
                                                    {hits.map((h) => {
                                                        const inStock =
                                                            (typeof h?.available_qty === 'number' ? h.available_qty : h?.available_qty?.value) ??
                                                            null
                                                        return (
                                                            <button
                                                                key={`${h.batch_id}-${h.item_id}`}
                                                                type="button"
                                                                onClick={() => pickHit(h)}
                                                                className="w-full px-3 py-2 text-left hover:bg-slate-50"
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div>
                                                                        <div className="text-sm font-semibold text-slate-900">
                                                                            {h.name}{' '}
                                                                            <span className="text-slate-500 font-medium">
                                                                                {h.strength ? `• ${h.strength}` : ''}
                                                                            </span>
                                                                        </div>
                                                                        <div className="mt-0.5 text-[12px] text-slate-600">
                                                                            {h.generic_name ? `${h.generic_name} • ` : ''}
                                                                            {h.form ? `${h.form} • ` : ''}
                                                                            Batch: {h.batch_no || '—'}
                                                                            {h.expiry_date ? ` • Exp: ${h.expiry_date}` : ''}
                                                                        </div>
                                                                    </div>
                                                                    <div className="shrink-0 text-right">
                                                                        <div className="text-[11px] font-semibold text-slate-900">
                                                                            Stock: {inStock ?? '—'}
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500">
                                                                            MRP: {h.mrp?.value ?? h.mrp ?? '—'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="px-3 py-3 text-sm text-slate-600">
                                                    {q.trim().length < 2 ? 'Type more to search…' : 'No matches found.'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Selected badge */}
                                {selected ? (
                                    <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="font-semibold">
                                                {selected.name} {selected.strength ? `• ${selected.strength}` : ''}
                                            </div>
                                            <div className="text-[12px] text-emerald-700">
                                                Batch: {selected.batch_no || '—'} {selected.expiry_date ? `• Exp: ${selected.expiry_date}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Dose / Freq / Duration / Qty */}
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-[12px] font-medium text-slate-700">Dose</label>
                                    <div className="flex gap-2">
                                        <input
                                            className={fieldBase}
                                            style={{ width: '55%' }}
                                            value={form.doseValue}
                                            onChange={(e) => setForm((s) => ({ ...s, doseValue: e.target.value }))}
                                            placeholder="500"
                                            inputMode="decimal"
                                            disabled={!canWrite}
                                        />
                                        <select
                                            className={fieldBase}
                                            style={{ width: '45%' }}
                                            value={form.doseUnit}
                                            onChange={(e) => setForm((s) => ({ ...s, doseUnit: e.target.value }))}
                                            disabled={!canWrite}
                                        >
                                            {DOSE_UNITS.map((u) => (
                                                <option key={u} value={u}>
                                                    {u}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[12px] font-medium text-slate-700">Frequency</label>
                                    <input
                                        className={fieldBase}
                                        value={form.frequency}
                                        onChange={(e) => setForm((s) => ({ ...s, frequency: e.target.value }))}
                                        placeholder="BD / TDS / 1-0-1-0"
                                        disabled={!canWrite}
                                    />
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {FREQ_TEMPLATES.map((f) => (
                                            <button
                                                key={f}
                                                type="button"
                                                onClick={() => quickFreq(f)}
                                                className="rounded-full border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-white"
                                                disabled={!canWrite}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[12px] font-medium text-slate-700">Duration (days)</label>
                                    <input
                                        className={fieldBase}
                                        value={form.durationDays}
                                        onChange={(e) => setForm((s) => ({ ...s, durationDays: e.target.value }))}
                                        placeholder="5"
                                        inputMode="numeric"
                                        disabled={!canWrite}
                                    />
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {DURATION_TEMPLATES.map((d) => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => quickDur(d)}
                                                className="rounded-full border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-white"
                                                disabled={!canWrite}
                                            >
                                                {d}d
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[12px] font-medium text-slate-700">
                                        Dispense Qty <span className="text-slate-400">(optional)</span>
                                    </label>
                                    <input
                                        className={fieldBase}
                                        value={form.dispenseQty}
                                        onChange={(e) => setForm((s) => ({ ...s, dispenseQty: e.target.value }))}
                                        placeholder="Auto if empty"
                                        inputMode="numeric"
                                        disabled={!canWrite}
                                    />
                                    <div className="mt-2 text-[12px] text-slate-500">
                                        If empty, qty = (freq/day) × (duration days)
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="mt-4">
                                <label className="mb-1 block text-[12px] font-medium text-slate-700">Instructions</label>
                                <textarea
                                    className={cx(fieldBase, 'min-h-[90px]')}
                                    value={form.instructions}
                                    onChange={(e) => setForm((s) => ({ ...s, instructions: e.target.value }))}
                                    placeholder="After food, avoid alcohol, stop if rash…"
                                    disabled={!canWrite}
                                />
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
                                <SoftButton type="button" onClick={resetForm} disabled={!canWrite}>
                                    <X className="h-4 w-4" />
                                    Clear
                                </SoftButton>
                                <PrimaryButton type="button" onClick={upsertDraft} disabled={!canWrite}>
                                    <Plus className="h-4 w-4" />
                                    {editingId ? 'Update draft' : 'Add to draft'}
                                </PrimaryButton>
                            </div>
                        </div>
                    </div>

                    {/* Right: Draft list */}
                    <div className="lg:col-span-3">
                        <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-slate-700" />
                                    <div className="text-sm font-semibold text-slate-900">Draft medications</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <SoftButton
                                        type="button"
                                        onClick={() => setConfirmOpen(true)}
                                        disabled={!hasDraft || !canWrite}
                                        className="hidden md:inline-flex"
                                    >
                                        <Send className="h-4 w-4" />
                                        Finalize & Send
                                    </SoftButton>
                                </div>
                            </div>

                            {!hasDraft ? (
                                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                                    No draft lines yet. Search a drug and <b>Add to draft</b>.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {draftLines.map((l) => {
                                        const freqCode = freqToCode(l.frequency)
                                        const autoQty = calcQtyFromFreqAndDuration(freqCode, l.duration_days)
                                        const qty = Number.isFinite(Number(l.dispense_qty)) ? Number(l.dispense_qty) : autoQty

                                        const stock =
                                            (typeof l?.available_qty === 'number' ? l.available_qty : l?.available_qty?.value) ??
                                            null
                                        const stockWarn = stock != null && qty != null && Number(qty) > Number(stock)

                                        return (
                                            <div
                                                key={l._local_id}
                                                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                                            >
                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            {l.drug_name}{' '}
                                                            <span className="font-medium text-slate-500">
                                                                {l.strength ? `• ${l.strength}` : ''}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap gap-2">
                                                            <MiniPill>Dose: {formatDose(l)}</MiniPill>
                                                            <MiniPill>Freq: {l.frequency || '—'}</MiniPill>
                                                            <MiniPill>Dur: {formatDuration(l)}</MiniPill>
                                                            <MiniPill>Qty: {qty || 0}</MiniPill>
                                                            <MiniPill>Batch: {l.batch_no || '—'}</MiniPill>
                                                            {l.expiry_date ? <MiniPill>Exp: {l.expiry_date}</MiniPill> : null}
                                                            {stock != null ? <MiniPill>Stock: {stock}</MiniPill> : null}
                                                        </div>
                                                        {stockWarn ? (
                                                            <div className="mt-2 text-[12px] font-semibold text-rose-700">
                                                                Qty exceeds available stock.
                                                            </div>
                                                        ) : null}
                                                        {l.advice_text ? (
                                                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                                                {l.advice_text}
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="flex gap-2 md:justify-end">
                                                        <SoftButton type="button" onClick={() => editDraft(l)} disabled={!canWrite}>
                                                            <Check className="h-4 w-4" />
                                                            Edit
                                                        </SoftButton>
                                                        <DangerButton type="button" onClick={() => removeDraft(l._local_id)} disabled={!canWrite}>
                                                            <Trash2 className="h-4 w-4" />
                                                            Remove
                                                        </DangerButton>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Sticky mobile finalize bar */}
                            <div className="mt-4 md:hidden">
                                <PrimaryButton
                                    type="button"
                                    onClick={() => setConfirmOpen(true)}
                                    disabled={!hasDraft || !canWrite}
                                    className="w-full"
                                >
                                    <Send className="h-4 w-4" />
                                    Finalize & Send to Pharmacy
                                </PrimaryButton>
                            </div>

                            <div className="mt-3 text-[12px] text-slate-500">
                                Finalize will: <b>Save Discharge Meds first</b> (once), then <b>Create Pharmacy Rx</b> (once).
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Saved list */}
            {view === 'saved' && (
                <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Saved discharge medicines</div>
                        <div className="text-[12px] text-slate-500">{loading ? 'Loading…' : `${serverRows.length} items`}</div>
                    </div>

                    {!hasServerRows ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                            {loading ? 'Loading discharge medicines…' : 'No discharge medicines saved yet.'}
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="mt-4 hidden overflow-auto rounded-2xl border border-slate-200 bg-white md:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-[12px] text-slate-600">
                                            <th className="px-3 py-2 text-left">Drug</th>
                                            <th className="px-3 py-2 text-left">Dose</th>
                                            <th className="px-3 py-2 text-left">Frequency</th>
                                            <th className="px-3 py-2 text-left">Duration</th>
                                            <th className="px-3 py-2 text-left">Instructions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {serverRows.map((r) => (
                                            <tr key={r.id} className="border-t">
                                                <td className="px-3 py-2 font-semibold text-slate-900">{r.drug_name || '—'}</td>
                                                <td className="px-3 py-2 text-slate-700">{formatDose(r)}</td>
                                                <td className="px-3 py-2 text-slate-700">{r.frequency || '—'}</td>
                                                <td className="px-3 py-2 text-slate-700">{formatDuration(r)}</td>
                                                <td className="px-3 py-2 whitespace-pre-wrap text-slate-700">{r.advice_text || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="mt-4 space-y-3 md:hidden">
                                {serverRows.map((r) => (
                                    <div key={r.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="text-sm font-semibold text-slate-900">{r.drug_name || '—'}</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <MiniPill>Dose: {formatDose(r)}</MiniPill>
                                            <MiniPill>Freq: {r.frequency || '—'}</MiniPill>
                                            <MiniPill>Dur: {formatDuration(r)}</MiniPill>
                                        </div>
                                        {r.advice_text ? (
                                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.advice_text}</div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {pendingRxLines?.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="font-semibold">Pending Pharmacy</div>
                            <div className="text-[12px] text-amber-800">
                                Discharge meds saved. Pharmacy Rx not sent yet (or failed).
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={finalizeNow}
                            disabled={finalizing}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {finalizing ? "Retrying…" : "Retry Send to Pharmacy"}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm sheet: "Any additional meds?" */}
            <ConfirmSheet
                open={confirmOpen}
                title="Finalize discharge medications?"
                desc="If you still need to add more medications, tap “Add more”. If done, tap “Finalize & send” to save discharge meds first and then create Pharmacy Rx."
                cancelText="Add more"
                confirmText="Finalize & send"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={finalizeNow}
                loading={finalizing}
            />
        </div>
    )
}
