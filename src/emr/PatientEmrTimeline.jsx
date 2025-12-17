// FILE: frontend/src/emr/PatientEmrTimeline.jsx

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchEmrTimeline, exportEmrPdfJson, fetchFhirBundle } from '../api/emr'
import PatientQuickPicker from './PatientQuickPicker'

import {
    Stethoscope,
    Activity,
    FileText,
    FlaskConical,
    Scan,
    ShoppingCart,
    BedDouble,
    ArrowLeftRight,
    LogOut,
    Scissors,
    Receipt,
    Paperclip,
    ShieldCheck,
    Download,
    Filter,
    CalendarRange,
    User2,
    Dot,
    RotateCcw,
    Eye,
    X,
    Printer,
    LaptopMinimal,
    ClipboardList,
} from 'lucide-react'

// shadcn/ui
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// ------------- helpers -------------

// Include common timeline event types (so filters match what backend returns)
const ALL_TYPES = [
    { code: 'opd_appointment', label: 'OPD Appointment', icon: ClipboardList },
    { code: 'opd_visit', label: 'OPD Visit', icon: Stethoscope },
    { code: 'opd_vitals', label: 'Vitals', icon: Activity },
    { code: 'rx', label: 'Prescription', icon: FileText },

    { code: 'opd_lab_order', label: 'OPD Lab Order', icon: FlaskConical },
    { code: 'lab', label: 'Lab Result', icon: FlaskConical },

    { code: 'opd_radiology_order', label: 'OPD Radiology Order', icon: Scan },
    { code: 'radiology', label: 'Radiology', icon: Scan },

    { code: 'pharmacy_rx', label: 'Pharmacy RX', icon: ShoppingCart },
    { code: 'pharmacy', label: 'Pharmacy Sale', icon: ShoppingCart },

    { code: 'ipd_admission', label: 'IPD Admit', icon: BedDouble },
    { code: 'ipd_transfer', label: 'IPD Transfer', icon: ArrowLeftRight },
    { code: 'ipd_discharge', label: 'IPD Discharge', icon: LogOut },

    { code: 'ot', label: 'OT', icon: Scissors },
    { code: 'billing', label: 'Billing', icon: Receipt },
    { code: 'attachment', label: 'Attachment', icon: Paperclip },
    { code: 'consent', label: 'Consent', icon: ShieldCheck },
]

function pad(n) {
    return n < 10 ? '0' + n : '' + n
}

function fmtDateTime(ts) {
    const d = new Date(ts)
    if (isNaN(d)) return String(ts || '')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`
}

function ymd(ts) {
    const d = new Date(ts)
    if (isNaN(d)) return '—'
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function groupByDate(items) {
    const map = new Map()
    items.forEach((it) => {
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

function downloadFromUrl(url, filename) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'download'
    a.target = '_blank'
    a.rel = 'noopener'
    a.click()
}

const chipBase =
    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition'
const statusStyles = {
    new: 'border-slate-500 bg-slate-50 text-slate-700',
    in_progress: 'border-slate-500 bg-slate-50 text-slate-700',
    dispensed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
}

function inferFileKind(att) {
    const ct = (att.content_type || '').toLowerCase()
    const url = String(att.url || '').toLowerCase()

    if (ct.startsWith('image/')) return 'image'
    if (ct === 'application/pdf') return 'pdf'
    if (
        url.endsWith('.png') ||
        url.endsWith('.jpg') ||
        url.endsWith('.jpeg') ||
        url.endsWith('.webp') ||
        url.endsWith('.gif')
    )
        return 'image'
    if (url.endsWith('.pdf')) return 'pdf'
    return 'other'
}

// ✅ normalize visit payload (supports both flattened and {visit:{...}} formats)
function getVisitPayload(it) {
    const d = it?.data || {}
    const v = d.visit && typeof d.visit === 'object' ? d.visit : d

    return {
        chief_complaint: v.chief_complaint,
        symptoms: v.symptoms,

        // ✅ SOAP: accept either keys
        soap_subjective: v.soap_subjective ?? v.subjective,
        soap_objective: v.soap_objective ?? v.objective,
        soap_assessment: v.soap_assessment ?? v.assessment,

        plan: v.plan,

        episode_id: v.episode_id ?? d.episode_id,
        appointment: v.appointment ?? d.appointment,
    }
}

export default function PatientEmrTimeline() {
    const [patient, setPatient] = useState(null)
    const [filters, setFilters] = useState({
        date_from: '',
        date_to: '',
        types: ALL_TYPES.map((t) => t.code),
        consent_required: false,
    })
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState([])
    const [fetchStamp, setFetchStamp] = useState(0)

    const selectedSet = useMemo(() => new Set(filters.types || []), [filters.types])

    // EMR PDF preview
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
    const [showPdfPreview, setShowPdfPreview] = useState(false)

    // Attachment/file preview
    const [filePreview, setFilePreview] = useState(null)

    useEffect(() => {
        return () => {
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl)
        }
    }, [pdfPreviewUrl])

    const toggleType = (code) => {
        setFilters((f) => {
            const set = new Set(f.types)
            if (set.has(code)) set.delete(code)
            else set.add(code)
            return { ...f, types: Array.from(set) }
        })
    }
    const selectAll = () => setFilters((f) => ({ ...f, types: ALL_TYPES.map((t) => t.code) }))
    const clearAll = () => setFilters((f) => ({ ...f, types: [] }))

    // Load timeline
    useEffect(() => {
        let alive = true
        const run = async () => {
            if (!patient?.uhid && !patient?.id) return
            try {
                setLoading(true)
                const params = {
                    uhid: patient.uhid,
                    patient_id: patient.id,
                    date_from: filters.date_from || undefined,
                    date_to: filters.date_to || undefined,
                }
                if (filters.types && filters.types.length && filters.types.length !== ALL_TYPES.length) {
                    params.types = filters.types.join(',')
                }

                const { data } = await fetchEmrTimeline(params)
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
        return () => {
            alive = false
        }
    }, [
        patient?.uhid,
        patient?.id,
        filters.date_from,
        filters.date_to,
        JSON.stringify(filters.types),
        fetchStamp,
    ])

    const grouped = useMemo(() => groupByDate(items), [items])

    const totalEvents = items?.length || 0
    const dateRangeText =
        filters.date_from || filters.date_to
            ? `${filters.date_from || '—'} → ${filters.date_to || 'Today'}`
            : 'All available records'

    const exportPdf = async () => {
        if (!patient) {
            toast.info('Select a patient first.')
            return
        }
        try {
            const base = patient?.id ? { patient_id: patient.id } : { uhid: patient?.uhid }
            const payload = {
                ...base,
                date_from: filters.date_from || null,
                date_to: filters.date_to || null,
                sections: {
                    opd:
                        selectedSet.has('opd_visit') ||
                        selectedSet.has('opd_vitals') ||
                        selectedSet.has('rx') ||
                        selectedSet.has('opd_appointment'),
                    ipd:
                        selectedSet.has('ipd_admission') ||
                        selectedSet.has('ipd_transfer') ||
                        selectedSet.has('ipd_discharge'),
                    vitals: selectedSet.has('opd_vitals'),
                    prescriptions: selectedSet.has('rx'),
                    lab: selectedSet.has('lab') || selectedSet.has('opd_lab_order'),
                    radiology: selectedSet.has('radiology') || selectedSet.has('opd_radiology_order'),
                    pharmacy: selectedSet.has('pharmacy') || selectedSet.has('pharmacy_rx'),
                    ot: selectedSet.has('ot'),
                    billing: selectedSet.has('billing'),
                    attachments: selectedSet.has('attachment'),
                    consents: selectedSet.has('consent'),
                },
                consent_required: !!filters.consent_required,
            }

            const res = await exportEmrPdfJson(payload)
            const blob = res.data
            if (!(blob instanceof Blob)) {
                toast.error('PDF export failed: invalid response')
                return
            }

            setPdfPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return URL.createObjectURL(blob)
            })
            setShowPdfPreview(true)
            toast.success('EMR PDF ready for preview')
        } catch (e) {
            const status = e?.response?.status
            if (status === 412) {
                toast.error(
                    'Consent required. Enable consent capture or uncheck the “Require consent” box.'
                )
            } else {
                toast.error(e?.response?.data?.detail || 'PDF export failed')
            }
        }
    }

    const exportFhir = async () => {
        if (!patient?.id) {
            toast.info('Patient id required; please pick from the search list.')
            return
        }
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

    function RowKV({ k, v }) {
        if (v === null || v === undefined || v === '') return null
        return (
            <div className="text-xs text-slate-700">
                <span className="font-medium">{k}:</span> {String(v)}
            </div>
        )
    }

    function RowBlock({ k, v }) {
        if (v === null || v === undefined || v === '') return null
        return (
            <div className="text-xs text-slate-700">
                <div className="font-medium text-slate-900">{k}:</div>
                <div className="mt-0.5 whitespace-pre-wrap text-slate-700">{String(v)}</div>
            </div>
        )
    }

    function renderDetails(it) {
        const d = it.data || {}

        switch (it.type) {
            case 'opd_visit': {
                const v = getVisitPayload(it)
                return (
                    <div className="mt-2 space-y-2 text-sm text-slate-800">
                        <RowKV k="Chief Complaint" v={v.chief_complaint} />
                        <RowKV k="Symptoms" v={v.symptoms} />

                        {/* ✅ SOAP fields (now works) */}
                        <RowBlock k="Subjective" v={v.soap_subjective} />
                        <RowBlock k="Objective" v={v.soap_objective} />
                        <RowBlock k="Assessment" v={v.soap_assessment} />

                        <RowBlock k="Plan" v={v.plan} />
                        <RowKV k="Episode" v={v.episode_id} />

                        {v.appointment && (
                            <div className="text-xs text-slate-700">
                                <span className="font-medium">Appointment:</span>{' '}
                                {v.appointment.date} · {v.appointment.slot_start}–{v.appointment.slot_end} ·{' '}
                                {v.appointment.purpose}
                            </div>
                        )}
                    </div>
                )
            }

            case 'opd_vitals':
                return (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-800 md:grid-cols-3">
                        <RowKV k="Recorded at" v={d.recorded_at} />
                        <RowKV k="Height (cm)" v={d.height_cm} />
                        <RowKV k="Weight (kg)" v={d.weight_kg} />
                        <RowKV k="BMI" v={d.bmi} />
                        <RowKV
                            k="BP"
                            v={
                                d.bp_systolic != null && d.bp_diastolic != null
                                    ? `${d.bp_systolic}/${d.bp_diastolic} mmHg`
                                    : ''
                            }
                        />
                        <RowKV k="Pulse" v={d.pulse} />
                        <RowKV k="RR" v={d.rr} />
                        <RowKV k="Temp (°C)" v={d.temp_c} />
                        <RowKV k="SpO₂ (%)" v={d.spo2} />
                        <div className="col-span-2 md:col-span-3">
                            <RowBlock k="Notes" v={d.notes} />
                        </div>
                    </div>
                )

            case 'rx':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowBlock k="Notes" v={d.notes} />
                        <RowKV k="Signed at" v={d.signed_at} />
                        <RowKV k="Signed by" v={d.signed_by} />
                        {Array.isArray(d.items) && d.items.length > 0 && (
                            <div className="mt-2">
                                <div className="text-[11px] font-medium text-slate-600 uppercase tracking-wide">
                                    Items
                                </div>
                                <div className="mt-1 divide-y rounded-2xl border border-slate-500 bg-slate-50">
                                    {d.items.map((x, i) => (
                                        <div key={i} className="grid gap-2 p-2.5 md:grid-cols-5">
                                            <div className="md:col-span-2 text-xs">
                                                <span className="font-medium text-slate-900">{x.drug_name}</span>{' '}
                                                {x.strength ? <span className="text-slate-500">• {x.strength}</span> : null}
                                            </div>
                                            <div className="text-xs text-slate-600">Freq: {x.frequency || '—'}</div>
                                            <div className="text-xs text-slate-600">Dur: {x.duration_days}d</div>
                                            <div className="text-xs text-slate-600">Qty: {x.quantity}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )

            case 'opd_appointment':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="Date" v={d.date} />
                        <RowKV k="Slot" v={d.slot ? `${d.slot_start} – ${d.slot_end}` : undefined} />
                        <RowKV k="Purpose" v={d.purpose} />
                        <RowKV k="Status" v={d.status} />
                    </div>
                )

            case 'lab': {
                const item = d.item || {}
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="Order ID" v={d.order_id} />
                        <RowKV k="Collected at" v={d.collected_at} />
                        <RowKV k="Reported at" v={d.reported_at} />
                        <RowKV k="Test" v={item.test_name ? `${item.test_name} (${item.test_code})` : ''} />
                        <RowKV k="Result" v={item.result_value} />
                        <RowKV k="Unit" v={item.unit} />
                        <RowKV k="Normal range" v={item.normal_range} />
                        <RowKV k="Status" v={item.status} />
                    </div>
                )
            }

            case 'radiology':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="Test" v={d.test_name ? `${d.test_name} (${d.test_code})` : ''} />
                        <RowKV k="Modality" v={d.modality} />
                        <RowKV k="Status" v={d.status} />
                        <RowKV k="Reported at" v={d.reported_at} />
                        <RowBlock k="Report" v={d.report_text} />
                    </div>
                )

            case 'pharmacy':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="Sale ID" v={d.sale_id} />
                        <RowKV k="Payment" v={d.payment_mode} />
                        <RowKV k="Total" v={d.total_amount} />
                    </div>
                )

            case 'ipd_admission':
                return (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-800 md:grid-cols-3">
                        <RowKV k="Admission Code" v={d.admission_code} />
                        <RowKV k="Type" v={d.admission_type} />
                        <RowKV k="Admitted at" v={d.admitted_at} />
                        <RowKV k="Bed" v={d.current_bed_code} />
                        <div className="col-span-2 md:col-span-3">
                            <RowBlock k="Preliminary Diagnosis" v={d.preliminary_diagnosis} />
                        </div>
                    </div>
                )

            case 'ipd_transfer':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="From Bed" v={d.from_bed_id} />
                        <RowKV k="To Bed" v={d.to_bed_id} />
                        <RowBlock k="Reason" v={d.reason} />
                        <RowKV k="Transferred at" v={d.transferred_at} />
                    </div>
                )

            case 'ipd_discharge':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="Finalized" v={d.finalized ? 'Yes' : 'No'} />
                        <RowKV k="Finalized at" v={d.finalized_at} />
                        <RowBlock k="Treatment Summary" v={d.treatment_summary} />
                    </div>
                )

            case 'ot':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="Surgery" v={d.surgery_name} />
                        <RowKV k="Status" v={d.status} />
                        <RowBlock k="Pre-op Notes" v={d.preop_notes} />
                        <RowBlock k="Post-op Notes" v={d.postop_notes} />
                    </div>
                )

            case 'billing':
                return (
                    <div className="mt-2 space-y-2 text-sm text-slate-800">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            <RowKV k="Invoice ID" v={d.invoice_id} />
                            <RowKV k="Status" v={d.status} />
                            <RowKV k="Net Total" v={d.net_total} />
                            <RowKV k="Balance" v={d.balance_due} />
                        </div>
                    </div>
                )

            case 'consent':
                return (
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
                        <RowKV k="Type" v={d.type} />
                        <RowKV k="Captured at" v={d.captured_at} />
                        <RowBlock k="Text" v={d.text} />
                    </div>
                )

            case 'attachment':
            default:
                return null
        }
    }

    const openAttachmentPreview = (att) => {
        const kind = inferFileKind(att)
        if (kind === 'other') {
            window.open(att.url, '_blank', 'noopener,noreferrer')
            return
        }
        setFilePreview({
            url: att.url,
            label: att.label || 'Attachment',
            kind,
        })
    }

    const closeAttachmentPreview = () => setFilePreview(null)

    const printPdf = () => {
        if (!pdfPreviewUrl) return
        const win = window.open(pdfPreviewUrl)
        if (!win) return
        win.addEventListener('load', () => {
            win.focus()
            win.print()
        })
    }

    const downloadPdfFromPreview = () => {
        if (!pdfPreviewUrl || !patient) return
        downloadFromUrl(pdfPreviewUrl, `EMR_${patient.uhid || 'patient'}.pdf`)
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-6 lg:px-8">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        EMR · Patient record & timeline
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-white px-3 py-1 text-[10px] font-medium text-slate-500">
                        <LaptopMinimal className="h-3 w-3" />
                        Desktop workspace
                    </span>
                </div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <Card className="mb-5 rounded-3xl border-slate-500 bg-white shadow-sm">
                        <CardHeader className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-900 text-slate-50">
                                    <Stethoscope className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-semibold text-slate-900">Patient EMR Timeline</CardTitle>
                                    <CardDescription className="text-sm text-slate-600">
                                        Unified view of OPD, IPD, lab, radiology, pharmacy, billing, attachments and consents – export as EMR PDF.
                                    </CardDescription>
                                </div>
                            </div>

                            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3 sm:text-right">
                                <div className="rounded-2xl border border-slate-500 bg-slate-50 px-3 py-2">
                                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Selected patient</div>
                                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{patient ? patient.uhid : 'None'}</div>
                                    <div className="truncate text-[11px] text-slate-500">{patient ? patient.name : 'Use search to pick a patient'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-500 bg-slate-50 px-3 py-2">
                                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Total events</div>
                                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{totalEvents}</div>
                                    <div className="text-[11px] text-slate-500">Across visits, orders & billing</div>
                                </div>
                                <div className="rounded-2xl border border-slate-500 bg-slate-50 px-3 py-2">
                                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Date range</div>
                                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{dateRangeText}</div>
                                    <div className="text-[11px] text-slate-500">Filter scope for EMR export</div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-slate-500 bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500"
                                    >
                                        EMR Viewer
                                    </Badge>
                                    <span className="hidden text-[11px] text-slate-500 sm:inline">
                                        SOAP fields now render correctly (subjective/objective/assessment).
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="inline-flex items-center gap-1 rounded-full border-slate-500 bg-white text-xs text-slate-700 hover:bg-slate-100"
                                        onClick={() => setFetchStamp((s) => s + 1)}
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Refresh
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                                        onClick={exportPdf}
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                        Preview / Print EMR PDF
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="inline-flex items-center gap-1 rounded-full border-slate-500 bg-white text-xs text-slate-700 hover:bg-slate-100"
                                        onClick={exportFhir}
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                        Export FHIR (JSON)
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <div className="mt-4 lg:grid lg:grid-cols-[280px,minmax(0,1fr)] lg:gap-6">
                    <div className="mb-4 space-y-4 lg:mb-0 lg:sticky lg:top-24">
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }}>
                            <Card className="rounded-3xl border-slate-500 bg-white shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Patient</CardTitle>
                                    <CardDescription className="text-xs text-slate-500">Search and select a patient to view EMR timeline.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <PatientQuickPicker
                                        onPick={(p) => {
                                            setPatient(p)
                                            toast.success(`Selected ${p.uhid} — ${p.name}`)
                                        }}
                                    />
                                    {patient && (
                                        <div className="rounded-2xl border border-slate-500 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <User2 className="h-3.5 w-3.5 text-slate-500" />
                                                <span className="font-medium text-slate-900">{patient.uhid}</span>
                                                <Dot className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="truncate">{patient.name}</span>
                                                {patient.gender && (
                                                    <>
                                                        <Dot className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="uppercase text-slate-500">{patient.gender}</span>
                                                    </>
                                                )}
                                                {patient.dob && (
                                                    <>
                                                        <Dot className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="text-slate-500">DOB {patient.dob}</span>
                                                    </>
                                                )}
                                                {patient.phone && (
                                                    <>
                                                        <Dot className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="text-slate-500">{patient.phone}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.1 }}>
                            <Card className="rounded-3xl border-slate-500 bg-white shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Filters</CardTitle>
                                    <CardDescription className="text-xs text-slate-500">Date range, types and consent requirement.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-900">
                                            <CalendarRange className="h-3.5 w-3.5 text-slate-500" />
                                            Date range
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="relative">
                                                <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                                <Input
                                                    type="date"
                                                    className="h-8 rounded-2xl border-slate-500 bg-slate-50 pl-8 pr-2 text-xs text-slate-700"
                                                    value={filters.date_from}
                                                    onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                                                />
                                            </div>
                                            <div className="relative">
                                                <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                                <Input
                                                    type="date"
                                                    className="h-8 rounded-2xl border-slate-500 bg-slate-50 pl-8 pr-2 text-xs text-slate-700"
                                                    value={filters.date_to}
                                                    onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <p className="mt-1 text-[11px] text-slate-500">Leave blank for full EMR history.</p>
                                    </div>

                                    <div>
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                                                <Filter className="h-3.5 w-3.5 text-slate-500" />
                                                Types
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={selectAll} className="text-[10px] font-medium text-slate-600 hover:text-slate-900">
                                                    All
                                                </button>
                                                <button type="button" onClick={clearAll} className="text-[10px] font-medium text-slate-500 hover:text-slate-900">
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            {ALL_TYPES.map((t) => {
                                                const Icon = t.icon
                                                const active = selectedSet.has(t.code)
                                                return (
                                                    <button
                                                        key={t.code}
                                                        type="button"
                                                        onClick={() => toggleType(t.code)}
                                                        className={[
                                                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition',
                                                            active
                                                                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                                                : 'border-slate-500 bg-white text-slate-600 hover:bg-slate-50',
                                                        ].join(' ')}
                                                    >
                                                        <Icon className="h-3 w-3" />
                                                        {t.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2 rounded-2xl border border-slate-500 bg-slate-50 px-3 py-2">
                                        <input
                                            id="consentReq"
                                            type="checkbox"
                                            checked={!!filters.consent_required}
                                            onChange={(e) => setFilters((f) => ({ ...f, consent_required: e.target.checked }))}
                                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                                        />
                                        <div className="space-y-0.5">
                                            <label htmlFor="consentReq" className="block text-xs font-medium text-slate-900">
                                                Require active consent for export
                                            </label>
                                            <p className="text-[11px] text-slate-500">
                                                When enabled, EMR PDF export is blocked unless a valid patient consent exists.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.08 }}
                        className="space-y-4"
                    >
                        <Card className="rounded-3xl border-slate-500 bg-white shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Stethoscope className="h-4 w-4 text-slate-500" />
                                        <CardTitle className="text-sm font-semibold text-slate-900">Timeline</CardTitle>
                                    </div>
                                    <span className="text-[11px] text-slate-500">Sorted newest to oldest</span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loading && (
                                    <div className="space-y-3">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Skeleton key={i} className="h-16 w-full rounded-2xl bg-slate-100" />
                                        ))}
                                    </div>
                                )}

                                {!loading && (!items || items.length === 0) && (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                                        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-500 bg-white text-slate-500">
                                            <Stethoscope className="h-4 w-4" />
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900">No EMR events to display</div>
                                        <p className="mt-1 text-xs text-slate-500">Pick a patient and adjust filters to load timeline.</p>
                                    </div>
                                )}

                                {!loading && items && items.length > 0 && (
                                    <div className="relative">
                                        <div className="absolute bottom-0 left-4 top-0 w-px bg-gradient-to-b from-slate-200 via-slate-200/70 to-transparent" />
                                        <div className="space-y-6">
                                            {grouped.map(([day, rows]) => (
                                                <div key={day} className="relative pl-10">
                                                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-500 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                                                        <CalendarRange className="h-3.5 w-3.5 text-slate-500" />
                                                        {day}
                                                    </div>

                                                    <div className="space-y-3">
                                                        {rows.map((it, idx) => {
                                                            const meta = [
                                                                it.doctor_name ? `Dr. ${it.doctor_name}` : null,
                                                                it.department_name || null,
                                                                it.location_name || null,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' • ')

                                                            const TypeIcon = ALL_TYPES.find((t) => t.code === it.type)?.icon || FileText
                                                            const s =
                                                                it.status &&
                                                                (statusStyles[it.status] || 'border-slate-500 bg-slate-50 text-slate-600')

                                                            return (
                                                                <motion.div
                                                                    key={`${it.type}-${String(it.ts)}-${idx}`}
                                                                    initial={{ opacity: 0, y: 4 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ duration: 0.15 }}
                                                                    className="relative"
                                                                >
                                                                    <div className="absolute -left-[9px] top-4 h-2.5 w-2.5 rounded-full border border-slate-500 bg-white" />
                                                                    <div className="rounded-2xl border border-slate-500 bg-white p-3.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="flex min-w-0 items-start gap-3">
                                                                                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
                                                                                    <TypeIcon className="h-4 w-4" />
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                                        <div className="truncate text-sm font-semibold text-slate-900">
                                                                                            {it.title || 'Event'}
                                                                                        </div>
                                                                                        <div className="text-[11px] text-slate-500">{fmtDateTime(it.ts)}</div>
                                                                                        {it.status && <span className={`${chipBase} ${s}`}>{it.status}</span>}
                                                                                    </div>

                                                                                    {meta && <div className="mt-0.5 text-[11px] text-slate-500">{meta}</div>}

                                                                                    {renderDetails(it)}

                                                                                    {it.attachments?.length > 0 && (
                                                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                                                            {it.attachments.map((a, i) => {
                                                                                                const kind = inferFileKind(a)
                                                                                                return (
                                                                                                    <div
                                                                                                        key={i}
                                                                                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-500 bg-slate-50 px-2.5 py-1 text-[10px]"
                                                                                                    >
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => openAttachmentPreview(a)}
                                                                                                            className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                                                                                                        >
                                                                                                            <Eye className="h-3 w-3" />
                                                                                                            {a.label || 'attachment'}
                                                                                                        </button>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => downloadFromUrl(a.url, a.label || 'attachment')}
                                                                                                            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700"
                                                                                                        >
                                                                                                            <Download className="h-3 w-3" />
                                                                                                            <span className="hidden sm:inline">Download</span>
                                                                                                        </button>
                                                                                                        <span className="text-[9px] uppercase text-slate-400">{kind}</span>
                                                                                                    </div>
                                                                                                )
                                                                                            })}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>

            {showPdfPreview && pdfPreviewUrl && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
                    <div className="relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-500 bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-500 px-4 py-2.5">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">EMR PDF Preview</div>
                                {patient && <div className="text-[11px] text-slate-500">{patient.uhid} — {patient.name}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="inline-flex items-center gap-1 rounded-full border-slate-500 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
                                    onClick={downloadPdfFromPreview}
                                >
                                    <Download className="h-3 w-3" />
                                    Download
                                </Button>
                                <Button
                                    size="sm"
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] text-white hover:bg-slate-800"
                                    onClick={printPdf}
                                >
                                    <Printer className="h-3 w-3" />
                                    Print
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setShowPdfPreview(false)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100">
                            <iframe src={pdfPreviewUrl} title="EMR PDF" className="h-full w-full" />
                        </div>
                    </div>
                </div>
            )}

            {filePreview && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
                    <div className="relative flex h-[90vh] w-[95vw] max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-500 bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-500 px-4 py-2.5">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{filePreview.label}</div>
                                <div className="text-[11px] uppercase text-slate-400">{filePreview.kind} preview</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="inline-flex items-center gap-1 rounded-full border-slate-500 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
                                    onClick={() => downloadFromUrl(filePreview.url, filePreview.label)}
                                >
                                    <Download className="h-3 w-3" />
                                    Download
                                </Button>
                                <button
                                    type="button"
                                    onClick={closeAttachmentPreview}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100">
                            {filePreview.kind === 'image' && (
                                <div className="flex h-full w-full items-center justify-center overflow-auto bg-black">
                                    <img src={filePreview.url} alt={filePreview.label} className="max-h-full max-w-full object-contain" />
                                </div>
                            )}
                            {filePreview.kind === 'pdf' && (
                                <iframe src={filePreview.url} title={filePreview.label} className="h-full w-full" />
                            )}
                            {filePreview.kind === 'other' && (
                                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600">
                                    <p>This file type can’t be previewed here. You can open it in a new tab or download it.</p>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="rounded-full bg-slate-900 px-4 py-1 text-[11px] text-white hover:bg-slate-800"
                                            onClick={() => window.open(filePreview.url, '_blank', 'noopener,noreferrer')}
                                        >
                                            Open in new tab
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-full border-slate-500 bg-white px-4 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                                            onClick={() => downloadFromUrl(filePreview.url, filePreview.label)}
                                        >
                                            Download
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
