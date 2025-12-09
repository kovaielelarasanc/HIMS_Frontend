// FILE: src/ipd/AdmissionDetail.jsx
import { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useCan } from '../hooks/useCan'
import {
    getAdmission,
    cancelAdmission,
    transferBed,
    listBeds,
    getPatient,
} from '../api/ipd'

// Common components
import WardRoomBedPicker from './components/WardRoomBedPicker'

// Quick Orders (NEW)
import QuickOrders from '../components/QuickOrders'

// Tabs (existing)
import Nursing from './tabs/Nursing'
import Vitals from './tabs/Vitals'
import IntakeOutput from './tabs/IntakeOutput'
import ShiftHandover from './tabs/ShiftHandover'
import DoctorRounds from './tabs/DoctorRounds'
import ProgressNotes from './tabs/ProgressNotes'
import Referrals from './tabs/Referrals'
import Discharge from './tabs/Discharge'
import OtModule from './tabs/Ot'
import BedCharges from './tabs/BedCharges'
import PharmacyOrdersTab from './tabs/PharmacyOrders'

// NEW TABS
import AssessmentsTab from './tabs/Assessments'
import OrdersTab from './tabs/Orders'
import MedicationsTab from './tabs/Medications'
import DressingTransfusionTab from './tabs/DressingTransfusion'
import DischargeMedsTab from './tabs/DischargeMeds'
import FeedbackTab from './tabs/Feedback'

import {
    Tabs as UITabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'

// ---------------------------------------------------------------------
// Small helper tab: Bed / Transfer
// ---------------------------------------------------------------------
function BedTransferTab({ admission, beds, canWrite, onTransfer }) {
    const currentBed =
        admission?.current_bed_id &&
        beds.find((b) => b.id === admission.current_bed_id)

    return (
        <div className="space-y-4 text-sm text-slate-900">
            <div className="flex flex-col gap-1 rounded-2xl border bg-gradient-to-r from-sky-50 via-slate-50 to-emerald-50 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                        Bed / Transfer
                    </h2>
                    <p className="text-[11px] text-slate-600">
                        View current bed and transfer the patient to another available bed
                        with proper tracking. This action affects IPD bed occupancy and
                        billing.
                    </p>
                </div>
                {currentBed ? (
                    <div className="text-[11px] text-slate-600">
                        Current bed:{' '}
                        <span className="font-semibold text-slate-900">
                            {currentBed.code}
                        </span>
                        {currentBed.ward_name && (
                            <span className="ml-1 text-slate-500">
                                ({currentBed.ward_name})
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="text-[11px] text-slate-500">
                        No active bed mapped for this admission.
                    </div>
                )}
            </div>

            <div className="rounded-2xl border bg-white p-3 shadow-sm md:p-4">
                <div className="mb-2 text-xs font-semibold text-slate-800">
                    Transfer to another bed
                </div>
                {!canWrite && (
                    <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                        You have view-only access. Contact an IPD incharge / Admin to
                        perform transfers.
                    </div>
                )}

                <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_1fr]">
                    <div>
                        <WardRoomBedPicker
                            value=""
                            onChange={(bedId) => {
                                if (!canWrite || !bedId) return
                                onTransfer(bedId)
                            }}
                        />
                    </div>
                    <div className="text-[11px] text-slate-500">
                        <ul className="list-disc space-y-1 pl-4">
                            <li>Only vacant beds can be selected for transfer.</li>
                            <li>
                                Bed transfer will automatically update bed occupancy and
                                subsequent bed charges.
                            </li>
                            <li>
                                Ensure the new bed type is clinically appropriate for the
                                patient&apos;s condition (ICU / HDU / Ward etc.).
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------
// Tabs config (includes Bed / Transfer)
// ---------------------------------------------------------------------
const TABS = [
    { key: 'nursing', label: 'Nursing Notes', el: Nursing, writePerm: 'ipd.nursing' },
    { key: 'vitals', label: 'Vitals', el: Vitals, writePerm: 'ipd.nursing' },
    { key: 'io', label: 'Intake/Output', el: IntakeOutput, writePerm: 'ipd.nursing' },
    { key: 'handover', label: 'Shift Handover', el: ShiftHandover, writePerm: 'ipd.nursing' },

    { key: 'rounds', label: 'Doctor Rounds', el: DoctorRounds, writePerm: 'ipd.doctor' },
    { key: 'progress', label: 'Progress Notes', el: ProgressNotes, writePerm: 'ipd.doctor' },

    // NEW CLINICAL CONTENT
    { key: 'assessments', label: 'Assessments', el: AssessmentsTab, writePerm: 'ipd.nursing' },
    { key: 'medications', label: 'Medications / Drug Chart', el: MedicationsTab, writePerm: 'ipd.doctor' },
    { key: 'dressing', label: 'Dressing / Transfusion', el: DressingTransfusionTab, writePerm: 'ipd.nursing' },
    { key: 'discharge-meds', label: 'Discharge Meds', el: DischargeMedsTab, writePerm: 'ipd.doctor' },

    // Bed / Transfer tab (new)
    { key: 'bed-transfer', label: 'Bed / Transfer', el: BedTransferTab, writePerm: 'ipd.manage' },

    { key: 'referrals', label: 'Referrals', el: Referrals, writePerm: 'ipd.manage' },
    // { key: 'ot', label: 'OT', el: OtModule, writePerm: 'ipd.manage' },
    { key: 'discharge', label: 'Discharge Summary', el: Discharge, writePerm: 'ipd.manage' },
    { key: 'charges', label: 'Bed Charges', el: BedCharges, writePerm: 'ipd.manage' },
    { key: 'feedback', label: 'Feedback', el: FeedbackTab, writePerm: 'ipd.manage' },
]

// ---------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------
export default function AdmissionDetail() {
    const { id } = useParams()
    const location = useLocation()
    const admissionFromList = location?.state?.admission || null

    const [admission, setAdmission] = useState(admissionFromList)
    const [beds, setBeds] = useState([])
    const [active, setActive] = useState('nursing')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [patient, setPatient] = useState(null)

    // global view perm
    const canView = useCan('ipd.view')
    const canManage = useCan('ipd.manage')
    const canNursingWrite = useCan('ipd.nursing')
    const canDoctorWrite = useCan('ipd.doctor')

    const permMap = {
        'ipd.nursing': canNursingWrite,
        'ipd.doctor': canDoctorWrite,
        'ipd.manage': canManage,
    }

    const admissionCode = (aid) => `ADM-${String(aid).padStart(6, '0')}`

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const [{ data: a }, bedsRes] = await Promise.all([
                getAdmission(Number(id)),
                listBeds(),
            ])
            const adm = a || admissionFromList || null
            setAdmission(adm)
            setBeds(bedsRes.data || [])

            if (adm?.patient_id) {
                try {
                    const { data: p } = await getPatient(adm.patient_id)
                    setPatient(p)
                } catch {
                    // ignore
                }
            }
        } catch (e) {
            const s = e?.status || e?.response?.status
            if (s === 404 && admissionFromList) {
                setAdmission(admissionFromList)
            } else {
                setError(e?.response?.data?.detail || 'Failed to load admission details')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const doCancel = async () => {
        if (!admission) return
        if (
            !window.confirm(
                'Are you sure you want to cancel this admission? This will mark the admission as cancelled.',
            )
        ) {
            return
        }
        try {
            await cancelAdmission(admission.id)
            window.location.assign('/ipd/tracking')
        } catch (e1) {
            setError(e1?.response?.data?.detail || 'Cancel failed')
        }
    }

    const doTransfer = async (newBedId) => {
        if (!admission || !newBedId) return
        try {
            await transferBed(admission.id, {
                to_bed_id: Number(newBedId),
                reason: 'Transfer',
            })
            await load()
        } catch (e1) {
            setError(e1?.response?.data?.detail || 'Transfer failed')
        }
    }

    if (!canView && !canManage) {
        return (
            <div className="p-4 text-sm text-rose-700">
                Access denied (need ipd.view).
            </div>
        )
    }

    if (loading && !admission) {
        return <div className="p-4 text-sm">Loading…</div>
    }

    if (!admission) {
        return <div className="p-4 text-sm">No data</div>
    }

    const currentBed =
        admission.current_bed_id &&
        beds.find((b) => b.id === admission.current_bed_id)

    // try common IP number fields; safe fallback null
    const ipNumber = admission.ip_number || admission.ipNo || null
    const bedLabel = currentBed?.code || null

    const Header = () => (
        <div className="grid gap-3 rounded-2xl border bg-white p-3 text-xs text-slate-800 md:grid-cols-4 md:p-4">
            <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Admission
                </div>
                <div className="font-semibold text-slate-900">
                    {admissionCode(admission.id)}
                </div>
                <div className="text-[11px] text-slate-500">
                    Admitted on:{' '}
                    {admission.admitted_at
                        ? new Date(admission.admitted_at).toLocaleString()
                        : '—'}
                </div>
            </div>

            <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Patient
                </div>
                <div className="font-semibold text-slate-900">
                    {patient?.full_name || patient?.name || '—'}
                </div>
                <div className="text-[11px] text-slate-500">
                    UHID:{' '}
                    <span className="font-medium">
                        {patient?.uhid || `P-${admission.patient_id}`}
                    </span>
                </div>
            </div>

            <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Bed / Ward
                </div>
                <div className="font-semibold text-slate-900">
                    {currentBed?.code || '—'}
                </div>
                {currentBed?.ward_name && (
                    <div className="text-[11px] text-slate-500">
                        Ward: {currentBed.ward_name}
                    </div>
                )}
            </div>

            <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Status
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium capitalize text-slate-800">
                    <span
                        className={
                            admission.status === 'active'
                                ? 'h-2 w-2 rounded-full bg-emerald-500'
                                : 'h-2 w-2 rounded-full bg-slate-400'
                        }
                    />
                    {admission.status || '—'}
                </div>
                {admission.practitioner_name && (
                    <div className="mt-1 text-[11px] text-slate-500">
                        Primary doctor:{' '}
                        <span className="font-medium">{admission.practitioner_name}</span>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className="space-y-4 p-3 md:p-4">
            {/* Top bar with title + actions */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-base font-semibold text-slate-900 md:text-lg">
                        IPD Admission · Patient Tracking
                    </h1>
                    <p className="text-xs text-slate-500 md:text-[13px]">
                        View and manage all in-patient clinical documentation for this
                        admission — nursing notes, vitals, drug chart, handovers, discharge
                        summary and more.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canManage && (
                        <button
                            type="button"
                            onClick={doCancel}
                            className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                        >
                            Cancel Admission
                        </button>
                    )}
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 md:text-sm">
                    {error}
                </div>
            )}

            {/* Header cards */}
            <Header />

            {/* 🔹 Quick Orders for this IPD admission */}
            <QuickOrders
                patient={patient}
                contextType="ipd"
                contextId={admission.id}
                ipNumber={ipNumber}
                bedLabel={bedLabel}
            // currentUser + defaultLocationId are optional; can be wired later
            />

            {/* Tabs */}
            <div className="rounded-2xl border bg-white shadow-sm">
                <UITabs
                    value={active}
                    onValueChange={setActive}
                    className="w-full"
                >
                    {/* Tab headers */}
                    <div className="border-b px-2 py-2 md:px-3">
                        <TabsList className="h-auto flex flex-wrap gap-1 bg-transparent p-0 md:gap-2">
                            {TABS.map((t) => {
                                const canWriteThis = permMap[t.writePerm] ?? false
                                return (
                                    <TabsTrigger
                                        key={t.key}
                                        value={t.key}
                                        className="rounded-full px-3 py-1 text-[11px] text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white md:text-xs"
                                    >
                                        {t.label}
                                        {!canWriteThis && (
                                            <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-[1px] text-[9px] uppercase tracking-wide text-slate-700">
                                                view
                                            </span>
                                        )}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>
                    </div>

                    {/* Tab content */}
                    <div className="p-2 md:p-3">
                        {TABS.map((t) => {
                            const TabEl = t.el
                            const canWriteThis = permMap[t.writePerm] ?? false
                            return (
                                <TabsContent
                                    key={t.key}
                                    value={t.key}
                                    className="mt-2"
                                >
                                    <TabEl
                                        admissionId={admission.id}
                                        admission={admission}
                                        patient={patient}
                                        canWrite={canWriteThis}
                                        beds={beds}           // used by BedTransferTab
                                        onTransfer={doTransfer} // used by BedTransferTab
                                    />
                                </TabsContent>
                            )
                        })}
                    </div>
                </UITabs>
            </div>
        </div>
    )
}
