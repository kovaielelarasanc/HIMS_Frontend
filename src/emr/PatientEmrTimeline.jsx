// frontend/src/emr/PatientEmrTimeline.jsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { fetchEmrTimeline, exportEmrPdfJson, fetchFhirBundle } from '../api/emr'
import PatientQuickPicker from './PatientQuickPicker'
import {
    Stethoscope, Activity, FileText, FlaskConical, Scan, ShoppingCart,
    BedDouble, ArrowLeftRight, LogOut, Scissors, Receipt, Paperclip, ShieldCheck,
    Download, Filter, CalendarRange, User2, Dot, RotateCcw
} from 'lucide-react'

// ------------- helpers -------------
const ALL_TYPES = [
    { code: 'opd_visit', label: 'OPD Visit', icon: Stethoscope },
    { code: 'opd_vitals', label: 'Vitals', icon: Activity },
    { code: 'rx', label: 'Prescription', icon: FileText },
    { code: 'lab', label: 'Lab', icon: FlaskConical },
    { code: 'radiology', label: 'Radiology', icon: Scan },
    { code: 'pharmacy', label: 'Pharmacy', icon: ShoppingCart },
    { code: 'ipd_admission', label: 'IPD Admit', icon: BedDouble },
    { code: 'ipd_transfer', label: 'IPD Transfer', icon: ArrowLeftRight },
    { code: 'ipd_discharge', label: 'IPD Discharge', icon: LogOut },
    { code: 'ot', label: 'OT', icon: Scissors },
    { code: 'billing', label: 'Billing', icon: Receipt },
    { code: 'attachment', label: 'Attachment', icon: Paperclip },
    { code: 'consent', label: 'Consent', icon: ShieldCheck },
]

function pad(n) { return n < 10 ? '0' + n : '' + n }
function fmtDateTime(ts) {
    const d = new Date(ts)
    if (isNaN(d)) return String(ts || '')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function ymd(ts) {
    const d = new Date(ts)
    if (isNaN(d)) return '—'
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function groupByDate(items) {
    const map = new Map()
    items.forEach(it => {
        const k = ymd(it.ts)
        if (!map.has(k)) map.set(k, [])
        map.get(k).push(it)
    })
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

const chipBase = 'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition'
const statusStyles = {
    new: 'border-blue-200 bg-blue-50 text-blue-700',
    in_progress: 'border-amber-200 bg-amber-50 text-amber-800',
    dispensed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    cancelled: 'border-rose-200 bg-rose-50 text-rose-800',
}

// ------------- Component -------------
export default function PatientEmrTimeline() {
    const [patient, setPatient] = useState(null) // {id, uhid, name, gender, dob, phone}
    const [filters, setFilters] = useState({
        date_from: '',
        date_to: '',
        types: ALL_TYPES.map(t => t.code),
        consent_required: false, // toggle ON in prod if you want hard-consent gate
    })
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState([])
    const [fetchStamp, setFetchStamp] = useState(0)

    const selectedSet = useMemo(() => new Set(filters.types || []), [filters.types])

    const toggleType = (code) => {
        setFilters(f => {
            const set = new Set(f.types)
            if (set.has(code)) set.delete(code)
            else set.add(code)
            return { ...f, types: Array.from(set) }
        })
    }
    const selectAll = () => setFilters(f => ({ ...f, types: ALL_TYPES.map(t => t.code) }))
    const clearAll = () => setFilters(f => ({ ...f, types: [] }))

    // Load timeline
    useEffect(() => {
        let alive = true
        const run = async () => {
            if (!patient?.uhid) return
            try {
                setLoading(true)
                const { data } = await fetchEmrTimeline({
                    uhid: patient.uhid,
                    date_from: filters.date_from || undefined,
                    date_to: filters.date_to || undefined,
                    types:
                        filters.types && filters.types.length === ALL_TYPES.length
                            ? undefined
                            : filters.types,
                })
                if (!alive) return
                setItems(data || [])
            } catch (e) {
                console.error(e)
                toast.error(e?.response?.data?.detail || 'Failed to load EMR timeline')
                setItems([])
            } finally {
                setLoading(false)
            }
        }
        run()
        return () => { alive = false }
    }, [patient?.uhid, filters.date_from, filters.date_to, JSON.stringify(filters.types), fetchStamp])

    const grouped = useMemo(() => groupByDate(items), [items])

    // Export PDF (JSON body)
    const exportPdf = async () => {
        if (!patient) { toast.info('Select a patient first.'); return }
        try {
            const base = patient?.id ? { patient_id: patient.id } : { uhid: patient?.uhid }
            const payload = {
                ...base,
                date_from: filters.date_from || null,
                date_to: filters.date_to || null,
                sections: {
                    opd: selectedSet.has('opd_visit') || selectedSet.has('opd_vitals') || selectedSet.has('rx'),
                    ipd: selectedSet.has('ipd_admission') || selectedSet.has('ipd_transfer') || selectedSet.has('ipd_discharge'),
                    vitals: selectedSet.has('opd_vitals'),
                    prescriptions: selectedSet.has('rx'),
                    lab: selectedSet.has('lab'),
                    radiology: selectedSet.has('radiology'),
                    pharmacy: selectedSet.has('pharmacy'),
                    ot: selectedSet.has('ot'),
                    billing: selectedSet.has('billing'),
                    attachments: selectedSet.has('attachment'),
                    consents: selectedSet.has('consent'),
                },
                consent_required: !!filters.consent_required,
            }
            const res = await exportEmrPdfJson(payload)
            downloadBlob(res.data, `EMR_${patient.uhid || 'patient'}.pdf`)
            toast.success('PDF exported')
        } catch (e) {
            const status = e?.response?.status
            if (status === 412) {
                toast.error('Consent required. Enable consent capture or uncheck the “Require consent” box.')
            } else {
                toast.error(e?.response?.data?.detail || 'PDF export failed')
            }
        }
    }

    // Export FHIR (JSON)
    const exportFhir = async () => {
        if (!patient?.id) { toast.info('Patient id required; please pick from the search list.'); return }
        try {
            const { data } = await fetchFhirBundle(
                patient.id,
                filters.date_from || undefined,
                filters.date_to || undefined
            )
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            downloadBlob(blob, `FHIR_${patient.uhid || 'patient'}.json`)
            toast.success('FHIR bundle downloaded')
        } catch (e) {
            toast.error('FHIR export failed')
        }
    }

    // ---- details renderer per module (reads item.data) ----
    function RowKV({ k, v }) {
        if (v === null || v === undefined || v === '') return null
        return <div className="text-xs text-gray-700"><span className="font-medium">{k}:</span> {String(v)}</div>
    }

    function renderDetails(it) {
        const d = it.data || {}
        switch (it.type) {
            case 'opd_visit':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Chief Complaint" v={d.chief_complaint} />
                        <RowKV k="Symptoms" v={d.symptoms} />
                        <RowKV k="Subjective" v={d.subjective} />
                        <RowKV k="Objective" v={d.objective} />
                        <RowKV k="Assessment" v={d.assessment} />
                        <RowKV k="Plan" v={d.plan} />
                        <RowKV k="Episode" v={d.episode_id} />
                        {d.appointment && (
                            <div className="text-xs text-gray-700">
                                <span className="font-medium">Appointment:</span>{' '}
                                {d.appointment.date} · {d.appointment.slot_start}–{d.appointment.slot_end} · {d.appointment.purpose}
                            </div>
                        )}
                    </div>
                )
            case 'opd_vitals':
                return (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-800 md:grid-cols-3">
                        <RowKV k="Recorded at" v={d.recorded_at} />
                        <RowKV k="Height (cm)" v={d.height_cm} />
                        <RowKV k="Weight (kg)" v={d.weight_kg} />
                        <RowKV k="BMI" v={d.bmi} />
                        <RowKV k="BP" v={d.bp_systolic != null && d.bp_diastolic != null ? `${d.bp_systolic}/${d.bp_diastolic} mmHg` : ''} />
                        <RowKV k="Pulse" v={d.pulse} />
                        <RowKV k="RR" v={d.rr} />
                        <RowKV k="Temp (°C)" v={d.temp_c} />
                        <RowKV k="SpO₂ (%)" v={d.spo2} />
                        <div className="col-span-2 md:col-span-3"><RowKV k="Notes" v={d.notes} /></div>
                    </div>
                )
            case 'rx':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Notes" v={d.notes} />
                        <RowKV k="Signed at" v={d.signed_at} />
                        <RowKV k="Signed by" v={d.signed_by} />
                        {Array.isArray(d.items) && d.items.length > 0 && (
                            <div className="mt-2">
                                <div className="text-xs font-medium text-gray-700">Items</div>
                                <div className="mt-1 divide-y rounded-lg border">
                                    {d.items.map((x, i) => (
                                        <div key={i} className="grid gap-2 p-2 md:grid-cols-5">
                                            <div className="md:col-span-2"><span className="font-medium">{x.drug_name}</span> {x.strength ? `• ${x.strength}` : ''}</div>
                                            <div>Freq: {x.frequency || '—'}</div>
                                            <div>Dur: {x.duration_days}d</div>
                                            <div>Qty: {x.quantity}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            case 'lab': {
                const item = d.item || {}
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Order ID" v={d.order_id} />
                        <RowKV k="Priority" v={d.priority} />
                        <RowKV k="Collected at" v={d.collected_at} />
                        <RowKV k="Reported at" v={d.reported_at} />
                        <RowKV k="Test" v={`${item.test_name} (${item.test_code})`} />
                        <RowKV k="Unit" v={item.unit} />
                        <RowKV k="Normal range" v={item.normal_range} />
                        <RowKV k="Specimen" v={item.specimen_type} />
                        <RowKV k="Status" v={item.status} />
                        <RowKV k="Result" v={item.result_value} />
                        <RowKV k="Critical" v={item.is_critical ? 'Yes' : (item.is_critical === false ? 'No' : '')} />
                        <RowKV k="Result at" v={item.result_at} />
                    </div>
                )
            }
            case 'radiology':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Test" v={`${d.test_name} (${d.test_code})`} />
                        <RowKV k="Modality" v={d.modality} />
                        <RowKV k="Status" v={d.status} />
                        <RowKV k="Scheduled at" v={d.scheduled_at} />
                        <RowKV k="Scanned at" v={d.scanned_at} />
                        <RowKV k="Reported at" v={d.reported_at} />
                        <RowKV k="Approved at" v={d.approved_at} />
                        <RowKV k="Report" v={d.report_text} />
                    </div>
                )
            case 'pharmacy':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Sale ID" v={d.sale_id} />
                        <RowKV k="Context" v={d.context_type} />
                        <RowKV k="Payment" v={d.payment_mode} />
                        <RowKV k="Total" v={d.total_amount} />
                        {Array.isArray(d.items) && d.items.length > 0 && (
                            <div className="mt-2">
                                <div className="text-xs font-medium text-gray-700">Items</div>
                                <div className="mt-1 divide-y rounded-lg border">
                                    {d.items.map((x, i) => (
                                        <div key={i} className="grid gap-2 p-2 md:grid-cols-4">
                                            <div className="md:col-span-2">{x.medicine_name || `#${x.medicine_id}`}</div>
                                            <div>Qty: {x.qty}</div>
                                            <div>₹{x.amount}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            case 'ipd_admission':
                return (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-800 md:grid-cols-3">
                        <RowKV k="Admission Code" v={d.admission_code} />
                        <RowKV k="Type" v={d.admission_type} />
                        <RowKV k="Admitted at" v={d.admitted_at} />
                        <RowKV k="Expected Discharge" v={d.expected_discharge_at} />
                        <RowKV k="Bed" v={d.current_bed_code} />
                        <div className="col-span-2 md:col-span-3"><RowKV k="Preliminary Diagnosis" v={d.preliminary_diagnosis} /></div>
                        <div className="col-span-2 md:col-span-3"><RowKV k="History" v={d.history} /></div>
                        <div className="col-span-2 md:col-span-3"><RowKV k="Care Plan" v={d.care_plan} /></div>
                    </div>
                )
            case 'ipd_transfer':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Admission" v={d.admission_id} />
                        <RowKV k="From Bed" v={d.from_bed_id} />
                        <RowKV k="To Bed" v={d.to_bed_id} />
                        <RowKV k="Reason" v={d.reason} />
                        <RowKV k="Transferred at" v={d.transferred_at} />
                    </div>
                )
            case 'ipd_discharge':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Finalized" v={d.finalized ? 'Yes' : 'No'} />
                        <RowKV k="Finalized at" v={d.finalized_at} />
                        <RowKV k="Demographics" v={d.demographics} />
                        <RowKV k="Medical History" v={d.medical_history} />
                        <RowKV k="Treatment Summary" v={d.treatment_summary} />
                        <RowKV k="Medications" v={d.medications} />
                        <RowKV k="Follow Up" v={d.follow_up} />
                        <RowKV k="ICD-10 Codes" v={d.icd10_codes} />
                    </div>
                )
            case 'ot':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Surgery" v={d.surgery_name} />
                        <RowKV k="Code" v={d.surgery_code} />
                        <RowKV k="Estimated Cost" v={d.estimated_cost} />
                        <RowKV k="Scheduled" v={`${d.scheduled_start || ''} → ${d.scheduled_end || ''}`} />
                        <RowKV k="Actual" v={`${d.actual_start || ''} → ${d.actual_end || ''}`} />
                        <RowKV k="Status" v={d.status} />
                        <RowKV k="Pre-op Notes" v={d.preop_notes} />
                        <RowKV k="Post-op Notes" v={d.postop_notes} />
                    </div>
                )
            case 'billing':
                return (
                    <div className="mt-2 space-y-2 text-sm text-gray-800">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            <RowKV k="Invoice ID" v={d.invoice_id} />
                            <RowKV k="Status" v={d.status} />
                            <RowKV k="Net Total" v={d.net_total} />
                            <RowKV k="Balance" v={d.balance_due} />
                        </div>
                        {Array.isArray(d.items) && d.items.length > 0 && (
                            <div>
                                <div className="text-xs font-medium text-gray-700">Items</div>
                                <div className="mt-1 divide-y rounded-lg border">
                                    {d.items.map((x, i) => (
                                        <div key={i} className="grid gap-2 p-2 md:grid-cols-6">
                                            <div className="md:col-span-2">{x.description}</div>
                                            <div>{x.service_type}</div>
                                            <div>Qty: {x.quantity}</div>
                                            <div>Unit: ₹{x.unit_price}</div>
                                            <div>Total: ₹{x.line_total}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {Array.isArray(d.payments) && d.payments.length > 0 && (
                            <div>
                                <div className="text-xs font-medium text-gray-700">Payments</div>
                                <div className="mt-1 divide-y rounded-lg border">
                                    {d.payments.map((p, i) => (
                                        <div key={i} className="grid gap-2 p-2 md:grid-cols-4">
                                            <div>Mode: {p.mode}</div>
                                            <div>Ref: {p.reference_no || '—'}</div>
                                            <div>₹{p.amount}</div>
                                            <div>{p.paid_at}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            case 'attachment':
                return null
            case 'consent':
                return (
                    <div className="mt-2 space-y-1 text-sm text-gray-800">
                        <RowKV k="Type" v={d.type} />
                        <RowKV k="Captured at" v={d.captured_at} />
                        <RowKV k="Text" v={d.text} />
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className="mx-auto max-w-7xl p-4">
            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold tracking-tight">EMR Viewer</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFetchStamp(s => s + 1)}
                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Refresh
                    </button>
                    <button
                        onClick={exportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                    >
                        <Download className="h-4 w-4" />
                        Export PDF
                    </button>
                    <button
                        onClick={exportFhir}
                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                        <FileText className="h-4 w-4" />
                        Export FHIR (JSON)
                    </button>
                </div>
            </div>

            {/* Patient selector + Filters */}
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border bg-white p-4 lg:col-span-2">
                    <PatientQuickPicker
                        onPick={(p) => {
                            setPatient(p)
                            toast.success(`Selected ${p.uhid} — ${p.name}`)
                        }}
                    />
                    {patient && (
                        <div className="mt-3 rounded-xl border bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                            <div className="flex items-center gap-2">
                                <User2 className="h-4 w-4" />
                                <span className="font-medium">{patient.uhid}</span>
                                <Dot className="h-4 w-4" />
                                <span>{patient.name}</span>
                                {patient.gender ? <><Dot className="h-4 w-4" /><span className="uppercase">{patient.gender}</span></> : null}
                                {patient.dob ? <><Dot className="h-4 w-4" /><span>DOB {patient.dob}</span></> : null}
                                {patient.phone ? <><Dot className="h-4 w-4" /><span>{patient.phone}</span></> : null}
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border bg-white p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <CalendarRange className="h-4 w-4" /> Date Range
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="date"
                            className="rounded-xl border px-3 py-2 text-sm"
                            value={filters.date_from}
                            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                        />
                        <input
                            type="date"
                            className="rounded-xl border px-3 py-2 text-sm"
                            value={filters.date_to}
                            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                        />
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <Filter className="h-4 w-4" />
                            <span className="font-medium">Types</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-xs text-blue-700 hover:underline">All</button>
                            <button onClick={clearAll} className="text-xs text-gray-600 hover:underline">Clear</button>
                        </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                        {ALL_TYPES.map(t => {
                            const Icon = t.icon
                            const active = selectedSet.has(t.code)
                            return (
                                <button
                                    key={t.code}
                                    onClick={() => toggleType(t.code)}
                                    className={[
                                        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition',
                                        active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                                    ].join(' ')}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm">
                        <input
                            id="consentReq"
                            type="checkbox"
                            checked={!!filters.consent_required}
                            onChange={e => setFilters(f => ({ ...f, consent_required: e.target.checked }))}
                            className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="consentReq" className="select-none text-gray-700">
                            Require active consent for export
                        </label>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="mt-6 rounded-2xl border bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Stethoscope className="h-4 w-4" />
                    Timeline
                </div>

                {loading && (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
                        ))}
                    </div>
                )}

                {!loading && (!items || items.length === 0) && (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
                        Pick a patient and filters to load EMR timeline.
                    </div>
                )}

                {!loading && items && items.length > 0 && (
                    <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-gray-200 to-transparent" />
                        <div className="space-y-6">
                            {grouped.map(([day, rows]) => (
                                <div key={day} className="relative pl-10">
                                    {/* date badge */}
                                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                        <CalendarRange className="h-3.5 w-3.5" /> {day}
                                    </div>

                                    <div className="space-y-3">
                                        {rows.map((it, idx) => {
                                            const meta = [
                                                it.doctor_name ? `Dr. ${it.doctor_name}` : null,
                                                it.department_name || null,
                                                it.location_name || null,
                                            ].filter(Boolean).join('  •  ')

                                            const TypeIcon = (ALL_TYPES.find(t => t.code === it.type)?.icon) || FileText
                                            const s = it.status && (statusStyles[it.status] || "border-gray-200 bg-gray-50 text-gray-600")

                                            return (
                                                <div key={`${it.type}-${String(it.ts)}-${idx}`} className="relative">
                                                    {/* dot on the line */}
                                                    <div className="absolute -left-[9px] top-4 h-2.5 w-2.5 rounded-full border border-blue-200 bg-white" />
                                                    <div className="rounded-xl border p-3 hover:bg-gray-50">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex min-w-0 items-start gap-3">
                                                                <div className="mt-1 grid h-8 w-8 place-items-center rounded-lg bg-blue-600/10 text-blue-700">
                                                                    <TypeIcon className="h-4 w-4" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <div className="truncate text-sm font-semibold">{it.title || 'Event'}</div>
                                                                        <div className="text-xs text-gray-500">{fmtDateTime(it.ts)}</div>
                                                                        {it.status && (
                                                                            <span className={`${chipBase} ${s}`}>{it.status}</span>
                                                                        )}
                                                                    </div>
                                                                    {meta && <div className="text-xs text-gray-600">{meta}</div>}

                                                                    {/* details */}
                                                                    {renderDetails(it)}

                                                                    {/* attachments */}
                                                                    {it.attachments?.length > 0 && (
                                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                                            {it.attachments.map((a, i) => (
                                                                                <a
                                                                                    key={i}
                                                                                    href={a.url}
                                                                                    target="_blank"
                                                                                    rel="noopener"
                                                                                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                                                                                >
                                                                                    <Paperclip className="h-3.5 w-3.5" />
                                                                                    {a.label || 'attachment'}
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
