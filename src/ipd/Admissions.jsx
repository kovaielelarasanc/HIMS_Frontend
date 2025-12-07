
// FILE: src/ipd/Admissions.jsx
import { useEffect, useMemo, useState, useRef } from 'react'
import PermGate from '../components/PermGate'
import {
    listAdmissions,
    createAdmission,
    listBeds,
    listPackages,
} from '../api/ipd'
import PatientPagedPicker from './components/PatientPagedPicker'
import WardRoomBedPicker from './components/WardRoomBedPicker'
import DeptRoleUserPicker from '../opd/components/DoctorPicker'
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    X,
    BedDouble,
    User,
    ClipboardList,
} from 'lucide-react'

export { } // quiet ts/eslint

// ---------- Small Toast component (fixed top) ----------
function Toast({ kind = 'success', title, message, onClose }) {
    const map = {
        success: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-700',
            Icon: CheckCircle2,
        },
        warn: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-800',
            Icon: AlertTriangle,
        },
        error: {
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            text: 'text-rose-700',
            Icon: XCircle,
        },
    }

    const S = map[kind] || map.success

    return (
        <div className={`flex w-full max-w-md items-start gap-3 rounded-xl border ${S.border} ${S.bg} p-3 shadow-lg`}>
            <S.Icon className={`mt-0.5 h-5 w-5 ${S.text}`} />
            <div className="text-sm">
                <div className="font-medium">{title}</div>
                {message ? (
                    <div className="mt-0.5 text-[13px] opacity-90">{message}</div>
                ) : null}
            </div>
            <button
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5"
                onClick={onClose}
                aria-label="Close"
                type="button"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}

// strict positive integer check (rejects 0, "", null, undefined, NaN)
const isPosInt = (v) => {
    if (typeof v === 'number') return Number.isInteger(v) && v > 0
    if (typeof v === 'string' && v.trim() !== '' && /^\d+$/.test(v))
        return Number(v) > 0
    return false
}

const toIsoSecs = (v) => (!v ? undefined : v.length === 16 ? `${v}:00` : v)

export default function Admissions() {
    // lookups
    const [beds, setBeds] = useState([])
    const [packages, setPackages] = useState([])
    const [loading, setLoading] = useState(false)

    // form state
    const [patientId, setPatientId] = useState(null)
    const [departmentId, setDepartmentId] = useState(null)
    const [doctorUserId, setDoctorUserId] = useState(null)
    const [bedId, setBedId] = useState(null)
    const [form, setForm] = useState({
        admission_type: 'planned',
        expected_discharge_at: '',
        package_id: '',
        payor_type: 'cash',
        insurer_name: '',
        policy_number: '',
        preliminary_diagnosis: '',
        history: '',
        care_plan: '',
    })

    // ui messages
    const [toast, setToast] = useState(null)
    const timerRef = useRef(null)

    const showToast = (t) => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setToast(t)
        timerRef.current = setTimeout(() => setToast(null), 4500)
    }

    const selectedBed = useMemo(
        () => beds.find((b) => b.id === Number(bedId)) || null,
        [beds, bedId]
    )

    // load lookups
    useEffect(() => {
        let alive = true
            ; (async () => {
                setLoading(true)
                try {
                    const [b, p] = await Promise.all([listBeds(), listPackages()])
                    if (!alive) return
                    setBeds(b.data || [])
                    setPackages(p.data || [])
                } catch (e) {
                    showToast({
                        kind: 'error',
                        title: 'Failed to load data',
                        message:
                            e?.response?.data?.detail ||
                            'Could not load beds / packages. Please refresh and try again.',
                    })
                } finally {
                    alive && setLoading(false)
                }
            })()
        return () => {
            alive = false
        }
    }, [])

    // duplicate guard
    const checkAlreadyAdmitted = async (pid) => {
        try {
            const { data } = await listAdmissions({
                status: 'admitted',
                patient_id: pid,
            })
            return Array.isArray(data) && data.length > 0 ? data[0] : null
        } catch {
            return null
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (loading) return

        if (!isPosInt(patientId)) {
            showToast({
                kind: 'warn',
                title: 'Select a patient',
                message: 'Pick a patient before admitting.',
            })
            return
        }
        if (!isPosInt(bedId)) {
            showToast({
                kind: 'warn',
                title: 'Select a bed',
                message: 'Choose Ward → Room → Bed.',
            })
            return
        }

        const bed = beds.find((b) => b.id === Number(bedId))
        if (!bed) {
            showToast({
                kind: 'warn',
                title: 'Selected bed is unavailable',
                message: 'Refresh beds and select again.',
            })
            return
        }

        setLoading(true)
        try {
            // prevent duplicate active admission
            const dup = await checkAlreadyAdmitted(Number(patientId))
            if (dup?.id) {
                const code = `ADM-${String(dup.id).padStart(6, '0')}`
                showToast({
                    kind: 'warn',
                    title: 'Patient already admitted',
                    message: `Active admission ${code} exists. Open Tracking / My Admissions to view.`,
                })
                return
            }

            const payload = {
                patient_id: Number(patientId),
                bed_id: Number(bedId),
                admission_type: form.admission_type || 'planned',
                expected_discharge_at: toIsoSecs(form.expected_discharge_at),
                department_id: isPosInt(departmentId)
                    ? Number(departmentId)
                    : undefined,
                practitioner_user_id: isPosInt(doctorUserId)
                    ? Number(doctorUserId)
                    : undefined,
                package_id: isPosInt(form.package_id)
                    ? Number(form.package_id)
                    : undefined,
                payor_type: form.payor_type || 'cash',
                insurer_name: form.insurer_name || '',
                policy_number: form.policy_number || '',
                preliminary_diagnosis: form.preliminary_diagnosis || '',
                history: form.history || '',
                care_plan: form.care_plan || '',
            }

            Object.keys(payload).forEach(
                (k) => payload[k] === undefined && delete payload[k]
            )

            const { data } = await createAdmission(payload)

            showToast({
                kind: 'success',
                title: 'Admission created',
                message: `Admission ADM-${String(data.id).padStart(6, '0')} has been created successfully.`,
            })

            // refresh beds to reflect occupancy
            try {
                const b = await listBeds()
                setBeds(b.data || [])
            } catch {
                /* ignore */
            }

            // clear relevant fields for next admission
            setBedId(null)
            setForm((s) => ({
                ...s,
                expected_discharge_at: '',
                preliminary_diagnosis: '',
                history: '',
                care_plan: '',
                package_id: '',
                payor_type: 'cash',
                insurer_name: '',
                policy_number: '',
            }))
        } catch (e1) {
            const raw = e1?.response?.data
            const detail = Array.isArray(raw?.detail)
                ? raw.detail
                    .map((d) => d?.msg)
                    .filter(Boolean)
                    .join(', ')
                : raw?.detail || e1.message || 'Failed to create admission'

            const msg = /Bed not found/i.test(detail)
                ? 'Please select a valid bed.'
                : /Bed not available/i.test(detail)
                    ? 'That bed is not available. Pick another one.'
                    : detail

            showToast({
                kind: 'error',
                title: 'Admission failed',
                message: msg,
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-6 text-black">
            {/* Global Toast – fixed at top */}
            {toast && (
                <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
                    <Toast
                        kind={toast.kind}
                        title={toast.title}
                        message={toast.message}
                        onClose={() => setToast(null)}
                    />
                </div>
            )}

            {/* Page header + description */}
            <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                        IPD Admission
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">
                        Use this screen to admit an in-patient. Select the patient, assign
                        a primary doctor and bed, and capture admission details and payer
                        information. The system will automatically prevent duplicate
                        active admissions for the same patient.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <User className="h-4 w-4 text-slate-500" />
                        <span className="leading-tight">
                            <span className="font-medium text-slate-800">Step 1</span>
                            <br />
                            Pick patient
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <ClipboardList className="h-4 w-4 text-slate-500" />
                        <span className="leading-tight">
                            <span className="font-medium text-slate-800">Step 2</span>
                            <br />
                            Doctor & details
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <BedDouble className="h-4 w-4 text-slate-500" />
                        <span className="leading-tight">
                            <span className="font-medium text-slate-800">Step 3</span>
                            <br />
                            Assign bed
                        </span>
                    </div>
                </div>
            </div>

            {/* Main card */}
            <div className="mx-auto max-w-6xl">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-semibold text-slate-900">
                                New Admission
                            </span>
                            <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                IPD · Admission Management
                            </span>
                        </div>
                    </div>

                    <PermGate
                        anyOf={['ipd.manage']}
                        fallback={
                            <div className="p-4 text-xs text-amber-700 bg-amber-50 border-t border-amber-200 rounded-b-2xl">
                                You do not have permission to create admissions. Please contact
                                the administrator to enable <span className="font-semibold">IPD Manage</span> access.
                            </div>
                        }
                    >
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-6 p-4 md:p-6 text-sm"
                        >
                            {/* Patient selection */}
                            <section className="space-y-2">

                                <PatientPagedPicker
                                    value={patientId ?? undefined}
                                    onChange={setPatientId}
                                />
                                {isPosInt(patientId) && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                        Tip: If this patient already has an active admission, you
                                        will see a warning and the system will block duplicate
                                        admission.
                                    </div>
                                )}
                            </section>

                            {/* Doctor + Department */}
                            <section className="space-y-2">


                                <DeptRoleUserPicker
                                    label="Primary doctor — Department · Role · User"
                                    value={doctorUserId ?? undefined}
                                    onChange={(userId, ctx) => {
                                        setDoctorUserId(userId || null)
                                        setDepartmentId(ctx?.department_id || null)
                                    }}
                                />
                            </section>

                            {/* Bed selection */}
                            <section className="space-y-2">


                                <WardRoomBedPicker
                                    value={bedId ?? ''}
                                    onChange={(v) =>
                                        setBedId(isPosInt(v) ? Number(v) : null)
                                    }
                                />

                                {selectedBed && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                        <span className="text-slate-500">Selected bed: </span>
                                        <span className="font-medium text-slate-900">
                                            {selectedBed.code}
                                        </span>
                                        <span className="mx-1 text-slate-400">•</span>
                                        <span className="text-slate-500">State: </span>
                                        <span
                                            className={[
                                                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px]',
                                                selectedBed.state === 'vacant'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : selectedBed.state === 'reserved'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                        : 'border-slate-200 bg-slate-100 text-slate-700',
                                            ].join(' ')}
                                        >
                                            {selectedBed.state}
                                        </span>
                                        {selectedBed.reserved_until && (
                                            <span className="ml-2 text-slate-500">
                                                until{' '}
                                                {new Date(
                                                    selectedBed.reserved_until
                                                ).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* Admission, package, payor + clinical details */}
                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        Admission details
                                    </h2>
                                    <p className="text-[11px] text-slate-500">
                                        Choose admission type, expected discharge and payer details.
                                    </p>
                                </div>

                                {(() => {
                                    const isInsurancePayor = ['insurance', 'tpa'].includes(form.payor_type)

                                    return (
                                        <div className="grid gap-3 md:grid-cols-4">
                                            {/* Admission type */}
                                            <div>
                                                <label className="mb-1 block text-xs text-slate-500">
                                                    Admission type
                                                </label>
                                                <select
                                                    className="input w-full rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                    value={form.admission_type}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            admission_type: e.target.value,
                                                        }))
                                                    }
                                                >
                                                    {['planned', 'emergency', 'daycare'].map((t) => (
                                                        <option key={t} value={t}>
                                                            {t}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Expected discharge */}
                                            <div>
                                                <label className="mb-1 block text-xs text-slate-500">
                                                    Expected discharge
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    className="input w-full rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                    value={form.expected_discharge_at}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            expected_discharge_at: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            {/* Package */}
                                            <div>
                                                <label className="mb-1 block text-xs text-slate-500">
                                                    Package
                                                </label>
                                                <select
                                                    className="input w-full rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                    value={form.package_id}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            package_id: e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <option value="">—</option>
                                                    {packages.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Payor type */}
                                            <div>
                                                <label className="mb-1 block text-xs text-slate-500">
                                                    Payor type
                                                </label>
                                                <select
                                                    className="input w-full rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                    value={form.payor_type}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
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

                                            {/* Insurance block – only when payor is insurance/TPA */}
                                            {isInsurancePayor && (
                                                <>
                                                    <input
                                                        className="input md:col-span-2 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                        placeholder="Insurer name"
                                                        value={form.insurer_name}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                insurer_name: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                    <input
                                                        className="input rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                        placeholder="Policy number"
                                                        value={form.policy_number}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                policy_number: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </>
                                            )}

                                            {/* Clinical details */}
                                            <input
                                                className="input md:col-span-2 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                placeholder="Preliminary diagnosis"
                                                value={form.preliminary_diagnosis}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        preliminary_diagnosis: e.target.value,
                                                    }))
                                                }
                                            />
                                            <input
                                                className="input rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                placeholder="History"
                                                value={form.history}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        history: e.target.value,
                                                    }))
                                                }
                                            />
                                            <input
                                                className="input md:col-span-3 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                                placeholder="Care plan"
                                                value={form.care_plan}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        care_plan: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    )
                                })()}
                            </section>


                            {/* Actions */}
                            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                                <p className="text-[11px] text-slate-500">
                                    Once admitted, you can manage vitals, nursing notes and
                                    discharge from the Admission Detail screen.
                                </p>
                                <button
                                    type="submit"
                                    className="btn sm:min-w-[140px]"
                                    disabled={
                                        loading ||
                                        !isPosInt(patientId) ||
                                        !isPosInt(bedId)
                                    }
                                >
                                    {loading ? 'Admitting…' : 'Admit patient'}
                                </button>
                            </div>
                        </form>
                    </PermGate>
                </div>
            </div>
        </div>
    )
}
