// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { getOtCase, getOtCasePdfBlob } from '../api/ot'
import { useCan } from '../hooks/useCan'

import {
    ArrowLeft,
    Stethoscope,
    BedDouble,
    Clock3,
    User,
    HeartPulse,
    ClipboardList,
    Hash,
    CalendarDays,
    FileText,
    Download,
    Eye,
    X,
    Building2,
    Users,
    ChevronRight,
} from 'lucide-react'

import PreopTab from './tabs/PreopTab'
import SafetyTab from './tabs/SafetyTab'
import AnaesthesiaTab from './tabs/AnaesthesiaTab'
import OperationNotesTab from './tabs/OperationNotesTab'
import PacuTab from './tabs/PacuTab'
import NursingTab from './tabs/NursingTab'
import CountsTab from './tabs/CountsTab'
import BloodTab from './tabs/BloodTab'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatIST } from '@/ipd/components/timeZONE'

const TABS = [
    { id: 'preop', label: 'Pre-op' },
    { id: 'safety', label: 'WHO Safety' },
    { id: 'anaesthesia', label: 'Anaesthesia' },
    // { id: 'nursing', label: 'Nursing' },
    { id: 'counts', label: 'Counts' },
    // { id: 'blood', label: 'Blood & Fluids' },
    { id: 'notes', label: 'Op Notes' },
    { id: 'pacu', label: 'PACU' },
]

// --------- helpers ----------
function safeDate(value) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d
}
function formatDate(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatTime(value) {
    if (!value) return '—'
    if (typeof value === 'string') {
        const m = value.match(/^(\d{2}):(\d{2})/)
        if (m) return `${m[1]}:${m[2]}`
    }
    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function joinNonEmpty(...parts) {
    return parts.filter(Boolean).join(' · ')
}
function buildPatientName(patient) {
    if (!patient) return '—'
    const prefix = patient.prefix || patient.title
    const first = patient.first_name || patient.given_name
    const last = patient.last_name || patient.family_name
    const full = [prefix, first, last].filter(Boolean).join(' ')
    return full || patient.full_name || patient.display_name || '—'
}
function buildAgeSex(patient) {
    if (!patient) return null
    const sex = patient.sex || patient.gender || patient.sex_label || null
    let agePart = patient.age_display || patient.age || null

    if (!agePart && (patient.age_years != null || patient.age_months != null)) {
        const y = patient.age_years
        const m = patient.age_months
        if (y != null && m != null) agePart = `${y}y ${m}m`
        else if (y != null) agePart = `${y}y`
        else if (m != null) agePart = `${m}m`
    }

    if (!agePart && patient.dob) {
        const dob = safeDate(patient.dob)
        if (dob) {
            const now = new Date()
            let years = now.getFullYear() - dob.getFullYear()
            const mm = now.getMonth() - dob.getMonth()
            if (mm < 0 || (mm === 0 && now.getDate() < dob.getDate())) years--
            agePart = `${years}y`
        }
    }

    if (agePart && sex) return `${agePart} / ${sex}`
    if (agePart) return agePart
    if (sex) return sex
    return null
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'ot_case.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

/** --- OT Team helpers (robust for string/object/array) --- */
function normalizePerson(p) {
    if (!p) return null
    if (typeof p === 'string') return p.trim() || null
    if (typeof p === 'number') return `#${p}`
    if (typeof p === 'object') {
        if (p.full_name) return String(p.full_name)
        if (p.display_name) return String(p.display_name)
        if (p.name) return String(p.name)
        if (p.label) return String(p.label)
        if (p.username) return String(p.username)

        if (p.user) return normalizePerson(p.user)
        if (p.doctor) return normalizePerson(p.doctor)
        if (p.staff) return normalizePerson(p.staff)
        if (p.person) return normalizePerson(p.person)

        const first = p.first_name || p.given_name
        const last = p.last_name || p.family_name
        const nm = [first, last].filter(Boolean).join(' ')
        if (nm) return nm

        if (p.id != null) return `#${p.id}`
    }
    return null
}
function toNameList(v) {
    if (!v) return []
    if (Array.isArray(v)) return v.map(normalizePerson).filter(Boolean)
    return [normalizePerson(v)].filter(Boolean)
}
function uniq(list) {
    return Array.from(new Set((list || []).filter(Boolean)))
}
function extractFromTeamArray(teamArray, roleNeedles = []) {
    if (!Array.isArray(teamArray) || !roleNeedles.length) return []
    const needles = roleNeedles.map((x) => String(x).toLowerCase())
    return teamArray
        .filter((x) => {
            const r = String(
                x?.role ||
                x?.role_code ||
                x?.role_name ||
                x?.type ||
                x?.category ||
                x?.designation ||
                x?.speciality ||
                x?.specialty ||
                ''
            ).toLowerCase()
            return needles.some((n) => r.includes(n))
        })
        .map((x) => normalizePerson(x?.person || x?.user || x?.doctor || x?.staff || x))
        .filter(Boolean)
}
function buildTheatreLabel(schedule) {
    if (!schedule) return null
    const theatreObj =
        schedule.theatre ||
        schedule.theater ||
        schedule.ot_theatre ||
        schedule.operating_theatre ||
        schedule.ot_room ||
        schedule.room ||
        null

    const fromObj = theatreObj
        ? joinNonEmpty(
            theatreObj.code || theatreObj.theatre_code || theatreObj.room_code,
            theatreObj.name || theatreObj.theatre_name || theatreObj.room_name,
            theatreObj.location || theatreObj.floor
        )
        : null

    const fromFlat = joinNonEmpty(
        schedule.theatre_code || schedule.theater_code || schedule.ot_theatre_code,
        schedule.theatre_name ||
        schedule.theater_name ||
        schedule.ot_theatre_name ||
        schedule.ot_room_name
    )

    return fromObj || fromFlat || null
}

/* ----------------- UI bits ----------------- */
function Chip({ icon: Icon, children }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[12px] font-medium text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.05)]">
            {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
            {children}
        </span>
    )
}

function SoftCard({ children, className = '' }) {
    return (
        <div
            className={
                'rounded-[24px] border border-slate-200 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.08)] ' +
                className
            }
        >
            {children}
        </div>
    )
}

function IconBadge({ variant = 'sky', icon: Icon }) {
    const map = {
        sky: 'bg-sky-50 text-sky-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        indigo: 'bg-indigo-50 text-indigo-700',
        amber: 'bg-amber-50 text-amber-700',
        rose: 'bg-rose-50 text-rose-700',
        slate: 'bg-slate-100 text-slate-700',
    }
    return (
        <span className={'inline-flex h-9 w-9 items-center justify-center rounded-2xl ' + (map[variant] || map.slate)}>
            <Icon className="h-5 w-5" />
        </span>
    )
}

function InfoRow({ label, value, right = false }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] text-slate-500">{label}</div>
            <div className={'text-[12px] font-medium text-slate-900 ' + (right ? 'text-right' : '')}>
                {value || '—'}
            </div>
        </div>
    )
}

function SkeletonBlock({ h = 'h-10' }) {
    return <div className={`${h} w-full animate-pulse rounded-2xl bg-slate-100`} />
}

export default function OtCaseDetailPage() {
    const { caseId } = useParams()
    const navigate = useNavigate()

    const canView =
        useCan('ot.cases.view') ||
        useCan('ot.cases.update') ||
        useCan('ot.cases.create') ||
        useCan('ot.schedule.view') ||
        useCan('ot.schedules.view') ||
        useCan('ipd.view')

    const [tab, setTab] = useState('preop')
    const [caseData, setCaseData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // PDF states
    const [pdfBusy, setPdfBusy] = useState(false)
    const [pdfOpen, setPdfOpen] = useState(false)
    const [pdfUrl, setPdfUrl] = useState(null)

    const loadCase = async () => {
        if (!canView || !caseId) return
        try {
            setLoading(true)
            setError(null)
            const res = await getOtCase(caseId)
            setCaseData(res.data || null)
        } catch (err) {
            console.error('Failed to load OT case', err)
            const status = err?.response?.status
            if (status === 404) setError('OT case not found.')
            else if (status === 403) setError('You do not have permission to view this OT case.')
            else setError('Failed to load OT case. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCase()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        }
    }, [pdfUrl])

    if (!canView) {
        return (
            <div className="p-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    You do not have permission to view OT cases.
                </div>
            </div>
        )
    }

    const schedule = caseData?.schedule
    const patient = schedule?.patient
    const admission = schedule?.admission || null

    const otBed = schedule?.ot_bed || schedule?.bed || null
    const wardBed = admission?.current_bed || null
    const bed = otBed || wardBed

    const theatreLabel = buildTheatreLabel(schedule)

    const patientName = buildPatientName(patient)
    const ageSex = buildAgeSex(patient)

    const otRegNo =
        schedule?.reg_no ||
        schedule?.display_number ||
        schedule?.ot_number ||
        schedule?.schedule_code ||
        null

    const uhid = patient?.uhid || patient?.uhid_number || schedule?.patient_uhid || null
    const ipNo = admission?.display_code || admission?.admission_code || null
    const opNo = schedule?.op_no || null

    const admissionDate = admission?.admitted_at || admission?.admission_date || null
    const bedLabel = bed ? joinNonEmpty(bed.ward_name, bed.room_name, bed.code) : null

    const primaryProcedure =
        caseData?.final_procedure_name ||
        schedule?.procedure_name ||
        schedule?.primary_procedure_name ||
        '—'

    const additionalProcedures =
        schedule?.additional_procedures?.length
            ? schedule.additional_procedures
                .map((p) => p.name || p.procedure_name)
                .filter(Boolean)
                .join(', ')
            : null

    const plannedStart = schedule?.planned_start_time || schedule?.planned_start || null
    const plannedEnd = schedule?.planned_end_time || schedule?.planned_end || null
    const actualStart = caseData?.actual_start_time
    const actualEnd = caseData?.actual_end_time

    const scheduleDate = schedule?.date || plannedStart || plannedEnd || null

    const teamArray =
        schedule?.team ||
        schedule?.doctors ||
        schedule?.staff ||
        schedule?.staff_assignments ||
        caseData?.team ||
        null

    const surgeonNames = uniq([
        ...toNameList(schedule?.surgeon),
        ...toNameList(schedule?.surgeons),
        ...toNameList(schedule?.primary_surgeon),
        ...toNameList(schedule?.surgeon_user),
        ...toNameList(caseData?.surgeon),
        ...extractFromTeamArray(teamArray, ['surgeon']),
    ])

    const anaesthesiaNames = uniq([
        ...toNameList(schedule?.anaesthetist),
        ...toNameList(schedule?.anesthetist),
        ...toNameList(schedule?.anaesthesiologist),
        ...toNameList(schedule?.anesthesiologist),
        ...toNameList(schedule?.anaesthesia_doctor),
        ...toNameList(schedule?.anesthesia_doctor),
        ...toNameList(caseData?.anaesthetist),
        ...toNameList(caseData?.anesthetist),
        ...extractFromTeamArray(teamArray, ['anaest', 'anesth', 'anaesthesia', 'anesthesia']),
    ])

    const pediatricNames = uniq([
        ...toNameList(schedule?.pediatrician),
        ...toNameList(schedule?.paediatrician),
        ...toNameList(schedule?.pediatric),
        ...toNameList(schedule?.paediatric),
        ...toNameList(schedule?.peds_doctor),
        ...toNameList(schedule?.pediatric_doctor),
        ...toNameList(schedule?.paediatric_doctor),
        ...toNameList(schedule?.pediatrician_user),
        ...toNameList(schedule?.pediatrician_name),
        ...toNameList(schedule?.paediatrician_user),
        ...toNameList(schedule?.paediatrician_name),
        ...toNameList(schedule?.petitory),
        ...toNameList(schedule?.petitory_doctor),
        ...toNameList(caseData?.pediatrician),
        ...toNameList(caseData?.paediatrician),
        ...extractFromTeamArray(teamArray, [
            'pediatr',
            'paediatr',
            'peds',
            'child',
            'paeds',
            'pediatric',
            'petitory',
            'pediatrics',
            'paediatrics',
        ]),
    ])

    const assistantNames = uniq([
        ...toNameList(schedule?.assistant_doctor),
        ...toNameList(schedule?.assistant_doctors),
        ...toNameList(schedule?.assistants),
        ...toNameList(schedule?.asst_doctor),
        ...toNameList(caseData?.assistant_doctors),
        ...extractFromTeamArray(teamArray, ['assistant', 'asst', 'assist']),
    ])

    const statusChip = useMemo(() => {
        if (!caseData) return null
        const rawStatus = schedule?.status || (caseData.outcome ? 'closed' : 'open')
        const s = String(rawStatus).toLowerCase()
        const map = {
            planned: 'bg-slate-100 text-slate-700',
            in_progress: 'bg-sky-50 text-sky-700',
            completed: 'bg-emerald-50 text-emerald-700',
            cancelled: 'bg-rose-50 text-rose-700',
            open: 'bg-emerald-50 text-emerald-700',
            closed: 'bg-slate-100 text-slate-700',
        }
        return (
            <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[s] || 'bg-slate-100 text-slate-700'
                    }`}
            >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {String(rawStatus).toUpperCase()}
            </span>
        )
    }, [caseData, schedule])

    const handlePdfPreview = async () => {
        if (!caseId) return
        try {
            setPdfBusy(true)
            const res = await getOtCasePdfBlob(caseId)
            const blob = new Blob([res.data], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            setPdfUrl(url)
            setPdfOpen(true)
            toast.success('PDF ready')
        } catch (e) {
            console.error(e)
            toast.error('Failed to load PDF')
        } finally {
            setPdfBusy(false)
        }
    }

    const handlePdfDownload = async () => {
        if (!caseId) return
        try {
            setPdfBusy(true)
            const res = await getOtCasePdfBlob(caseId)
            const blob = new Blob([res.data], { type: 'application/pdf' })
            const fname = `OT_Case_${uhid || caseId}.pdf`
            downloadBlob(blob, fname)
            toast.success('PDF downloaded')
        } catch (e) {
            console.error(e)
            toast.error('Failed to download PDF')
        } finally {
            setPdfBusy(false)
        }
    }

    return (
        <div className="flex h-full flex-col gap-3 p-3 md:p-4">
            {/* HERO HEADER (Apple) */}
            <SoftCard className="overflow-hidden">
                <div className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-3 py-3 md:px-5 md:py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Left: Back + Title */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-sky-300 hover:text-sky-700"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="truncate text-base font-semibold text-slate-900 md:text-lg">
                                        OT Case
                                    </h1>
                                    {statusChip}
                                    {otRegNo ? (
                                        <Chip icon={Hash}>
                                            <span className="text-slate-500">OT Reg</span>
                                            <span className="font-semibold text-slate-900">#{otRegNo}</span>
                                        </Chip>
                                    ) : null}
                                </div>
                                <div className="mt-0.5 text-[12px] text-slate-500">
                                    All OT documentation, checklists and notes for this procedure.
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            {scheduleDate ? (
                                <Chip icon={CalendarDays}>
                                    <span className="text-slate-500">OT Date</span>
                                    <span className="font-semibold text-slate-900">{formatDate(scheduleDate)}</span>
                                </Chip>
                            ) : null}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="rounded-full" disabled={pdfBusy}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Case PDF
                                        {pdfBusy && (
                                            <span className="ml-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-b-transparent" />
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-2xl">
                                    <DropdownMenuItem onClick={handlePdfPreview}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Preview (NUTRYAH style)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handlePdfDownload}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* micro chips row */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {uhid ? (
                            <Chip icon={Hash}>
                                <span className="text-slate-500">UHID</span>
                                <span className="font-semibold text-slate-900">{uhid}</span>
                            </Chip>
                        ) : null}
                        {ipNo ? (
                            <Chip icon={ClipboardList}>
                                <span className="text-slate-500">IP</span>
                                <span className="font-semibold text-slate-900">{ipNo}</span>
                            </Chip>
                        ) : null}
                        {opNo ? (
                            <Chip icon={ClipboardList}>
                                <span className="text-slate-500">OP</span>
                                <span className="font-semibold text-slate-900">{opNo}</span>
                            </Chip>
                        ) : null}
                        {theatreLabel ? (
                            <Chip icon={Building2}>
                                <span className="text-slate-500">Theatre</span>
                                <span className="font-semibold text-slate-900">{theatreLabel}</span>
                            </Chip>
                        ) : null}
                    </div>
                </div>

                {/* Body: summary cards */}
                <div className="px-3 py-3 md:px-5 md:py-4">
                    {error ? (
                        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                            {error}
                        </div>
                    ) : null}

                    {/* Loading skeleton for header body */}
                    {loading && !caseData ? (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <SkeletonBlock h="h-28" />
                            <SkeletonBlock h="h-28" />
                            <SkeletonBlock h="h-28" />
                            <SkeletonBlock h="h-28" />
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            {/* Patient */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-2 flex items-center gap-3">
                                    <IconBadge variant="sky" icon={User} />
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                            Patient
                                        </div>
                                        <div className="truncate text-[14px] font-semibold text-slate-900">
                                            {patientName}
                                        </div>
                                        <div className="text-[12px] text-slate-500">{ageSex || '—'}</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <InfoRow label="UHID" value={uhid} />
                                    <InfoRow label="Age / Sex" value={ageSex} />
                                </div>
                            </div>

                            {/* Admission */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-2 flex items-center gap-3">
                                    <IconBadge variant="emerald" icon={BedDouble} />
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                            Admission / Visit
                                        </div>
                                        <div className="text-[12px] text-slate-500">IP / OP details</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <InfoRow label="IP No" value={ipNo} />
                                    <InfoRow label="OP No" value={opNo} />
                                    <InfoRow label="Admitted" value={admissionDate ? formatDate(admissionDate) : '—'} />
                                    <InfoRow label="Bed" value={bedLabel} right />
                                </div>
                            </div>

                            {/* Procedure */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-2 flex items-center gap-3">
                                    <IconBadge variant="indigo" icon={Stethoscope} />
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                            Procedure
                                        </div>
                                        <div className="line-clamp-2 text-[14px] font-semibold text-slate-900">
                                            {primaryProcedure}
                                        </div>
                                        {additionalProcedures ? (
                                            <div className="mt-1 line-clamp-2 text-[12px] text-slate-500">
                                                Additional: {additionalProcedures}
                                            </div>
                                        ) : (
                                            <div className="mt-1 text-[12px] text-slate-500">Additional: —</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Timings */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-2 flex items-center gap-3">
                                    <IconBadge variant="amber" icon={Clock3} />
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                            Timings
                                        </div>
                                        <div className="text-[12px] font-medium text-slate-900">
                                            {theatreLabel ? `Theatre: ${theatreLabel}` : 'Theatre: —'}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <InfoRow
                                        label="Planned"
                                        value={plannedStart || plannedEnd ? `${formatTime(plannedStart)} – ${formatTime(plannedEnd)}` : '—'}
                                        right
                                    />
                                    <InfoRow label="Actual Start" value={actualStart ? formatIST(actualStart) : '—'} right />
                                    <InfoRow label="Actual End" value={actualEnd ? formatIST(actualEnd) : '—'} right />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Team strip (Apple pill row, scrollable on mobile) */}
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                                    <Users className="h-4 w-4" />
                                </span>
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        OT Team
                                    </div>
                                    <div className="text-[12px] text-slate-500">Schedule assigned doctors</div>
                                </div>
                            </div>

                            <div className="text-[12px] text-slate-500">
                                {surgeonNames.length + anaesthesiaNames.length + pediatricNames.length + assistantNames.length === 0
                                    ? 'No team mapped'
                                    : ' '}
                            </div>
                        </div>

                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                            <TeamPill label="Surgeon" value={surgeonNames.length ? surgeonNames.join(', ') : '—'} />
                            <TeamPill label="Anaesthesia" value={anaesthesiaNames.length ? anaesthesiaNames.join(', ') : '—'} />
                            <TeamPill label="Pediatric" value={pediatricNames.length ? pediatricNames.join(', ') : '—'} />
                            <TeamPill label="Asst. Doctor" value={assistantNames.length ? assistantNames.join(', ') : '—'} />
                        </div>
                    </div>
                </div>
            </SoftCard>

            {/* Sticky Tabs (Apple segmented pills) */}
            <div className="sticky top-0 z-10">
                <div className="rounded-[22px] border border-slate-200 bg-white/75 backdrop-blur-xl shadow-[0_10px_25px_rgba(2,6,23,0.06)]">
                    <div className="flex gap-2 overflow-x-auto p-2">
                        {TABS.map((t) => {
                            const active = t.id === tab
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTab(t.id)}
                                    className={
                                        'shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold transition ' +
                                        (active
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200')
                                    }
                                >
                                    <span className="inline-flex items-center gap-2">
                                        {t.label}
                                        {active ? <ChevronRight className="h-4 w-4 opacity-70" /> : null}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto pb-4">
                {loading && !caseData ? (
                    <SoftCard className="p-4">
                        <SkeletonBlock h="h-12" />
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <SkeletonBlock h="h-40" />
                            <SkeletonBlock h="h-40" />
                        </div>
                    </SoftCard>
                ) : !loading && !caseData && !error ? (
                    <SoftCard className="p-5">
                        <div className="text-sm font-semibold text-slate-900">OT case not loaded</div>
                        <div className="mt-1 text-[12px] text-slate-500">Please refresh or check case id.</div>
                    </SoftCard>
                ) : caseData ? (
                    <div className="space-y-3">
                        {tab === 'preop' && <PreopTab caseId={caseId} />}
                        {tab === 'safety' && <SafetyTab caseId={caseId} />}
                        {tab === 'anaesthesia' && <AnaesthesiaTab caseId={caseId} />}
                        {/* {tab === 'nursing' && <NursingTab caseId={caseId} />} */}
                        {tab === 'counts' && <CountsTab caseId={caseId} />}
                        {/* {tab === 'blood' && <BloodTab caseId={caseId} />} */}
                        {tab === 'notes' && <OperationNotesTab caseId={caseId} />}
                        {tab === 'pacu' && <PacuTab caseId={caseId} />}
                    </div>
                ) : null}
            </div>

            {/* NUTRYAH-style PDF Preview Modal */}
            <Dialog
                open={pdfOpen}
                onOpenChange={(v) => {
                    setPdfOpen(v)
                    if (!v && pdfUrl) {
                        URL.revokeObjectURL(pdfUrl)
                        setPdfUrl(null)
                    }
                }}
            >
                <DialogContent className="max-w-5xl rounded-3xl p-0 overflow-hidden">
                    <DialogHeader className="border-b bg-white px-4 py-3">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-sm font-semibold">Case PDF Preview</DialogTitle>
                            <Button variant="ghost" className="rounded-full" onClick={() => setPdfOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="px-0 text-xs text-slate-500">
                            NUTRYAH-style PDF (clean typography + full checklist sections).
                        </div>
                    </DialogHeader>

                    <div className="bg-slate-50 p-3">
                        {pdfUrl ? (
                            <iframe
                                title="OT Case PDF Preview"
                                src={pdfUrl}
                                className="h-[78vh] w-full rounded-2xl border bg-white"
                            />
                        ) : (
                            <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
                                PDF not loaded.
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t bg-white px-4 py-3">
                        <Button variant="outline" className="rounded-full" onClick={handlePdfDownload}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </Button>
                        <Button className="rounded-full" onClick={() => setPdfOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function TeamPill({ label, value }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <span className="text-[11px] font-medium text-slate-900">{value || '—'}</span>
        </div>
    )
}
