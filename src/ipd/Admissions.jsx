// FILE: src/ipd/Admissions.jsx
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import PermGate from '../components/PermGate'
import { listAdmissions, createAdmission, listBeds, listPackages } from '../api/ipd'

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
} from 'lucide-react'
import { motion } from 'framer-motion'

// ---------- helpers ----------
function cx(...xs) {
    return xs.filter(Boolean).join(' ')
}

const UI = {
    page: 'min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-slate-50 via-white to-slate-50',
    glass:
        'rounded-3xl border border-black/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_35px_rgba(2,6,23,0.10)]',
    chip:
        'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-700',
    chipBtn:
        'inline-flex items-center gap-2 rounded-full border border-black/50 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-black/[0.03] active:scale-[0.99] transition disabled:opacity-60',
    input:
        'h-11 w-full rounded-2xl border border-black/50 bg-white/85 px-3 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500',
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
  
    const d = new Date(v) // for datetime-local, this becomes local time
    if (Number.isNaN(d.getTime())) return undefined
  
    return d.toISOString() // ✅ always UTC with Z
  }

// ---------- Small Toast (top) ----------
function Toast({ kind = 'success', title, message, onClose }) {
    const map = {
        success: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-800',
            Icon: CheckCircle2,
        },
        warn: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-900',
            Icon: AlertTriangle,
        },
        error: {
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            text: 'text-rose-800',
            Icon: XCircle,
        },
    }
    const S = map[kind] || map.success

    return (
        <div
            className={cx(
                'flex w-full max-w-md items-start gap-3 rounded-2xl border p-3 shadow-[0_18px_40px_rgba(2,6,23,0.16)]',
                'bg-white/80 backdrop-blur-xl',
                S.border,
            )}
        >
            <div className={cx('mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/50', S.bg)}>
                <S.Icon className={cx('h-5 w-5', S.text)} />
            </div>

            <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-900">{title}</div>
                {message ? <div className="mt-0.5 text-[12px] text-slate-600">{message}</div> : null}
            </div>

            <button
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/50 bg-white/70 hover:bg-black/[0.04]"
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
                        : 'bg-white/80 text-slate-900 border-black/50'

    return (
        <div className={cx('rounded-3xl border px-4 py-3', toneCls)}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
                    <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">{value}</div>
                </div>
                {Icon ? (
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/50 bg-white/30">
                        <Icon className="h-5 w-5 opacity-80" />
                    </div>
                ) : null}
            </div>
        </div>
    )
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
        [beds, bedId],
    )

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
        const t = setInterval(() => {
            // refresh only beds to reflect occupancy fast
            refreshLookups({ bedsOnly: true })
        }, 15000)
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

            // refresh beds to reflect occupancy
            try {
                const b = await listBeds()
                setBeds(b.data || [])
                setLastSyncAt(new Date())
            } catch {
                /* ignore */
            }

            // clear for next
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

    return (
        <div className={UI.page}>
            {/* Global Toast – fixed at top */}
            {toast && (
                <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
                    <Toast kind={toast.kind} title={toast.title} message={toast.message} onClose={() => setToast(null)} />
                </div>
            )}

            <div className="mx-auto max-w-6xl px-4 py-6 space-y-4 md:px-8">
                {/* HERO */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cx(UI.glass, 'relative overflow-hidden')}
                >
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_60%)]" />
                    <div className="relative p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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

                                <div className="mt-3 flex items-start gap-3">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-black/[0.04] border border-black/50">
                                        <BedDouble className="h-5 w-5 text-slate-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                                            IPD Admission
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Admit an in-patient with duplicate guard, live bed availability and payer details.
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className={UI.chip}>
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                Duplicate guard ON
                                            </span>

                                            <span className={UI.chip}>
                                                <Activity className="h-3.5 w-3.5" />
                                                Vacant <span className="ml-1 tabular-nums">{bedStats.vacant}</span>
                                            </span>

                                            <button
                                                type="button"
                                                className={cx(
                                                    UI.chipBtn,
                                                    autoRefreshBeds && 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800',
                                                )}
                                                onClick={() => setAutoRefreshBeds((v) => !v)}
                                                title="Auto refresh beds every 15s"
                                            >
                                                <Activity className="h-4 w-4" />
                                                Auto refresh beds
                                            </button>

                                            {lastSyncAt && (
                                                <span className={UI.chip}>
                                                    <Clock className="h-3.5 w-3.5" />
                                                    Synced <span className="ml-1 tabular-nums">{prettyTime(lastSyncAt)}</span>
                                                </span>
                                            )}

                                            {isPosInt(patientId) && (
                                                <span className={UI.chip}>
                                                    <User className="h-3.5 w-3.5" />
                                                    Patient selected
                                                </span>
                                            )}
                                            {isPosInt(bedId) && (
                                                <span className={UI.chip}>
                                                    <BedDouble className="h-3.5 w-3.5" />
                                                    Bed selected
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={() => refreshLookups({ bedsOnly: false })}
                                    className={UI.chipBtn}
                                    disabled={loading}
                                    title="Refresh beds & packages"
                                >
                                    <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                    Refresh
                                </button>
                                <span className={UI.chip}>
                                    Beds <span className="ml-1 tabular-nums">{bedStats.total}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard label="Vacant" value={bedStats.vacant} icon={CheckCircle2} tone="emerald" />
                            <StatCard label="Reserved" value={bedStats.reserved} icon={AlertTriangle} tone="amber" />
                            <StatCard label="Occupied" value={bedStats.occupied} icon={XCircle} tone="dark" />
                            <StatCard label="Total beds" value={bedStats.total} icon={BedDouble} tone="sky" />
                        </div>
                    </div>
                </motion.div>

                {/* MAIN */}
                <PermGate
                    anyOf={['ipd.manage']}
                    fallback={
                        <div className={cx(UI.glass, 'p-5')}>
                            <div className="flex items-start gap-3">
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl border border-black/50 bg-amber-50">
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
                    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                        {/* LEFT COLUMN */}
                        <div className="space-y-4">
                            {/* Patient */}
                            <Card className={cx(UI.glass, 'overflow-hidden')}>
                                <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                    <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                        Step 1 — Patient
                                    </CardTitle>
                                    <CardDescription className="text-[12px] text-slate-600">
                                        Search and select the patient to admit.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-3">
                                    <PatientPagedPicker value={patientId ?? undefined} onChange={setPatientId} />
                                    {isPosInt(patientId) && (
                                        <div className="rounded-3xl border border-black/50 bg-white/80 px-4 py-3 text-[12px] text-slate-600">
                                            Tip: Duplicate active admission is blocked automatically.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Doctor */}
                            <Card className={cx(UI.glass, 'overflow-hidden')}>
                                <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                    <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                        Step 2 — Primary doctor
                                    </CardTitle>
                                    <CardDescription className="text-[12px] text-slate-600">
                                        Pick Department → Role → Doctor.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
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

                            {/* Bed */}
                            <Card className={cx(UI.glass, 'overflow-hidden')}>
                                <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                                Step 3 — Assign bed
                                            </CardTitle>
                                            <CardDescription className="text-[12px] text-slate-600">
                                                Choose Ward → Room → Bed (live availability).
                                            </CardDescription>
                                        </div>

                                        <button
                                            type="button"
                                            className={UI.chipBtn}
                                            onClick={() => refreshLookups({ bedsOnly: true })}
                                            disabled={loading}
                                            title="Refresh beds"
                                        >
                                            <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                                            Beds
                                        </button>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-4 space-y-3">
                                    <WardRoomBedPicker
                                        value={bedId ?? ''}
                                        onChange={(v) => setBedId(isPosInt(v) ? Number(v) : null)}
                                    />

                                    {loading && beds.length === 0 && (
                                        <div className="space-y-2">
                                            <Skeleton className="h-10 w-full rounded-2xl" />
                                            <Skeleton className="h-10 w-full rounded-2xl" />
                                        </div>
                                    )}

                                    {selectedBed && (
                                        <div className="rounded-3xl border border-black/50 bg-white/80 px-4 py-3">
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
                                                                : 'border-slate-500 bg-slate-100 text-slate-700',
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
                                                If bed state changes during selection, refresh beds and choose again.
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="space-y-4">
                            {/* Admission details */}
                            <Card className={cx(UI.glass, 'overflow-hidden')}>
                                <CardHeader className="border-b border-black/50 bg-white/60 backdrop-blur-xl">
                                    <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
                                        Admission details
                                    </CardTitle>
                                    <CardDescription className="text-[12px] text-slate-600">
                                        Type, expected discharge, package, and payor.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="pt-4 space-y-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Admission type
                                            </label>
                                            <select
                                                className={cx(UI.input, 'h-11')}
                                                value={form.admission_type}
                                                onChange={(e) => setForm((p) => ({ ...p, admission_type: e.target.value }))}
                                            >
                                                {['planned', 'emergency', 'daycare'].map((t) => (
                                                    <option key={t} value={t}>
                                                        {t}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Expected discharge
                                            </label>
                                            <input
                                                type="datetime-local"
                                                className={cx(UI.input, 'h-11')}
                                                value={form.expected_discharge_at}
                                                onChange={(e) => setForm((p) => ({ ...p, expected_discharge_at: e.target.value }))}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Package
                                            </label>
                                            <select
                                                className={cx(UI.input, 'h-11')}
                                                value={form.package_id}
                                                onChange={(e) => setForm((p) => ({ ...p, package_id: e.target.value }))}
                                            >
                                                <option value="">—</option>
                                                {packages.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Payor type
                                            </label>
                                            <select
                                                className={cx(UI.input, 'h-11')}
                                                value={form.payor_type}
                                                onChange={(e) => setForm((p) => ({ ...p, payor_type: e.target.value }))}
                                            >
                                                {['cash', 'insurance', 'tpa'].map((x) => (
                                                    <option key={x} value={x}>
                                                        {x}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {isInsurancePayor && (
                                            <>
                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Insurer name
                                                    </label>
                                                    <Input
                                                        className={cx(UI.input, 'h-11')}
                                                        value={form.insurer_name}
                                                        onChange={(e) => setForm((p) => ({ ...p, insurer_name: e.target.value }))}
                                                        placeholder="e.g. Star Health / TPA name"
                                                    />
                                                </div>

                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Policy number
                                                    </label>
                                                    <Input
                                                        className={cx(UI.input, 'h-11')}
                                                        value={form.policy_number}
                                                        onChange={(e) => setForm((p) => ({ ...p, policy_number: e.target.value }))}
                                                        placeholder="Policy / Member ID"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <Separator className="bg-black/10" />

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                Clinical notes
                                            </div>
                                            <Badge variant="outline" className="rounded-full border-black/50 bg-white/85 text-[11px]">
                                                <Stethoscope className="mr-1 h-3.5 w-3.5" />
                                                Optional
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            <Input
                                                className={cx(UI.input, 'h-11')}
                                                value={form.preliminary_diagnosis}
                                                onChange={(e) => setForm((p) => ({ ...p, preliminary_diagnosis: e.target.value }))}
                                                placeholder="Preliminary diagnosis"
                                            />
                                            <Textarea
                                                className="min-h-[92px] rounded-2xl border border-black/50 bg-white/85 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
                                                value={form.history}
                                                onChange={(e) => setForm((p) => ({ ...p, history: e.target.value }))}
                                                placeholder="Short history (complaints, duration, relevant past history)…"
                                            />
                                            <Textarea
                                                className="min-h-[92px] rounded-2xl border border-black/50 bg-white/85 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
                                                value={form.care_plan}
                                                onChange={(e) => setForm((p) => ({ ...p, care_plan: e.target.value }))}
                                                placeholder="Care plan (initial orders / monitoring / consults)…"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Sticky actions */}
                            <div className={cx(UI.glass, 'p-4 md:p-5 sticky bottom-4')}>
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="text-[12px] text-slate-600">
                                        After admission, manage vitals, nursing notes, orders and discharge from Admission Details.
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-11 rounded-2xl border-black/50 bg-white/85 font-semibold"
                                            onClick={resetForm}
                                            disabled={loading}
                                        >
                                            Clear
                                        </Button>

                                        <Button
                                            type="submit"
                                            className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
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
                                </div>

                                {!isPosInt(patientId) || !isPosInt(bedId) ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
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
