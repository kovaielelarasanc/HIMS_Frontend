// FILE: src/ipd/Admissions.jsx
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import PermGate from '../components/PermGate'
import { listAdmissions, createAdmission, listBeds, listPackages } from '../api/ipd'
import { getPatientById } from '../api/patients'

import PatientPagedPicker from './components/PatientPagedPicker'
import WardRoomBedPicker from './components/WardRoomBedPicker'
import DeptRoleUserPicker from '../opd/components/DoctorPicker'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

import {
    Activity,
    AlertTriangle,
    BedDouble,
    CheckCircle2,
    ClipboardList,
    Clock,
    RefreshCcw,
    ShieldCheck,
    Stethoscope,
    User,
    X,
    XCircle,
    Phone,
    IdCard,
} from 'lucide-react'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import { motion } from 'framer-motion'

// ---------- helpers ----------
function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

const UI = {
    page: 'min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50',
    glass:
        'rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
    input:
        'h-11 w-full rounded-2xl border border-black/10 bg-white/90 px-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500',
}

function prettyTime(d) {
    if (!d) return ''
    try {
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
        return ''
    }
}

// strict positive integer check (rejects 0, "", null, undefined, NaN)
const isPosInt = (v) => {
    if (typeof v === 'number') return Number.isInteger(v) && v > 0
    if (typeof v === 'string' && v.trim() !== '' && /^\d+$/.test(v)) return Number(v) > 0
    return false
}

export function toIsoSecs(v) {
    if (!v) return undefined
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return undefined
    return d.toISOString()
}

// ---------- Small Toast (top) ----------
function Toast({ kind = 'success', title, message, onClose }) {
    const map = {
        success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', Icon: CheckCircle2 },
        warn: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', Icon: AlertTriangle },
        error: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', Icon: XCircle },
    }
    const S = map[kind] || map.success

    return (
        <div
            className={cx(
                'flex w-full max-w-md items-start gap-3 rounded-2xl border p-3 shadow-[0_18px_40px_rgba(2,6,23,0.16)]',
                'bg-white/85 backdrop-blur-xl',
                S.border,
            )}
        >
            <div className={cx('mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10', S.bg)}>
                <S.Icon className={cx('h-5 w-5', S.text)} />
            </div>

            <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-900">{title}</div>
                {message ? <div className="mt-0.5 text-[12px] text-slate-600">{message}</div> : null}
            </div>

            <button
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-white/70 hover:bg-black/[0.04]"
                onClick={onClose}
                aria-label="Close"
                type="button"
            >
                <X className="h-4 w-4 text-slate-700" />
            </button>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, tone = 'slate' }) {
    const toneCls =
        tone === 'dark'
            ? 'bg-slate-900 text-white border-slate-900'
            : tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : tone === 'amber'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : tone === 'sky'
                        ? 'bg-sky-50 text-sky-900 border-sky-200'
                        : 'bg-white/85 text-slate-900 border-black/10'

    return (
        <div className={cx('rounded-3xl border px-4 py-3')}>
            <div className={cx('rounded-2xl border p-4', toneCls)}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</div>
                        <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">{value}</div>
                    </div>
                    {Icon ? (
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white/40">
                            <Icon className="h-5 w-5 opacity-85" />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function InfoPill({ icon: Icon, title, value, tone = 'slate', onClick, active }) {
    const toneCls =
        tone === 'sky'
            ? 'border-sky-200 bg-sky-50 text-sky-900'
            : tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : tone === 'amber'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : tone === 'dark'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-black/10 bg-white/80 text-slate-900'

    const base =
        'w-full rounded-2xl border px-3 py-2.5 text-left transition shadow-[0_10px_25px_rgba(2,6,23,0.06)]'

    const inner = (
        <div className="flex items-center gap-2">
            <span className={cx('inline-flex h-9 w-9 items-center justify-center rounded-2xl border', active ? 'border-white/20 bg-white/10' : 'border-black/10 bg-white/40')}>
                <Icon className={cx('h-4.5 w-4.5', active && 'opacity-95')} />
            </span>
            <div className="min-w-0">
                <div className={cx('text-[11px] font-semibold uppercase tracking-[0.16em]', active ? 'opacity-85' : 'text-slate-600')}>
                    {title}
                </div>
                <div className={cx('mt-0.5 text-[12px] font-semibold')}>
                    {value}
                </div>
            </div>
        </div>
    )

    if (onClick) {
        return (
            <button type="button" className={cx(base, toneCls, active && 'ring-2 ring-sky-100')} onClick={onClick}>
                {inner}
            </button>
        )
    }

    return <div className={cx(base, toneCls)}>{inner}</div>
}

/* ========= Selected patient helpers (for Step 1 summary) ========= */
function pickPatientName(p) {
    return (
        p?.full_name ||
        p?.name ||
        p?.patient_name ||
        [p?.first_name, p?.last_name].filter(Boolean).join(' ') ||
        (p?.id ? `Patient #${p.id}` : 'Patient')
    )
}
function pickPatientMeta(p) {
    const uhid = p?.uhid || p?.mrn || p?.patient_code || p?.code || p?.registration_no
    const phone = p?.phone || p?.mobile || p?.phone_number
    const gender = p?.gender || p?.sex
    const age = p?.age || p?.age_years
    return { uhid, phone, gender, age }
}

export default function Admissions() {
    // lookups
    const [beds, setBeds] = useState([])
    const [packages, setPackages] = useState([])
    const [loading, setLoading] = useState(false)
    const [lastSyncAt, setLastSyncAt] = useState(null)

    // realtime feel
    const [autoRefreshBeds, setAutoRefreshBeds] = useState(false)

    // form state
    const [patientId, setPatientId] = useState(null)
    const [selectedPatient, setSelectedPatient] = useState(null)

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

    // keep selected patient summary even if picker list changes
    useEffect(() => {
        const pid = isPosInt(patientId) ? Number(patientId) : null
        if (!pid) {
            setSelectedPatient(null)
            return
        }
        if (selectedPatient?.id === pid) return

            ; (async () => {
                try {
                    const res = await getPatientById(pid)
                    if (res?.data) setSelectedPatient(res.data)
                } catch {
                    /* ignore */
                }
            })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId])

    const selectedBed = useMemo(() => beds.find((b) => b.id === Number(bedId)) || null, [beds, bedId])

    const bedStats = useMemo(() => {
        const total = beds.length
        const vacant = beds.filter((b) => b.state === 'vacant').length
        const reserved = beds.filter((b) => b.state === 'reserved').length
        const occupied = beds.filter((b) => b.state === 'occupied').length
        return { total, vacant, reserved, occupied }
    }, [beds])

    const refreshLookups = useCallback(async (opts = { bedsOnly: false }) => {
        try {
            setLoading(true)
            if (opts?.bedsOnly) {
                const b = await listBeds()
                setBeds(b.data || [])
            } else {
                const [b, p] = await Promise.all([listBeds(), listPackages()])
                setBeds(b.data || [])
                setPackages(p.data || [])
            }
            setLastSyncAt(new Date())
        } catch (e) {
            showToast({
                kind: 'error',
                title: 'Failed to load data',
                message: e?.response?.data?.detail || 'Could not load beds / packages. Please refresh and try again.',
            })
        } finally {
            setLoading(false)
        }
    }, [])

    // initial load
    useEffect(() => {
        let alive = true
            ; (async () => {
                if (!alive) return
                await refreshLookups({ bedsOnly: false })
            })()
        return () => {
            alive = false
        }
    }, [refreshLookups])

    // auto refresh beds (polling)
    useEffect(() => {
        if (!autoRefreshBeds) return
        const t = setInterval(() => refreshLookups({ bedsOnly: true }), 15000)
        return () => clearInterval(t)
    }, [autoRefreshBeds, refreshLookups])

    // duplicate guard
    const checkAlreadyAdmitted = async (pid) => {
        try {
            const { data } = await listAdmissions({ status: 'admitted', patient_id: pid })
            return Array.isArray(data) && data.length > 0 ? data[0] : null
        } catch {
            return null
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (loading) return

        if (!isPosInt(patientId)) {
            showToast({ kind: 'warn', title: 'Select a patient', message: 'Pick a patient before admitting.' })
            return
        }
        if (!isPosInt(bedId)) {
            showToast({ kind: 'warn', title: 'Select a bed', message: 'Choose Ward → Room → Bed.' })
            return
        }

        const bed = beds.find((b) => b.id === Number(bedId))
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
                admitted_at: new Date().toISOString(),
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
            Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])

            const { data } = await createAdmission(payload)

            showToast({
                kind: 'success',
                title: 'Admission created',
                message: `Admission ADM-${String(data.id).padStart(6, '0')} created successfully.`,
            })

            try {
                const b = await listBeds()
                setBeds(b.data || [])
                setLastSyncAt(new Date())
            } catch {
                /* ignore */
            }

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
                ? raw.detail.map((d) => d?.msg).filter(Boolean).join(', ')
                : raw?.detail || e1.message || 'Failed to create admission'

            const msg = /Bed not found/i.test(detail)
                ? 'Please select a valid bed.'
                : /Bed not available/i.test(detail)
                    ? 'That bed is not available. Pick another one.'
                    : detail

            showToast({ kind: 'error', title: 'Admission failed', message: msg })
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setPatientId(null)
        setSelectedPatient(null)
        setDepartmentId(null)
        setDoctorUserId(null)
        setBedId(null)
        setForm({
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
        showToast({ kind: 'success', title: 'Cleared', message: 'Admission draft cleared.' })
    }

    const isInsurancePayor = ['insurance', 'tpa'].includes(form.payor_type)
    const canSubmit = isPosInt(patientId) && isPosInt(bedId) && !loading

    const selectedPatientName = useMemo(
        () => (selectedPatient ? pickPatientName(selectedPatient) : isPosInt(patientId) ? `Patient #${patientId}` : ''),
        [selectedPatient, patientId],
    )
    const selectedPatientMeta = useMemo(() => (selectedPatient ? pickPatientMeta(selectedPatient) : null), [selectedPatient])

    return (
        <div className={UI.page}>
            {toast && (
                <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
                    <Toast kind={toast.kind} title={toast.title} message={toast.message} onClose={() => setToast(null)} />
                </div>
            )}

            <div className="mx-auto max-w-6xl px-4 py-6 space-y-4 md:px-8">
                {/* HERO (Apple-premium: banner + activity card + 2 mini cards) */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cx(
                        UI.glass,
                        'relative overflow-hidden',
                        // soften the “black frame” only for hero
                        'border-black/10 bg-white/70',
                    )}
                >
                    <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_58%)]" />

                    <div className="relative p-4 sm:p-6">
                        {(() => {
                            const now = new Date()
                            const h = now.getHours()
                            const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
                            const total = Math.max(1, bedStats.total)
                            const pct = (n) => Math.round((Math.max(0, n) / total) * 100)
                            const barH = (n) => `${Math.max(10, Math.min(100, pct(n)))}%`

                            const pillBase =
                                'inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm whitespace-nowrap'
                            const pillBtn =
                                'inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 text-[12px] font-semibold shadow-sm whitespace-nowrap transition hover:bg-black/[0.03] active:scale-[0.99]'

                            return (
                                <>
                                    {/* Top row: Title + actions */}
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="relative inline-flex h-2.5 w-2.5">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75" />
                                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                                                </span>
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                                                    Real-time IPD
                                                </span>
                                            </div>

                                            <div className="mt-2 flex items-start gap-3">
                                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-white/70 border border-black/10">
                                                    <BedDouble className="h-5 w-5 text-slate-700" />
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                                            IPD Admission
                                                        </h1>
                                                        <span className="text-[12px] font-semibold text-slate-600">
                                                            • {greet}
                                                        </span>
                                                    </div>

                                                    <p className="mt-1 text-sm text-slate-600">
                                                        Admit an in-patient with duplicate guard, live bed availability and payor details.
                                                    </p>

                                                </div>
                                            </div>
                                        </div>


                                    </div>

                                    {/* Content layout like your reference: big card + 2 small cards */}
                                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                        {/* Big activity card */}
                                        <div className="rounded-3xl border border-black/10 bg-white/80 p-4 shadow-[0_12px_30px_rgba(2,6,23,0.08)] lg:col-span-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Activity
                                                    </div>
                                                    <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
                                                        Bed status snapshot
                                                    </div>
                                                </div>
                                                <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                    Today
                                                </span>
                                            </div>

                                            {/* mini chart */}
                                            <div className="mt-4 h-24 rounded-2xl border border-black/10 bg-gradient-to-b from-slate-50 to-white p-3">
                                                <div className="flex h-full items-end gap-2">
                                                    <div className="flex-1">
                                                        <div className="h-full rounded-2xl bg-black/[0.03] p-1">
                                                            <div
                                                                className="w-full rounded-xl bg-emerald-200/70"
                                                                style={{ height: barH(bedStats.vacant) }}
                                                                title={`Vacant ${pct(bedStats.vacant)}%`}
                                                            />
                                                        </div>
                                                        <div className="mt-1 text-center text-[10px] font-semibold text-slate-600">Vacant</div>
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="h-full rounded-2xl bg-black/[0.03] p-1">
                                                            <div
                                                                className="w-full rounded-xl bg-amber-200/70"
                                                                style={{ height: barH(bedStats.reserved) }}
                                                                title={`Reserved ${pct(bedStats.reserved)}%`}
                                                            />
                                                        </div>
                                                        <div className="mt-1 text-center text-[10px] font-semibold text-slate-600">Reserved</div>
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="h-full rounded-2xl bg-black/[0.03] p-1">
                                                            <div
                                                                className="w-full rounded-xl bg-slate-300/80"
                                                                style={{ height: barH(bedStats.occupied) }}
                                                                title={`Occupied ${pct(bedStats.occupied)}%`}
                                                            />
                                                        </div>
                                                        <div className="mt-1 text-center text-[10px] font-semibold text-slate-600">Occupied</div>
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="h-full rounded-2xl bg-black/[0.03] p-1">
                                                            <div
                                                                className="w-full rounded-xl bg-sky-200/70"
                                                                style={{ height: '100%' }}
                                                                title="Total 100%"
                                                            />
                                                        </div>
                                                        <div className="mt-1 text-center text-[10px] font-semibold text-slate-600">Total</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* one-line metrics */}
                                            <div className="mt-3 grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
                                                <div className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vacant</div>
                                                    <div className="mt-0.5 text-[13px] font-semibold text-slate-900 tabular-nums">{bedStats.vacant}</div>
                                                </div>
                                                <div className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reserved</div>
                                                    <div className="mt-0.5 text-[13px] font-semibold text-slate-900 tabular-nums">{bedStats.reserved}</div>
                                                </div>
                                                <div className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Occupied</div>
                                                    <div className="mt-0.5 text-[13px] font-semibold text-slate-900 tabular-nums">{bedStats.occupied}</div>
                                                </div>
                                                <div className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</div>
                                                    <div className="mt-0.5 text-[13px] font-semibold text-slate-900 tabular-nums">{bedStats.total}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right mini cards (mobile: 1 per row, max 2 if space) */}
                                        <div className="grid gap-3 grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-1">
                                            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_12px_30px_rgba(2,6,23,0.06)]">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                                            Vacant beds
                                                        </div>
                                                        <div className="mt-1 text-[22px] font-semibold text-emerald-900 tabular-nums">
                                                            {bedStats.vacant}
                                                        </div>
                                                        <div className="mt-1 text-[12px] font-semibold text-emerald-800/80">
                                                            Available now
                                                        </div>
                                                    </div>
                                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white/70">
                                                        <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-3xl border border-slate-900 bg-slate-900 p-4 text-white shadow-[0_12px_30px_rgba(2,6,23,0.16)]">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                                                            Occupied beds
                                                        </div>
                                                        <div className="mt-1 text-[22px] font-semibold tabular-nums">{bedStats.occupied}</div>
                                                        <div className="mt-1 text-[12px] font-semibold text-white/70">
                                                            In use
                                                        </div>
                                                    </div>
                                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                                                        <XCircle className="h-5 w-5 text-white/90" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )
                        })()}
                    </div>
                </motion.div>


                {/* MAIN */}
                <PermGate
                    anyOf={['ipd.manage']}
                    fallback={
                        <div className={cx(UI.glass, 'p-5')}>
                            <div className="flex items-start gap-3">
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl border border-black/10 bg-amber-50">
                                    <AlertTriangle className="h-5 w-5 text-amber-800" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">Permission required</div>
                                    <p className="mt-1 text-[12px] text-slate-600">
                                        You do not have permission to create admissions. Ask admin to enable{' '}
                                        <span className="font-semibold">ipd.manage</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    }
                >
                    <form
                        onSubmit={handleSubmit}
                        className={cx(
                            // mobile: single column + fixed action bar space
                            'grid gap-3 pb-24',
                            // desktop: 2 columns
                            'lg:pb-0 lg:gap-4 lg:grid-cols-[1.05fr,0.95fr]',
                            'items-start',
                        )}
                    >
                        {/* LEFT COLUMN */}
                        <div className="space-y-3 lg:space-y-4">
                            {/* Step 1 — Patient */}
                            <Card className={cx('overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_12px_30px_rgba(2,6,23,0.08)]')}>
                                <CardHeader className="border-b border-black/10 bg-white/70 px-4 py-3 sm:px-5 sm:py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                                    Step 1
                                                </span>
                                                <CardTitle className="text-[15px] sm:text-base font-semibold text-slate-900">
                                                    Patient
                                                </CardTitle>
                                            </div>
                                            <CardDescription className="mt-1 text-[11px] text-slate-600">
                                                Search and pick (3 recent by default, more on typing).
                                            </CardDescription>
                                        </div>

                                        {isPosInt(patientId) ? (
                                            <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                                                Selected
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="px-4 py-4 sm:px-5">
                                    <div className="space-y-3">
                                        <PatientPagedPicker value={patientId ?? undefined} onChange={setPatientId} />

                                        {/* Compact selected patient summary */}
                                        {isPosInt(patientId) ? (
                                            <div className="rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-3 sm:p-4 shadow-[0_12px_28px_rgba(2,132,199,0.10)]">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                                                            Selected patient
                                                        </div>
                                                        <div className="mt-1 truncate text-[13px] font-semibold text-slate-900">
                                                            {selectedPatientName}
                                                        </div>

                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                                                                <CheckCircle2 className="h-4 w-4" />
                                                                Ready for admission
                                                            </span>

                                                            {selectedPatientMeta?.uhid ? (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                                    <IdCard className="h-4 w-4 text-slate-500" />
                                                                    {selectedPatientMeta.uhid}
                                                                </span>
                                                            ) : null}

                                                            {selectedPatientMeta?.phone ? (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                                    <Phone className="h-4 w-4 text-slate-500" />
                                                                    {selectedPatientMeta.phone}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-black/10 bg-white/85 px-3 text-[12px] font-semibold text-slate-800 hover:bg-black/[0.03]"
                                                        onClick={() => {
                                                            setPatientId(null)
                                                            setSelectedPatient(null)
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                        <span className="hidden sm:inline">Change</span>
                                                    </button>
                                                </div>

                                                <div className="mt-2 text-[11px] text-slate-600">
                                                    Duplicate active admission is blocked automatically.
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Step 2 — Doctor */}
                            <Card className={cx('overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_12px_30px_rgba(2,6,23,0.08)]')}>
                                <CardHeader className="border-b border-black/10 bg-white/70 px-4 py-3 sm:px-5 sm:py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                                    Step 2
                                                </span>
                                                <CardTitle className="text-[15px] sm:text-base font-semibold text-slate-900">
                                                    Primary doctor
                                                </CardTitle>
                                            </div>
                                            <CardDescription className="mt-1 text-[11px] text-slate-600">
                                                Department → Role → Doctor
                                            </CardDescription>
                                        </div>

                                        {isPosInt(doctorUserId) ? (
                                            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                                                Selected
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                Optional
                                            </span>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="px-4 py-4 sm:px-5">
                                    <DeptRoleUserPicker
                                        label="Primary doctor — Department · Role · User"
                                        value={doctorUserId ?? undefined}
                                        onChange={(userId, ctx) => {
                                            setDoctorUserId(userId || null)
                                            setDepartmentId(ctx?.department_id || null)
                                        }}
                                    />
                                </CardContent>
                            </Card>

                            {/* Step 3 — Bed */}
                            <Card className={cx('overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_12px_30px_rgba(2,6,23,0.08)]')}>
                                <CardHeader className="border-b border-black/10 bg-white/70 px-4 py-3 sm:px-5 sm:py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                                    Step 3
                                                </span>
                                                <CardTitle className="text-[15px] sm:text-base font-semibold text-slate-900">
                                                    Assign bed
                                                </CardTitle>
                                            </div>
                                            <CardDescription className="mt-1 text-[11px] text-slate-600">
                                                Ward → Room → Bed (live availability)
                                            </CardDescription>
                                        </div>

                                        <button
                                            type="button"
                                            className="inline-flex h-9 items-center gap-2 rounded-2xl border border-black/10 bg-white/85 px-3 text-[12px] font-semibold text-slate-700 hover:bg-black/[0.03]"
                                            onClick={() => refreshLookups({ bedsOnly: true })}
                                            disabled={loading}
                                            title="Refresh beds"
                                        >
                                            <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                            <span className="hidden sm:inline">Refresh</span>
                                            <span className="sm:hidden">Beds</span>
                                        </button>
                                    </div>
                                </CardHeader>

                                <CardContent className="px-4 py-4 sm:px-5">
                                    <div className="space-y-3">
                                        <WardRoomBedPicker value={bedId ?? ''} onChange={(v) => setBedId(isPosInt(v) ? Number(v) : null)} />

                                        {loading && beds.length === 0 && (
                                            <div className="space-y-2">
                                                <Skeleton className="h-9 w-full rounded-2xl" />
                                                <Skeleton className="h-9 w-full rounded-2xl" />
                                            </div>
                                        )}

                                        {selectedBed && (
                                            <div className="rounded-2xl border border-black/10 bg-white/85 p-3 sm:p-4">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[12px] font-semibold text-slate-900">
                                                        Selected: {selectedBed.code}
                                                    </span>

                                                    <span
                                                        className={cx(
                                                            'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                                                            selectedBed.state === 'vacant'
                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                                : selectedBed.state === 'reserved'
                                                                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                                    : 'border-slate-300 bg-slate-100 text-slate-700',
                                                        )}
                                                    >
                                                        {selectedBed.state}
                                                    </span>

                                                    {selectedBed.reserved_until ? (
                                                        <span className="text-[11px] text-slate-500">
                                                            reserved until {new Date(selectedBed.reserved_until).toLocaleString('en-IN')}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div className="mt-1 text-[11px] text-slate-500">
                                                    If bed state changes, refresh and select again.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT COLUMN */}
                        {/* RIGHT COLUMN */}
                        <div className="space-y-3 lg:space-y-4">
                            {/* Admission details */}
                            <Card
                                className={cx(
                                    'overflow-hidden rounded-3xl border border-black/10 bg-white/75 backdrop-blur-xl shadow-[0_12px_30px_rgba(2,6,23,0.08)]',
                                )}
                            >
                                <CardHeader className="border-b border-black/10 bg-white/70 px-4 py-3 sm:px-5 sm:py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <CardTitle className="text-[15px] sm:text-base font-semibold text-slate-900">
                                                Admission details
                                            </CardTitle>
                                            <CardDescription className="mt-1 text-[11px] text-slate-600">
                                                Type, discharge, package and payor.
                                            </CardDescription>
                                        </div>

                                        <span className="shrink-0 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                            Compact
                                        </span>
                                    </div>
                                </CardHeader>

                                <CardContent className="px-4 py-4 sm:px-5">
                                    {/* compact fields */}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {/* Admission type */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Admission type
                                            </label>

                                            <Select
                                                value={form.admission_type || 'planned'}
                                                onValueChange={(v) => setForm((p) => ({ ...p, admission_type: v }))}
                                            >
                                                <SelectTrigger className="h-10 rounded-2xl border border-black/10 bg-white/90 px-3 text-[12px] font-semibold text-slate-900 focus:ring-2 focus:ring-sky-100">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>

                                                <SelectContent
                                                    position="popper"
                                                    sideOffset={6}
                                                    className="z-[999] w-[--radix-select-trigger-width] max-h-[280px] overflow-auto rounded-2xl border border-black/10 bg-white/95 backdrop-blur-xl p-1 shadow-[0_18px_40px_rgba(2,6,23,0.18)]"
                                                >
                                                    {['planned', 'emergency', 'daycare'].map((t) => (
                                                        <SelectItem key={t} value={t} className="text-[12px] font-semibold">
                                                            {t}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Expected discharge */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Expected discharge
                                            </label>
                                            <input
                                                type="datetime-local"
                                                className={cx(UI.input, 'h-10 text-[12px] rounded-2xl border-black/10 bg-white/90')}
                                                value={form.expected_discharge_at}
                                                onChange={(e) => setForm((p) => ({ ...p, expected_discharge_at: e.target.value }))}
                                            />
                                        </div>

                                        {/* Package */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Package
                                            </label>

                                            <Select
                                                value={form.package_id ? String(form.package_id) : 'none'}
                                                onValueChange={(v) => setForm((p) => ({ ...p, package_id: v === 'none' ? '' : v }))}
                                            >
                                                <SelectTrigger className="h-10 rounded-2xl border border-black/10 bg-white/90 px-3 text-[12px] font-semibold text-slate-900 focus:ring-2 focus:ring-sky-100">
                                                    <SelectValue placeholder="—" />
                                                </SelectTrigger>

                                                <SelectContent
                                                    position="popper"
                                                    sideOffset={6}
                                                    className="z-[999] w-[--radix-select-trigger-width] max-h-[280px] overflow-auto rounded-2xl border border-black/10 bg-white/95 backdrop-blur-xl p-1 shadow-[0_18px_40px_rgba(2,6,23,0.18)]"
                                                >
                                                    <SelectItem value="none" className="text-[12px] font-semibold">
                                                        —
                                                    </SelectItem>

                                                    {packages?.length ? (
                                                        packages.map((p) => (
                                                            <SelectItem
                                                                key={p.id}
                                                                value={String(p.id)}
                                                                className="text-[12px] whitespace-normal break-words leading-snug"
                                                            >
                                                                {p.name}
                                                            </SelectItem>
                                                        ))
                                                    ) : (
                                                        <SelectItem value="__empty" disabled className="text-[12px]">
                                                            No packages
                                                        </SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Payor type */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Payor type
                                            </label>

                                            <Select
                                                value={form.payor_type || 'cash'}
                                                onValueChange={(v) => setForm((p) => ({ ...p, payor_type: v }))}
                                            >
                                                <SelectTrigger className="h-10 rounded-2xl border border-black/10 bg-white/90 px-3 text-[12px] font-semibold text-slate-900 focus:ring-2 focus:ring-sky-100">
                                                    <SelectValue placeholder="Select payor" />
                                                </SelectTrigger>

                                                <SelectContent
                                                    position="popper"
                                                    sideOffset={6}
                                                    className="z-[999] w-[--radix-select-trigger-width] max-h-[280px] overflow-auto rounded-2xl border border-black/10 bg-white/95 backdrop-blur-xl p-1 shadow-[0_18px_40px_rgba(2,6,23,0.18)]"
                                                >
                                                    {['cash', 'insurance', 'tpa'].map((x) => (
                                                        <SelectItem key={x} value={x} className="text-[12px] font-semibold">
                                                            {x}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Insurance fields */}
                                        {isInsurancePayor && (
                                            <>
                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Insurer / TPA
                                                    </label>
                                                    <Input
                                                        className={cx(UI.input, 'h-10 text-[12px] rounded-2xl border-black/10 bg-white/90')}
                                                        value={form.insurer_name}
                                                        onChange={(e) => setForm((p) => ({ ...p, insurer_name: e.target.value }))}
                                                        placeholder="e.g. Star Health / TPA name"
                                                    />
                                                </div>

                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Policy number
                                                    </label>
                                                    <Input
                                                        className={cx(UI.input, 'h-10 text-[12px] rounded-2xl border-black/10 bg-white/90')}
                                                        value={form.policy_number}
                                                        onChange={(e) => setForm((p) => ({ ...p, policy_number: e.target.value }))}
                                                        placeholder="Policy / Member ID"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <Separator className="my-4 bg-black/10" />

                                    {/* Clinical notes (compact) */}
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Clinical notes
                                            </div>
                                            <Badge variant="outline" className="rounded-full border-black/10 bg-white/85 text-[11px]">
                                                <Stethoscope className="mr-1 h-3.5 w-3.5" />
                                                Optional
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            <Input
                                                className={cx(UI.input, 'h-10 text-[12px] rounded-2xl border-black/10 bg-white/90')}
                                                value={form.preliminary_diagnosis}
                                                onChange={(e) => setForm((p) => ({ ...p, preliminary_diagnosis: e.target.value }))}
                                                placeholder="Preliminary diagnosis"
                                            />

                                            <Textarea
                                                className="min-h-[80px] rounded-2xl border border-black/10 bg-white/90 p-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
                                                value={form.history}
                                                onChange={(e) => setForm((p) => ({ ...p, history: e.target.value }))}
                                                placeholder="Short history…"
                                            />

                                            <Textarea
                                                className="min-h-[80px] rounded-2xl border border-black/10 bg-white/90 p-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
                                                value={form.care_plan}
                                                onChange={(e) => setForm((p) => ({ ...p, care_plan: e.target.value }))}
                                                placeholder="Care plan…"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ✅ Mobile action bar (NEW) */}
                            <div className="lg:hidden">
                                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/80 backdrop-blur-xl">
                                    <div className="mx-auto max-w-6xl px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-10 flex-1 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                                onClick={resetForm}
                                                disabled={loading}
                                            >
                                                Clear
                                            </Button>

                                            <Button
                                                type="submit"
                                                className="h-10 flex-[1.2] rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                                disabled={!canSubmit}
                                            >
                                                {loading ? (
                                                    <>
                                                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                                                        Admitting…
                                                    </>
                                                ) : (
                                                    <>
                                                        <ClipboardList className="mr-2 h-4 w-4" />
                                                        Admit
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        {!isPosInt(patientId) || !isPosInt(bedId) ? (
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                {!isPosInt(patientId) && (
                                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                                        Select patient
                                                    </span>
                                                )}
                                                {!isPosInt(bedId) && (
                                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                                        Select bed
                                                    </span>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Spacer so content won’t hide behind fixed bar */}
                                <div className="h-[88px]" />
                            </div>

                            {/* Desktop actions panel (kept sticky only on lg+) */}
                            <div className={cx('hidden lg:block', UI.glass, 'p-4 md:p-5 lg:sticky lg:bottom-4 border-black/10')}>
                                <div className="flex flex-col gap-3">
                                    <div className="text-[12px] text-slate-600">
                                        After admission, manage vitals, nursing notes, orders and discharge from Admission Details.
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                            onClick={resetForm}
                                            disabled={loading}
                                        >
                                            Clear
                                        </Button>

                                        <Button
                                            type="submit"
                                            className="h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                            disabled={!canSubmit}
                                        >
                                            {loading ? (
                                                <>
                                                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                                                    Admitting…
                                                </>
                                            ) : (
                                                <>
                                                    <ClipboardList className="mr-2 h-4 w-4" />
                                                    Admit patient
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {!isPosInt(patientId) || !isPosInt(bedId) ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            {!isPosInt(patientId) && (
                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                                    Select patient
                                                </span>
                                            )}
                                            {!isPosInt(bedId) && (
                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                                    Select bed
                                                </span>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>


                        {/* Mobile fixed action bar (easy access) */}
                        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/80 backdrop-blur-xl">
                            <div className="mx-auto max-w-6xl px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 flex-1 rounded-2xl border-black/10 bg-white/85 font-semibold"
                                        onClick={resetForm}
                                        disabled={loading}
                                    >
                                        Clear
                                    </Button>

                                    <Button
                                        type="submit"
                                        className="h-10 flex-[1.2] rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                        disabled={!canSubmit}
                                    >
                                        {loading ? (
                                            <>
                                                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                                                Admitting…
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardList className="mr-2 h-4 w-4" />
                                                Admit
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {!isPosInt(patientId) || !isPosInt(bedId) ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {!isPosInt(patientId) && (
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                                Select patient
                                            </span>
                                        )}
                                        {!isPosInt(bedId) && (
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                                Select bed
                                            </span>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </form>

                </PermGate>
            </div>
        </div>
    )
}
