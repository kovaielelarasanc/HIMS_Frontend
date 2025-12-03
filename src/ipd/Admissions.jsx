import { useEffect, useMemo, useState, useRef } from 'react'
import PermGate from '../components/PermGate'
import {
    listAdmissions, createAdmission, listBeds, listPackages
} from '../api/ipd'
import PatientPagedPicker from './components/PatientPagedPicker'
import WardRoomBedPicker from './components/WardRoomBedPicker'
import DeptRoleUserPicker from '../opd/components/DoctorPicker'
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

export { } // quiet ts/eslint

function Toast({ kind = 'success', title, message, onClose }) {
    const map = {
        success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', Icon: CheckCircle2 },
        warn: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', Icon: AlertTriangle },
        error: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', Icon: XCircle },
    }
    const S = map[kind] || map.success
    return (
        <div className={`flex items-start gap-3 rounded-xl border ${S.border} ${S.bg} p-3`}>
            <S.Icon className={`h-5 w-5 mt-0.5 ${S.text}`} />
            <div className="text-sm">
                <div className="font-medium">{title}</div>
                {message ? <div className="text-[13px] opacity-90">{message}</div> : null}
            </div>
            <button
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5"
                onClick={onClose}
                aria-label="Close"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}

// strict positive integer check (rejects 0, "", null, undefined, NaN)
const isPosInt = (v) => {
    if (typeof v === 'number') return Number.isInteger(v) && v > 0
    if (typeof v === 'string' && v.trim() !== '' && /^\d+$/.test(v)) return Number(v) > 0
    return false
}

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

    const toIsoSecs = (v) => (!v ? undefined : (v.length === 16 ? `${v}:00` : v))
    const selectedBed = useMemo(
        () => beds.find(b => b.id === Number(bedId)) || null,
        [beds, bedId]
    )

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
                        title: 'Failed to load lookups',
                        message: e?.response?.data?.detail || 'Please refresh and try again.',
                    })
                } finally { alive && setLoading(false) }
            })()
        return () => { alive = false }
    }, [])

    // duplicate guard
    const checkAlreadyAdmitted = async (pid) => {
        try {
            const { data } = await listAdmissions({ status: 'admitted', patient_id: pid })
            return Array.isArray(data) && data.length > 0 ? data[0] : null
        } catch { return null }
    }

    const submit = async (e) => {
        e.preventDefault()
        if (loading) return

        // strict validation (don’t let 0 or empty strings pass)
        if (!isPosInt(patientId)) {
            showToast({ kind: 'warn', title: 'Select a patient', message: 'Pick a patient before admitting.' })
            return
        }
        if (!isPosInt(bedId)) {
            showToast({ kind: 'warn', title: 'Select a bed', message: 'Choose Ward → Room → Bed.' })
            return
        }

        // bed must exist in current list (avoid stale ID → “Bed not found”)
        const bed = beds.find(b => b.id === Number(bedId))
        if (!bed) {
            showToast({ kind: 'warn', title: 'Selected bed is unavailable', message: 'Refresh beds and select again.' })
            return
        }

        setLoading(true)
        try {
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
                department_id: isPosInt(departmentId) ? Number(departmentId) : undefined,
                practitioner_user_id: isPosInt(doctorUserId) ? Number(doctorUserId) : undefined,
                package_id: isPosInt(form.package_id) ? Number(form.package_id) : undefined,
                payor_type: form.payor_type || 'cash',
                insurer_name: form.insurer_name || '',
                policy_number: form.policy_number || '',
                preliminary_diagnosis: form.preliminary_diagnosis || '',
                history: form.history || '',
                care_plan: form.care_plan || '',
            }
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

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
            } catch { /* ignore */ }

            // clear selections for next admission
            setBedId(null)
            setForm(s => ({
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
                ? raw.detail.map(d => d?.msg).filter(Boolean).join(', ')
                : (raw?.detail || e1.message || 'Failed to create admission')

            // friendlier messages for common backend reasons
            const msg = /Bed not found/i.test(detail)
                ? 'Please select a valid bed.'
                : /Bed not available/i.test(detail)
                    ? 'That bed is not available. Pick another one.'
                    : detail

            showToast({ kind: 'error', title: 'Admission failed', message: msg })
        } finally { setLoading(false) }
    }

    return (
        <div className="p-4 space-y-4 text-black">
            {toast && (
                <Toast
                    kind={toast.kind}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="rounded-2xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3 font-semibold">New Admission</div>

                <PermGate
                    anyOf={['ipd.manage']}
                    fallback={<div className="p-4 text-xs text-gray-500">Creating admissions requires IPD Manage permission.</div>}
                >
                    <form onSubmit={submit} className="p-4 space-y-6 text-sm">
                        <div className="space-y-2">
                            <PatientPagedPicker value={patientId ?? undefined} onChange={setPatientId} />
                            {isPosInt(patientId) && (
                                <div className="rounded-xl border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                    Tip: We’ll auto-block if this patient already has an active admission.
                                </div>
                            )}
                        </div>

                        <DeptRoleUserPicker
                            label="Primary Doctor — Department · Role · User"
                            value={doctorUserId ?? undefined}
                            onChange={(userId, ctx) => {
                                setDoctorUserId(userId || null)
                                setDepartmentId(ctx?.department_id || null)
                            }}
                        />

                        <div className="space-y-2">
                            <WardRoomBedPicker
                                value={bedId ?? ''}
                                onChange={(v) => setBedId(isPosInt(v) ? Number(v) : null)}
                            />
                            {selectedBed && (
                                <div className="rounded-xl border bg-white px-3 py-2 text-xs text-gray-700">
                                    Selected bed: <span className="font-medium">{selectedBed.code}</span> • State:&nbsp;
                                    <span className={[
                                        'rounded-md px-1.5 py-0.5',
                                        selectedBed.state === 'vacant' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                            selectedBed.state === 'reserved' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                'bg-gray-100 text-gray-700 border'
                                    ].join(' ')}>
                                        {selectedBed.state}
                                    </span>
                                    {selectedBed.reserved_until && (
                                        <span className="ml-2 text-gray-500">until {new Date(selectedBed.reserved_until).toLocaleString()}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                            <div>
                                <label className="text-xs text-gray-500">Admission type</label>
                                <select
                                    className="input"
                                    value={form.admission_type}
                                    onChange={e => setForm({ ...form, admission_type: e.target.value })}
                                >
                                    {['planned', 'emergency', 'daycare'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Expected discharge</label>
                                <input
                                    type="datetime-local"
                                    className="input"
                                    value={form.expected_discharge_at}
                                    onChange={e => setForm({ ...form, expected_discharge_at: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Package</label>
                                <select
                                    className="input"
                                    value={form.package_id}
                                    onChange={e => setForm({ ...form, package_id: e.target.value })}
                                >
                                    <option value="">—</option>
                                    {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Payor type</label>
                                <select
                                    className="input"
                                    value={form.payor_type}
                                    onChange={e => setForm({ ...form, payor_type: e.target.value })}
                                >
                                    {['cash', 'insurance', 'tpa'].map(x => <option key={x} value={x}>{x}</option>)}
                                </select>
                            </div>
                            <input className="input md:col-span-2" placeholder="Insurer name"
                                value={form.insurer_name} onChange={e => setForm({ ...form, insurer_name: e.target.value })} />
                            <input className="input" placeholder="Policy number"
                                value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} />
                            <input className="input md:col-span-2" placeholder="Preliminary diagnosis"
                                value={form.preliminary_diagnosis} onChange={e => setForm({ ...form, preliminary_diagnosis: e.target.value })} />
                            <input className="input" placeholder="History"
                                value={form.history} onChange={e => setForm({ ...form, history: e.target.value })} />
                            <input className="input" placeholder="Care plan"
                                value={form.care_plan} onChange={e => setForm({ ...form, care_plan: e.target.value })} />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                className="btn"
                                disabled={loading || !isPosInt(patientId) || !isPosInt(bedId)}
                            >
                                {loading ? 'Admitting…' : 'Admit'}
                            </button>
                        </div>
                    </form>
                </PermGate>
            </div>
        </div>
    )
}
