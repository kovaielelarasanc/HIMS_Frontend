// FILE: src/components/QuickOrders.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    FlaskConical,
    Radio,
    Pill,
    ScissorsLineDashed,
    Activity,
    Clock,
    User,
    BedDouble,
    Hash,
    AlertTriangle,
    Search,
    Loader2,
    Download,
    Eye,
    Printer,
    FileText,
    ClipboardCopy,
    Sparkles,
    Trash2,
    Upload,
    Link as LinkIcon,
    Save,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

// ---- Quick Orders helpers ----
import {
    createPharmacyPrescriptionFromContext,
    createOtScheduleFromContext,
    listLabOrdersForContext,
    listRadiologyOrdersForContext,
    listPharmacyPrescriptionsForContext,
    listOtSchedulesForContext,

    // ✅ Rx full details + PDF
    getRxDetails,
    downloadRxPdf,
} from '../api/quickOrders'

// ---- Core APIs for Lab & Radiology ----
import { listLabTests, createLisOrder } from '../api/lab'
import { listRisTests, createRisOrder } from '../api/ris'

// Pharmacy inventory search
import { searchPharmacyItems } from '../api/pharmacy'

// OT procedures master
import { listOtProcedures } from '../api/ot'

// 🔁 Reusable pickers for OT
import DoctorPicker from '../opd/components/DoctorPicker'
import WardRoomBedPicker from '../components/pickers/BedPicker'

const fadeIn = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.16 },
}

const LS_RX_TEMPLATES = 'nutryah_rx_templates_v1'

// -----------------------------
// Small UI helpers
// -----------------------------
function safePatientName(p) {
    if (!p) return 'Unknown patient'
    return (
        p.full_name ||
        p.name ||
        `${p.prefix || ''} ${p.first_name || ''} ${p.last_name || ''}`.replace(/\s+/g, ' ').trim()
    )
}

function safeGenderAge(p) {
    if (!p) return '—'
    const gender = p.gender || p.sex || '—'
    const age = p.age_display || p.age || '—'
    return `${gender} • ${age}`
}

function fmtDT(v) {
    if (!v) return '—'
    try {
        return new Date(v).toLocaleString()
    } catch {
        return String(v)
    }
}

function extractApiError(err, fallback = 'Something went wrong') {
    const detail = err?.response?.data?.detail

    if (typeof detail === 'string') return detail

    if (detail && !Array.isArray(detail) && typeof detail === 'object') {
        if (detail.msg) return detail.msg
        try {
            return JSON.stringify(detail)
        } catch {
            return fallback
        }
    }

    if (Array.isArray(detail)) {
        const msgs = detail.map((d) => d?.msg).filter(Boolean)
        if (msgs.length) return msgs.join(', ')
        try {
            return JSON.stringify(detail)
        } catch {
            return fallback
        }
    }

    if (err?.message) return err.message
    return fallback
}

function StatusChip({ children, tone = 'default' }) {
    const map = {
        default: 'bg-slate-100 text-slate-700',
        lab: 'bg-sky-50 text-sky-700',
        ris: 'bg-indigo-50 text-indigo-700',
        rx: 'bg-emerald-50 text-emerald-700',
        ot: 'bg-amber-50 text-amber-700',
    }
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
            {children}
        </span>
    )
}

// -----------------------------
// RX helpers (schedule + blobs)
// -----------------------------
function freqToSlots(freq) {
    if (!freq) return { am: 0, af: 0, pm: 0, night: 0 }
    const f = String(freq).trim().toUpperCase()

    if (f.includes('-')) {
        const parts = f.split('-').map((x) => parseInt(x || '0', 10) || 0)
        if (parts.length === 3) return { am: parts[0], af: parts[1], pm: 0, night: parts[2] }
        if (parts.length >= 4) return { am: parts[0], af: parts[1], pm: parts[2], night: parts[3] }
    }

    const map = {
        OD: { am: 1, af: 0, pm: 0, night: 0 },
        QD: { am: 1, af: 0, pm: 0, night: 0 },
        BD: { am: 1, af: 0, pm: 0, night: 1 },
        BID: { am: 1, af: 0, pm: 0, night: 1 },
        TID: { am: 1, af: 1, pm: 0, night: 1 },
        TDS: { am: 1, af: 1, pm: 0, night: 1 },
        QID: { am: 1, af: 1, pm: 1, night: 1 },
        HS: { am: 0, af: 0, pm: 0, night: 1 },
        NIGHT: { am: 0, af: 0, pm: 0, night: 1 },
    }
    return map[f] || { am: 0, af: 0, pm: 0, night: 0 }
}

function slotsToFreq(slots) {
    const a = slots?.am ? 1 : 0
    const b = slots?.af ? 1 : 0
    const c = slots?.pm ? 1 : 0
    const d = slots?.night ? 1 : 0
    return `${a}-${b}-${c}-${d}`
}

function openBlobInNewTab(blob) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function printBlob(blob) {
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) {
        toast.error('Popup blocked. Please allow popups to print.')
        return
    }
    const timer = setInterval(() => {
        try {
            w.focus()
            w.print()
            clearInterval(timer)
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
        } catch { }
    }, 700)
    setTimeout(() => clearInterval(timer), 8000)
}

// -----------------------------
// Lab PDF (your backend): /lab/orders/{id}/report-pdf
// -----------------------------
function openLabPdf(orderId) {
    const base = (import.meta?.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')
    const url = `${base}/lab/orders/${orderId}/report-pdf`
    window.open(url, '_blank', 'noopener,noreferrer')
}

// -----------------------------
// RX templates in localStorage
// -----------------------------
function loadRxTemplates() {
    try {
        const raw = localStorage.getItem(LS_RX_TEMPLATES)
        const arr = raw ? JSON.parse(raw) : []
        return Array.isArray(arr) ? arr : []
    } catch {
        return []
    }
}

function saveRxTemplates(templates) {
    try {
        localStorage.setItem(LS_RX_TEMPLATES, JSON.stringify(templates || []))
    } catch { }
}

// -----------------------------
// Optional RIS attachments via dynamic import
// (so build won’t fail if your api/ris.js doesn’t export these yet)
// -----------------------------
async function risModule() {
    try {
        return await import('../api/ris')
    } catch {
        return null
    }
}

// ------------------------------------------------------
// Main component
// ------------------------------------------------------
function QuickOrders({
    patient,
    contextType, // 'opd' | 'ipd'
    contextId, // visit_id / ipd_admission_id
    opNumber,
    ipNumber,
    bedLabel,
    currentUser,
    defaultLocationId,
}) {
    const [activeTab, setActiveTab] = useState('lab')

    const [loadingSummary, setLoadingSummary] = useState(false)
    const [summary, setSummary] = useState({ lab: [], ris: [], rx: [], ot: [] })

    // ------------- LAB state -------------
    const [labQuery, setLabQuery] = useState('')
    const [labOptions, setLabOptions] = useState([])
    const [labSearching, setLabSearching] = useState(false)
    const [showLabDropdown, setShowLabDropdown] = useState(false)
    const labDropRef = useRef(null)

    const [labSelectedTests, setLabSelectedTests] = useState([]) // [{id, code, name}]
    const [labPriority, setLabPriority] = useState('routine')
    const [labNote, setLabNote] = useState('')
    const [labSubmitting, setLabSubmitting] = useState(false)

    const labTestIds = useMemo(() => labSelectedTests.map((t) => t.id), [labSelectedTests])

    // ------------- RIS state -------------
    const [risQuery, setRisQuery] = useState('')
    const [risOptions, setRisOptions] = useState([])
    const [risSearching, setRisSearching] = useState(false)
    const [showRisDropdown, setShowRisDropdown] = useState(false)
    const risDropRef = useRef(null)

    const [risSelectedTests, setRisSelectedTests] = useState([]) // [{id, code, name, modality}]
    const [risPriority, setRisPriority] = useState('routine')
    const [risNote, setRisNote] = useState('')
    const [risSubmitting, setRisSubmitting] = useState(false)

    const risTestIds = useMemo(() => risSelectedTests.map((t) => t.id), [risSelectedTests])

    // ------------- Pharmacy state -------------
    const [rxQuery, setRxQuery] = useState('')
    const [rxOptions, setRxOptions] = useState([])
    const [rxSearching, setRxSearching] = useState(false)
    const [showRxDropdown, setShowRxDropdown] = useState(false)
    const rxDropRef = useRef(null)

    const [rxSelectedItem, setRxSelectedItem] = useState(null)
    const [rxLines, setRxLines] = useState([])
    const [rxDose, setRxDose] = useState('')
    const [rxDuration, setRxDuration] = useState('5')
    const [rxQty, setRxQty] = useState('10')
    const [rxRoute, setRxRoute] = useState('oral')
    const [rxTiming, setRxTiming] = useState('BF')
    const [rxNote, setRxNote] = useState('')
    const [rxSubmitting, setRxSubmitting] = useState(false)

    // schedule builder
    const [rxSlots, setRxSlots] = useState({ am: true, af: false, pm: false, night: true })

    // templates/macros
    const [rxTemplates, setRxTemplates] = useState(() => loadRxTemplates())
    const [rxTemplateId, setRxTemplateId] = useState('')

    // after create Rx
    const [lastRx, setLastRx] = useState(null)

    // ------------- OT state -------------
    const [otDate, setOtDate] = useState('')
    const [otStart, setOtStart] = useState('')
    const [otEnd, setOtEnd] = useState('')

    const [otProcedureQuery, setOtProcedureQuery] = useState('')
    const [otProcedureOptions, setOtProcedureOptions] = useState([])
    const [otProcedureSearching, setOtProcedureSearching] = useState(false)
    const [showOtDropdown, setShowOtDropdown] = useState(false)
    const otDropRef = useRef(null)
    const [otSelectedProcedure, setOtSelectedProcedure] = useState(null)

    const [otPriority, setOtPriority] = useState('Elective')
    const [otSide, setOtSide] = useState('')
    const [otNote, setOtNote] = useState('')

    const [otBedId, setOtBedId] = useState(null)
    const [otSurgeonId, setOtSurgeonId] = useState(currentUser?.id || null)
    const [otAnaesthetistId, setOtAnaesthetistId] = useState(null)
    const [otSubmitting, setOtSubmitting] = useState(false)

    // ------------- Details sheet -------------
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailsType, setDetailsType] = useState(null) // 'lab' | 'ris' | 'rx' | 'ot'
    const [detailsItem, setDetailsItem] = useState(null)
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [detailsFull, setDetailsFull] = useState(null)

    // RIS attachments + notes (in details)
    const [risAttachments, setRisAttachments] = useState([])
    const [risAttLoading, setRisAttLoading] = useState(false)
    const [risUploadFile, setRisUploadFile] = useState(null)
    const [risUploadNote, setRisUploadNote] = useState('')
    const [risLinkUrl, setRisLinkUrl] = useState('')
    const [risLinkNote, setRisLinkNote] = useState('')
    const [risNotes, setRisNotes] = useState('')
    const [risNotesSaving, setRisNotesSaving] = useState(false)

    const closeDetails = () => {
        setDetailsOpen(false)
        setDetailsType(null)
        setDetailsItem(null)
        setDetailsFull(null)
        setDetailsLoading(false)

        setRisAttachments([])
        setRisAttLoading(false)
        setRisUploadFile(null)
        setRisUploadNote('')
        setRisLinkUrl('')
        setRisLinkNote('')
        setRisNotes('')
        setRisNotesSaving(false)
    }

    // ------------------------------------------------------
    // Context helpers
    // ------------------------------------------------------
    const ctx = useMemo(() => {
        if (!contextType) return null
        const v = String(contextType).toLowerCase()
        if (v === 'op' || v === 'opd') return 'opd'
        if (v === 'ip' || v === 'ipd') return 'ipd'
        return v
    }, [contextType])

    const contextLabel = ctx === 'ipd' ? 'IPD Admission' : 'OPD Visit'
    const contextNumberLabel =
        ctx === 'ipd'
            ? ipNumber
                ? `IP No: ${ipNumber}`
                : 'IP Number not set'
            : opNumber
                ? `OP No: ${opNumber}`
                : 'OP Number not set'

    const bedInfo = ctx === 'ipd' && bedLabel ? `Bed: ${bedLabel}` : null
    const orderingUserId = currentUser?.id || null

    // ------------------------------------------------------
    // Close dropdown on outside click / ESC (extreme UX)
    // ------------------------------------------------------
    useEffect(() => {
        const onDown = (e) => {
            const t = e.target
            if (labDropRef.current && !labDropRef.current.contains(t)) setShowLabDropdown(false)
            if (risDropRef.current && !risDropRef.current.contains(t)) setShowRisDropdown(false)
            if (rxDropRef.current && !rxDropRef.current.contains(t)) setShowRxDropdown(false)
            if (otDropRef.current && !otDropRef.current.contains(t)) setShowOtDropdown(false)
        }
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setShowLabDropdown(false)
                setShowRisDropdown(false)
                setShowRxDropdown(false)
                setShowOtDropdown(false)
            }
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [])

    // ------------------------------------------------------
    // Load recent orders summary
    // ------------------------------------------------------
    const loadSummary = useCallback(async () => {
        if (!patient?.id || !ctx || !contextId) return
        setLoadingSummary(true)
        try {
            const [lab, ris, rx, ot] = await Promise.all([
                listLabOrdersForContext({ patientId: patient.id, contextType: ctx, contextId, limit: 10 }),
                listRadiologyOrdersForContext({ patientId: patient.id, contextType: ctx, contextId, limit: 10 }),
                listPharmacyPrescriptionsForContext({ patientId: patient.id, contextType: ctx, contextId, limit: 10 }),
                ctx === 'ipd'
                    ? listOtSchedulesForContext({ patientId: patient.id, admissionId: contextId, limit: 10 })
                    : Promise.resolve([]),
            ])
            setSummary({ lab: lab || [], ris: ris || [], rx: rx || [], ot: ot || [] })
        } catch (err) {
            console.error('Failed to load quick orders summary', err)
            toast.error('Unable to load recent orders for this patient.')
        } finally {
            setLoadingSummary(false)
        }
    }, [patient?.id, ctx, contextId])

    useEffect(() => {
        loadSummary()
    }, [loadSummary])

    // ------------------------------------------------------
    // LAB master search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!labQuery || labQuery.trim().length < 2) {
            setLabOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setLabSearching(true)
                const { data } = await listLabTests({ q: labQuery.trim() })
                if (cancelled) return
                const items = Array.isArray(data) ? data : data?.items || []
                setLabOptions(items)
                setShowLabDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error('Failed to fetch lab tests.')
            } finally {
                if (!cancelled) setLabSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [labQuery])

    function handleSelectLabTest(t) {
        if (!t?.id) return
        setLabSelectedTests((prev) => {
            if (prev.some((x) => x.id === t.id)) return prev
            return [...prev, { id: t.id, code: t.code || t.short_code || '', name: t.name || t.test_name || '' }]
        })
        setLabQuery('')
        setShowLabDropdown(false)
    }

    function handleRemoveLabTest(id) {
        setLabSelectedTests((prev) => prev.filter((t) => t.id !== id))
    }

    async function handleSubmitLab() {
        if (!labTestIds.length) return toast.error('Add at least one lab test.')
        if (!patient?.id) return toast.error('Patient missing for lab order.')
        if (!ctx || !contextId) return toast.error('Missing context (OPD/IPD) for lab order.')

        setLabSubmitting(true)
        try {
            await createLisOrder({
                patient_id: patient.id,
                context_type: ctx,
                context_id: contextId,
                priority: labPriority,
                test_ids: labTestIds,
                note: labNote || null,
            })
            toast.success('Lab order created')
            setLabSelectedTests([])
            setLabNote('')
            setLabQuery('')
            loadSummary()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, 'Failed to create lab order'))
        } finally {
            setLabSubmitting(false)
        }
    }

    // ------------------------------------------------------
    // RIS master search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!risQuery || risQuery.trim().length < 2) {
            setRisOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setRisSearching(true)
                const { data } = await listRisTests({ q: risQuery.trim() })
                if (cancelled) return
                const items = Array.isArray(data) ? data : data?.items || []
                setRisOptions(items)
                setShowRisDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error('Failed to fetch radiology tests.')
            } finally {
                if (!cancelled) setRisSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [risQuery])

    function handleSelectRisTest(t) {
        if (!t?.id) return
        setRisSelectedTests((prev) => {
            if (prev.some((x) => x.id === t.id)) return prev
            return [...prev, { id: t.id, code: t.code || '', name: t.name || t.test_name || '', modality: t.modality || t.modality_code || '' }]
        })
        setRisQuery('')
        setShowRisDropdown(false)
    }

    function handleRemoveRisTest(id) {
        setRisSelectedTests((prev) => prev.filter((t) => t.id !== id))
    }

    async function handleSubmitRis() {
        if (!risTestIds.length) return toast.error('Add at least one radiology test.')
        if (!patient?.id) return toast.error('Patient missing for radiology order.')
        if (!ctx || !contextId) return toast.error('Missing context (OPD/IPD) for radiology order.')

        setRisSubmitting(true)
        try {
            await Promise.all(
                risTestIds.map((id) =>
                    createRisOrder({
                        patient_id: patient.id,
                        test_id: Number(id),
                        context_type: ctx,
                        context_id: contextId,
                        ordering_user_id: orderingUserId,
                        priority: risPriority,
                        note: risNote || null,
                    }),
                ),
            )
            toast.success('Radiology order(s) created')
            setRisSelectedTests([])
            setRisNote('')
            setRisQuery('')
            loadSummary()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, 'Failed to create radiology order(s)'))
        } finally {
            setRisSubmitting(false)
        }
    }

    // ------------------------------------------------------
    // Pharmacy inventory search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!rxQuery || rxQuery.trim().length < 2) {
            setRxOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setRxSearching(true)
                const res = await searchPharmacyItems({ q: rxQuery.trim(), type: 'drug', limit: 20 })
                if (cancelled) return
                const items = Array.isArray(res?.data) ? res.data : []
                setRxOptions(items)
                setShowRxDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error('Failed to search medicines from inventory.')
            } finally {
                if (!cancelled) setRxSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [rxQuery])

    function handleSelectRxItem(it) {
        setRxSelectedItem(it)
        setRxQuery(it.name || '')
        setShowRxDropdown(false)
    }

    function applyRxMacro(name) {
        if (name === 'OD') setRxSlots({ am: true, af: false, pm: false, night: false })
        if (name === 'BD') setRxSlots({ am: true, af: false, pm: false, night: true })
        if (name === 'TID') setRxSlots({ am: true, af: true, pm: false, night: true })
        if (name === 'QID') setRxSlots({ am: true, af: true, pm: true, night: true })
        if (name === 'NIGHT') setRxSlots({ am: false, af: false, pm: false, night: true })
    }

    function handleAddRxLine() {
        if (!rxSelectedItem) return toast.error('Select a medicine from inventory.')
        const qty = parseFloat(rxQty || '0') || 0
        const duration = parseInt(rxDuration || '0', 10) || null
        if (!qty) return toast.error('Enter a valid quantity.')

        const frequency_code = slotsToFreq(rxSlots)

        setRxLines((prev) => [
            ...prev,
            {
                item_id: rxSelectedItem.id,
                item_name: rxSelectedItem.name,
                requested_qty: qty,
                dose_text: rxDose || null,
                frequency_code,
                duration_days: duration,
                route: rxRoute || null,
                timing: rxTiming || null,
                instructions: null,
            },
        ])

        setRxSelectedItem(null)
        setRxQuery('')
        setRxQty('10')
        setRxDose('')
    }

    function handleRemoveRxLine(idx) {
        setRxLines((prev) => prev.filter((_, i) => i !== idx))
    }

    async function handleSubmitRx() {
        if (!rxLines.length) return toast.error('Add at least one medicine.')
        if (!patient?.id || !ctx || !contextId) return toast.error('Missing patient or context for prescription.')

        setRxSubmitting(true)
        try {
            const created = await createPharmacyPrescriptionFromContext({
                patientId: patient.id,
                contextType: ctx,
                contextId,
                doctorUserId: orderingUserId,
                locationId: defaultLocationId,
                notes: rxNote,
                lines: rxLines,
            })

            toast.success('Prescription created & sent to Pharmacy.')
            setRxLines([])
            setRxNote('')
            setRxQuery('')
            setRxSelectedItem(null)
            setLastRx(created && typeof created === 'object' ? created : null)
            loadSummary()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, 'Failed to create prescription.'))
        } finally {
            setRxSubmitting(false)
        }
    }

    // ------------------------------------------------------
    // OT procedures master search (debounced)
    // ------------------------------------------------------
    useEffect(() => {
        if (!otProcedureQuery || otProcedureQuery.trim().length < 2) {
            setOtProcedureOptions([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            try {
                setOtProcedureSearching(true)
                const res = await listOtProcedures({ search: otProcedureQuery.trim(), isActive: true, limit: 20 })
                if (cancelled) return
                const items = Array.isArray(res?.data?.items)
                    ? res.data.items
                    : Array.isArray(res?.data)
                        ? res.data
                        : []
                setOtProcedureOptions(items)
                setShowOtDropdown(true)
            } catch (err) {
                console.error(err)
                toast.error('Failed to fetch OT procedures.')
            } finally {
                if (!cancelled) setOtProcedureSearching(false)
            }
        }, 180)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [otProcedureQuery])

    function handleSelectOtProcedure(p) {
        setOtSelectedProcedure(p)
        setOtProcedureQuery(p.name || p.procedure_name || '')
        setShowOtDropdown(false)
    }

    async function handleSubmitOt() {
        if (ctx !== 'ipd') return toast.warning('OT booking via quick orders is only for IPD.')
        if (!otDate || !otStart) return toast.warning('Please select OT date and start time.')
        if (!patient?.id || !contextId) return toast.error('Missing patient or admission for OT schedule.')

        const surgeonId = otSurgeonId || currentUser?.id
        if (!surgeonId) return toast.error('Please select a surgeon.')

        const procedureName = otSelectedProcedure
            ? otSelectedProcedure.name || otSelectedProcedure.procedure_name
            : otProcedureQuery?.trim()

        if (!procedureName) return toast.error('Please enter a procedure name.')

        setOtSubmitting(true)
        try {
            await createOtScheduleFromContext({
                patientId: patient.id,
                contextType: ctx,
                admissionId: contextId,

                bedId: otBedId,
                surgeonUserId: surgeonId,
                anaesthetistUserId: otAnaesthetistId,

                date: otDate,
                plannedStartTime: otStart,
                plannedEndTime: otEnd || null,

                priority: otPriority,
                side: otSide || null,

                procedureName,
                primaryProcedureId: otSelectedProcedure?.id || null,
                additionalProcedureIds: [],

                notes: otNote,
            })

            toast.success('OT schedule created.')
            setOtDate('')
            setOtStart('')
            setOtEnd('')
            setOtBedId(null)
            setOtProcedureQuery('')
            setOtSelectedProcedure(null)
            setOtSide('')
            setOtPriority('Elective')
            setOtAnaesthetistId(null)
            setOtNote('')
            loadSummary()
        } catch (err) {
            console.error(err)
            toast.error(extractApiError(err, 'Failed to create OT schedule.'))
        } finally {
            setOtSubmitting(false)
        }
    }

    // ------------------------------------------------------
    // Templates / Macros
    // ------------------------------------------------------
    const applyTemplate = (tpl) => {
        if (!tpl) return
        setRxNote(tpl.note || '')
        if (tpl.defaults?.route) setRxRoute(tpl.defaults.route)
        if (tpl.defaults?.timing) setRxTiming(tpl.defaults.timing)
        if (tpl.defaults?.days) setRxDuration(String(tpl.defaults.days))
        if (tpl.defaults?.qty) setRxQty(String(tpl.defaults.qty))
        if (tpl.defaults?.slots) setRxSlots(tpl.defaults.slots)
        toast.success(`Template applied: ${tpl.name}`)
    }

    const saveCurrentAsTemplate = () => {
        const name = window.prompt('Template name? (e.g. OPD Standard)')
        if (!name) return

        const tpl = {
            id: `tpl_${Date.now()}`,
            name: name.trim(),
            note: rxNote || '',
            defaults: {
                route: rxRoute,
                timing: rxTiming,
                days: parseInt(rxDuration || '0', 10) || 0,
                qty: parseFloat(rxQty || '0') || 0,
                slots: rxSlots,
            },
            created_at: new Date().toISOString(),
        }

        const next = [tpl, ...(rxTemplates || [])].slice(0, 30)
        setRxTemplates(next)
        saveRxTemplates(next)
        setRxTemplateId(tpl.id)
        toast.success('Template saved')
    }

    const deleteTemplate = (id) => {
        const next = (rxTemplates || []).filter((t) => t.id !== id)
        setRxTemplates(next)
        saveRxTemplates(next)
        if (rxTemplateId === id) setRxTemplateId('')
        toast.success('Template deleted')
    }

    const copyScheduleText = () => {
        const s = slotsToFreq(rxSlots)
        navigator.clipboard?.writeText(s).then(
            () => toast.success(`Copied: ${s}`),
            () => toast.error('Copy failed'),
        )
    }

    // ------------------------------------------------------
    // Details open (Rx full fetch; RIS attachments + notes)
    // ------------------------------------------------------
    const refreshRisAttachments = useCallback(async (orderId) => {
        if (!orderId) return
        const mod = await risModule()
        const fn = mod?.listRisAttachments
        if (!fn) return // silently; UI will show info text

        setRisAttLoading(true)
        try {
            const res = await fn(orderId)
            const items = Array.isArray(res?.data) ? res.data : res?.data?.items || res || []
            setRisAttachments(Array.isArray(items) ? items : [])
        } catch (e) {
            console.error(e)
            toast.error('Failed to load RIS attachments')
        } finally {
            setRisAttLoading(false)
        }
    }, [])

    const openDetails = async (type, item) => {
        setDetailsType(type)
        setDetailsItem(item)
        setDetailsOpen(true)
        setDetailsFull(null)

        try {
            setDetailsLoading(true)

            if (type === 'rx' && item?.id) {
                const full = await getRxDetails(item.id)
                setDetailsFull(full)
                return
            }

            if (type === 'ris' && item?.id) {
                setRisAttachments([])
                setRisNotes(item?.notes || '')
                await refreshRisAttachments(item.id)
            }

            setDetailsFull(item)
        } catch (e) {
            console.error(e)
            toast.error('Failed to load details')
            setDetailsFull(item)
        } finally {
            setDetailsLoading(false)
        }
    }

    // ------------------------------------------------------
    // Rx PDF actions
    // ------------------------------------------------------
    const rxActions = async (rxId, mode) => {
        if (!rxId) return toast.error('Invalid prescription ID')
        try {
            const res = await downloadRxPdf(rxId)
            const blob = new Blob([res.data], { type: 'application/pdf' })
            if (mode === 'view') openBlobInNewTab(blob)
            if (mode === 'download') downloadBlob(blob, `prescription_${rxId}.pdf`)
            if (mode === 'print') printBlob(blob)
        } catch (e) {
            console.error(e)
            toast.error('Prescription PDF failed')
        }
    }

    // ------------------------------------------------------
    // RIS attachment actions (optional exports)
    // ------------------------------------------------------
    const risUpload = async () => {
        const orderId = detailsItem?.id
        if (!orderId) return toast.error('Invalid RIS order')
        if (!risUploadFile) return toast.error('Choose a file')

        const mod = await risModule()
        const fn = mod?.uploadRisAttachment
        if (!fn) return toast.error('RIS upload API not available in src/api/ris.js')

        setRisAttLoading(true)
        try {
            await fn(orderId, risUploadFile, risUploadNote || '')
            toast.success('Uploaded')
            setRisUploadFile(null)
            setRisUploadNote('')
            await refreshRisAttachments(orderId)
        } catch (e) {
            console.error(e)
            toast.error(extractApiError(e, 'Upload failed'))
        } finally {
            setRisAttLoading(false)
        }
    }

    const risAddLink = async () => {
        const orderId = detailsItem?.id
        if (!orderId) return toast.error('Invalid RIS order')
        if (!risLinkUrl.trim()) return toast.error('Enter URL')

        const mod = await risModule()
        const fn = mod?.addRisAttachmentLink
        if (!fn) return toast.error('RIS link API not available in src/api/ris.js')

        setRisAttLoading(true)
        try {
            await fn(orderId, risLinkUrl.trim(), risLinkNote || '')
            toast.success('Link added')
            setRisLinkUrl('')
            setRisLinkNote('')
            await refreshRisAttachments(orderId)
        } catch (e) {
            console.error(e)
            toast.error(extractApiError(e, 'Add link failed'))
        } finally {
            setRisAttLoading(false)
        }
    }

    const risDeleteAtt = async (attachmentId) => {
        if (!attachmentId) return
        const orderId = detailsItem?.id

        const mod = await risModule()
        const fn = mod?.deleteRisAttachment
        if (!fn) return toast.error('RIS delete API not available in src/api/ris.js')

        setRisAttLoading(true)
        try {
            await fn(attachmentId)
            toast.success('Deleted')
            if (orderId) await refreshRisAttachments(orderId)
        } catch (e) {
            console.error(e)
            toast.error(extractApiError(e, 'Delete failed'))
        } finally {
            setRisAttLoading(false)
        }
    }

    const risSaveNotes = async () => {
        const orderId = detailsItem?.id
        if (!orderId) return

        const mod = await risModule()
        const fn = mod?.saveRisOrderNotes
        if (!fn) return toast.error('RIS notes API not available in src/api/ris.js')

        setRisNotesSaving(true)
        try {
            await fn(orderId, { notes: risNotes })
            toast.success('Notes saved')
        } catch (e) {
            console.error(e)
            toast.error(extractApiError(e, 'Save notes failed'))
        } finally {
            setRisNotesSaving(false)
        }
    }

    const risFinalize = async () => {
        const orderId = detailsItem?.id
        if (!orderId) return

        const mod = await risModule()
        const fn = mod?.finalizeRisOrder
        if (!fn) return toast.error('RIS finalize API not available in src/api/ris.js')

        try {
            await fn(orderId)
            toast.success('RIS finalized')
            loadSummary()
        } catch (e) {
            console.error(e)
            toast.error(extractApiError(e, 'Finalize failed'))
        }
    }

    // ------------------------------------------------------
    // Render
    // ------------------------------------------------------
    const canUseContext = !!(patient?.id && ctx && contextId)

    return (
        <>
            <motion.div className="w-full" {...fadeIn}>
                <Card className="border-slate-500 shadow-sm bg-white/90 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="flex flex-col gap-2 border-b border-slate-100 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-sky-600" />
                                <div>
                                    <CardTitle className="text-base sm:text-lg font-semibold text-slate-900">
                                        Quick Orders
                                    </CardTitle>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Create Lab, Radiology, Pharmacy &amp; OT orders directly from this{' '}
                                        {contextLabel.toLowerCase()}.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge className="bg-slate-900 text-slate-50 px-2.5 py-1 rounded-full">
                                    {contextLabel}
                                </Badge>

                                <Badge variant="outline" className="flex items-center gap-1.5 border-slate-300 bg-slate-50/80">
                                    <Hash className="h-3 w-3 text-slate-500" />
                                    <span className="font-medium text-slate-800">{contextNumberLabel}</span>
                                </Badge>

                                {bedInfo && (
                                    <Badge variant="outline" className="flex items-center gap-1.5 border-emerald-300 bg-emerald-50/90">
                                        <BedDouble className="h-3 w-3 text-emerald-600" />
                                        <span className="font-medium text-emerald-700">{bedInfo}</span>
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Patient Snapshot (always visible) */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                                <User className="h-3.5 w-3.5 text-slate-600" />
                                <span className="font-semibold text-slate-900">{safePatientName(patient)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">
                                <Clock className="h-3.5 w-3.5" />
                                {safeGenderAge(patient)}
                            </span>
                        </div>
                    </CardHeader>

                    <CardContent className="p-3 sm:p-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                            {/* LEFT: Forms */}
                            <div className="space-y-3">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="w-full justify-start overflow-x-auto rounded-xl bg-slate-50 p-1 sticky top-0 z-10">
                                        <TabsTrigger value="lab" className="flex items-center gap-1.5 text-xs sm:text-[13px]">
                                            <FlaskConical className="h-3.5 w-3.5" />
                                            Lab
                                        </TabsTrigger>
                                        <TabsTrigger value="ris" className="flex items-center gap-1.5 text-xs sm:text-[13px]">
                                            <Radio className="h-3.5 w-3.5" />
                                            Radiology
                                        </TabsTrigger>
                                        <TabsTrigger value="rx" className="flex items-center gap-1.5 text-xs sm:text-[13px]">
                                            <Pill className="h-3.5 w-3.5" />
                                            Pharmacy
                                        </TabsTrigger>
                                        <TabsTrigger value="ot" className="flex items-center gap-1.5 text-xs sm:text-[13px]">
                                            <ScissorsLineDashed className="h-3.5 w-3.5" />
                                            OT
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* ---------- LAB TAB ---------- */}
                                    <TabsContent value="lab" className="mt-3">
                                        <div className="space-y-3">
                                            <div className="grid sm:grid-cols-[2fr_minmax(0,1fr)] gap-3">
                                                <div ref={labDropRef} className="space-y-1.5 relative">
                                                    <label className="text-xs font-medium text-slate-600">Lab test (from Master)</label>
                                                    <div className="relative">
                                                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                        <Input
                                                            value={labQuery}
                                                            onChange={(e) => {
                                                                setLabQuery(e.target.value)
                                                                setShowLabDropdown(true)
                                                            }}
                                                            placeholder="Search test code / name…"
                                                            className="h-9 text-xs pl-7"
                                                        />
                                                    </div>

                                                    {showLabDropdown && (labOptions.length > 0 || labSearching) && (
                                                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-500 bg-white shadow-lg max-h-56 overflow-auto text-xs">
                                                            {labSearching && (
                                                                <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    Searching…
                                                                </div>
                                                            )}
                                                            {!labSearching && !labOptions.length && (
                                                                <div className="px-3 py-2 text-slate-500">No tests found.</div>
                                                            )}
                                                            {!labSearching &&
                                                                labOptions.map((t) => (
                                                                    <button
                                                                        key={t.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectLabTest(t)}
                                                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                    >
                                                                        <span className="font-medium text-slate-900">{t.name || t.test_name}</span>
                                                                        <span className="text-[11px] text-slate-500">{t.code || t.short_code || '—'}</span>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}

                                                    <p className="text-[11px] text-slate-500">Connected to LIS Lab Test Masters.</p>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">Priority</label>
                                                    <div className="flex gap-1.5">
                                                        {['routine', 'urgent', 'stat'].map((p) => (
                                                            <Button
                                                                key={p}
                                                                type="button"
                                                                size="sm"
                                                                variant={labPriority === p ? 'default' : 'outline'}
                                                                className={`flex-1 h-8 text-xs font-semibold ${labPriority === p ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'border-slate-300 text-slate-700'
                                                                    }`}
                                                                onClick={() => setLabPriority(p)}
                                                            >
                                                                {p === 'routine' ? 'Routine' : p === 'urgent' ? 'Urgent' : 'STAT'}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {labSelectedTests.length > 0 && (
                                                <ScrollArea className="max-h-36 rounded-xl border border-slate-500 bg-slate-50/60 p-2">
                                                    <ul className="space-y-1.5 text-xs">
                                                        {labSelectedTests.map((t) => (
                                                            <li
                                                                key={t.id}
                                                                className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-2 border border-slate-100"
                                                            >
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-semibold text-slate-900 truncate">{t.name || 'Lab test'}</span>
                                                                    <span className="text-[11px] text-slate-500 truncate">Code: {t.code || '—'}</span>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                                    onClick={() => handleRemoveLabTest(t.id)}
                                                                    title="Remove"
                                                                >
                                                                    ×
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </ScrollArea>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">Note (optional)</label>
                                                <Textarea
                                                    rows={2}
                                                    value={labNote}
                                                    onChange={(e) => setLabNote(e.target.value)}
                                                    placeholder="Any special instructions for sample collection / processing."
                                                    className="resize-none text-xs"
                                                />
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <div className="text-[11px] text-slate-500">
                                                    Lab PDF available after reporting: <span className="font-semibold">/lab/orders/:id/report-pdf</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={labSubmitting || !canUseContext}
                                                    onClick={handleSubmitLab}
                                                    className="h-9 px-4 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                                                >
                                                    {labSubmitting ? 'Placing Lab Order…' : 'Place Lab Order'}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ---------- RIS TAB ---------- */}
                                    <TabsContent value="ris" className="mt-3">
                                        <div className="space-y-3">
                                            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-800 flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                                <div>
                                                    RIS does <span className="font-semibold">not</span> generate PDF now. Only{' '}
                                                    <span className="font-semibold">attachments + notes</span> are supported.
                                                </div>
                                            </div>

                                            <div className="grid sm:grid-cols-[2fr_minmax(0,1fr)] gap-3">
                                                <div ref={risDropRef} className="space-y-1.5 relative">
                                                    <label className="text-xs font-medium text-slate-600">Radiology test (from RIS Masters)</label>
                                                    <div className="relative">
                                                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                        <Input
                                                            value={risQuery}
                                                            onChange={(e) => {
                                                                setRisQuery(e.target.value)
                                                                setShowRisDropdown(true)
                                                            }}
                                                            placeholder="Search X-Ray / CT / MRI / USG…"
                                                            className="h-9 text-xs pl-7"
                                                        />
                                                    </div>

                                                    {showRisDropdown && (risOptions.length > 0 || risSearching) && (
                                                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-500 bg-white shadow-lg max-h-56 overflow-auto text-xs">
                                                            {risSearching && (
                                                                <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    Searching…
                                                                </div>
                                                            )}
                                                            {!risSearching && !risOptions.length && (
                                                                <div className="px-3 py-2 text-slate-500">No tests found.</div>
                                                            )}
                                                            {!risSearching &&
                                                                risOptions.map((t) => (
                                                                    <button
                                                                        key={t.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectRisTest(t)}
                                                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex justify-between items-center gap-2">
                                                                            <span className="font-medium text-slate-900 truncate">{t.name || t.test_name}</span>
                                                                            <span className="text-[10px] text-slate-500 shrink-0">
                                                                                {t.modality || t.modality_code || '—'}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[11px] text-slate-500 truncate">{t.code || '—'}</span>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}

                                                    <p className="text-[11px] text-slate-500">Linked to Radiology Test &amp; Modality masters.</p>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">Priority</label>
                                                    <div className="flex gap-1.5">
                                                        {['routine', 'urgent', 'stat'].map((p) => (
                                                            <Button
                                                                key={p}
                                                                type="button"
                                                                size="sm"
                                                                variant={risPriority === p ? 'default' : 'outline'}
                                                                className={`flex-1 h-8 text-xs font-semibold ${risPriority === p ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-slate-300 text-slate-700'
                                                                    }`}
                                                                onClick={() => setRisPriority(p)}
                                                            >
                                                                {p === 'routine' ? 'Routine' : p === 'urgent' ? 'Urgent' : 'STAT'}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {risSelectedTests.length > 0 && (
                                                <ScrollArea className="max-h-36 rounded-xl border border-slate-500 bg-slate-50/60 p-2">
                                                    <ul className="space-y-1.5 text-xs">
                                                        {risSelectedTests.map((t) => (
                                                            <li
                                                                key={t.id}
                                                                className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-2 border border-slate-100"
                                                            >
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-semibold text-slate-900 truncate">{t.name || 'Radiology test'}</span>
                                                                    <span className="text-[11px] text-slate-500 truncate">
                                                                        {t.modality || 'RIS'} • Code: {t.code || '—'}
                                                                    </span>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                                    onClick={() => handleRemoveRisTest(t.id)}
                                                                    title="Remove"
                                                                >
                                                                    ×
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </ScrollArea>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">Note (optional)</label>
                                                <Textarea
                                                    rows={2}
                                                    value={risNote}
                                                    onChange={(e) => setRisNote(e.target.value)}
                                                    placeholder="Side / position / contrast / clinical history etc."
                                                    className="resize-none text-xs"
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={risSubmitting || !canUseContext}
                                                    onClick={handleSubmitRis}
                                                    className="h-9 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                                >
                                                    {risSubmitting ? 'Placing Radiology Order…' : 'Place Radiology Order'}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ---------- PHARMACY TAB ---------- */}
                                    <TabsContent value="rx" className="mt-3">
                                        <div className="space-y-3">
                                            {/* Templates + Macros */}
                                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="h-4 w-4 text-emerald-600" />
                                                        <div>
                                                            <div className="text-xs font-semibold text-slate-900">Macros & Templates</div>
                                                            <div className="text-[11px] text-slate-500">
                                                                Fast Rx creation — schedule macros + reusable templates (saved in browser).
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button type="button" variant="outline" className="h-8 rounded-full text-[11px]" onClick={copyScheduleText}>
                                                            <ClipboardCopy className="h-3.5 w-3.5 mr-2" />
                                                            Copy schedule
                                                        </Button>

                                                        <Button type="button" variant="outline" className="h-8 rounded-full text-[11px]" onClick={saveCurrentAsTemplate}>
                                                            <FileText className="h-3.5 w-3.5 mr-2" />
                                                            Save template
                                                        </Button>

                                                        <select
                                                            className="h-8 rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-800"
                                                            value={rxTemplateId}
                                                            onChange={(e) => {
                                                                const id = e.target.value
                                                                setRxTemplateId(id)
                                                                const tpl = (rxTemplates || []).find((t) => t.id === id)
                                                                if (tpl) applyTemplate(tpl)
                                                            }}
                                                        >
                                                            <option value="">Select template…</option>
                                                            {(rxTemplates || []).map((t) => (
                                                                <option key={t.id} value={t.id}>
                                                                    {t.name}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {rxTemplateId && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                className="h-8 rounded-full text-[11px] text-rose-600 hover:text-rose-700"
                                                                onClick={() => deleteTemplate(rxTemplateId)}
                                                                title="Delete selected template"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                                Delete
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-2 items-center">
                                                    {['OD', 'BD', 'TID', 'QID', 'NIGHT'].map((m) => (
                                                        <Button key={m} type="button" variant="outline" className="h-8 rounded-full text-[11px]" onClick={() => applyRxMacro(m)}>
                                                            {m}
                                                        </Button>
                                                    ))}
                                                    <span className="ml-1 text-[11px] text-slate-500 inline-flex items-center">
                                                        Schedule: <span className="ml-1 font-semibold text-slate-800">{slotsToFreq(rxSlots)}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Medicine search */}
                                            <div ref={rxDropRef} className="space-y-1.5 relative">
                                                <label className="text-xs font-medium text-slate-600">Search medicine (Pharmacy Inventory)</label>
                                                <div className="relative">
                                                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                    <Input
                                                        value={rxQuery}
                                                        onChange={(e) => {
                                                            setRxQuery(e.target.value)
                                                            setShowRxDropdown(true)
                                                        }}
                                                        placeholder="Search drug name / brand / generic…"
                                                        className="h-9 text-xs pl-7"
                                                    />
                                                </div>

                                                {showRxDropdown && (rxOptions.length > 0 || rxSearching) && (
                                                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-500 bg-white shadow-lg max-h-56 overflow-auto text-xs">
                                                        {rxSearching && (
                                                            <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                Searching…
                                                            </div>
                                                        )}
                                                        {!rxSearching && !rxOptions.length && (
                                                            <div className="px-3 py-2 text-slate-500">No items found.</div>
                                                        )}
                                                        {!rxSearching &&
                                                            rxOptions.map((it) => (
                                                                <button
                                                                    key={it.id}
                                                                    type="button"
                                                                    onClick={() => handleSelectRxItem(it)}
                                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                >
                                                                    <div className="flex justify-between items-center gap-2">
                                                                        <span className="font-medium text-slate-900 truncate">{it.name}</span>
                                                                        {it.code && <span className="text-[10px] text-slate-500 shrink-0">{it.code}</span>}
                                                                    </div>
                                                                    <span className="text-[11px] text-slate-500 truncate">{it.strength || it.form || ''}</span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Dose/Days/Qty + Timing */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Dosage</label>
                                                    <Input value={rxDose} onChange={(e) => setRxDose(e.target.value)} placeholder="e.g. 500mg / 1 tab" className="h-8 text-[11px]" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Days</label>
                                                    <Input value={rxDuration} onChange={(e) => setRxDuration(e.target.value)} placeholder="5" className="h-8 text-[11px]" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Qty</label>
                                                    <Input value={rxQty} onChange={(e) => setRxQty(e.target.value)} placeholder="10" className="h-8 text-[11px]" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Timing</label>
                                                    <select
                                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800"
                                                        value={rxTiming}
                                                        onChange={(e) => setRxTiming(e.target.value)}
                                                    >
                                                        <option value="BF">Before food (BF)</option>
                                                        <option value="AF">After food (AF)</option>
                                                        <option value="NA">No timing</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Route</label>
                                                    <select
                                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800"
                                                        value={rxRoute}
                                                        onChange={(e) => setRxRoute(e.target.value)}
                                                    >
                                                        <option value="oral">Oral</option>
                                                        <option value="iv">IV</option>
                                                        <option value="im">IM</option>
                                                        <option value="topical">Topical</option>
                                                        <option value="inhalation">Inhalation</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                </div>

                                                {/* Schedule toggles */}
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Schedule (AM / AF / PM / NIGHT)</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            ['am', 'AM'],
                                                            ['af', 'AF'],
                                                            ['pm', 'PM'],
                                                            ['night', 'NIGHT'],
                                                        ].map(([k, label]) => {
                                                            const on = !!rxSlots[k]
                                                            return (
                                                                <button
                                                                    key={k}
                                                                    type="button"
                                                                    onClick={() => setRxSlots((s) => ({ ...s, [k]: !s[k] }))}
                                                                    className={`h-8 px-3 rounded-full border text-[11px] font-semibold transition ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                                                                        }`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                <Button type="button" size="sm" className="h-8 px-3 text-[11px] rounded-full" onClick={handleAddRxLine}>
                                                    Add line
                                                </Button>
                                            </div>

                                            {/* Lines preview */}
                                            {rxLines.length > 0 && (
                                                <div className="border border-slate-500 rounded-xl bg-slate-50/60 overflow-hidden">
                                                    <ScrollArea className="max-h-60">
                                                        <div className="min-w-[860px]">
                                                            <table className="w-full text-[11px]">
                                                                <thead className="bg-slate-100 text-slate-700">
                                                                    <tr>
                                                                        <th className="px-2 py-2 text-left font-semibold">S.NO</th>
                                                                        <th className="px-2 py-2 text-left font-semibold">Drug/Medicine</th>
                                                                        <th className="px-2 py-2 text-left font-semibold">Dosage</th>
                                                                        <th className="px-2 py-2 text-center font-semibold">AM</th>
                                                                        <th className="px-2 py-2 text-center font-semibold">AF</th>
                                                                        <th className="px-2 py-2 text-center font-semibold">PM</th>
                                                                        <th className="px-2 py-2 text-center font-semibold">NIGHT</th>
                                                                        <th className="px-2 py-2 text-center font-semibold">DAYS</th>
                                                                        <th className="px-2 py-2 text-right font-semibold">Qty</th>
                                                                        <th className="px-2 py-2 text-right font-semibold">Action</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="bg-white">
                                                                    {rxLines.map((l, idx) => {
                                                                        const s = freqToSlots(l.frequency_code)
                                                                        const dosage = [l.dose_text, l.route, l.timing].filter(Boolean).join(' • ')
                                                                        return (
                                                                            <tr key={idx} className="border-t border-slate-100">
                                                                                <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                                                                                <td className="px-2 py-2 font-medium text-slate-900">{l.item_name}</td>
                                                                                <td className="px-2 py-2 text-slate-700">{dosage || '—'}</td>
                                                                                <td className="px-2 py-2 text-center font-semibold">{s.am}</td>
                                                                                <td className="px-2 py-2 text-center font-semibold">{s.af}</td>
                                                                                <td className="px-2 py-2 text-center font-semibold">{s.pm}</td>
                                                                                <td className="px-2 py-2 text-center font-semibold">{s.night}</td>
                                                                                <td className="px-2 py-2 text-center font-semibold">{l.duration_days ?? '—'}</td>
                                                                                <td className="px-2 py-2 text-right font-semibold text-slate-800">{l.requested_qty}</td>
                                                                                <td className="px-2 py-2 text-right">
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="icon"
                                                                                        variant="ghost"
                                                                                        className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                                                        onClick={() => handleRemoveRxLine(idx)}
                                                                                        title="Remove"
                                                                                    >
                                                                                        ×
                                                                                    </Button>
                                                                                </td>
                                                                            </tr>
                                                                        )
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </ScrollArea>
                                                </div>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">Clinical notes / Rx note (optional)</label>
                                                <Textarea rows={2} value={rxNote} onChange={(e) => setRxNote(e.target.value)} className="resize-none text-xs" />
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <div className="text-[11px] text-slate-500">Creates patient-ready Prescription PDF (View/Print/Download).</div>

                                                <div className="flex flex-wrap items-center gap-2 justify-end">
                                                    {lastRx?.id && (
                                                        <>
                                                            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => rxActions(lastRx.id, 'view')}>
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View PDF
                                                            </Button>
                                                            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => rxActions(lastRx.id, 'print')}>
                                                                <Printer className="h-4 w-4 mr-2" />
                                                                Print
                                                            </Button>
                                                            <Button type="button" className="h-9 rounded-xl" onClick={() => rxActions(lastRx.id, 'download')}>
                                                                <Download className="h-4 w-4 mr-2" />
                                                                Download
                                                            </Button>
                                                        </>
                                                    )}

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={rxSubmitting || !canUseContext}
                                                        onClick={handleSubmitRx}
                                                        className="h-9 px-4 text-xs font-semibold"
                                                    >
                                                        {rxSubmitting ? 'Saving Rx…' : 'Save & Send to Pharmacy'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ---------- OT TAB ---------- */}
                                    <TabsContent value="ot" className="mt-3">
                                        <div className="space-y-3">
                                            {ctx !== 'ipd' && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                                                    OT quick booking is only for IPD admission context.
                                                </div>
                                            )}

                                            <div className="grid sm:grid-cols-3 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        OT Date <span className="text-rose-500">*</span>
                                                    </label>
                                                    <Input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} className="h-9 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Start time <span className="text-rose-500">*</span>
                                                    </label>
                                                    <Input type="time" value={otStart} onChange={(e) => setOtStart(e.target.value)} className="h-9 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">End time (optional)</label>
                                                    <Input type="time" value={otEnd} onChange={(e) => setOtEnd(e.target.value)} className="h-9 text-xs" />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">OT Location / Bed</label>
                                                <WardRoomBedPicker value={otBedId ? Number(otBedId) : null} onChange={(bedId) => setOtBedId(bedId || null)} />
                                                <p className="text-[11px] text-slate-500">Uses the same Ward → Room → Bed mapping as OT Schedule.</p>
                                            </div>

                                            <div ref={otDropRef} className="space-y-1.5 relative">
                                                <label className="text-xs font-medium text-slate-600">Procedure (OT Master or free text)</label>
                                                <div className="relative">
                                                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                    <Input
                                                        value={otProcedureQuery}
                                                        onChange={(e) => {
                                                            setOtProcedureQuery(e.target.value)
                                                            setShowOtDropdown(true)
                                                        }}
                                                        placeholder="Search procedure name / code…"
                                                        className="h-9 text-xs pl-7"
                                                    />
                                                </div>

                                                {showOtDropdown && (otProcedureOptions.length > 0 || otProcedureSearching) && (
                                                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-500 bg-white shadow-lg max-h-56 overflow-auto text-xs">
                                                        {otProcedureSearching && (
                                                            <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                Searching…
                                                            </div>
                                                        )}
                                                        {!otProcedureSearching && !otProcedureOptions.length && (
                                                            <div className="px-3 py-2 text-slate-500">No procedures found.</div>
                                                        )}
                                                        {!otProcedureSearching &&
                                                            otProcedureOptions.map((p) => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => handleSelectOtProcedure(p)}
                                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                >
                                                                    <span className="font-medium text-slate-900">{p.name || p.procedure_name}</span>
                                                                    <span className="text-[11px] text-slate-500">{p.code || '—'}</span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}

                                                <p className="text-[11px] text-slate-500">
                                                    If you type and don&apos;t pick from list, it will save as free-text procedure name.
                                                </p>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">Side</label>
                                                    <select
                                                        className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                        value={otSide}
                                                        onChange={(e) => setOtSide(e.target.value)}
                                                    >
                                                        <option value="">Not applicable</option>
                                                        <option value="Right">Right</option>
                                                        <option value="Left">Left</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                        <option value="Midline">Midline</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">Priority</label>
                                                    <div className="flex gap-1.5">
                                                        {['Elective', 'Emergency'].map((p) => (
                                                            <Button
                                                                key={p}
                                                                type="button"
                                                                size="sm"
                                                                variant={otPriority === p ? 'default' : 'outline'}
                                                                className={`flex-1 h-8 text-xs font-semibold ${otPriority === p ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border-slate-300 text-slate-700'
                                                                    }`}
                                                                onClick={() => setOtPriority(p)}
                                                            >
                                                                {p}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <DoctorPicker label="Surgeon" value={otSurgeonId ? Number(otSurgeonId) : null} onChange={(id) => setOtSurgeonId(id || null)} />
                                                <DoctorPicker label="Anaesthetist" value={otAnaesthetistId ? Number(otAnaesthetistId) : null} onChange={(id) => setOtAnaesthetistId(id || null)} />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">Notes / anaesthesia plan (optional)</label>
                                                <Textarea rows={2} value={otNote} onChange={(e) => setOtNote(e.target.value)} className="resize-none text-xs" />
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={otSubmitting || !canUseContext || ctx !== 'ipd'}
                                                    onClick={handleSubmitOt}
                                                    className="h-9 px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                                >
                                                    {otSubmitting ? 'Creating OT schedule…' : 'Create OT schedule'}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            {/* RIGHT: Recent summary */}
                            <div className="space-y-3 lg:sticky lg:top-3 self-start">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                                        Recent orders for this {contextLabel.toLowerCase()}
                                    </h3>
                                    {loadingSummary && (
                                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Loading
                                        </span>
                                    )}
                                </div>

                                {/* LAB SUMMARY */}
                                <Card className="border-slate-500 bg-slate-50/70">
                                    <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FlaskConical className="h-4 w-4 text-sky-600" />
                                            <CardTitle className="text-xs font-semibold">Lab Orders</CardTitle>
                                        </div>
                                        <StatusChip tone="lab">{summary.lab?.length || 0} orders</StatusChip>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3 pt-0">
                                        <div className="space-y-1.5 max-h-36 overflow-auto text-[11px]">
                                            {!summary.lab?.length && !loadingSummary && (
                                                <div className="text-slate-500 text-[11px]">No lab orders for this context yet.</div>
                                            )}
                                            {summary.lab?.map((o) => (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    onClick={() => openDetails('lab', o)}
                                                    className="w-full text-left flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                >
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-semibold text-slate-900 truncate">{o.order_no || `LAB-${String(o.id).padStart(6, '0')}`}</span>
                                                        <span className="text-[10px] text-slate-500 truncate">{fmtDT(o.created_at || o.order_datetime)}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-600 capitalize shrink-0">{o.status || 'ordered'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* RIS SUMMARY */}
                                <Card className="border-slate-500 bg-slate-50/70">
                                    <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Radio className="h-4 w-4 text-indigo-600" />
                                            <CardTitle className="text-xs font-semibold">Radiology Orders</CardTitle>
                                        </div>
                                        <StatusChip tone="ris">{summary.ris?.length || 0} orders</StatusChip>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3 pt-0">
                                        <div className="space-y-1.5 max-h-36 overflow-auto text-[11px]">
                                            {!summary.ris?.length && !loadingSummary && (
                                                <div className="text-slate-500 text-[11px]">No radiology orders for this context yet.</div>
                                            )}
                                            {summary.ris?.map((o) => (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    onClick={() => openDetails('ris', o)}
                                                    className="w-full text-left flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                >
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-semibold text-slate-900 truncate">{o.order_no || `RIS-${String(o.id).padStart(6, '0')}`}</span>
                                                        <span className="text-[10px] text-slate-500 truncate">{fmtDT(o.created_at || o.order_datetime)}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-600 capitalize shrink-0">{o.status || 'ordered'}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-2 text-[10px] text-slate-500">
                                            RIS: attachments-only (no PDF).
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* RX SUMMARY */}
                                <Card className="border-slate-500 bg-slate-50/70">
                                    <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Pill className="h-4 w-4 text-emerald-600" />
                                            <CardTitle className="text-xs font-semibold">Pharmacy Rx</CardTitle>
                                        </div>
                                        <StatusChip tone="rx">{summary.rx?.length || 0} Rx</StatusChip>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3 pt-0">
                                        <div className="space-y-1.5 max-h-36 overflow-auto text-[11px]">
                                            {!summary.rx?.length && !loadingSummary && (
                                                <div className="text-slate-500 text-[11px]">No prescriptions for this context yet.</div>
                                            )}
                                            {summary.rx?.map((o) => (
                                                <div key={o.id} className="flex items-stretch gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openDetails('rx', o)}
                                                        className="flex-1 text-left flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                    >
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold text-slate-900 truncate">
                                                                {o.rx_number || `RX-${String(o.id).padStart(6, '0')}`}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 truncate">{fmtDT(o.rx_datetime || o.created_at)}</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-600 capitalize shrink-0">{o.status || 'pending'}</span>
                                                    </button>

                                                    <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-xl" title="View PDF" onClick={() => rxActions(o.id, 'view')}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>

                                                    <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-xl" title="Download PDF" onClick={() => rxActions(o.id, 'download')}>
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* OT SUMMARY (IPD only) */}
                                {ctx === 'ipd' && (
                                    <Card className="border-slate-500 bg-slate-50/70">
                                        <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ScissorsLineDashed className="h-4 w-4 text-amber-600" />
                                                <CardTitle className="text-xs font-semibold">OT Schedules</CardTitle>
                                            </div>
                                            <StatusChip tone="ot">{summary.ot?.length || 0} cases</StatusChip>
                                        </CardHeader>
                                        <CardContent className="px-3 pb-3 pt-0">
                                            <div className="space-y-1.5 max-h-36 overflow-auto text-[11px]">
                                                {!summary.ot?.length && !loadingSummary && (
                                                    <div className="text-slate-500 text-[11px]">No OT schedules for this admission yet.</div>
                                                )}
                                                {summary.ot?.map((o) => (
                                                    <button
                                                        key={o.id}
                                                        type="button"
                                                        onClick={() => openDetails('ot', o)}
                                                        className="w-full text-left flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                    >
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold text-slate-900 truncate">
                                                                {o.schedule_no || `OT-${String(o.id).padStart(6, '0')}`}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 truncate">
                                                                {o.date} {o.planned_start_time || ''}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-600 shrink-0">{o.priority || 'Elective'}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>

                        {/* WARNING if context missing */}
                        {!canUseContext && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                <div>
                                    Missing <span className="font-semibold">Patient / Context</span>. Quick Orders need
                                    <span className="font-semibold"> patient + OPD/IPD + contextId</span> to link properly.
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* ORDER DETAILS SHEET */}
            <Sheet open={detailsOpen} onOpenChange={(open) => !open && closeDetails()}>
                <SheetContent side="right" className="w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2 text-sm">
                            {detailsType === 'lab' && (
                                <>
                                    <FlaskConical className="h-4 w-4 text-sky-600" />
                                    Lab Order Details
                                </>
                            )}
                            {detailsType === 'ris' && (
                                <>
                                    <Radio className="h-4 w-4 text-indigo-600" />
                                    Radiology Order Details
                                </>
                            )}
                            {detailsType === 'rx' && (
                                <>
                                    <Pill className="h-4 w-4 text-emerald-600" />
                                    Prescription Details
                                </>
                            )}
                            {detailsType === 'ot' && (
                                <>
                                    <ScissorsLineDashed className="h-4 w-4 text-amber-600" />
                                    OT Schedule Details
                                </>
                            )}
                        </SheetTitle>

                        <SheetDescription className="text-xs text-slate-500">
                            View details. Lab has PDF. RIS is attachments-only.
                        </SheetDescription>

                        {/* Action Buttons */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {detailsType === 'lab' && detailsItem?.id && (
                                <>
                                    <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => openLabPdf(detailsItem.id)}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        View PDF
                                    </Button>
                                    <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => openLabPdf(detailsItem.id)}>
                                        <Printer className="h-4 w-4 mr-2" />
                                        Print
                                    </Button>
                                    <Button type="button" className="h-9 rounded-xl" onClick={() => openLabPdf(detailsItem.id)}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </Button>
                                </>
                            )}

                            {detailsType === 'rx' && detailsItem?.id && (
                                <>
                                    <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => rxActions(detailsItem.id, 'view')}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        View PDF
                                    </Button>
                                    <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => rxActions(detailsItem.id, 'print')}>
                                        <Printer className="h-4 w-4 mr-2" />
                                        Print
                                    </Button>
                                    <Button type="button" className="h-9 rounded-xl" onClick={() => rxActions(detailsItem.id, 'download')}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </Button>
                                </>
                            )}

                            {detailsType === 'ris' && detailsItem?.id && (
                                <>
                                    <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => refreshRisAttachments(detailsItem.id)}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Refresh attachments
                                    </Button>
                                    <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={risFinalize}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Finalize
                                    </Button>
                                </>
                            )}
                        </div>
                    </SheetHeader>

                    <div className="mt-4 space-y-3 text-xs text-slate-700">
                        {detailsLoading && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading details…
                            </div>
                        )}

                        {!detailsLoading && !detailsItem && (
                            <p className="text-slate-500">Select an order from the right panel to view details.</p>
                        )}

                        {!detailsLoading && detailsItem && (
                            <>
                                {/* Common meta */}
                                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2">
                                    <div>
                                        <div className="text-[11px] text-slate-500">Patient</div>
                                        <div className="font-semibold text-slate-900">{safePatientName(patient)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500">Context</div>
                                        <div className="font-medium text-slate-900">
                                            {contextLabel} • {ctx === 'ipd' ? ipNumber || '—' : opNumber || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500">Created</div>
                                        <div className="text-slate-900">
                                            {detailsType === 'rx'
                                                ? fmtDT(detailsFull?.rx_datetime || detailsItem.rx_datetime || detailsItem.created_at)
                                                : detailsType === 'ot'
                                                    ? fmtDT(detailsItem.created_at || detailsItem.date)
                                                    : fmtDT(detailsItem.created_at || detailsItem.order_datetime)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500">Status</div>
                                        <div className="capitalize">{detailsItem.status || (detailsType === 'rx' ? 'pending' : 'ordered')}</div>
                                    </div>
                                </div>

                                {/* LAB */}
                                {detailsType === 'lab' && (
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="text-[11px] text-slate-500">Order Number</div>
                                        <div className="font-semibold text-slate-900">
                                            {detailsItem.order_no || `LAB-${String(detailsItem.id).padStart(6, '0')}`}
                                        </div>
                                        <div className="mt-2 text-[11px] text-slate-500">
                                            PDF route: <span className="font-semibold">/lab/orders/{detailsItem.id}/report-pdf</span>
                                        </div>
                                    </div>
                                )}

                                {/* RIS (attachments-only) */}
                                {detailsType === 'ris' && (
                                    <div className="space-y-3">
                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="text-[11px] text-slate-500">Order Number</div>
                                            <div className="font-semibold text-slate-900">
                                                {detailsItem.order_no || `RIS-${String(detailsItem.id).padStart(6, '0')}`}
                                            </div>
                                            <div className="mt-2 text-[11px] text-slate-500">
                                                No PDF. Upload files / add links as attachments.
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-[11px] text-slate-500">Notes</div>
                                                    <div className="text-xs font-semibold text-slate-900">Radiology notes</div>
                                                </div>
                                                <Button type="button" size="sm" variant="outline" className="h-8" onClick={risSaveNotes} disabled={risNotesSaving}>
                                                    {risNotesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                                    Save
                                                </Button>
                                            </div>
                                            <Textarea value={risNotes} onChange={(e) => setRisNotes(e.target.value)} rows={3} className="mt-2 text-xs" placeholder="Write notes…" />
                                        </div>

                                        {/* Attachments */}
                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-[11px] text-slate-500">Attachments</div>
                                                    <div className="text-xs font-semibold text-slate-900">Upload / Link / Delete</div>
                                                </div>
                                                {risAttLoading ? (
                                                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading
                                                    </span>
                                                ) : (
                                                    <StatusChip tone="ris">{(risAttachments?.length || 0) + ' files'}</StatusChip>
                                                )}
                                            </div>

                                            <div className="mt-2 space-y-2">
                                                {(risAttachments || []).map((a) => {
                                                    const url = a.file_url || a.url || a.link || ''
                                                    const title = a.note || a.filename || a.name || `Attachment #${a.id}`
                                                    return (
                                                        <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-semibold text-slate-900 truncate">{title}</div>
                                                                <div className="text-[10px] text-slate-500 truncate">{url || '—'}</div>
                                                            </div>

                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-9 w-9 rounded-xl"
                                                                    title="Open"
                                                                    onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                                                                    disabled={!url}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>

                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-9 w-9 rounded-xl"
                                                                    title="Delete"
                                                                    onClick={() => risDeleteAtt(a.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}

                                                {!risAttachments?.length && (
                                                    <div className="text-[11px] text-slate-500">
                                                        No attachments yet. (If this stays empty, export attachments APIs in <span className="font-semibold">src/api/ris.js</span>.)
                                                    </div>
                                                )}
                                            </div>

                                            {/* Upload */}
                                            <div className="mt-3 grid gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Input type="file" className="h-9 text-xs" onChange={(e) => setRisUploadFile(e.target.files?.[0] || null)} />
                                                    <Button type="button" variant="outline" className="h-9" onClick={risUpload}>
                                                        <Upload className="h-4 w-4 mr-2" />
                                                        Upload
                                                    </Button>
                                                </div>
                                                <Input value={risUploadNote} onChange={(e) => setRisUploadNote(e.target.value)} placeholder="Upload note (optional)" className="h-9 text-xs" />
                                            </div>

                                            {/* Add Link */}
                                            <div className="mt-3 grid gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Input value={risLinkUrl} onChange={(e) => setRisLinkUrl(e.target.value)} placeholder="Paste file URL…" className="h-9 text-xs" />
                                                    <Button type="button" variant="outline" className="h-9" onClick={risAddLink}>
                                                        <LinkIcon className="h-4 w-4 mr-2" />
                                                        Add
                                                    </Button>
                                                </div>
                                                <Input value={risLinkNote} onChange={(e) => setRisLinkNote(e.target.value)} placeholder="Link note (optional)" className="h-9 text-xs" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* RX */}
                                {detailsType === 'rx' && (
                                    <div className="space-y-3">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="text-[11px] text-slate-500">Rx Number</div>
                                            <div className="font-semibold text-slate-900">
                                                {detailsFull?.rx_number || detailsItem?.rx_number || `RX-${String(detailsItem?.id).padStart(6, '0')}`}
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1">{fmtDT(detailsFull?.rx_datetime || detailsItem?.rx_datetime || detailsItem?.created_at)}</div>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                                            <div className="px-3 py-2 bg-white flex items-center justify-between">
                                                <div className="text-xs font-semibold text-slate-900">Prescription Schedule</div>
                                                <div className="text-[11px] text-slate-500">Patient-ready format</div>
                                            </div>

                                            <div className="overflow-auto">
                                                <div className="min-w-[700px]">
                                                    <table className="w-full text-[11px]">
                                                        <thead className="bg-slate-100 text-slate-700">
                                                            <tr>
                                                                <th className="px-2 py-2 text-left font-semibold">S.NO</th>
                                                                <th className="px-2 py-2 text-left font-semibold">Drug/Medicine</th>
                                                                <th className="px-2 py-2 text-left font-semibold">Dosage</th>
                                                                <th className="px-2 py-2 text-center font-semibold">AM</th>
                                                                <th className="px-2 py-2 text-center font-semibold">AF</th>
                                                                <th className="px-2 py-2 text-center font-semibold">PM</th>
                                                                <th className="px-2 py-2 text-center font-semibold">NIGHT</th>
                                                                <th className="px-2 py-2 text-center font-semibold">DAYS</th>
                                                            </tr>
                                                        </thead>

                                                        <tbody>
                                                            {(detailsFull?.lines || detailsItem?.lines || []).map((l, idx) => {
                                                                const s = freqToSlots(l.frequency_code)
                                                                const dosage = [l.dose_text, l.route, l.timing].filter(Boolean).join(' • ')
                                                                return (
                                                                    <tr key={idx} className="border-t">
                                                                        <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                                                                        <td className="px-2 py-2 font-medium text-slate-900">{l.item_name || '—'}</td>
                                                                        <td className="px-2 py-2 text-slate-700">{dosage || '—'}</td>
                                                                        <td className="px-2 py-2 text-center font-semibold">{s.am}</td>
                                                                        <td className="px-2 py-2 text-center font-semibold">{s.af}</td>
                                                                        <td className="px-2 py-2 text-center font-semibold">{s.pm}</td>
                                                                        <td className="px-2 py-2 text-center font-semibold">{s.night}</td>
                                                                        <td className="px-2 py-2 text-center font-semibold">{l.duration_days ?? '—'}</td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>

                                        {(detailsFull?.notes || detailsItem?.notes) && (
                                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                <div className="text-[11px] text-slate-500 mb-1">Notes</div>
                                                <div className="text-xs text-slate-800 whitespace-pre-wrap">{detailsFull?.notes || detailsItem?.notes}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* OT */}
                                {detailsType === 'ot' && (
                                    <div className="space-y-2">
                                        <div className="text-[11px] text-slate-500">Schedule</div>
                                        <div className="font-semibold text-slate-900">{detailsItem.schedule_no || `OT-${String(detailsItem.id).padStart(6, '0')}`}</div>

                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <div className="text-[11px] text-slate-500">Date</div>
                                                <div>{detailsItem.date || '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] text-slate-500">Time</div>
                                                <div>
                                                    {detailsItem.planned_start_time || '—'}
                                                    {detailsItem.planned_end_time ? ` – ${detailsItem.planned_end_time}` : ''}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] text-slate-500">Priority</div>
                                                <div>{detailsItem.priority || 'Elective'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] text-slate-500">Side</div>
                                                <div>{detailsItem.side || 'N/A'}</div>
                                            </div>
                                        </div>

                                        <div className="mt-2">
                                            <div className="text-[11px] text-slate-500 mb-1">Procedure</div>
                                            <div className="rounded-md bg-white px-2 py-2 border border-slate-100 text-[11px]">
                                                {detailsItem.primary_procedure?.name || detailsItem.procedure_name || '—'}
                                            </div>
                                        </div>

                                        {detailsItem.notes && (
                                            <div className="mt-2">
                                                <div className="text-[11px] text-slate-500 mb-1">Notes</div>
                                                <div className="rounded-md bg-white px-2 py-2 border border-slate-100 text-[11px]">{detailsItem.notes}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    )
}

export default QuickOrders
