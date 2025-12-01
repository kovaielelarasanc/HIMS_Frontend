// FILE: src/ipd/AdmissionDetail.jsx
import { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useCan } from '../hooks/usePerm'
import {
    getAdmission,
    updateAdmission,
    cancelAdmission,
    transferBed,
    listBeds,
    getPatient,
} from '../api/ipd'
import WardRoomBedPicker from './components/WardRoomBedPicker'
import DeptRoleUserPicker from '../opd/components/DeptRoleUserPicker'

// tabs (do NOT gate these with PermGate anymore)
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

import {
    Tabs as UITabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'

const TABS = [
    { key: 'nursing', label: 'Nursing Notes', el: Nursing, writePerm: 'ipd.nursing' },
    { key: 'vitals', label: 'Vitals', el: Vitals, writePerm: 'ipd.nursing' },
    { key: 'io', label: 'Intake/Output', el: IntakeOutput, writePerm: 'ipd.nursing' },
    { key: 'handover', label: 'Shift Handover', el: ShiftHandover, writePerm: 'ipd.nursing' },
    { key: 'rounds', label: 'Doctor Rounds', el: DoctorRounds, writePerm: 'ipd.doctor' },
    { key: 'progress', label: 'Progress Notes', el: ProgressNotes, writePerm: 'ipd.doctor' },
    { key: 'pharmacy', label: 'Pharmacy Orders', el: PharmacyOrdersTab, writePerm: 'ipd.doctor' },
    { key: 'referrals', label: 'Referrals', el: Referrals, writePerm: 'ipd.manage' },
    { key: 'ot', label: 'OT', el: OtModule, writePerm: 'ipd.manage' },
    { key: 'discharge', label: 'Discharge', el: Discharge, writePerm: 'ipd.manage' },
    { key: 'charges', label: 'Bed Charges', el: BedCharges, writePerm: 'ipd.manage' },
]

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

    // global view perm (backend needs ipd.view to list anything)
    const canView = useCan('ipd.view')
    const canManage = useCan('ipd.manage')

    // per-module write perms (used in tabs, but *top-level* hooks only)
    const canNursingWrite = useCan('ipd.nursing')
    const canDoctorWrite = useCan('ipd.doctor')

    const permMap = {
        'ipd.nursing': canNursingWrite,
        'ipd.doctor': canDoctorWrite,
        'ipd.manage': canManage,
    }

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const [{ data: a }, b] = await Promise.all([
                getAdmission(Number(id)),
                listBeds(),
            ])
            setAdmission(a || admissionFromList || null)
            setBeds(b.data || [])
            try {
                const { data: p } = await getPatient(a.patient_id)
                setPatient(p)
            } catch {
                /* no-op */
            }
        } catch (e) {
            const s = e?.status || e?.response?.status
            if (s === 404 && admissionFromList) {
                setAdmission(admissionFromList)
            } else {
                setError(e?.response?.data?.detail || 'Failed to load')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const admissionCode = (aid) => `ADM-${String(aid).padStart(6, '0')}`

    const [edit, setEdit] = useState({
        practitioner_user_id: '',
        department_id: '',
        expected_discharge_at: '',
        package_id: '',
        payor_type: '',
        insurer_name: '',
        policy_number: '',
        preliminary_diagnosis: '',
        history: '',
        care_plan: '',
    })

    useEffect(() => {
        if (!admission) return
        setEdit({
            practitioner_user_id: admission.practitioner_user_id || '',
            department_id: admission.department_id || '',
            expected_discharge_at: admission.expected_discharge_at
                ? new Date(admission.expected_discharge_at).toISOString().slice(0, 16)
                : '',
            package_id: admission.package_id || '',
            payor_type: admission.payor_type || 'cash',
            insurer_name: admission.insurer_name || '',
            policy_number: admission.policy_number || '',
            preliminary_diagnosis: admission.preliminary_diagnosis || '',
            history: admission.history || '',
            care_plan: admission.care_plan || '',
        })
    }, [admission])

    const toIsoSecs = (v) =>
        !v ? undefined : v.length === 16 ? `${v}:00` : v

    const saveEdit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                practitioner_user_id: edit.practitioner_user_id
                    ? Number(edit.practitioner_user_id)
                    : undefined,
                department_id: edit.department_id
                    ? Number(edit.department_id)
                    : undefined,
                expected_discharge_at: toIsoSecs(edit.expected_discharge_at),
                package_id: edit.package_id ? Number(edit.package_id) : undefined,
                payor_type: edit.payor_type || 'cash',
                insurer_name: edit.insurer_name || '',
                policy_number: edit.policy_number || '',
                preliminary_diagnosis: edit.preliminary_diagnosis || '',
                history: edit.history || '',
                care_plan: edit.care_plan || '',
            }
            Object.keys(payload).forEach(
                (k) => payload[k] === undefined && delete payload[k]
            )
            await updateAdmission(admission.id, payload)
            await load()
        } catch (e1) {
            setError(e1?.response?.data?.detail || 'Update failed')
        }
    }

    const doCancel = async () => {
        if (!window.confirm('Cancel this admission?')) return
        try {
            await cancelAdmission(admission.id)
            window.location.assign('/ipd/tracking')
        } catch (e1) {
            setError(e1?.response?.data?.detail || 'Cancel failed')
        }
    }

    const doTransfer = async (newBedId) => {
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

    const Header = () => (
        <div className="rounded-xl border bg-white p-3 text-sm grid md:grid-cols-4 gap-2">
            <div>
                <span className="text-gray-500">Admission:</span>{' '}
                {admissionCode(admission.id)}
            </div>
            <div>
                <span className="text-gray-500">Patient:</span>{' '}
                {patient?.uhid || `P-${admission.patient_id}`}
            </div>
            <div>
                <span className="text-gray-500">Bed:</span>{' '}
                {admission.current_bed_id
                    ? beds.find((b) => b.id === admission.current_bed_id)?.code ||
                    '—'
                    : '—'}
            </div>
            <div>
                <span className="text-gray-500">Status:</span>{' '}
                {admission.status}
            </div>
        </div>
    )

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Patient Tracking</h1>
            </div>

            <Header />

            {/* Update/Transfer panel is still gated by ipd.manage */}
            {canManage && (
                <div className="rounded-xl border bg-white p-3 text-sm grid md:grid-cols-2 gap-4">
                    <form onSubmit={saveEdit} className="space-y-3">
                        <div className="text-sm font-medium">Update Admission</div>

                        <DeptRoleUserPicker
                            value={edit.practitioner_user_id || ''}
                            onChange={(userId, ctx) => {
                                setEdit((s) => ({
                                    ...s,
                                    practitioner_user_id: userId || '',
                                    department_id:
                                        ctx?.department_id || s.department_id,
                                }))
                            }}
                            label="Primary Doctor — Department · Role · User"
                        />

                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="text-xs text-gray-500">
                                    Expected discharge
                                </label>
                                <input
                                    type="datetime-local"
                                    className="input"
                                    value={edit.expected_discharge_at}
                                    onChange={(e) =>
                                        setEdit((s) => ({
                                            ...s,
                                            expected_discharge_at: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">
                                    Payor type
                                </label>
                                <select
                                    className="input"
                                    value={edit.payor_type}
                                    onChange={(e) =>
                                        setEdit((s) => ({
                                            ...s,
                                            payor_type: e.target.value,
                                        }))
                                    }
                                >
                                    {['cash', 'insurance', 'tpa'].map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <input
                                className="input"
                                placeholder="Insurer name"
                                value={edit.insurer_name}
                                onChange={(e) =>
                                    setEdit((s) => ({
                                        ...s,
                                        insurer_name: e.target.value,
                                    }))
                                }
                            />
                            <input
                                className="input"
                                placeholder="Policy number"
                                value={edit.policy_number}
                                onChange={(e) =>
                                    setEdit((s) => ({
                                        ...s,
                                        policy_number: e.target.value,
                                    }))
                                }
                            />
                            <input
                                className="input md:col-span-2"
                                placeholder="Preliminary diagnosis"
                                value={edit.preliminary_diagnosis}
                                onChange={(e) =>
                                    setEdit((s) => ({
                                        ...s,
                                        preliminary_diagnosis: e.target.value,
                                    }))
                                }
                            />
                            <input
                                className="input"
                                placeholder="History"
                                value={edit.history}
                                onChange={(e) =>
                                    setEdit((s) => ({
                                        ...s,
                                        history: e.target.value,
                                    }))
                                }
                            />
                            <input
                                className="input"
                                placeholder="Care plan"
                                value={edit.care_plan}
                                onChange={(e) =>
                                    setEdit((s) => ({
                                        ...s,
                                        care_plan: e.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="btn">Save</button>
                            <button
                                type="button"
                                className="btn bg-rose-600 hover:bg-rose-700"
                                onClick={doCancel}
                            >
                                Cancel Admission
                            </button>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 text-sm">
                                {error}
                            </div>
                        )}
                    </form>

                    <div className="space-y-2">
                        <div className="text-sm font-medium">Transfer Bed</div>
                        <WardRoomBedPicker value={''} onChange={doTransfer} />
                        <div className="text-xs text-gray-500">
                            Pick a target bed (vacant) to transfer.
                        </div>
                    </div>
                </div>
            )}

            {/* IPD TABS – shadcn Tabs so click always shows correct pane */}
            <div className="rounded-xl border bg-white">
                <UITabs
                    value={active}
                    onValueChange={setActive}
                    className="w-full"
                >
                    <div className="border-b px-3 py-2 flex flex-wrap gap-2">
                        <TabsList className="h-auto bg-transparent flex flex-wrap gap-2 p-0">
                            {TABS.map((t) => {
                                const canWriteThis = permMap[t.writePerm] ?? false
                                return (
                                    <TabsTrigger
                                        key={t.key}
                                        value={t.key}
                                        className="px-3 py-1 rounded-lg text-xs sm:text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    >
                                        {t.label}
                                        {!canWriteThis && (
                                            <span className="ml-2 text-[10px] rounded bg-slate-200 px-1.5 py-0.5 text-slate-700 align-middle">
                                                view-only
                                            </span>
                                        )}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>
                    </div>

                    <div className="p-3">
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
