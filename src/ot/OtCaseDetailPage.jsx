// FILE: frontend/src/ot/OtCaseDetailPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getOtCase } from '../api/ot'
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
    Building2,
} from 'lucide-react'
import OtLogsAdmin from './OtLogsAdmin'
import PreopTab from './tabs/PreopTab'
import SafetyTab from './tabs/SafetyTab'
import AnaesthesiaTab from './tabs/AnaesthesiaTab'
import OperationNotesTab from './tabs/OperationNotesTab'
import PacuTab from './tabs/PacuTab'
import NursingTab from './tabs/NursingTab'
import CountsTab from './tabs/CountsTab'
import BloodTab from './tabs/BloodTab'

const TABS = [
    { id: 'preop', label: 'Pre-op Checklist' },
    { id: 'safety', label: 'WHO Safety Checklist' },
    { id: 'anaesthesia', label: 'Anaesthesia' },
    { id: 'nursing', label: 'Nursing Notes' },
    { id: 'counts', label: 'Instrument & Sponge Counts' },
    { id: 'blood', label: 'Blood & Fluids' },
    { id: 'notes', label: 'Operation Notes' },
    { id: 'pacu', label: 'PACU / Recovery' },
    // { id: 'logs', label: 'Audit Log' },
]

// --------- small helpers for clean display ----------

function safeDate(value) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d
}

function formatDate(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function formatTime(value) {
    if (!value) return '—'

    // handle "HH:MM" or "HH:MM:SS" strings from backend
    if (typeof value === 'string') {
        const m = value.match(/^(\d{2}):(\d{2})/)
        if (m) return `${m[1]}:${m[2]}`
    }

    const d = safeDate(value)
    if (!d) return '—'
    return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatDateTime(value) {
    const d = safeDate(value)
    if (!d) return '—'
    return `${formatDate(value)} · ${formatTime(value)}`
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
            const m = now.getMonth() - dob.getMonth()
            if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
                years--
            }
            agePart = `${years}y`
        }
    }

    if (agePart && sex) return `${agePart} / ${sex}`
    if (agePart) return agePart
    if (sex) return sex
    return null
}

export default function OtCaseDetailPage() {
    const { caseId } = useParams()
    const navigate = useNavigate()

    const canView = useCan('ot.cases.view')

    const [tab, setTab] = useState('preop')
    const [caseData, setCaseData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

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
            if (status === 404) {
                setError(
                    'OT case not found. It may have been deleted or the reference is invalid.'
                )
            } else if (status === 403) {
                setError('You do not have permission to view this OT case.')
            } else {
                setError('Failed to load OT case. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCase()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId, canView])

    const schedule = caseData?.schedule
    const patient = schedule?.patient

    // 🔹 NEW: IP admission + OT bed + ward bed
    const admission = schedule?.admission || null
    const otBed = schedule?.bed || null // OT location bed
    const wardBed = admission?.current_bed || null // IPD ward bed
    const bed = otBed || wardBed

    const patientName = buildPatientName(patient)
    const ageSex = buildAgeSex(patient)

    // 🔹 OT Reg No – only show if we actually have something
    const otRegNo =
        schedule?.reg_no ||
        schedule?.display_number ||
        schedule?.ot_number ||
        schedule?.schedule_code ||
        null

    const uhid =
        patient?.uhid ||
        patient?.uhid_number ||
        schedule?.patient_uhid ||
        null

    // 🔹 IP No from admission.display_code / admission_code
    const ipNo =
        admission?.display_code ||
        admission?.admission_code ||
        null

    // 🔹 latest OP number from backend schedule.op_no
    const opNo = schedule?.op_no || null

    const admissionDate =
        admission?.admitted_at ||
        admission?.admission_date ||
        null

    // 🔹 Bed label: Ward · Room · Bed
    const bedLabel = bed
        ? joinNonEmpty(
            bed.ward_name,
            bed.room_name,
            bed.code
        )
        : null

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

    const plannedStart =
        schedule?.planned_start_time ||
        schedule?.planned_start ||
        null
    const plannedEnd =
        schedule?.planned_end_time ||
        schedule?.planned_end ||
        null

    const actualStart = caseData?.actual_start_time
    const actualEnd = caseData?.actual_end_time

    const scheduleDate =
        schedule?.date ||
        plannedStart ||
        plannedEnd ||
        null

    const statusChip = useMemo(() => {
        if (!caseData) return null

        const rawStatus =
            schedule?.status ||
            (caseData.outcome ? 'closed' : 'open')

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
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${map[s] || 'bg-slate-100 text-slate-700'
                    }`}
            >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {String(rawStatus).toUpperCase()}
            </span>
        )
    }, [caseData, schedule])

    if (!canView) {
        return (
            <div className="p-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    You do not have permission to view OT cases.
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col gap-3 p-4">
            {/* Top header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-sky-400 hover:text-sky-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                            <h1 className="text-base font-semibold text-slate-900">
                                OT Case
                            </h1>
                            {statusChip}
                            {otRegNo && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                    <Hash className="mr-1 h-3 w-3" />
                                    OT Reg No: {otRegNo}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">
                            All OT documentation, checklists and notes for this
                            procedure are linked to this case as per NABH OT
                            standards.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-right">
                    {scheduleDate && (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-50">
                            <CalendarDays className="h-3.5 w-3.5" />
                            OT Date: {formatDate(scheduleDate)}
                        </div>
                    )}
                    {/* we no longer use theatre master; hide for now */}
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                    {error}
                </div>
            )}

            {/* Summary strip */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {/* Patient & identifiers */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-xs shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                            <User className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Patient
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                                {patientName}
                            </div>
                        </div>
                    </div>

                    <dl className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <Hash className="h-3.5 w-3.5" />
                                <span>UHID</span>
                            </dt>
                            <dd className="text-[11px] font-medium text-slate-900">
                                {uhid || '—'}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <HeartPulse className="h-3.5 w-3.5" />
                                <span>Age / Sex</span>
                            </dt>
                            <dd className="text-[11px] text-slate-900">
                                {ageSex || '—'}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Admission / OP & bed */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-xs shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                            <BedDouble className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Admission / Visit
                            </div>
                            <div className="text-[11px] text-slate-500">
                                IP or OP details (if available)
                            </div>
                        </div>
                    </div>

                    <dl className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <ClipboardList className="h-3.5 w-3.5" />
                                <span>IP No</span>
                            </dt>
                            <dd className="text-[11px] font-medium text-slate-900">
                                {ipNo || '—'}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <ClipboardList className="h-3.5 w-3.5" />
                                <span>OP No</span>
                            </dt>
                            <dd className="text-[11px] font-medium text-slate-900">
                                {opNo || '—'}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <CalendarDays className="h-3.5 w-3.5" />
                                <span>Date of Admission</span>
                            </dt>
                            <dd className="text-[11px] text-slate-900">
                                {admissionDate
                                    ? formatDate(admissionDate)
                                    : '—'}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <BedDouble className="h-3.5 w-3.5" />
                                <span>Bed Details</span>
                            </dt>
                            <dd className="text-[11px] text-right text-slate-900">
                                {bedLabel || '—'}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Procedure & team */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-xs shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                            <Stethoscope className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Procedure & Team
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                                {primaryProcedure}
                            </div>
                        </div>
                    </div>

                    {additionalProcedures && (
                        <div className="mb-1 text-[11px] text-slate-500">
                            Additional: {additionalProcedures}
                        </div>
                    )}

                    <dl className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <Stethoscope className="h-3.5 w-3.5" />
                                <span>Surgeon</span>
                            </dt>
                            <dd className="text-[11px] text-right text-slate-900">
                                Dr. {schedule?.surgeon?.full_name ||
                                    schedule?.surgeon?.name ||
                                    schedule?.surgeon_name ||
                                    (schedule?.surgeon_user_id
                                        ? `Doctor #${schedule.surgeon_user_id}`
                                        : '—')}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <HeartPulse className="h-3.5 w-3.5" />
                                <span>Anaesthetist</span>
                            </dt>
                            <dd className="text-[11px] text-right text-slate-900">
                                Dr. {schedule?.anaesthetist?.full_name ||
                                    schedule?.anaesthetist?.name ||
                                    schedule?.anaesthetist_name ||
                                    (schedule?.anaesthetist_user_id
                                        ? `Doctor #${schedule.anaesthetist_user_id}`
                                        : '—')}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Theatre & timings */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-xs shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                            <Clock3 className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Theatre & Timings
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                                {/* we do not have OT theatre master now */}
                                {bedLabel || '—'}
                            </div>
                        </div>
                    </div>

                    <dl className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <Clock3 className="h-3.5 w-3.5" />
                                <span>Planned</span>
                            </dt>
                            <dd className="text-[11px] text-right text-slate-900">
                                {plannedStart || plannedEnd ? (
                                    <>
                                        {scheduleDate && (
                                            <span className="block">
                                                {formatDate(scheduleDate)}
                                            </span>
                                        )}
                                        <span>
                                            {plannedStart
                                                ? formatTime(plannedStart)
                                                : '—'}{' '}
                                            –{' '}
                                            {plannedEnd
                                                ? formatTime(plannedEnd)
                                                : '—'}
                                        </span>
                                    </>
                                ) : (
                                    '—'
                                )}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <Clock3 className="h-3.5 w-3.5" />
                                <span>Actual Start</span>
                            </dt>
                            <dd className="text-[11px] text-right text-slate-900">
                                {actualStart
                                    ? formatDateTime(actualStart)
                                    : '—'}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-slate-500">
                                <Clock3 className="h-3.5 w-3.5" />
                                <span>Actual End</span>
                            </dt>
                            <dd className="text-[11px] text-right text-slate-900">
                                {actualEnd
                                    ? formatDateTime(actualEnd)
                                    : '—'}
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-1 flex gap-2 border-b border-slate-200 pt-1">
                {TABS.map((t) => {
                    const active = t.id === tab
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${active
                                    ? 'text-sky-700'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            {t.label}
                            {active && (
                                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sky-600" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto pt-2 pb-4">
                {loading && !caseData && (
                    <div className="rounded-2xl border bg-white px-4 py-4 text-xs text-slate-500">
                        Loading OT case...
                    </div>
                )}

                {!loading && !caseData && !error && (
                    <div className="rounded-2xl border bg-white px-4 py-4 text-xs text-slate-500">
                        OT case not loaded.
                    </div>
                )}

                {caseData && (
                    <div className="space-y-3">
                        {tab === 'preop' && <PreopTab caseId={caseId} />}
                        {tab === 'safety' && <SafetyTab caseId={caseId} />}
                        {tab === 'anaesthesia' && (
                            <AnaesthesiaTab caseId={caseId} />
                        )}
                        {tab === 'nursing' && (
                            <NursingTab caseId={caseId} />
                        )}
                        {tab === 'counts' && <CountsTab caseId={caseId} />}
                        {tab === 'blood' && <BloodTab caseId={caseId} />}
                        {tab === 'notes' && (
                            <OperationNotesTab caseId={caseId} />
                        )}
                        {tab === 'pacu' && <PacuTab caseId={caseId} />}
                        {/* {tab === 'logs' && <OtLogsAdmin caseId={caseId} />} */}
                    </div>
                )}
            </div>
        </div>
    )
}
