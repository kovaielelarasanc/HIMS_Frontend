// FILE: src/components/QuickOrders.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'

// ---- Quick Orders helpers ----
import {
    createPharmacyPrescriptionFromContext,
    createOtScheduleFromContext,
    listLabOrdersForContext,
    listRadiologyOrdersForContext,
    listPharmacyPrescriptionsForContext,
    listOtSchedulesForContext,
    
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

function safePatientName(p) {
    if (!p) return 'Unknown patient'
    return p.full_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim()
}

function safeGenderAge(p) {
    if (!p) return '—'
    const gender = p.gender || p.sex || '—'
    const age = p.age_display || p.age || '—'
    return `${gender} • ${age}`
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
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[tone]}`}
        >
            {children}
        </span>
    )
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

// ------------------------------------------------------
// Main component
// ------------------------------------------------------
function QuickOrders({
    patient,
    contextType,   // 'opd' | 'ipd'
    contextId,     // visit_id / ipd_admission_id
    opNumber,
    ipNumber,
    bedLabel,
    currentUser,
    defaultLocationId,
}) {
    const [activeTab, setActiveTab] = useState('lab')

    const [loadingSummary, setLoadingSummary] = useState(false)
    const [summary, setSummary] = useState({
        lab: [],
        ris: [],
        rx: [],
        ot: [],
    })

    // ------------- LAB state -------------
    const [labQuery, setLabQuery] = useState('')
    const [labOptions, setLabOptions] = useState([])
    const [labSearching, setLabSearching] = useState(false)
    const [showLabDropdown, setShowLabDropdown] = useState(false)

    const [labSelectedTests, setLabSelectedTests] = useState([]) // [{id, code, name}]
    const [labPriority, setLabPriority] = useState('routine')
    const [labNote, setLabNote] = useState('')
    const [labSubmitting, setLabSubmitting] = useState(false)

    const labTestIds = useMemo(
        () => labSelectedTests.map(t => t.id),
        [labSelectedTests]
    )

    // ------------- RIS state -------------
    const [risQuery, setRisQuery] = useState('')
    const [risOptions, setRisOptions] = useState([])
    const [risSearching, setRisSearching] = useState(false)
    const [showRisDropdown, setShowRisDropdown] = useState(false)

    const [risSelectedTests, setRisSelectedTests] = useState([]) // [{id, code, name, modality}]
    const [risPriority, setRisPriority] = useState('routine')
    const [risNote, setRisNote] = useState('')
    const [risSubmitting, setRisSubmitting] = useState(false)

    const risTestIds = useMemo(
        () => risSelectedTests.map(t => t.id),
        [risSelectedTests]
    )

    // ------------- Pharmacy state -------------
    const [rxQuery, setRxQuery] = useState('')
    const [rxOptions, setRxOptions] = useState([])
    const [rxSearching, setRxSearching] = useState(false)
    const [showRxDropdown, setShowRxDropdown] = useState(false)
    const [rxSelectedItem, setRxSelectedItem] = useState(null)

    const [rxLines, setRxLines] = useState([])
    const [rxDose, setRxDose] = useState('')
    const [rxFreq, setRxFreq] = useState('BD')
    const [rxDuration, setRxDuration] = useState('5')
    const [rxQty, setRxQty] = useState('10')
    const [rxRoute, setRxRoute] = useState('oral')
    const [rxTiming, setRxTiming] = useState('BF')
    const [rxNote, setRxNote] = useState('')
    const [rxSubmitting, setRxSubmitting] = useState(false)

    // ------------- OT state -------------
    const [otDate, setOtDate] = useState('')
    const [otStart, setOtStart] = useState('')
    const [otEnd, setOtEnd] = useState('')

    // Procedure search
    const [otProcedureQuery, setOtProcedureQuery] = useState('')
    const [otProcedureOptions, setOtProcedureOptions] = useState([])
    const [otProcedureSearching, setOtProcedureSearching] = useState(false)
    const [showOtDropdown, setShowOtDropdown] = useState(false)
    const [otSelectedProcedure, setOtSelectedProcedure] = useState(null)

    // Priority, side, notes
    const [otPriority, setOtPriority] = useState('Elective')
    const [otSide, setOtSide] = useState('')
    const [otNote, setOtNote] = useState('')

    // Links to other masters
    const [otPrimaryProcedureId, setOtPrimaryProcedureId] = useState(null)
    // If you want extra procedures in QuickOrders (optional)
    const [otAdditionalProcedureIds, setOtAdditionalProcedureIds] = useState([])

    // Bed & doctors
    const [otBedId, setOtBedId] = useState(null)
    const [otSurgeonId, setOtSurgeonId] = useState(currentUser?.id || null)
    const [otAnaesthetistId, setOtAnaesthetistId] = useState(null)

    const [otSubmitting, setOtSubmitting] = useState(false)


    // ------------- Order details sheet -------------
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailsType, setDetailsType] = useState(null) // 'lab' | 'ris' | 'rx' | 'ot'
    const [detailsItem, setDetailsItem] = useState(null)

    const openDetails = (type, item) => {
        setDetailsType(type)
        setDetailsItem(item)
        setDetailsOpen(true)
    }

    const closeDetails = () => {
        setDetailsOpen(false)
        setDetailsType(null)
        setDetailsItem(null)
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
            ? (ipNumber ? `IP No: ${ipNumber}` : 'IP Number not set')
            : (opNumber ? `OP No: ${opNumber}` : 'OP Number not set')

    const bedInfo =
        ctx === 'ipd' && bedLabel
            ? `Bed: ${bedLabel}`
            : null

    const orderingUserId = currentUser?.id

    // ------------------------------------------------------
    // Load recent orders summary
    // ------------------------------------------------------
    const loadSummary = useCallback(async () => {
        if (!patient?.id || !ctx || !contextId) return
        setLoadingSummary(true)
        try {
            const [lab, ris, rx, ot] = await Promise.all([
                listLabOrdersForContext({
                    patientId: patient.id,
                    contextType: ctx,
                    contextId,
                    limit: 10,
                }),
                listRadiologyOrdersForContext({
                    patientId: patient.id,
                    contextType: ctx,
                    contextId,
                    limit: 10,
                }),
                listPharmacyPrescriptionsForContext({
                    patientId: patient.id,
                    contextType: ctx,
                    contextId,
                    limit: 10,
                }),
                ctx === 'ipd'
                    ? listOtSchedulesForContext({
                        patientId: patient.id,
                        admissionId: contextId,
                        limit: 10,
                    })
                    : Promise.resolve([]),
            ])

            setSummary({
                lab,
                ris,
                rx,
                ot,
            })
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
    // LAB master search
    // ------------------------------------------------------
    useEffect(() => {
        if (!labQuery || labQuery.trim().length < 2) {
            setLabOptions([])
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setLabSearching(true)
                    const { data } = await listLabTests({ q: labQuery.trim() })
                    if (cancelled) return
                    const items = Array.isArray(data) ? data : (data?.items || [])
                    setLabOptions(items)
                    setShowLabDropdown(true)
                } catch (err) {
                    console.error(err)
                    toast.error('Failed to fetch lab tests.')
                } finally {
                    if (!cancelled) setLabSearching(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [labQuery])

    function handleSelectLabTest(t) {
        if (!t?.id) return
        setLabSelectedTests(prev => {
            if (prev.some(x => x.id === t.id)) return prev
            return [
                ...prev,
                {
                    id: t.id,
                    code: t.code || t.short_code || '',
                    name: t.name || t.test_name || '',
                },
            ]
        })
        setLabQuery(t.name || t.test_name || t.code || '')
        setShowLabDropdown(false)
    }

    function handleRemoveLabTest(id) {
        setLabSelectedTests(prev => prev.filter(t => t.id !== id))
    }

    async function handleSubmitLab() {
        if (!labTestIds.length) {
            toast.error('Add at least one lab test.')
            return
        }
        if (!patient?.id) {
            toast.error('Patient missing for lab order.')
            return
        }

        setLabSubmitting(true)
        try {
            await createLisOrder({
                patient_id: patient.id,
                priority: labPriority,
                test_ids: labTestIds,
                // labNote is available if later you want to extend schema
            })

            toast.success('Lab order created')
            setLabSelectedTests([])
            setLabNote('')
            setLabQuery('')
            loadSummary()
        } catch (err) {
            console.error(err)
            const msg = err?.response?.data?.detail || 'Failed to create lab order'
            toast.error(msg)
        } finally {
            setLabSubmitting(false)
        }
    }

    // ------------------------------------------------------
    // RIS master search
    // ------------------------------------------------------
    useEffect(() => {
        if (!risQuery || risQuery.trim().length < 2) {
            setRisOptions([])
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setRisSearching(true)
                    const { data } = await listRisTests({ q: risQuery.trim() })
                    if (cancelled) return
                    const items = Array.isArray(data) ? data : (data?.items || [])
                    setRisOptions(items)
                    setShowRisDropdown(true)
                } catch (err) {
                    console.error(err)
                    toast.error('Failed to fetch radiology tests.')
                } finally {
                    if (!cancelled) setRisSearching(false)
                }
            })()
        return () => { cancelled = true }
    }, [risQuery])

    function handleSelectRisTest(t) {
        if (!t?.id) return
        setRisSelectedTests(prev => {
            if (prev.some(x => x.id === t.id)) return prev
            return [
                ...prev,
                {
                    id: t.id,
                    code: t.code || '',
                    name: t.name || t.test_name || '',
                    modality: t.modality || t.modality_code || '',
                },
            ]
        })
        setRisQuery(t.name || t.test_name || t.code || '')
        setShowRisDropdown(false)
    }

    function handleRemoveRisTest(id) {
        setRisSelectedTests(prev => prev.filter(t => t.id !== id))
    }

    async function handleSubmitRis() {
        if (!risTestIds.length) {
            toast.error('Add at least one radiology test.')
            return
        }
        if (!patient?.id) {
            toast.error('Patient missing for radiology order.')
            return
        }

        setRisSubmitting(true)
        try {
            await Promise.all(
                risTestIds.map(id =>
                    createRisOrder({
                        patient_id: patient.id,
                        test_id: Number(id),
                        priority: risPriority,
                    })
                )
            )

            toast.success('Radiology order(s) created')
            setRisSelectedTests([])
            setRisNote('')
            setRisQuery('')
            loadSummary()
        } catch (err) {
            console.error(err)
            const msg = err?.response?.data?.detail || 'Failed to create radiology order(s)'
            toast.error(msg)
        } finally {
            setRisSubmitting(false)
        }
    }

    // ------------------------------------------------------
    // Pharmacy master search (inventory)
    // ------------------------------------------------------
    useEffect(() => {
        if (!rxQuery || rxQuery.trim().length < 2) {
            setRxOptions([])
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setRxSearching(true)
                    const res = await searchPharmacyItems({
                        q: rxQuery.trim(),
                        type: 'drug',
                        limit: 20,
                    })
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
            })()
        return () => {
            cancelled = true
        }
    }, [rxQuery])

    function handleSelectRxItem(it) {
        setRxSelectedItem(it)
        setRxQuery(it.name || '')
        setShowRxDropdown(false)
    }

    function handleAddRxLine() {
        if (!rxSelectedItem) {
            toast.error('Select a medicine from inventory.')
            return
        }
        const qty = parseFloat(rxQty || '0') || 0
        const duration = parseInt(rxDuration || '0', 10) || null
        if (!qty) {
            toast.error('Enter a valid quantity.')
            return
        }

        setRxLines(prev => [
            ...prev,
            {
                item_id: rxSelectedItem.id,
                item_name: rxSelectedItem.name,
                requested_qty: qty,
                dose_text: rxDose || null,
                frequency_code: rxFreq || null,
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

    async function handleSubmitRx() {
        if (!rxLines.length) {
            toast.error('Add at least one medicine.')
            return
        }
        if (!patient?.id || !ctx || !contextId) {
            toast.error('Missing patient or context for prescription.')
            return
        }

        setRxSubmitting(true)
        try {
            await createPharmacyPrescriptionFromContext({
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
            loadSummary()
        } catch (err) {
            console.error(err)
            toast.error('Failed to create prescription.')
        } finally {
            setRxSubmitting(false)
        }
    }

    function handleRemoveRxLine(idx) {
        setRxLines(prev => prev.filter((_, i) => i !== idx))
    }

    // ------------------------------------------------------
    // OT procedures master search
    // ------------------------------------------------------
    useEffect(() => {
        if (!otProcedureQuery || otProcedureQuery.trim().length < 2) {
            setOtProcedureOptions([])
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setOtProcedureSearching(true)
                    const res = await listOtProcedures({
                        search: otProcedureQuery.trim(),
                        isActive: true,
                        limit: 20,
                    })
                    if (cancelled) return
                    const items = Array.isArray(res?.data?.items)
                        ? res.data.items
                        : (Array.isArray(res?.data) ? res.data : [])
                    setOtProcedureOptions(items)
                    setShowOtDropdown(true)
                } catch (err) {
                    console.error(err)
                    toast.error('Failed to fetch OT procedures.')
                } finally {
                    if (!cancelled) setOtProcedureSearching(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [otProcedureQuery])

    function handleSelectOtProcedure(p) {
        setOtSelectedProcedure(p)
        setOtPrimaryProcedureId(p.id || null)
        setOtProcedureQuery(p.name || p.procedure_name || '')
        setShowOtDropdown(false)
    }


    async function handleSubmitOt() {
        if (ctx !== 'ipd') {
            toast.warning('OT booking via quick orders is only for IPD.')
            return
        }

        if (!otDate || !otStart) {
            toast.warning('Please select OT date and start time.')
            return
        }

        if (!patient?.id || !contextId) {
            toast.error('Missing patient or admission for OT schedule.')
            return
        }

        const surgeonId = otSurgeonId || currentUser?.id
        if (!surgeonId) {
            toast.error('Please select a surgeon for this OT booking.')
            return
        }

        const procedureName =
            otSelectedProcedure
                ? (otSelectedProcedure.name || otSelectedProcedure.procedure_name)
                : otProcedureQuery?.trim()

        if (!procedureName) {
            toast.error('Please enter a procedure name.')
            return
        }

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

            // reset OT form (keep surgeon default if you like)
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

            loadSummary?.()
        } catch (err) {
            console.error('Failed to create OT schedule', err)
            const msg = extractApiError(err, 'Failed to create OT schedule.')
            toast.error(msg)
        } finally {
            setOtSubmitting(false)
        }
    }




    // ------------------------------------------------------
    // Render
    // ------------------------------------------------------
    return (
        <>
            <motion.div className="w-full" {...fadeIn}>
                <Card className="border-slate-200 shadow-sm bg-white/90 backdrop-blur-sm">
                    <CardHeader className="flex flex-col gap-2 border-b border-slate-100 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-sky-600" />
                                <div>
                                    <CardTitle className="text-base sm:text-lg font-semibold text-slate-900">
                                        Quick Orders
                                    </CardTitle>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Create Lab, Radiology, Pharmacy &amp; OT orders directly from this {contextLabel.toLowerCase()}.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge className="bg-slate-900 text-slate-50 px-2.5 py-1 rounded-full">
                                    {contextLabel}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="flex items-center gap-1.5 border-slate-300 bg-slate-50/80"
                                >
                                    <Hash className="h-3 w-3 text-slate-500" />
                                    <span className="font-medium text-slate-800">
                                        {contextNumberLabel}
                                    </span>
                                </Badge>
                                {bedInfo && (
                                    <Badge
                                        variant="outline"
                                        className="flex items-center gap-1.5 border-emerald-300 bg-emerald-50/90"
                                    >
                                        <BedDouble className="h-3 w-3 text-emerald-600" />
                                        <span className="font-medium text-emerald-700">{bedInfo}</span>
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Patient Snapshot */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                                <User className="h-3.5 w-3.5 text-slate-600" />
                                <span className="font-semibold text-slate-900">
                                    {safePatientName(patient)}
                                </span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">
                                <Clock className="h-3.5 w-3.5" />
                                {safeGenderAge(patient)}
                            </span>
                        </div>
                    </CardHeader>

                    <CardContent className="p-3 sm:p-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                            {/* LEFT: Forms */}
                            <div className="space-y-3">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="w-full justify-start overflow-x-auto rounded-xl bg-slate-50 p-1">
                                        <TabsTrigger
                                            value="lab"
                                            className="flex items-center gap-1.5 text-xs sm:text-[13px]"
                                        >
                                            <FlaskConical className="h-3.5 w-3.5" />
                                            Lab
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="ris"
                                            className="flex items-center gap-1.5 text-xs sm:text-[13px]"
                                        >
                                            <Radio className="h-3.5 w-3.5" />
                                            Radiology
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="rx"
                                            className="flex items-center gap-1.5 text-xs sm:text-[13px]"
                                        >
                                            <Pill className="h-3.5 w-3.5" />
                                            Pharmacy
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="ot"
                                            className="flex items-center gap-1.5 text-xs sm:text-[13px]"
                                        >
                                            <ScissorsLineDashed className="h-3.5 w-3.5" />
                                            OT
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* ---------- LAB TAB ---------- */}
                                    <TabsContent value="lab" className="mt-3">
                                        <div className="space-y-3">
                                            <div className="grid sm:grid-cols-[2fr_minmax(0,1fr)] gap-3">
                                                <div className="space-y-1.5 relative">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Lab test (from Master)
                                                    </label>
                                                    <div className="relative">
                                                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                        <Input
                                                            value={labQuery}
                                                            onChange={e => {
                                                                setLabQuery(e.target.value)
                                                                setShowLabDropdown(true)
                                                            }}
                                                            placeholder="Search test code / name…"
                                                            className="h-9 text-xs pl-7"
                                                        />
                                                    </div>
                                                    {showLabDropdown && (labOptions.length > 0 || labSearching) && (
                                                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-auto text-xs">
                                                            {labSearching && (
                                                                <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    Searching…
                                                                </div>
                                                            )}
                                                            {!labSearching && !labOptions.length && (
                                                                <div className="px-3 py-2 text-slate-500">
                                                                    No tests found.
                                                                </div>
                                                            )}
                                                            {!labSearching &&
                                                                labOptions.map(t => (
                                                                    <button
                                                                        key={t.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectLabTest(t)}
                                                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                    >
                                                                        <span className="font-medium text-slate-900">
                                                                            {t.name || t.test_name}
                                                                        </span>
                                                                        <span className="text-[11px] text-slate-500">
                                                                            {t.code || t.short_code || '—'}
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}
                                                    <p className="text-[11px] text-slate-500">
                                                        Pulling from Lab Test Masters (LIS).
                                                    </p>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Priority
                                                    </label>
                                                    <div className="flex gap-1.5">
                                                        {['routine', 'urgent', 'stat'].map(p => (
                                                            <Button
                                                                key={p}
                                                                type="button"
                                                                size="sm"
                                                                variant={labPriority === p ? 'default' : 'outline'}
                                                                className={`flex-1 h-8 text-xs font-semibold ${labPriority === p
                                                                    ? 'bg-sky-600 hover:bg-sky-700 text-white'
                                                                    : 'border-slate-300 text-slate-700'
                                                                    }`}
                                                                onClick={() => setLabPriority(p)}
                                                            >
                                                                {p === 'routine'
                                                                    ? 'Routine'
                                                                    : p === 'urgent'
                                                                        ? 'Urgent'
                                                                        : 'STAT'}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {labSelectedTests.length > 0 && (
                                                <ScrollArea className="max-h-32 rounded-md border border-slate-200 bg-slate-50/60 p-2">
                                                    <ul className="space-y-1.5 text-xs">
                                                        {labSelectedTests.map(t => (
                                                            <li
                                                                key={t.id}
                                                                className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 shadow-xs border border-slate-100"
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-slate-900">
                                                                        {t.name || 'Lab test'}
                                                                    </span>
                                                                    <span className="text-[11px] text-slate-500">
                                                                        Code: {t.code || '—'}
                                                                    </span>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                                    onClick={() => handleRemoveLabTest(t.id)}
                                                                >
                                                                    ×
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </ScrollArea>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Note (optional)
                                                </label>
                                                <Textarea
                                                    rows={2}
                                                    value={labNote}
                                                    onChange={e => setLabNote(e.target.value)}
                                                    placeholder="Any special instructions for sample collection / processing."
                                                    className="resize-none text-xs"
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={labSubmitting}
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
                                            <div className="grid sm:grid-cols-[2fr_minmax(0,1fr)] gap-3">
                                                <div className="space-y-1.5 relative">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Radiology test (from RIS Masters)
                                                    </label>
                                                    <div className="relative">
                                                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                        <Input
                                                            value={risQuery}
                                                            onChange={e => {
                                                                setRisQuery(e.target.value)
                                                                setShowRisDropdown(true)
                                                            }}
                                                            placeholder="Search X-Ray / CT / MRI / USG…"
                                                            className="h-9 text-xs pl-7"
                                                        />
                                                    </div>
                                                    {showRisDropdown && (risOptions.length > 0 || risSearching) && (
                                                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-auto text-xs">
                                                            {risSearching && (
                                                                <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    Searching…
                                                                </div>
                                                            )}
                                                            {!risSearching && !risOptions.length && (
                                                                <div className="px-3 py-2 text-slate-500">
                                                                    No tests found.
                                                                </div>
                                                            )}
                                                            {!risSearching &&
                                                                risOptions.map(t => (
                                                                    <button
                                                                        key={t.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectRisTest(t)}
                                                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                    >
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-medium text-slate-900">
                                                                                {t.name || t.test_name}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-500">
                                                                                {t.modality || t.modality_code || '—'}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[11px] text-slate-500">
                                                                            {t.code || '—'}
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}
                                                    <p className="text-[11px] text-slate-500">
                                                        Linked to Radiology Test &amp; Modality masters.
                                                    </p>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Priority
                                                    </label>
                                                    <div className="flex gap-1.5">
                                                        {['routine', 'urgent', 'stat'].map(p => (
                                                            <Button
                                                                key={p}
                                                                type="button"
                                                                size="sm"
                                                                variant={risPriority === p ? 'default' : 'outline'}
                                                                className={`flex-1 h-8 text-xs font-semibold ${risPriority === p
                                                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                                    : 'border-slate-300 text-slate-700'
                                                                    }`}
                                                                onClick={() => setRisPriority(p)}
                                                            >
                                                                {p === 'routine'
                                                                    ? 'Routine'
                                                                    : p === 'urgent'
                                                                        ? 'Urgent'
                                                                        : 'STAT'}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {risSelectedTests.length > 0 && (
                                                <ScrollArea className="max-h-32 rounded-md border border-slate-200 bg-slate-50/60 p-2">
                                                    <ul className="space-y-1.5 text-xs">
                                                        {risSelectedTests.map(t => (
                                                            <li
                                                                key={t.id}
                                                                className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 shadow-xs border border-slate-100"
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-slate-900">
                                                                        {t.name || 'Radiology test'}
                                                                    </span>
                                                                    <span className="text-[11px] text-slate-500">
                                                                        {t.modality || 'RIS'} • Code: {t.code || '—'}
                                                                    </span>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                                    onClick={() => handleRemoveRisTest(t.id)}
                                                                >
                                                                    ×
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </ScrollArea>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Note (optional)
                                                </label>
                                                <Textarea
                                                    rows={2}
                                                    value={risNote}
                                                    onChange={e => setRisNote(e.target.value)}
                                                    placeholder="Side / position / contrast / clinical history etc."
                                                    className="resize-none text-xs"
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={risSubmitting}
                                                    onClick={handleSubmitRis}
                                                    className="h-9 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                                >
                                                    {risSubmitting
                                                        ? 'Placing Radiology Order…'
                                                        : 'Place Radiology Order'}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ---------- PHARMACY TAB ---------- */}
                                    <TabsContent value="rx" className="mt-3">
                                        <div className="space-y-3">
                                            <div className="space-y-1.5 relative">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Search medicine (linked to Pharmacy Inventory)
                                                </label>
                                                <div className="relative">
                                                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                    <Input
                                                        value={rxQuery}
                                                        onChange={e => {
                                                            setRxQuery(e.target.value)
                                                            setShowRxDropdown(true)
                                                        }}
                                                        placeholder="Search drug name / brand / generic…"
                                                        className="h-9 text-xs pl-7"
                                                    />
                                                </div>
                                                {showRxDropdown && (rxOptions.length > 0 || rxSearching) && (
                                                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-auto text-xs">
                                                        {rxSearching && (
                                                            <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                Searching…
                                                            </div>
                                                        )}
                                                        {!rxSearching && !rxOptions.length && (
                                                            <div className="px-3 py-2 text-slate-500">
                                                                No items found.
                                                            </div>
                                                        )}
                                                        {!rxSearching &&
                                                            rxOptions.map(it => (
                                                                <button
                                                                    key={it.id}
                                                                    type="button"
                                                                    onClick={() => handleSelectRxItem(it)}
                                                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                >
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-medium text-slate-900">
                                                                            {it.name}
                                                                        </span>
                                                                        {it.code && (
                                                                            <span className="text-[10px] text-slate-500">
                                                                                {it.code}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[11px] text-slate-500">
                                                                        {it.strength || it.form || ''}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Dose</label>
                                                    <Input
                                                        value={rxDose}
                                                        onChange={e => setRxDose(e.target.value)}
                                                        placeholder="e.g. 500 mg"
                                                        className="h-8 text-[11px]"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Freq</label>
                                                    <Input
                                                        value={rxFreq}
                                                        onChange={e => setRxFreq(e.target.value)}
                                                        placeholder="BD / TID / 1-0-1"
                                                        className="h-8 text-[11px]"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Days</label>
                                                    <Input
                                                        value={rxDuration}
                                                        onChange={e => setRxDuration(e.target.value)}
                                                        placeholder="5"
                                                        className="h-8 text-[11px]"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Qty</label>
                                                    <Input
                                                        value={rxQty}
                                                        onChange={e => setRxQty(e.target.value)}
                                                        placeholder="10"
                                                        className="h-8 text-[11px]"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Route</label>
                                                    <Input
                                                        value={rxRoute}
                                                        onChange={e => setRxRoute(e.target.value)}
                                                        placeholder="oral / IV / IM"
                                                        className="h-8 text-[11px]"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-600">Timing</label>
                                                    <Input
                                                        value={rxTiming}
                                                        onChange={e => setRxTiming(e.target.value)}
                                                        placeholder="BF / AF"
                                                        className="h-8 text-[11px]"
                                                    />
                                                </div>
                                                <div className="flex items-end justify-end">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-8 px-3 text-[11px] rounded-full"
                                                        onClick={handleAddRxLine}
                                                    >
                                                        Add line
                                                    </Button>
                                                </div>
                                            </div>

                                            {rxLines.length > 0 && (
                                                <div className="border border-slate-200 rounded-xl bg-slate-50/60 overflow-hidden">
                                                    <ScrollArea className="max-h-40">
                                                        <table className="w-full text-[11px]">
                                                            <thead className="bg-slate-100 text-slate-600">
                                                                <tr>
                                                                    <th className="px-2 py-1 text-left font-medium">#</th>
                                                                    <th className="px-2 py-1 text-left font-medium">Medicine</th>
                                                                    <th className="px-2 py-1 text-left font-medium">Dose / Freq / Days</th>
                                                                    <th className="px-2 py-1 text-right font-medium">Qty</th>
                                                                    <th className="px-2 py-1 text-right font-medium">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {rxLines.map((l, idx) => (
                                                                    <tr key={idx} className="border-t border-slate-100">
                                                                        <td className="px-2 py-1 align-top text-slate-500">
                                                                            {idx + 1}
                                                                        </td>
                                                                        <td className="px-2 py-1 align-top">
                                                                            <div className="text-[11px] font-medium text-slate-900">
                                                                                {l.item_name}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-2 py-1 align-top text-[11px] text-slate-700">
                                                                            {l.dose_text || rxDose || '—'} •{' '}
                                                                            {l.frequency_code || rxFreq || '—'} •{' '}
                                                                            {l.duration_days || rxDuration || '—'} d
                                                                        </td>
                                                                        <td className="px-2 py-1 align-top text-right text-[11px] text-slate-700">
                                                                            {l.requested_qty}
                                                                        </td>
                                                                        <td className="px-2 py-1 align-top text-right">
                                                                            <Button
                                                                                type="button"
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                                                onClick={() => handleRemoveRxLine(idx)}
                                                                            >
                                                                                ×
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </ScrollArea>
                                                </div>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Clinical notes / Rx note (optional)
                                                </label>
                                                <Textarea
                                                    rows={2}
                                                    value={rxNote}
                                                    onChange={e => setRxNote(e.target.value)}
                                                    className="resize-none text-xs"
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={rxSubmitting}
                                                    onClick={handleSubmitRx}
                                                    className="h-9 px-4 text-xs font-semibold"
                                                >
                                                    {rxSubmitting ? 'Saving Rx…' : 'Save & Send to Pharmacy'}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>
                                    {/* Ot tab */}
                                    <TabsContent value="ot" className="mt-3">
                                        <div className="space-y-3">
                                            {/* Row 1: Date & time */}
                                            <div className="grid sm:grid-cols-3 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        OT Date <span className="text-rose-500">*</span>
                                                    </label>
                                                    <Input
                                                        type="date"
                                                        value={otDate}
                                                        onChange={e => setOtDate(e.target.value)}
                                                        className="h-9 text-xs"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Start time <span className="text-rose-500">*</span>
                                                    </label>
                                                    <Input
                                                        type="time"
                                                        value={otStart}
                                                        onChange={e => setOtStart(e.target.value)}
                                                        className="h-9 text-xs"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        End time (optional)
                                                    </label>
                                                    <Input
                                                        type="time"
                                                        value={otEnd}
                                                        onChange={e => setOtEnd(e.target.value)}
                                                        className="h-9 text-xs"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 2: Bed (OT location) */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    OT Location / Bed
                                                </label>
                                                <WardRoomBedPicker
                                                    value={otBedId ? Number(otBedId) : null}
                                                    onChange={bedId => setOtBedId(bedId || null)}
                                                />
                                                <p className="text-[11px] text-slate-500">
                                                    Uses the same Ward → Room → Bed mapping as main OT Schedule page.
                                                </p>
                                            </div>

                                            {/* Row 3: Procedure (master + free text) */}
                                            <div className="space-y-1.5 relative">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Procedure (from OT Master or free text)
                                                </label>
                                                <div className="relative">
                                                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2.5" />
                                                    <Input
                                                        value={otProcedureQuery}
                                                        onChange={e => {
                                                            setOtProcedureQuery(e.target.value)
                                                            setShowOtDropdown(true)
                                                        }}
                                                        placeholder="Search procedure name / code…"
                                                        className="h-9 text-xs pl-7"
                                                    />
                                                </div>
                                                {showOtDropdown &&
                                                    (otProcedureOptions.length > 0 || otProcedureSearching) && (
                                                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-auto text-xs">
                                                            {otProcedureSearching && (
                                                                <div className="px-3 py-2 flex items-center gap-2 text-slate-500">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    Searching…
                                                                </div>
                                                            )}
                                                            {!otProcedureSearching &&
                                                                !otProcedureOptions.length && (
                                                                    <div className="px-3 py-2 text-slate-500">
                                                                        No procedures found.
                                                                    </div>
                                                                )}
                                                            {!otProcedureSearching &&
                                                                otProcedureOptions.map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectOtProcedure(p)}
                                                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                                                    >
                                                                        <span className="font-medium text-slate-900">
                                                                            {p.name || p.procedure_name}
                                                                        </span>
                                                                        <span className="text-[11px] text-slate-500">
                                                                            {p.code || '—'}
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}
                                                <p className="text-[11px] text-slate-500">
                                                    If you just type and don&apos;t pick from list, it will save as free-text procedure name.
                                                </p>
                                            </div>

                                            {/* Row 4: Side + Priority */}
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Side
                                                    </label>
                                                    <select
                                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                        value={otSide}
                                                        onChange={e => setOtSide(e.target.value)}
                                                    >
                                                        <option value="">Not applicable</option>
                                                        <option value="Right">Right</option>
                                                        <option value="Left">Left</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                        <option value="Midline">Midline</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-600">
                                                        Priority
                                                    </label>
                                                    <div className="flex gap-1.5">
                                                        {['Elective', 'Emergency'].map(p => (
                                                            <Button
                                                                key={p}
                                                                type="button"
                                                                size="sm"
                                                                variant={otPriority === p ? 'default' : 'outline'}
                                                                className={`flex-1 h-8 text-xs font-semibold ${otPriority === p
                                                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                    : 'border-slate-300 text-slate-700'
                                                                    }`}
                                                                onClick={() => setOtPriority(p)}
                                                            >
                                                                {p}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 5: Surgeon & Anaesthetist */}
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <DoctorPicker
                                                    label="Surgeon"
                                                    value={otSurgeonId ? Number(otSurgeonId) : null}
                                                    onChange={id => setOtSurgeonId(id || null)}
                                                />
                                                <DoctorPicker
                                                    label="Anaesthetist"
                                                    value={otAnaesthetistId ? Number(otAnaesthetistId) : null}
                                                    onChange={id => setOtAnaesthetistId(id || null)}
                                                />
                                            </div>

                                            {/* Row 6: Notes */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-600">
                                                    Notes / anaesthesia plan (optional)
                                                </label>
                                                <Textarea
                                                    rows={2}
                                                    value={otNote}
                                                    onChange={e => setOtNote(e.target.value)}
                                                    className="resize-none text-xs"
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={otSubmitting}
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

                            {/* RIGHT: Recent orders summary with details view */}
                            <div className="space-y-3">
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
                                <Card className="border-slate-200 bg-slate-50/70">
                                    <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FlaskConical className="h-4 w-4 text-sky-600" />
                                            <CardTitle className="text-xs font-semibold">
                                                Lab Orders
                                            </CardTitle>
                                        </div>
                                        <StatusChip tone="lab">
                                            {summary.lab?.length || 0} orders
                                        </StatusChip>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3 pt-0">
                                        <div className="space-y-1.5 max-h-32 overflow-auto text-[11px]">
                                            {!summary.lab?.length && !loadingSummary && (
                                                <div className="text-slate-500 text-[11px]">
                                                    No lab orders for this context yet.
                                                </div>
                                            )}
                                            {summary.lab?.map(o => (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    onClick={() => openDetails('lab', o)}
                                                    className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900">
                                                            {o.order_no || `LAB-${String(o.id).padStart(6, '0')}`}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {fmtDT(o.created_at || o.order_datetime)}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-600 capitalize">
                                                        {o.status || 'ordered'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* RIS SUMMARY */}
                                <Card className="border-slate-200 bg-slate-50/70">
                                    <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Radio className="h-4 w-4 text-indigo-600" />
                                            <CardTitle className="text-xs font-semibold">
                                                Radiology Orders
                                            </CardTitle>
                                        </div>
                                        <StatusChip tone="ris">
                                            {summary.ris?.length || 0} orders
                                        </StatusChip>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3 pt-0">
                                        <div className="space-y-1.5 max-h-32 overflow-auto text-[11px]">
                                            {!summary.ris?.length && !loadingSummary && (
                                                <div className="text-slate-500 text-[11px]">
                                                    No radiology orders for this context yet.
                                                </div>
                                            )}
                                            {summary.ris?.map(o => (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    onClick={() => openDetails('ris', o)}
                                                    className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900">
                                                            {o.order_no || `RIS-${String(o.id).padStart(6, '0')}`}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {fmtDT(o.created_at || o.order_datetime)}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-600 capitalize">
                                                        {o.status || 'ordered'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* RX SUMMARY */}
                                <Card className="border-slate-200 bg-slate-50/70">
                                    <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Pill className="h-4 w-4 text-emerald-600" />
                                            <CardTitle className="text-xs font-semibold">
                                                Pharmacy Rx
                                            </CardTitle>
                                        </div>
                                        <StatusChip tone="rx">
                                            {summary.rx?.length || 0} Rx
                                        </StatusChip>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3 pt-0">
                                        <div className="space-y-1.5 max-h-32 overflow-auto text-[11px]">
                                            {!summary.rx?.length && !loadingSummary && (
                                                <div className="text-slate-500 text-[11px]">
                                                    No prescriptions for this context yet.
                                                </div>
                                            )}
                                            {summary.rx?.map(o => (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    onClick={() => openDetails('rx', o)}
                                                    className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900">
                                                            {o.rx_number || `RX-${String(o.id).padStart(6, '0')}`}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {fmtDT(o.rx_datetime || o.created_at)}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-600 capitalize">
                                                        {o.status || 'pending'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* OT SUMMARY (IPD only) */}
                                {ctx === 'ipd' && (
                                    <Card className="border-slate-200 bg-slate-50/70">
                                        <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ScissorsLineDashed className="h-4 w-4 text-amber-600" />
                                                <CardTitle className="text-xs font-semibold">
                                                    OT Schedules
                                                </CardTitle>
                                            </div>
                                            <StatusChip tone="ot">
                                                {summary.ot?.length || 0} cases
                                            </StatusChip>
                                        </CardHeader>
                                        <CardContent className="px-3 pb-3 pt-0">
                                            <div className="space-y-1.5 max-h-32 overflow-auto text-[11px]">
                                                {!summary.ot?.length && !loadingSummary && (
                                                    <div className="text-slate-500 text-[11px]">
                                                        No OT schedules for this admission yet.
                                                    </div>
                                                )}
                                                {summary.ot?.map(o => (
                                                    <button
                                                        key={o.id}
                                                        type="button"
                                                        onClick={() => openDetails('ot', o)}
                                                        className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/80 border border-slate-100 hover:bg-slate-50"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-900">
                                                                {o.schedule_no || `OT-${String(o.id).padStart(6, '0')}`}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500">
                                                                {o.date} {o.planned_start_time || ''}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-600">
                                                            {o.priority || 'Elective'}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>

                        {/* WARNING if context missing */}
                        {!ctx && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>
                                    Context (OPD / IPD) is not set. Orders will be created but may not be linked to this visit/admission.
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* ORDER DETAILS SHEET */}
            <Sheet open={detailsOpen} onOpenChange={open => !open && closeDetails()}>
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
                            Snapshot of the selected order for this patient.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 space-y-3 text-xs text-slate-700">
                        {!detailsItem && (
                            <p className="text-slate-500">Select an order from the right panel to view details.</p>
                        )}

                        {detailsItem && (
                            <>
                                {/* Common meta */}
                                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2">
                                    <div>
                                        <div className="text-[11px] text-slate-500">Patient</div>
                                        <div className="font-semibold text-slate-900">
                                            {safePatientName(patient)}
                                        </div>
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
                                                ? fmtDT(detailsItem.rx_datetime || detailsItem.created_at)
                                                : detailsType === 'ot'
                                                    ? fmtDT(detailsItem.created_at || detailsItem.date)
                                                    : fmtDT(detailsItem.created_at || detailsItem.order_datetime)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500">Status</div>
                                        <div className="capitalize">
                                            {detailsItem.status || (detailsType === 'rx' ? 'pending' : 'ordered')}
                                        </div>
                                    </div>
                                </div>

                                {/* Type-specific blocks */}
                                {detailsType === 'lab' && (
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] text-slate-500">Order Number</div>
                                        <div className="font-semibold text-slate-900">
                                            {detailsItem.order_no || `LAB-${String(detailsItem.id).padStart(6, '0')}`}
                                        </div>
                                        {detailsItem.tests && detailsItem.tests.length > 0 && (
                                            <div className="mt-2">
                                                <div className="text-[11px] text-slate-500 mb-1">
                                                    Tests
                                                </div>
                                                <ul className="space-y-1">
                                                    {detailsItem.tests.map(t => (
                                                        <li
                                                            key={t.id || t.test_id}
                                                            className="flex justify-between rounded-md bg-white px-2 py-1 border border-slate-100"
                                                        >
                                                            <span className="font-medium">
                                                                {t.name || t.test_name || 'Test'}
                                                            </span>
                                                            <span className="text-[11px] text-slate-500">
                                                                {t.code || '—'}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detailsType === 'ris' && (
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] text-slate-500">Order Number</div>
                                        <div className="font-semibold text-slate-900">
                                            {detailsItem.order_no || `RIS-${String(detailsItem.id).padStart(6, '0')}`}
                                        </div>
                                        {detailsItem.test && (
                                            <div className="mt-2 space-y-1">
                                                <div className="text-[11px] text-slate-500">
                                                    Test &amp; Modality
                                                </div>
                                                <div className="rounded-md bg-white px-2 py-1 border border-slate-100">
                                                    <div className="font-medium">
                                                        {detailsItem.test.name || detailsItem.test.test_name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {detailsItem.test.modality || detailsItem.test.modality_code || '—'} • Code:{' '}
                                                        {detailsItem.test.code || '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detailsType === 'rx' && (
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] text-slate-500">Rx Number</div>
                                        <div className="font-semibold text-slate-900">
                                            {detailsItem.rx_number || `RX-${String(detailsItem.id).padStart(6, '0')}`}
                                        </div>
                                        {detailsItem.lines && detailsItem.lines.length > 0 && (
                                            <div className="mt-2">
                                                <div className="text-[11px] text-slate-500 mb-1">
                                                    Medicines
                                                </div>
                                                <ul className="space-y-1">
                                                    {detailsItem.lines.map((l, idx) => (
                                                        <li
                                                            key={idx}
                                                            className="rounded-md bg-white px-2 py-1 border border-slate-100"
                                                        >
                                                            <div className="font-medium">
                                                                {l.item_name}
                                                            </div>
                                                            <div className="text-[11px] text-slate-600">
                                                                {l.dose_text || '—'} • {l.frequency_code || '—'} •{' '}
                                                                {l.duration_days || '—'} d • Qty {l.requested_qty}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {detailsItem.notes && (
                                            <div className="mt-2">
                                                <div className="text-[11px] text-slate-500 mb-1">Notes</div>
                                                <div className="rounded-md bg-white px-2 py-1 border border-slate-100 text-[11px]">
                                                    {detailsItem.notes}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detailsType === 'ot' && (
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] text-slate-500">Schedule</div>
                                        <div className="font-semibold text-slate-900">
                                            {detailsItem.schedule_no || `OT-${String(detailsItem.id).padStart(6, '0')}`}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <div className="text-[11px] text-slate-500">Date</div>
                                                <div>{detailsItem.date || '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] text-slate-500">Time</div>
                                                <div>
                                                    {detailsItem.planned_start_time || '—'}
                                                    {detailsItem.planned_end_time
                                                        ? ` – ${detailsItem.planned_end_time}`
                                                        : ''}
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
                                            <div className="rounded-md bg-white px-2 py-1 border border-slate-100 text-[11px]">
                                                {detailsItem.primary_procedure?.name ||
                                                    detailsItem.procedure_name ||
                                                    '—'}
                                            </div>
                                        </div>

                                        {detailsItem.notes && (
                                            <div className="mt-2">
                                                <div className="text-[11px] text-slate-500 mb-1">Notes</div>
                                                <div className="rounded-md bg-white px-2 py-1 border border-slate-100 text-[11px]">
                                                    {detailsItem.notes}
                                                </div>
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
